import type { BriefUsage } from "../types";
import { CHAT_PRICES, TTS_PRICES } from "./models";

/**
 * Estimate chat cost from public list prices.
 * Unknown model → null (store tokens; UI shows usage without a fake $).
 */
export function estimateChatUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const price = CHAT_PRICES[model.trim()];
  if (!price) {
    return null;
  }
  return (
    (inputTokens / 1_000_000) * price.inputPer1M +
    (outputTokens / 1_000_000) * price.outputPer1M
  );
}

/**
 * Estimate TTS cost from public list prices (input characters).
 * Unknown model → null.
 */
export function estimateTtsUsd(
  model: string,
  inputChars: number,
): number | null {
  const price = TTS_PRICES[model.trim()];
  if (!price) {
    return null;
  }
  return (inputChars / 1_000_000) * price.inputCharsPer1M;
}

/** Sum priced legs; null if nothing priced. */
export function sumUsage(
  ...parts: Array<number | null | undefined>
): number | null {
  let total = 0;
  let any = false;
  for (const part of parts) {
    if (typeof part === "number") {
      total += part;
      any = true;
    }
  }
  return any ? total : null;
}

/** Build a BriefUsage snapshot from optional LLM + TTS legs. */
export function buildBriefUsage(parts: {
  llm?: BriefUsage["llm"];
  tts?: BriefUsage["tts"];
}): BriefUsage | undefined {
  if (!parts.llm && !parts.tts) {
    return undefined;
  }
  return {
    llm: parts.llm,
    tts: parts.tts,
    estimatedUsd: sumUsage(parts.llm?.estimatedUsd, parts.tts?.estimatedUsd),
  };
}

/** Merge TTS into existing usage and recompute the total (on-demand audio). */
export function mergeTtsUsage(
  existing: BriefUsage | undefined,
  tts: NonNullable<BriefUsage["tts"]>,
): BriefUsage {
  const llm = existing?.llm;
  return {
    llm,
    tts,
    estimatedUsd: sumUsage(llm?.estimatedUsd, tts.estimatedUsd),
  };
}
