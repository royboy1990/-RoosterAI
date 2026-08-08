import { z } from "zod";
import type { Connector, ConnectorResult, RunContext } from "../types";
import {
  fetchWeatherSnapshot,
  formatWeatherBriefLine,
  resolveLocation,
} from "../weather";

const weatherConfigSchema = z.object({
  /** Optional city override; empty uses settings weatherLocation / timezone. */
  locationOverride: z.string().max(120).default(""),
});

type WeatherConfig = z.infer<typeof weatherConfigSchema>;

/**
 * Weather connector (Open-Meteo). No API key.
 * Location: connector override → settings weatherLocation → city from timezone.
 */
export const weatherConnector: Connector<WeatherConfig> = {
  id: "weather",
  label: "Weather",
  description:
    "Current conditions and today's high/low via Open-Meteo. No API key — set the city in Settings.",
  tags: ["weather"],
  setupDocs: "/settings",
  requiredEnv: [],
  configSchema: weatherConfigSchema,
  async fetch(
    config: WeatherConfig,
    ctx: RunContext,
  ): Promise<ConnectorResult> {
    const locationQuery = resolveLocation(
      {
        weatherLocation:
          config.locationOverride.trim() || ctx.weatherLocation || "",
      },
      ctx.timezone,
    );
    if (!locationQuery) {
      throw new Error(
        "Weather location could not be resolved. Set a city in Settings (or a named timezone like Asia/Jerusalem).",
      );
    }

    ctx.log(`weather: fetching Open-Meteo for ${locationQuery}`);
    const snapshot = await fetchWeatherSnapshot({
      locationQuery,
      timezone: ctx.timezone,
      now: ctx.now,
      signal: ctx.signal,
    });
    ctx.log(
      `weather: ${snapshot.condition} ${snapshot.tempC}C in ${snapshot.locationName}`,
    );

    return {
      heading: "Weather",
      lines: [formatWeatherBriefLine(snapshot)],
    };
  },
};
