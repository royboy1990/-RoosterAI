"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRoosterFM } from "@/app/_components/rooster-fm-provider";
import { copy } from "@/src/copy";
import { roosterFmPlaylist } from "@/src/rooster-fm/playlist";

function IconButton({
  label,
  onClick,
  pressed,
  danger,
  accent,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  danger?: boolean;
  accent?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40 ${
        accent
          ? "border-accent bg-accent text-background hover:bg-accent-dim"
          : danger
            ? "border-border text-muted hover:border-danger/50 hover:text-danger"
            : "border-border text-muted hover:border-accent/40 hover:text-foreground"
      } ${pressed ? "border-accent/50 text-accent" : ""}`}
    >
      {children}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5" aria-hidden>
      <path d="M4.5 2.8v10.4L13 8 4.5 2.8Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5" aria-hidden>
      <rect x="3.5" y="3" width="3" height="10" rx="0.5" />
      <rect x="9.5" y="3" width="3" height="10" rx="0.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
      <path
        d="M8 3.5v9M3.5 8h9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
      <path
        d="M3.5 4.5h9M6 4.5V3.5h4v1M5.5 4.5l.5 8h4l.5-8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VisualsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
      <path
        d="M3 10.5V8M6.5 12V5.5M10 10.5V7M13 11.5V4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
      <path
        d="M3.5 8a4.5 4.5 0 1 0 1.3-3.15M3.5 3.5v3h3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RoosterFmDock() {
  const {
    isPlaying,
    track,
    volume,
    visualsEnabled,
    libraryMessage,
    hiddenBuiltinIds,
    toggle,
    next,
    prev,
    setVolume,
    toggleVisuals,
    addLocalFiles,
    removeTrack,
    restoreBuiltinTrack,
    clearLibraryMessage,
  } = useRoosterFM();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!libraryMessage) {
      return;
    }
    const timer = window.setTimeout(() => clearLibraryMessage(), 4200);
    return () => window.clearTimeout(timer);
  }, [libraryMessage, clearLibraryMessage]);

  const title = track?.title ?? copy.roosterFm.idleTrack;
  const artist = track?.artist ?? copy.brand;
  const canRemove = Boolean(track);
  const hiddenSeed = roosterFmPlaylist.find((entry) =>
    hiddenBuiltinIds.includes(entry.id),
  );

  const onFiles = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) {
      return;
    }
    void addLocalFiles(files);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) {
            return;
          }
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          onFiles(event.dataTransfer.files);
        }}
        className={`pointer-events-auto mx-auto mb-3 w-[min(100%-1.5rem,42rem)] rounded-lg border px-3 py-2.5 shadow-lg shadow-black/30 backdrop-blur-md transition ${
          dragging
            ? "border-accent bg-surface/90"
            : "border-border bg-surface/80"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.ogg,.wav,.flac"
          multiple
          className="hidden"
          onChange={(event) => {
            onFiles(event.target.files);
            event.target.value = "";
          }}
        />

        <div className="flex flex-nowrap items-center gap-2.5">
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={prev}
              aria-label={copy.roosterFm.prev}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted transition hover:bg-surface-raised hover:text-foreground"
            >
              ‹
            </button>
            <IconButton
              label={isPlaying ? copy.roosterFm.pause : copy.roosterFm.play}
              onClick={toggle}
              accent
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
            <button
              type="button"
              onClick={next}
              aria-label={copy.roosterFm.next}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted transition hover:bg-surface-raised hover:text-foreground"
            >
              ›
            </button>
          </div>

          {/* Fixed track column so title length doesn't shove volume/actions. */}
          <div className="min-w-0 w-[11rem] shrink-0 sm:w-[14rem]">
            <p className="truncate text-sm font-medium text-foreground">
              {title}
            </p>
            <p className="truncate text-xs text-muted">
              {dragging ? copy.roosterFm.dropHint : artist}
            </p>
          </div>

          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted">
            <span className="sr-only">{copy.roosterFm.volume}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              className="h-1.5 w-full min-w-[4.5rem] accent-[var(--accent)]"
            />
          </label>

          <div className="flex shrink-0 items-center gap-1.5">
            <IconButton
              label={copy.roosterFm.addTracks}
              onClick={() => fileInputRef.current?.click()}
            >
              <PlusIcon />
            </IconButton>
            <IconButton
              label={copy.roosterFm.removeTrack}
              onClick={() => {
                if (track) {
                  void removeTrack(track.id);
                }
              }}
              danger
              disabled={!canRemove}
            >
              <TrashIcon />
            </IconButton>
            {/* Keep slot width stable when nothing is hidden. */}
            <IconButton
              label={copy.roosterFm.restoreSeed}
              onClick={() => {
                if (hiddenSeed) {
                  restoreBuiltinTrack(hiddenSeed.id);
                }
              }}
              disabled={!hiddenSeed}
            >
              <RestoreIcon />
            </IconButton>
            <IconButton
              label={
                visualsEnabled
                  ? copy.roosterFm.visualsOn
                  : copy.roosterFm.visualsOff
              }
              onClick={toggleVisuals}
              pressed={visualsEnabled}
            >
              <VisualsIcon />
            </IconButton>
          </div>
        </div>

        {libraryMessage ? (
          <p className="mt-2 text-xs text-muted" role="status">
            {libraryMessage}
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-muted/80">
            {copy.roosterFm.libraryHint}
          </p>
        )}
      </div>
    </div>
  );
}

/** Compact header control — toggles play; Wake stays the primary CTA. */
export function RoosterFmHeaderButton() {
  const { isPlaying, toggle } = useRoosterFM();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isPlaying}
      aria-label={isPlaying ? copy.roosterFm.pause : copy.roosterFm.play}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-muted transition hover:border-accent/40 hover:text-foreground"
    >
      {copy.roosterFm.label}
      <span
        className="inline-grid size-3.5 shrink-0 place-items-center text-accent"
        aria-hidden
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </span>
    </button>
  );
}
