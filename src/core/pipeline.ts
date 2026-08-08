import { copy } from "../copy";
import type { LoadedConfig } from "./config";
import { getDeliveryChannel } from "./delivery";
import { getLlmProvider } from "./llm";
import { resolveWakeDecision } from "./memory";
import {
  isActive,
  isNeedsKeys,
  resolveConnectors,
  resolveUnknownInstalled,
} from "./registry";
import { buildDigest, sanitizeResult } from "./sanitize";
import { appendLog, toBriefId, writeBrief } from "./store";
import {
  audioPrefsFromConfig,
  createBriefAudioFile,
} from "./tts/brief-audio";
import type {
  BriefRecord,
  ConnectorOutcome,
  ConnectorResult,
  CoopStatus,
  RunContext,
  WakeMode,
} from "./types";

function missingEnv(
  required: readonly string[],
  env: NodeJS.ProcessEnv,
): string[] {
  return required.filter((name) => {
    const value = env[name];
    return value === undefined || value.trim() === "";
  });
}

function deriveStatus(
  outcomes: ConnectorOutcome[],
  llmFailed: boolean,
): CoopStatus {
  if (llmFailed) {
    return copy.coopStatus.feathersEverywhere;
  }
  const enabledAttempted = outcomes.length > 0;
  const anyBad = outcomes.some((o) => o.status !== "ok");
  if (enabledAttempted && anyBad) {
    return copy.coopStatus.ruffled;
  }
  return copy.coopStatus.optimal;
}

function formatStillInTheCoop(outcomes: ConnectorOutcome[]): string | null {
  const bad = outcomes.filter((o) => o.status !== "ok");
  if (bad.length === 0) {
    return null;
  }

  const lines = bad.map((o) => {
    if (o.status === "skipped" && o.error?.startsWith("missing env:")) {
      return `- ${copy.skippedMissingEnv(o.label)} (${o.error})`;
    }
    if (o.error?.includes("timed out") || o.error?.includes("Timeout")) {
      return `- ${copy.skippedTimeout(o.label)} (${o.error})`;
    }
    return `- ${copy.skippedFailed(o.label)}${o.error ? ` — ${o.error}` : ""}`;
  });

  return `## ${copy.stillInTheCoopHeading}\n${lines.join("\n")}`;
}

async function gatherConnectors(
  loaded: LoadedConfig,
  ctx: RunContext,
): Promise<ConnectorOutcome[]> {
  const { config } = loaded;
  const cards = resolveConnectors(loaded);
  const unknown = resolveUnknownInstalled(loaded);

  const outcomes: ConnectorOutcome[] = [];

  // needsKeys: installed intent, missing env — loud in "Still in the coop".
  for (const card of cards) {
    if (!isNeedsKeys(card)) {
      continue;
    }
    outcomes.push({
      connectorId: card.provider.id,
      label: card.provider.label,
      status: "skipped",
      error: `missing env: ${card.missingEnv.join(", ")}`,
    });
  }

  // Unknown fork ids that are enabled (not muted) fail loudly.
  for (const card of unknown) {
    if (card.state === "muted") {
      continue;
    }
    outcomes.push({
      connectorId: card.id,
      label: card.id,
      status: "failed",
      error: `unknown connector id "${card.id}"`,
    });
  }

  const active = cards.filter(isActive);
  if (active.length === 0 && outcomes.length === 0) {
    ctx.log(copy.emptyCoopPipeline);
  }

  const settled = await Promise.allSettled(
    active.map(async (card): Promise<ConnectorOutcome> => {
      const { provider: connector, entry } = card;

      const parsed = connector.configSchema.safeParse(entry.config ?? {});
      if (!parsed.success) {
        return {
          connectorId: connector.id,
          label: connector.label,
          status: "failed",
          error: `invalid connector config: ${parsed.error.message}`,
        };
      }

      const timeoutMs = config.connectorTimeoutMs;
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = AbortSignal.any([ctx.signal, timeout]);
      const connectorCtx: RunContext = { ...ctx, signal };

      try {
        const raw = await connector.fetch(parsed.data, connectorCtx);
        const result = sanitizeResult(raw, config.perConnectorCharBudget);
        return {
          connectorId: connector.id,
          label: connector.label,
          status: "ok",
          result,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const timedOut =
          timeout.aborted &&
          (message.includes("aborted") ||
            message.includes("Timeout") ||
            message.includes("timed out") ||
            err instanceof DOMException);
        return {
          connectorId: connector.id,
          label: connector.label,
          status: timedOut ? "skipped" : "failed",
          error: timedOut
            ? `timed out after ${timeoutMs}ms`
            : message,
        };
      }
    }),
  );

  for (let index = 0; index < settled.length; index++) {
    const item = settled[index]!;
    if (item.status === "fulfilled") {
      outcomes.push(item.value);
      continue;
    }
    const card = active[index]!;
    const message =
      item.reason instanceof Error ? item.reason.message : String(item.reason);
    outcomes.push({
      connectorId: card.provider.id,
      label: card.provider.label,
      status: "failed",
      error: message,
    });
  }

  return outcomes;
}

/**
 * Orchestration: gather → sanitize → summarize → persist → deliver.
 * No demo / dry-run branches — behavior comes from config + registries.
 */
let activeRun: Promise<BriefRecord> | null = null;

export async function runPipeline(loaded: LoadedConfig): Promise<BriefRecord> {
  if (activeRun) {
    throw new Error(copy.wake.alreadyRunning);
  }
  activeRun = runPipelineInner(loaded).finally(() => {
    activeRun = null;
  });
  return activeRun;
}

async function runPipelineInner(loaded: LoadedConfig): Promise<BriefRecord> {
  const { config, rootDir, source } = loaded;
  const now = new Date();
  const runSignal = AbortSignal.timeout(config.runDeadlineMs);

  const log = (message: string): void => {
    console.log(message);
    void appendLog(rootDir, message).catch((err: unknown) => {
      console.error("failed to append rooster.log", err);
    });
  };

  const ctx: RunContext = {
    signal: runSignal,
    timezone: config.timezone,
    now,
    log,
  };

  if (source === "defaults") {
    const ids = config.connectors.map((entry) => entry.id).join(", ") || "none";
    log(`no rooster.config.json — running auto-detected defaults (${ids})`);
  }

  log(`${copy.pendingGather}`);
  const outcomes = await gatherConnectors(loaded, ctx);

  const okResults: ConnectorResult[] = outcomes
    .filter((o) => o.status === "ok" && o.result)
    .map((o) => o.result!);

  let digest = buildDigest(okResults, copy.emptyConnectorResult);
  const coopSection = formatStillInTheCoop(outcomes);
  if (coopSection) {
    digest = digest ? `${digest}\n\n${coopSection}` : coopSection;
  }
  if (!digest.trim()) {
    digest = copy.emptyConnectorResult;
  }

  const llm = getLlmProvider(config.llm.provider);
  if (!llm) {
    throw new Error(`Unknown LLM provider "${config.llm.provider}"`);
  }

  const wake = await resolveWakeDecision({
    rootDir,
    demo: config.demo,
    digest,
    now,
  });
  const wakeMode: WakeMode = wake.mode;
  const baselineBriefId = wake.baseline?.id;

  if (wakeMode === "full") {
    log(copy.wakeModeFull);
  } else if (wakeMode === "diff" && baselineBriefId) {
    log(copy.wakeModeDiff(baselineBriefId));
  } else if (wakeMode === "unchanged" && baselineBriefId) {
    log(copy.wakeModeUnchanged(baselineBriefId));
  }

  const llmMissing = missingEnv(llm.requiredEnv, loaded.env);
  let text: string;
  let llmFailed = false;
  let llmError: string | undefined;

  // Skip the LLM when there is nothing to summarize (empty coop / all needsKeys / all failed).
  const skipLlm = okResults.length === 0;

  if (wakeMode === "unchanged" && wake.baseline) {
    text = copy.wakeUnchanged(wake.baseline.createdAt);
  } else if (skipLlm) {
    text = digest;
    log(copy.skippedLlmEmpty);
  } else if (llmMissing.length > 0) {
    llmFailed = true;
    llmError = `missing env: ${llmMissing.join(", ")}`;
    text = digest;
    log(`LLM skipped (${llmError}); delivering raw digest`);
  } else {
    log(copy.pendingLlm);
    const baseSystem =
      config.prompts.system?.trim() || copy.briefSystemPrompt;
    const system =
      wakeMode === "diff"
        ? `${baseSystem}\n\n${copy.briefMemoryRule}`
        : baseSystem;
    const overview = config.prompts.overview.trim();
    const digestBlock =
      wakeMode === "diff" && wake.memoryPacket
        ? `${wake.memoryPacket}\n\n---\n\n${digest}`
        : digest;
    const user = overview
      ? `${overview}\n\n---\n\n${digestBlock}`
      : digestBlock;
    const llmCtx: RunContext = {
      ...ctx,
      signal: AbortSignal.any([
        runSignal,
        AbortSignal.timeout(config.llmTimeoutMs),
      ]),
    };
    try {
      text = await llm.complete(
        {
          system,
          user,
          model: config.llm.model,
        },
        llmCtx,
      );
    } catch (err) {
      llmFailed = true;
      llmError = err instanceof Error ? err.message : String(err);
      text = digest;
      log(`LLM failed (${llmError}); delivering raw digest`);
    }
  }

  if (config.demo) {
    text = `${copy.demoMarker}\n${text}`;
  }

  const brief: BriefRecord = {
    id: toBriefId(now),
    createdAt: now.toISOString(),
    timezone: config.timezone,
    demo: config.demo,
    status: deriveStatus(outcomes, llmFailed),
    text,
    digest,
    outcomes,
    llmProviderId: llm.id,
    // Configured id, not the resolved channel — resolution happens after the
    // first writeBrief so a bad channel still leaves a persisted brief.
    deliveryChannelId: config.delivery.channel,
    llmFailed: llmFailed || undefined,
    llmError,
    wakeMode,
    baselineBriefId,
  };

  const openaiKey = loaded.env.OPENAI_API_KEY?.trim();
  if (
    config.ttsEnabled &&
    config.ttsMode === "each-wake" &&
    openaiKey
  ) {
    try {
      const audio = await createBriefAudioFile({
        rootDir,
        briefId: brief.id,
        text: brief.text,
        prefs: audioPrefsFromConfig(config),
        now,
        signal: AbortSignal.any([
          runSignal,
          AbortSignal.timeout(config.ttsTimeoutMs),
        ]),
        log,
      });
      brief.audioRelativePath = audio.audioRelativePath;
      brief.ttsVoice = audio.ttsVoice;
      log(`tts: saved ${audio.audioRelativePath} voice=${audio.ttsVoice}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      brief.ttsError = message;
      log(`tts failed (wake continues): ${message}`);
    }
  }

  const filePath = await writeBrief(rootDir, brief);
  log(`Persisted brief → ${filePath} · Coop Status: ${brief.status}`);

  const deliveryCtx: RunContext = {
    ...ctx,
    signal: AbortSignal.any([
      runSignal,
      AbortSignal.timeout(config.deliveryTimeoutMs),
    ]),
  };
  try {
    const delivery = getDeliveryChannel(config.delivery.channel);
    if (!delivery) {
      throw new Error(`Unknown delivery channel "${config.delivery.channel}"`);
    }
    const deliveryMissing = missingEnv(delivery.requiredEnv, loaded.env);
    if (deliveryMissing.length > 0) {
      throw new Error(
        `Delivery channel "${delivery.id}" missing env: ${deliveryMissing.join(", ")}`,
      );
    }
    await delivery.deliver({ text, brief }, deliveryCtx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    brief.deliveryError = message;
    await writeBrief(rootDir, brief);
    log(`Delivery failed (brief kept): ${message}`);
    throw err;
  }

  return brief;
}
