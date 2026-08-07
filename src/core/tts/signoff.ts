import { localYmd } from "./greeting";

/** Closers without a name — keep calm and short. */
const SIGNOFF_PLAIN = [
  "That's your brief. Have a good one.",
  "That's everything for now. Have a good day.",
  "Brief's done. You're set.",
  "That's the rundown. Have a solid day.",
  "All set. Have a good one.",
  "That's all for this brief. Take care.",
] as const;

/** Closers with `{name}` placeholder. */
const SIGNOFF_NAMED = [
  "That's your brief, {name}. Have a good one.",
  "That's everything for now, {name}. Have a good day.",
  "Brief's done, {name}. You're set.",
  "That's the rundown, {name}. Have a solid day.",
  "All set, {name}. Have a good one.",
  "That's all for this brief, {name}. Take care.",
] as const;

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Pick one sign-off for the spoken brief.
 * Same local calendar day → same line (regenerating audio stays consistent).
 */
export function briefSignOff(
  now: Date,
  timezone: string,
  operatorName: string,
): string {
  const name = operatorName.trim();
  const templates = name.length > 0 ? SIGNOFF_NAMED : SIGNOFF_PLAIN;
  const index = hashString(localYmd(now, timezone)) % templates.length;
  const template = templates[index]!;
  return name.length > 0 ? template.split("{name}").join(name) : template;
}
