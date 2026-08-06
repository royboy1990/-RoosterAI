import { copy } from "@/src/copy";
import type { CoopStatus } from "@/src/core/types";

export function formatHeaderTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
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

export function isEnvSet(name: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env[name];
  return value !== undefined && value.trim() !== "";
}
