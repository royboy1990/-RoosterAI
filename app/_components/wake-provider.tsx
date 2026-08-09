"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import { wakeTheFlock } from "@/app/actions";
import type { ActionResult } from "@/app/_lib/action-result";
import { ErrorDetails } from "@/app/_components/error-details";
import { useRoosterFMOptional } from "@/app/_components/rooster-fm-provider";
import { copy } from "@/src/copy";

type WakePhase = "idle" | "gather" | "llm";

/** One-shot mascot cue — new id per finished Wake; do not key off sticky `result`. */
export type WakeMascotEvent = {
  id: string;
  outcome: "success" | "failure";
  message?: string;
};

interface WakeContextValue {
  isPending: boolean;
  phase: WakePhase;
  result: ActionResult | null;
  /** Latest finished Wake attempt for the companion; null until first finish. */
  mascotEvent: WakeMascotEvent | null;
  wake: (options?: { demo?: boolean }) => void;
}

const WakeContext = createContext<WakeContextValue | null>(null);

/** Unlock audio during the click gesture so we can crow when delivery finishes. */
function prepareCrow(options: {
  duck: () => void;
  unduck: () => void;
}): { playWhenReady: () => void } {
  const crow = new Audio("/sounds/wake-the-flock-up.mp3");
  crow.preload = "auto";
  crow.muted = true;

  let unlocked = false;
  let wantsPlay = false;
  let ducked = false;

  const releaseDuck = () => {
    if (!ducked) {
      return;
    }
    ducked = false;
    options.unduck();
  };

  crow.addEventListener("ended", releaseDuck);
  crow.addEventListener("error", releaseDuck);

  const startCrow = () => {
    crow.muted = false;
    crow.currentTime = 0;
    options.duck();
    ducked = true;
    void crow.play().catch(() => {
      // Browser may still block; wake result still shows.
      releaseDuck();
    });
  };

  void crow
    .play()
    .then(() => {
      crow.pause();
      crow.currentTime = 0;
      crow.muted = false;
      unlocked = true;
      if (wantsPlay) {
        wantsPlay = false;
        startCrow();
      }
    })
    .catch(() => {
      crow.muted = false;
      unlocked = true;
      if (wantsPlay) {
        wantsPlay = false;
        startCrow();
      }
    });

  return {
    playWhenReady: () => {
      if (!unlocked) {
        wantsPlay = true;
        return;
      }
      startCrow();
    },
  };
}

export function WakeProvider({
  children,
  wakeSound = true,
}: {
  children: ReactNode;
  wakeSound?: boolean;
}) {
  const fm = useRoosterFMOptional();
  const duck = fm?.duck ?? (() => undefined);
  const unduck = fm?.unduck ?? (() => undefined);
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<WakePhase>("idle");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [mascotEvent, setMascotEvent] = useState<WakeMascotEvent | null>(null);

  useEffect(() => {
    if (!isPending) {
      setPhase("idle");
      return;
    }
    setPhase("gather");
    const timer = window.setTimeout(() => setPhase("llm"), 2200);
    return () => window.clearTimeout(timer);
  }, [isPending]);

  const wake = (options: { demo?: boolean } = {}): void => {
    const crow = wakeSound ? prepareCrow({ duck, unduck }) : null;

    setResult(null);
    startTransition(async () => {
      const next = await wakeTheFlock({ demo: options.demo });
      setResult(next);
      setMascotEvent({
        id: crypto.randomUUID(),
        outcome: next.ok ? "success" : "failure",
        message: next.ok ? undefined : next.message,
      });
      if (next.ok && crow) {
        crow.playWhenReady();
      }
    });
  };

  return (
    <WakeContext.Provider
      value={{ isPending, phase, result, mascotEvent, wake }}
    >
      {children}
    </WakeContext.Provider>
  );
}

export function useWake(): WakeContextValue {
  const ctx = useContext(WakeContext);
  if (!ctx) {
    throw new Error("useWake must be used within WakeProvider");
  }
  return ctx;
}

export function WakeButton({ demo = false }: { demo?: boolean }) {
  const { isPending, phase, wake } = useWake();
  const pendingLabel =
    phase === "llm" ? copy.pendingLlm : copy.pendingGather;
  const label = isPending ? pendingLabel : copy.wakeAction;

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => wake({ demo })}
      className="inline-grid rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-accent-dim disabled:cursor-wait disabled:opacity-80"
    >
      {/* Size to the longest label so the button doesn't grow while pending. */}
      <span className="invisible col-start-1 row-start-1 whitespace-nowrap" aria-hidden>
        {copy.pendingGather}
      </span>
      <span className="col-start-1 row-start-1 whitespace-nowrap">{label}</span>
    </button>
  );
}

export function WakeResultBanner() {
  const { result } = useWake();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
    if (!result?.ok) {
      return;
    }
    const timer = window.setTimeout(() => setDismissed(true), 30_000);
    return () => window.clearTimeout(timer);
  }, [result]);

  if (!result || dismissed) {
    return null;
  }

  return (
    <div className="relative z-10 border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex w-full min-w-0 max-w-3xl items-start gap-3 px-6 py-3 text-sm">
        <div className="min-w-0 flex-1">
          {result.ok ? (
            <p className="text-ok">
              {copy.wake.successBefore}
              <Link
                href="/"
                className="underline decoration-current underline-offset-2 hover:decoration-accent"
              >
                {copy.wake.successLink}
              </Link>
              {copy.wake.successAfter}
            </p>
          ) : (
            <>
              <p className="text-danger">{result.message}</p>
              <ErrorDetails error={result.error} />
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={copy.wake.dismiss}
          className="mt-0.5 shrink-0 rounded p-0.5 text-muted transition hover:bg-border/40 hover:text-foreground"
        >
          <svg
            viewBox="0 0 12 12"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
