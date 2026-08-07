"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  deleteLocalTrack,
  listLocalTrackRecords,
  putLocalTrack,
  recordsToPlayable,
  validateAudioFile,
} from "@/src/rooster-fm/local-library";
import {
  roosterFmPlaylist,
  type RoosterFmTrack,
} from "@/src/rooster-fm/playlist";

const STORAGE_VOLUME = "rooster-fm-volume";
const STORAGE_VISUALS = "rooster-fm-visuals";
const STORAGE_HIDDEN_BUILTIN = "rooster-fm-hidden-builtin";
const STORAGE_START_ON_LOAD = "rooster-fm-start-on-load";
const STORAGE_POSITION = "rooster-fm-position";
const DEFAULT_VOLUME = 0.5;
const DUCK_LEVEL = 0.18;
const UNDUCK_MS = 320;
const POSITION_PERSIST_MS = 2000;
/** Mid-track resume only for recent leaves (refresh / short break). Older → same track, start over. */
const POSITION_RESUME_MAX_AGE_MS = 10 * 60 * 1000;

type StoredPosition = {
  trackId: string;
  time: number;
  savedAt: number;
};

interface RoosterFMContextValue {
  isPlaying: boolean;
  trackIndex: number;
  track: RoosterFmTrack | null;
  playlist: readonly RoosterFmTrack[];
  analyser: AnalyserNode | null;
  visualsEnabled: boolean;
  volume: number;
  duckFactor: number;
  startOnLoad: boolean;
  libraryMessage: string | null;
  hiddenBuiltinIds: readonly string[];
  toggle: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (volume: number) => void;
  toggleVisuals: () => void;
  setStartOnLoad: (enabled: boolean) => void;
  addLocalFiles: (files: FileList | File[]) => Promise<void>;
  removeTrack: (id: string) => Promise<void>;
  restoreBuiltinTrack: (id: string) => void;
  clearLibraryMessage: () => void;
  duck: () => void;
  unduck: () => void;
}

const RoosterFMContext = createContext<RoosterFMContextValue | null>(null);

function clampVolume(value: number): number {
  if (Number.isNaN(value)) {
    return DEFAULT_VOLUME;
  }
  return Math.min(1, Math.max(0, value));
}

function readStoredVolume(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_VOLUME);
    if (raw === null) {
      return DEFAULT_VOLUME;
    }
    return clampVolume(Number.parseFloat(raw));
  } catch {
    return DEFAULT_VOLUME;
  }
}

function readStoredVisuals(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_VISUALS);
    if (raw === null) {
      return true;
    }
    return raw === "1";
  } catch {
    return true;
  }
}

function readStoredStartOnLoad(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_START_ON_LOAD);
    if (raw === null) {
      return false;
    }
    return raw === "1";
  } catch {
    return false;
  }
}

function readStoredHiddenBuiltin(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_HIDDEN_BUILTIN);
    if (raw === null) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function readStoredPosition(): StoredPosition | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_POSITION);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("trackId" in parsed) ||
      !("time" in parsed)
    ) {
      return null;
    }
    const trackId = (parsed as { trackId: unknown }).trackId;
    const time = (parsed as { time: unknown }).time;
    const savedAt = (parsed as { savedAt?: unknown }).savedAt;
    if (typeof trackId !== "string" || typeof time !== "number") {
      return null;
    }
    if (!Number.isFinite(time) || time < 0) {
      return null;
    }
    // Missing/invalid savedAt → treat as stale (pre-TTL writes or corruption).
    const at =
      typeof savedAt === "number" && Number.isFinite(savedAt) ? savedAt : 0;
    return { trackId, time, savedAt: at };
  } catch {
    return null;
  }
}

function writeStoredPosition(position: StoredPosition): void {
  try {
    window.localStorage.setItem(STORAGE_POSITION, JSON.stringify(position));
  } catch {
    // Ignore quota / private mode failures.
  }
}

function isFreshResume(position: StoredPosition): boolean {
  return Date.now() - position.savedAt <= POSITION_RESUME_MAX_AGE_MS;
}

function applySeekWhenReady(audio: HTMLAudioElement, time: number): void {
  const seek = () => {
    const duration = audio.duration;
    if (Number.isFinite(duration) && duration > 0) {
      // Leave a hair before the end so `ended` still fires normally.
      audio.currentTime = Math.min(time, Math.max(0, duration - 0.35));
      return;
    }
    audio.currentTime = time;
  };

  if (audio.readyState >= 1) {
    seek();
    return;
  }
  audio.addEventListener("loadedmetadata", seek, { once: true });
}

function toFileArray(files: FileList | File[]): File[] {
  return Array.from(files);
}

function clampTrackIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(index, length - 1));
}

export function RoosterFMProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const unduckTimerRef = useRef<number | null>(null);
  const duckFactorRef = useRef(1);
  const volumeRef = useRef(DEFAULT_VOLUME);
  const trackIndexRef = useRef(0);
  const isPlayingRef = useRef(false);
  const objectUrlsRef = useRef<string[]>([]);
  const hiddenBuiltinIdsRef = useRef<string[]>([]);
  const startOnLoadRef = useRef(false);
  /** One-shot gate — must not re-fire after pause / playTrackAt identity churn. */
  const startOnLoadHandledRef = useRef(false);
  /** Seek once after refresh restore; cleared when applied or skipped. */
  const pendingSeekRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const [localTracks, setLocalTracks] = useState<RoosterFmTrack[]>([]);
  const [hiddenBuiltinIds, setHiddenBuiltinIds] = useState<string[]>([]);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [visualsEnabled, setVisualsEnabled] = useState(true);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
  const [duckFactor, setDuckFactor] = useState(1);
  const [startOnLoad, setStartOnLoadState] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);
  const [libraryReady, setLibraryReady] = useState(false);
  const [resumeReady, setResumeReady] = useState(false);
  const [libraryMessage, setLibraryMessage] = useState<string | null>(null);

  useEffect(() => {
    hiddenBuiltinIdsRef.current = hiddenBuiltinIds;
  }, [hiddenBuiltinIds]);

  useEffect(() => {
    startOnLoadRef.current = startOnLoad;
  }, [startOnLoad]);

  const builtinTracks = roosterFmPlaylist.filter(
    (entry) => !hiddenBuiltinIds.includes(entry.id),
  );
  const playlist = [...builtinTracks, ...localTracks];
  const track = playlist[trackIndex] ?? null;
  const singleTrack = playlist.length <= 1;

  const revokeObjectUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current = [];
  }, []);

  const applyLocalRecords = useCallback(
    (records: Awaited<ReturnType<typeof listLocalTrackRecords>>) => {
      revokeObjectUrls();
      const { tracks, urls } = recordsToPlayable(records);
      objectUrlsRef.current = urls;
      setLocalTracks(tracks);
      setTrackIndex((prev) => {
        const builtinCount = roosterFmPlaylist.filter(
          (entry) => !hiddenBuiltinIdsRef.current.includes(entry.id),
        ).length;
        const next = clampTrackIndex(prev, builtinCount + tracks.length);
        trackIndexRef.current = next;
        return next;
      });
    },
    [revokeObjectUrls],
  );

  const applyGain = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.volume = clampVolume(volumeRef.current * duckFactorRef.current);
  }, []);

  const setDuckFactorSmooth = useCallback(
    (next: number, fadeMs = 0) => {
      if (unduckTimerRef.current !== null) {
        window.clearInterval(unduckTimerRef.current);
        unduckTimerRef.current = null;
      }

      if (fadeMs <= 0) {
        duckFactorRef.current = next;
        setDuckFactor(next);
        applyGain();
        return;
      }

      const from = duckFactorRef.current;
      const started = performance.now();
      unduckTimerRef.current = window.setInterval(() => {
        const t = Math.min(1, (performance.now() - started) / fadeMs);
        const value = from + (next - from) * t;
        duckFactorRef.current = value;
        setDuckFactor(value);
        applyGain();
        if (t >= 1 && unduckTimerRef.current !== null) {
          window.clearInterval(unduckTimerRef.current);
          unduckTimerRef.current = null;
        }
      }, 32);
    },
    [applyGain],
  );

  const ensureGraph = useCallback(async (): Promise<boolean> => {
    const audio = audioRef.current;
    if (!audio) {
      return false;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) {
      return false;
    }

    if (!ctxRef.current) {
      ctxRef.current = new AudioCtx();
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    if (!sourceRef.current) {
      const source = ctx.createMediaElementSource(audio);
      const node = ctx.createAnalyser();
      node.fftSize = 128;
      node.smoothingTimeConstant = 0.85;
      source.connect(node);
      node.connect(ctx.destination);
      sourceRef.current = source;
      analyserRef.current = node;
      setAnalyser(node);
    }

    return true;
  }, []);

  // Hydrate prefs + personal library after mount (SSR-safe).
  useEffect(() => {
    const nextVolume = readStoredVolume();
    const nextVisuals = readStoredVisuals();
    const nextHidden = readStoredHiddenBuiltin();
    const nextStartOnLoad = readStoredStartOnLoad();
    volumeRef.current = nextVolume;
    hiddenBuiltinIdsRef.current = nextHidden;
    setVolumeState(nextVolume);
    setVisualsEnabled(nextVisuals);
    setHiddenBuiltinIds(nextHidden);
    setStartOnLoadState(nextStartOnLoad);
    setPrefsReady(true);
    applyGain();

    let cancelled = false;
    void listLocalTrackRecords()
      .then((records) => {
        if (!cancelled) {
          applyLocalRecords(records);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLibraryMessage("Could not load your local Rooster FM library.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLibraryReady(true);
        }
      });

    return () => {
      cancelled = true;
      revokeObjectUrls();
    };
  }, [applyGain, applyLocalRecords, revokeObjectUrls]);

  // Restore last track + scrub position once the playlist is known.
  useEffect(() => {
    if (!prefsReady || !libraryReady || resumeReady) {
      return;
    }

    const visible = [
      ...roosterFmPlaylist.filter(
        (entry) => !hiddenBuiltinIds.includes(entry.id),
      ),
      ...localTracks,
    ];
    const stored = readStoredPosition();
    if (stored) {
      const idx = visible.findIndex((entry) => entry.id === stored.trackId);
      if (idx >= 0) {
        trackIndexRef.current = idx;
        setTrackIndex(idx);
        // Refresh / short break: resume scrub. Hours later: same track, from the top.
        if (stored.time > 1 && isFreshResume(stored)) {
          pendingSeekRef.current = stored.time;
        }
      }
    }

    setResumeReady(true);
  }, [
    prefsReady,
    libraryReady,
    resumeReady,
    hiddenBuiltinIds,
    localTracks,
  ]);

  useEffect(() => {
    if (!prefsReady) {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_VOLUME, String(volume));
      window.localStorage.setItem(
        STORAGE_VISUALS,
        visualsEnabled ? "1" : "0",
      );
      window.localStorage.setItem(
        STORAGE_HIDDEN_BUILTIN,
        JSON.stringify(hiddenBuiltinIds),
      );
      window.localStorage.setItem(
        STORAGE_START_ON_LOAD,
        startOnLoad ? "1" : "0",
      );
    } catch {
      // Ignore quota / private mode failures.
    }
  }, [prefsReady, volume, visualsEnabled, hiddenBuiltinIds, startOnLoad]);

  // Keep index valid when the visible playlist shrinks (hide seed / remove local).
  useEffect(() => {
    const next = clampTrackIndex(trackIndexRef.current, playlist.length);
    if (next !== trackIndexRef.current) {
      trackIndexRef.current = next;
      setTrackIndex(next);
    }
    if (playlist.length === 0) {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        audio.pause();
      }
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
  }, [playlist.length]);

  const trackId = track?.id;
  const trackSrc = track?.src;

  const playTrackAt = useCallback(
    async (index: number): Promise<boolean> => {
      if (playlist.length === 0) {
        return false;
      }
      const nextIndex =
        ((index % playlist.length) + playlist.length) % playlist.length;
      const nextTrack = playlist[nextIndex];
      if (!nextTrack) {
        return false;
      }

      trackIndexRef.current = nextIndex;
      setTrackIndex(nextIndex);

      const audio = audioRef.current;
      if (!audio) {
        return false;
      }

      const resumeAt = pendingSeekRef.current;
      if (resumeAt !== null) {
        pendingSeekRef.current = null;
      }

      if (
        audio.dataset.trackId !== nextTrack.id ||
        audio.getAttribute("src") !== nextTrack.src
      ) {
        audio.dataset.trackId = nextTrack.id;
        audio.src = nextTrack.src;
        audio.load();
      }
      // Same track: keep currentTime (refresh resume). Single-track next/prev
      // restarts explicitly before calling playTrackAt.

      if (resumeAt !== null && resumeAt > 0) {
        applySeekWhenReady(audio, resumeAt);
      }

      const ok = await ensureGraph();
      if (!ok) {
        return false;
      }
      applyGain();
      try {
        await audio.play();
        isPlayingRef.current = true;
        setIsPlaying(true);
        return true;
      } catch {
        isPlayingRef.current = false;
        setIsPlaying(false);
        return false;
      }
    },
    [applyGain, ensureGraph, playlist],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !trackId || !trackSrc) {
      return;
    }

    // Reload when the track identity or blob URL changes (IDB refresh revokes old URLs).
    if (
      audio.dataset.trackId !== trackId ||
      audio.getAttribute("src") !== trackSrc
    ) {
      audio.dataset.trackId = trackId;
      audio.src = trackSrc;
      audio.load();
      if (isPlayingRef.current) {
        void audio.play().catch(() => {
          isPlayingRef.current = false;
          setIsPlaying(false);
        });
      }
    }

    const resumeAt = pendingSeekRef.current;
    if (resumeAt !== null && resumeAt > 0 && audio.dataset.trackId === trackId) {
      pendingSeekRef.current = null;
      applySeekWhenReady(audio, resumeAt);
    }
  }, [trackId, trackSrc]);

  // Persist scrub position so refresh can resume mid-track.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    let lastWrite = 0;
    const persist = () => {
      const id = audio.dataset.trackId;
      if (!id) {
        return;
      }
      const time = audio.currentTime;
      if (!Number.isFinite(time) || time < 0) {
        return;
      }
      writeStoredPosition({ trackId: id, time, savedAt: Date.now() });
    };

    const onTimeUpdate = () => {
      const now = Date.now();
      if (now - lastWrite < POSITION_PERSIST_MS) {
        return;
      }
      lastWrite = now;
      persist();
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("pause", persist);
    window.addEventListener("pagehide", persist);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("pause", persist);
      window.removeEventListener("pagehide", persist);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const onPlay = () => {
      isPlayingRef.current = true;
      setIsPlaying(true);
    };
    const onPause = () => {
      // load()/src swaps fire a transient pause — only sync if still paused.
      window.requestAnimationFrame(() => {
        if (audio.paused) {
          isPlayingRef.current = false;
          setIsPlaying(false);
        }
      });
    };
    const onEnded = () => {
      if (playlist.length <= 1) {
        return;
      }
      void playTrackAt(trackIndexRef.current + 1);
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [playlist.length, playTrackAt]);

  useEffect(() => {
    return () => {
      if (unduckTimerRef.current !== null) {
        window.clearInterval(unduckTimerRef.current);
      }
      void ctxRef.current?.close().catch(() => undefined);
    };
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || playlist.length === 0) {
      return;
    }

    if (!audio.paused) {
      audio.pause();
      isPlayingRef.current = false;
      setIsPlaying(false);
      return;
    }

    void (async () => {
      const ok = await ensureGraph();
      if (!ok) {
        return;
      }
      applyGain();
      try {
        await audio.play();
        isPlayingRef.current = true;
        setIsPlaying(true);
      } catch {
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
    })();
  }, [applyGain, ensureGraph, playlist.length]);

  const next = useCallback(() => {
    if (playlist.length === 0) {
      return;
    }
    if (playlist.length === 1) {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
      }
      void playTrackAt(trackIndexRef.current);
      return;
    }
    void playTrackAt(trackIndexRef.current + 1);
  }, [playTrackAt, playlist.length]);

  const prev = useCallback(() => {
    if (playlist.length === 0) {
      return;
    }
    if (playlist.length === 1) {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
      }
      void playTrackAt(trackIndexRef.current);
      return;
    }
    void playTrackAt(trackIndexRef.current - 1);
  }, [playTrackAt, playlist.length]);

  const setVolume = useCallback(
    (nextVolume: number) => {
      const clamped = clampVolume(nextVolume);
      volumeRef.current = clamped;
      setVolumeState(clamped);
      applyGain();
    },
    [applyGain],
  );

  const toggleVisuals = useCallback(() => {
    setVisualsEnabled((prev) => !prev);
  }, []);

  const setStartOnLoad = useCallback((enabled: boolean) => {
    setStartOnLoadState(enabled);
  }, []);

  const playTrackAtRef = useRef(playTrackAt);
  playTrackAtRef.current = playTrackAt;

  // Prefer autoplay on open; if the browser blocks it, start on the next gesture.
  // Do not depend on `playTrackAt` — it is recreated every render (fresh `playlist`
  // array) and was re-triggering play after pause (seek to 0 via playTrackAt).
  // Wait for resumeReady so we seek mid-track before the first play attempt.
  useEffect(() => {
    if (!startOnLoad) {
      startOnLoadHandledRef.current = false;
      return;
    }
    if (!resumeReady || startOnLoadHandledRef.current) {
      return;
    }
    if (playlist.length === 0) {
      return;
    }

    let cancelled = false;
    let waitingForGesture = false;

    const markHandled = () => {
      startOnLoadHandledRef.current = true;
    };

    const detach = () => {
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("keydown", onGesture, true);
      waitingForGesture = false;
    };

    const onGesture = () => {
      if (cancelled || !startOnLoadRef.current || isPlayingRef.current) {
        detach();
        return;
      }
      detach();
      markHandled();
      void playTrackAtRef.current(trackIndexRef.current);
    };

    const armGestureStart = () => {
      if (cancelled || waitingForGesture || isPlayingRef.current) {
        return;
      }
      waitingForGesture = true;
      window.addEventListener("pointerdown", onGesture, true);
      window.addEventListener("keydown", onGesture, true);
    };

    // Arm first — autoplay usually fails, and a click during the attempt should still count.
    armGestureStart();
    void (async () => {
      const started = await playTrackAtRef.current(trackIndexRef.current);
      if (cancelled) {
        return;
      }
      if (started) {
        markHandled();
        detach();
      }
    })();

    return () => {
      cancelled = true;
      detach();
    };
  }, [resumeReady, startOnLoad, playlist.length]);

  const addLocalFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = toFileArray(files);
      if (list.length === 0) {
        return;
      }

      let added = 0;
      const errors: string[] = [];

      for (const file of list) {
        const invalid = validateAudioFile(file);
        if (invalid) {
          errors.push(`${file.name}: ${invalid}`);
          continue;
        }
        try {
          await putLocalTrack(file);
          added += 1;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Could not save track.";
          errors.push(`${file.name}: ${message}`);
        }
      }

      if (added > 0) {
        const records = await listLocalTrackRecords();
        applyLocalRecords(records);
        // Jump to the first newly appended local track.
        const builtinCount = roosterFmPlaylist.filter(
          (entry) => !hiddenBuiltinIdsRef.current.includes(entry.id),
        ).length;
        const nextIndex = builtinCount + records.length - added;
        trackIndexRef.current = Math.max(0, nextIndex);
        setTrackIndex(Math.max(0, nextIndex));
      }

      if (errors.length > 0 && added === 0) {
        setLibraryMessage(errors[0] ?? "Could not add tracks.");
      } else if (errors.length > 0) {
        setLibraryMessage(
          `Added ${added}. Skipped ${errors.length} file${errors.length === 1 ? "" : "s"}.`,
        );
      } else if (added > 0) {
        setLibraryMessage(
          added === 1
            ? "Track added to your local library."
            : `${added} tracks added to your local library.`,
        );
      }
    },
    [applyLocalRecords],
  );

  const removeTrack = useCallback(
    async (id: string) => {
      const isLocal = localTracks.some((entry) => entry.id === id);
      if (isLocal) {
        await deleteLocalTrack(id);
        const records = await listLocalTrackRecords();
        applyLocalRecords(records);
        setLibraryMessage("Removed from your local library.");
        return;
      }

      // Soft-hide built-in seed — MP3 stays in public/audio for the project.
      const hidden = hiddenBuiltinIdsRef.current;
      const oldPlaylist = [
        ...roosterFmPlaylist.filter((entry) => !hidden.includes(entry.id)),
        ...localTracks,
      ];
      const removedIndex = oldPlaylist.findIndex((entry) => entry.id === id);

      const nextHidden = hidden.includes(id) ? hidden : [...hidden, id];
      hiddenBuiltinIdsRef.current = nextHidden;
      setHiddenBuiltinIds(nextHidden);

      if (removedIndex >= 0) {
        setTrackIndex((prev) => {
          const nextLength = Math.max(0, oldPlaylist.length - 1);
          let next = prev;
          if (prev > removedIndex) {
            next = prev - 1;
          } else if (prev === removedIndex) {
            next = Math.min(prev, Math.max(0, nextLength - 1));
          }
          next = clampTrackIndex(next, nextLength);
          trackIndexRef.current = next;
          return next;
        });
      }

      setLibraryMessage(
        "Hidden from your player. The seed file stays in the project.",
      );
    },
    [applyLocalRecords, localTracks],
  );

  const restoreBuiltinTrack = useCallback((id: string) => {
    const nextHidden = hiddenBuiltinIdsRef.current.filter(
      (entry) => entry !== id,
    );
    hiddenBuiltinIdsRef.current = nextHidden;
    setHiddenBuiltinIds(nextHidden);
    setLibraryMessage("Seed track restored to your player.");
  }, []);

  const clearLibraryMessage = useCallback(() => {
    setLibraryMessage(null);
  }, []);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const duck = useCallback(() => {
    if (!isPlayingRef.current) {
      return;
    }
    setDuckFactorSmooth(DUCK_LEVEL, 120);
  }, [setDuckFactorSmooth]);

  const unduck = useCallback(() => {
    setDuckFactorSmooth(1, UNDUCK_MS);
  }, [setDuckFactorSmooth]);

  const value: RoosterFMContextValue = {
    isPlaying,
    trackIndex,
    track,
    playlist,
    analyser,
    visualsEnabled,
    volume,
    duckFactor,
    startOnLoad,
    libraryMessage,
    hiddenBuiltinIds,
    toggle,
    next,
    prev,
    setVolume,
    toggleVisuals,
    setStartOnLoad,
    addLocalFiles,
    removeTrack,
    restoreBuiltinTrack,
    clearLibraryMessage,
    duck,
    unduck,
  };

  return (
    <RoosterFMContext.Provider value={value}>
      <audio
        ref={audioRef}
        loop={singleTrack}
        preload="none"
        className="hidden"
      />
      {children}
    </RoosterFMContext.Provider>
  );
}

export function useRoosterFM(): RoosterFMContextValue {
  const ctx = useContext(RoosterFMContext);
  if (!ctx) {
    throw new Error("useRoosterFM must be used within RoosterFMProvider");
  }
  return ctx;
}

/** Soft read for crow-duck — avoids HMR crashes if the provider remounts. */
export function useRoosterFMOptional(): RoosterFMContextValue | null {
  return useContext(RoosterFMContext);
}
