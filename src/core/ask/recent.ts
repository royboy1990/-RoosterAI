import { listChatIds, readChat } from "../chat-store";

export async function loadRecentChats(
  rootDir: string,
  demo: boolean,
  limit = 8,
): Promise<{ id: string; title: string; createdAt: string }[]> {
  const chatIds = await listChatIds(rootDir);
  const recentChats: { id: string; title: string; createdAt: string }[] = [];
  for (const chatId of chatIds) {
    if (recentChats.length >= limit) {
      break;
    }
    const chat = await readChat(rootDir, chatId);
    if (!chat || chat.demo !== demo) {
      continue;
    }
    recentChats.push({
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
    });
  }
  return recentChats;
}
