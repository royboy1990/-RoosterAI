import {
  findChatBySourceAndFirstMessage,
  pruneChatMessages,
  readChat,
  toChatId,
  writeChat,
} from "../chat-store";
import type { LoadedConfig } from "../config";
import { getLlmProvider } from "../llm";
import { readBrief, readLatestBrief, resolveSubstantiveBrief } from "../store";
import type { ChatRecord } from "../types";
import {
  askAbortSignal,
  isAskLlmAvailable,
  logAsk,
  makeAskRunContext,
  truncateAssistantReply,
} from "./availability";
import { buildContextBriefIds, loadContextBriefs } from "./context";
import { ASK_SYSTEM_PROMPT, assembleAskEvidence } from "./evidence";

export interface AskRequest {
  message: string;
  /** Continue an existing thread. */
  chatId?: string;
  /** When creating: anchor at this brief (substantive body preferred). */
  sourceBriefId?: string;
}

export interface AskResult {
  reply: string;
  chatId: string;
  sourceBriefIds: string[];
  /** True when an existing Peck/thread was reopened without a new LLM call. */
  reused?: boolean;
}

function titleFromMessage(message: string): string {
  const oneLine = message.replace(/\s+/g, " ").trim();
  if (oneLine.length <= 72) {
    return oneLine || "Ask";
  }
  return `${oneLine.slice(0, 71).trimEnd()}…`;
}

/**
 * Parse assistant output for cited brief ids that appear in the evidence set.
 * Falls back to the source brief when nothing explicit is found.
 */
export function extractCitedBriefIds(
  reply: string,
  contextBriefIds: string[],
  sourceBriefId?: string,
): string[] {
  const found: string[] = [];
  for (const id of contextBriefIds) {
    if (reply.includes(id) && !found.includes(id)) {
      found.push(id);
    }
  }
  if (found.length > 0) {
    return found;
  }
  if (sourceBriefId && contextBriefIds.includes(sourceBriefId)) {
    return [sourceBriefId];
  }
  return contextBriefIds.slice(0, 1);
}

async function resolveNewChatSource(input: {
  rootDir: string;
  sourceBriefId?: string;
}): Promise<{ sourceBriefId: string; demo: boolean } | { error: string }> {
  if (input.sourceBriefId) {
    const brief = await readBrief(input.rootDir, input.sourceBriefId);
    if (!brief) {
      return { error: "Source brief not found." };
    }
    const body = await resolveSubstantiveBrief(input.rootDir, brief);
    return { sourceBriefId: body.id, demo: body.demo };
  }

  // Free-form Ask without an explicit source — anchor on latest brief.
  const latest = await readLatestBrief(input.rootDir);
  if (!latest) {
    return { error: "No briefs available to ground Ask." };
  }
  const body = await resolveSubstantiveBrief(input.rootDir, latest);
  return { sourceBriefId: body.id, demo: body.demo };
}

/**
 * Create or continue an Ask thread with frozen contextBriefIds.
 * Refuses stub/demo-only LLM answers.
 */
export async function runAsk(
  loaded: LoadedConfig,
  request: AskRequest,
  parentSignal?: AbortSignal,
): Promise<AskResult> {
  const { config, rootDir } = loaded;

  if (!config.askEnabled) {
    throw new Error("Ask is disabled in config (askEnabled: false).");
  }
  if (!isAskLlmAvailable(loaded)) {
    throw new Error(
      "Ask needs a real LLM provider with credentials — stub/demo-only is disabled.",
    );
  }

  const message = request.message.trim();
  if (!message) {
    throw new Error("Message is empty.");
  }
  if (message.length > config.askMaxUserMessageChars) {
    throw new Error(
      `Message exceeds ${config.askMaxUserMessageChars} characters.`,
    );
  }

  const llm = getLlmProvider(config.llm.provider);
  if (!llm) {
    throw new Error(`Unknown LLM provider "${config.llm.provider}"`);
  }

  let chat: ChatRecord;

  if (request.chatId) {
    const existing = await readChat(rootDir, request.chatId);
    if (!existing) {
      throw new Error("Chat not found.");
    }
    chat = existing;
  } else {
    const source = await resolveNewChatSource({
      rootDir,
      sourceBriefId: request.sourceBriefId,
    });
    if ("error" in source) {
      throw new Error(source.error);
    }

    // Same source brief + same first question → reopen (Peck re-click or identical ask).
    // A different free-form question always creates a new thread.
    const reused = await findChatBySourceAndFirstMessage(
      rootDir,
      source.sourceBriefId,
      message,
    );
    if (reused && reused.messages.length > 0) {
      const lastAssistant = [...reused.messages]
        .reverse()
        .find((m) => m.role === "assistant");
      await logAsk(
        rootDir,
        `ask: reuse chat=${reused.id} source=${source.sourceBriefId}`,
      );
      return {
        reply: lastAssistant?.content ?? "",
        chatId: reused.id,
        sourceBriefIds: lastAssistant?.sourceBriefIds ?? [source.sourceBriefId],
        reused: true,
      };
    }

    const contextBriefIds = await buildContextBriefIds({
      rootDir,
      sourceBriefId: source.sourceBriefId,
      demo: source.demo,
      maxBriefs: config.chatContextBriefs,
    });
    if (contextBriefIds.length === 0) {
      throw new Error("Could not build Ask context from briefs.");
    }

    const now = new Date();
    chat = {
      id: toChatId(now),
      createdAt: now.toISOString(),
      title: titleFromMessage(message),
      demo: source.demo,
      sourceBriefId: source.sourceBriefId,
      contextBriefIds,
      messages: [],
    };
  }

  const briefs = await loadContextBriefs(rootDir, chat.contextBriefIds);
  if (briefs.length === 0) {
    throw new Error("Frozen context briefs are missing from disk.");
  }

  const evidence = assembleAskEvidence({
    briefs,
    sourceBriefId: chat.sourceBriefId,
    charBudget: config.askContextCharBudget,
  });

  const history = chat.messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const userPacket = [
    evidence.packet,
    history ? `## Prior turns\n${history}` : null,
    `## Question\n${message}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const signal = askAbortSignal(config.askTimeoutMs, parentSignal);
  const ctx = makeAskRunContext(loaded, signal);

  await logAsk(rootDir, `ask: chat=${chat.id} turn=${chat.messages.length + 1}`);

  let reply: string;
  try {
    const completion = await llm.complete(
      {
        system: ASK_SYSTEM_PROMPT,
        user: userPacket,
        model: config.llm.model,
      },
      ctx,
    );
    reply = completion.text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logAsk(rootDir, `ask failed: ${msg}`);
    throw err;
  }

  reply = truncateAssistantReply(reply, config.askMaxAssistantChars);
  const sourceBriefIds = extractCitedBriefIds(
    reply,
    chat.contextBriefIds,
    chat.sourceBriefId,
  );

  chat = {
    ...chat,
    messages: [
      ...chat.messages,
      { role: "user", content: message },
      { role: "assistant", content: reply, sourceBriefIds },
    ],
  };
  chat = pruneChatMessages(chat, config.chatMaxStoredMessages);
  await writeChat(rootDir, chat);

  return { reply, chatId: chat.id, sourceBriefIds };
}
