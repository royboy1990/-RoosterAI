/**
 * Site-health types + pure helpers — no fetch / Node imports.
 * Safe for client components that edit the origins list.
 */

export const SITE_HEALTH_MAX_SITES = 20;

export type SiteHealthSite = {
  url: string;
  name?: string;
};

/** Normalize to an absolute origin (scheme + host, no path/query). */
export function normalizeSiteOrigin(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

/** Parse textarea lines → sites (deduped, capped). Optional `Name | url` per line. */
export function parseSiteHealthSitesText(text: string): SiteHealthSite[] {
  const seen = new Set<string>();
  const sites: SiteHealthSite[] = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    let name: string | undefined;
    let urlPart = trimmed;
    const pipe = trimmed.indexOf("|");
    if (pipe >= 0) {
      name = trimmed.slice(0, pipe).trim() || undefined;
      urlPart = trimmed.slice(pipe + 1).trim();
    }

    const origin = normalizeSiteOrigin(urlPart);
    if (!origin || seen.has(origin)) {
      continue;
    }
    seen.add(origin);
    sites.push(name ? { url: origin, name } : { url: origin });
    if (sites.length >= SITE_HEALTH_MAX_SITES) {
      break;
    }
  }

  return sites;
}

export function formatSiteHealthSitesText(sites: SiteHealthSite[]): string {
  return sites
    .map((site) => {
      const name = site.name?.trim();
      return name ? `${name} | ${site.url}` : site.url;
    })
    .join("\n");
}
