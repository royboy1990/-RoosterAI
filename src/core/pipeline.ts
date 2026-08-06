import { copy } from "../copy";
import type { LoadedConfig } from "./config";
import { getConnector } from "./connectors";
import { getDeliveryChannel } from "./delivery";
import { getLlmProvider } from "./llm";
import { buildDigest, sanitizeResult } from "./sanitize";
import { appendLog, toBriefId, writeBrief } from "./store";
import type {
  BriefRecord,
  ConnectorOutcome,
  ConnectorResult,
  CoopStatus,
  RunContext,
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
  const { config, env } = loaded;
  const enabled = config.connectors.filter((entry) => entry.enabled);

  const settled = await Promise.allSettled(
    enabled.map(async (entry): Promise<ConnectorOutcome> => {
      const connector = getConnector(entry.id);
      if (!connector) {
        return {
          connectorId: entry.id,
          label: entry.id,
          status: "failed",
          error: `unknown connector id "${entry.id}"`,
        };
      }

      const missing = missingEnv(connector.requiredEnv, env);
      if (missing.length > 0) {
        return {
          connectorId: connector.id,
          label: connector.label,
          status: "skipped",
          error: `missing env: ${missing.join(", ")}`,
        };
      }

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

  return settled.map((item, index) => {
    if (item.status === "fulfilled") {
      return item.value;
    }
    const entry = enabled[index]!;
    const message =
      item.reason instanceof Error ? item.reason.message : String(item.reason);
    return {
      connectorId: entry.id,
      label: entry.id,
      status: "failed" as const,
      error: message,
    };
  });
}

/**
 * Orchestration: gather → sanitize → summarize → deliver → persist.
 * No demo / dry-run branches — behavior comes from config + registries.
 */
export async function runPipeline(loaded: LoadedConfig): Promise<BriefRecord> {
  const { config, rootDir } = loaded;
  const now = new Date();
  const runAbort = new AbortController();

  const log = (message: string): void => {
    console.log(message);
    void appendLog(rootDir, message).catch((err: unknown) => {
      console.error("failed to append rooster.log", err);
    });
  };

  const ctx: RunContext = {
    signal: runAbort.signal,
    timezone: config.timezone,
    now,
    log,
  };

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

  const llmMissing = missingEnv(llm.requiredEnv, loaded.env);
  let text: string;
  let llmFailed = false;
  let llmError: string | undefined;

  if (llmMissing.length > 0) {
    llmFailed = true;
    llmError = `missing env: ${llmMissing.join(", ")}`;
    text = digest;
    log(`LLM skipped (${llmError}); delivering raw digest`);
  } else {
    log(copy.pendingLlm);
    try {
      text = await llm.complete(
        {
          system: copy.briefSystemPrompt,
          user: digest,
          model: config.llm.model,
        },
        ctx,
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
    deliveryChannelId: delivery.id,
    llmFailed: llmFailed || undefined,
    llmError,
  };

  await delivery.deliver({ text, brief }, ctx);
  const filePath = await writeBrief(rootDir, brief);
  log(`Persisted brief → ${filePath} · Coop Status: ${brief.status}`);

  return brief;
}
