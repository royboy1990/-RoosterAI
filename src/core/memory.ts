import { listBriefIds, readBrief } from "./store";
import type { BriefRecord, WakeMode } from "./types";

/** Safety window only — not a user-facing setting. */
const BASELINE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Keep the memory packet from dwarfing today's digest. */
const MEMORY_PACKET_MAX_CHARS = 2500;

/** Per unchanged section, how many body lines to keep for continuity. */
const UNCHANGED_SECTION_LINE_CAP = 4;

export interface DigestSection {
  heading: string;
  lines: string[];
}

export interface SectionDiff {
  heading: string;
  added: string[];
  removed: string[];
}

export interface DigestDiff {
  addedOrChanged: SectionDiff[];
  /** Sections present in both digests with identical line sets. */
  unchanged: DigestSection[];
  hasChanges: boolean;
}

export interface WakeDecision {
  mode: WakeMode;
  baseline: BriefRecord | null;
  /** Present when mode is "diff". */
  memoryPacket?: string;
}

/** Parse a buildDigest-shaped string into heading + body lines. */
export function parseDigestSections(digest: string): DigestSection[] {
  const trimmed = digest.trim();
  if (!trimmed) {
    return [];
  }

  const sections: DigestSection[] = [];
  const parts = trimmed.split(/^## /m);

  for (const part of parts) {
    const body = part.trim();
    if (!body) {
      continue;
    }
    const newline = body.indexOf("\n");
    const heading = (newline === -1 ? body : body.slice(0, newline)).trim();
    const rest = newline === -1 ? "" : body.slice(newline + 1);
    const lines = rest
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0);
    if (heading) {
      sections.push({ heading, lines });
    }
  }

  return sections;
}

function lineSet(lines: string[]): Set<string> {
  return new Set(lines);
}

/** Line-set diff per ## section. Sections only in one side count as all added/removed. */
export function diffDigests(
  todayDigest: string,
  baselineDigest: string,
): DigestDiff {
  const today = parseDigestSections(todayDigest);
  const baseline = parseDigestSections(baselineDigest);

  const todayByHeading = new Map(today.map((s) => [s.heading, s]));
  const baselineByHeading = new Map(baseline.map((s) => [s.heading, s]));

  const headings = new Set([
    ...todayByHeading.keys(),
    ...baselineByHeading.keys(),
  ]);

  const addedOrChanged: SectionDiff[] = [];
  const unchanged: DigestSection[] = [];

  for (const heading of headings) {
    const now = todayByHeading.get(heading);
    const prior = baselineByHeading.get(heading);

    if (now && !prior) {
      addedOrChanged.push({
        heading,
        added: [...now.lines],
        removed: [],
      });
      continue;
    }
    if (prior && !now) {
      addedOrChanged.push({
        heading,
        added: [],
        removed: [...prior.lines],
      });
      continue;
    }
    if (!now || !prior) {
      continue;
    }

    const nowSet = lineSet(now.lines);
    const priorSet = lineSet(prior.lines);
    const added = now.lines.filter((line) => !priorSet.has(line));
    const removed = prior.lines.filter((line) => !nowSet.has(line));

    if (added.length === 0 && removed.length === 0) {
      unchanged.push(now);
    } else {
      addedOrChanged.push({ heading, added, removed });
    }
  }

  const hasChanges = addedOrChanged.some(
    (s) => s.added.length > 0 || s.removed.length > 0,
  );

  return { addedOrChanged, unchanged, hasChanges };
}

function formatLineBlock(lines: string[]): string {
  if (lines.length === 0) {
    return "(none)";
  }
  return lines.map((line) => `- ${line}`).join("\n");
}

function truncatePacket(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  const slice = text.slice(0, Math.max(0, maxChars - 1)).trimEnd();
  return `${slice}…`;
}

/** Compact continuity packet for the LLM user prompt. */
export function formatMemoryPacket(
  diff: DigestDiff,
  baseline: BriefRecord,
  maxChars: number = MEMORY_PACKET_MAX_CHARS,
): string {
  const blocks: string[] = [
    "## Memory",
    `Baseline: ${baseline.id} (${baseline.createdAt})`,
  ];

  const addedSections = diff.addedOrChanged.filter((s) => s.added.length > 0);
  if (addedSections.length > 0) {
    blocks.push("### Added");
    for (const section of addedSections) {
      blocks.push(`#### ${section.heading}`);
      blocks.push(formatLineBlock(section.added));
    }
  }

  const removedSections = diff.addedOrChanged.filter(
    (s) => s.removed.length > 0,
  );
  if (removedSections.length > 0) {
    blocks.push("### Removed");
    for (const section of removedSections) {
      blocks.push(`#### ${section.heading}`);
      blocks.push(formatLineBlock(section.removed));
    }
  }

  if (diff.unchanged.length > 0) {
    blocks.push("### Still open");
    for (const section of diff.unchanged) {
      blocks.push(`#### ${section.heading}`);
      const capped = section.lines.slice(0, UNCHANGED_SECTION_LINE_CAP);
      const extra = section.lines.length - capped.length;
      const body =
        capped.length > 0
          ? formatLineBlock(capped) +
            (extra > 0 ? `\n- … +${extra} more` : "")
          : "- (empty)";
      blocks.push(body);
    }
  }

  return truncatePacket(blocks.join("\n\n"), maxChars);
}

function isUsableBaseline(
  brief: BriefRecord,
  demo: boolean,
  now: Date,
): boolean {
  if (brief.demo !== demo) {
    return false;
  }
  if (brief.llmFailed) {
    return false;
  }
  if (!brief.digest.trim()) {
    return false;
  }
  const created = Date.parse(brief.createdAt);
  if (!Number.isFinite(created)) {
    return false;
  }
  if (now.getTime() - created > BASELINE_MAX_AGE_MS) {
    return false;
  }
  return true;
}

/** Newest brief that can serve as a digest baseline for this run. */
export async function findBaselineBrief(
  rootDir: string,
  demo: boolean,
  now: Date,
): Promise<BriefRecord | null> {
  const ids = await listBriefIds(rootDir);
  for (const id of ids) {
    const brief = await readBrief(rootDir, id);
    if (brief && isUsableBaseline(brief, demo, now)) {
      return brief;
    }
  }
  return null;
}

/**
 * Pick full / diff / unchanged from today's digest vs the latest usable prior brief.
 */
export async function resolveWakeDecision(input: {
  rootDir: string;
  demo: boolean;
  digest: string;
  now: Date;
}): Promise<WakeDecision> {
  const baseline = await findBaselineBrief(
    input.rootDir,
    input.demo,
    input.now,
  );

  if (!baseline) {
    return { mode: "full", baseline: null };
  }

  const diff = diffDigests(input.digest, baseline.digest);
  if (!diff.hasChanges) {
    return { mode: "unchanged", baseline };
  }

  return {
    mode: "diff",
    baseline,
    memoryPacket: formatMemoryPacket(diff, baseline),
  };
}
