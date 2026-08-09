"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  createDefaultPreferences,
  loadMascotPreferences,
  saveMascotPreferences,
  type MascotMotion,
  type MascotPreferences,
} from "@/app/_components/mascot/mascot-preferences";

type MascotContextValue = {
  prefs: MascotPreferences;
  hydrated: boolean;
  setPrefs: (
    next:
      | MascotPreferences
      | ((prev: MascotPreferences) => MascotPreferences),
  ) => void;
  setShow: (show: boolean) => void;
  setMotion: (motion: MascotMotion) => void;
  setTips: (tips: boolean) => void;
};

const MascotContext = createContext<MascotContextValue | null>(null);

export function MascotProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<MascotPreferences>(
    createDefaultPreferences,
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPrefsState(loadMascotPreferences());
    setHydrated(true);
  }, []);

  const setPrefs = useCallback(
    (
      next:
        | MascotPreferences
        | ((prev: MascotPreferences) => MascotPreferences),
    ) => {
      setPrefsState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        saveMascotPreferences(resolved);
        return resolved;
      });
    },
    [],
  );

  const setShow = useCallback(
    (show: boolean) => {
      setPrefs((prev) => ({ ...prev, show }));
    },
    [setPrefs],
  );

  const setMotion = useCallback(
    (motion: MascotMotion) => {
      setPrefs((prev) => ({ ...prev, motion }));
    },
    [setPrefs],
  );

  const setTips = useCallback(
    (tips: boolean) => {
      setPrefs((prev) => ({ ...prev, tips }));
    },
    [setPrefs],
  );

  return (
    <MascotContext.Provider
      value={{ prefs, hydrated, setPrefs, setShow, setMotion, setTips }}
    >
      {children}
    </MascotContext.Provider>
  );
}

export function useMascotPreferences(): MascotContextValue {
  const ctx = useContext(MascotContext);
  if (!ctx) {
    throw new Error("useMascotPreferences must be used within MascotProvider");
  }
  return ctx;
}
