"use client";

import { usePreferencesSaveOptional } from "@/app/_components/preferences-save-context";
import { WakeButton } from "@/app/_components/wake-provider";
import { copy } from "@/src/copy";

/**
 * Sticky-header primary action: Save preferences while the form is dirty,
 * otherwise Wake the Flock Up. Keeps Wake available on every other page.
 */
export function HeaderPrimaryAction() {
  const prefs = usePreferencesSaveOptional();
  const headerSave = prefs?.headerSave;

  if (headerSave?.dirty) {
    return (
      <button
        type="button"
        disabled={headerSave.saving}
        onClick={headerSave.requestSave}
        className="inline-grid rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-accent-dim disabled:cursor-wait disabled:opacity-80"
        title={copy.settings.unsavedChanges}
      >
        <span
          className="invisible col-start-1 row-start-1 whitespace-nowrap"
          aria-hidden
        >
          {copy.pendingGather}
        </span>
        <span className="col-start-1 row-start-1 whitespace-nowrap">
          {headerSave.saving ? copy.pendingGather : copy.settings.save}
        </span>
      </button>
    );
  }

  return <WakeButton />;
}
