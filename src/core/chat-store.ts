import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDataDirs } from "./store";
import type { ChatRecord } from "./types";

function chatsDir(rootDir: string): string {
  return path.join(rootDir, "data", "chats");
}

/** Filesystem-safe chat id stem from creation time. */
export function toChatId(date: Date): string {
  return date.toISOString().replace(/:/g, "-");
}

export async function writeChat(
  rootDir: string,
  chat: ChatRecord,
): Promise<string> {
  await ensureDataDirs(rootDir);
  const filePath = path.join(chatsDir(rootDir), `${chat.id}.json`);
  await writeFile(filePath, `${JSON.stringify(chat, null, 2)}\n`, "utf8");
  return filePath;
}

export async function readChat(
  rootDir: string,
  id: string,
): Promise<ChatRecord | null> {
  try {
    const raw = await readFile(
      path.join(chatsDir(rootDir), `${id}.json`),
      "utf8",
    );
    return JSON.parse(raw) as ChatRecord;
  } catch {
    return null;
  }
}

/** Newest first. */
export async function listChatIds(rootDir: string): Promise<string[]> {
  try {
    const names = await readdir(chatsDir(rootDir));
    return names
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.slice(0, -".json".length))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function normalizeAskMessage(message: string): string {
  return message.replace(/\s+/g, " ").trim();
}

/**
 * Find an existing thread opened from the same source brief with the same
 * first user message (e.g. re-clicking a Peck). Newest match wins.
 */
export async function findChatBySourceAndFirstMessage(
  rootDir: string,
  sourceBriefId: string,
  firstMessage: string,
): Promise<ChatRecord | null> {
  const needle = normalizeAskMessage(firstMessage);
  if (!needle || !sourceBriefId) {
    return null;
  }

  const ids = await listChatIds(rootDir);
  for (const id of ids) {
    const chat = await readChat(rootDir, id);
    if (!chat || chat.sourceBriefId !== sourceBriefId) {
      continue;
    }
    const firstUser = chat.messages.find((m) => m.role === "user");
    if (!firstUser) {
      continue;
    }
    if (normalizeAskMessage(firstUser.content) === needle) {
      return chat;
    }
  }
  return null;
}

/** Drop oldest messages when over the cap (keep the newest N). */
export function pruneChatMessages(
  chat: ChatRecord,
  maxMessages: number,
): ChatRecord {
  if (maxMessages < 1 || chat.messages.length <= maxMessages) {
    return chat;
  }
  return {
    ...chat,
    messages: chat.messages.slice(-maxMessages),
  };
}
