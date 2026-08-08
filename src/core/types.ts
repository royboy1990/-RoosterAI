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

/**
 * Declarative picker metadata. UI never hardcodes a connector's name —
 * forks appear in /coop search with their own blurb and setup link.
 */
export interface ProviderMeta {
  /** One line, shown in the picker. */
  description: string;
  /** Search + grouping: "mail", "analytics", "calendar", "dev", etc. */
  tags: readonly string[];
  /** Path/URL rendered as "how to get these keys". */
  setupDocs: string;
  /** Unlocks extras; never blocks the run. */
  optionalEnv?: readonly string[];
}

export interface Connector<TConfig = unknown> extends ProviderMeta {
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

export interface LlmProvider extends ProviderMeta {
  id: string;
  label: string;
  /** Model id applied when this provider is auto-selected or first chosen. */
  defaultModel: string;
  requiredEnv: readonly string[];
  complete(input: LlmCompleteInput, ctx: RunContext): Promise<string>;
}

export interface DeliveryPayload {
  text: string;
  brief: BriefRecord;
}

export interface DeliveryChannel extends ProviderMeta {
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

/** How this wake chose to summarize relative to a prior brief. */
export type WakeMode = "full" | "diff" | "unchanged";

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
  /** Auto-picked from digest vs latest usable prior brief. */
  wakeMode?: WakeMode;
  /** Prior brief used for diff / unchanged; omitted on full. */
  baselineBriefId?: string;
  /** Relative to repo root, e.g. data/audio/<id>.mp3 — dashboard only. */
  audioRelativePath?: string;
  /** Voice used when audio was synthesized. */
  ttsVoice?: string;
  /** Fail-soft TTS error from each-wake (wake still succeeds). */
  ttsError?: string;
  /** Set when delivery fails after the brief was already persisted. */
  deliveryError?: string;
}
