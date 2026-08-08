import type { RoosterConfig } from "../config";
import type { TtsVoice } from "./voices";
import { writeBrief, writeBriefAudio } from "../store";
import type { BriefRecord } from "../types";
import type { WeatherSnapshot } from "../weather/types";
import { synthesizeSpeech } from "./openai-speech";
import { buildSpokenBrief } from "./speakable";

export interface BriefAudioContext {
  operatorName: string;
  ttsVoice: TtsVoice;
  timezone: string;
}

export function audioPrefsFromConfig(
  config: Pick<RoosterConfig, "operatorName" | "ttsVoice" | "timezone">,
): BriefAudioContext {
  return {
    operatorName: config.operatorName,
    ttsVoice: config.ttsVoice,
    timezone: config.timezone,
  };
}

/**
 * Shared speakable + synthesize used by the wake pipeline and on-demand generate.
 */
export async function synthesizeBriefMp3(options: {
  text: string;
  prefs: BriefAudioContext;
  now: Date;
  weather?: WeatherSnapshot;
  signal?: AbortSignal;
  log?: (message: string) => void;
}): Promise<Buffer> {
  const spoken = buildSpokenBrief({
    text: options.text,
    operatorName: options.prefs.operatorName,
    timezone: options.prefs.timezone,
    now: options.now,
    weather: options.weather,
  });
  return synthesizeSpeech({
    text: spoken,
    voice: options.prefs.ttsVoice,
    operatorName: options.prefs.operatorName,
    signal: options.signal,
    log: options.log,
  });
}

/**
 * Write MP3 under data/audio/ and return brief fields for persistence.
 * Does not rewrite the brief JSON — caller attaches fields and writes.
 */
export async function createBriefAudioFile(options: {
  rootDir: string;
  briefId: string;
  text: string;
  prefs: BriefAudioContext;
  now: Date;
  weather?: WeatherSnapshot;
  signal?: AbortSignal;
  log?: (message: string) => void;
}): Promise<{ audioRelativePath: string; ttsVoice: TtsVoice }> {
  const mp3 = await synthesizeBriefMp3({
    text: options.text,
    prefs: options.prefs,
    now: options.now,
    weather: options.weather,
    signal: options.signal,
    log: options.log,
  });
  const audioRelativePath = await writeBriefAudio(
    options.rootDir,
    options.briefId,
    mp3,
  );
  return {
    audioRelativePath,
    ttsVoice: options.prefs.ttsVoice,
  };
}

/** On-demand path: synthesize, write mp3, patch brief JSON. */
export async function generateAndPersistBriefAudio(options: {
  rootDir: string;
  brief: BriefRecord;
  prefs: BriefAudioContext;
  now?: Date;
  signal?: AbortSignal;
  log?: (message: string) => void;
}): Promise<BriefRecord> {
  const now = options.now ?? new Date();
  const audio = await createBriefAudioFile({
    rootDir: options.rootDir,
    briefId: options.brief.id,
    text: options.brief.text,
    prefs: options.prefs,
    now,
    // Prefer the snapshot from the original wake so regenerations stay consistent.
    weather: options.brief.weather,
    signal: options.signal,
    log: options.log,
  });

  const next: BriefRecord = {
    ...options.brief,
    audioRelativePath: audio.audioRelativePath,
    ttsVoice: audio.ttsVoice,
    ttsError: undefined,
  };
  await writeBrief(options.rootDir, next);
  return next;
}
