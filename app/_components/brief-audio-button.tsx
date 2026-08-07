"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { generateBriefAudio } from "@/app/actions";
import { useRoosterFMOptional } from "@/app/_components/rooster-fm-provider";
import { copy } from "@/src/copy";

type ButtonPhase = "idle" | "generating" | "playing" | "paused";

export interface BriefAudioButtonProps {
  briefId: string;
  hasAudio: boolean;
  briefVoice?: string;
  settingsVoice: string;
}

export function BriefAudioButton({
  briefId,
  hasAudio,
  briefVoice,
  settingsVoice,
}: BriefAudioButtonProps) {
  const fm = useRoosterFMOptional();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const duckedRef = useRef(false);
  const [phase, setPhase] = useState<ButtonPhase>("idle");
  /** After on-demand generate, before router refresh picks up new brief fields. */
  const [sessionAudio, setSessionAudio] = useState<{
    briefId: string;
    voice: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sessionForBrief =
    sessionAudio?.briefId === briefId ? sessionAudio : null;
  const ready = hasAudio || sessionForBrief !== null;
  const voiceUsed = sessionForBrief?.voice ?? briefVoice;
  const needsRegenerate =
    ready && voiceUsed !== undefined && voiceUsed !== settingsVoice;

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onEnded = (): void => {
      setPhase("idle");
      if (duckedRef.current) {
        duckedRef.current = false;
        fm?.unduck();
      }
    };
    const onError = (): void => {
      setPhase("idle");
      setError("Playback failed.");
      if (duckedRef.current) {
        duckedRef.current = false;
        fm?.unduck();
      }
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
      if (duckedRef.current) {
        duckedRef.current = false;
        fm?.unduck();
      }
    };
    // Intentionally mount-once: duck helpers are stable enough for cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- crow-duck pattern
  }, []);

  const releaseDuck = (): void => {
    if (!duckedRef.current) {
      return;
    }
    duckedRef.current = false;
    fm?.unduck();
  };

  const playUrl = (url: string): void => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    fm?.duck();
    duckedRef.current = true;
    audio.setAttribute("src", url);
    setPhase("playing");
    void audio.play().catch(() => {
      setPhase("idle");
      setError("Playback blocked by the browser.");
      releaseDuck();
    });
  };

  const pause = (): void => {
    audioRef.current?.pause();
    setPhase("paused");
    releaseDuck();
  };

  const ensureAndPlay = (): void => {
    setError(null);
    const url = `/api/brief-audio/${encodeURIComponent(briefId)}`;
    if (ready && !needsRegenerate) {
      if (phase === "playing") {
        pause();
        return;
      }
      if (phase === "paused" && audioRef.current?.getAttribute("src")) {
        fm?.duck();
        duckedRef.current = true;
        setPhase("playing");
        void audioRef.current.play().catch(() => {
          setPhase("idle");
          setError("Playback blocked by the browser.");
          releaseDuck();
        });
        return;
      }
      playUrl(url);
      return;
    }

    setPhase("generating");
    startTransition(async () => {
      const result = await generateBriefAudio(briefId);
      if (!result.ok) {
        setPhase("idle");
        setError(result.error || result.message);
        return;
      }
      setSessionAudio({ briefId, voice: settingsVoice });
      playUrl(`${url}?t=${Date.now()}`);
    });
  };

  const label =
    phase === "generating" || isPending
      ? copy.latest.generatingBrief
      : phase === "playing"
        ? copy.latest.pauseBrief
        : ready && !needsRegenerate
          ? copy.latest.playBrief
          : copy.latest.generateBrief;

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={ensureAndPlay}
        disabled={phase === "generating" || isPending}
        title={label}
        aria-label={label}
        className="inline-flex size-8 items-center justify-center rounded border border-border text-muted transition hover:border-accent/50 hover:text-foreground disabled:opacity-60"
      >
        {phase === "generating" || isPending ? (
          <SpinnerIcon />
        ) : phase === "playing" ? (
          <PauseIcon />
        ) : ready && !needsRegenerate ? (
          <PlayIcon />
        ) : (
          <SpeakerIcon />
        )}
      </button>
      {error ? (
        <span className="max-w-[14rem] truncate text-xs text-danger" title={error}>
          {error}
        </span>
      ) : null}
    </span>
  );
}

function PlayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 fill-current"
      aria-hidden="true"
    >
      <path d="M8 5.14v13.72L19 12 8 5.14z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 fill-current"
      aria-hidden="true"
    >
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 fill-current"
      aria-hidden="true"
    >
      <path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 animate-spin fill-none stroke-current"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        strokeWidth="2"
        className="opacity-25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
