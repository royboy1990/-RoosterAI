import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const connectorEntrySchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()).default({}),
});

const roosterConfigSchema = z.object({
  /** When true, briefs are labeled [DEMO] and stored with demo: true. */
  demo: z.boolean().default(false),
  timezone: z.string().min(1).default("UTC"),
  /** Per-connector AbortSignal.timeout budget in ms. */
  connectorTimeoutMs: z.number().int().positive().default(30_000),
  /** Max characters kept per connector after sanitize. */
  perConnectorCharBudget: z.number().int().positive().default(4_000),
  connectors: z.array(connectorEntrySchema).min(1),
  llm: z.object({
    provider: z.string().min(1),
    model: z.string().min(1).default("default"),
  }),
  delivery: z.object({
    channel: z.string().min(1),
  }),
  scheduleHint: z.string().optional(),
});

export type RoosterConfig = z.infer<typeof roosterConfigSchema>;
export type ConnectorEntry = z.infer<typeof connectorEntrySchema>;

export interface LoadedConfig {
  config: RoosterConfig;
  /** Project root (directory that holds package.json / rooster.config*.json). */
  rootDir: string;
  /** Snapshot of process.env after dotenv load. */
  env: NodeJS.ProcessEnv;
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

/**
 * Loads + zod-validates rooster config and resolves env from `.env`.
 * Demo mode is a config preset path — not a pipeline branch.
 */
export async function loadConfig(options: LoadConfigOptions = {}): Promise<LoadedConfig> {
  const rootDir = options.rootDir ?? resolveRootDir();
  loadDotenv({ path: path.join(rootDir, ".env"), quiet: true });

  const configPath = options.demo
    ? path.join(rootDir, "rooster.config.demo.json")
    : path.join(rootDir, "rooster.config.json");

  if (!existsSync(configPath)) {
    const hint = options.demo
      ? "rooster.config.demo.json is missing from the repo."
      : "Copy rooster.config.example.json → rooster.config.json, or run with --demo.";
    throw new Error(`Config not found at ${configPath}. ${hint}`);
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
  };
}

export { roosterConfigSchema };
