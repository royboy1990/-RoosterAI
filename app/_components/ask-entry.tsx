"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { PeckChips } from "@/app/_components/pecks-row";
import { formatBriefDateTime } from "@/app/_lib/format";
import { copy } from "@/src/copy";

/**
 * Single dig-in composition: optional Pecks + Ask composer.
 * Pecks are the primary heading; free-form Ask is secondary.
 * Recent chats render separately and hide when empty.
 */
export function AskDigIn({
  pecks,
  sourceBriefId,
  askAvailable,
  askEnabled,
}: {
  pecks: string[];
  sourceBriefId: string;
  askAvailable: boolean;
  askEnabled: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const showPecks = pecks.length > 0 && askEnabled;
  const canCompose = askEnabled && askAvailable;

  if (!askEnabled && pecks.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">{copy.ask.heading}</h2>
        <p className="text-xs text-muted">{copy.ask.disabledConfig}</p>
      </section>
    );
  }

  if (!askAvailable && pecks.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">{copy.ask.heading}</h2>
        <p className="text-xs text-muted">{copy.ask.disabledStub}</p>
      </section>
    );
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || pending || !canCompose) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            sourceBriefId,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          chatId?: string;
          error?: string;
        };
        if (!res.ok || !data.chatId) {
          setError(data.error ?? copy.ask.failed);
          return;
        }
        setMessage("");
        router.push(`/ask/${encodeURIComponent(data.chatId)}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.ask.failed);
      }
    });
  }

  const heading = showPecks ? copy.pecks.heading : copy.ask.heading;
  const hint = showPecks ? copy.pecks.hint : copy.ask.hint;

  return (
    <section className="flex flex-col gap-4 rounded border border-border/80 bg-surface/50 px-4 py-4 backdrop-blur-md">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-medium tracking-tight text-foreground">
          {heading}
        </h2>
        <p className="text-xs text-muted">{hint}</p>
      </div>

      {showPecks ? (
        <PeckChips
          pecks={pecks}
          sourceBriefId={sourceBriefId}
          askAvailable={askAvailable}
        />
      ) : null}

      {!askEnabled ? (
        <p className="text-xs text-muted">{copy.ask.disabledConfig}</p>
      ) : !askAvailable ? (
        <p className="text-xs text-muted">{copy.ask.disabledStub}</p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          {showPecks ? (
            <p className="metric-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              {copy.ask.ownLabel}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={copy.ask.placeholder}
              disabled={pending}
              className="min-w-0 flex-1 rounded border border-border bg-surface-raised px-3 py-2.5 text-sm text-foreground placeholder:text-muted shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] transition focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/25"
            />
            <button
              type="submit"
              disabled={pending || !message.trim()}
              className="rounded border border-accent/40 bg-accent/15 px-4 py-2.5 text-sm font-medium text-accent transition duration-200 hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-50 sm:shrink-0"
            >
              {pending ? copy.ask.sending : copy.ask.send}
            </button>
          </div>
        </form>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </section>
  );
}

export function RecentChats({
  chats,
  timezone,
}: {
  chats: { id: string; title: string; createdAt: string }[];
  timezone: string;
}) {
  if (chats.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-muted">
          {copy.ask.recentHeading}
        </h2>
        <Link
          href="/ask"
          className="text-xs text-muted transition hover:text-foreground"
        >
          {copy.ask.allChats}
        </Link>
      </div>
      <ul className="flex flex-col gap-1.5">
        {chats.map((chat, index) => (
          <li
            key={chat.id}
            className="animate-[ask-row-in_280ms_ease-out_both]"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <Link
              href={`/ask/${encodeURIComponent(chat.id)}`}
              className="flex flex-col gap-0.5 rounded border border-border bg-surface/60 px-3 py-2 transition duration-200 hover:-translate-y-px hover:border-accent/40"
            >
              <span className="truncate text-sm text-foreground">
                {chat.title}
              </span>
              <span className="metric-mono text-[10px] text-muted">
                {formatBriefDateTime(chat.createdAt, timezone)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
