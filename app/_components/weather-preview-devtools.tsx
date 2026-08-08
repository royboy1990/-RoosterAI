"use client";

/**
 * TEMP — weather header preview controls. Delete this file and its imports when done testing.
 */

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  WeatherCondition,
  WeatherSnapshot,
} from "@/src/core/weather/types";

const CONDITIONS: WeatherCondition[] = [
  "clear",
  "cloudy",
  "fog",
  "rain",
  "storm",
  "snow",
];

type WeatherPreviewContextValue = {
  weather: WeatherSnapshot | null;
  setCondition: (condition: WeatherCondition) => void;
  setIsDay: (isDay: boolean) => void;
  setTempC: (tempC: number) => void;
  reset: () => void;
};

const WeatherPreviewContext = createContext<WeatherPreviewContextValue | null>(
  null,
);

function fallbackSnapshot(): WeatherSnapshot {
  return {
    condition: "cloudy",
    isDay: true,
    tempC: 18,
    highC: 22,
    lowC: 14,
    locationName: "Preview",
  };
}

export function WeatherPreviewProvider({
  baseWeather,
  children,
}: {
  baseWeather: WeatherSnapshot | null;
  children: ReactNode;
}) {
  const [override, setOverride] = useState<WeatherSnapshot | null>(null);
  const base = baseWeather ?? fallbackSnapshot();
  const weather = override ?? baseWeather;

  const value = useMemo<WeatherPreviewContextValue>(
    () => ({
      weather,
      setCondition: (condition) =>
        setOverride((prev) => ({ ...(prev ?? base), condition })),
      setIsDay: (isDay) =>
        setOverride((prev) => ({ ...(prev ?? base), isDay })),
      setTempC: (tempC) =>
        setOverride((prev) => ({ ...(prev ?? base), tempC })),
      reset: () => setOverride(null),
    }),
    [weather, base],
  );

  return (
    <WeatherPreviewContext.Provider value={value}>
      {children}
    </WeatherPreviewContext.Provider>
  );
}

export function usePreviewWeather(
  serverWeather: WeatherSnapshot | null,
): WeatherSnapshot | null {
  const ctx = useContext(WeatherPreviewContext);
  return ctx?.weather ?? serverWeather;
}

/** Throwaway controls — place above Latest brief. */
export function WeatherPreviewSliders() {
  const ctx = useContext(WeatherPreviewContext);
  if (!ctx) {
    return null;
  }

  const snap = ctx.weather ?? fallbackSnapshot();

  return (
    <div className="rounded border border-dashed border-accent/40 bg-surface/90 px-3 py-3 text-xs text-muted">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-medium text-foreground">
          TEMP weather preview (remove later)
        </p>
        <button
          type="button"
          className="rounded border border-border px-2 py-0.5 hover:text-foreground"
          onClick={ctx.reset}
        >
          Reset
        </button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <label className="flex items-center gap-2">
          <span className="w-16 shrink-0">Condition</span>
          <select
            className="rounded border border-border bg-background px-2 py-1 text-foreground"
            value={snap.condition}
            onChange={(e) =>
              ctx.setCondition(e.target.value as WeatherCondition)
            }
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="w-16 shrink-0">Day/night</span>
          <select
            className="rounded border border-border bg-background px-2 py-1 text-foreground"
            value={snap.isDay ? "day" : "night"}
            onChange={(e) => ctx.setIsDay(e.target.value === "day")}
          >
            <option value="day">day</option>
            <option value="night">night</option>
          </select>
        </label>
        <label className="flex min-w-[12rem] flex-1 items-center gap-2">
          <span className="w-16 shrink-0">Temp °C</span>
          <input
            type="range"
            min={-10}
            max={42}
            value={snap.tempC}
            onChange={(e) => ctx.setTempC(Number(e.target.value))}
            className="flex-1"
          />
          <span className="metric-mono w-8 text-foreground">{snap.tempC}</span>
        </label>
      </div>
    </div>
  );
}
