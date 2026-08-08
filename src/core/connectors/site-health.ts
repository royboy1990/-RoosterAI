import { z } from "zod";
import type { Connector, ConnectorResult, RunContext } from "../types";
import {
  SITE_HEALTH_MAX_SITES,
  type SiteHealthSite,
} from "./site-health-shared";

export {
  formatSiteHealthSitesText,
  normalizeSiteOrigin,
  parseSiteHealthSitesText,
  SITE_HEALTH_MAX_SITES,
  type SiteHealthSite,
} from "./site-health-shared";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_SITEMAP_BYTES = 512_000;
const MAX_SITEMAPS_PER_SITE = 3;

const siteSchema = z.object({
  url: z.string().min(1),
  name: z.string().optional(),
});

const siteHealthConfigSchema = z.object({
  sites: z.array(siteSchema).max(SITE_HEALTH_MAX_SITES).default([]),
});

type SiteHealthConfig = z.infer<typeof siteHealthConfigSchema>;

function siteLabel(site: SiteHealthSite): string {
  const name = site.name?.trim();
  return name ? `${name} (${site.url})` : site.url;
}

function extractSitemapUrls(robotsBody: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const line of robotsBody.split(/\r?\n/)) {
    const match = /^\s*Sitemap:\s*(\S+)/i.exec(line);
    if (!match?.[1]) {
      continue;
    }
    const url = match[1].trim();
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

function hasGlobalDisallow(robotsBody: string): boolean {
  let inStarAgent = false;
  for (const rawLine of robotsBody.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const agent = /^User-agent:\s*(.+)$/i.exec(line);
    if (agent) {
      inStarAgent = agent[1]!.trim() === "*";
      continue;
    }
    if (inStarAgent && /^Disallow:\s*\/\s*$/i.test(line)) {
      return true;
    }
  }
  return false;
}

function countXmlTags(body: string, tag: string): number {
  const re = new RegExp(`<${tag}\\b`, "gi");
  return (body.match(re) ?? []).length;
}

async function fetchText(
  url: string,
  signal: AbortSignal,
  options?: { maxBytes?: number },
): Promise<{ status: number; body: string; truncated: boolean }> {
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const combined = AbortSignal.any([signal, timeout]);
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: combined,
    headers: { "User-Agent": "RoosterAI-site-health/0.1" },
  });

  const maxBytes = options?.maxBytes;
  if (maxBytes === undefined) {
    const body = await res.text();
    return { status: res.status, body, truncated: false };
  }

  if (!res.body) {
    const body = await res.text();
    return {
      status: res.status,
      body: body.slice(0, maxBytes),
      truncated: body.length > maxBytes,
    };
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    if (total + value.length > maxBytes) {
      chunks.push(value.slice(0, maxBytes - total));
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
    total += value.length;
  }

  const merged = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return {
    status: res.status,
    body: merged.toString("utf8"),
    truncated,
  };
}

async function checkSitemap(
  sitemapUrl: string,
  signal: AbortSignal,
): Promise<string> {
  try {
    const { status, body, truncated } = await fetchText(sitemapUrl, signal, {
      maxBytes: MAX_SITEMAP_BYTES,
    });
    if (status !== 200) {
      return `  Sitemap ${sitemapUrl}: HTTP ${status}`;
    }

    const isIndex = /<sitemapindex\b/i.test(body);
    const isUrlset = /<urlset\b/i.test(body);
    if (isIndex) {
      const n = countXmlTags(body, "sitemap");
      return `  Sitemap index ${sitemapUrl}: ~${n} child sitemaps${truncated ? " (truncated)" : ""}`;
    }
    if (isUrlset) {
      const n = countXmlTags(body, "url");
      return `  Sitemap ${sitemapUrl}: ~${n} URLs${truncated ? " (truncated)" : ""}`;
    }
    return `  Sitemap ${sitemapUrl}: OK (unrecognized XML shape)${truncated ? " (truncated)" : ""}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `  Sitemap ${sitemapUrl}: failed (${message})`;
  }
}

async function checkSite(
  site: SiteHealthSite,
  signal: AbortSignal,
): Promise<string[]> {
  const lines: string[] = [`### ${siteLabel(site)}`];
  const robotsUrl = `${site.url}/robots.txt`;

  try {
    const { status, body } = await fetchText(robotsUrl, signal);
    if (status === 404) {
      lines.push(`robots.txt: missing (HTTP 404)`);
      return lines;
    }
    if (status !== 200) {
      lines.push(`robots.txt: HTTP ${status}`);
      return lines;
    }
    if (!body.trim()) {
      lines.push(`robots.txt: empty`);
      return lines;
    }

    lines.push(`robots.txt: OK (${body.split(/\r?\n/).length} lines)`);
    if (hasGlobalDisallow(body)) {
      lines.push(`⚠ User-agent: * has Disallow: /`);
    }

    const sitemapUrls = extractSitemapUrls(body).slice(0, MAX_SITEMAPS_PER_SITE);
    if (sitemapUrls.length === 0) {
      lines.push("Sitemaps: none listed in robots.txt");
      return lines;
    }

    lines.push(
      `Sitemaps listed: ${sitemapUrls.length}${extractSitemapUrls(body).length > MAX_SITEMAPS_PER_SITE ? ` (checking first ${MAX_SITEMAPS_PER_SITE})` : ""}`,
    );
    for (const sitemapUrl of sitemapUrls) {
      if (signal.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      lines.push(await checkSitemap(sitemapUrl, signal));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    lines.push(`Failed: ${message}`);
  }

  return lines;
}

/**
 * Site health connector — robots.txt + sitemap reachability.
 * No auth. Configure origins in Settings when installed from /coop.
 */
export const siteHealthConnector: Connector<SiteHealthConfig> = {
  id: "site-health",
  label: "Site health",
  description:
    "robots.txt and sitemap checks for the origins you list — no API key.",
  tags: ["seo"],
  setupDocs: ".env.example",
  requiredEnv: [],
  configSchema: siteHealthConfigSchema,
  async fetch(config: SiteHealthConfig, ctx: RunContext): Promise<ConnectorResult> {
    if (config.sites.length === 0) {
      return {
        heading: "Site health",
        lines: [
          "No sites configured. Add origins in Settings (one per line).",
        ],
      };
    }

    const lines: string[] = [];
    let okCount = 0;

    for (const site of config.sites) {
      if (ctx.signal.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      const section = await checkSite(site, ctx.signal);
      if (lines.length > 0) {
        lines.push("");
      }
      lines.push(...section);
      if (!section.some((line) => line.startsWith("Failed:"))) {
        okCount += 1;
      }
    }

    ctx.log(`site-health: ${okCount}/${config.sites.length} sites checked`);
    return { heading: "Site health", lines };
  },
};
