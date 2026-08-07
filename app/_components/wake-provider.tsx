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

interface WakeContextValue {
  isPending: boolean;
  phase: WakePhase;
  result: ActionResult | null;
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
      if (next.ok && crow) {
        crow.playWhenReady();
      }
    });
  };

  return (
    <WakeContext.Provider value={{ isPending, phase, result, wake }}>
      {children}
    </WakeContext.Provider>
  );
}

function useWake(): WakeContextValue {
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
  if (!result) {
    return null;
  }

  return (
    <div className="relative z-10 border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto w-full min-w-0 max-w-3xl px-6 py-3 text-sm">
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
    </div>
  );
}
