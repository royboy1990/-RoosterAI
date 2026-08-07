import { z } from "zod";
import { SHOWCASE_DEMO_LINES } from "../demo/showcase-brief";
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
  description: "Canned morning data — no network, no keys. Good for a first crow.",
  tags: ["dev"],
  setupDocs: "docs/CUSTOM-CONNECTORS.md",
  requiredEnv: [],
  configSchema: demoConfigSchema,
  async fetch(_config: DemoConfig, _ctx: RunContext): Promise<ConnectorResult> {
    return {
      heading: "Demo Farm",
      lines: [...SHOWCASE_DEMO_LINES],
    };
  },
};
