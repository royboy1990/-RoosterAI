import { timingSafeEqual } from "node:crypto";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { NextResponse } from "next/server";
import { copy } from "@/src/copy";
import { loadConfig, resolveRootDir } from "@/src/core/config";
import { runPipeline } from "@/src/core/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Length-safe bearer compare. Different lengths always fail without throwing
 * from timingSafeEqual (which requires equal Buffer lengths).
 */
function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

function extractBearer(authorization: string | null): string | null {
  if (!authorization) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() || null;
}

/**
 * POST /api/run — external cron / HTTP trigger.
 * Requires Authorization: Bearer <ROOSTER_RUN_TOKEN>.
 * Refuses to run when ROOSTER_RUN_TOKEN is unset (never defaults open).
 */
export async function POST(request: Request): Promise<Response> {
  loadDotenv({ path: path.join(resolveRootDir(), ".env"), quiet: true });

  const expected = process.env.ROOSTER_RUN_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "ROOSTER_RUN_TOKEN is unset. Refusing to run — set it in `.env` before exposing this route.",
      },
      { status: 503 },
    );
  }

  const token = extractBearer(request.headers.get("authorization"));
  if (!token || !tokensMatch(token, expected)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const loaded = await loadConfig();
    const brief = await runPipeline(loaded);
    return NextResponse.json({
      ok: true,
      message: copy.wake.success,
      briefId: brief.id,
      status: brief.status,
      demo: brief.demo,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, message: copy.wake.failed, error: message },
      { status: 500 },
    );
  }
}
