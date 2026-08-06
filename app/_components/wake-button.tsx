"use client";

import { useEffect, useState, useTransition } from "react";
import { wakeTheFlock, type ActionResult } from "@/app/actions";
import { copy } from "@/src/copy";

export function WakeButton({ demo = false }: { demo?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<"idle" | "gather" | "llm">("idle");
  const [result, setResult] = useState<ActionResult | null>(null);

  useEffect(() => {
    if (!isPending) {
      setPhase("idle");
      return;
    }
    setPhase("gather");
    const timer = window.setTimeout(() => setPhase("llm"), 2200);
    return () => window.clearTimeout(timer);
  }, [isPending]);

  const pendingLabel =
    phase === "llm" ? copy.pendingLlm : copy.pendingGather;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setResult(null);
          startTransition(async () => {
            const next = await wakeTheFlock({ demo });
            setResult(next);
          });
        }}
        className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-accent-dim disabled:cursor-wait disabled:opacity-80"
      >
        {isPending ? pendingLabel : copy.wakeAction}
      </button>
      {result ? (
        <div className="text-sm">
          <p className={result.ok ? "text-ok" : "text-danger"}>
            {result.message}
          </p>
          {!result.ok ? (
            <details className="mt-1 text-muted">
              <summary className="cursor-pointer text-foreground/80">
                {copy.latest.errorDetailsSummary}
              </summary>
              <pre className="metric-mono mt-2 overflow-x-auto whitespace-pre-wrap rounded border border-border bg-surface p-2 text-xs text-danger">
                {result.error}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
