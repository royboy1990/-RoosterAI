import { redirect } from "next/navigation";
import { DemoBanner } from "@/app/_components/demo-banner";
import { OutcomeList } from "@/app/_components/outcome-list";
import { WakeButton } from "@/app/_components/wake-button";
import { formatBriefTime } from "@/app/_lib/format";
import { copy } from "@/src/copy";
import { hasRoosterConfig, resolveRootDir } from "@/src/core/config";
import { readLatestBrief } from "@/src/core/store";

export default async function HomePage() {
  const rootDir = resolveRootDir();
  const brief = await readLatestBrief(rootDir);
  const configPresent = hasRoosterConfig(rootDir);

  // First-run: no local config yet — send them to Stock the Coop.
  // After a demo hatch, still show the brief so the escape hatch lands somewhere.
  if (!configPresent && !brief) {
    redirect("/coop");
  }

  if (!brief) {
    return (
      <main className="flex flex-1 flex-col justify-center gap-6 py-8">
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

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {copy.latest.title}
        </h1>
        <p className="metric-mono text-xs text-muted">
          {formatBriefTime(brief.createdAt, brief.timezone)} · {brief.id}
        </p>
      </div>

      {brief.demo ? <DemoBanner /> : null}
      {!configPresent ? (
        <p className="rounded border border-accent/30 bg-surface-raised px-3 py-2 text-sm text-muted">
          {copy.coop.firstRunAfterDemo}
        </p>
      ) : null}

      <article className="brief-prose rounded border border-border bg-surface px-4 py-4 text-[15px] text-foreground">
        {brief.text}
      </article>

      <OutcomeList
        outcomes={brief.outcomes}
        llmFailed={brief.llmFailed}
        llmError={brief.llmError}
      />
    </main>
  );
}
