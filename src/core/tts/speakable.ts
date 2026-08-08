import { daypartGreeting } from "./greeting";
import { briefSignOff } from "./signoff";
import type { WeatherSnapshot } from "../weather/types";
import { weatherGreetingLine } from "../weather/sentence";

/**
 * Strip dashboard brief markdown into speakable prose (no second LLM pass).
 */

function stripInlines(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTableCells(line: string): string[] {
  const trimmed = line.trim();
  const withoutEdges = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return withoutEdges.split("|").map((cell) => cell.trim());
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.includes("|", 1);
}

function isTableSeparator(line: string): boolean {
  if (!isTableRow(line)) {
    return false;
  }
  const cells = splitTableCells(line);
  return (
    cells.length > 0 && cells.every((cell) => /^:?-{1,}:?$/.test(cell))
  );
}

function speakTable(lines: string[], start: number): { text: string; next: number } {
  const headerLine = lines[start]!;
  let i = start + 1;
  if (i < lines.length && isTableSeparator(lines[i]!)) {
    i += 1;
  }
  const headers = splitTableCells(headerLine).map(stripInlines);
  const spokenRows: string[] = [];
  while (i < lines.length && isTableRow(lines[i]!) && !isTableSeparator(lines[i]!)) {
    const cells = splitTableCells(lines[i]!).map(stripInlines);
    const parts = headers
      .map((header, index) => {
        const value = cells[index] ?? "";
        if (!header && !value) {
          return "";
        }
        return header ? `${header}: ${value}` : value;
      })
      .filter(Boolean);
    if (parts.length > 0) {
      spokenRows.push(parts.join(", "));
    }
    i += 1;
  }
  return { text: spokenRows.join(". "), next: i };
}

/** Convert brief markdown into plain spoken lines. */
export function toSpeakableBrief(text: string): string {
  const withoutDemo = text.replace(/^\[DEMO\]\s*/i, "").trim();
  const lines = withoutDemo.split(/\r?\n/);
  const spoken: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i]!;
    const trimmed = raw.trim();

    if (!trimmed || trimmed === "---" || trimmed === "***" || trimmed === "___") {
      i += 1;
      continue;
    }

    if (isTableRow(trimmed)) {
      const table = speakTable(lines, i);
      if (table.text) {
        spoken.push(table.text);
      }
      i = table.next;
      continue;
    }

    const heading = /^(#{3,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      spoken.push(stripInlines(heading[2]!));
      i += 1;
      continue;
    }

    const urgent = /^!!!\s+(.+)$/.exec(trimmed);
    if (urgent) {
      spoken.push(`Urgent: ${stripInlines(urgent[1]!)}`);
      i += 1;
      continue;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
    if (bullet) {
      spoken.push(stripInlines(bullet[1]!));
      i += 1;
      continue;
    }

    const numbered = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (numbered) {
      spoken.push(stripInlines(numbered[1]!));
      i += 1;
      continue;
    }

    spoken.push(stripInlines(trimmed));
    i += 1;
  }

  return spoken.filter(Boolean).join(". ").replace(/\.\s*\./g, ".").trim();
}

export function buildSpokenBrief(options: {
  text: string;
  operatorName: string;
  timezone: string;
  now: Date;
  weather?: WeatherSnapshot;
}): string {
  const greeting = daypartGreeting(
    options.now,
    options.timezone,
    options.operatorName,
  );
  const weatherLine = options.weather
    ? weatherGreetingLine(options.now, options.timezone, options.weather)
    : "";
  const signOff = briefSignOff(
    options.now,
    options.timezone,
    options.operatorName,
  );
  const body = toSpeakableBrief(options.text);
  const lead = weatherLine ? `${greeting} ${weatherLine}` : greeting;
  if (!body) {
    return `${lead} ${signOff}`;
  }
  return `${lead} ${body} ${signOff}`;
}
