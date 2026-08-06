import { z } from "zod";
import type { Connector, ConnectorResult, RunContext } from "../types";

const githubConfigSchema = z.object({
  /** Cap how many items we surface per section. */
  maxItems: z.number().int().positive().max(50).default(15),
  includeNotifications: z.boolean().default(true),
  includeAssigned: z.boolean().default(true),
  includeReviewRequests: z.boolean().default(true),
});

type GithubConfig = z.infer<typeof githubConfigSchema>;

interface GhNotification {
  reason?: string;
  subject?: { title?: string; type?: string; url?: string | null };
  repository?: { full_name?: string };
  unread?: boolean;
}

interface GhSearchItem {
  title?: string;
  html_url?: string;
  repository_url?: string;
  pull_request?: { url?: string };
  number?: number;
}

interface GhSearchResponse {
  items?: GhSearchItem[];
  message?: string;
}

function repoFromApiUrl(url: string | undefined): string {
  if (!url) {
    return "unknown";
  }
  // https://api.github.com/repos/owner/repo → owner/repo
  const marker = "/repos/";
  const idx = url.indexOf(marker);
  if (idx < 0) {
    return url;
  }
  return url.slice(idx + marker.length);
}

async function ghGet<T>(
  pathAndQuery: string,
  token: string,
  signal: AbortSignal,
): Promise<T> {
  const res = await fetch(`https://api.github.com${pathAndQuery}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "RoosterAI",
    },
    signal,
  });

  const body = (await res.json()) as T & { message?: string; documentation_url?: string };
  if (!res.ok) {
    const detail = body.message ?? res.statusText;
    throw new Error(`GitHub ${res.status} on ${pathAndQuery}: ${detail}`);
  }
  return body;
}

function formatAssigned(item: GhSearchItem): string {
  const repo = repoFromApiUrl(item.repository_url);
  const kind = item.pull_request ? "PR" : "Issue";
  const num = item.number !== undefined ? `#${item.number}` : "";
  return `${repo} ${kind}${num}: ${item.title?.trim() || "(untitled)"}`;
}

/**
 * GitHub connector (Tier 1). Plain fetch — no SDK.
 * Env: GITHUB_TOKEN (classic PAT with `notifications` + enough repo access for private search).
 * Fine-grained tokens work for assigned/review search but not GET /notifications (classic only).
 */
export const githubConnector: Connector<GithubConfig> = {
  id: "github",
  label: "GitHub",
  description:
    "Unread notifications, issues/PRs assigned to you, and review requests.",
  tags: ["dev"],
  setupDocs: ".env.example",
  requiredEnv: ["GITHUB_TOKEN"],
  configSchema: githubConfigSchema,
  async fetch(config: GithubConfig, ctx: RunContext): Promise<ConnectorResult> {
    const token = process.env.GITHUB_TOKEN!.trim();
    const lines: string[] = [];
    let anySection = false;

    if (config.includeNotifications) {
      anySection = true;
      const notes = await ghGet<GhNotification[]>(
        `/notifications?participating=true&per_page=${config.maxItems}`,
        token,
        ctx.signal,
      );
      const unread = notes.filter((n) => n.unread !== false);
      if (unread.length === 0) {
        lines.push("Unread notifications: 0");
      } else {
        lines.push(
          `Unread notifications: ${unread.length}${
            unread.length >= config.maxItems
              ? ` (showing first ${config.maxItems})`
              : ""
          }`,
        );
        for (const note of unread) {
          const repo = note.repository?.full_name ?? "unknown";
          const type = note.subject?.type ?? "item";
          const title = note.subject?.title?.trim() || "(untitled)";
          const reason = note.reason ? ` [${note.reason}]` : "";
          lines.push(`${repo} ${type}: ${title}${reason}`);
        }
      }
      ctx.log(`github: notifications=${unread.length}`);
    }

    if (config.includeAssigned) {
      anySection = true;
      const q = encodeURIComponent("is:open assignee:@me");
      const search = await ghGet<GhSearchResponse>(
        `/search/issues?q=${q}&per_page=${config.maxItems}&sort=updated`,
        token,
        ctx.signal,
      );
      const items = search.items ?? [];
      if (items.length === 0) {
        lines.push("Assigned issues/PRs: 0");
      } else {
        lines.push(
          `Assigned issues/PRs: ${items.length}${
            items.length >= config.maxItems
              ? ` (showing first ${config.maxItems})`
              : ""
          }`,
        );
        for (const item of items) {
          lines.push(formatAssigned(item));
        }
      }
      ctx.log(`github: assigned=${items.length}`);
    }

    if (config.includeReviewRequests) {
      anySection = true;
      const q = encodeURIComponent("is:open is:pr review-requested:@me");
      const search = await ghGet<GhSearchResponse>(
        `/search/issues?q=${q}&per_page=${config.maxItems}&sort=updated`,
        token,
        ctx.signal,
      );
      const items = search.items ?? [];
      if (items.length === 0) {
        lines.push("Review requests: 0");
      } else {
        lines.push(
          `Review requests: ${items.length}${
            items.length >= config.maxItems
              ? ` (showing first ${config.maxItems})`
              : ""
          }`,
        );
        for (const item of items) {
          lines.push(formatAssigned(item));
        }
      }
      ctx.log(`github: review-requests=${items.length}`);
    }

    if (!anySection) {
      return {
        heading: "GitHub",
        lines: ["All GitHub sections disabled in connector config."],
      };
    }

    return { heading: "GitHub", lines };
  },
};
