/** Soft cap so prompts stay editable without blowing up the config file / LLM context. */
export const PROMPT_MAX_CHARS = 32_000;
/** How many previous prompt pairs to keep for restore. */
export const PROMPT_HISTORY_MAX = 20;

export interface PromptHistoryEntry {
  id: string;
  savedAt: string;
  system: string;
  overview: string;
}
