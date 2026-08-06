import { existsSync } from "node:fs";
import path from "node:path";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { z } from "zod";
import type { Connector, ConnectorResult, RunContext } from "../types";

const ga4ConfigSchema = z.object({
  /** How many top landing pages to include. */
  topPagesLimit: z.number().int().positive().max(20).default(5),
});

type Ga4Config = z.infer<typeof ga4ConfigSchema>;

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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function deltaLabel(current: number, previous: number): string {
  if (previous === 0) {
    return current === 0 ? "→ flat" : "↑ new";
  }
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.05) {
    return "→ 0% vs prior day";
  }
  const arrow = pct > 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(pct).toFixed(0)}% vs prior day`;
}

function readMetric(
  rows: Array<{ metricValues?: Array<{ value?: string | null }> | null }> | null | undefined,
  index: number,
): number {
  const raw = rows?.[0]?.metricValues?.[index]?.value;
  if (raw === undefined || raw === null || raw === "") {
    return 0;
  }
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

async function withAbort<T>(signal: AbortSignal, promise: Promise<T>): Promise<T> {
  if (signal.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

/**
 * Google Analytics 4 connector (Tier 3).
 * Env: GA4_PROPERTY_ID, GOOGLE_APPLICATION_CREDENTIALS (path to service-account JSON).
 */
export const ga4Connector: Connector<Ga4Config> = {
  id: "ga4",
  label: "Google Analytics",
  description:
    "Yesterday's sessions, bounce rate, and top pages via a GA4 service account.",
  tags: ["analytics"],
  setupDocs: ".env.example",
  requiredEnv: ["GA4_PROPERTY_ID", "GOOGLE_APPLICATION_CREDENTIALS"],
  configSchema: ga4ConfigSchema,
  async fetch(config: Ga4Config, ctx: RunContext): Promise<ConnectorResult> {
    const propertyId = process.env.GA4_PROPERTY_ID!.trim().replace(
      /^properties\//,
      "",
    );
    const credentialsRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS!.trim();
    const credentialsPath = path.isAbsolute(credentialsRaw)
      ? credentialsRaw
      : path.resolve(/* turbopackIgnore: true */ process.cwd(), credentialsRaw);

    if (!existsSync(credentialsPath)) {
      throw new Error(
        `GOOGLE_APPLICATION_CREDENTIALS file not found: ${credentialsPath}`,
      );
    }

    const today = ymdInTimezone(ctx.now, ctx.timezone);
    const yesterday = shiftYmd(today, -1);
    const dayBefore = shiftYmd(today, -2);

    const client = new BetaAnalyticsDataClient({
      keyFilename: credentialsPath,
    });

    const property = `properties/${propertyId}`;
    const totalsMetrics = [
      { name: "sessions" },
      { name: "activeUsers" },
      { name: "bounceRate" },
      { name: "screenPageViews" },
    ];

    const [[yesterdayRes], [priorRes], [pagesRes]] = await withAbort(
      ctx.signal,
      Promise.all([
        client.runReport({
          property,
          dateRanges: [{ startDate: yesterday, endDate: yesterday }],
          metrics: totalsMetrics,
        }),
        client.runReport({
          property,
          dateRanges: [{ startDate: dayBefore, endDate: dayBefore }],
          metrics: totalsMetrics,
        }),
        client.runReport({
          property,
          dateRanges: [{ startDate: yesterday, endDate: yesterday }],
          dimensions: [{ name: "landingPagePlusQueryString" }],
          metrics: [{ name: "sessions" }],
          orderBys: [
            {
              metric: { metricName: "sessions" },
              desc: true,
            },
          ],
          limit: config.topPagesLimit,
        }),
      ]),
    );

    const ySessions = readMetric(yesterdayRes.rows, 0);
    const yUsers = readMetric(yesterdayRes.rows, 1);
    const yBounce = readMetric(yesterdayRes.rows, 2);
    const yViews = readMetric(yesterdayRes.rows, 3);
    const pSessions = readMetric(priorRes.rows, 0);
    const pUsers = readMetric(priorRes.rows, 1);

    const pageRows = pagesRes.rows ?? [];

    if (ySessions === 0 && yUsers === 0 && pageRows.length === 0) {
      return {
        heading: "Google Analytics",
        lines: [
          `Property ${propertyId} · ${yesterday} (${ctx.timezone})`,
          "No traffic yesterday.",
        ],
      };
    }

    const lines: string[] = [
      `Property ${propertyId} · ${yesterday} (${ctx.timezone})`,
      `Sessions: ${formatNumber(ySessions)} (${deltaLabel(ySessions, pSessions)})`,
      `Active users: ${formatNumber(yUsers)} (${deltaLabel(yUsers, pUsers)})`,
      `Bounce rate: ${formatPct(yBounce)}`,
      `Page views: ${formatNumber(yViews)}`,
    ];

    if (pageRows.length === 0) {
      lines.push("Top landing pages: none");
    } else {
      lines.push("Top landing pages:");
      for (const row of pageRows) {
        const page = row.dimensionValues?.[0]?.value || "/";
        const sessions = Number.parseFloat(row.metricValues?.[0]?.value ?? "0");
        lines.push(
          `  ${page} (${formatNumber(Number.isFinite(sessions) ? sessions : 0)} sessions)`,
        );
      }
    }

    ctx.log(`ga4: property ${propertyId} sessions=${ySessions} users=${yUsers}`);
    return { heading: "Google Analytics", lines };
  },
};
