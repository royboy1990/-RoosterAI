import type {
  BriefRecord,
  ConnectorOutcome,
  EvidenceRef,
  WeeklyRecord,
} from "../types";

export interface AskEvidence {
  /** Assembled evidence block for the LLM user/system packet. */
  packet: string;
  /** Brief ids included (source first). */
  briefIds: string[];
  /** Weekly ids included. */
  weeklyIds: string[];
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function formatOutcomes(
  outcomes: ConnectorOutcome[],
  budget: number,
): string {
  if (outcomes.length === 0 || budget < 40) {
    return "";
  }

  const parts: string[] = [];
  let used = 0;

  for (const outcome of outcomes) {
    const header = `- ${outcome.label} [${outcome.status}]${
      outcome.error ? ` — ${outcome.error}` : ""
    }`;
    const payload = outcome.result
      ? truncate(outcome.result.lines.join("\n"), 800)
      : "";
    const block = payload ? `${header}\n${payload}` : header;
    if (used + block.length + 1 > budget) {
      break;
    }
    parts.push(block);
    used += block.length + 1;
  }

  return parts.length > 0 ? `### Connector outcomes\n${parts.join("\n\n")}` : "";
}

function formatWeeklyBlock(week: WeeklyRecord, budget: number): string {
  const header = `## Weekly record (${week.id}, ${week.weekStart} → ${week.weekEnd})`;
  const body = [
    header,
    "### Text",
    week.text.trim() || "(empty)",
    "### Signals",
    week.signals.length === 0
      ? "(none)"
      : week.signals
          .map(
            (s) =>
              `- [${s.kind}] ${s.summary} (evidence: ${s.evidenceBriefIds.join(", ")})`,
          )
          .join("\n"),
    "### Still worth attention",
    week.carryForward.length === 0
      ? "(none)"
      : week.carryForward
          .map(
            (c) =>
              `- ${c.summary} (evidence: ${c.evidenceBriefIds.join(", ")})`,
          )
          .join("\n"),
  ].join("\n");
  return truncate(body, budget);
}

/**
 * Assemble evidence for one Ask turn from frozen context briefs + weeklies.
 * Budget split (explicit): ~45% source brief, ~35% weeklies, ~20% neighbors.
 */
export function assembleAskEvidence(input: {
  briefs: BriefRecord[];
  weeks?: WeeklyRecord[];
  sourceBriefId?: string;
  charBudget: number;
}): AskEvidence {
  const { briefs, charBudget } = input;
  const weeks = input.weeks ?? [];
  if (briefs.length === 0 && weeks.length === 0) {
    return { packet: "", briefIds: [], weeklyIds: [] };
  }

  const sourceId = input.sourceBriefId ?? briefs[0]?.id;
  const source =
    (sourceId ? briefs.find((b) => b.id === sourceId) : undefined) ??
    briefs[0];
  const neighbors = source
    ? briefs.filter((b) => b.id !== source.id)
    : [...briefs];

  const sourceBudget = Math.floor(charBudget * 0.45);
  const weeklyBudget = Math.floor(charBudget * 0.35);
  const neighborBudget = Math.max(0, charBudget - sourceBudget - weeklyBudget);

  const sections: string[] = [];
  const briefIds: string[] = [];
  const weeklyIds: string[] = [];

  if (source) {
    let remaining = sourceBudget;
    const sourceHeader = `## Source brief (${source.id}, ${source.createdAt})`;
    const sourceBody = [
      sourceHeader,
      "### Text",
      source.text.trim(),
      "### Digest",
      source.digest.trim() || "(empty)",
    ].join("\n");

    const outcomesBudget = Math.min(3_000, Math.floor(remaining * 0.25));
    const outcomes = formatOutcomes(source.outcomes, outcomesBudget);
    let sourceBlock = outcomes
      ? `${sourceBody}\n\n${outcomes}`
      : sourceBody;

    if (sourceBlock.length > remaining) {
      sourceBlock = truncate(sourceBlock, remaining);
    }
    sections.push(sourceBlock);
    briefIds.push(source.id);
  }

  let weeklyRemaining = weeklyBudget;
  for (const week of weeks) {
    if (weeklyRemaining < 120) {
      break;
    }
    const perWeek = Math.min(
      Math.floor(weeklyRemaining / Math.max(1, weeks.length - weeklyIds.length)),
      weeklyRemaining,
    );
    const block = formatWeeklyBlock(week, perWeek);
    sections.push(block);
    weeklyIds.push(week.id);
    weeklyRemaining -= block.length + 2;
  }

  let neighborRemaining = neighborBudget;
  for (const neighbor of neighbors) {
    if (neighborRemaining < 200) {
      break;
    }
    const perNeighbor = Math.min(1_800, Math.floor(neighborRemaining / 2));
    const block = truncate(
      `## Nearby brief (${neighbor.id}, ${neighbor.createdAt})\n${neighbor.text.trim()}`,
      perNeighbor,
    );
    sections.push(block);
    briefIds.push(neighbor.id);
    neighborRemaining -= block.length + 2;
  }

  return {
    packet: sections.join("\n\n"),
    briefIds,
    weeklyIds,
  };
}

/** Hidden citation marker: [[sources:brief:id1|week:id2]] */
const SOURCES_MARKER_RE =
  /\[\[sources:([^\]]+)\]\]/gi;

/**
 * Parse and strip the hidden sources marker from an assistant reply.
 * Does not use reply.includes(id) — week YMDs can appear inside brief ids.
 */
export function parseAndStripSourcesMarker(
  reply: string,
  allowed: EvidenceRef[],
): { text: string; sources: EvidenceRef[] } {
  const allowedKey = new Set(allowed.map((s) => `${s.type}:${s.id}`));
  const found: EvidenceRef[] = [];
  const seen = new Set<string>();

  const text = reply.replace(SOURCES_MARKER_RE, (_match, body: string) => {
    const parts = String(body)
      .split("|")
      .map((p) => p.trim())
      .filter(Boolean);
    for (const part of parts) {
      const colon = part.indexOf(":");
      if (colon <= 0) {
        continue;
      }
      const type = part.slice(0, colon).trim();
      const id = part.slice(colon + 1).trim();
      if (type !== "brief" && type !== "week") {
        continue;
      }
      const key = `${type}:${id}`;
      if (!allowedKey.has(key) || seen.has(key)) {
        continue;
      }
      seen.add(key);
      found.push({ type, id });
    }
    return "";
  });

  return {
    text: text.replace(/\n{3,}/g, "\n\n").trim(),
    sources: found,
  };
}

/** Map legacy sourceBriefIds → EvidenceRef briefs. */
export function evidenceFromLegacyBriefIds(
  sourceBriefIds: string[] | undefined,
): EvidenceRef[] {
  if (!sourceBriefIds || sourceBriefIds.length === 0) {
    return [];
  }
  return sourceBriefIds.map((id) => ({ type: "brief" as const, id }));
}

/** Prefer sources; fall back to legacy sourceBriefIds. */
export function resolveMessageSources(message: {
  sources?: EvidenceRef[];
  sourceBriefIds?: string[];
}): EvidenceRef[] {
  if (message.sources && message.sources.length > 0) {
    return message.sources;
  }
  return evidenceFromLegacyBriefIds(message.sourceBriefIds);
}

export const ASK_SYSTEM_PROMPT = `You are RoosterAI's Ask assistant. Answer only from the provided brief and weekly evidence.

Rules:
- Be calm, terse, and factual. No jokes, no invented drama.
- Start with the answer directly. Do not open with "According to the brief…" or similar provenance throat-clearing — the UI already shows source links.
- Never mention internal brief or week IDs in the visible answer. If you need to distinguish days, use a human date (e.g. "Aug 8 brief" or "the week of Aug 3").
- Do not wrap paths, metrics, or names in backticks or markdown code spans — plain text only.
- If the evidence does not support an answer, say you do not know from the stored briefs and weeklies.
- Do not invent metrics, messages, or events that are not in the evidence.
- Do not mention being an AI unless asked.
- Short paragraphs or bullets. No filler.
- After the visible answer, append exactly one hidden citation marker listing the evidence you used, in this form:
  [[sources:brief:BRIEF_ID|week:WEEK_ID]]
  Use only ids that appear in the evidence headers. Omit unused types. Example with one brief: [[sources:brief:2026-08-06T07-00-00.000Z]]`;
