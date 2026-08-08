import { localYmd } from "../tts/greeting";
import type { WeatherCondition, WeatherSnapshot } from "./types";

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

type Template = {
  conditions: readonly WeatherCondition[] | "any";
  line: string;
};

/**
 * Spoken-only weather lines. `{location}` and `{temp}` are filled from the snapshot.
 * Same local day → same template (stable regenerations).
 */
const TEMPLATES: readonly Template[] = [
  {
    conditions: ["clear"],
    line: "It's a sunny day in {location}, {temp} degrees.",
  },
  {
    conditions: ["clear"],
    line: "Clear skies over {location} — {temp} degrees right now.",
  },
  {
    conditions: ["cloudy"],
    line: "It's cloudy in {location} today, {temp} degrees.",
  },
  {
    conditions: ["cloudy"],
    line: "Gray skies in {location} — {temp} degrees.",
  },
  {
    conditions: ["rain"],
    line: "Looks like rain in {location} today — {temp} degrees.",
  },
  {
    conditions: ["rain"],
    line: "Wet weather in {location}, sitting at {temp} degrees.",
  },
  {
    conditions: ["snow"],
    line: "Snow in {location} today — {temp} degrees.",
  },
  {
    conditions: ["storm"],
    line: "Stormy weather in {location} — {temp} degrees.",
  },
  {
    conditions: ["fog"],
    line: "Foggy in {location} this morning, {temp} degrees.",
  },
  {
    conditions: "any",
    line: "Weather in {location}: {temp} degrees.",
  },
];

function fillTemplate(
  template: string,
  snapshot: WeatherSnapshot,
): string {
  return template
    .split("{location}")
    .join(snapshot.locationName)
    .split("{temp}")
    .join(String(snapshot.tempC));
}

/**
 * Pick one spoken weather sentence for the greeting.
 * Stable within a local calendar day; rotates across days.
 */
export function weatherGreetingLine(
  now: Date,
  timezone: string,
  snapshot: WeatherSnapshot,
): string {
  const matching = TEMPLATES.filter(
    (entry) =>
      entry.conditions === "any" ||
      entry.conditions.includes(snapshot.condition),
  );
  const pool = matching.length > 0 ? matching : TEMPLATES;
  const index = hashString(localYmd(now, timezone)) % pool.length;
  return fillTemplate(pool[index]!.line, snapshot);
}
