/** Coarse condition bucket for brief copy, TTS, and header backdrop. */
export type WeatherCondition =
  | "clear"
  | "cloudy"
  | "rain"
  | "snow"
  | "storm"
  | "fog";

export interface WeatherSnapshot {
  condition: WeatherCondition;
  isDay: boolean;
  tempC: number;
  highC: number;
  lowC: number;
  locationName: string;
}
