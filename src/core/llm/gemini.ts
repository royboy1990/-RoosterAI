import type {
  LlmCompleteInput,
  LlmCompletion,
  LlmProvider,
  RunContext,
} from "../types";

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  error?: { message?: string; status?: string };
}

/**
 * Google Gemini generateContent via plain fetch.
 */
export const geminiProvider: LlmProvider = {
  id: "gemini",
  label: "Gemini",
  description: "Google Gemini generateContent API for the morning brief summary.",
  tags: ["llm"],
  setupDocs: ".env.example",
  defaultModel: "gemini-3.5-flash",
  requiredEnv: ["GEMINI_API_KEY"],
  async complete(
    input: LlmCompleteInput,
    ctx: RunContext,
  ): Promise<LlmCompletion> {
    const apiKey = process.env.GEMINI_API_KEY!.trim();
    const model = input.model.trim() || geminiProvider.defaultModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    ctx.log(`llm gemini: POST ${url}`);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.system }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: input.user }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
        },
      }),
      signal: ctx.signal,
    });

    const raw = (await res.json()) as GeminiGenerateResponse;
    if (!res.ok) {
      const detail = raw.error?.message ?? res.statusText;
      throw new Error(`Gemini ${res.status}: ${detail}`);
    }

    const text = raw.candidates?.[0]?.content?.parts
      ?.map((part) => part.text?.trim())
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!text) {
      throw new Error("Gemini response missing candidates[0].content.parts text");
    }

    const inputTokens = raw.usageMetadata?.promptTokenCount;
    const outputTokens = raw.usageMetadata?.candidatesTokenCount;
    const usage =
      typeof inputTokens === "number" && typeof outputTokens === "number"
        ? { inputTokens, outputTokens }
        : undefined;

    return { text, usage };
  },
};
