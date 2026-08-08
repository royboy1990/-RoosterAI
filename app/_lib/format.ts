import { copy } from "@/src/copy";
import type { CoopStatus } from "@/src/core/types";

export function formatHeaderTime(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("weekday")} ${get("day")} ${get("month")} ${get("hour")}:${get("minute")}`;
}

export function coopStatusLabel(status: CoopStatus | null | undefined): string {
  if (!status) {
    return copy.coopStatus.unknown;
  }
  switch (status) {
    case "Optimal":
      return copy.coopStatus.optimal;
    case "Ruffled":
      return copy.coopStatus.ruffled;
    case "Feathers Everywhere":
      return copy.coopStatus.feathersEverywhere;
    default:
      return copy.coopStatus.unknown;
  }
}

export function coopStatusClass(status: CoopStatus | null | undefined): string {
  switch (status) {
    case "Optimal":
      return "text-ok border-ok/40 bg-ok/10";
    case "Ruffled":
      return "text-accent border-accent/40 bg-accent/10";
    case "Feathers Everywhere":
      return "text-danger border-danger/40 bg-danger/10";
    default:
      return "text-muted border-border bg-surface";
  }
}

export function friendlyOutcomeLine(outcome: {
  label: string;
  status: string;
  error?: string;
}): string {
  if (outcome.status === "ok") {
    return `${outcome.label}: ok`;
  }
  if (outcome.error?.startsWith("missing env:")) {
    return copy.skippedMissingEnv(outcome.label);
  }
  if (
    outcome.error?.includes("timed out") ||
    outcome.error?.includes("Timeout")
  ) {
    return copy.skippedTimeout(outcome.label);
  }
  return copy.skippedFailed(outcome.label);
}

export function dayKey(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function formatDayHeading(day: string, timezone: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatBriefTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatBriefDateTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function isEnvSet(name: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env[name];
  return value !== undefined && value.trim() !== "";
}

/**
 * Local $ estimate formatting.
 * $0.00 · $0.0001 · $0.012 · $1.23
 */
export function formatUsdEstimate(usd: number): string {
  if (!Number.isFinite(usd)) {
    return "—";
  }
  if (usd === 0) {
    return "$0.00";
  }
  const abs = Math.abs(usd);
  // Sub-tenth-cent amounts (short TTS clips) need more than 3 decimals
  // or they collapse to "$0.000" and look like missing pricing.
  if (abs < 0.001) {
    return `$${usd.toFixed(4)}`;
  }
  if (abs < 1) {
    return `$${usd.toFixed(3)}`;
  }
  return `$${usd.toFixed(2)}`;
}

/** Compact token counts for unknown-price cost lines, e.g. 12.4k. */
export function formatTokenCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) {
    return "0";
  }
  if (n < 1000) {
    return String(Math.round(n));
  }
  const k = n / 1000;
  if (k < 10) {
    return `${k.toFixed(1).replace(/\.0$/, "")}k`;
  }
  if (k < 1000) {
    return `${Math.round(k)}k`;
  }
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

