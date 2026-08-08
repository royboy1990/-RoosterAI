import { existsSync } from "node:fs";
import { z } from "zod";
import type { Connector, ConnectorResult, RunContext } from "../types";
import { resolveGa4CredentialsPath } from "./ga4";
import {
  normalizeGscSiteUrl,
  parseGscSiteUrlsFromEnv,
  type GscSiteInfo,
} from "./gsc-shared";

export type { GscSiteInfo } from "./gsc-shared";
export { normalizeGscSiteUrl, parseGscSiteUrlsFromEnv } from "./gsc-shared";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const GSC_BASE = "https://www.googleapis.com/webmasters/v3";
/** GSC search data typically lags ~2–3 days; end the window before "today". */
const GSC_DATA_LAG_DAYS = 3;
const TOP_LIMIT_DEFAULT = 5;

const gscSiteSchema = z.object({
  siteUrl: z.string().min(1),
  name: z.string().default(""),
});

const gscConfigSchema = z.object({
  topLimit: z.number().int().positive().max(20).default(TOP_LIMIT_DEFAULT),
  /** Selected Search Console sites. Empty → fall back to GSC_SITE_URL env. */
  sites: z.array(gscSiteSchema).default([]),
});

type GscConfig = z.infer<typeof gscConfigSchema>;

type SearchAnalyticsRow = {
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
  keys?: string[];
};

type SearchAnalyticsResponse = {
  rows?: SearchAnalyticsRow[];
  error?: { message?: string; status?: string };
};

type SitesListResponse = {
  siteEntry?: Array<{
    siteUrl?: string;
    permissionLevel?: string;
  }>;
  error?: { message?: string };
};

type SitemapsListResponse = {
  sitemap?: Array<{
    path?: string;
    errors?: string;
    warnings?: string;
    isPending?: boolean;
  }>;
  error?: { message?: string };
};

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
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatPosition(value: number): string {
  return value.toFixed(1);
}

function deltaLabel(current: number, previous: number): string {
  if (previous === 0) {
    return current === 0 ? "→ flat" : "↑ new";
  }
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.05) {
    return "→ 0% vs prior 7d";
  }
  const arrow = pct > 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(pct).toFixed(0)}% vs prior 7d`;
}

function positionDeltaLabel(current: number, previous: number): string {
  if (previous === 0) {
    return current === 0 ? "→ flat" : "↑ new";
  }
  const diff = current - previous;
  if (Math.abs(diff) < 0.05) {
    return "→ flat vs prior 7d";
  }
  // Lower position is better in Search Console.
  const arrow = diff < 0 ? "↑" : "↓";
  const signed = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
  return `${arrow} ${signed} vs prior 7d`;
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

function resolveSelectedSites(
  config: GscConfig,
  env: NodeJS.ProcessEnv,
): Array<{ siteUrl: string; name: string }> {
  if (config.sites.length > 0) {
    return config.sites.map((site) => ({
      siteUrl: normalizeGscSiteUrl(site.siteUrl),
      name: site.name.trim(),
    }));
  }
  return parseGscSiteUrlsFromEnv(env);
}

type GscAuthedClient = {
  request: <T>(opts: {
    url: string;
    method?: string;
    data?: unknown;
    signal?: AbortSignal;
  }) => Promise<{ data: T }>;
};

async function createGscClient(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): Promise<GscAuthedClient> {
  const credentialsPath = resolveGa4CredentialsPath(env, cwd);
  if (!existsSync(credentialsPath)) {
    throw new Error(
      `GOOGLE_APPLICATION_CREDENTIALS file not found: ${credentialsPath}`,
    );
  }

  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({
    keyFilename: credentialsPath,
    scopes: [GSC_SCOPE],
  });
  const client = await auth.getClient();
  return client as GscAuthedClient;
}

function encodeSiteUrl(siteUrl: string): string {
  return encodeURIComponent(siteUrl);
}

async function gscGet<T>(
  client: GscAuthedClient,
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const res = await client.request<T>({
    url: `${GSC_BASE}${path}`,
    method: "GET",
    signal,
  });
  return res.data;
}

async function gscPost<T>(
  client: GscAuthedClient,
  path: string,
  data: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const res = await client.request<T>({
    url: `${GSC_BASE}${path}`,
    method: "POST",
    data,
    signal,
  });
  return res.data;
}

/**
 * List every Search Console site the service account can see (sites.list).
 */
export async function listAccessibleGscSites(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): Promise<GscSiteInfo[]> {
  const client = await createGscClient(env, cwd);
  const data = await gscGet<SitesListResponse>(client, "/sites");
  if (data.error?.message) {
    throw new Error(data.error.message);
  }

  const sites: GscSiteInfo[] = [];
  for (const entry of data.siteEntry ?? []) {
    const siteUrl = normalizeGscSiteUrl(entry.siteUrl ?? "");
    if (!siteUrl) {
      continue;
    }
    sites.push({
      siteUrl,
      permissionLevel: entry.permissionLevel?.trim() || "unknown",
    });
  }

  sites.sort((a, b) => a.siteUrl.localeCompare(b.siteUrl));
  return sites;
}

async function queryTotals(
  client: GscAuthedClient,
  siteUrl: string,
  startDate: string,
  endDate: string,
  signal: AbortSignal,
): Promise<{
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}> {
  const data = await gscPost<SearchAnalyticsResponse>(
    client,
    `/sites/${encodeSiteUrl(siteUrl)}/searchAnalytics/query`,
    { startDate, endDate },
    signal,
  );
  const row = data.rows?.[0];
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: row?.ctr ?? 0,
    position: row?.position ?? 0,
  };
}

async function queryDimension(
  client: GscAuthedClient,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimension: "page" | "query",
  rowLimit: number,
  signal: AbortSignal,
): Promise<SearchAnalyticsRow[]> {
  const data = await gscPost<SearchAnalyticsResponse>(
    client,
    `/sites/${encodeSiteUrl(siteUrl)}/searchAnalytics/query`,
    {
      startDate,
      endDate,
      dimensions: [dimension],
      rowLimit,
      startRow: 0,
    },
    signal,
  );
  return data.rows ?? [];
}

async function listSitemapsSummary(
  client: GscAuthedClient,
  siteUrl: string,
  signal: AbortSignal,
): Promise<string[]> {
  try {
    const data = await gscGet<SitemapsListResponse>(
      client,
      `/sites/${encodeSiteUrl(siteUrl)}/sitemaps`,
      signal,
    );
    const sitemaps = data.sitemap ?? [];
    if (sitemaps.length === 0) {
      return ["GSC sitemaps: none submitted"];
    }

    const lines: string[] = [`GSC sitemaps: ${sitemaps.length} submitted`];
    for (const sitemap of sitemaps.slice(0, 5)) {
      const path = sitemap.path || "(unknown)";
      const errors = Number.parseInt(sitemap.errors ?? "0", 10) || 0;
      const warnings = Number.parseInt(sitemap.warnings ?? "0", 10) || 0;
      const pending = sitemap.isPending ? ", pending" : "";
      lines.push(
        `  ${path} (errors: ${errors}, warnings: ${warnings}${pending})`,
      );
    }
    return lines;
  } catch {
    // Optional / cheap — skip quietly if the property rejects sitemaps.list.
    return [];
  }
}

async function fetchSiteReport(
  client: GscAuthedClient,
  site: { siteUrl: string; name: string },
  currentStart: string,
  currentEnd: string,
  priorStart: string,
  priorEnd: string,
  topLimit: number,
  signal: AbortSignal,
): Promise<string[]> {
  const label = site.name
    ? `${site.name} (${site.siteUrl})`
    : site.siteUrl;

  const [current, prior, pages, queries, sitemapLines] = await Promise.all([
    queryTotals(client, site.siteUrl, currentStart, currentEnd, signal),
    queryTotals(client, site.siteUrl, priorStart, priorEnd, signal),
    queryDimension(
      client,
      site.siteUrl,
      currentStart,
      currentEnd,
      "page",
      topLimit,
      signal,
    ),
    queryDimension(
      client,
      site.siteUrl,
      currentStart,
      currentEnd,
      "query",
      topLimit,
      signal,
    ),
    listSitemapsSummary(client, site.siteUrl, signal),
  ]);

  const lines: string[] = [
    `### ${label} · ${currentStart} → ${currentEnd}`,
  ];

  if (
    current.clicks === 0 &&
    current.impressions === 0 &&
    pages.length === 0 &&
    queries.length === 0
  ) {
    lines.push("No Search Console data in this window.");
    if (sitemapLines.length > 0) {
      lines.push(...sitemapLines);
    }
    return lines;
  }

  lines.push(
    `Clicks: ${formatNumber(current.clicks)} (${deltaLabel(current.clicks, prior.clicks)})`,
    `Impressions: ${formatNumber(current.impressions)} (${deltaLabel(current.impressions, prior.impressions)})`,
    `CTR: ${formatPct(current.ctr)} (${deltaLabel(current.ctr, prior.ctr)})`,
    `Avg position: ${formatPosition(current.position)} (${positionDeltaLabel(current.position, prior.position)})`,
  );

  if (pages.length === 0) {
    lines.push("Top pages: none");
  } else {
    lines.push("Top pages by clicks:");
    for (const row of pages) {
      const page = row.keys?.[0] || "/";
      lines.push(`  ${page} (${formatNumber(row.clicks ?? 0)} clicks)`);
    }
  }

  if (queries.length === 0) {
    lines.push("Top queries: none");
  } else {
    lines.push("Top queries by clicks:");
    for (const row of queries) {
      const query = row.keys?.[0] || "(empty)";
      lines.push(`  ${query} (${formatNumber(row.clicks ?? 0)} clicks)`);
    }
  }

  if (sitemapLines.length > 0) {
    lines.push(...sitemapLines);
  }

  return lines;
}

/**
 * Google Search Console connector (Tier 3).
 * Env: GOOGLE_APPLICATION_CREDENTIALS (required; same key file as GA4).
 * Selected sites live in connector config; GSC_SITE_URL is an optional fallback.
 */
export const gscConnector: Connector<GscConfig> = {
  id: "gsc",
  label: "Search Console",
  description:
    "Last 7 days of clicks, impressions, CTR, and top pages/queries vs the prior week.",
  tags: ["seo", "analytics"],
  setupDocs: ".env.example",
  requiredEnv: ["GOOGLE_APPLICATION_CREDENTIALS"],
  optionalEnv: ["GSC_SITE_URL"],
  configSchema: gscConfigSchema,
  async fetch(config: GscConfig, ctx: RunContext): Promise<ConnectorResult> {
    const selected = resolveSelectedSites(config, process.env);
    if (selected.length === 0) {
      throw new Error(
        "No Search Console sites selected. Pick sites in Setup/Settings, or set GSC_SITE_URL.",
      );
    }

    const today = ymdInTimezone(ctx.now, ctx.timezone);
    const currentEnd = shiftYmd(today, -GSC_DATA_LAG_DAYS);
    const currentStart = shiftYmd(currentEnd, -6);
    const priorEnd = shiftYmd(currentStart, -1);
    const priorStart = shiftYmd(priorEnd, -6);

    const client = await createGscClient(process.env);

    const settled = await withAbort(
      ctx.signal,
      Promise.allSettled(
        selected.map((site) =>
          fetchSiteReport(
            client,
            site,
            currentStart,
            currentEnd,
            priorStart,
            priorEnd,
            config.topLimit,
            ctx.signal,
          ),
        ),
      ),
    );

    const lines: string[] = [];
    let okCount = 0;

    for (let index = 0; index < settled.length; index++) {
      const item = settled[index]!;
      const site = selected[index]!;
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
      const label = site.name
        ? `${site.name} (${site.siteUrl})`
        : site.siteUrl;
      lines.push(`### ${label}`, `Failed: ${message}`);
    }

    ctx.log(`gsc: ${okCount}/${selected.length} sites reported`);
    return { heading: "Search Console", lines };
  },
};
