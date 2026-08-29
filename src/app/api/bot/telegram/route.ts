import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendTelegramMessage, generate2FACode, tgApi } from "@/lib/telegram";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://lobok-client.vercel.app";

// ---------------------------------------------------------------------------
// In-memory conversation state for multi-step flows (support ticket creation).
// Maps chatId → { step, data } and auto-expires after 5 minutes.
// ---------------------------------------------------------------------------
const conversations = new Map<string, { step: string; data: Record<string, string>; ts: number }>();
const CONV_TTL = 5 * 60 * 1000;

function getConv(chatId: string) {
  const c = conversations.get(chatId);
  if (!c || Date.now() - c.ts > CONV_TTL) {
    conversations.delete(chatId);
    return null;
  }
  return c;
}

function setConv(chatId: string, step: string, data: Record<string, string> = {}) {
  conversations.set(chatId, { step, data, ts: Date.now() });
}

function clearConv(chatId: string) {
  conversations.delete(chatId);
}

// ---------------------------------------------------------------------------
// Keyboard builders
// ---------------------------------------------------------------------------

/** Full menu keyboard shown after /menu and /start. */
function menuKeyboard(linked: boolean) {
  const rows: Array<Array<Record<string, unknown>>> = [
    [{ text: "🎮 Мой кабинет", web_app: { url: `${SITE}/cabinet` } }],
  ];

  if (linked) {
    rows.push(
      [{ text: "🔑 Мои ключи", callback_data: "mykeys" }],
      [{ text: "🔐 Код 2FA", callback_data: "get2fa" }],
    );
  } else {
    rows.push([{ text: "🔗 Привязать аккаунт", url: `${SITE}/cabinet` }]);
  }

  rows.push(
    [{ text: "📦 Купить ключ", url: `${SITE}/cabinet#buy` }],
    [{ text: "💬 Поддержка", callback_data: "support_start" }],
    [{ text: "📋 Новости", callback_data: "news" }],
    [{ text: "ℹ️ О Lobok", callback_data: "about" }],
    [{ text: "🌐 Сайт", url: SITE }],
  );

  return { inline_keyboard: rows };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function answerCallback(id: string, text?: string) {
  await tgApi("answerCallbackQuery", {
    callback_query_id: id,
    text,
    show_alert: false,
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---------------------------------------------------------------------------
// POST — main webhook handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });

  // ──────────────────────────────────────────────
  // CALLBACK QUERIES (inline keyboard taps)
  // ──────────────────────────────────────────────
  if (body.callback_query) {
    const cq = body.callback_query;
    const chatId = String(cq.message?.chat?.id ?? cq.from.id);
    const data: string = cq.data || "";

    // --- support flow intercept (must run before auth check) ---
    if (data === "support_start" || data === "support_cancel") {
      await answerCallback(cq.id);
      clearConv(chatId);

      const user = await prisma.user.findFirst({ where: { telegramId: chatId } });
      if (!user) {
        await sendTelegramMessage(
          chatId,
          "⚠️ Сначала привяжи аккаунт. Открой кабинет на сайте и нажми «Привязать Telegram».",
          menuKeyboard(false),
        );
        return NextResponse.json({ ok: true });
      }

      setConv(chatId, "await_title");
      await sendTelegramMessage(
        chatId,
        "📝 <b>Новый тикет поддержки</b>\n\nОтправь короткое <b>название</b> для тикета.\n\nОтправь /cancel для отмены.",
      );
      return NextResponse.json({ ok: true });
    }

    // All other callbacks require a linked account
    const user = await prisma.user.findFirst({ where: { telegramId: chatId } });

    if (!user) {
      await answerCallback(cq.id, "Аккаунт не привязан");
      await sendTelegramMessage(
        chatId,
        "⚠️ Сначала привяжи аккаунт. Открой кабинет на сайте и нажми «Привязать Telegram».",
        menuKeyboard(false),
      );
      return NextResponse.json({ ok: true });
    }

    // ── 2FA code ──
    if (data === "get2fa") {
      if (!user.is2FAEnabled) {
        await answerCallback(cq.id, "2FA отключена");
        await sendTelegramMessage(
          chatId,
          "🔐 2FA не включена в твоём аккаунте.\n\nВключи её в кабинете для дополнительной безопасности.",
          menuKeyboard(true),
        );
        return NextResponse.json({ ok: true });
      }

      const code = generate2FACode();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFACode: code,
          twoFACodeExpires: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
      await answerCallback(cq.id, "Код отправлен");
      await sendTelegramMessage(
        chatId,
        `🔐 <b>Твой код 2FA:</b>  <code>${code}</code>\n\nДействует 5 минут.`,
      );
      return NextResponse.json({ ok: true });
    }

    // ── My Keys ──
    if (data === "mykeys") {
      const keys = await prisma.licenseKey.findMany({
        where: { ownerId: user.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      await answerCallback(cq.id);

      if (!keys.length) {
        await sendTelegramMessage(chatId, "🔑 У тебя пока нет ключей.", menuKeyboard(true));
        return NextResponse.json({ ok: true });
      }

      const txt = keys
        .map((k) => {
          const expiry = k.expiresAt
            ? `до ${k.expiresAt.toLocaleDateString("ru-RU")}`
            : "бессрочно";
          return `• <code>${k.key}</code>\n  ${k.type} • ${k.status} • ${expiry}`;
        })
        .join("\n\n");

      await sendTelegramMessage(chatId, `🔑 <b>Твои ключи</b>\n\n${txt}`, menuKeyboard(true));
      return NextResponse.json({ ok: true });
    }

    // ── News ──
    if (data === "news") {
      await answerCallback(cq.id);
      const posts = await prisma.news.findMany({
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 3,
        include: { author: { select: { username: true } } },
      });

      if (!posts.length) {
        await sendTelegramMessage(chatId, "📋 Новостей пока нет. Загляни позже!", menuKeyboard(true));
        return NextResponse.json({ ok: true });
      }

      const txt = posts
        .map((p, i) => {
          const date = p.createdAt.toLocaleDateString("ru-RU", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
          const pinned = p.isPinned ? "📌 " : "";
          const preview = p.content.length > 200 ? p.content.slice(0, 200) + "…" : p.content;
          return `${pinned}<b>${i + 1}. ${escapeHtml(p.title)}</b>\n📅 ${date} • ${escapeHtml(p.author.username)}\n${escapeHtml(preview)}`;
        })
        .join("\n\n──────────────────\n\n");

      await sendTelegramMessage(chatId, `📋 <b>Последние новости</b>\n\n${txt}`, menuKeyboard(true));
      return NextResponse.json({ ok: true });
    }

    // ── About ──
    if (data === "about") {
      await answerCallback(cq.id);
      const about =
        "ℹ️ <b>О Lobok Client</b>\n\n" +
        "Lobok Client — приватный чит-клиент для Minecraft 1.16.5:\n\n" +
        "🛡️ <b>Обход античита</b> — Matrix, Vulcan, AAC, Verus, Grim\n" +
        "🔑 <b>Лицензионные ключи</b> — безопасный доступ\n" +
        "🔐 <b>2FA через Telegram</b> — дополнительная защита аккаунта\n" +
        "🎮 <b>MiniApp кабинет</b> — управление прямо из Telegram\n" +
        "📊 <b>Игровая статистика</b> — отслеживание активности и серверов\n" +
        "💬 <b>Глобальный чат</b> — общение с сообществом\n" +
        "🌐 <b>Мульти-сервер</b> — играй на разных серверах\n\n" +
        `🔗 Сайт: ${SITE}\n` +
        "💬 Поддержка: нажми кнопку ниже или /menu → Поддержка";

      await sendTelegramMessage(chatId, about, menuKeyboard(true));
      return NextResponse.json({ ok: true });
    }

    // ── Fallback: acknowledge unknown callback ──
    await answerCallback(cq.id);
    return NextResponse.json({ ok: true });
  }

  // ──────────────────────────────────────────────
  // TEXT MESSAGES & COMMANDS
  // ──────────────────────────────────────────────
  const message = body.message;
  if (!message) return NextResponse.json({ ok: true });

  const chatId = String(message.chat.id);
  const text: string = message.text || "";
  const fromUsername = message.from?.username || "";

  // --- multi-step conversation intercept ---
  const conv = getConv(chatId);

  if (text === "/cancel" && conv) {
    clearConv(chatId);
    await sendTelegramMessage(chatId, "❌ Создание тикета отменено.", menuKeyboard(true));
    return NextResponse.json({ ok: true });
  }

  if (conv) {
    const user = await prisma.user.findFirst({ where: { telegramId: chatId } });

    if (!user) {
      clearConv(chatId);
      await sendTelegramMessage(
        chatId,
        "⚠️ Сначала привяжи аккаунт. Открой кабинет на сайте и нажми «Привязать Telegram».",
        menuKeyboard(false),
      );
      return NextResponse.json({ ok: true });
    }

    // Step 1: awaiting title
    if (conv.step === "await_title") {
      const title = text.trim().slice(0, 120);
      if (!title) {
        await sendTelegramMessage(chatId, "⚠️ Название не может быть пустым. Отправь название или /cancel.");
        return NextResponse.json({ ok: true });
      }
      setConv(chatId, "await_desc", { title });
      await sendTelegramMessage(
        chatId,
        `📝 Название: <b>${escapeHtml(title)}</b>\n\nТеперь отправь подробное <b>описание</b> проблемы.\n\nОтправь /cancel для отмены.`,
      );
      return NextResponse.json({ ok: true });
    }

    // Step 2: awaiting description → create ticket
    if (conv.step === "await_desc") {
      const desc = text.trim().slice(0, 2000);
      if (!desc) {
        await sendTelegramMessage(chatId, "⚠️ Описание не может быть пустым. Отправь описание или /cancel.");
        return NextResponse.json({ ok: true });
      }

      const ticket = await prisma.supportTicket.create({
        data: {
          title: conv.data.title,
          description: desc,
          authorId: user.id,
        },
      });

      clearConv(chatId);

      await sendTelegramMessage(
        chatId,
        `✅ <b>Тикет создан!</b>\n\n` +
          `#${ticket.id.slice(0, 8)} — <b>${escapeHtml(conv.data.title)}</b>\n\n` +
          `Наша команда рассмотрит его в ближайшее время. Также можешь продолжить разговор в кабинете.`,
        menuKeyboard(true),
      );
      return NextResponse.json({ ok: true });
    }

    // Unknown conv step — reset
    clearConv(chatId);
  }

  // --- /start ---
  if (text.startsWith("/start")) {
    const arg = text.split(/\s+/)[1] || "";

    // One-time linking code from the website / MiniApp
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
            `❌ Этот Telegram уже привязан к <b>${escapeHtml(busy.username)}</b>.\nОтвяжи его сначала в кабинете.`,
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
          `✅ Готово! Telegram привязан к <b>${escapeHtml(target.username)}</b>.\n\n` +
            `Используй меню ниже для получения кодов 2FA, управления ключами и другого.`,
          menuKeyboard(true),
        );
        return NextResponse.json({ ok: true });
      }

      await sendTelegramMessage(
        chatId,
        "⌛️ Код привязки истёк или уже использован.\n\nОткрой кабинет на сайте и нажми «Привязать Telegram» снова.",
        menuKeyboard(false),
      );
      return NextResponse.json({ ok: true });
    }

    // Regular /start — show welcome + menu
    const existing = await prisma.user.findFirst({ where: { telegramId: chatId } });

    const welcome = existing
      ? `👋 С возвращением, <b>${escapeHtml(existing.username)}</b>!\n\nВсем можно управлять через кнопки ниже.`
      : `👋 Привет! Я <b>Бот Lobok Client</b>.\n\n` +
        `Привяжи аккаунт в кабинете на сайте, чтобы открыть все функции:\n` +
        `🔐 Коды 2FA • 🔑 Управление ключами • 💬 Тикеты поддержки\n\n` +
        `Используй кнопки ниже для начала.`;

    await sendTelegramMessage(chatId, welcome, menuKeyboard(!!existing));
    return NextResponse.json({ ok: true });
  }

  // --- /menu ---
  if (text === "/menu") {
    const existing = await prisma.user.findFirst({ where: { telegramId: chatId } });
    await sendTelegramMessage(chatId, "📋 <b>Главное меню</b>", menuKeyboard(!!existing));
    return NextResponse.json({ ok: true });
  }

  // --- /help ---
  if (text === "/help") {
    const help =
      "❓ <b>Помощь — Бот Lobok Client</b>\n\n" +
      "<b>Команды:</b>\n" +
      "/menu — Открыть главное меню\n" +
      "/help — Показать это сообщение\n" +
      "/start — Перезапуск / привязка аккаунта\n\n" +
      "<b>Разделы меню:</b>\n" +
      "🎮 <b>Мой кабинет</b> — Открыть веб-кабинет (MiniApp)\n" +
      "🔑 <b>Мои ключи</b> — Посмотреть лицензионные ключи\n" +
      "🔐 <b>Код 2FA</b> — Получить одноразовый код входа\n" +
      "📦 <b>Купить ключ</b> — Приобрести лицензионный ключ\n" +
      "💬 <b>Поддержка</b> — Создать тикет поддержки\n" +
      "📋 <b>Новости</b> — Прочитать последние обновления\n" +
      "ℹ️ <b>О Lobok</b> — Узнать о возможностях\n" +
      "🌐 <b>Сайт</b> — Открыть сайт\n\n" +
      "Нужна помощь? Создай тикет через меню.";

    await sendTelegramMessage(chatId, help);
    return NextResponse.json({ ok: true });
  }

  // --- /cancel outside of conversation ---
  if (text === "/cancel") {
    await sendTelegramMessage(chatId, "Нечего отменять.", menuKeyboard(true));
    return NextResponse.json({ ok: true });
  }

  // --- Any other message: show menu hint ---
  const known = await prisma.user.findFirst({ where: { telegramId: chatId } });
  await sendTelegramMessage(
    chatId,
    known
      ? "Выбери опцию из меню 👇"
      : "Сначала привяжи аккаунт в кабинете на сайте, затем вернись сюда.",
    menuKeyboard(!!known),
  );
  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// GET — status / webhook setup
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("setWebhook") === "1") {
    if (!BOT_TOKEN) {
      return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN не задан" }, { status: 400 });
    }
    const hook = `${SITE}/api/bot/telegram`;
    const res = await tgApi("setWebhook", {
      url: hook,
      allowed_updates: ["message", "callback_query"],
    });
    return NextResponse.json({ ok: true, webhook: hook, telegram: res });
  }
  return NextResponse.json({
    ok: true,
    bot: BOT_TOKEN ? "настроен" : "нет токена",
    webhookSetup: `${SITE}/api/bot/telegram?setWebhook=1`,
  });
}
