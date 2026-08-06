import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BriefRecord } from "./types";

function briefsDir(rootDir: string): string {
  return path.join(rootDir, "data", "briefs");
}

function logPath(rootDir: string): string {
  return path.join(rootDir, "data", "rooster.log");
}

/** Filesystem-safe ISO timestamp stem, e.g. 2026-08-06T07-00-00.000Z */
export function toBriefId(date: Date): string {
  return date.toISOString().replace(/:/g, "-");
}

export async function ensureDataDirs(rootDir: string): Promise<void> {
  await mkdir(briefsDir(rootDir), { recursive: true });
}

export async function writeBrief(
  rootDir: string,
  brief: BriefRecord,
): Promise<string> {
  await ensureDataDirs(rootDir);
  const filePath = path.join(briefsDir(rootDir), `${brief.id}.json`);
  await writeFile(filePath, `${JSON.stringify(brief, null, 2)}\n`, "utf8");
  return filePath;
}

export async function readBrief(
  rootDir: string,
  id: string,
): Promise<BriefRecord | null> {
  try {
    const raw = await readFile(
      path.join(briefsDir(rootDir), `${id}.json`),
      "utf8",
    );
    return JSON.parse(raw) as BriefRecord;
  } catch {
    return null;
  }
}

export async function listBriefIds(rootDir: string): Promise<string[]> {
  try {
    const names = await readdir(briefsDir(rootDir));
    return names
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.slice(0, -".json".length))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export async function readLatestBrief(
  rootDir: string,
): Promise<BriefRecord | null> {
  const ids = await listBriefIds(rootDir);
  if (ids.length === 0) {
    return null;
  }
  return readBrief(rootDir, ids[0]!);
}

export async function appendLog(
  rootDir: string,
  message: string,
): Promise<void> {
  await ensureDataDirs(rootDir);
  const line = `[${new Date().toISOString()}] ${message}\n`;
  await appendFile(logPath(rootDir), line, "utf8");
}
