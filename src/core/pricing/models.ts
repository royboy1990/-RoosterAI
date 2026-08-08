/**
 * Local public list prices for cost estimates on briefs.
 * Not a billing API — freeze estimatedUsd onto BriefRecord.usage at write time.
 *
 * Sources (pricedAt 2026-08-08):
 * - OpenAI chat / TTS: https://developers.openai.com/api/docs/pricing
 * - Anthropic Claude: https://www.anthropic.com/pricing
 * - Google Gemini: https://ai.google.dev/pricing
 *
 * TTS estimate uses input characters only (plan: per 1M chars). OpenAI also
 * bills audio output tokens; we omit that so the local estimate stays
 * character-driven and slightly under real invoice cost.
 */

export const PRICED_AT = "2026-08-08";

/** USD per 1M input / output tokens. */
export interface ChatModelPrice {
  inputPer1M: number;
  outputPer1M: number;
}

/** USD per 1M input characters (TTS). */
export interface TtsModelPrice {
  inputCharsPer1M: number;
}

export const CHAT_PRICES: Readonly<Record<string, ChatModelPrice>> = {
  // Offline / local — always $0
  stub: { inputPer1M: 0, outputPer1M: 0 },
  local: { inputPer1M: 0, outputPer1M: 0 },

  // OpenAI defaults + common ids
  "gpt-5.6-terra": { inputPer1M: 2.0, outputPer1M: 12.0 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },

  // Anthropic
  "claude-sonnet-4.5": { inputPer1M: 3.0, outputPer1M: 15.0 },

  // Google
  "gemini-3.5-flash": { inputPer1M: 0.15, outputPer1M: 0.6 },
};

export const TTS_PRICES: Readonly<Record<string, TtsModelPrice>> = {
  // Community / docs historically framed input as ~$0.60 / 1M characters.
  "gpt-4o-mini-tts": { inputCharsPer1M: 0.6 },
};
