import Link from "next/link";
import { formatBriefDateTime } from "@/app/_lib/format";
import { copy } from "@/src/copy";
import { loadRecentChats } from "@/src/core/ask/recent";
import { loadConfig, resolveRootDir } from "@/src/core/config";
import { readLatestBrief, resolveSubstantiveBrief } from "@/src/core/store";

export default async function AskIndexPage() {
  const rootDir = resolveRootDir();
  const loaded = await loadConfig({ rootDir });
  const latest = await readLatestBrief(rootDir);
  const demo = latest
    ? (await resolveSubstantiveBrief(rootDir, latest)).demo
    : false;
  const chats = await loadRecentChats(rootDir, demo, 40);

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {copy.ask.chatsTitle}
        </h1>
        <p className="text-sm text-muted">{copy.ask.chatsBlurb}</p>
        <p className="text-xs text-muted">
          <Link href="/" className="hover:text-foreground">
            {copy.nav.latest}
          </Link>
        </p>
      </div>

      {chats.length === 0 ? (
        <p className="text-sm text-muted">{copy.ask.recentEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {chats.map((chat) => (
            <li key={chat.id}>
              <Link
                href={`/ask/${encodeURIComponent(chat.id)}`}
                className="flex flex-col gap-1 rounded border border-border bg-surface/80 px-3 py-3 transition hover:border-accent/40"
              >
                <span className="truncate text-sm text-foreground">
                  {chat.title}
                </span>
                <span className="metric-mono text-[10px] text-muted">
                  {formatBriefDateTime(
                    chat.createdAt,
                    loaded.config.timezone,
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
