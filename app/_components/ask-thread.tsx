"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { BriefProse } from "@/app/_components/brief-prose";
import { copy } from "@/src/copy";
import type { ChatMessage } from "@/src/core/types";

function Provenance({
  sourceBriefIds,
  briefLabels,
}: {
  sourceBriefIds: string[];
  briefLabels: Record<string, string>;
}) {
  if (sourceBriefIds.length === 0) {
    return null;
  }

  const parts = sourceBriefIds.map((id, index) => {
    const label = briefLabels[id] ?? id;
    return (
      <span key={id}>
        {index === 0 ? null : index === sourceBriefIds.length - 1 ? " and " : ", "}
        <Link
          href={`/brief/${encodeURIComponent(id)}`}
          className="underline decoration-border underline-offset-2 hover:text-foreground"
        >
          {label}
        </Link>
      </span>
    );
  });

  return (
    <p className="mt-2 text-xs text-muted">
      Based on {parts}
    </p>
  );
}

export function AskThread({
  chatId,
  initialMessages,
  briefLabels,
  askAvailable,
}: {
  chatId: string;
  initialMessages: ChatMessage[];
  briefLabels: Record<string, string>;
  askAvailable: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Page h1 already shows the opening question — don't repeat it as a bubble.
  const visibleMessages =
    messages[0]?.role === "user" ? messages.slice(1) : messages;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || pending || !askAvailable) {
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
            chatId,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          reply?: string;
          sourceBriefIds?: string[];
          error?: string;
        };
        if (!res.ok || !data.reply) {
          setError(data.error ?? copy.ask.failed);
          return;
        }
        setMessages((prev) => [
          ...prev,
          { role: "user", content: trimmed },
          {
            role: "assistant",
            content: data.reply!,
            sourceBriefIds: data.sourceBriefIds,
          },
        ]);
        setInput("");
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.ask.failed);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {visibleMessages.length === 0 ? (
          <p className="text-sm text-muted">{copy.ask.emptyThread}</p>
        ) : (
          visibleMessages.map((message, index) => (
            <div
              key={`${message.role}-${index}-${message.content.slice(0, 24)}`}
              className={
                message.role === "user"
                  ? "rounded border border-border bg-surface/60 px-3 py-2 text-sm"
                  : "brief-prose rounded border border-border bg-surface/80 px-4 py-3 text-[15px] backdrop-blur-md"
              }
            >
              {message.role === "user" ? (
                <p className="text-foreground">{message.content}</p>
              ) : (
                <>
                  <BriefProse text={message.content} />
                  <Provenance
                    sourceBriefIds={message.sourceBriefIds ?? []}
                    briefLabels={briefLabels}
                  />
                </>
              )}
            </div>
          ))
        )}
      </div>

      {askAvailable ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={copy.ask.continuePlaceholder}
            disabled={pending}
            className="min-w-0 flex-1 rounded border border-border bg-surface-raised px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/25"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="rounded border border-accent/40 bg-accent/15 px-4 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? copy.ask.sending : copy.ask.send}
          </button>
        </form>
      ) : (
        <p className="text-xs text-muted">{copy.ask.disabledStub}</p>
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
