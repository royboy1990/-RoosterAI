import { BriefView } from "@/app/_components/brief-view";
import { DefaultsBanner } from "@/app/_components/defaults-banner";
import { WakeButton } from "@/app/_components/wake-button";
import { copy } from "@/src/copy";
import { isAskLlmAvailable } from "@/src/core/ask/availability";
import { loadRecentChats } from "@/src/core/ask/recent";
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
  const showAudioButton =
    loaded.config.ttsEnabled || Boolean(bodyBrief.audioRelativePath);
  const askAvailable = isAskLlmAvailable(loaded);
  const recentChats = await loadRecentChats(rootDir, bodyBrief.demo);

  return (
    <>
      {runningDefaults ? (
        <div className="mb-6">
          <DefaultsBanner />
        </div>
      ) : null}
      <BriefView
        brief={brief}
        bodyBrief={bodyBrief}
        title={copy.latest.title}
        showingPrior={showingPrior}
        showAudioButton={showAudioButton}
        settingsVoice={loaded.config.ttsVoice}
        askEnabled={loaded.config.askEnabled}
        askAvailable={askAvailable}
        recentChats={recentChats}
      />
    </>
  );
}
