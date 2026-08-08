import type { LoadedConfig } from "../config";
import { getLlmProvider, stubProvider } from "../llm";
import { appendLog } from "../store";
import type { RunContext } from "../types";

/**
 * True when Ask can call a real LLM (not the offline stub / missing keys).
 * Stub/demo-only must not silently answer Ask questions.
 */
export function isAskLlmAvailable(loaded: LoadedConfig): boolean {
  const { config, env } = loaded;
  if (!config.askEnabled) {
    return false;
  }
  const llm = getLlmProvider(config.llm.provider);
  if (!llm || llm.id === stubProvider.id) {
    return false;
  }
  return llm.requiredEnv.every((name) => {
    const value = env[name];
    return value !== undefined && value.trim() !== "";
  });
}

export function truncateAssistantReply(
  text: string,
  maxChars: number,
): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

/** Compose AbortSignals for Ask (run deadline optional). */
export function askAbortSignal(
  askTimeoutMs: number,
  parent?: AbortSignal,
): AbortSignal {
  const timeout = AbortSignal.timeout(askTimeoutMs);
  return parent ? AbortSignal.any([parent, timeout]) : timeout;
}

export async function logAsk(
  rootDir: string,
  message: string,
): Promise<void> {
  console.log(message);
  try {
    await appendLog(rootDir, message);
  } catch (err: unknown) {
    console.error("failed to append rooster.log", err);
  }
}

export function makeAskRunContext(
  loaded: LoadedConfig,
  signal: AbortSignal,
  now: Date = new Date(),
): RunContext {
  return {
    signal,
    timezone: loaded.config.timezone,
    now,
    log: (message: string) => {
      void logAsk(loaded.rootDir, message);
    },
    weatherLocation: loaded.config.weatherLocation,
  };
}
