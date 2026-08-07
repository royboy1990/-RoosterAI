/**
 * Seed a polished showcase brief as Latest — for screenshots / marketing.
 * Usage: npx tsx scripts/seed-showcase-brief.ts [--clean-label]
 *
 * --clean-label  omit [DEMO] marker and demo:true (screenshot-friendly)
 */
import { copy } from "../src/copy";
import { resolveRootDir } from "../src/core/config";
import { SHOWCASE_BRIEF_TEXT, SHOWCASE_DEMO_LINES } from "../src/core/demo/showcase-brief";
import { toBriefId, writeBrief } from "../src/core/store";
import type { BriefRecord } from "../src/core/types";

async function main(): Promise<void> {
  const clean = process.argv.includes("--clean-label");
  const rootDir = resolveRootDir();
  const now = new Date();
  const id = toBriefId(now);

  const body = SHOWCASE_BRIEF_TEXT.trim();
  const text = clean ? body : `${copy.demoMarker}\n${body}`;

  const brief: BriefRecord = {
    id,
    createdAt: now.toISOString(),
    timezone: "UTC",
    demo: !clean,
    status: "Optimal",
    text,
    digest: ["## Demo Farm", ...SHOWCASE_DEMO_LINES].join("\n"),
    outcomes: [
      {
        connectorId: "demo",
        label: "Demo Farm",
        status: "ok",
        result: {
          heading: "Demo Farm",
          lines: [...SHOWCASE_DEMO_LINES],
        },
      },
    ],
    llmProviderId: "stub",
    deliveryChannelId: "file",
    wakeMode: "full",
  };

  const filePath = await writeBrief(rootDir, brief);
  console.log(
    `Showcase brief → ${filePath}` +
      (clean ? " (clean label, no [DEMO])" : " (demo labeled)"),
  );
  console.log("Open http://localhost:3000 to view Latest.");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`seed-showcase-brief failed: ${message}`);
  process.exitCode = 1;
});
