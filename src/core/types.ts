import type { z } from "zod";
import type { WeatherSnapshot } from "./weather/types";

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
  /**
   * City for weather (from rooster config). Empty = derive from timezone.
   * Connector `locationOverride` still wins when set.
   */
  weatherLocation?: string;
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

/** Token counts from a provider response when the API reports them. */
export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Result of LlmProvider.complete — text plus optional usage for cost estimates. */
export interface LlmCompletion {
  text: string;
  usage?: LlmUsage;
}

export interface LlmProvider extends ProviderMeta {
  id: string;
  label: string;
  /** Model id applied when this provider is auto-selected or first chosen. */
  defaultModel: string;
  requiredEnv: readonly string[];
  complete(input: LlmCompleteInput, ctx: RunContext): Promise<LlmCompletion>;
}

/** Frozen cost snapshot written with the brief (stable if the price table later changes). */
export interface BriefUsage {
  llm?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    estimatedUsd: number | null;
  };
  tts?: {
    model: string;
    inputChars: number;
    estimatedUsd: number | null;
  };
  /** Sum when any leg is priced; null if nothing priced. */
  estimatedUsd: number | null;
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
  /** Weather at wake time (when the weather connector succeeded). Spoken greeting only for the snapshot; written brief uses the connector section. */
  weather?: WeatherSnapshot;
  /** 0–3 follow-up questions grounded in this brief's text + digest. */
  pecks?: string[];
  /** Fail-soft pecks generation error (wake still succeeds). */
  pecksError?: string;
  /** Local $ estimate from public list prices at write time (not a provider invoice). */
  usage?: BriefUsage;
}

/** Structured change or pattern claim grounded in in-week briefs. */
export interface WeeklySignal {
  key: string;
  kind: "change" | "pattern";
  scope?: string;
  summary: string;
  direction?: "improved" | "declined" | "mixed" | "unchanged";
  evidenceBriefIds: string[];
}

/** Multi-day or late-week item still worth attention (no implied resolution). */
export interface WeeklyCarryForward {
  key: string;
  scope?: string;
  summary: string;
  evidenceBriefIds: string[];
}

/**
 * One Mon–Sun week of machine memory + human archive page.
 * `text` is deterministically rendered from structured fields only.
 */
export interface WeeklyRecord {
  /** Monday YMD, or `{ymd}.demo` for demo lane. */
  id: string;
  weekStart: string;
  weekEnd: string;
  timezone: string;
  demo: boolean;
  createdAt: string;
  sourceBriefIds: string[];
  signals: WeeklySignal[];
  carryForward: WeeklyCarryForward[];
  /** Rendered from signals + carryForward — never LLM prose. */
  text: string;
  /** Weekly LLM cost metadata when a provider was called. */
  usage?: BriefUsage;
  lastAttemptAt?: string;
  /** Skip LLM until this ISO time after a failed attempt. */
  retryAfter?: string;
  generationError?: string;
}

export type EvidenceRefType = "brief" | "week";

export interface EvidenceRef {
  type: EvidenceRefType;
  id: string;
}

export type ChatMessageRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
  /** Provenance for this assistant turn (brief and/or week). */
  sources?: EvidenceRef[];
  /** @deprecated prefer sources; still read for old threads */
  sourceBriefIds?: string[];
}

/** Persisted Ask thread under data/chats/<id>.json. */
export interface ChatRecord {
  id: string;
  createdAt: string;
  title: string;
  demo: boolean;
  /** Brief that opened the thread (e.g. peck source). */
  sourceBriefId?: string;
  /** Frozen at thread creation — never silently refreshed on later wakes. */
  contextBriefIds: string[];
  /** Frozen successful weeklies at thread creation (optional for old chats). */
  contextWeeklyIds?: string[];
  messages: ChatMessage[];
}
