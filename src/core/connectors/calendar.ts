import ical, {
  type CalendarResponse,
  type DateWithTimeZone,
  type EventInstance,
  type ParameterValue,
  type VEvent,
} from "node-ical";
import { z } from "zod";
import type { Connector, ConnectorResult, RunContext } from "../types";

const calendarConfigSchema = z.object({
  /** Cap how many events we surface for the day. */
  maxEvents: z.number().int().positive().max(50).default(20),
});

type CalendarConfig = z.infer<typeof calendarConfigSchema>;

/** Calendar date YYYY-MM-DD in the given IANA timezone. */
function ymdInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Shift a YYYY-MM-DD string by `deltaDays` using UTC noon as an anchor. */
function shiftYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const anchor = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() + deltaDays);
  return anchor.toISOString().slice(0, 10);
}

/**
 * Offset (ms) such that `utcMs + offset ≈ local wall time as if it were UTC`.
 * Used to convert a local civil time in `timeZone` into a real UTC Date.
 */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((p) => p.type === type)?.value;
    return value ? Number.parseInt(value, 10) : 0;
  };

  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - date.getTime();
}

/** Local midnight (00:00:00) on `ymd` in `timeZone`, as a UTC Date. */
function zonedMidnight(ymd: string, timeZone: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const provisional = Date.UTC(y!, m! - 1, d!, 0, 0, 0);
  const offset = timeZoneOffsetMs(new Date(provisional), timeZone);
  let utc = provisional - offset;
  // Second pass covers DST transition edges.
  const offset2 = timeZoneOffsetMs(new Date(utc), timeZone);
  utc = provisional - offset2;
  return new Date(utc);
}

function textOf(value: ParameterValue | undefined): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  return String(value.val ?? "").trim();
}

function isCancelled(event: VEvent): boolean {
  return String(event.status ?? "").toUpperCase() === "CANCELLED";
}

/**
 * All-day ICS dates are floating calendar days (VALUE=DATE).
 * node-ical builds them as host-local midnight for that Y-M-D, so read
 * getFullYear/Month/Date — not toISOString() — or the day shifts west of UTC.
 */
function allDayYmd(start: DateWithTimeZone): string {
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const d = String(start.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function overlapsLocalDay(
  instance: EventInstance,
  ymd: string,
  dayStart: Date,
  dayEnd: Date,
): boolean {
  if (instance.isFullDay || instance.start.dateOnly) {
    return allDayYmd(instance.start) === ymd;
  }
  const end = instance.end ?? instance.start;
  return instance.start < dayEnd && end > dayStart;
}

function formatEventTime(
  instance: EventInstance,
  timezone: string,
): string {
  if (instance.isFullDay || instance.start.dateOnly) {
    return "all day";
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(instance.start);
}

function collectTodaysEvents(
  data: CalendarResponse,
  ymd: string,
  timezone: string,
  now: Date,
): EventInstance[] {
  const dayStart = zonedMidnight(ymd, timezone);
  const dayEnd = zonedMidnight(shiftYmd(ymd, 1), timezone);
  // Wide window so RRULE expansion + EXDATE/RECURRENCE-ID logic has context;
  // we filter to "today" ourselves for timezone correctness.
  const from = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const seen = new Set<string>();
  const results: EventInstance[] = [];

  for (const value of Object.values(data)) {
    if (!value || typeof value !== "object" || !("type" in value)) {
      continue;
    }
    if (value.type !== "VEVENT") {
      continue;
    }
    const event = value as VEvent;
    if (isCancelled(event)) {
      continue;
    }

    let instances: EventInstance[];
    try {
      instances = ical.expandRecurringEvent(event, {
        from,
        to,
        expandOngoing: true,
      });
    } catch {
      // Malformed RRULE — skip this series rather than failing the whole feed.
      continue;
    }

    for (const instance of instances) {
      if (!overlapsLocalDay(instance, ymd, dayStart, dayEnd)) {
        continue;
      }
      const key = `${textOf(instance.summary)}|${instance.start.toISOString()}|${instance.isFullDay}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      results.push(instance);
    }
  }

  results.sort((a, b) => {
    if (a.isFullDay !== b.isFullDay) {
      return a.isFullDay ? -1 : 1;
    }
    return a.start.getTime() - b.start.getTime();
  });

  return results;
}

/**
 * Calendar connector (Tier 1). Any calendar that exposes a secret ICS URL.
 * Env: CALENDAR_ICS_URL. Uses node-ical for RRULE expansion, EXDATE, and all-day dates.
 */
export const calendarConnector: Connector<CalendarConfig> = {
  id: "calendar",
  label: "Calendar",
  description:
    "Today's events from a secret ICS URL (Google, Apple, Outlook). No API key.",
  tags: ["calendar"],
  setupDocs: ".env.example",
  requiredEnv: ["CALENDAR_ICS_URL"],
  configSchema: calendarConfigSchema,
  async fetch(config: CalendarConfig, ctx: RunContext): Promise<ConnectorResult> {
    const url = process.env.CALENDAR_ICS_URL!.trim();
    const ymd = ymdInTimezone(ctx.now, ctx.timezone);

    ctx.log(`calendar: fetching ICS for ${ymd} (${ctx.timezone})`);

    const res = await fetch(url, {
      signal: ctx.signal,
      headers: { "User-Agent": "RoosterAI", Accept: "text/calendar, text/plain, */*" },
    });
    if (!res.ok) {
      throw new Error(`Calendar ICS fetch ${res.status}: ${res.statusText}`);
    }
    const body = await res.text();
    if (!body.includes("BEGIN:VCALENDAR") && !body.includes("BEGIN:VEVENT")) {
      throw new Error("CALENDAR_ICS_URL did not return an iCalendar feed.");
    }

    const data = ical.parseICS(body);
    const events = collectTodaysEvents(data, ymd, ctx.timezone, ctx.now);

    if (events.length === 0) {
      return {
        heading: "Calendar",
        lines: [`Nothing on the calendar for ${ymd} (${ctx.timezone}).`],
      };
    }

    const shown = events.slice(0, config.maxEvents);
    const lines: string[] = [
      `Events on ${ymd} (${ctx.timezone}): ${events.length}${
        events.length > config.maxEvents
          ? ` (showing first ${config.maxEvents})`
          : ""
      }`,
    ];

    for (const instance of shown) {
      const title = textOf(instance.summary) || "(no title)";
      const when = formatEventTime(instance, ctx.timezone);
      const location = textOf(instance.event.location);
      lines.push(
        location
          ? `${when} — ${title} @ ${location}`
          : `${when} — ${title}`,
      );
    }

    ctx.log(`calendar: events=${events.length} shown=${shown.length}`);
    return { heading: "Calendar", lines };
  },
};
