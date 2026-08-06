import type { LlmProvider } from "../types";
import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import { openaiCompatibleProvider } from "./openai-compatible";
import { stubProvider } from "./stub";

export {
  anthropicProvider,
  geminiProvider,
  openaiCompatibleProvider,
  stubProvider,
};

/** LLM provider registry. Add a provider file, then one line here. */
export const llmProviders: readonly LlmProvider[] = [
  stubProvider,
  openaiCompatibleProvider,
  geminiProvider,
  anthropicProvider,
];

export function getLlmProvider(id: string): LlmProvider | undefined {
  return llmProviders.find((p) => p.id === id);
}
