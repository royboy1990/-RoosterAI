import type { ConnectorEntry, LoadedConfig } from "./config";
import { connectors, getConnector } from "./connectors";
import type { Connector } from "./types";

export type ProviderState = "available" | "active" | "muted" | "needsKeys";

export interface ProviderCard<T> {
  provider: T;
  state: ProviderState;
  missingEnv: string[];
  /** Present only when installed — the per-connector config from rooster.config.json. */
  entry?: ConnectorEntry;
}

/**
 * Installed connector id present in config but absent from the catalog
 * (fork switched branches, or custom id not registered).
 */
export interface UnknownInstalledCard {
  id: string;
  state: "muted" | "active";
  entry: ConnectorEntry;
  unknown: true;
}

function missingEnv(
  required: readonly string[],
  env: NodeJS.ProcessEnv,
): string[] {
  return required.filter((name) => {
    const value = env[name];
    return value === undefined || value.trim() === "";
  });
}

function stateForInstalled(
  entry: ConnectorEntry,
  missing: string[],
): ProviderState {
  if (!entry.enabled) {
    return "muted";
  }
  if (missing.length > 0) {
    return "needsKeys";
  }
  return "active";
}

/**
 * Single decider for connector visibility.
 * Pipeline and every page read this — catalog is "what exists", config is installed-only.
 */
export function resolveConnectors(
  loaded: LoadedConfig,
): ProviderCard<Connector>[] {
  const byId = new Map(
    loaded.config.connectors.map((entry) => [entry.id, entry]),
  );

  return connectors.map((provider) => {
    const entry = byId.get(provider.id);
    if (!entry) {
      return {
        provider,
        state: "available" as const,
        missingEnv: missingEnv(provider.requiredEnv, loaded.env),
      };
    }

    const missing = missingEnv(provider.requiredEnv, loaded.env);
    return {
      provider,
      state: stateForInstalled(entry, missing),
      missingEnv: missing,
      entry,
    };
  });
}

/** Config entries whose ids are not in the catalog — keep visible on /coop. */
export function resolveUnknownInstalled(
  loaded: LoadedConfig,
): UnknownInstalledCard[] {
  return loaded.config.connectors
    .filter((entry) => !getConnector(entry.id))
    .map((entry) => ({
      id: entry.id,
      state: entry.enabled ? ("active" as const) : ("muted" as const),
      entry,
      unknown: true as const,
    }));
}

/** True when the connector should run in the pipeline. */
export function isActive(
  card: ProviderCard<Connector>,
): card is ProviderCard<Connector> & { state: "active"; entry: ConnectorEntry } {
  return card.state === "active" && card.entry !== undefined;
}

/** Installed but missing required env — report into "Still in the coop". */
export function isNeedsKeys(
  card: ProviderCard<Connector>,
): card is ProviderCard<Connector> & {
  state: "needsKeys";
  entry: ConnectorEntry;
} {
  return card.state === "needsKeys" && card.entry !== undefined;
}
