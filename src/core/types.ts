import type { z } from "zod";

/** Short label the LLM sees as a section heading, e.g. "Google Analytics". */
export interface ConnectorResult {
  heading: string;
  /** Plain-text lines. No HTML, no markup — sanitize before returning. */
  lines: string[];
}

export interface RunContext {
  /** Fires when the connector times out or the run is cancelled. */
  signal: AbortSignal;
  timezone: string;
  now: Date;
  /** Append a line to data/rooster.log (and usually stdout). */
  log: (message: string) => void;
}

export interface Connector<TConfig = unknown> {
  id: string;
  label: string;
  /** Env var names this connector needs. Missing ones = skipped, not crashed. */
  requiredEnv: readonly string[];
  configSchema: z.ZodType<TConfig>;
  fetch(config: TConfig, ctx: RunContext): Promise<ConnectorResult>;
}

export interface LlmCompleteInput {
  system: string;
  user: string;
  model: string;
}

export interface LlmProvider {
  id: string;
  label: string;
  requiredEnv: readonly string[];
  complete(input: LlmCompleteInput, ctx: RunContext): Promise<string>;
}

export interface DeliveryPayload {
  text: string;
  brief: BriefRecord;
}

export interface DeliveryChannel {
  id: string;
  label: string;
  requiredEnv: readonly string[];
  deliver(payload: DeliveryPayload, ctx: RunContext): Promise<void>;
}

export type CoopStatus = "Optimal" | "Ruffled" | "Feathers Everywhere";

export type ConnectorOutcomeStatus = "ok" | "skipped" | "failed";

export interface ConnectorOutcome {
  connectorId: string;
  label: string;
  status: ConnectorOutcomeStatus;
  result?: ConnectorResult;
  /** Machine-readable reason (missing env, timeout, thrown message). */
  error?: string;
}

export interface BriefRecord {
  /** Filesystem-safe ISO timestamp used as the filename stem. */
  id: string;
  createdAt: string;
  timezone: string;
  /** True when hatched from rooster.config.demo.json / --demo. */
  demo: boolean;
  status: CoopStatus;
  /** Final delivered brief text (LLM output or raw fallback). */
  text: string;
  /** Sanitized digest assembled before the LLM step. */
  digest: string;
  outcomes: ConnectorOutcome[];
  llmProviderId: string;
  deliveryChannelId: string;
  llmFailed?: boolean;
  llmError?: string;
}
