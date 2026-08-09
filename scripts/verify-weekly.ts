/**
 * Offline verification for weekly memory invariants from the vertical-slice plan.
 * Run: npx tsx scripts/verify-weekly.ts
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  completedWeekStartsBack,
  localYmd,
  shiftYmd,
  weekEndYmd,
  weekId,
  weekStartYmd,
} from "../src/core/calendar-week";
import {
  assembleAskEvidence,
  parseAndStripSourcesMarker,
} from "../src/core/ask/evidence";
import { writeBrief } from "../src/core/store";
import type { BriefRecord, WeeklyRecord } from "../src/core/types";
import {
  collectInWeekBriefs,
  digestHash,
  groupBriefsByDigestHash,
  validateWeeklyStructured,
} from "../src/core/weekly/generate";
import { renderWeeklyText } from "../src/core/weekly/render";
import {
  isArchiveVisibleWeek,
  pruneOldWeeks,
  tryAcquireWeekLease,
  writeWeek,
} from "../src/core/week-store";

function makeBrief(
  partial: Partial<BriefRecord> & Pick<BriefRecord, "id" | "createdAt" | "digest">,
): BriefRecord {
  return {
    timezone: "UTC",
    demo: false,
    status: "Optimal",
    text: "body",
    outcomes: [],
    llmProviderId: "stub",
    deliveryChannelId: "file",
    ...partial,
  };
}

async function main(): Promise<void> {
  // Calendar: 2026-08-03 is a Monday.
  assert.equal(weekStartYmd(new Date("2026-08-05T12:00:00Z"), "UTC"), "2026-08-03");
  assert.equal(weekEndYmd("2026-08-03"), "2026-08-09");
  assert.equal(weekId("2026-08-03", true), "2026-08-03.demo");
  assert.deepEqual(
    completedWeekStartsBack(new Date("2026-08-11T12:00:00Z"), "UTC", 2),
    ["2026-08-03", "2026-07-27"],
  );

  const root = await mkdtemp(path.join(tmpdir(), "rooster-weekly-"));
  try {
    // Unchanged cross-week baseline: Monday unchanged wake must use Monday's
    // digest/outcomes/id — not Friday's substantive brief as a substitute source.
    const friday = makeBrief({
      id: "2026-07-31T07-00-00.000Z",
      createdAt: "2026-07-31T07:00:00.000Z",
      digest: "## Friday farm\n- busy Friday",
      text: "Friday body",
    });
    const mondayUnchanged = makeBrief({
      id: "2026-08-03T07-00-00.000Z",
      createdAt: "2026-08-03T07:00:00.000Z",
      digest: "## Monday farm\n- quiet Monday",
      text: "Nothing new since Friday.",
      wakeMode: "unchanged",
      baselineBriefId: friday.id,
    });
    await writeBrief(root, friday);
    await writeBrief(root, mondayUnchanged);

    const inWeek = await collectInWeekBriefs({
      rootDir: root,
      demo: false,
      timezone: "UTC",
      weekStart: "2026-08-03",
      weekEnd: "2026-08-09",
    });
    assert.equal(inWeek.length, 1);
    assert.equal(inWeek[0]!.id, mondayUnchanged.id);
    assert.equal(inWeek[0]!.digest, mondayUnchanged.digest);
    assert.ok(!inWeek.some((b) => b.id === friday.id));

    // Digest persistence grouping: identical digest Mon/Tue/Wed → one group.
    const shared = "## Shared\n- same";
    const mon = makeBrief({
      id: "2026-08-03T08-00-00.000Z",
      createdAt: "2026-08-03T08:00:00.000Z",
      digest: shared,
    });
    const tue = makeBrief({
      id: "2026-08-04T08-00-00.000Z",
      createdAt: "2026-08-04T08:00:00.000Z",
      digest: shared,
    });
    const wed = makeBrief({
      id: "2026-08-05T08-00-00.000Z",
      createdAt: "2026-08-05T08:00:00.000Z",
      digest: shared,
    });
    const groups = groupBriefsByDigestHash([mon, tue, wed], "UTC");
    assert.equal(groups.length, 1);
    assert.equal(groups[0]!.briefs.length, 3);
    assert.equal(digestHash(shared), groups[0]!.digestHash);
    assert.deepEqual(groups[0]!.observationYmds, [
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
    ]);

    // Structured/text parity + no LLM text accepted.
    const structured = validateWeeklyStructured({
      raw: {
        text: "IGNORE ME",
        signals: [
          {
            key: "k1",
            kind: "change",
            summary: "Traffic up",
            evidenceBriefIds: [mon.id],
          },
        ],
        carryForward: [
          {
            key: "cf1",
            summary: "Docs still overdue",
            evidenceBriefIds: [wed.id],
          },
        ],
      },
      sourceBriefIds: [mon.id, tue.id, wed.id],
    });
    const text1 = renderWeeklyText(structured.signals, structured.carryForward);
    assert.match(text1, /What changed this week/);
    assert.match(text1, /Still worth attention/);
    assert.ok(!text1.includes("IGNORE ME"));
    structured.signals[0]!.summary = "Traffic mixed";
    const text2 = renderWeeklyText(structured.signals, structured.carryForward);
    assert.notEqual(text1, text2);

    // Drop evidence outside sourceBriefIds.
    const dropped = validateWeeklyStructured({
      raw: {
        signals: [
          {
            key: "bad",
            kind: "pattern",
            summary: "Nope",
            evidenceBriefIds: ["not-in-week"],
          },
        ],
      },
      sourceBriefIds: [mon.id],
    });
    assert.equal(dropped.signals.length, 0);

    // Lease exclusivity.
    const leaseId = "2026-08-03";
    assert.equal(await tryAcquireWeekLease(root, leaseId), true);
    assert.equal(await tryAcquireWeekLease(root, leaseId), false);

    // Archive hides failed stubs; retention keeps successful only.
    const failed: WeeklyRecord = {
      id: "2026-07-20",
      weekStart: "2026-07-20",
      weekEnd: "2026-07-26",
      timezone: "UTC",
      demo: false,
      createdAt: "2026-07-27T00:00:00.000Z",
      sourceBriefIds: [],
      signals: [],
      carryForward: [],
      text: "",
      generationError: "parse failed",
      retryAfter: "2099-01-01T00:00:00.000Z",
    };
    await writeWeek(root, failed);
    assert.equal(isArchiveVisibleWeek(failed), false);

    for (let i = 0; i < 13; i++) {
      const start = shiftYmd("2026-01-05", i * 7);
      const ok: WeeklyRecord = {
        id: start,
        weekStart: start,
        weekEnd: weekEndYmd(start),
        timezone: "UTC",
        demo: false,
        createdAt: `${start}T12:00:00.000Z`,
        sourceBriefIds: [mon.id],
        signals: structured.signals,
        carryForward: structured.carryForward,
        text: text2,
      };
      await writeWeek(root, ok);
    }
    const pruned = await pruneOldWeeks(root, false, 12);
    assert.equal(pruned.length, 1);
    // Failed stub still present (not counted in retention).
    const { readWeek } = await import("../src/core/week-store");
    assert.ok(await readWeek(root, failed.id));

    // Ask provenance marker — no false brief match from YMD substring.
    const weekYmd = "2026-08-03";
    const briefWithYmd = `2026-08-03T07-00-00.000Z`;
    const allowed = [
      { type: "brief" as const, id: briefWithYmd },
      { type: "week" as const, id: weekYmd },
    ];
    const marked =
      `Sessions rose.\n[[sources:week:${weekYmd}|brief:${briefWithYmd}]]`;
    const parsed = parseAndStripSourcesMarker(marked, allowed);
    assert.equal(parsed.text, "Sessions rose.");
    assert.deepEqual(parsed.sources, [
      { type: "week", id: weekYmd },
      { type: "brief", id: briefWithYmd },
    ]);

    // Ask budget: weeklies present even when source brief is large (35% reserved).
    const huge = "X".repeat(20_000);
    const evidence = assembleAskEvidence({
      briefs: [
        makeBrief({
          id: "source",
          createdAt: "2026-08-10T07:00:00.000Z",
          digest: huge,
          text: huge,
        }),
      ],
      weeks: [
        {
          id: "2026-08-03",
          weekStart: "2026-08-03",
          weekEnd: "2026-08-09",
          timezone: "UTC",
          demo: false,
          createdAt: "2026-08-10T00:00:00.000Z",
          sourceBriefIds: [mon.id],
          signals: structured.signals,
          carryForward: [],
          text: "### What changed this week\n- Weekly signal unique marker",
        },
      ],
      sourceBriefId: "source",
      charBudget: 24_000,
    });
    assert.match(evidence.packet, /Weekly signal unique marker/);
    assert.ok(evidence.weeklyIds.includes("2026-08-03"));

    // localYmd sanity for as-of filtering.
    assert.equal(localYmd(new Date("2026-08-03T07:00:00.000Z"), "UTC"), "2026-08-03");

    console.log("verify-weekly: all checks passed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
