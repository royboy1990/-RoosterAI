import Link from "next/link";
import { formatBriefTime, formatDayHeading, dayKey } from "@/app/_lib/format";
import { copy } from "@/src/copy";
import { resolveRootDir } from "@/src/core/config";
import {
  listBriefIds,
  readBrief,
  resolveSubstantiveBrief,
} from "@/src/core/store";
import type { BriefRecord } from "@/src/core/types";

export default async function HistoryPage() {
  const rootDir = resolveRootDir();
  const ids = await listBriefIds(rootDir);
  const briefs: BriefRecord[] = [];
  const previewById = new Map<string, string>();

  for (const id of ids) {
    const brief = await readBrief(rootDir, id);
    if (brief) {
      briefs.push(brief);
      const body = await resolveSubstantiveBrief(rootDir, brief);
      previewById.set(
        brief.id,
        body.text.replace(/^\[DEMO\]\n?/, "").slice(0, 160),
      );
    }
  }

  if (briefs.length === 0) {
    return (
      <main className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {copy.history.title}
        </h1>
        <p className="text-muted">{copy.history.empty}</p>
      </main>
    );
  }

  const grouped = new Map<string, BriefRecord[]>();
  for (const brief of briefs) {
    const key = dayKey(brief.createdAt, brief.timezone);
    const list = grouped.get(key) ?? [];
    list.push(brief);
    grouped.set(key, list);
  }

  return (
    <main className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        {copy.history.title}
      </h1>

      {[...grouped.entries()].map(([day, dayBriefs]) => (
        <section key={day} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted">
            {formatDayHeading(day, dayBriefs[0]!.timezone)}
          </h2>
          <ul className="flex flex-col gap-2">
            {dayBriefs.map((brief) => (
              <li key={brief.id}>
                <Link
                  href={`/brief/${encodeURIComponent(brief.id)}`}
                  className="flex flex-col gap-1 rounded border border-border bg-surface/80 px-3 py-3 backdrop-blur-md transition hover:border-accent/40"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="metric-mono text-foreground">
                      {formatBriefTime(brief.createdAt, brief.timezone)}
                    </span>
                    <span className="text-muted">·</span>
                    <span className="text-muted">{brief.status}</span>
                    {brief.demo ? (
                      <span className="metric-mono rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">
                        {copy.history.demoTag}
                      </span>
                    ) : null}
                    {brief.wakeMode === "unchanged" ? (
                      <span className="metric-mono rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted">
                        {copy.history.unchangedTag}
                      </span>
                    ) : null}
                  </div>
                  <p className="line-clamp-2 text-sm text-muted">
                    {previewById.get(brief.id) ??
                      brief.text.replace(/^\[DEMO\]\n?/, "").slice(0, 160)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
