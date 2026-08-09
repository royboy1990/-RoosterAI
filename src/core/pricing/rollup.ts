import { listBriefIds, readBrief } from "../store";
import type { BriefRecord } from "../types";
import {
  localYmd,
  monthStartYmd,
  weekStartYmd,
} from "../calendar-week";

export interface BriefSpendSummary {
  weekUsd: number | null;
  monthUsd: number | null;
  weekBriefs: number;
  monthBriefs: number;
  /** True when at least one brief in week/month has usage but no priced total. */
  hasUnknown: boolean;
}

function briefLocalYmd(brief: BriefRecord, timezone: string): string {
  return localYmd(new Date(brief.createdAt), timezone);
}

function accumulateUsd(
  current: number | null,
  value: number | null | undefined,
): number | null {
  if (typeof value !== "number") {
    return current;
  }
  return (current ?? 0) + value;
}

/**
 * Calendar week (Mon–Sun) and calendar month totals in `timezone`,
 * summing frozen brief.usage.estimatedUsd where present.
 */
export async function summarizeBriefSpend(
  rootDir: string,
  timezone: string,
  now: Date = new Date(),
): Promise<BriefSpendSummary> {
  const today = localYmd(now, timezone);
  const weekStart = weekStartYmd(now, timezone);
  const monthStart = monthStartYmd(today);

  const ids = await listBriefIds(rootDir);

  let weekUsd: number | null = null;
  let monthUsd: number | null = null;
  let weekBriefs = 0;
  let monthBriefs = 0;
  let hasUnknown = false;

  for (const id of ids) {
    const brief = await readBrief(rootDir, id);
    if (!brief) {
      continue;
    }
    const ymd = briefLocalYmd(brief, timezone);

    const inWeek = ymd >= weekStart && ymd <= today;
    const inMonth = ymd >= monthStart && ymd <= today;
    if (!inWeek && !inMonth) {
      // listBriefIds is newest-first; once we pass the month window we can stop
      // only if older ids are always earlier — not guaranteed for clock skew,
      // so keep scanning.
      continue;
    }

    if (inWeek) {
      weekBriefs += 1;
    }
    if (inMonth) {
      monthBriefs += 1;
    }

    const usage = brief.usage;
    if (!usage) {
      continue;
    }

    const priced = usage.estimatedUsd;
    if (typeof priced === "number") {
      if (inWeek) {
        weekUsd = accumulateUsd(weekUsd, priced);
      }
      if (inMonth) {
        monthUsd = accumulateUsd(monthUsd, priced);
      }
    } else if (usage.llm || usage.tts) {
      // Tokens/chars stored but no list price — incomplete, not a fake $0.
      hasUnknown = true;
    }
  }

  return { weekUsd, monthUsd, weekBriefs, monthBriefs, hasUnknown };
}
