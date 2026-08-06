import type { LlmCompleteInput, LlmProvider, RunContext } from "../types";

interface OpenAiChatResponse {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  error?: { message?: string };
}

/**
 * OpenAI-compatible chat completions via plain fetch.
 * Covers OpenAI, Groq, OpenRouter, Ollama, and LM Studio through OPENAI_BASE_URL.
 */
export const openaiCompatibleProvider: LlmProvider = {
  id: "openai-compatible",
  label: "OpenAI-compatible",
  description:
    "OpenAI, Groq, OpenRouter, Ollama, or LM Studio via chat completions.",
  tags: ["llm"],
  setupDocs: ".env.example",
  defaultModel: "gpt-5.6-terra",
  optionalEnv: ["OPENAI_BASE_URL"],
  requiredEnv: ["OPENAI_API_KEY"],
  async complete(
    input: LlmCompleteInput,
    ctx: RunContext,
  ): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY!.trim();
    const baseUrl = (
      process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1"
    ).replace(/\/$/, "");

    const url = `${baseUrl}/chat/completions`;
    ctx.log(`llm openai-compatible: POST ${url} model=${input.model}`);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
        temperature: 0.2,
      }),
      signal: ctx.signal,
    });

    const raw = (await res.json()) as OpenAiChatResponse;
    if (!res.ok) {
      const detail = raw.error?.message ?? res.statusText;
      throw new Error(`OpenAI-compatible ${res.status}: ${detail}`);
    }

    const text = raw.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("OpenAI-compatible response missing choices[0].message.content");
    }
    return text;
  },
};
