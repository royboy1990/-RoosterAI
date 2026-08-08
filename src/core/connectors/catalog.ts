/**
 * Lightweight connector catalog — picker / default-detection metadata only.
 * Safe to import from shared paths (e.g. config defaults) without pulling
 * Node SDKs (GA4 gRPC, imapflow) into the client bundle.
 */
export interface ConnectorCatalogEntry {
  id: string;
  label: string;
  description: string;
  tags: readonly string[];
  setupDocs: string;
  requiredEnv: readonly string[];
  optionalEnv?: readonly string[];
}

export const connectorCatalog: readonly ConnectorCatalogEntry[] = [
  {
    id: "github",
    label: "GitHub",
    description:
      "Unread notifications, issues/PRs assigned to you, and review requests.",
    tags: ["dev"],
    setupDocs: ".env.example",
    requiredEnv: ["GITHUB_TOKEN"],
  },
  {
    id: "calendar",
    label: "Calendar",
    description:
      "Today's events from a secret ICS URL (Google, Apple, Outlook). No API key.",
    tags: ["calendar"],
    setupDocs: ".env.example",
    requiredEnv: ["CALENDAR_ICS_URL"],
  },
  {
    id: "demo",
    label: "Demo Farm",
    description:
      "Canned morning data — no network, no keys. Good for a first crow.",
    tags: ["dev"],
    setupDocs: "docs/CUSTOM-CONNECTORS.md",
    requiredEnv: [],
  },
  {
    id: "imap",
    label: "IMAP Mailbox",
    description:
      "Recent unread mail from any IMAP host (Gmail app passwords work).",
    tags: ["mail"],
    setupDocs: ".env.example",
    optionalEnv: ["IMAP_PORT"],
    requiredEnv: ["IMAP_HOST", "IMAP_USER", "IMAP_PASS"],
  },
  {
    id: "ga4",
    label: "Google Analytics",
    description:
      "Yesterday's sessions, bounce rate, and top pages for the GA4 properties you select.",
    tags: ["analytics"],
    setupDocs: ".env.example",
    requiredEnv: ["GOOGLE_APPLICATION_CREDENTIALS"],
    optionalEnv: ["GA4_PROPERTY_ID"],
  },
  {
    id: "gsc",
    label: "Search Console",
    description:
      "Last 7 days of clicks, impressions, CTR, and top pages/queries vs the prior week.",
    tags: ["seo", "analytics"],
    setupDocs: ".env.example",
    requiredEnv: ["GOOGLE_APPLICATION_CREDENTIALS"],
    optionalEnv: ["GSC_SITE_URL"],
  },
  {
    id: "site-health",
    label: "Site health",
    description:
      "robots.txt and sitemap checks for the origins you list — no API key.",
    tags: ["seo"],
    setupDocs: ".env.example",
    requiredEnv: [],
  },
  {
    id: "weather",
    label: "Weather",
    description:
      "Current conditions and today's high/low via Open-Meteo. No API key — set the city in Settings.",
    tags: ["weather"],
    setupDocs: "/settings",
    requiredEnv: [],
  },
];
