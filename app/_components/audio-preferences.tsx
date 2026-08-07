"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAudioPrefs } from "@/app/actions";
import type { ActionResult } from "@/app/_lib/action-result";
import { ErrorDetails } from "@/app/_components/error-details";
import { useRoosterFM } from "@/app/_components/rooster-fm-provider";
import { SettingsAudioIcon } from "@/app/_components/settings-section-icons";
import { SettingsSectionFold } from "@/app/_components/settings-section-fold";
import { copy } from "@/src/copy";
import { TtsVoicePicker } from "@/app/_components/tts-voice-picker";
import type { TtsMode, TtsVoice } from "@/src/core/tts/voices";

export interface AudioPreferencesProps {
  wakeSound: boolean;
  ttsEnabled: boolean;
  ttsMode: TtsMode;
  ttsVoice: TtsVoice;
}

interface AudioDraft {
  wakeSound: boolean;
  ttsEnabled: boolean;
  ttsMode: TtsMode;
  ttsVoice: TtsVoice;
}

function draftMatchesProps(draft: AudioDraft, props: AudioDraft): boolean {
  return (
    draft.wakeSound === props.wakeSound &&
    draft.ttsEnabled === props.ttsEnabled &&
    draft.ttsMode === props.ttsMode &&
    draft.ttsVoice === props.ttsVoice
  );
}

export function AudioPreferences({
  wakeSound,
  ttsEnabled,
  ttsMode,
  ttsVoice,
}: AudioPreferencesProps) {
  const router = useRouter();
  const { startOnLoad, setStartOnLoad } = useRoosterFM();
  const [draft, setDraft] = useState<AudioDraft | null>(null);
  const [, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const propsDraft: AudioDraft = {
    wakeSound,
    ttsEnabled,
    ttsMode,
    ttsVoice,
  };

  // Drop optimistic state once the server round-trip matches — avoids flicker.
  if (draft && draftMatchesProps(draft, propsDraft)) {
    setDraft(null);
  }

  const current: AudioDraft = draft ?? propsDraft;
  const ttsControlsDisabled = !current.ttsEnabled;

  const persist = (next: AudioDraft): void => {
    setDraft(next);
    setResult(null);
    startTransition(async () => {
      const saved = await saveAudioPrefs(next);
      setResult(saved);
      if (saved.ok) {
        router.refresh();
      } else {
        setDraft(null);
      }
    });
  };

  return (
    <SettingsSectionFold
      title={copy.settings.audioHeading}
      icon={<SettingsAudioIcon />}
      summary={copy.settings.audioFoldSummary({
        crow: current.wakeSound,
        spoken: current.ttsEnabled,
        mode: current.ttsMode,
        voice: current.ttsVoice,
      })}
      defaultOpen
      className="border-accent/25 bg-surface-raised/80"
    >
      <p className="text-sm text-muted">{copy.settings.audioBlurb}</p>

      <div className="flex flex-col gap-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={current.wakeSound}
            onChange={(event) => {
              persist({ ...current, wakeSound: event.target.checked });
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
            checked={current.ttsEnabled}
            onChange={(event) => {
              persist({ ...current, ttsEnabled: event.target.checked });
            }}
            className="mt-1 accent-[var(--accent)]"
          />
          <span className="flex flex-col gap-1">
            <span className="font-medium text-foreground">
              {copy.settings.ttsEnabled}
            </span>
            <span className="text-muted">{copy.settings.ttsEnabledHint}</span>
          </span>
        </label>

        <div
          className={
            ttsControlsDisabled
              ? "flex flex-col gap-3 opacity-60"
              : "flex flex-col gap-3"
          }
        >
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-foreground">
              {copy.settings.ttsMode}
            </span>
            <div className="flex flex-wrap gap-4">
              <label
                className={
                  ttsControlsDisabled
                    ? "flex items-center gap-2"
                    : "flex cursor-pointer items-center gap-2"
                }
              >
                <input
                  type="radio"
                  name="ttsMode"
                  checked={current.ttsMode === "each-wake"}
                  disabled={ttsControlsDisabled}
                  onChange={() => {
                    persist({ ...current, ttsMode: "each-wake" });
                  }}
                  className="accent-[var(--accent)]"
                />
                <span>{copy.settings.ttsModeEachWake}</span>
              </label>
              <label
                className={
                  ttsControlsDisabled
                    ? "flex items-center gap-2"
                    : "flex cursor-pointer items-center gap-2"
                }
              >
                <input
                  type="radio"
                  name="ttsMode"
                  checked={current.ttsMode === "on-demand"}
                  disabled={ttsControlsDisabled}
                  onChange={() => {
                    persist({ ...current, ttsMode: "on-demand" });
                  }}
                  className="accent-[var(--accent)]"
                />
                <span>{copy.settings.ttsModeOnDemand}</span>
              </label>
            </div>
            <span className="text-xs text-muted">{copy.settings.ttsModeHint}</span>
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">
              {copy.settings.ttsVoice}
            </span>
            <TtsVoicePicker
              value={current.ttsVoice}
              disabled={ttsControlsDisabled}
              onChange={(voice) => {
                persist({ ...current, ttsVoice: voice });
              }}
            />
            <span className="text-xs text-muted">{copy.settings.ttsVoiceHint}</span>
          </div>
        </div>

        <p className="text-xs text-muted">{copy.settings.ttsDisclosure}</p>

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
    </SettingsSectionFold>
  );
}
