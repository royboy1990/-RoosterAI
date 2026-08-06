import type { LlmProvider } from "../types";
import { anthropicProvider } from "./anthropic";
import { openaiCompatibleProvider } from "./openai-compatible";
import { stubProvider } from "./stub";

/** LLM provider registry. Add a provider file, then one line here. */
export const llmProviders: readonly LlmProvider[] = [
  stubProvider,
  openaiCompatibleProvider,
  anthropicProvider,
];

export function getLlmProvider(id: string): LlmProvider | undefined {
  return llmProviders.find((p) => p.id === id);
}
