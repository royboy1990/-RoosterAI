import type { LlmCompleteInput, LlmProvider, RunContext } from "../types";

/**
 * Formats a readable brief without calling an API.
 * Used by --demo and offline tests via config provider id "stub".
 */
export const stubProvider: LlmProvider = {
  id: "stub",
  label: "Stub (offline)",
  description: "Formats a readable brief without calling an API.",
  tags: ["dev"],
  setupDocs: "README.md",
  defaultModel: "stub",
  requiredEnv: [],
  async complete(
    input: LlmCompleteInput,
    _ctx: RunContext,
  ): Promise<string> {
    const sections = input.user
      .split(/^## /m)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        const [first, ...rest] = block.split("\n");
        const heading = (first ?? "Section").trim();
        const lines = rest.map((l) => l.trim()).filter(Boolean);
        return { heading, lines };
      });

    const parts: string[] = ["Morning brief (stub summary)", ""];

    for (const section of sections) {
      parts.push(`${section.heading}`);
      if (section.lines.length === 0) {
        parts.push("- Nothing new here.");
      } else {
        for (const line of section.lines) {
          parts.push(`- ${line}`);
        }
      }
      parts.push("");
    }

    parts.push("Action: triage unread mail and overdue tasks first.");
    return parts.join("\n").trim();
  },
};
