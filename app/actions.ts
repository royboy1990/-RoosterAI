"use server";

import { revalidatePath } from "next/cache";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { copy } from "@/src/copy";
import {
  loadConfig,
  resolveRootDir,
  roosterConfigSchema,
  type ConnectorEntry,
  type RoosterConfig,
} from "@/src/core/config";
import { getConnector } from "@/src/core/connectors";
import { runPipeline } from "@/src/core/pipeline";

export type ActionResult =
  | { ok: true; message: string; briefId?: string }
  | { ok: false; message: string; error: string };

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

function defaultConfig(): RoosterConfig {
  return roosterConfigSchema.parse({
    demo: false,
    timezone: "UTC",
    connectors: [],
    llm: { provider: "stub", model: "stub" },
    delivery: { channel: "file" },
    scheduleHint: "0 7 * * *",
  });
}

async function readConfigOrNull(rootDir: string): Promise<RoosterConfig | null> {
  try {
    const loaded = await loadConfig({ rootDir });
    return loaded.config;
  } catch {
    return null;
  }
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

/** Preferences only — connectors are managed sparsely via /coop actions. */
export async function saveConfig(formData: FormData): Promise<ActionResult> {
  try {
    return await enqueueConfigWrite(async () => {
      const rootDir = resolveRootDir();
      const existing = (await readConfigOrNull(rootDir)) ?? defaultConfig();

      const draft = {
        ...existing,
        timezone: String(
          formData.get("timezone") ?? existing.timezone ?? "UTC",
        ),
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
        scheduleHint: String(
          formData.get("scheduleHint") ?? existing.scheduleHint ?? "0 7 * * *",
        ),
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
      revalidatePath("/");
      return { ok: true as const, message: copy.settings.saved };
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
      const existing = (await readConfigOrNull(rootDir)) ?? defaultConfig();

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
      const existing = await readConfigOrNull(rootDir);
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
      const existing = await readConfigOrNull(rootDir);
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
