import type { DeliveryChannel, DeliveryPayload, RunContext } from "../types";

/**
 * Write-only delivery: the brief already lands in data/briefs via the store.
 * Selected by rooster.config.demo.json so --demo needs no Telegram keys.
 */
export const fileDelivery: DeliveryChannel = {
  id: "file",
  label: "File (data/briefs)",
  description: "Persist only — briefs already land in data/briefs via the store.",
  tags: ["delivery"],
  setupDocs: "README.md",
  requiredEnv: [],
  async deliver(payload: DeliveryPayload, ctx: RunContext): Promise<void> {
    ctx.log(
      `file delivery: brief ${payload.brief.id} (${payload.text.length} chars) persisted via store`,
    );
  },
};
