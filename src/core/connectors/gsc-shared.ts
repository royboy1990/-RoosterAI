/**
 * GSC types + pure helpers — no google-auth / network imports.
 * Safe for client components that only need site picker types.
 */

export type GscSiteInfo = {
  /** Site URL as Search Console returns it (https://…/ or sc-domain:…). */
  siteUrl: string;
  permissionLevel: string;
};

export function normalizeGscSiteUrl(raw: string): string {
  return raw.trim();
}

/** Parse comma-separated site URLs from GSC_SITE_URL (supports sc-domain: forms). */
export function parseGscSiteUrlsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Array<{ siteUrl: string; name: string }> {
  const raw = env.GSC_SITE_URL?.trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((part) => normalizeGscSiteUrl(part))
    .filter(Boolean)
    .map((siteUrl) => ({ siteUrl, name: "" }));
}
