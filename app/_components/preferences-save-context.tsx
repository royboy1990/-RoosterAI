"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface PreferencesHeaderSaveState {
  dirty: boolean;
  saving: boolean;
  requestSave: () => void;
}

interface PreferencesSaveContextValue {
  headerSave: PreferencesHeaderSaveState | null;
  setHeaderSave: (state: PreferencesHeaderSaveState | null) => void;
}

const PreferencesSaveContext = createContext<PreferencesSaveContextValue | null>(
  null,
);

export function PreferencesSaveProvider({ children }: { children: ReactNode }) {
  const [headerSave, setHeaderSaveState] =
    useState<PreferencesHeaderSaveState | null>(null);

  const setHeaderSave = useCallback(
    (state: PreferencesHeaderSaveState | null) => {
      setHeaderSaveState(state);
    },
    [],
  );

  const value = useMemo(
    () => ({ headerSave, setHeaderSave }),
    [headerSave, setHeaderSave],
  );

  return (
    <PreferencesSaveContext.Provider value={value}>
      {children}
    </PreferencesSaveContext.Provider>
  );
}

export function usePreferencesSave(): PreferencesSaveContextValue {
  const ctx = useContext(PreferencesSaveContext);
  if (!ctx) {
    throw new Error(
      "usePreferencesSave must be used within PreferencesSaveProvider",
    );
  }
  return ctx;
}

export function usePreferencesSaveOptional(): PreferencesSaveContextValue | null {
  return useContext(PreferencesSaveContext);
}
