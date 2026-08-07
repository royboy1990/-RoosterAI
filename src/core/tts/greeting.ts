/**
 * Daypart greeting from config timezone + run `now` (not the browser clock).
 * Buckets: morning 5–11, afternoon 12–16, evening 17–4.
 */

function localHour(now: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = parts.find((part) => part.type === "hour")?.value;
  const parsed = hour === undefined ? Number.NaN : Number.parseInt(hour, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** YYYY-MM-DD in the operator timezone — stable pick key for the day. */
export function localYmd(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function daypartGreeting(
  now: Date,
  timezone: string,
  operatorName: string,
): string {
  const hour = localHour(now, timezone);
  let daypart: string;
  if (hour >= 5 && hour <= 11) {
    daypart = "Good morning";
  } else if (hour >= 12 && hour <= 16) {
    daypart = "Good afternoon";
  } else {
    daypart = "Good evening";
  }

  const name = operatorName.trim();
  if (name.length > 0) {
    return `${daypart}, ${name}.`;
  }
  return `${daypart}.`;
}
