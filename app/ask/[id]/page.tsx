import Link from "next/link";
import { notFound } from "next/navigation";
import { AskThread } from "@/app/_components/ask-thread";
import { formatBriefDateTime, formatDayHeading } from "@/app/_lib/format";
import { copy } from "@/src/copy";
import { isAskLlmAvailable } from "@/src/core/ask/availability";
import { readChat } from "@/src/core/chat-store";
import { loadConfig, resolveRootDir } from "@/src/core/config";
import { readBrief } from "@/src/core/store";
import { readWeek } from "@/src/core/week-store";

const CHAT_ID_RE = /^[A-Za-z0-9._-]+$/;

export default async function AskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId ?? "").trim();
  if (!id || !CHAT_ID_RE.test(id)) {
    notFound();
  }

  const rootDir = resolveRootDir();
  const chat = await readChat(rootDir, id);
  if (!chat) {
    notFound();
  }

  const loaded = await loadConfig({ rootDir });
  const askAvailable = isAskLlmAvailable(loaded);

  const sourceLabels: Record<string, string> = {};
  for (const briefId of chat.contextBriefIds) {
    const brief = await readBrief(rootDir, briefId);
    if (brief) {
      const label = formatBriefDateTime(brief.createdAt, brief.timezone);
      sourceLabels[`brief:${briefId}`] = label;
      sourceLabels[briefId] = label;
    }
  }
  for (const weekId of chat.contextWeeklyIds ?? []) {
    const week = await readWeek(rootDir, weekId);
    if (week) {
      const label = `Week of ${formatDayHeading(week.weekStart, week.timezone)}`;
      sourceLabels[`week:${weekId}`] = label;
      sourceLabels[weekId] = label;
    }
  }

  const sourceHref = chat.sourceBriefId
    ? `/brief/${encodeURIComponent(chat.sourceBriefId)}`
    : "/";

  const firstUser = chat.messages.find((m) => m.role === "user");
  const heading = firstUser?.content.trim() || chat.title;

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted">
          <Link href={sourceHref} className="hover:text-foreground">
            {copy.ask.backToBrief}
          </Link>
          {" · "}
          <Link href="/ask" className="hover:text-foreground">
            {copy.ask.allChats}
          </Link>
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {heading}
        </h1>
      </div>

      <AskThread
        chatId={chat.id}
        initialMessages={chat.messages}
        sourceLabels={sourceLabels}
        askAvailable={askAvailable}
      />
    </main>
  );
}
