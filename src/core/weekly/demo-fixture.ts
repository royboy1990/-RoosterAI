import type {
  WeeklyCarryForward,
  WeeklyRecord,
  WeeklySignal,
} from "../types";
import { weekEndYmd, weekId } from "../calendar-week";
import { renderWeeklyText } from "./render";

/**
 * Deterministic canned weekly memory for demo / stub — no network.
 * Mirrors showcase pecks: grounded in the sample farm narrative.
 */
export function buildDemoWeeklyFixture(input: {
  weekStart: string;
  timezone: string;
  sourceBriefIds: string[];
  createdAt?: string;
}): WeeklyRecord {
  const weekEnd = weekEndYmd(input.weekStart);
  const evidence = input.sourceBriefIds.slice(0, 3);
  const fallbackEvidence =
    evidence.length > 0 ? evidence : [`${input.weekStart}T07-00-00.000Z.demo`];

  const signals: WeeklySignal[] = [
    {
      key: "analytics-sessions",
      kind: "change",
      scope: "analytics",
      summary:
        "GameFoundry sessions stayed elevated mid-week versus the quieter Docs property.",
      direction: "improved",
      evidenceBriefIds: fallbackEvidence,
    },
    {
      key: "inbox-northwind",
      kind: "pattern",
      scope: "inbox",
      summary:
        "Northwind proposal mail recurred across multiple mornings without a clear close.",
      evidenceBriefIds: fallbackEvidence,
    },
  ];

  const carryForward: WeeklyCarryForward[] = [
    {
      key: "docs-overdue",
      scope: "tasks",
      summary:
        "Ship connector docs remained overdue near week end — still worth attention.",
      evidenceBriefIds: fallbackEvidence,
    },
  ];

  return {
    id: weekId(input.weekStart, true),
    weekStart: input.weekStart,
    weekEnd,
    timezone: input.timezone,
    demo: true,
    createdAt: input.createdAt ?? new Date().toISOString(),
    sourceBriefIds: [...input.sourceBriefIds],
    signals,
    carryForward,
    text: renderWeeklyText(signals, carryForward),
  };
}
