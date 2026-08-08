import { NextResponse } from "next/server";
import { runAsk } from "@/src/core/ask/ask";
import { loadConfig, resolveRootDir } from "@/src/core/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AskBody {
  message?: unknown;
  chatId?: unknown;
  sourceBriefId?: unknown;
}

/**
 * POST /api/ask — create or continue an evidence-grounded Ask thread.
 * Honors frozen contextBriefIds; refuses stub/demo-only LLM answers.
 */
export async function POST(request: Request): Promise<Response> {
  let body: AskBody;
  try {
    body = (await request.json()) as AskBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const message =
    typeof body.message === "string" ? body.message : "";
  const chatId =
    typeof body.chatId === "string" ? body.chatId.trim() : undefined;
  const sourceBriefId =
    typeof body.sourceBriefId === "string"
      ? body.sourceBriefId.trim()
      : undefined;

  try {
    const rootDir = resolveRootDir();
    const loaded = await loadConfig({ rootDir });
    const result = await runAsk(loaded, {
      message,
      chatId: chatId || undefined,
      sourceBriefId: sourceBriefId || undefined,
    });
    return NextResponse.json({
      ok: true,
      reply: result.reply,
      chatId: result.chatId,
      sourceBriefIds: result.sourceBriefIds,
      reused: result.reused === true,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const status =
      error.includes("disabled") ||
      error.includes("stub") ||
      error.includes("real LLM")
        ? 403
        : error.includes("not found") || error.includes("empty")
          ? 400
          : 500;
    return NextResponse.json({ ok: false, error }, { status });
  }
}
