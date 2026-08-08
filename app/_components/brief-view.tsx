import { AskDigIn, RecentChats } from "@/app/_components/ask-entry";
import { BriefAudioButton } from "@/app/_components/brief-audio-button";
import { BriefCostLine } from "@/app/_components/brief-cost-line";
import { BriefProse } from "@/app/_components/brief-prose";
import { DemoBanner } from "@/app/_components/demo-banner";
import { OutcomeList } from "@/app/_components/outcome-list";
import { formatBriefDateTime, formatBriefTime } from "@/app/_lib/format";
import { copy } from "@/src/copy";
import type { BriefRecord } from "@/src/core/types";
import type { TtsVoice } from "@/src/core/tts/voices";

export interface RecentChatSummary {
  id: string;
  title: string;
  createdAt: string;
}

/**
 * Shared brief page body for Latest and /brief/[id].
 * Pecks come from bodyBrief (unchanged wakes resolve to the substantive body).
 * Outcomes stay on the wake record being viewed (`brief`).
 */
export function BriefView({
  brief,
  bodyBrief,
  title,
  showingPrior,
  showAudioButton,
  settingsVoice,
  askEnabled,
  askAvailable,
  recentChats,
}: {
  brief: BriefRecord;
  bodyBrief: BriefRecord;
  title: string;
  showingPrior: boolean;
  showAudioButton: boolean;
  settingsVoice: TtsVoice;
  askEnabled: boolean;
  askAvailable: boolean;
  recentChats: RecentChatSummary[];
}) {
  const pecks = bodyBrief.pecks ?? [];

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <p className="metric-mono text-xs text-muted">
            {formatBriefDateTime(brief.createdAt, brief.timezone)}
          </p>
          {showAudioButton ? (
            <BriefAudioButton
              key={bodyBrief.id}
              briefId={bodyBrief.id}
              hasAudio={Boolean(bodyBrief.audioRelativePath)}
              briefVoice={bodyBrief.ttsVoice}
              settingsVoice={settingsVoice}
            />
          ) : null}
        </div>
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

      <BriefCostLine usage={bodyBrief.usage ?? brief.usage} />

      <AskDigIn
        pecks={pecks}
        sourceBriefId={bodyBrief.id}
        askAvailable={askAvailable}
        askEnabled={askEnabled}
      />

      <RecentChats chats={recentChats} timezone={brief.timezone} />

      <OutcomeList
        outcomes={brief.outcomes}
        llmFailed={brief.llmFailed}
        llmError={brief.llmError}
      />
    </main>
  );
}
