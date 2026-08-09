import { createHash } from "node:crypto";
import type { LoadedConfig } from "../config";
import {
  completedWeekStartsBack,
  localYmd,
  weekEndYmd,
  weekId,
  ymdInWeek,
} from "../calendar-week";
import { getLlmProvider, stubProvider } from "../llm";
import { buildBriefUsage, estimateChatUsd } from "../pricing/estimate";
import { listBriefIds, readBrief } from "../store";
import type {
  BriefRecord,
  BriefUsage,
  LlmUsage,
  RunContext,
  WeeklyCarryForward,
  WeeklyRecord,
  WeeklySignal,
} from "../types";
import {
  isSuccessfulWeek,
  pruneOldWeeks,
  readWeek,
  releaseWeekLease,
  tryAcquireWeekLease,
  writeWeek,
} from "../week-store";
import { buildDemoWeeklyFixture } from "./demo-fixture";
import { renderWeeklyText } from "./render";

const MAX_WEEKS_PER_WAKE = 2;
const LOOKBACK_WEEKS = 12;

export interface DigestGroup {
  digestHash: string;
  digest: string;
  outcomesJson: string;
  briefs: BriefRecord[];
  observationYmds: string[];
}

export function digestHash(digest: string): string {
  return createHash("sha256").update(digest).digest("hex").slice(0, 16);
}

/**
 * Collect in-week briefs by local createdAt YMD — do NOT resolveSubstantiveBrief.
 * Unchanged wakes contribute their own digest/outcomes and their own id.
 */
export async function collectInWeekBriefs(input: {
  rootDir: string;
  demo: boolean;
  timezone: string;
  weekStart: string;
  weekEnd: string;
}): Promise<BriefRecord[]> {
  const ids = await listBriefIds(input.rootDir);
  const matched: BriefRecord[] = [];

  for (const id of ids) {
    const brief = await readBrief(input.rootDir, id);
    if (!brief || brief.demo !== input.demo) {
      continue;
    }
    const ymd = localYmd(new Date(brief.createdAt), input.timezone);
    if (!ymdInWeek(ymd, input.weekStart, input.weekEnd)) {
      continue;
    }
    matched.push(brief);
  }

  // Oldest first for stable grouping / prompt order.
  matched.sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
  );
  return matched;
}

/** Group identical digest hashes; preserve all observation dates and brief IDs. */
export function groupBriefsByDigestHash(
  briefs: BriefRecord[],
  timezone: string,
): DigestGroup[] {
  const byHash = new Map<string, DigestGroup>();

  for (const brief of briefs) {
    const hash = digestHash(brief.digest);
    const ymd = localYmd(new Date(brief.createdAt), timezone);
    const existing = byHash.get(hash);
    if (existing) {
      existing.briefs.push(brief);
      if (!existing.observationYmds.includes(ymd)) {
        existing.observationYmds.push(ymd);
      }
      continue;
    }
    byHash.set(hash, {
      digestHash: hash,
      digest: brief.digest,
      outcomesJson: JSON.stringify(brief.outcomes),
      briefs: [brief],
      observationYmds: [ymd],
    });
  }

  return [...byHash.values()];
}

function weekdayLabel(ymd: string, timezone: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(utc);
}

/** Build the LLM user packet from digest groups. */
export function buildWeeklyPacket(
  groups: DigestGroup[],
  timezone: string,
  weekStart: string,
  weekEnd: string,
): string {
  const parts: string[] = [
    `Week ${weekStart} → ${weekEnd} (${timezone})`,
    "",
    "Use only the evidence below. Prefer cross-day patterns. Do not invent wins, revenue, ads, or completed user actions.",
    "Carry-forward items must be observed on multiple in-week dates OR present near week end (last 1–2 observation days). Frame as still worth attention — never imply resolution.",
    "",
  ];

  for (const group of groups) {
    const days = group.observationYmds
      .map((ymd) => weekdayLabel(ymd, timezone))
      .join(", ");
    const ids = group.briefs.map((b) => b.id).join(", ");
    parts.push(`### Same digest observed on ${days}`);
    parts.push(`Evidence: ${ids}`);
    parts.push(group.digest.trim() || "(empty digest)");
    parts.push("Outcomes:");
    parts.push(group.outcomesJson);
    parts.push("");
  }

  return parts.join("\n").trim();
}

const WEEKLY_SYSTEM = `You summarize one calendar week of morning briefs into structured JSON only.

Return a single JSON object with keys:
- "signals": array of { "key", "kind", "scope?", "summary", "direction?", "evidenceBriefIds" }
- "carryForward": array of { "key", "scope?", "summary", "evidenceBriefIds" }

Rules:
- kind is "change" or "pattern" only.
- direction when present is one of: improved, declined, mixed, unchanged.
- Every evidenceBriefIds entry MUST be one of the Evidence ids in the packet.
- Prefer cross-day patterns over single-day noise.
- No invented metrics, wins, revenue, or ads.
- No claims that the user completed or resolved an action.
- carryForward = still worth attention only (multi-day or late-week). Stable key (+ optional scope).
- Do not include a "text" field.
- If nothing worth reporting, return empty arrays.`;

interface RawWeeklyJson {
  signals?: unknown;
  carryForward?: unknown;
  text?: unknown;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());
}

function parseJsonObject(raw: string): RawWeeklyJson {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1]!.trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Weekly LLM response was not a JSON object");
  }
  return JSON.parse(body.slice(start, end + 1)) as RawWeeklyJson;
}

/**
 * Validate LLM structured output. Drops invalid claims.
 * Rejects any top-level text field (structured-only).
 */
export function validateWeeklyStructured(input: {
  raw: unknown;
  sourceBriefIds: string[];
}): {
  signals: WeeklySignal[];
  carryForward: WeeklyCarryForward[];
} {
  const sourceSet = new Set(input.sourceBriefIds);
  const data = input.raw as RawWeeklyJson;

  const signals: WeeklySignal[] = [];
  if (Array.isArray(data.signals)) {
    for (const item of data.signals) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const row = item as Record<string, unknown>;
      const key = asString(row.key);
      const kind = asString(row.kind);
      const summary = asString(row.summary);
      if (!key || !summary || (kind !== "change" && kind !== "pattern")) {
        continue;
      }
      const evidence = asStringArray(row.evidenceBriefIds).filter((id) =>
        sourceSet.has(id),
      );
      if (evidence.length === 0) {
        continue;
      }
      const direction = asString(row.direction);
      const validDirection =
        direction === "improved" ||
        direction === "declined" ||
        direction === "mixed" ||
        direction === "unchanged"
          ? direction
          : undefined;
      const signal: WeeklySignal = {
        key,
        kind,
        summary,
        evidenceBriefIds: evidence,
      };
      const scope = asString(row.scope);
      if (scope) {
        signal.scope = scope;
      }
      if (validDirection) {
        signal.direction = validDirection;
      }
      signals.push(signal);
    }
  }

  const carryForward: WeeklyCarryForward[] = [];
  if (Array.isArray(data.carryForward)) {
    for (const item of data.carryForward) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const row = item as Record<string, unknown>;
      const key = asString(row.key);
      const summary = asString(row.summary);
      if (!key || !summary) {
        continue;
      }
      const evidence = asStringArray(row.evidenceBriefIds).filter((id) =>
        sourceSet.has(id),
      );
      if (evidence.length === 0) {
        continue;
      }
      const carry: WeeklyCarryForward = {
        key,
        summary,
        evidenceBriefIds: evidence,
      };
      const scope = asString(row.scope);
      if (scope) {
        carry.scope = scope;
      }
      carryForward.push(carry);
    }
  }

  return { signals, carryForward };
}

function retryAfterIso(now: Date, hours: number): string {
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function shouldSkipCooldown(week: WeeklyRecord | null, now: Date): boolean {
  if (!week?.retryAfter) {
    return false;
  }
  return new Date(week.retryAfter).getTime() > now.getTime();
}

async function writeFailureRecord(input: {
  rootDir: string;
  id: string;
  weekStart: string;
  weekEnd: string;
  timezone: string;
  demo: boolean;
  sourceBriefIds: string[];
  error: string;
  now: Date;
  retryHours: number;
  existing: WeeklyRecord | null;
}): Promise<void> {
  const record: WeeklyRecord = {
    id: input.id,
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
    timezone: input.timezone,
    demo: input.demo,
    createdAt: input.existing?.createdAt ?? input.now.toISOString(),
    sourceBriefIds: input.sourceBriefIds,
    signals: [],
    carryForward: [],
    text: "",
    lastAttemptAt: input.now.toISOString(),
    retryAfter: retryAfterIso(input.now, input.retryHours),
    generationError: input.error,
  };
  await writeWeek(input.rootDir, record);
}

/**
 * Attempt one week under an exclusive lease. Returns:
 * - "generated" when provider was called (success or cooldown write after LLM)
 * - "skipped" when file exists / lease / cooldown / empty (no provider slot)
 * - "demo" when canned fixture written (counts as a generation slot for demo wakes)
 */
async function generateOneWeek(input: {
  loaded: LoadedConfig;
  weekStart: string;
  now: Date;
  ctx: RunContext;
  stageSignal: AbortSignal;
}): Promise<"generated" | "skipped" | "demo"> {
  const { loaded, weekStart, now, ctx, stageSignal } = input;
  const { config, rootDir } = loaded;
  const demo = config.demo;
  const timezone = config.timezone;
  const weekEnd = weekEndYmd(weekStart);
  const id = weekId(weekStart, demo);

  const existing = await readWeek(rootDir, id);
  if (existing && isSuccessfulWeek(existing)) {
    return "skipped";
  }
  if (shouldSkipCooldown(existing, now)) {
    ctx.log(`weekly: skip ${id} (cooldown until ${existing!.retryAfter})`);
    return "skipped";
  }

  const leased = await tryAcquireWeekLease(rootDir, id);
  if (!leased) {
    ctx.log(`weekly: skip ${id} (lease held)`);
    return "skipped";
  }

  try {
    // Re-check after lease — another process may have finished.
    const again = await readWeek(rootDir, id);
    if (again && isSuccessfulWeek(again)) {
      return "skipped";
    }
    if (shouldSkipCooldown(again, now)) {
      return "skipped";
    }

    const briefs = await collectInWeekBriefs({
      rootDir,
      demo,
      timezone,
      weekStart,
      weekEnd,
    });
    if (briefs.length === 0) {
      ctx.log(`weekly: skip ${id} (no in-week briefs)`);
      return "skipped";
    }

    const sourceBriefIds = briefs.map((b) => b.id);
    const llm = getLlmProvider(config.llm.provider);
    const useFixture = demo || !llm || llm.id === stubProvider.id;

    if (useFixture) {
      const fixture = buildDemoWeeklyFixture({
        weekStart,
        timezone,
        sourceBriefIds,
        createdAt: now.toISOString(),
      });
      // Real lane + stub still uses demo:false id path — adjust fixture.
      const record: WeeklyRecord = {
        ...fixture,
        id,
        demo,
        sourceBriefIds,
        text: renderWeeklyText(fixture.signals, fixture.carryForward),
      };
      await writeWeek(rootDir, record);
      await pruneOldWeeks(rootDir, demo, config.weeklyRetentionWeeks);
      ctx.log(`weekly: wrote fixture ${id}`);
      return "demo";
    }

    const missing = llm.requiredEnv.filter((name) => {
      const value = loaded.env[name];
      return value === undefined || value.trim() === "";
    });
    if (missing.length > 0) {
      await writeFailureRecord({
        rootDir,
        id,
        weekStart,
        weekEnd,
        timezone,
        demo,
        sourceBriefIds,
        error: `missing env: ${missing.join(", ")}`,
        now,
        retryHours: config.weeklyRetryHours,
        existing: again,
      });
      ctx.log(`weekly: failed ${id} (missing env)`);
      return "generated";
    }

    const groups = groupBriefsByDigestHash(briefs, timezone);
    const packet = buildWeeklyPacket(groups, timezone, weekStart, weekEnd);
    const weeklyCtx: RunContext = {
      ...ctx,
      signal: AbortSignal.any([stageSignal, ctx.signal]),
    };

    let completionText: string;
    let llmUsage: LlmUsage | undefined;
    try {
      const completion = await llm.complete(
        {
          system: WEEKLY_SYSTEM,
          user: packet,
          model: config.llm.model,
        },
        weeklyCtx,
      );
      completionText = completion.text;
      llmUsage = completion.usage;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await writeFailureRecord({
        rootDir,
        id,
        weekStart,
        weekEnd,
        timezone,
        demo,
        sourceBriefIds,
        error: message,
        now,
        retryHours: config.weeklyRetryHours,
        existing: again,
      });
      ctx.log(`weekly: LLM failed ${id}: ${message}`);
      return "generated";
    }

    let parsed: RawWeeklyJson;
    try {
      parsed = parseJsonObject(completionText);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await writeFailureRecord({
        rootDir,
        id,
        weekStart,
        weekEnd,
        timezone,
        demo,
        sourceBriefIds,
        error: message,
        now,
        retryHours: config.weeklyRetryHours,
        existing: again,
      });
      ctx.log(`weekly: parse failed ${id}: ${message}`);
      return "generated";
    }

    const { signals, carryForward } = validateWeeklyStructured({
      raw: parsed,
      sourceBriefIds,
    });

    let usage: BriefUsage | undefined;
    if (llmUsage) {
      usage = buildBriefUsage({
        llm: {
          model: config.llm.model,
          inputTokens: llmUsage.inputTokens,
          outputTokens: llmUsage.outputTokens,
          estimatedUsd: estimateChatUsd(
            config.llm.model,
            llmUsage.inputTokens,
            llmUsage.outputTokens,
          ),
        },
      });
    }

    const record: WeeklyRecord = {
      id,
      weekStart,
      weekEnd,
      timezone,
      demo,
      createdAt: now.toISOString(),
      sourceBriefIds,
      signals,
      carryForward,
      text: renderWeeklyText(signals, carryForward),
      usage,
    };
    await writeWeek(rootDir, record);
    await pruneOldWeeks(rootDir, demo, config.weeklyRetentionWeeks);
    ctx.log(
      `weekly: wrote ${id} (${signals.length} signals, ${carryForward.length} carry-forward)`,
    );
    return "generated";
  } finally {
    await releaseWeekLease(rootDir, id);
  }
}

/**
 * Lazy idempotent weekly backfill after daily delivery.
 * Fail-soft: never throws (caller rethrows delivery errors separately).
 * Entire stage shares one AbortSignal.timeout(weeklyTimeoutMs).
 */
export async function maybeGenerateWeekly(input: {
  loaded: LoadedConfig;
  now: Date;
  ctx: RunContext;
}): Promise<void> {
  const { loaded, now, ctx } = input;
  const { config } = loaded;

  if (!config.weeklyEnabled) {
    return;
  }

  const stageSignal = AbortSignal.timeout(config.weeklyTimeoutMs);
  const candidates = completedWeekStartsBack(now, config.timezone, LOOKBACK_WEEKS);

  let slotsUsed = 0;

  for (const weekStart of candidates) {
    if (stageSignal.aborted) {
      ctx.log("weekly: stage timeout — stopping backfill");
      break;
    }
    if (slotsUsed >= MAX_WEEKS_PER_WAKE) {
      break;
    }

    try {
      const result = await generateOneWeek({
        loaded,
        weekStart,
        now,
        ctx,
        stageSignal,
      });
      if (result === "generated" || result === "demo") {
        slotsUsed += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.log(`weekly: unexpected error (fail-soft): ${message}`);
      // Provider/timeouts that escape still consume a slot if we already wrote cooldown;
      // unexpected errors do not — continue carefully.
      if (stageSignal.aborted) {
        break;
      }
    }
  }
}
