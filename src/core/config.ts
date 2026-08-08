import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import { connectorCatalog } from "./connectors/catalog";
import {
  anthropicProvider,
  geminiProvider,
  openaiCompatibleProvider,
  stubProvider,
} from "./llm";
import {
  PROMPT_HISTORY_MAX,
  PROMPT_MAX_CHARS,
  type PromptHistoryEntry,
} from "./prompts";
import {
  OPERATOR_NAME_MAX,
  ttsModeSchema,
  ttsVoiceSchema,
} from "./tts/voices";

export { PROMPT_HISTORY_MAX, PROMPT_MAX_CHARS };
export type { PromptHistoryEntry };
export {
  OPERATOR_NAME_MAX,
  TTS_VOICES,
  ttsModeSchema,
  ttsVoiceSchema,
  type TtsMode,
  type TtsVoice,
} from "./tts/voices";

const connectorEntrySchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()).default({}),
});

const promptHistoryEntrySchema = z.object({
  id: z.string().min(1),
  savedAt: z.string().min(1),
  system: z.string().max(PROMPT_MAX_CHARS),
  overview: z.string().max(PROMPT_MAX_CHARS),
});

const promptsSchema = z.object({
  /** Empty / omitted → pipeline falls back to copy.briefSystemPrompt. */
  system: z.string().max(PROMPT_MAX_CHARS).optional(),
  /** Operator guidance for what the morning overview should emphasize. */
  overview: z.string().max(PROMPT_MAX_CHARS).default(""),
  history: z.array(promptHistoryEntrySchema).max(PROMPT_HISTORY_MAX).default([]),
});

const roosterConfigSchema = z.object({
  /** When true, briefs are labeled [DEMO] and stored with demo: true. */
  demo: z.boolean().default(false),
  timezone: z.string().min(1).default("UTC"),
  /** City name for weather; empty = derive from timezone. */
  weatherLocation: z.string().max(120).default(""),
  /** Spoken greeting only — not injected into the written brief. */
  operatorName: z.string().max(OPERATOR_NAME_MAX).default(""),
  /** Per-connector AbortSignal.timeout budget in ms. */
  connectorTimeoutMs: z.number().int().positive().default(30_000),
  /** Whole wake AbortSignal.timeout budget in ms. Covers 30s gather + 90s LLM + 60s TTS + 30s delivery plus overhead. */
  runDeadlineMs: z.number().int().positive().default(240_000),
  /** LLM stage AbortSignal.timeout budget in ms. */
  llmTimeoutMs: z.number().int().positive().default(90_000),
  /** TTS stage AbortSignal.timeout budget in ms. */
  ttsTimeoutMs: z.number().int().positive().default(60_000),
  /** Delivery stage AbortSignal.timeout budget in ms. */
  deliveryTimeoutMs: z.number().int().positive().default(30_000),
  /** Generate follow-up Pecks after the brief text (fail-soft). */
  pecksEnabled: z.boolean().default(true),
  /** Allow Ask chats grounded in stored briefs (independent of pecksEnabled). */
  askEnabled: z.boolean().default(true),
  /** How many substantive briefs to freeze into a new chat's context window. */
  chatContextBriefs: z.number().int().min(1).max(7).default(7),
  /** Pecks generation AbortSignal.timeout budget in ms. */
  pecksTimeoutMs: z.number().int().positive().default(20_000),
  /** Ask LLM AbortSignal.timeout budget in ms. */
  askTimeoutMs: z.number().int().positive().default(60_000),
  /** Max characters accepted for a single Ask user message. */
  askMaxUserMessageChars: z.number().int().positive().default(4_000),
  /** Soft cap on assistant reply length (truncated if longer). */
  askMaxAssistantChars: z.number().int().positive().default(8_000),
  /** Per-request evidence assembly budget (chars) for Ask. */
  askContextCharBudget: z.number().int().positive().default(24_000),
  /** Max messages kept per chat; older turns are pruned. */
  chatMaxStoredMessages: z.number().int().positive().default(40),
  /** Max characters kept per connector after sanitize. */
  perConnectorCharBudget: z.number().int().positive().default(4_000),
  /** Sparse — installed connectors only. Empty is a valid intermediate state. */
  connectors: z.array(connectorEntrySchema).default([]),
  llm: z.object({
    provider: z.string().min(1),
    model: z.string().min(1).default("default"),
  }),
  delivery: z.object({
    channel: z.string().min(1),
  }),
  /** Play crow MP3 when a dashboard Wake the Flock Up succeeds. */
  wakeSound: z.boolean().default(true),
  /** Dashboard spoken brief (OpenAI speech). Fail-soft on wake. */
  ttsEnabled: z.boolean().default(true),
  ttsMode: ttsModeSchema.default("each-wake"),
  ttsVoice: ttsVoiceSchema.default("marin"),
  scheduleHint: z.string().optional(),
  prompts: promptsSchema.default({ overview: "", history: [] }),
});

export type RoosterConfig = z.infer<typeof roosterConfigSchema>;
export type ConnectorEntry = z.infer<typeof connectorEntrySchema>;

export type ConfigSource = "file" | "demo" | "defaults";

export interface LoadedConfig {
  config: RoosterConfig;
  /** Project root (directory that holds package.json / rooster.config*.json). */
  rootDir: string;
  /** Snapshot of process.env after dotenv load. */
  env: NodeJS.ProcessEnv;
  /** Where the effective config came from — drives banners and honesty logs. */
  source: ConfigSource;
}

function envIsSet(name: string, env: NodeJS.ProcessEnv): boolean {
  const value = env[name];
  return value !== undefined && value.trim() !== "";
}

function findRootDir(startDir: string = process.cwd()): string {
  let dir = path.resolve(startDir);
  for (;;) {
    if (existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return path.resolve(startDir);
    }
    dir = parent;
  }
}

/** Resolve the repo root even when invoked via tsx from an absolute script path. */
export function resolveRootDir(): string {
  const fromMeta = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  if (existsSync(path.join(fromMeta, "package.json"))) {
    return fromMeta;
  }
  return findRootDir();
}

export interface LoadConfigOptions {
  /** Load committed rooster.config.demo.json instead of local rooster.config.json. */
  demo?: boolean;
  rootDir?: string;
}

/** Absolute path to the local (non-demo) rooster.config.json. */
export function roosterConfigPath(rootDir: string = resolveRootDir()): string {
  return path.join(rootDir, "rooster.config.json");
}

/** True when the operator has created a local rooster.config.json. */
export function hasRoosterConfig(rootDir: string = resolveRootDir()): boolean {
  return existsSync(roosterConfigPath(rootDir));
}

/**
 * Auto-detect connectors + LLM from env when no config file exists.
 * Delivery stays `file` — never auto-send. Demo connector is fallback only
 * (it has empty requiredEnv and would otherwise always qualify).
 */
export function buildDefaultConfig(env: NodeJS.ProcessEnv): RoosterConfig {
  const detected = connectorCatalog
    .filter((connector) => connector.id !== "demo")
    // Empty requiredEnv — never auto-install; stock from /coop (or Settings location).
    .filter(
      (connector) =>
        connector.id !== "site-health" && connector.id !== "weather",
    )
    .filter((connector) => {
      if (!connector.requiredEnv.every((name) => envIsSet(name, env))) {
        return false;
      }
      // GA4 needs an explicit property selection (picker or GA4_PROPERTY_ID)
      // before it is useful in a defaults run.
      if (connector.id === "ga4" && !envIsSet("GA4_PROPERTY_ID", env)) {
        return false;
      }
      // GSC needs an explicit site selection (picker or GSC_SITE_URL).
      if (connector.id === "gsc" && !envIsSet("GSC_SITE_URL", env)) {
        return false;
      }
      return true;
    })
    .map((connector) => {
      if (connector.id === "ga4") {
        const properties = env.GA4_PROPERTY_ID
          ? env.GA4_PROPERTY_ID.split(/[,:\s]+/)
              .map((part) => part.trim().replace(/^properties\//, ""))
              .filter(Boolean)
              .map((id) => ({ id, name: "" }))
          : [];
        return {
          id: connector.id,
          enabled: true,
          config: { properties },
        };
      }
      if (connector.id === "gsc") {
        const sites = env.GSC_SITE_URL
          ? env.GSC_SITE_URL.split(",")
              .map((part) => part.trim())
              .filter(Boolean)
              .map((siteUrl) => ({ siteUrl, name: "" }))
          : [];
        return {
          id: connector.id,
          enabled: true,
          config: { sites },
        };
      }
      return {
        id: connector.id,
        enabled: true,
        config: {},
      };
    });

  const useDemo = detected.length === 0;
  const connectorEntries = useDemo
    ? [{ id: "demo", enabled: true, config: {} }]
    : detected;

  let llm: RoosterConfig["llm"];
  if (envIsSet("OPENAI_API_KEY", env)) {
    llm = {
      provider: openaiCompatibleProvider.id,
      model: openaiCompatibleProvider.defaultModel,
    };
  } else if (envIsSet("GEMINI_API_KEY", env)) {
    llm = {
      provider: geminiProvider.id,
      model: geminiProvider.defaultModel,
    };
  } else if (envIsSet("ANTHROPIC_API_KEY", env)) {
    llm = {
      provider: anthropicProvider.id,
      model: anthropicProvider.defaultModel,
    };
  } else {
    llm = {
      provider: stubProvider.id,
      model: stubProvider.defaultModel,
    };
  }

  return roosterConfigSchema.parse({
    demo: useDemo,
    timezone: "UTC",
    connectors: connectorEntries,
    llm,
    delivery: { channel: "file" },
    scheduleHint: "0 7 * * *",
  });
}

/**
 * Loads + zod-validates rooster config and resolves env from `.env`.
 * Missing local config is a valid defaults state — malformed files still throw.
 * Demo mode is a config preset path — not a pipeline branch.
 */
export async function loadConfig(options: LoadConfigOptions = {}): Promise<LoadedConfig> {
  const rootDir = options.rootDir ?? resolveRootDir();
  loadDotenv({ path: path.join(rootDir, ".env"), quiet: true });

  const configPath = options.demo
    ? path.join(rootDir, "rooster.config.demo.json")
    : roosterConfigPath(rootDir);

  if (!existsSync(configPath)) {
    if (options.demo) {
      throw new Error(
        `Config not found at ${configPath}. rooster.config.demo.json is missing from the repo.`,
      );
    }

    const config = buildDefaultConfig(process.env);
    return {
      config,
      rootDir,
      env: process.env,
      source: "defaults",
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(configPath, "utf8")) as unknown;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read/parse ${configPath}: ${message}`);
  }

  const parsed = roosterConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid config at ${configPath}:\n${z.prettifyError(parsed.error)}`,
    );
  }

  const config = parsed.data;
  // --demo always labels the run even if someone edits the demo file's flag off.
  if (options.demo) {
    config.demo = true;
  }

  return {
    config,
    rootDir,
    env: process.env,
    source: options.demo ? "demo" : "file",
  };
}

export { roosterConfigSchema };
