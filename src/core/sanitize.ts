import type { ConnectorResult } from "./types";

const TAG_RE = /<[^>]+>/g;
const ENTITY_RE = /&(#x?[0-9a-f]+|[a-z]+);/gi;

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(ENTITY_RE, (match, body: string) => {
    const lower = body.toLowerCase();
    if (lower.startsWith("#x")) {
      const code = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (lower.startsWith("#")) {
      const code = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED[lower] ?? match;
  });
}

/** Strip HTML/markup and collapse whitespace to plain text. */
export function toPlainText(input: string): string {
  return decodeEntities(input.replace(TAG_RE, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sanitize a connector result and enforce a per-connector character budget
 * so one chatty source cannot blow the LLM token cost.
 */
export function sanitizeResult(
  result: ConnectorResult,
  charBudget: number,
): ConnectorResult {
  const heading = toPlainText(result.heading) || "Untitled";
  const cleanedLines = result.lines
    .map((line) => toPlainText(line))
    .filter((line) => line.length > 0);

  if (cleanedLines.length === 0) {
    return { heading, lines: [] };
  }

  const lines: string[] = [];
  let used = heading.length;

  for (const line of cleanedLines) {
    const next = used + line.length + 1;
    if (next > charBudget) {
      const remaining = charBudget - used - 1;
      if (remaining > 24) {
        lines.push(`${line.slice(0, remaining - 1)}…`);
      }
      break;
    }
    lines.push(line);
    used = next;
  }

  return { heading, lines };
}

/** Assemble the pre-LLM digest the summarizer (or fallback) consumes. */
export function buildDigest(
  sections: ConnectorResult[],
  emptyLine: string,
): string {
  const blocks: string[] = [];

  for (const section of sections) {
    const body =
      section.lines.length > 0 ? section.lines.join("\n") : emptyLine;
    blocks.push(`## ${section.heading}\n${body}`);
  }

  return blocks.join("\n\n");
}
