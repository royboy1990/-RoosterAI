"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { copy } from "@/src/copy";

/**
 * Compact Peck chips. First click creates a chat; later clicks reopen that
 * same Peck + source-brief thread. Free-form Ask always starts a new thread.
 * Numbers reflect usefulness order (strongest first from generation).
 */
export function PeckChips({
  pecks,
  sourceBriefId,
  askAvailable,
}: {
  pecks: string[];
  sourceBriefId: string;
  askAvailable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activePeck, setActivePeck] = useState<string | null>(null);

  if (pecks.length === 0) {
    return null;
  }

  function onPeck(question: string) {
    if (!askAvailable || pending) {
      return;
    }
    setError(null);
    setActivePeck(question);
    startTransition(async () => {
      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: question,
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
          setActivePeck(null);
          return;
        }
        router.push(`/ask/${encodeURIComponent(data.chatId)}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.ask.failed);
        setActivePeck(null);
      }
    });
  }

  const gridClass =
    pecks.length === 3
      ? "grid grid-cols-1 gap-2 sm:grid-cols-3"
      : "grid grid-cols-1 gap-2 sm:grid-cols-2";

  return (
    <div className="flex flex-col gap-2">
      <ul className={gridClass}>
        {pecks.map((peck, index) => {
          const isActive = pending && activePeck === peck;
          const isDimmed = pending && activePeck !== peck;
          const label = String(index + 1).padStart(2, "0");
          return (
            <li key={peck} className="min-w-0">
              <button
                type="button"
                disabled={!askAvailable || pending}
                onClick={() => onPeck(peck)}
                title={askAvailable ? peck : copy.ask.disabledStub}
                className={`group flex h-full w-full items-start gap-2.5 rounded border border-border border-l-2 border-l-border bg-surface-raised/60 px-3 py-2 text-left text-sm leading-snug text-foreground transition duration-200 ease-out hover:-translate-y-px hover:border-accent/40 hover:border-l-accent hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${
                  isActive ? "border-accent/50 border-l-accent bg-accent/10" : ""
                } ${isDimmed ? "opacity-40" : ""}`}
              >
                <span
                  className="metric-mono mt-0.5 shrink-0 text-[10px] text-muted transition group-hover:text-accent"
                  aria-hidden="true"
                >
                  {label}
                </span>
                <span className="min-w-0">
                  {isActive ? copy.ask.sending : peck}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

/** @deprecated Use PeckChips — kept as alias for any leftover imports */
export const PecksRow = PeckChips;
