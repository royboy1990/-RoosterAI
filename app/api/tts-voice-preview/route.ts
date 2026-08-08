import { NextResponse } from "next/server";
import { synthesizeSpeech } from "@/src/core/tts/openai-speech";
import {
  OPERATOR_NAME_MAX,
  TTS_VOICES,
  ttsVoiceSchema,
  voicePreviewText,
  type TtsVoice,
} from "@/src/core/tts/voices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tts-voice-preview?voice=marin&name=Roy — short sample MP3 for Settings previews.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = ttsVoiceSchema.safeParse(url.searchParams.get("voice")?.trim());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: `Invalid voice. Expected one of: ${TTS_VOICES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const voice: TtsVoice = parsed.data;
  const operatorName = (url.searchParams.get("name") ?? "")
    .trim()
    .slice(0, OPERATOR_NAME_MAX);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is missing." },
      { status: 503 },
    );
  }

  try {
    const bytes = await synthesizeSpeech({
      text: voicePreviewText(operatorName),
      voice,
      operatorName,
      log: (message) => {
        console.log(message);
      },
    });
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        // Browser may reuse the same sample within a day; client also caches blobs.
        "Cache-Control": "private, max-age=86400",
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`tts voice preview failed (${voice}): ${message}`);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
