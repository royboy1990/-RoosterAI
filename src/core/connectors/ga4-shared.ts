/**
 * GA4 types + pure helpers — no @google-analytics/* imports.
 * Safe for client components that only need property picker types.
 */

export type Ga4PropertyInfo = {
  id: string;
  name: string;
  accountName: string;
  accountId: string;
};

export function normalizeGa4PropertyId(raw: string): string {
  return raw.trim().replace(/^properties\//, "");
}

/** Parse comma/whitespace-separated IDs from GA4_PROPERTY_ID. */
export function parseGa4PropertyIdsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Array<{ id: string; name: string }> {
  const raw = env.GA4_PROPERTY_ID?.trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(/[,:\s]+/)
    .map((part) => normalizeGa4PropertyId(part))
    .filter(Boolean)
    .map((id) => ({ id, name: "" }));
}
