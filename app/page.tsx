import { BriefProse } from "@/app/_components/brief-prose";
import { DefaultsBanner } from "@/app/_components/defaults-banner";
import { DemoBanner } from "@/app/_components/demo-banner";
import { OutcomeList } from "@/app/_components/outcome-list";
import { WakeButton } from "@/app/_components/wake-button";
import { formatBriefTime } from "@/app/_lib/format";
import { copy } from "@/src/copy";
import { loadConfig, resolveRootDir } from "@/src/core/config";
import { readLatestBrief, resolveSubstantiveBrief } from "@/src/core/store";

export default async function HomePage() {
  const rootDir = resolveRootDir();
  const brief = await readLatestBrief(rootDir);
  const loaded = await loadConfig({ rootDir });
  const runningDefaults = loaded.source === "defaults";

  if (!brief) {
    return (
      <main className="flex flex-1 flex-col justify-center gap-6 py-8">
        {runningDefaults ? <DefaultsBanner /> : null}
        <p className="metric-mono text-sm text-accent">{copy.brand}</p>
        <h1 className="max-w-xl text-3xl font-semibold tracking-tight">
          {copy.emptyCoop}
        </h1>
        <p className="text-muted">{copy.emptyCoopHint}</p>
        <div className="max-w-xs">
          <WakeButton />
        </div>
      </main>
    );
  }

  const bodyBrief = await resolveSubstantiveBrief(rootDir, brief);
  const showingPrior =
    brief.wakeMode === "unchanged" && bodyBrief.id !== brief.id;

  return (
    <main className="flex flex-col gap-6">
      {runningDefaults ? <DefaultsBanner /> : null}

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {copy.latest.title}
        </h1>
        <p className="metric-mono text-xs text-muted">
          {formatBriefTime(brief.createdAt, brief.timezone)} · {brief.id}
        </p>
        {showingPrior ? (
          <p className="text-sm text-muted">
            {copy.latest.unchangedNotice(
              formatBriefTime(bodyBrief.createdAt, bodyBrief.timezone),
            )}
          </p>
        ) : null}
      </div>

      {bodyBrief.demo ? <DemoBanner /> : null}

      <article className="brief-prose rounded border border-border bg-surface/80 px-4 py-4 text-[15px] text-foreground backdrop-blur-md">
        <BriefProse text={bodyBrief.text} />
      </article>

      <OutcomeList
        outcomes={brief.outcomes}
        llmFailed={brief.llmFailed}
        llmError={brief.llmError}
      />
    </main>
  );
}
