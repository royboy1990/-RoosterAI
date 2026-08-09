/**
 * Shared Mon–Sun calendar helpers (timezone-aware local YMD).
 * Used by pricing rollup and weekly memory.
 */

/** YYYY-MM-DD in an IANA timezone. */
export function localYmd(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Monday=0 … Sunday=6 for the local calendar day of `date`. */
export function localMondayOffset(date: Date, timezone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return map[weekday] ?? 0;
}

export function shiftYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1, d! + deltaDays, 12, 0, 0));
  return utc.toISOString().slice(0, 10);
}

export function monthStartYmd(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

/** Monday YMD of the calendar week containing `date` in `timezone`. */
export function weekStartYmd(now: Date, timezone: string): string {
  const today = localYmd(now, timezone);
  const offset = localMondayOffset(now, timezone);
  return shiftYmd(today, -offset);
}

/** Sunday YMD for a Monday week start. */
export function weekEndYmd(weekStart: string): string {
  return shiftYmd(weekStart, 6);
}

/** Week id: `{weekStartYmd}` or `{weekStartYmd}.demo`. */
export function weekId(weekStartYmdValue: string, demo: boolean): string {
  return demo ? `${weekStartYmdValue}.demo` : weekStartYmdValue;
}

/**
 * Previous completed Mon–Sun week relative to `now`, then walk back.
 * Returns Monday YMDs newest-first (previous week first).
 */
export function completedWeekStartsBack(
  now: Date,
  timezone: string,
  count: number,
): string[] {
  const currentStart = weekStartYmd(now, timezone);
  const starts: string[] = [];
  let cursor = shiftYmd(currentStart, -7);
  for (let i = 0; i < count; i++) {
    starts.push(cursor);
    cursor = shiftYmd(cursor, -7);
  }
  return starts;
}

/** True when `ymd` is within inclusive [weekStart, weekEnd]. */
export function ymdInWeek(
  ymd: string,
  weekStart: string,
  weekEnd: string,
): boolean {
  return ymd >= weekStart && ymd <= weekEnd;
}
