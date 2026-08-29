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
    [{ text: "🎮 My Cabinet", web_app: { url: `${SITE}/cabinet` } }],
  ];

  if (linked) {
    rows.push(
      [{ text: "🔑 My Keys", callback_data: "mykeys" }],
      [{ text: "🔐 2FA Code", callback_data: "get2fa" }],
    );
  } else {
    rows.push([{ text: "🔗 Link Account", url: `${SITE}/cabinet` }]);
  }

  rows.push(
    [{ text: "📦 Buy Key", url: `${SITE}/cabinet#buy` }],
    [{ text: "💬 Support", callback_data: "support_start" }],
    [{ text: "📋 News", callback_data: "news" }],
    [{ text: "ℹ️ About Lobok", callback_data: "about" }],
    [{ text: "🌐 Website", url: SITE }],
  );

  return { inline_keyboard: rows };
}

/** Compact reply-keyboard used as fallback (non-inline). */
function mainKeyboard(linked: boolean) {
  const rows: Array<Array<Record<string, unknown>>> = [
    [{ text: "🎮 Open Cabinet", web_app: { url: `${SITE}/cabinet` } }],
  ];
  if (linked) {
    rows.push([{ text: "🔐 Get 2FA Code", callback_data: "get2fa" }]);
    rows.push([{ text: "🔑 My Keys", callback_data: "mykeys" }]);
  } else {
    rows.push([{ text: "🔗 Link Account", url: `${SITE}/cabinet` }]);
  }
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
          "⚠️ Link your account first. Open the cabinet on the website and press «Link Telegram».",
          menuKeyboard(false),
        );
        return NextResponse.json({ ok: true });
      }

      setConv(chatId, "await_title");
      await sendTelegramMessage(
        chatId,
        "📝 <b>New Support Ticket</b>\n\nSend me a short <b>title</b> for your ticket.\n\nType /cancel to abort.",
      );
      return NextResponse.json({ ok: true });
    }

    // All other callbacks require a linked account
    const user = await prisma.user.findFirst({ where: { telegramId: chatId } });

    if (!user) {
      await answerCallback(cq.id, "Account not linked");
      await sendTelegramMessage(
        chatId,
        "⚠️ Link your account first. Open the cabinet on the website and press «Link Telegram».",
        menuKeyboard(false),
      );
      return NextResponse.json({ ok: true });
    }

    // ── 2FA code ──
    if (data === "get2fa") {
      if (!user.is2FAEnabled) {
        await answerCallback(cq.id, "2FA is disabled");
        await sendTelegramMessage(
          chatId,
          "🔐 2FA is not enabled on your account.\n\nEnable it in the cabinet for extra security.",
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
      await answerCallback(cq.id, "Code sent");
      await sendTelegramMessage(
        chatId,
        `🔐 <b>Your 2FA code:</b>  <code>${code}</code>\n\nExpires in 5 minutes.`,
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
        await sendTelegramMessage(chatId, "🔑 You don't have any keys yet.", menuKeyboard(true));
        return NextResponse.json({ ok: true });
      }

      const txt = keys
        .map((k) => {
          const expiry = k.expiresAt
            ? `until ${k.expiresAt.toLocaleDateString("en-US")}`
            : "permanent";
          return `• <code>${k.key}</code>\n  ${k.type} • ${k.status} • ${expiry}`;
        })
        .join("\n\n");

      await sendTelegramMessage(chatId, `🔑 <b>Your Keys</b>\n\n${txt}`, menuKeyboard(true));
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
        await sendTelegramMessage(chatId, "📋 No news yet. Check back later!", menuKeyboard(true));
        return NextResponse.json({ ok: true });
      }

      const txt = posts
        .map((p, i) => {
          const date = p.createdAt.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
          const pinned = p.isPinned ? "📌 " : "";
          const preview = p.content.length > 200 ? p.content.slice(0, 200) + "…" : p.content;
          return `${pinned}<b>${i + 1}. ${escapeHtml(p.title)}</b>\n📅 ${date} • by ${escapeHtml(p.author.username)}\n${escapeHtml(preview)}`;
        })
        .join("\n\n──────────────────\n\n");

      await sendTelegramMessage(chatId, `📋 <b>Latest News</b>\n\n${txt}`, menuKeyboard(true));
      return NextResponse.json({ ok: true });
    }

    // ── About ──
    if (data === "about") {
      await answerCallback(cq.id);
      const about =
        "ℹ️ <b>About Lobok Client</b>\n\n" +
        "Lobok Client is a premium Minecraft experience featuring:\n\n" +
        "🛡️ <b>Anti-cheat</b> — advanced protection for fair gameplay\n" +
        "🔑 <b>License keys</b> — secure access control\n" +
        "🔐 <b>2FA via Telegram</b> — extra account security\n" +
        "🎮 <b>MiniApp cabinet</b> — manage everything from Telegram\n" +
        "📊 <b>Play stats</b> — track your activity and servers\n" +
        "💬 <b>In-game chat</b> — stay connected with the community\n" +
        "🌐 <b>Multi-server</b> — play across multiple servers\n\n" +
        `🔗 Website: ${SITE}\n` +
        "💬 Support: tap the button below or use /menu → Support";

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
    await sendTelegramMessage(chatId, "❌ Ticket creation cancelled.", menuKeyboard(true));
    return NextResponse.json({ ok: true });
  }

  if (conv) {
    const user = await prisma.user.findFirst({ where: { telegramId: chatId } });

    if (!user) {
      clearConv(chatId);
      await sendTelegramMessage(
        chatId,
        "⚠️ Link your account first. Open the cabinet on the website and press «Link Telegram».",
        menuKeyboard(false),
      );
      return NextResponse.json({ ok: true });
    }

    // Step 1: awaiting title
    if (conv.step === "await_title") {
      const title = text.trim().slice(0, 120);
      if (!title) {
        await sendTelegramMessage(chatId, "⚠️ Title cannot be empty. Send a title or /cancel.");
        return NextResponse.json({ ok: true });
      }
      setConv(chatId, "await_desc", { title });
      await sendTelegramMessage(
        chatId,
        `📝 Title: <b>${escapeHtml(title)}</b>\n\nNow send me a detailed <b>description</b> of the issue.\n\nType /cancel to abort.`,
      );
      return NextResponse.json({ ok: true });
    }

    // Step 2: awaiting description → create ticket
    if (conv.step === "await_desc") {
      const desc = text.trim().slice(0, 2000);
      if (!desc) {
        await sendTelegramMessage(chatId, "⚠️ Description cannot be empty. Send a description or /cancel.");
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
        `✅ <b>Ticket created!</b>\n\n` +
          `#${ticket.id.slice(0, 8)} — <b>${escapeHtml(conv.data.title)}</b>\n\n` +
          `Our team will review it shortly. You can also continue the conversation in the cabinet.`,
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
            `❌ This Telegram is already linked to <b>${escapeHtml(busy.username)}</b>.\nUnlink it first in the cabinet.`,
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
          `✅ Done! Telegram linked to <b>${escapeHtml(target.username)}</b>.\n\n` +
            `Use the menu below to get 2FA codes, manage keys, and more.`,
          menuKeyboard(true),
        );
        return NextResponse.json({ ok: true });
      }

      await sendTelegramMessage(
        chatId,
        "⌛️ Link code expired or already used.\n\nOpen the cabinet on the website and press «Link Telegram» again.",
        menuKeyboard(false),
      );
      return NextResponse.json({ ok: true });
    }

    // Regular /start — show welcome + menu
    const existing = await prisma.user.findFirst({ where: { telegramId: chatId } });

    const welcome = existing
      ? `👋 Welcome back, <b>${escapeHtml(existing.username)}</b>!\n\nEverything is managed with the buttons below.`
      : `👋 Hi! I'm <b>Lobok Client Bot</b>.\n\n` +
        `Link your account in the cabinet on the website to unlock all features:\n` +
        `🔐 2FA codes • 🔑 Key management • 💬 Support tickets\n\n` +
        `Use the buttons below to get started.`;

    await sendTelegramMessage(chatId, welcome, menuKeyboard(!!existing));
    return NextResponse.json({ ok: true });
  }

  // --- /menu ---
  if (text === "/menu") {
    const existing = await prisma.user.findFirst({ where: { telegramId: chatId } });
    await sendTelegramMessage(chatId, "📋 <b>Main Menu</b>", menuKeyboard(!!existing));
    return NextResponse.json({ ok: true });
  }

  // --- /help ---
  if (text === "/help") {
    const help =
      "❓ <b>Help — Lobok Client Bot</b>\n\n" +
      "<b>Commands:</b>\n" +
      "/menu — Open the main menu\n" +
      "/help — Show this message\n" +
      "/start — Restart / link account\n\n" +
      "<b>Menu sections:</b>\n" +
      "🎮 <b>My Cabinet</b> — Open the web cabinet (MiniApp)\n" +
      "🔑 <b>My Keys</b> — View your license keys\n" +
      "🔐 <b>2FA Code</b> — Get a one-time login code\n" +
      "📦 <b>Buy Key</b> — Purchase a license key\n" +
      "💬 <b>Support</b> — Create a support ticket\n" +
      "📋 <b>News</b> — Read the latest updates\n" +
      "ℹ️ <b>About Lobok</b> — Learn about features\n" +
      "🌐 <b>Website</b> — Open the website\n\n" +
      "Need more help? Create a support ticket from the menu.";

    await sendTelegramMessage(chatId, help);
    return NextResponse.json({ ok: true });
  }

  // --- /cancel outside of conversation ---
  if (text === "/cancel") {
    await sendTelegramMessage(chatId, "Nothing to cancel.", menuKeyboard(true));
    return NextResponse.json({ ok: true });
  }

  // --- Any other message: show menu hint ---
  const known = await prisma.user.findFirst({ where: { telegramId: chatId } });
  await sendTelegramMessage(
    chatId,
    known
      ? "Pick an option from the menu 👇"
      : "Link your account in the cabinet on the website first, then come back here.",
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
      return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 400 });
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
    bot: BOT_TOKEN ? "configured" : "missing token",
    webhookSetup: `${SITE}/api/bot/telegram?setWebhook=1`,
  });
}
