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
import { copy } from "@/src/copy";

type WakePhase = "idle" | "gather" | "llm";

interface WakeContextValue {
  isPending: boolean;
  phase: WakePhase;
  result: ActionResult | null;
  wake: (options?: { demo?: boolean }) => void;
}

const WakeContext = createContext<WakeContextValue | null>(null);

export function WakeProvider({ children }: { children: ReactNode }) {
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
    const crow = new Audio("/sounds/wake-the-flock-up.mp3");
    void crow.play().catch(() => {
      // Browser may block playback; wake still proceeds.
    });

    setResult(null);
    startTransition(async () => {
      const next = await wakeTheFlock({ demo: options.demo });
      setResult(next);
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

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => wake({ demo })}
      className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-accent-dim disabled:cursor-wait disabled:opacity-80"
    >
      {isPending ? pendingLabel : copy.wakeAction}
    </button>
  );
}

export function WakeResultBanner() {
  const { result } = useWake();
  if (!result) {
    return null;
  }

  return (
    <div className="border-b border-border bg-surface">
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
