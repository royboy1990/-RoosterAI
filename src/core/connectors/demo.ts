import { z } from "zod";
import type { Connector, ConnectorResult, RunContext } from "../types";

const demoConfigSchema = z.object({}).passthrough();

type DemoConfig = z.infer<typeof demoConfigSchema>;

/**
 * Canned morning data — no network, no keys.
 * Also the reference implementation contributors copy when adding a connector.
 */
export const demoConnector: Connector<DemoConfig> = {
  id: "demo",
  label: "Demo Farm",
  requiredEnv: [],
  configSchema: demoConfigSchema,
  async fetch(_config: DemoConfig, _ctx: RunContext): Promise<ConnectorResult> {
    return {
      heading: "Demo Farm",
      lines: [
        "Sessions yesterday: 1,284 (↑ 12% vs prior day)",
        "Top landing page: /pricing (318 sessions)",
        "Bounce rate: 41%",
        "Unread mail: 3",
        "From alex@client.co — Re: Q3 proposal — needs reply",
        "From billing@host — Invoice #4412 due Friday",
        "From noreply@saas — Your weekly digest (noise)",
        "Open tasks: 2 overdue (Ship connector docs, Renew domain)",
      ],
    };
  },
};
