import { ImapFlow } from "imapflow";
import { z } from "zod";
import type { Connector, ConnectorResult, RunContext } from "../types";

const imapConfigSchema = z.object({
  /** IMAP mailbox path. Defaults to INBOX. */
  mailbox: z.string().min(1).default("INBOX"),
  /** Cap how many unread envelopes we surface in the brief. */
  maxMessages: z.number().int().positive().max(50).default(15),
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

/**
 * Generic IMAP connector (Tier 1). Works with Gmail app passwords and most hosts.
 * Env: IMAP_HOST, IMAP_USER, IMAP_PASS; optional IMAP_PORT (default 993).
 */
export const imapConnector: Connector<ImapConfig> = {
  id: "imap",
  label: "IMAP Mailbox",
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
      ctx.log(`imap: connected to ${host}:${port} as ${user}`);

      const lock = await client.getMailboxLock(config.mailbox);
      try {
        const messages: Array<{ from: string; subject: string; date: string }> =
          [];

        for await (const msg of client.fetch(
          { seen: false },
          { envelope: true, uid: true },
        )) {
          if (ctx.signal.aborted) {
            throw new DOMException("The operation was aborted.", "AbortError");
          }
          const envelope = msg.envelope;
          messages.push({
            from: formatAddress(envelope?.from),
            subject: envelope?.subject?.trim() || "(no subject)",
            date: envelope?.date
              ? envelope.date.toISOString()
              : "unknown date",
          });
          if (messages.length >= config.maxMessages) {
            break;
          }
        }

        // Newest first when dates are available.
        messages.sort((a, b) => b.date.localeCompare(a.date));

        if (messages.length === 0) {
          return {
            heading: "IMAP Mailbox",
            lines: [`Unread mail in ${config.mailbox}: 0`],
          };
        }

        const lines: string[] = [
          `Unread mail in ${config.mailbox}: ${messages.length}${
            messages.length >= config.maxMessages
              ? ` (showing first ${config.maxMessages})`
              : ""
          }`,
        ];

        for (const msg of messages) {
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
