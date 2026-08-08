import {
  formatTokenCount,
  formatUsdEstimate,
} from "@/app/_lib/format";
import { copy } from "@/src/copy";
import type { BriefUsage } from "@/src/core/types";

/**
 * Muted cost line under a brief article.
 * Hides entirely when the brief has no usage snapshot.
 */
export function BriefCostLine({ usage }: { usage?: BriefUsage }) {
  if (!usage) {
    return null;
  }

  const llm = usage.llm;
  const tts = usage.tts;
  const total = usage.estimatedUsd;

  const parts: string[] = [];

  if (typeof total === "number") {
    parts.push(`${copy.latest.costEstPrefix} ${formatUsdEstimate(total)}`);
  } else if (llm) {
    parts.push(
      `${copy.latest.costEstPrefix} — · ${formatTokenCount(llm.inputTokens)} in / ${formatTokenCount(llm.outputTokens)} out`,
    );
  } else if (tts) {
    parts.push(`${copy.latest.costEstPrefix} —`);
  } else {
    return null;
  }

  // Breakdown segments when we have a priced total (or stub $0).
  if (typeof total === "number") {
    if (llm && typeof llm.estimatedUsd === "number") {
      parts.push(
        `${copy.latest.costLlmLabel} ${formatUsdEstimate(llm.estimatedUsd)}`,
      );
    } else if (llm) {
      parts.push(
        `${copy.latest.costLlmLabel} — · ${formatTokenCount(llm.inputTokens)} in / ${formatTokenCount(llm.outputTokens)} out`,
      );
    }
    if (tts) {
      if (typeof tts.estimatedUsd === "number") {
        parts.push(
          `${copy.latest.costTtsLabel} ${formatUsdEstimate(tts.estimatedUsd)}`,
        );
      } else {
        parts.push(`${copy.latest.costTtsLabel} —`);
      }
    }
  }

  return (
    <p className="metric-mono text-xs text-muted">{parts.join(" · ")}</p>
  );
}
