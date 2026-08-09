import { listBriefIds, readBrief, resolveSubstantiveBrief } from "../store";
import type { BriefRecord, WeeklyRecord } from "../types";
import {
  isArchiveVisibleWeek,
  isSuccessfulWeek,
  listWeekIds,
  readWeek,
} from "../week-store";
import { localYmd } from "../calendar-week";

/**
 * Build a frozen context window for a new Ask thread.
 * Always includes the source (substantive) brief, then preceding substantive
 * briefs in the same demo/real lane — skipping empty/unchanged shells.
 */
export async function buildContextBriefIds(input: {
  rootDir: string;
  sourceBriefId: string;
  demo: boolean;
  maxBriefs: number;
}): Promise<string[]> {
  const max = Math.max(1, Math.min(7, input.maxBriefs));
  const source = await readBrief(input.rootDir, input.sourceBriefId);
  if (!source || source.demo !== input.demo) {
    return [];
  }

  const body = await resolveSubstantiveBrief(input.rootDir, source);
  if (body.demo !== input.demo) {
    return [];
  }

  const ids: string[] = [body.id];
  if (ids.length >= max) {
    return ids;
  }

  const allIds = await listBriefIds(input.rootDir);
  for (const id of allIds) {
    if (ids.length >= max) {
      break;
    }
    if (ids.includes(id)) {
      continue;
    }
    const brief = await readBrief(input.rootDir, id);
    if (!brief || brief.demo !== input.demo) {
      continue;
    }
    // Only take briefs that are older than (or equal to) the source body.
    if (brief.createdAt > body.createdAt) {
      continue;
    }
    const substantive = await resolveSubstantiveBrief(input.rootDir, brief);
    if (substantive.demo !== input.demo) {
      continue;
    }
    if (ids.includes(substantive.id)) {
      continue;
    }
    // Skip empty pointer shells that resolved to something we already have,
    // and skip briefs with no usable body text.
    if (!substantive.text.trim()) {
      continue;
    }
    ids.push(substantive.id);
  }

  return ids;
}

/**
 * Newest successful weeklies with weekEnd on/before the as-of local day,
 * same demo lane. Failed/cooldown stubs are excluded.
 */
export async function buildContextWeeklyIds(input: {
  rootDir: string;
  demo: boolean;
  timezone: string;
  /** As-of instant — typically the source brief's createdAt. */
  asOf: Date;
  maxWeeks: number;
}): Promise<string[]> {
  const max = Math.max(0, Math.min(12, input.maxWeeks));
  if (max === 0) {
    return [];
  }

  const asOfYmd = localYmd(input.asOf, input.timezone);
  const ids = await listWeekIds(input.rootDir);
  const selected: WeeklyRecord[] = [];

  for (const id of ids) {
    const week = await readWeek(input.rootDir, id);
    if (!week || week.demo !== input.demo) {
      continue;
    }
    if (!isSuccessfulWeek(week) || !isArchiveVisibleWeek(week)) {
      continue;
    }
    if (week.weekEnd > asOfYmd) {
      continue;
    }
    selected.push(week);
  }

  selected.sort((a, b) => {
    if (a.weekStart !== b.weekStart) {
      return a.weekStart < b.weekStart ? 1 : -1;
    }
    return a.createdAt < b.createdAt ? 1 : -1;
  });

  return selected.slice(0, max).map((w) => w.id);
}

/** Load briefs for a frozen id list (order preserved; missing ids dropped). */
export async function loadContextBriefs(
  rootDir: string,
  contextBriefIds: string[],
): Promise<BriefRecord[]> {
  const briefs: BriefRecord[] = [];
  for (const id of contextBriefIds) {
    const brief = await readBrief(rootDir, id);
    if (brief) {
      briefs.push(brief);
    }
  }
  return briefs;
}

/** Load weeklies for a frozen id list (order preserved; missing ids dropped). */
export async function loadContextWeeks(
  rootDir: string,
  contextWeeklyIds: string[],
): Promise<WeeklyRecord[]> {
  const weeks: WeeklyRecord[] = [];
  for (const id of contextWeeklyIds) {
    const week = await readWeek(rootDir, id);
    if (week) {
      weeks.push(week);
    }
  }
  return weeks;
}
