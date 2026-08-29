import crypto from "crypto";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

/** Низкоуровневый вызов Telegram Bot API. */
export async function tgApi(method: string, payload: Record<string, unknown>) {
  if (!BOT_TOKEN) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  replyMarkup?: Record<string, unknown>,
) {
  const res = await tgApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
  return !!res?.ok;
}

export function generate2FACode(): string {
  // криптостойкий 6-значный код
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Проверка подписи Telegram MiniApp (initData).
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyMiniAppInitData(initData: string): {
  ok: boolean;
  user?: { id: number; username?: string; first_name?: string; photo_url?: string };
} {
  if (!BOT_TOKEN || !initData) return { ok: false };
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return { ok: false };
    params.delete("hash");

    const dataCheckString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("\n");

    const secret = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
    const calc = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
    if (calc !== hash) return { ok: false };

    // защита от переиспользования старых initData
    const authDate = Number(params.get("auth_date") || 0);
    if (authDate && Date.now() / 1000 - authDate > 86400) return { ok: false };

    const rawUser = params.get("user");
    return { ok: true, user: rawUser ? JSON.parse(rawUser) : undefined };
  } catch {
    return { ok: false };
  }
}
