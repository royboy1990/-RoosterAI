/**
 * Client-only mascot prefs — one versioned localStorage object.
 * Not rooster.config.json (see plan: prefs-provider).
 */

export const MASCOT_PREFS_KEY = "rooster-mascot-preferences";

export type MascotMotion = "full" | "reduced";

export type MascotPreferences = {
  version: 1;
  show: boolean;
  motion: MascotMotion;
  tips: boolean;
};

const MOTIONS: readonly MascotMotion[] = ["full", "reduced"];

export function defaultMotionPreference(): MascotMotion {
  if (typeof window === "undefined") {
    return "full";
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "reduced"
      : "full";
  } catch {
    return "full";
  }
}

export function createDefaultPreferences(): MascotPreferences {
  return {
    version: 1,
    show: true,
    motion: defaultMotionPreference(),
    tips: true,
  };
}

export function parseMascotPreferences(raw: unknown): MascotPreferences | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) {
    return null;
  }
  if (typeof obj.show !== "boolean" || typeof obj.tips !== "boolean") {
    return null;
  }
  if (typeof obj.motion !== "string") {
    return null;
  }

  // Legacy Motion "off" → Show off (same outcome; Show is the hide control).
  if (obj.motion === "off") {
    return {
      version: 1,
      show: false,
      motion: defaultMotionPreference(),
      tips: obj.tips,
    };
  }

  if (!MOTIONS.includes(obj.motion as MascotMotion)) {
    return null;
  }

  return {
    version: 1,
    show: obj.show,
    motion: obj.motion as MascotMotion,
    tips: obj.tips,
  };
}

export function loadMascotPreferences(): MascotPreferences {
  try {
    const raw = window.localStorage.getItem(MASCOT_PREFS_KEY);
    if (raw === null) {
      return createDefaultPreferences();
    }
    const parsed = parseMascotPreferences(JSON.parse(raw) as unknown);
    return parsed ?? createDefaultPreferences();
  } catch {
    return createDefaultPreferences();
  }
}

export function saveMascotPreferences(prefs: MascotPreferences): void {
  try {
    window.localStorage.setItem(MASCOT_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Quota / private mode — prefs stay in-memory only.
  }
}

/** Companion mounts only when Show on and viewport ≥ sm. */
export function shouldMountCompanion(
  prefs: MascotPreferences,
  viewportSmUp: boolean,
): boolean {
  return prefs.show && viewportSmUp;
}

/** RAF / director loop — Show off (and lab exception) gate mounting. */
export function isDirectorActive(
  prefs: MascotPreferences,
  opts: { lab?: boolean; viewportSmUp?: boolean },
): boolean {
  if (opts.lab) {
    return true;
  }
  return prefs.show && (opts.viewportSmUp ?? true);
}

export function allowsAmbient(prefs: MascotPreferences): boolean {
  return prefs.motion === "full";
}

export function allowsLocomotion(prefs: MascotPreferences): boolean {
  return prefs.motion === "full";
}

export function allowsWakeReaction(prefs: MascotPreferences): boolean {
  return prefs.show;
}

/** Tips gate bubbles only — poses still run when tips are off. */
export function allowsTips(prefs: MascotPreferences): boolean {
  return prefs.tips && prefs.show;
}
