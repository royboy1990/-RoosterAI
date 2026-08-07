"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveWakeSound } from "@/app/actions";
import type { ActionResult } from "@/app/_lib/action-result";
import { ErrorDetails } from "@/app/_components/error-details";
import { useRoosterFM } from "@/app/_components/rooster-fm-provider";
import { copy } from "@/src/copy";

export function AudioPreferences({ wakeSound }: { wakeSound: boolean }) {
  const router = useRouter();
  const { startOnLoad, setStartOnLoad } = useRoosterFM();
  const [crowEnabled, setCrowEnabled] = useState(wakeSound);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  useEffect(() => {
    setCrowEnabled(wakeSound);
  }, [wakeSound]);

  return (
    <section className="flex flex-col gap-4 rounded border border-accent/25 bg-surface-raised/80 p-4 backdrop-blur-md">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium text-foreground">
          {copy.settings.audioHeading}
        </h2>
        <p className="text-sm text-muted">{copy.settings.audioBlurb}</p>
      </div>

      <div className="flex flex-col gap-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={crowEnabled}
            disabled={isPending}
            onChange={(event) => {
              const next = event.target.checked;
              setCrowEnabled(next);
              setResult(null);
              startTransition(async () => {
                const saved = await saveWakeSound(next);
                setResult(saved);
                if (saved.ok) {
                  router.refresh();
                } else {
                  setCrowEnabled(!next);
                }
              });
            }}
            className="mt-1 accent-[var(--accent)]"
          />
          <span className="flex flex-col gap-1">
            <span className="font-medium text-foreground">
              {copy.settings.wakeSound}
            </span>
            <span className="text-muted">{copy.settings.wakeSoundHint}</span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={startOnLoad}
            onChange={(event) => setStartOnLoad(event.target.checked)}
            className="mt-1 accent-[var(--accent)]"
          />
          <span className="flex flex-col gap-1">
            <span className="font-medium text-foreground">
              {copy.settings.startMusicOnLoad}
            </span>
            <span className="text-muted">
              {copy.settings.startMusicOnLoadHint}
            </span>
          </span>
        </label>

        <p className="text-xs text-muted">{copy.settings.libraryDockHint}</p>
      </div>

      {result ? (
        <div className="min-w-0 text-sm">
          <p className={result.ok ? "text-ok" : "text-danger"}>
            {result.message}
          </p>
          {!result.ok ? <ErrorDetails error={result.error} /> : null}
        </div>
      ) : null}
    </section>
  );
}
