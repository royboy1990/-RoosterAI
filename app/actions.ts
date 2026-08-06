"use server";

import { revalidatePath } from "next/cache";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { copy } from "@/src/copy";
import {
  loadConfig,
  resolveRootDir,
  roosterConfigSchema,
  type RoosterConfig,
} from "@/src/core/config";
import { connectors } from "@/src/core/connectors";
import { runPipeline } from "@/src/core/pipeline";

export type ActionResult =
  | { ok: true; message: string; briefId?: string }
  | { ok: false; message: string; error: string };

export async function wakeTheFlock(
  options: { demo?: boolean } = {},
): Promise<ActionResult> {
  try {
    const loaded = await loadConfig({ demo: options.demo === true });
    const brief = await runPipeline(loaded);
    revalidatePath("/");
    revalidatePath("/history");
    revalidatePath("/settings");
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

export async function saveConfig(formData: FormData): Promise<ActionResult> {
  try {
    const rootDir = resolveRootDir();
    let existing: RoosterConfig | null = null;
    try {
      const loaded = await loadConfig({ rootDir });
      existing = loaded.config;
    } catch {
      existing = null;
    }

    const enabledIds = new Set(
      formData.getAll("connectorId").map((v) => String(v)),
    );

    const existingById = new Map(
      (existing?.connectors ?? []).map((entry) => [entry.id, entry]),
    );

    const nextConnectors = connectors.map((connector) => {
      const prev = existingById.get(connector.id);
      return {
        id: connector.id,
        enabled: enabledIds.has(connector.id),
        config: prev?.config ?? {},
      };
    });

    // Keep any unknown custom connector entries from the file (forks).
    for (const entry of existing?.connectors ?? []) {
      if (!connectors.some((c) => c.id === entry.id)) {
        nextConnectors.push({
          ...entry,
          enabled: enabledIds.has(entry.id),
        });
      }
    }

    const draft = {
      demo: existing?.demo ?? false,
      timezone: String(formData.get("timezone") ?? existing?.timezone ?? "UTC"),
      connectorTimeoutMs:
        existing?.connectorTimeoutMs ?? 30_000,
      perConnectorCharBudget:
        existing?.perConnectorCharBudget ?? 4_000,
      connectors:
        nextConnectors.length > 0
          ? nextConnectors
          : existing?.connectors ?? [
              { id: "demo", enabled: true, config: {} },
            ],
      llm: {
        provider: String(
          formData.get("llmProvider") ?? existing?.llm.provider ?? "stub",
        ),
        model: String(formData.get("llmModel") ?? existing?.llm.model ?? "stub"),
      },
      delivery: {
        channel: String(
          formData.get("deliveryChannel") ??
            existing?.delivery.channel ??
            "file",
        ),
      },
      scheduleHint: String(
        formData.get("scheduleHint") ?? existing?.scheduleHint ?? "0 7 * * *",
      ),
    };

    const parsed = roosterConfigSchema.safeParse(draft);
    if (!parsed.success) {
      return {
        ok: false,
        message: copy.settings.saveFailed,
        error: parsed.error.issues.map((i) => i.message).join("; "),
      };
    }

    const filePath = path.join(rootDir, "rooster.config.json");
    await writeFile(
      filePath,
      `${JSON.stringify(parsed.data, null, 2)}\n`,
      "utf8",
    );

    revalidatePath("/settings");
    revalidatePath("/");
    return { ok: true, message: copy.settings.saved };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: copy.settings.saveFailed,
      error,
    };
  }
}
