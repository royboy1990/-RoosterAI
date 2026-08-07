import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { resolveRootDir } from "@/src/core/config";
import { readBrief } from "@/src/core/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Brief ids are ISO stems with digits, letters, T, Z, dots, and hyphens. */
const BRIEF_ID_RE = /^[A-Za-z0-9._-]+$/;

/**
 * GET /api/brief-audio/[id] — serve data/audio/<id>.mp3 (never from public/).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: rawId } = await context.params;
  const id = decodeURIComponent(rawId ?? "").trim();
  if (!id || !BRIEF_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid brief id" }, { status: 400 });
  }

  const rootDir = resolveRootDir();
  const brief = await readBrief(rootDir, id);
  if (!brief) {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }

  const audioRoot = path.resolve(rootDir, "data", "audio");
  const filePath = path.resolve(audioRoot, `${id}.mp3`);
  if (!filePath.startsWith(audioRoot + path.sep) && filePath !== audioRoot) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  }

  const bytes = await readFile(filePath);
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, no-store",
      "Content-Length": String(bytes.byteLength),
    },
  });
}
