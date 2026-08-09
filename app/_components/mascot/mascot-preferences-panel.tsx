"use client";

import { useMascotPreferences } from "@/app/_components/mascot/mascot-provider";
import type { MascotMotion } from "@/app/_components/mascot/mascot-preferences";
import { SettingsMascotIcon } from "@/app/_components/settings-section-icons";
import { SettingsSectionFold } from "@/app/_components/settings-section-fold";
import { copy } from "@/src/copy";

const MOTION_OPTIONS: { value: MascotMotion; label: string }[] = [
  { value: "full", label: copy.settings.mascotMotionFull },
  { value: "reduced", label: copy.settings.mascotMotionReduced },
];

export function MascotPreferencesPanel() {
  const { prefs, setShow, setMotion, setTips } = useMascotPreferences();

  return (
    <SettingsSectionFold
      title={copy.settings.mascotHeading}
      icon={<SettingsMascotIcon />}
      summary={copy.settings.mascotFoldSummary({
        show: prefs.show,
        motion: prefs.motion,
        tips: prefs.tips,
      })}
      defaultOpen={false}
      className="border-border bg-surface/80"
    >
      <p className="text-sm text-muted">{copy.settings.mascotBlurb}</p>

      <div className="flex flex-col gap-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={prefs.show}
            onChange={(event) => setShow(event.target.checked)}
            className="mt-1 accent-[var(--accent)]"
          />
          <span className="flex flex-col gap-1">
            <span className="font-medium text-foreground">
              {copy.settings.mascotShow}
            </span>
            <span className="text-muted">{copy.settings.mascotShowHint}</span>
          </span>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-foreground">
            {copy.settings.mascotMotion}
          </legend>
          <p className="text-sm text-muted">{copy.settings.mascotMotionHint}</p>
          <div className="flex flex-wrap gap-4">
            {MOTION_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  name="mascot-motion"
                  value={option.value}
                  checked={prefs.motion === option.value}
                  onChange={() => setMotion(option.value)}
                  className="accent-[var(--accent)]"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={prefs.tips}
            onChange={(event) => setTips(event.target.checked)}
            className="mt-1 accent-[var(--accent)]"
          />
          <span className="flex flex-col gap-1">
            <span className="font-medium text-foreground">
              {copy.settings.mascotTips}
            </span>
            <span className="text-muted">{copy.settings.mascotTipsHint}</span>
          </span>
        </label>
      </div>
    </SettingsSectionFold>
  );
}
