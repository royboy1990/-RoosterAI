import type { WeeklyCarryForward, WeeklySignal } from "../types";

const CHANGE_HEADING = "What changed this week";
const PATTERN_HEADING = "Patterns worth knowing";
const CARRY_HEADING = "Still worth attention";

/**
 * Deterministic text from structured weekly fields.
 * Omits empty sections. Regenerating from the same fields must be identical.
 * Uses ### headings so BriefProse can render the archive page.
 */
export function renderWeeklyText(
  signals: WeeklySignal[],
  carryForward: WeeklyCarryForward[],
): string {
  const sections: string[] = [];

  const changes = signals.filter((s) => s.kind === "change");
  if (changes.length > 0) {
    sections.push(
      `### ${CHANGE_HEADING}\n${changes.map((s) => `- ${s.summary}`).join("\n")}`,
    );
  }

  const patterns = signals.filter((s) => s.kind === "pattern");
  if (patterns.length > 0) {
    sections.push(
      `### ${PATTERN_HEADING}\n${patterns.map((s) => `- ${s.summary}`).join("\n")}`,
    );
  }

  if (carryForward.length > 0) {
    sections.push(
      `### ${CARRY_HEADING}\n${carryForward.map((c) => `- ${c.summary}`).join("\n")}`,
    );
  }

  return sections.join("\n\n");
}
