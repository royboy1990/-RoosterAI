import { notFound } from "next/navigation";
import { BriefView } from "@/app/_components/brief-view";
import { copy } from "@/src/copy";
import { isAskLlmAvailable } from "@/src/core/ask/availability";
import { loadRecentChats } from "@/src/core/ask/recent";
import { loadConfig, resolveRootDir } from "@/src/core/config";
import { readBrief, resolveSubstantiveBrief } from "@/src/core/store";

/** Brief ids are ISO stems with digits, letters, T, Z, dots, and hyphens. */
const BRIEF_ID_RE = /^[A-Za-z0-9._-]+$/;

export default async function BriefByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId ?? "").trim();
  if (!id || !BRIEF_ID_RE.test(id)) {
    notFound();
  }

  const rootDir = resolveRootDir();
  const brief = await readBrief(rootDir, id);
  if (!brief) {
    notFound();
  }

  const loaded = await loadConfig({ rootDir });
  const bodyBrief = await resolveSubstantiveBrief(rootDir, brief);
  const showingPrior =
    brief.wakeMode === "unchanged" && bodyBrief.id !== brief.id;
  const showAudioButton =
    loaded.config.ttsEnabled || Boolean(bodyBrief.audioRelativePath);
  const askAvailable = isAskLlmAvailable(loaded);
  const recentChats = await loadRecentChats(rootDir, bodyBrief.demo);

  return (
    <BriefView
      brief={brief}
      bodyBrief={bodyBrief}
      title={copy.brief.title}
      showingPrior={showingPrior}
      showAudioButton={showAudioButton}
      settingsVoice={loaded.config.ttsVoice}
      askEnabled={loaded.config.askEnabled}
      askAvailable={askAvailable}
      recentChats={recentChats}
    />
  );
}
