import type { DeliveryChannel, DeliveryPayload, RunContext } from "../types";

interface TelegramSendResponse {
  ok?: boolean;
  description?: string;
}

/**
 * Telegram Bot API sendMessage via plain fetch.
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
 */
export const telegramDelivery: DeliveryChannel = {
  id: "telegram",
  label: "Telegram",
  requiredEnv: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
  async deliver(payload: DeliveryPayload, ctx: RunContext): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN!.trim();
    const chatId = process.env.TELEGRAM_CHAT_ID!.trim();
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    // Telegram hard-caps message text at 4096 characters.
    const maxLen = 4096;
    const text =
      payload.text.length > maxLen
        ? `${payload.text.slice(0, maxLen - 1)}…`
        : payload.text;

    ctx.log(`telegram: sendMessage chat=${chatId} chars=${text.length}`);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      signal: ctx.signal,
    });

    const raw = (await res.json()) as TelegramSendResponse;
    if (!res.ok || raw.ok === false) {
      throw new Error(
        `Telegram ${res.status}: ${raw.description ?? res.statusText}`,
      );
    }
  },
};
