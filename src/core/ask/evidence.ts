import type { BriefRecord, ConnectorOutcome } from "../types";

export interface AskEvidence {
  /** Assembled evidence block for the LLM user/system packet. */
  packet: string;
  /** Brief ids included (source first). */
  briefIds: string[];
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

/**
 * Assemble evidence for one Ask turn from frozen context briefs.
 * Source brief gets full text + digest + outcomes; neighbors get shorter text.
 */
export function assembleAskEvidence(input: {
  briefs: BriefRecord[];
  sourceBriefId?: string;
  charBudget: number;
}): AskEvidence {
  const { briefs, charBudget } = input;
  if (briefs.length === 0) {
    return { packet: "", briefIds: [] };
  }

  const sourceId = input.sourceBriefId ?? briefs[0]!.id;
  const source =
    briefs.find((b) => b.id === sourceId) ?? briefs[0]!;
  const neighbors = briefs.filter((b) => b.id !== source.id);

  const sections: string[] = [];
  let remaining = charBudget;

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
  remaining -= sourceBlock.length;

  for (const neighbor of neighbors) {
    if (remaining < 200) {
      break;
    }
    const neighborBudget = Math.min(1_800, Math.floor(remaining / 2));
    const block = truncate(
      `## Nearby brief (${neighbor.id}, ${neighbor.createdAt})\n${neighbor.text.trim()}`,
      neighborBudget,
    );
    sections.push(block);
    remaining -= block.length + 2;
  }

  return {
    packet: sections.join("\n\n"),
    briefIds: [source.id, ...neighbors.map((b) => b.id)],
  };
}

export const ASK_SYSTEM_PROMPT = `You are RoosterAI's Ask assistant. Answer only from the provided brief evidence.

Rules:
- Be calm, terse, and factual. No jokes, no invented drama.
- Start with the answer directly. Do not open with "According to the brief…" or similar provenance throat-clearing — the UI already shows source links.
- Never mention internal brief IDs in the answer. If you need to distinguish days, use a human date (e.g. "Aug 8 brief" or "yesterday's brief").
- Do not wrap paths, metrics, or names in backticks or markdown code spans — plain text only.
- If the evidence does not support an answer, say you do not know from the stored briefs.
- Do not invent metrics, messages, or events that are not in the evidence.
- Do not mention being an AI unless asked.
- Short paragraphs or bullets. No filler.`;
