import { existsSync } from "node:fs";
import path from "node:path";
import type { BetaAnalyticsDataClient } from "@google-analytics/data";
import { z } from "zod";
import type { Connector, ConnectorResult, RunContext } from "../types";
import {
  normalizeGa4PropertyId,
  parseGa4PropertyIdsFromEnv,
  type Ga4PropertyInfo,
} from "./ga4-shared";

export type { Ga4PropertyInfo } from "./ga4-shared";
export { normalizeGa4PropertyId, parseGa4PropertyIdsFromEnv } from "./ga4-shared";

const ga4PropertySchema = z.object({
  id: z.string().min(1),
  name: z.string().default(""),
});

const ga4ConfigSchema = z.object({
  /** How many top landing pages to include per property. */
  topPagesLimit: z.number().int().positive().max(20).default(5),
  /** Selected GA4 properties. Empty → fall back to GA4_PROPERTY_ID env. */
  properties: z.array(ga4PropertySchema).default([]),
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

/** Resolve the service-account JSON path from env. */
export function resolveGa4CredentialsPath(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  const credentialsRaw = env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!credentialsRaw) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set");
  }
  return path.isAbsolute(credentialsRaw)
    ? credentialsRaw
    : path.resolve(/* turbopackIgnore: true */ cwd, credentialsRaw);
}

function resolveSelectedProperties(
  config: Ga4Config,
  env: NodeJS.ProcessEnv,
): Array<{ id: string; name: string }> {
  if (config.properties.length > 0) {
    return config.properties.map((property) => ({
      id: normalizeGa4PropertyId(property.id),
      name: property.name.trim(),
    }));
  }
  return parseGa4PropertyIdsFromEnv(env);
}

/**
 * List every GA4 property the service account can see (Admin API accountSummaries).
 */
export async function listAccessibleGa4Properties(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): Promise<Ga4PropertyInfo[]> {
  const credentialsPath = resolveGa4CredentialsPath(env, cwd);
  if (!existsSync(credentialsPath)) {
    throw new Error(
      `GOOGLE_APPLICATION_CREDENTIALS file not found: ${credentialsPath}`,
    );
  }

  const { AnalyticsAdminServiceClient } = await import("@google-analytics/admin");
  const client = new AnalyticsAdminServiceClient({
    keyFilename: credentialsPath,
  });

  const properties: Ga4PropertyInfo[] = [];
  let pageToken: string | undefined;

  do {
    const [summaries, , response] = await client.listAccountSummaries(
      {
        pageSize: 200,
        pageToken,
      },
      { autoPaginate: false },
    );

    for (const summary of summaries) {
      const accountId = (summary.account ?? "")
        .replace(/^accounts\//, "")
        .trim();
      const accountName = summary.displayName?.trim() || accountId || "Account";

      for (const property of summary.propertySummaries ?? []) {
        const id = normalizeGa4PropertyId(property.property ?? "");
        if (!id) {
          continue;
        }
        properties.push({
          id,
          name: property.displayName?.trim() || id,
          accountName,
          accountId,
        });
      }
    }

    pageToken = response?.nextPageToken || undefined;
  } while (pageToken);

  properties.sort((a, b) => {
    const accountCmp = a.accountName.localeCompare(b.accountName);
    if (accountCmp !== 0) {
      return accountCmp;
    }
    return a.name.localeCompare(b.name);
  });

  return properties;
}

async function fetchPropertyReport(
  client: BetaAnalyticsDataClient,
  property: { id: string; name: string },
  yesterday: string,
  dayBefore: string,
  timezone: string,
  topPagesLimit: number,
): Promise<string[]> {
  const resource = `properties/${property.id}`;
  const label = property.name ? `${property.name} (${property.id})` : property.id;
  const totalsMetrics = [
    { name: "sessions" },
    { name: "activeUsers" },
    { name: "bounceRate" },
    { name: "screenPageViews" },
  ];

  const [[yesterdayRes], [priorRes], [pagesRes]] = await Promise.all([
    client.runReport({
      property: resource,
      dateRanges: [{ startDate: yesterday, endDate: yesterday }],
      metrics: totalsMetrics,
    }),
    client.runReport({
      property: resource,
      dateRanges: [{ startDate: dayBefore, endDate: dayBefore }],
      metrics: totalsMetrics,
    }),
    client.runReport({
      property: resource,
      dateRanges: [{ startDate: yesterday, endDate: yesterday }],
      dimensions: [{ name: "landingPagePlusQueryString" }],
      metrics: [{ name: "sessions" }],
      orderBys: [
        {
          metric: { metricName: "sessions" },
          desc: true,
        },
      ],
      limit: topPagesLimit,
    }),
  ]);

  const ySessions = readMetric(yesterdayRes.rows, 0);
  const yUsers = readMetric(yesterdayRes.rows, 1);
  const yBounce = readMetric(yesterdayRes.rows, 2);
  const yViews = readMetric(yesterdayRes.rows, 3);
  const pSessions = readMetric(priorRes.rows, 0);
  const pUsers = readMetric(priorRes.rows, 1);
  const pageRows = pagesRes.rows ?? [];

  const lines: string[] = [
    `### ${label} · ${yesterday} (${timezone})`,
  ];

  if (ySessions === 0 && yUsers === 0 && pageRows.length === 0) {
    lines.push("No traffic yesterday.");
    return lines;
  }

  lines.push(
    `Sessions: ${formatNumber(ySessions)} (${deltaLabel(ySessions, pSessions)})`,
    `Active users: ${formatNumber(yUsers)} (${deltaLabel(yUsers, pUsers)})`,
    `Bounce rate: ${formatPct(yBounce)}`,
    `Page views: ${formatNumber(yViews)}`,
  );

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

  return lines;
}

/**
 * Google Analytics 4 connector (Tier 3).
 * Env: GOOGLE_APPLICATION_CREDENTIALS (required).
 * Selected properties live in connector config; GA4_PROPERTY_ID is an optional fallback.
 */
export const ga4Connector: Connector<Ga4Config> = {
  id: "ga4",
  label: "Google Analytics",
  description:
    "Yesterday's sessions, bounce rate, and top pages for the GA4 properties you select.",
  tags: ["analytics"],
  setupDocs: ".env.example",
  requiredEnv: ["GOOGLE_APPLICATION_CREDENTIALS"],
  optionalEnv: ["GA4_PROPERTY_ID"],
  configSchema: ga4ConfigSchema,
  async fetch(config: Ga4Config, ctx: RunContext): Promise<ConnectorResult> {
    const selected = resolveSelectedProperties(config, process.env);
    if (selected.length === 0) {
      throw new Error(
        "No GA4 properties selected. Pick sites in Setup/Settings, or set GA4_PROPERTY_ID.",
      );
    }

    const credentialsPath = resolveGa4CredentialsPath(process.env);
    if (!existsSync(credentialsPath)) {
      throw new Error(
        `GOOGLE_APPLICATION_CREDENTIALS file not found: ${credentialsPath}`,
      );
    }

    const today = ymdInTimezone(ctx.now, ctx.timezone);
    const yesterday = shiftYmd(today, -1);
    const dayBefore = shiftYmd(today, -2);

    const { BetaAnalyticsDataClient } = await import("@google-analytics/data");
    const client = new BetaAnalyticsDataClient({
      keyFilename: credentialsPath,
    });

    const settled = await withAbort(
      ctx.signal,
      Promise.allSettled(
        selected.map((property) =>
          fetchPropertyReport(
            client,
            property,
            yesterday,
            dayBefore,
            ctx.timezone,
            config.topPagesLimit,
          ),
        ),
      ),
    );

    const lines: string[] = [];
    let okCount = 0;

    for (let index = 0; index < settled.length; index++) {
      const item = settled[index]!;
      const property = selected[index]!;
      if (item.status === "fulfilled") {
        if (lines.length > 0) {
          lines.push("");
        }
        lines.push(...item.value);
        okCount += 1;
        continue;
      }
      const message =
        item.reason instanceof Error ? item.reason.message : String(item.reason);
      if (lines.length > 0) {
        lines.push("");
      }
      const label = property.name
        ? `${property.name} (${property.id})`
        : property.id;
      lines.push(`### ${label}`, `Failed: ${message}`);
    }

    ctx.log(`ga4: ${okCount}/${selected.length} properties reported`);
    return { heading: "Google Analytics", lines };
  },
};
