"use server";

import { revalidatePath } from "next/cache";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { copy } from "@/src/copy";
import {
  loadConfig,
  PROMPT_HISTORY_MAX,
  PROMPT_MAX_CHARS,
  resolveRootDir,
  roosterConfigSchema,
  type ConnectorEntry,
  type PromptHistoryEntry,
  type RoosterConfig,
} from "@/src/core/config";
import { getConnector } from "@/src/core/connectors";
import { listAccessibleGa4Properties } from "@/src/core/connectors/ga4";
import type { Ga4PropertyInfo } from "@/src/core/connectors/ga4-shared";
import { runPipeline } from "@/src/core/pipeline";
import type { ActionResult } from "@/app/_lib/action-result";

export type { ActionResult } from "@/app/_lib/action-result";

/** Serialize config RMW so rapid install/mute/remove clicks don't interleave. */
let configWriteChain: Promise<unknown> = Promise.resolve();

function enqueueConfigWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = configWriteChain.then(task, task);
  configWriteChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function emptyPersistedConfig(): RoosterConfig {
  return roosterConfigSchema.parse({
    demo: false,
    timezone: "UTC",
    connectors: [],
    llm: { provider: "stub", model: "stub" },
    delivery: { channel: "file" },
    scheduleHint: "0 7 * * *",
  });
}

/** Persisted file only — defaults/demo are not written until the operator saves. */
async function readPersistedConfig(
  rootDir: string,
): Promise<RoosterConfig | null> {
  const loaded = await loadConfig({ rootDir });
  if (loaded.source !== "file") {
    return null;
  }
  return loaded.config;
}

async function writeRoosterConfig(
  rootDir: string,
  config: RoosterConfig,
): Promise<void> {
  const parsed = roosterConfigSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const filePath = path.join(rootDir, "rooster.config.json");
  await writeFile(
    filePath,
    `${JSON.stringify(parsed.data, null, 2)}\n`,
    "utf8",
  );
}

function revalidateCoopPaths(): void {
  revalidatePath("/coop");
  revalidatePath("/settings");
  revalidatePath("/setup");
  revalidatePath("/");
}

export async function wakeTheFlock(
  options: { demo?: boolean } = {},
): Promise<ActionResult> {
  try {
    const loaded = await loadConfig({ demo: options.demo === true });
    const brief = await runPipeline(loaded);
    revalidatePath("/");
    revalidatePath("/history");
    revalidatePath("/settings");
    revalidatePath("/coop");
    revalidatePath("/setup");
    return {
      ok: true,
      message: copy.wake.success,
      briefId: brief.id,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: copy.wake.failed,
      error,
    };
  }
}

function readGa4PropertiesFromForm(
  formData: FormData,
): Array<{ id: string; name: string }> {
  return formData
    .getAll("ga4Property")
    .map(String)
    .map((id) => id.trim().replace(/^properties\//, ""))
    .filter(Boolean)
    .map((id) => ({
      id,
      name: String(formData.get(`ga4PropertyName:${id}`) ?? "").trim(),
    }));
}

function withGa4ConnectorConfig(
  connectors: ConnectorEntry[],
  properties: Array<{ id: string; name: string }>,
): ConnectorEntry[] {
  if (properties.length === 0) {
    return connectors;
  }

  const ga4Config = { properties };
  const index = connectors.findIndex((entry) => entry.id === "ga4");
  if (index >= 0) {
    return connectors.map((entry, i) =>
      i === index
        ? {
            ...entry,
            enabled: true,
            config: {
              ...entry.config,
              ...ga4Config,
            },
          }
        : entry,
    );
  }

  return [
    ...connectors,
    {
      id: "ga4",
      enabled: true,
      config: ga4Config,
    },
  ];
}

function clampPrompt(raw: string): string {
  return raw.length > PROMPT_MAX_CHARS ? raw.slice(0, PROMPT_MAX_CHARS) : raw;
}

/**
 * Archive the previous prompt pair when either field changes.
 * Setup saves omit prompt fields — preserve existing prompts unchanged.
 */
function nextPrompts(
  existing: RoosterConfig["prompts"],
  formData: FormData,
  setupMode: boolean,
): RoosterConfig["prompts"] {
  if (setupMode || !formData.has("systemPrompt")) {
    return existing;
  }

  const system = clampPrompt(String(formData.get("systemPrompt") ?? ""));
  const overview = clampPrompt(String(formData.get("overviewPrompt") ?? ""));

  const prevSystem = existing.system ?? "";
  const prevOverview = existing.overview ?? "";
  const changed = system !== prevSystem || overview !== prevOverview;

  let history = existing.history ?? [];
  if (changed && (prevSystem.length > 0 || prevOverview.length > 0)) {
    const entry: PromptHistoryEntry = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      system: prevSystem,
      overview: prevOverview,
    };
    history = [entry, ...history].slice(0, PROMPT_HISTORY_MAX);
  }

  return {
    system: system.length > 0 ? system : undefined,
    overview,
    history,
  };
}

/**
 * Preferences (+ optional setup connectors).
 * Uses the effective config as RMW base so saving from defaults persists
 * auto-detected sources; setup mode replaces the connector list from checkboxes.
 */
export async function saveConfig(formData: FormData): Promise<ActionResult> {
  try {
    return await enqueueConfigWrite(async () => {
      const rootDir = resolveRootDir();
      const loaded = await loadConfig({ rootDir });
      const setupMode = formData.get("setup") === "1";
      const existing = loaded.config;
      const ga4Properties = readGa4PropertiesFromForm(formData);

      const connectorIds = setupMode
        ? formData
            .getAll("connector")
            .map(String)
            .filter((id) => id.length > 0)
        : null;

      let nextConnectors = existing.connectors;
      let demo = existing.demo;

      if (connectorIds) {
        nextConnectors = connectorIds.map((id) => {
          const previous = existing.connectors.find((entry) => entry.id === id);
          return {
            id,
            enabled: true,
            config: previous?.config ?? {},
          };
        });
        nextConnectors = withGa4ConnectorConfig(nextConnectors, ga4Properties);
        demo =
          nextConnectors.length === 1 && nextConnectors[0]?.id === "demo";
      } else if (ga4Properties.length > 0) {
        nextConnectors = withGa4ConnectorConfig(
          existing.connectors,
          ga4Properties,
        );
        demo = false;
      }

      const draft = {
        ...existing,
        connectors: nextConnectors,
        demo,
        timezone: String(
          formData.get("timezone") ?? existing.timezone ?? "UTC",
        ).trim() || "UTC",
        llm: {
          provider: String(
            formData.get("llmProvider") ?? existing.llm.provider ?? "stub",
          ),
          model: String(
            formData.get("llmModel") ?? existing.llm.model ?? "stub",
          ),
        },
        delivery: {
          channel: String(
            formData.get("deliveryChannel") ??
              existing.delivery.channel ??
              "file",
          ),
        },
        // Wake crow lives in the Audio section (`saveWakeSound`); preserve here.
        wakeSound: existing.wakeSound ?? true,
        scheduleHint: String(
          formData.get("scheduleHint") ?? existing.scheduleHint ?? "0 7 * * *",
        ),
        prompts: nextPrompts(existing.prompts, formData, setupMode),
      };

      if (!isValidTimeZone(draft.timezone)) {
        return {
          ok: false as const,
          message: setupMode ? copy.setup.saveFailed : copy.settings.saveFailed,
          error: `Invalid timezone: ${draft.timezone}`,
        };
      }

      const parsed = roosterConfigSchema.safeParse(draft);
      if (!parsed.success) {
        return {
          ok: false as const,
          message: setupMode ? copy.setup.saveFailed : copy.settings.saveFailed,
          error: parsed.error.issues.map((i) => i.message).join("; "),
        };
      }

      await writeRoosterConfig(rootDir, parsed.data);
      revalidatePath("/settings");
      revalidatePath("/setup");
      revalidatePath("/");
      revalidatePath("/coop");
      return {
        ok: true as const,
        message: setupMode ? copy.setup.saved : copy.settings.saved,
      };
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: copy.settings.saveFailed,
      error,
    };
  }
}

function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Persist browser-detected IANA timezone when config still has the factory
 * default "UTC". No-op if timezone was already customized.
 */
export async function applyBrowserTimezone(
  timeZone: string,
): Promise<ActionResult> {
  const zone = timeZone.trim();
  if (!zone || !isValidTimeZone(zone)) {
    return {
      ok: false,
      message: copy.settings.saveFailed,
      error: `Invalid timezone: ${timeZone}`,
    };
  }

  try {
    return await enqueueConfigWrite(async () => {
      const rootDir = resolveRootDir();
      const loaded = await loadConfig({ rootDir });
      if (loaded.config.timezone !== "UTC") {
        return {
          ok: true as const,
          message: copy.settings.saved,
        };
      }
      if (zone === "UTC") {
        return {
          ok: true as const,
          message: copy.settings.saved,
        };
      }

      const existing =
        loaded.source === "file" ? loaded.config : emptyPersistedConfig();
      const draft =
        loaded.source === "file"
          ? { ...existing, timezone: zone }
          : {
              ...existing,
              timezone: zone,
              connectors: loaded.config.connectors,
              llm: loaded.config.llm,
              delivery: loaded.config.delivery,
              demo: loaded.config.demo,
              scheduleHint: loaded.config.scheduleHint,
              prompts: loaded.config.prompts,
            };

      const parsed = roosterConfigSchema.safeParse(draft);
      if (!parsed.success) {
        return {
          ok: false as const,
          message: copy.settings.saveFailed,
          error: parsed.error.issues.map((i) => i.message).join("; "),
        };
      }

      await writeRoosterConfig(rootDir, parsed.data);
      revalidatePath("/settings");
      revalidatePath("/setup");
      revalidatePath("/");
      revalidatePath("/coop");
      revalidatePath("/history");
      return {
        ok: true as const,
        message: copy.settings.saved,
      };
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: copy.settings.saveFailed,
      error,
    };
  }
}

export async function listGa4Properties(): Promise<
  | { ok: true; properties: Ga4PropertyInfo[] }
  | { ok: false; message: string; error: string }
> {
  try {
    const rootDir = resolveRootDir();
    const loaded = await loadConfig({ rootDir });
    const properties = await listAccessibleGa4Properties(loaded.env, rootDir);
    return { ok: true, properties };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: copy.ga4.loadFailed,
      error,
    };
  }
}

/** Audio section — wake crow only (Rooster FM defaults stay in the browser). */
export async function saveWakeSound(enabled: boolean): Promise<ActionResult> {
  try {
    return await enqueueConfigWrite(async () => {
      const rootDir = resolveRootDir();
      const loaded = await loadConfig({ rootDir });
      const draft = {
        ...loaded.config,
        wakeSound: enabled,
      };
      const parsed = roosterConfigSchema.safeParse(draft);
      if (!parsed.success) {
        return {
          ok: false as const,
          message: copy.settings.audioSaveFailed,
          error: parsed.error.issues.map((i) => i.message).join("; "),
        };
      }
      await writeRoosterConfig(rootDir, parsed.data);
      revalidatePath("/settings");
      revalidatePath("/");
      return { ok: true as const, message: copy.settings.audioSaved };
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: copy.settings.audioSaveFailed,
      error,
    };
  }
}

export async function saveGa4Properties(
  properties: Array<{ id: string; name: string }>,
): Promise<ActionResult> {
  try {
    return await enqueueConfigWrite(async () => {
      const rootDir = resolveRootDir();
      const loaded = await loadConfig({ rootDir });
      const existing =
        loaded.source === "file" ? loaded.config : emptyPersistedConfig();

      const cleaned = properties
        .map((property) => ({
          id: property.id.trim().replace(/^properties\//, ""),
          name: property.name.trim(),
        }))
        .filter((property) => property.id.length > 0);

      const nextConnectors = withGa4ConnectorConfig(
        existing.connectors,
        cleaned,
      );

      // Allow clearing selection while keeping ga4 installed.
      const withCleared =
        cleaned.length === 0
          ? existing.connectors.map((entry) =>
              entry.id === "ga4"
                ? { ...entry, config: { ...entry.config, properties: [] } }
                : entry,
            )
          : nextConnectors;

      const draft = {
        ...existing,
        demo: false,
        connectors: withCleared,
      };

      const parsed = roosterConfigSchema.safeParse(draft);
      if (!parsed.success) {
        return {
          ok: false as const,
          message: copy.ga4.saveFailed,
          error: parsed.error.issues.map((i) => i.message).join("; "),
        };
      }

      await writeRoosterConfig(rootDir, parsed.data);
      revalidateCoopPaths();
      return { ok: true as const, message: copy.ga4.saved };
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: copy.ga4.saveFailed,
      error,
    };
  }
}

export async function installConnector(id: string): Promise<ActionResult> {
  try {
    return await enqueueConfigWrite(async () => {
      const connector = getConnector(id);
      if (!connector) {
        return {
          ok: false as const,
          message: copy.coop.installFailed,
          error: `Unknown connector id "${id}"`,
        };
      }

      const rootDir = resolveRootDir();
      const loaded = await loadConfig({ rootDir });
      // Prefer persisted file; otherwise start sparse (not the full defaults list)
      // so Install on /coop only writes the chosen source.
      const existing =
        loaded.source === "file" ? loaded.config : emptyPersistedConfig();

      if (existing.connectors.some((entry) => entry.id === id)) {
        return {
          ok: true as const,
          message: copy.coop.alreadyInstalled,
        };
      }

      const entry: ConnectorEntry = {
        id,
        enabled: true,
        config: {},
      };

      await writeRoosterConfig(rootDir, {
        ...existing,
        demo: false,
        connectors: [...existing.connectors, entry],
      });
      revalidateCoopPaths();
      return { ok: true as const, message: copy.coop.installed(connector.label) };
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: copy.coop.installFailed,
      error,
    };
  }
}

export async function removeConnector(id: string): Promise<ActionResult> {
  try {
    return await enqueueConfigWrite(async () => {
      const rootDir = resolveRootDir();
      const existing = await readPersistedConfig(rootDir);
      if (!existing) {
        return {
          ok: false as const,
          message: copy.coop.removeFailed,
          error: "No rooster.config.json yet.",
        };
      }

      if (!existing.connectors.some((entry) => entry.id === id)) {
        return {
          ok: true as const,
          message: copy.coop.alreadyRemoved,
        };
      }

      await writeRoosterConfig(rootDir, {
        ...existing,
        connectors: existing.connectors.filter((entry) => entry.id !== id),
      });
      revalidateCoopPaths();
      const label = getConnector(id)?.label ?? id;
      return { ok: true as const, message: copy.coop.removed(label) };
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: copy.coop.removeFailed,
      error,
    };
  }
}

export async function setConnectorMuted(
  id: string,
  muted: boolean,
): Promise<ActionResult> {
  try {
    return await enqueueConfigWrite(async () => {
      const rootDir = resolveRootDir();
      const existing = await readPersistedConfig(rootDir);
      if (!existing) {
        return {
          ok: false as const,
          message: copy.coop.muteFailed,
          error: "No rooster.config.json yet.",
        };
      }

      const index = existing.connectors.findIndex((entry) => entry.id === id);
      if (index < 0) {
        return {
          ok: false as const,
          message: copy.coop.muteFailed,
          error: `Connector "${id}" is not installed.`,
        };
      }

      const next = existing.connectors.map((entry, i) =>
        i === index ? { ...entry, enabled: !muted } : entry,
      );

      await writeRoosterConfig(rootDir, {
        ...existing,
        connectors: next,
      });
      revalidateCoopPaths();
      const label = getConnector(id)?.label ?? id;
      return {
        ok: true as const,
        message: muted ? copy.coop.muted(label) : copy.coop.unmuted(label),
      };
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: copy.coop.muteFailed,
      error,
    };
  }
}
