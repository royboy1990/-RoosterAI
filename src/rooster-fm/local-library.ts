/** Browser-only personal tracks (IndexedDB). Never written to the repo. */

const DB_NAME = "rooster-fm-library";
const DB_VERSION = 1;
const STORE = "tracks";
const MAX_BYTES = 25 * 1024 * 1024;

export interface LocalTrackRecord {
  id: string;
  title: string;
  artist: string;
  mimeType: string;
  blob: Blob;
  addedAt: number;
}

export interface LocalLibraryTrack {
  id: string;
  title: string;
  artist: string;
  src: string;
  local: true;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").trim();
  return base.length > 0 ? base.replace(/[_-]+/g, " ") : "Untitled track";
}

export function isAudioFile(file: File): boolean {
  if (file.type.startsWith("audio/")) {
    return true;
  }
  return /\.(mp3|m4a|aac|ogg|wav|flac|webm)$/i.test(file.name);
}

export function validateAudioFile(file: File): string | null {
  if (!isAudioFile(file)) {
    return "Only audio files are supported.";
  }
  if (file.size <= 0) {
    return "That file is empty.";
  }
  if (file.size > MAX_BYTES) {
    return "Keep each track under 25 MB.";
  }
  return null;
}

export async function listLocalTrackRecords(): Promise<LocalTrackRecord[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const rows = await requestToPromise(tx.objectStore(STORE).getAll());
    return (rows as LocalTrackRecord[]).sort((a, b) => a.addedAt - b.addedAt);
  } finally {
    db.close();
  }
}

export async function putLocalTrack(file: File): Promise<LocalTrackRecord> {
  const error = validateAudioFile(file);
  if (error) {
    throw new Error(error);
  }

  // Copy into a plain Blob — more reliable in IndexedDB than a live File handle.
  const buffer = await file.arrayBuffer();
  const mimeType = file.type || "audio/mpeg";
  const record: LocalTrackRecord = {
    id: `local-${crypto.randomUUID()}`,
    title: titleFromFileName(file.name),
    artist: "Local library",
    mimeType,
    blob: new Blob([buffer], { type: mimeType }),
    addedAt: Date.now(),
  };

  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("IndexedDB write failed"));
    });
  } finally {
    db.close();
  }

  return record;
}

export async function deleteLocalTrack(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("IndexedDB delete failed"));
    });
  } finally {
    db.close();
  }
}

export function recordsToPlayable(
  records: LocalTrackRecord[],
): { tracks: LocalLibraryTrack[]; urls: string[] } {
  const urls: string[] = [];
  const tracks = records.map((record) => {
    const src = URL.createObjectURL(record.blob);
    urls.push(src);
    return {
      id: record.id,
      title: record.title,
      artist: record.artist,
      src,
      local: true as const,
    };
  });
  return { tracks, urls };
}
