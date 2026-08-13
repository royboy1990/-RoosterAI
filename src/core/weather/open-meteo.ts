import { localYmd } from "../tts/greeting";
import type { WeatherCondition, WeatherSnapshot } from "./types";

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

interface GeocodeResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  feature_code?: string;
}

interface GeocodeResponse {
  results?: GeocodeResult[];
}

interface ForecastResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    is_day?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
}

type CacheEntry = {
  snapshot: WeatherSnapshot;
  fetchedAt: number;
};

/** Connector + header share one fetch; TTL so the sky can change during the day. */
const MEMORY_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

export function clearWeatherCache(): void {
  cache.clear();
}

/**
 * City name for weather. Prefer explicit `weatherLocation`; else derive from
 * the IANA zone (`Asia/Jerusalem` → `Jerusalem`). Returns null when neither works.
 */
export function resolveLocation(
  config: { weatherLocation?: string },
  timezone: string,
): string | null {
  const explicit = config.weatherLocation?.trim();
  if (explicit) {
    return explicit;
  }
  return cityFromTimezone(timezone);
}

function cityFromTimezone(timezone: string): string | null {
  const trimmed = timezone.trim();
  if (!trimmed || trimmed === "UTC" || trimmed.startsWith("Etc/")) {
    return null;
  }
  const slash = trimmed.lastIndexOf("/");
  if (slash < 0 || slash === trimmed.length - 1) {
    return null;
  }
  const raw = trimmed.slice(slash + 1).trim();
  if (!raw) {
    return null;
  }
  return raw.replace(/_/g, " ");
}

/**
 * Map WMO weather interpretation codes to a coarse condition.
 * 0 Clear sky, 1 Mainly clear, 2 Partly cloudy, 3 Overcast.
 * Codes 1–2 used to collapse into "cloudy", which made sunny tropical
 * mornings look overcast.
 */
export function conditionFromWmo(code: number): WeatherCondition {
  if (code === 0 || code === 1) {
    return "clear";
  }
  if (code === 2) {
    return "partlyCloudy";
  }
  if (code === 3) {
    return "cloudy";
  }
  if (code === 45 || code === 48) {
    return "fog";
  }
  if (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82)
  ) {
    return "rain";
  }
  if (
    (code >= 71 && code <= 77) ||
    (code >= 85 && code <= 86)
  ) {
    return "snow";
  }
  if (code >= 95 && code <= 99) {
    return "storm";
  }
  // Unlisted codes (e.g. 56 freezing drizzle already in rain range) — cloudy fallback.
  return "cloudy";
}

function cacheKey(locationQuery: string, ymd: string): string {
  return `${locationQuery.trim().toLowerCase()}:${ymd}`;
}

function roundTemp(value: number): number {
  return Math.round(value);
}

async function geocode(
  locationQuery: string,
  signal: AbortSignal | undefined,
  fetchInit: RequestInit | undefined,
): Promise<GeocodeResult> {
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("name", locationQuery);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url, {
    ...fetchInit,
    signal: signal ?? fetchInit?.signal,
    headers: {
      Accept: "application/json",
      "User-Agent": "RoosterAI-weather/0.1",
      ...fetchInit?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(
      `Weather geocode failed (${res.status}): ${res.statusText}`,
    );
  }
  const body = (await res.json()) as GeocodeResponse;
  const hit = pickGeocodeResult(locationQuery, body.results);
  if (!hit) {
    throw new Error(
      `Weather location not found: "${locationQuery}". Set a city in Settings.`,
    );
  }
  return hit;
}

/**
 * Prefer an inhabited place / island over airports, and a close name match
 * over whatever GeoNames ranked first (e.g. "Koh Phangan" vs an airport).
 */
function pickGeocodeResult(
  locationQuery: string,
  results: GeocodeResult[] | undefined,
): GeocodeResult | undefined {
  if (!results || results.length === 0) {
    return undefined;
  }
  const needle = normalizePlaceName(locationQuery);
  const needleCompact = needle.replace(/\s+/g, "");
  const scored = results.map((hit, index) => {
    const name = normalizePlaceName(hit.name);
    const nameCompact = name.replace(/\s+/g, "");
    let score = 0;
    if (name === needle || nameCompact === needleCompact) {
      score += 80;
    } else if (name.startsWith(needle) || needle.startsWith(name)) {
      score += 50;
    } else if (name.includes(needle) || needle.includes(name)) {
      score += 30;
    }
    const feature = hit.feature_code ?? "";
    if (feature === "PPLC" || feature === "PPLA" || feature === "PPLA2") {
      score += 20;
    } else if (feature === "PPL" || feature === "ISL") {
      score += 16;
    } else if (feature === "AIRP" || feature === "AIRF") {
      score -= 40;
    }
    score -= index;
    return { hit, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.hit;
}

function normalizePlaceName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

async function fetchForecast(
  place: GeocodeResult,
  timezone: string,
  signal: AbortSignal | undefined,
  fetchInit: RequestInit | undefined,
): Promise<WeatherSnapshot> {
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(place.latitude));
  url.searchParams.set("longitude", String(place.longitude));
  url.searchParams.set("current", "temperature_2m,weather_code,is_day");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
  url.searchParams.set("timezone", timezone);
  url.searchParams.set("forecast_days", "1");

  const res = await fetch(url, {
    ...fetchInit,
    signal: signal ?? fetchInit?.signal,
    headers: {
      Accept: "application/json",
      "User-Agent": "RoosterAI-weather/0.1",
      ...fetchInit?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(
      `Weather forecast failed (${res.status}): ${res.statusText}`,
    );
  }
  const body = (await res.json()) as ForecastResponse;
  const current = body.current;
  const daily = body.daily;
  if (
    current?.temperature_2m === undefined ||
    current.weather_code === undefined ||
    current.is_day === undefined ||
    daily?.temperature_2m_max?.[0] === undefined ||
    daily.temperature_2m_min?.[0] === undefined
  ) {
    throw new Error("Weather forecast response was incomplete.");
  }

  return {
    condition: conditionFromWmo(current.weather_code),
    isDay: current.is_day === 1,
    tempC: roundTemp(current.temperature_2m),
    highC: roundTemp(daily.temperature_2m_max[0]),
    lowC: roundTemp(daily.temperature_2m_min[0]),
    locationName: place.name,
  };
}

export interface FetchWeatherOptions {
  /** Resolved city / place query (from resolveLocation). */
  locationQuery: string;
  timezone: string;
  now?: Date;
  signal?: AbortSignal;
  /**
   * Extra fetch init (e.g. `{ next: { revalidate: 900 } }` for RSC).
   * Merged into geocode + forecast requests.
   */
  fetchInit?: RequestInit;
  /** Skip the in-memory day cache (still may hit Next data cache via fetchInit). */
  bypassMemoryCache?: boolean;
}

/**
 * Geocode + current/daily forecast. Cached in-process by `location:YYYY-MM-DD`
 * for 15 minutes so a wake can reuse the header fetch without going stale all day.
 */
export async function fetchWeatherSnapshot(
  options: FetchWeatherOptions,
): Promise<WeatherSnapshot> {
  const locationQuery = options.locationQuery.trim();
  if (!locationQuery) {
    throw new Error(
      "Weather location is empty. Set a city in Settings or use a named timezone.",
    );
  }

  const now = options.now ?? new Date();
  const ymd = localYmd(now, options.timezone);
  const key = cacheKey(locationQuery, ymd);

  if (!options.bypassMemoryCache) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.fetchedAt < MEMORY_TTL_MS) {
      return hit.snapshot;
    }
  }

  const place = await geocode(
    locationQuery,
    options.signal,
    options.fetchInit,
  );
  const snapshot = await fetchForecast(
    place,
    options.timezone,
    options.signal,
    options.fetchInit,
  );

  if (!options.bypassMemoryCache) {
    cache.set(key, { snapshot, fetchedAt: Date.now() });
  }
  return snapshot;
}

/** Human label for written brief lines. */
export function conditionLabel(condition: WeatherCondition): string {
  switch (condition) {
    case "clear":
      return "Clear sky";
    case "partlyCloudy":
      return "Partly cloudy";
    case "cloudy":
      return "Cloudy";
    case "rain":
      return "Rain";
    case "snow":
      return "Snow";
    case "storm":
      return "Storm";
    case "fog":
      return "Fog";
  }
}

/** Short adjective for header hover: "It's Cloudy in Tel Aviv". */
export function conditionAdjective(
  condition: WeatherCondition,
  isDay: boolean,
): string {
  switch (condition) {
    case "clear":
      return isDay ? "Sunny" : "Clear";
    case "partlyCloudy":
      return "Partly cloudy";
    case "cloudy":
      return "Cloudy";
    case "rain":
      return "Rainy";
    case "snow":
      return "Snowy";
    case "storm":
      return "Stormy";
    case "fog":
      return "Foggy";
  }
}

/** Header weather-icon hover / accessible label. */
export function weatherHoverTitle(snapshot: WeatherSnapshot): string {
  return `It's ${conditionAdjective(snapshot.condition, snapshot.isDay)} in ${snapshot.locationName}`;
}

/** Compact glyph for the header mono line (legacy text; prefer SVG chip). */
export function conditionGlyph(
  condition: WeatherCondition,
  isDay: boolean,
): string {
  switch (condition) {
    case "clear":
      return isDay ? "sun" : "moon";
    case "partlyCloudy":
      return "sun-cloud";
    case "cloudy":
      return "cloud";
    case "rain":
      return "rain";
    case "snow":
      return "snow";
    case "storm":
      return "storm";
    case "fog":
      return "fog";
  }
}

/** Comfort reference for warm/cool header washes (~18°C). */
const TEMP_NEUTRAL_C = 18;
const TEMP_TINT_RANGE_C = 20;

/** -1 (freezing) … 0 (neutral) … +1 (hot), clamped. */
export function temperatureTintFactor(tempC: number): number {
  return Math.max(
    -1,
    Math.min(1, (tempC - TEMP_NEUTRAL_C) / TEMP_TINT_RANGE_C),
  );
}

/**
 * Soft warm/cool rgba wash for the header sky.
 * Hot pushes amber; freezing pushes icy blue. Strength scales with |Δ| from ~18°C.
 */
export function temperatureTintWash(tempC: number): string {
  const t = temperatureTintFactor(tempC);
  if (t > 0.02) {
    return `rgba(240, 160, 48, ${(0.05 + 0.16 * t).toFixed(3)})`;
  }
  if (t < -0.02) {
    return `rgba(110, 170, 220, ${(0.05 + 0.16 * Math.abs(t)).toFixed(3)})`;
  }
  return "transparent";
}

type Rgb = readonly [number, number, number];

function mixRgb(a: Rgb, b: Rgb, amount: number): string {
  const t = Math.max(0, Math.min(1, amount));
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

/**
 * Icon chip color: condition picks the base hue; temp nudges warm (amber) or cool (icy).
 */
export function weatherIconColor(
  condition: WeatherCondition,
  isDay: boolean,
  tempC: number,
): string {
  const warm: Rgb = [240, 160, 48];
  const cool: Rgb = [110, 180, 230];
  const t = temperatureTintFactor(tempC);

  let base: Rgb;
  switch (condition) {
    case "clear":
      base = isDay ? [240, 168, 56] : [198, 208, 222];
      break;
    case "partlyCloudy":
      base = isDay ? [220, 168, 72] : [176, 184, 202];
      break;
    case "cloudy":
      base = [150, 160, 178];
      break;
    case "rain":
      base = [118, 158, 210];
      break;
    case "snow":
      base = [200, 212, 224];
      break;
    case "storm":
      base = [168, 174, 214];
      break;
    case "fog":
      base = [168, 168, 164];
      break;
  }

  if (t > 0.02) {
    return mixRgb(base, warm, 0.15 + 0.35 * t);
  }
  if (t < -0.02) {
    return mixRgb(base, cool, 0.15 + 0.35 * Math.abs(t));
  }
  return `rgb(${base[0]}, ${base[1]}, ${base[2]})`;
}

/** One-line written brief section body. */
export function formatWeatherBriefLine(snapshot: WeatherSnapshot): string {
  return `${conditionLabel(snapshot.condition)} in ${snapshot.locationName}: ${snapshot.tempC}C now, high ${snapshot.highC}, low ${snapshot.lowC}.`;
}

/**
 * Server/layout helper: resolve location, fetch with Next data cache (15 min),
 * fail-soft to null so the header stays pixel-identical when weather is unavailable.
 */
export async function loadHeaderWeather(options: {
  weatherLocation: string;
  timezone: string;
  now?: Date;
}): Promise<WeatherSnapshot | null> {
  const locationQuery = resolveLocation(
    { weatherLocation: options.weatherLocation },
    options.timezone,
  );
  if (!locationQuery) {
    return null;
  }
  try {
    return await fetchWeatherSnapshot({
      locationQuery,
      timezone: options.timezone,
      now: options.now,
      fetchInit: {
        // Next.js Data Cache — header weather at most ~15 min stale.
        next: { revalidate: 900 },
      } as RequestInit,
    });
  } catch {
    return null;
  }
}
