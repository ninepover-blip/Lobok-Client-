import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendTelegramMessage, generate2FACode, tgApi } from "@/lib/telegram";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://lobok-client.vercel.app";
const BOT = process.env.TELEGRAM_BOT_USERNAME || "LobokClientBot";

/** Кнопки: всё делается тапом, команды учить не нужно. */
function mainKeyboard(linked: boolean) {
  const rows: Array<Array<Record<string, unknown>>> = [
    [{ text: "🎮 Открыть кабинет", web_app: { url: `${SITE}/cabinet` } }],
  ];
  if (linked) {
    rows.push([{ text: "🔐 Получить код 2FA", callback_data: "get2fa" }]);
    rows.push([{ text: "🔑 Мои ключи", callback_data: "mykeys" }]);
  } else {
    rows.push([{ text: "🔗 Привязать аккаунт", url: `${SITE}/cabinet` }]);
  }
  return { inline_keyboard: rows };
}

async function answerCallback(id: string, text?: string) {
  await tgApi("answerCallbackQuery", { callback_query_id: id, text, show_alert: false });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });

  // --- нажатия на кнопки ---
  if (body.callback_query) {
    const cq = body.callback_query;
    const chatId = String(cq.message?.chat?.id ?? cq.from.id);
    const user = await prisma.user.findFirst({ where: { telegramId: chatId } });

    if (!user) {
      await answerCallback(cq.id, "Аккаунт не привязан");
      await sendTelegramMessage(chatId, `Сначала привяжи аккаунт в кабинете на сайте.`, mainKeyboard(false));
      return NextResponse.json({ ok: true });
    }

    if (cq.data === "get2fa") {
      const code = generate2FACode();
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFACode: code, twoFACodeExpires: new Date(Date.now() + 5 * 60 * 1000) },
      });
      await answerCallback(cq.id, "Код отправлен");
      await sendTelegramMessage(chatId, `🔐 Код для входа: <b>${code}</b>\nДействует 5 минут.`);
      return NextResponse.json({ ok: true });
    }

    if (cq.data === "mykeys") {
      const keys = await prisma.licenseKey.findMany({
        where: { ownerId: user.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      await answerCallback(cq.id);
      const txt = keys.length
        ? keys
            .map(
              (k) =>
                `<code>${k.key}</code>\n${k.type} • ${k.status} • ${
                  k.expiresAt ? `до ${k.expiresAt.toLocaleDateString("ru-RU")}` : "навсегда"
                }`,
            )
            .join("\n\n")
        : "У тебя пока нет ключей.";
      await sendTelegramMessage(chatId, `🔑 <b>Твои ключи</b>\n\n${txt}`, mainKeyboard(true));
      return NextResponse.json({ ok: true });
    }

    await answerCallback(cq.id);
    return NextResponse.json({ ok: true });
  }

  // --- обычные сообщения ---
  const message = body.message;
  if (!message) return NextResponse.json({ ok: true });

  const chatId = String(message.chat.id);
  const text: string = message.text || "";
  const fromUsername = message.from?.username || "";

  if (text.startsWith("/start")) {
    const arg = text.split(/\s+/)[1] || "";

    // Привязка одноразовым кодом с сайта (в т.ч. из MiniApp: ?startapp=<code>)
    if (arg) {
      const code = arg.replace(/^link_/, "");
      const target = await prisma.user.findFirst({
        where: { telegramLinkCode: code, telegramLinkExp: { gt: new Date() } },
      });

      if (target) {
        const busy = await prisma.user.findFirst({
          where: { telegramId: chatId, NOT: { id: target.id } },
        });
        if (busy) {
          await sendTelegramMessage(
            chatId,
            `❌ Этот Telegram уже привязан к аккаунту <b>${busy.username}</b>. Сначала отвяжи его в кабинете.`,
          );
          return NextResponse.json({ ok: true });
        }

        await prisma.user.update({
          where: { id: target.id },
          data: {
            telegramId: chatId,
            telegramUsername: fromUsername,
            telegramLinkCode: null,
            telegramLinkExp: null,
          },
        });
        await sendTelegramMessage(
          chatId,
          `✅ Готово! Telegram привязан к аккаунту <b>${target.username}</b>.\n\n` +
            `Теперь можно включить 2FA в кабинете — при входе я буду присылать код.`,
          mainKeyboard(true),
        );
        return NextResponse.json({ ok: true });
      }

      await sendTelegramMessage(
        chatId,
        `⌛️ Ссылка привязки устарела или уже использована.\n\nОткрой кабинет на сайте и нажми «Привязать Telegram» ещё раз.`,
        mainKeyboard(false),
      );
      return NextResponse.json({ ok: true });
    }

    const existing = await prisma.user.findFirst({ where: { telegramId: chatId } });
    await sendTelegramMessage(
      chatId,
      existing
        ? `👋 С возвращением, <b>${existing.username}</b>!\n\nВсё управление — кнопками ниже.`
        : `👋 Привет! Это бот <b>Lobok Client</b>.\n\n` +
            `Ничего вводить не нужно: открой кабинет на сайте и нажми «Привязать Telegram».`,
      mainKeyboard(!!existing),
    );
    return NextResponse.json({ ok: true });
  }

  // Любое другое сообщение — показываем кнопки, а не «не понял команду»
  const known = await prisma.user.findFirst({ where: { telegramId: chatId } });
  await sendTelegramMessage(
    chatId,
    known
      ? `Выбери действие кнопкой 👇`
      : `Чтобы начать — привяжи аккаунт в кабинете на сайте.`,
    mainKeyboard(!!known),
  );
  return NextResponse.json({ ok: true });
}

/**
 * GET /api/bot/telegram            — статус
 * GET /api/bot/telegram?setWebhook=1 — установить вебхук (нужен ADMIN_SETUP_SECRET или запуск вручную)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("setWebhook") === "1") {
    if (!BOT_TOKEN) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN не задан" }, { status: 400 });
    const hook = `${SITE}/api/bot/telegram`;
    const res = await tgApi("setWebhook", { url: hook, allowed_updates: ["message", "callback_query"] });
    return NextResponse.json({ ok: true, webhook: hook, telegram: res });
  }
  return NextResponse.json({
    ok: true,
    bot: BOT_TOKEN ? "configured" : "missing token",
    username: BOT,
    webhookSetup: `${SITE}/api/bot/telegram?setWebhook=1`,
  });
}
