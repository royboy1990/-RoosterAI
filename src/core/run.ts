import { copy } from "../copy";
import { loadConfig } from "./config";
import { runPipeline } from "./pipeline";

/**
 * Cron / CLI entry: runs the whole pipeline once.
 * Usage: npx tsx src/core/run.ts [--demo]
 */
async function main(): Promise<void> {
  const demo = process.argv.includes("--demo");
  const loaded = await loadConfig({ demo });
  const brief = await runPipeline(loaded);

  const preview = brief.text.split("\n").slice(0, 12).join("\n");
  console.log("");
  console.log("─".repeat(48));
  console.log(preview);
  if (brief.text.split("\n").length > 12) {
    console.log("…");
  }
  console.log("─".repeat(48));
  console.log(
    `${copy.wakeAction} complete · ${brief.id} · ${brief.status}` +
      (brief.demo ? ` · ${copy.demoMarker}` : ""),
  );
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`RoosterAI failed: ${message}`);
  process.exitCode = 1;
});
