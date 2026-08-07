import { z } from "zod";

/** Built-in OpenAI gpt-4o-mini-tts voices. */
export const TTS_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "cedar",
  "coral",
  "echo",
  "fable",
  "marin",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
] as const;

export const ttsVoiceSchema = z.enum(TTS_VOICES);
export type TtsVoice = z.infer<typeof ttsVoiceSchema>;

export const ttsModeSchema = z.enum(["each-wake", "on-demand"]);
export type TtsMode = z.infer<typeof ttsModeSchema>;

export const OPERATOR_NAME_MAX = 40;

/** Short fixed line for Settings voice previews (keeps TTS cost tiny). */
export const VOICE_PREVIEW_TEXT =
  "Good morning. This is your Rooster brief voice.";
