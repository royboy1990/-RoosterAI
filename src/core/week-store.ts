import {
  mkdir,
  open,
  readdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import type { WeeklyRecord } from "./types";

function weeksDir(rootDir: string): string {
  return path.join(rootDir, "data", "weeks");
}

function weekFilePath(rootDir: string, id: string): string {
  return path.join(weeksDir(rootDir), `${id}.json`);
}

function leasePath(rootDir: string, id: string): string {
  return path.join(weeksDir(rootDir), `${id}.generating`);
}

export async function ensureWeeksDir(rootDir: string): Promise<void> {
  await mkdir(weeksDir(rootDir), { recursive: true });
}

export async function writeWeek(
  rootDir: string,
  week: WeeklyRecord,
): Promise<string> {
  await ensureWeeksDir(rootDir);
  const filePath = weekFilePath(rootDir, week.id);
  await writeFile(filePath, `${JSON.stringify(week, null, 2)}\n`, "utf8");
  return filePath;
}

export async function readWeek(
  rootDir: string,
  id: string,
): Promise<WeeklyRecord | null> {
  try {
    const raw = await readFile(weekFilePath(rootDir, id), "utf8");
    return JSON.parse(raw) as WeeklyRecord;
  } catch {
    return null;
  }
}

/** Newest-first week ids (json stems only — not lease files). */
export async function listWeekIds(rootDir: string): Promise<string[]> {
  try {
    const names = await readdir(weeksDir(rootDir));
    return names
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.slice(0, -".json".length))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/** Successful week = no generationError and has renderable content or empty signals after success. */
export function isSuccessfulWeek(week: WeeklyRecord): boolean {
  return !week.generationError;
}

/** Archive-visible: successful weeks only (hide failed/cooldown stubs). */
export function isArchiveVisibleWeek(week: WeeklyRecord): boolean {
  if (week.generationError) {
    return false;
  }
  // Empty successful week is rare but allowed; hide if nothing to show.
  return (
    week.signals.length > 0 ||
    week.carryForward.length > 0 ||
    week.text.trim().length > 0
  );
}

/**
 * Atomic lease: exclusive-create `data/weeks/<id>.generating`.
 * Returns true if this caller holds the lease; false if another holder exists.
 */
export async function tryAcquireWeekLease(
  rootDir: string,
  id: string,
): Promise<boolean> {
  await ensureWeeksDir(rootDir);
  const pathName = leasePath(rootDir, id);
  try {
    const handle = await open(pathName, "wx");
    await handle.writeFile(
      `${JSON.stringify({ startedAt: new Date().toISOString() })}\n`,
      "utf8",
    );
    await handle.close();
    return true;
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
    if (code === "EEXIST") {
      return false;
    }
    throw err;
  }
}

export async function releaseWeekLease(
  rootDir: string,
  id: string,
): Promise<void> {
  try {
    await unlink(leasePath(rootDir, id));
  } catch {
    // Already gone — fine.
  }
}

/**
 * Keep the newest `keep` successful weeks for a demo/real lane; delete older
 * successful records. Failed attempt records are retained (cooldown) and do
 * not count toward retention slots.
 */
export async function pruneOldWeeks(
  rootDir: string,
  demo: boolean,
  keep = 12,
): Promise<string[]> {
  const ids = await listWeekIds(rootDir);
  const successful: WeeklyRecord[] = [];

  for (const id of ids) {
    const week = await readWeek(rootDir, id);
    if (!week || week.demo !== demo) {
      continue;
    }
    if (!isSuccessfulWeek(week)) {
      continue;
    }
    successful.push(week);
  }

  // Newest first by weekStart then createdAt.
  successful.sort((a, b) => {
    if (a.weekStart !== b.weekStart) {
      return a.weekStart < b.weekStart ? 1 : -1;
    }
    return a.createdAt < b.createdAt ? 1 : -1;
  });

  const pruned: string[] = [];
  for (const week of successful.slice(keep)) {
    try {
      await unlink(weekFilePath(rootDir, week.id));
      pruned.push(week.id);
    } catch {
      // Ignore missing files.
    }
  }
  return pruned;
}
