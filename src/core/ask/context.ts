import { listBriefIds, readBrief, resolveSubstantiveBrief } from "../store";
import type { BriefRecord } from "../types";

/**
 * Build a frozen context window for a new Ask thread.
 * Always includes the source (substantive) brief, then preceding substantive
 * briefs in the same demo/real lane — skipping empty/unchanged shells.
 */
export async function buildContextBriefIds(input: {
  rootDir: string;
  sourceBriefId: string;
  demo: boolean;
  maxBriefs: number;
}): Promise<string[]> {
  const max = Math.max(1, Math.min(7, input.maxBriefs));
  const source = await readBrief(input.rootDir, input.sourceBriefId);
  if (!source || source.demo !== input.demo) {
    return [];
  }

  const body = await resolveSubstantiveBrief(input.rootDir, source);
  if (body.demo !== input.demo) {
    return [];
  }

  const ids: string[] = [body.id];
  if (ids.length >= max) {
    return ids;
  }

  const allIds = await listBriefIds(input.rootDir);
  for (const id of allIds) {
    if (ids.length >= max) {
      break;
    }
    if (ids.includes(id)) {
      continue;
    }
    const brief = await readBrief(input.rootDir, id);
    if (!brief || brief.demo !== input.demo) {
      continue;
    }
    // Only take briefs that are older than (or equal to) the source body.
    if (brief.createdAt > body.createdAt) {
      continue;
    }
    const substantive = await resolveSubstantiveBrief(input.rootDir, brief);
    if (substantive.demo !== input.demo) {
      continue;
    }
    if (ids.includes(substantive.id)) {
      continue;
    }
    // Skip empty pointer shells that resolved to something we already have,
    // and skip briefs with no usable body text.
    if (!substantive.text.trim()) {
      continue;
    }
    ids.push(substantive.id);
  }

  return ids;
}

/** Load briefs for a frozen id list (order preserved; missing ids dropped). */
export async function loadContextBriefs(
  rootDir: string,
  contextBriefIds: string[],
): Promise<BriefRecord[]> {
  const briefs: BriefRecord[] = [];
  for (const id of contextBriefIds) {
    const brief = await readBrief(rootDir, id);
    if (brief) {
      briefs.push(brief);
    }
  }
  return briefs;
}
