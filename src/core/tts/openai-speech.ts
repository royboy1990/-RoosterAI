import type { TtsVoice } from "./voices";

/** Always OpenAI's speech host — independent of OPENAI_BASE_URL used for chat. */
const OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech";
export const SPEECH_MODEL = "gpt-4o-mini-tts";
/** Typical OpenAI speech input limit; briefs usually fit. */
export const SPEECH_INPUT_MAX_CHARS = 4096;

export interface SynthesizeSpeechResult {
  buffer: Buffer;
  /** Characters actually sent after truncation. */
  inputChars: number;
  model: string;
}

export interface SynthesizeSpeechInput {
  text: string;
  voice: TtsVoice;
  /** When set, instructions also say to address the listener by name. */
  operatorName?: string;
  signal?: AbortSignal;
  log?: (message: string) => void;
}

function buildInstructions(operatorName: string): string {
  const base =
    "Speak as a calm morning briefing. Steady pace, clear diction, no theatrics or humor. Slightly warm, professional, concise.";
  const name = operatorName.trim();
  if (name.length > 0) {
    return `${base} Address the listener as ${name} when the script greets them by name.`;
  }
  return base;
}

/**
 * gpt-4o-mini-tts → MP3 buffer via POST /v1/audio/speech.
 * Requires OPENAI_API_KEY in the environment.
 */
export async function synthesizeSpeech(
  input: SynthesizeSpeechInput,
): Promise<SynthesizeSpeechResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing — cannot synthesize speech.");
  }

  let text = input.text.trim();
  if (!text) {
    throw new Error("Speech text is empty.");
  }
  if (text.length > SPEECH_INPUT_MAX_CHARS) {
    input.log?.(
      `tts: truncating speakable text from ${text.length} to ${SPEECH_INPUT_MAX_CHARS} chars`,
    );
    text = `${text.slice(0, SPEECH_INPUT_MAX_CHARS - 1).trimEnd()}…`;
  }

  input.log?.(
    `tts openai: POST ${OPENAI_SPEECH_URL} model=${SPEECH_MODEL} voice=${input.voice}`,
  );

  const res = await fetch(OPENAI_SPEECH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SPEECH_MODEL,
      voice: input.voice,
      input: text,
      instructions: buildInstructions(input.operatorName ?? ""),
      response_format: "mp3",
    }),
    signal: input.signal,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const raw = (await res.json()) as { error?: { message?: string } };
      detail = raw.error?.message ?? detail;
    } catch {
      // Non-JSON error body — keep statusText.
    }
    throw new Error(`OpenAI speech ${res.status}: ${detail}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    inputChars: text.length,
    model: SPEECH_MODEL,
  };
}
