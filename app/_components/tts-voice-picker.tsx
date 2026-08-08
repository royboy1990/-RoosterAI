"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { useRoosterFMOptional } from "@/app/_components/rooster-fm-provider";
import { copy } from "@/src/copy";
import { TTS_VOICES, type TtsVoice } from "@/src/core/tts/voices";

/** Session cache so re-previewing a voice does not rebill. */
const previewBlobCache = new Map<string, string>();

function previewCacheKey(voice: TtsVoice, operatorName: string): string {
  return `${voice}\0${operatorName.trim()}`;
}

export interface TtsVoicePickerProps {
  value: TtsVoice;
  disabled?: boolean;
  /** Saved operator name — preview says "Good morning, Name." when set. */
  operatorName?: string;
  onChange: (voice: TtsVoice) => void;
}

type PreviewPhase = "idle" | "loading" | "playing";

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4 shrink-0 text-muted"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M4.2 6.2a.75.75 0 0 1 1.06 0L8 8.94l2.74-2.74a.75.75 0 1 1 1.06 1.06l-3.27 3.27a.75.75 0 0 1-1.06 0L4.2 7.26a.75.75 0 0 1 0-1.06Z"
      />
      <path
        fill="currentColor"
        d="M4.2 10.2a.75.75 0 0 1 1.06 0L8 12.94l2.74-2.74a.75.75 0 1 1 1.06 1.06l-3.27 3.27a.75.75 0 0 1-1.06 0L4.2 11.26a.75.75 0 0 1 0-1.06Z"
        opacity="0.55"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5 shrink-0 text-foreground"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M6.4 11.6 3.2 8.4l1.1-1.1 2.1 2.1 5.3-5.3 1.1 1.1-6.4 6.4Z"
      />
    </svg>
  );
}

/** Play triangle, or stop square with circular progress ring while playing/loading. */
function PreviewGlyph({
  phase,
  progress,
}: {
  phase: PreviewPhase;
  progress: number;
}) {
  const r = 7;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = c * (1 - clamped);

  if (phase === "idle") {
    return (
      <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
        <circle
          cx="10"
          cy="10"
          r="8.25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          opacity="0.55"
        />
        <path fill="currentColor" d="M8.2 6.4v7.2L14.2 10 8.2 6.4Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
      <circle
        cx="10"
        cy="10"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.25"
      />
      <g
        className={phase === "loading" ? "animate-spin" : undefined}
        style={{ transformOrigin: "10px 10px" }}
      >
        <circle
          cx="10"
          cy="10"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={phase === "loading" ? c * 0.72 : offset}
          transform="rotate(-90 10 10)"
        />
      </g>
      <rect
        x="7.25"
        y="7.25"
        width="5.5"
        height="5.5"
        rx="0.6"
        fill="currentColor"
      />
    </svg>
  );
}

export function TtsVoicePicker({
  value,
  disabled = false,
  operatorName = "",
  onChange,
}: TtsVoicePickerProps) {
  const fm = useRoosterFMOptional();
  const fmRef = useRef(fm);
  fmRef.current = fm;
  const nameForPreview = operatorName.trim();

  const listId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLUListElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const duckedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [previewVoice, setPreviewVoice] = useState<TtsVoice | null>(null);
  const [previewPhase, setPreviewPhase] = useState<PreviewPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const releaseDuck = useCallback(() => {
    if (!duckedRef.current) {
      return;
    }
    duckedRef.current = false;
    fmRef.current?.unduck();
  }, []);

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    releaseDuck();
  }, [releaseDuck]);

  const stopPreview = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopPlayback();
    setPreviewVoice(null);
    setPreviewPhase("idle");
    setProgress(0);
  }, [stopPlayback]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onEnded = (): void => {
      setPreviewVoice(null);
      setPreviewPhase("idle");
      setProgress(0);
      releaseDuck();
    };
    const onError = (): void => {
      setPreviewError(copy.settings.ttsVoicePreviewFailed);
      setPreviewVoice(null);
      setPreviewPhase("idle");
      setProgress(0);
      releaseDuck();
    };
    const onTimeUpdate = (): void => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
        return;
      }
      setProgress(audio.currentTime / audio.duration);
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      abortRef.current?.abort();
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
      if (duckedRef.current) {
        duckedRef.current = false;
        fmRef.current?.unduck();
      }
    };
    // Mount-once: duck() updates FM context and must not recreate this element.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- crow-duck pattern
  }, []);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setMenuStyle(null);
    stopPreview();
  }, [stopPreview]);

  const syncMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const maxHeight = 288; // max-h-72
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUpward = spaceBelow < Math.min(maxHeight, 200) && spaceAbove > spaceBelow;
    const height = Math.min(maxHeight, openUpward ? spaceAbove : spaceBelow);
    const width = Math.max(rect.width, 288);

    setMenuStyle({
      position: "fixed",
      left: Math.min(rect.left, window.innerWidth - width - 8),
      width,
      maxHeight: height,
      zIndex: 80,
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    syncMenuPosition();
    const onReposition = (): void => {
      syncMenuPosition();
    };
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, syncMenuPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    };
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeMenu]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
      stopPreview();
    }
  }, [disabled, stopPreview]);

  const playBlob = useCallback(
    async (voice: TtsVoice, blobUrl: string) => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      audio.src = blobUrl;
      setPreviewVoice(voice);
      setPreviewPhase("playing");
      setProgress(0);
      fmRef.current?.duck();
      duckedRef.current = true;
      try {
        await audio.play();
      } catch {
        setPreviewError(copy.settings.ttsVoicePreviewFailed);
        stopPreview();
      }
    },
    [stopPreview],
  );

  const startPreview = useCallback(
    async (voice: TtsVoice) => {
      setPreviewError(null);
      stopPlayback();

      const cacheKey = previewCacheKey(voice, nameForPreview);
      const cached = previewBlobCache.get(cacheKey);
      if (cached) {
        await playBlob(voice, cached);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setPreviewVoice(voice);
      setPreviewPhase("loading");
      setProgress(0);

      try {
        const params = new URLSearchParams({ voice });
        if (nameForPreview) {
          params.set("name", nameForPreview);
        }
        const res = await fetch(`/api/tts-voice-preview?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          let detail: string = copy.settings.ttsVoicePreviewFailed;
          try {
            const body = (await res.json()) as { error?: string };
            if (body.error) {
              detail = body.error;
            }
          } catch {
            // keep default
          }
          throw new Error(detail);
        }
        const blob = await res.blob();
        if (controller.signal.aborted) {
          return;
        }
        const url = URL.createObjectURL(blob);
        const previous = previewBlobCache.get(cacheKey);
        if (previous) {
          URL.revokeObjectURL(previous);
        }
        previewBlobCache.set(cacheKey, url);
        await playBlob(voice, url);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          err instanceof Error ? err.message : copy.settings.ttsVoicePreviewFailed;
        setPreviewError(message);
        stopPreview();
      }
    },
    [nameForPreview, playBlob, stopPlayback, stopPreview],
  );

  const onPreviewClick = (
    event: MouseEvent<HTMLButtonElement>,
    voice: TtsVoice,
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) {
      return;
    }
    if (previewVoice === voice && previewPhase !== "idle") {
      stopPreview();
      return;
    }
    void startPreview(voice);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (disabled) {
      return;
    }
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div ref={rootRef} className="relative w-full max-w-sm">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) {
            return;
          }
          if (open) {
            closeMenu();
          } else {
            setOpen(true);
          }
        }}
        onKeyDown={onTriggerKeyDown}
        className="flex w-full min-w-[18rem] items-center justify-between gap-3 rounded border border-border bg-background px-3 py-2 text-left text-foreground capitalize disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span>{value}</span>
        <ChevronIcon />
      </button>

      {open && menuStyle
        ? createPortal(
            <ul
              ref={menuRef}
              id={listId}
              role="listbox"
              aria-label={copy.settings.ttsVoice}
              style={menuStyle}
              className="overflow-y-auto rounded-md border border-border bg-surface-raised py-1 shadow-lg"
            >
              {TTS_VOICES.map((voice) => {
                const selected = voice === value;
                const isActivePreview =
                  previewVoice === voice && previewPhase !== "idle";
                return (
                  <li
                    key={voice}
                    role="option"
                    aria-selected={selected}
                    className={
                      selected
                        ? "flex items-center gap-2 bg-foreground/10 px-2 py-1.5"
                        : "flex items-center gap-2 px-2 py-1.5 hover:bg-foreground/5"
                    }
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 text-left capitalize text-foreground"
                      onClick={() => {
                        onChange(voice);
                        closeMenu();
                      }}
                    >
                      <span className="flex w-3.5 shrink-0 justify-center">
                        {selected ? <CheckIcon /> : null}
                      </span>
                      <span className="truncate">{voice}</span>
                    </button>
                    <button
                      type="button"
                      title={
                        isActivePreview
                          ? copy.settings.ttsVoicePreviewStop
                          : copy.settings.ttsVoicePreviewPlay
                      }
                      aria-label={
                        isActivePreview
                          ? copy.settings.ttsVoicePreviewStopNamed(voice)
                          : copy.settings.ttsVoicePreviewPlayNamed(voice)
                      }
                      disabled={disabled}
                      onClick={(event) => {
                        onPreviewClick(event, voice);
                      }}
                      className="shrink-0 rounded-full p-0.5 text-muted hover:text-foreground disabled:cursor-not-allowed"
                    >
                      <PreviewGlyph
                        phase={isActivePreview ? previewPhase : "idle"}
                        progress={isActivePreview ? progress : 0}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}

      {previewError ? (
        <p className="mt-1 text-xs text-danger">{previewError}</p>
      ) : null}
    </div>
  );
}
