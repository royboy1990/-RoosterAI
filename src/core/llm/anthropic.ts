import type { LlmCompleteInput, LlmProvider, RunContext } from "../types";

interface AnthropicMessageResponse {
  content?: Array<{ type?: string; text?: string }>;
  error?: { message?: string; type?: string };
}

/**
 * Anthropic Messages API via plain fetch.
 */
export const anthropicProvider: LlmProvider = {
  id: "anthropic",
  label: "Anthropic",
  requiredEnv: ["ANTHROPIC_API_KEY"],
  async complete(
    input: LlmCompleteInput,
    ctx: RunContext,
  ): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY!.trim();
    const url = "https://api.anthropic.com/v1/messages";
    ctx.log(`llm anthropic: POST ${url} model=${input.model}`);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: 2048,
        system: input.system,
        messages: [{ role: "user", content: input.user }],
      }),
      signal: ctx.signal,
    });

    const raw = (await res.json()) as AnthropicMessageResponse;
    if (!res.ok) {
      const detail = raw.error?.message ?? res.statusText;
      throw new Error(`Anthropic ${res.status}: ${detail}`);
    }

    const text = raw.content
      ?.filter((block) => block.type === "text" && block.text)
      .map((block) => block.text!)
      .join("\n")
      .trim();

    if (!text) {
      throw new Error("Anthropic response missing text content blocks");
    }
    return text;
  },
};
