import { z } from "zod";
import type { Connector, ConnectorResult, RunContext } from "../types";

const imapConfigSchema = z.object({
  /** IMAP mailbox path. Defaults to INBOX. */
  mailbox: z.string().min(1).default("INBOX"),
  /** Cap how many unread envelopes we surface in the brief. */
  maxMessages: z.number().int().positive().max(50).default(15),
  /**
   * Only include unread mail received within this many hours.
   * Server search uses IMAP SINCE (day granularity); we also filter by
   * envelope date so older same-day mail does not slip through.
   */
  lookbackHours: z.number().int().positive().max(168).default(48),
});

type ImapConfig = z.infer<typeof imapConfigSchema>;

function formatAddress(
  list: Array<{ name?: string | null; address?: string | null }> | undefined,
): string {
  if (!list || list.length === 0) {
    return "(unknown)";
  }
  const first = list[0]!;
  if (first.name && first.address) {
    return `${first.name} <${first.address}>`;
  }
  return first.address ?? first.name ?? "(unknown)";
}

function lookbackLabel(hours: number): string {
  if (hours === 24) {
    return "last 24h";
  }
  if (hours === 48) {
    return "last 48h";
  }
  if (hours % 24 === 0) {
    return `last ${hours / 24}d`;
  }
  return `last ${hours}h`;
}

/**
 * Generic IMAP connector (Tier 1). Works with Gmail app passwords and most hosts.
 * Env: IMAP_HOST, IMAP_USER, IMAP_PASS; optional IMAP_PORT (default 993).
 */
export const imapConnector: Connector<ImapConfig> = {
  id: "imap",
  label: "IMAP Mailbox",
  description:
    "Recent unread mail from any IMAP host (Gmail app passwords work).",
  tags: ["mail"],
  setupDocs: ".env.example",
  optionalEnv: ["IMAP_PORT"],
  requiredEnv: ["IMAP_HOST", "IMAP_USER", "IMAP_PASS"],
  configSchema: imapConfigSchema,
  async fetch(config: ImapConfig, ctx: RunContext): Promise<ConnectorResult> {
    const host = process.env.IMAP_HOST!.trim();
    const user = process.env.IMAP_USER!.trim();
    const pass = process.env.IMAP_PASS!;
    const portRaw = process.env.IMAP_PORT?.trim();
    const port = portRaw ? Number.parseInt(portRaw, 10) : 993;
    if (!Number.isFinite(port) || port <= 0) {
      throw new Error(`Invalid IMAP_PORT: ${portRaw}`);
    }

    const cutoff = new Date(
      ctx.now.getTime() - config.lookbackHours * 60 * 60 * 1000,
    );
    const window = lookbackLabel(config.lookbackHours);

    const { ImapFlow } = await import("imapflow");
    const client = new ImapFlow({
      host,
      port,
      secure: port === 993,
      auth: { user, pass },
      logger: false,
      emitLogs: false,
    });

    const onAbort = (): void => {
      try {
        client.close();
      } catch {
        // Connection may already be gone.
      }
    };
    if (ctx.signal.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    ctx.signal.addEventListener("abort", onAbort, { once: true });

    try {
      await client.connect();
      ctx.log(
        `imap: connected to ${host}:${port} as ${user}; unread since ${cutoff.toISOString()} (${window})`,
      );

      const lock = await client.getMailboxLock(config.mailbox);
      try {
        const messages: Array<{ from: string; subject: string; date: string }> =
          [];
        /** Hard cap so a huge unread pile in-window cannot explode memory. */
        const fetchCap = Math.max(config.maxMessages * 10, 100);

        // IMAP SINCE is day-granular (INTERNALDATE); client filter enforces hours.
        for await (const msg of client.fetch(
          { seen: false, since: cutoff },
          { envelope: true, uid: true },
        )) {
          if (ctx.signal.aborted) {
            throw new DOMException("The operation was aborted.", "AbortError");
          }
          const envelope = msg.envelope;
          const received = envelope?.date;
          if (received && received.getTime() < cutoff.getTime()) {
            continue;
          }
          messages.push({
            from: formatAddress(envelope?.from),
            subject: envelope?.subject?.trim() || "(no subject)",
            date: received ? received.toISOString() : "unknown date",
          });
          if (messages.length >= fetchCap) {
            break;
          }
        }

        // Newest first when dates are available, then cap what the brief sees.
        messages.sort((a, b) => b.date.localeCompare(a.date));
        const truncated = messages.length > config.maxMessages;
        const shown = truncated
          ? messages.slice(0, config.maxMessages)
          : messages;

        if (shown.length === 0) {
          return {
            heading: "IMAP Mailbox",
            lines: [`Unread mail in ${config.mailbox} (${window}): 0`],
          };
        }

        const lines: string[] = [
          `Unread mail in ${config.mailbox} (${window}): ${shown.length}${
            truncated ? ` (showing newest ${config.maxMessages})` : ""
          }`,
        ];

        for (const msg of shown) {
          lines.push(`From ${msg.from} — ${msg.subject}`);
        }

        return { heading: "IMAP Mailbox", lines };
      } finally {
        lock.release();
      }
    } finally {
      ctx.signal.removeEventListener("abort", onAbort);
      try {
        await client.logout();
      } catch {
        try {
          client.close();
        } catch {
          // Already disconnected.
        }
      }
    }
  },
};
