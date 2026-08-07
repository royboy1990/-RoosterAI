import type { LlmCompleteInput, LlmProvider, RunContext } from "../types";
import { SHOWCASE_BRIEF_TEXT } from "../demo/showcase-brief";

/**
 * Offline brief writer for --demo (provider id "stub").
 * Returns the polished showcase brief so Tier 0 / marketing always look useful.
 */
export const stubProvider: LlmProvider = {
  id: "stub",
  label: "Stub (offline)",
  description: "Polished offline showcase brief — no API calls.",
  tags: ["dev"],
  setupDocs: "README.md",
  defaultModel: "stub",
  requiredEnv: [],
  async complete(
    _input: LlmCompleteInput,
    _ctx: RunContext,
  ): Promise<string> {
    return SHOWCASE_BRIEF_TEXT.trim();
  },
};
