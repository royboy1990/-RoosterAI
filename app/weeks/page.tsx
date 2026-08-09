import Link from "next/link";
import { formatDayHeading } from "@/app/_lib/format";
import { copy } from "@/src/copy";
import { loadConfig, resolveRootDir } from "@/src/core/config";
import type { WeeklyRecord } from "@/src/core/types";
import {
  isArchiveVisibleWeek,
  listWeekIds,
  readWeek,
} from "@/src/core/week-store";

export default async function WeeksPage() {
  const rootDir = resolveRootDir();
  const loaded = await loadConfig({ rootDir });
  const demoLane = loaded.config.demo;
  const ids = await listWeekIds(rootDir);
  const weeks: WeeklyRecord[] = [];

  for (const id of ids) {
    const week = await readWeek(rootDir, id);
    if (
      week &&
      week.demo === demoLane &&
      isArchiveVisibleWeek(week)
    ) {
      weeks.push(week);
    }
  }

  // Newest first by weekStart.
  weeks.sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));

  if (weeks.length === 0) {
    return (
      <main className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {copy.weeks.title}
        </h1>
        <p className="text-muted">{copy.weeks.empty}</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {copy.weeks.title}
        </h1>
        <p className="text-sm text-muted">{copy.weeks.blurb}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {weeks.map((week) => {
          const preview = week.text.replace(/^###[^\n]*\n?/, "").slice(0, 160);
          const range = `${formatDayHeading(week.weekStart, week.timezone)} – ${formatDayHeading(week.weekEnd, week.timezone)}`;
          return (
            <li key={week.id}>
              <Link
                href={`/week/${encodeURIComponent(week.id)}`}
                className="flex flex-col gap-1 rounded border border-border bg-surface/80 px-3 py-3 backdrop-blur-md transition hover:border-accent/40"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="metric-mono text-foreground">{range}</span>
                  {week.demo ? (
                    <span className="metric-mono rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">
                      {copy.weeks.demoTag}
                    </span>
                  ) : null}
                </div>
                <p className="line-clamp-2 text-sm text-muted">
                  {preview || copy.week.emptyBody}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
