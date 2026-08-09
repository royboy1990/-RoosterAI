import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefProse } from "@/app/_components/brief-prose";
import { formatDayHeading } from "@/app/_lib/format";
import { copy } from "@/src/copy";
import { resolveRootDir } from "@/src/core/config";
import { readWeek } from "@/src/core/week-store";

/** Week ids are Monday YMD, optionally `.demo`. */
const WEEK_ID_RE = /^\d{4}-\d{2}-\d{2}(\.demo)?$/;

export default async function WeekByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId ?? "").trim();
  if (!id || !WEEK_ID_RE.test(id)) {
    notFound();
  }

  const rootDir = resolveRootDir();
  const week = await readWeek(rootDir, id);
  if (!week) {
    notFound();
  }

  const rangeLabel = `${formatDayHeading(week.weekStart, week.timezone)} – ${formatDayHeading(week.weekEnd, week.timezone)}`;

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted">
          <Link href="/weeks" className="hover:text-foreground">
            {copy.weeks.backToArchive}
          </Link>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {copy.week.title}
          </h1>
          {week.demo ? (
            <span className="metric-mono rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">
              {copy.weeks.demoTag}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted">{rangeLabel}</p>
      </div>

      {week.generationError ? (
        <p className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {copy.week.generationFailed(week.generationError)}
        </p>
      ) : null}

      {week.text.trim() ? (
        <article className="brief-prose rounded border border-border bg-surface/80 px-4 py-4 text-[15px] backdrop-blur-md">
          <BriefProse text={week.text} />
        </article>
      ) : !week.generationError ? (
        <p className="text-sm text-muted">{copy.week.emptyBody}</p>
      ) : null}

      {week.signals.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted">
            {copy.week.signalsHeading}
          </h2>
          <ul className="flex flex-col gap-3">
            {week.signals.map((signal) => (
              <li
                key={`${signal.kind}-${signal.key}`}
                className="rounded border border-border bg-surface/60 px-3 py-3 text-sm"
              >
                <p className="text-foreground">{signal.summary}</p>
                <p className="mt-1 text-xs text-muted">
                  {signal.kind}
                  {signal.direction ? ` · ${signal.direction}` : ""}
                  {signal.scope ? ` · ${signal.scope}` : ""}
                </p>
                <EvidenceLinks ids={signal.evidenceBriefIds} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {week.carryForward.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted">
            {copy.week.carryHeading}
          </h2>
          <ul className="flex flex-col gap-3">
            {week.carryForward.map((item) => (
              <li
                key={item.key}
                className="rounded border border-border bg-surface/60 px-3 py-3 text-sm"
              >
                <p className="text-foreground">{item.summary}</p>
                {item.scope ? (
                  <p className="mt-1 text-xs text-muted">{item.scope}</p>
                ) : null}
                <EvidenceLinks ids={item.evidenceBriefIds} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {week.sourceBriefIds.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted">
            {copy.week.sourcesHeading}
          </h2>
          <EvidenceLinks ids={week.sourceBriefIds} />
        </section>
      ) : null}
    </main>
  );
}

function EvidenceLinks({ ids }: { ids: string[] }) {
  if (ids.length === 0) {
    return null;
  }
  return (
    <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted">
      {ids.map((id, index) => (
        <span key={id}>
          {index > 0 ? <span aria-hidden>· </span> : null}
          <Link
            href={`/brief/${encodeURIComponent(id)}`}
            className="underline decoration-border underline-offset-2 hover:text-foreground"
          >
            {id}
          </Link>
        </span>
      ))}
    </p>
  );
}
