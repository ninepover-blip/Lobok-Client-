import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const BOT = process.env.TELEGRAM_BOT_USERNAME || "LobokClient_bot";

/**
 * POST /api/telegram/link
 * Выдаёт одноразовый код привязки и готовую ссылку в MiniApp/бота.
 * Пользователь ничего не вводит руками — просто жмёт кнопку.
 */
export async function POST() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const code = crypto.randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 минут

  await prisma.user.update({
    where: { id: me.id },
    data: { telegramLinkCode: code, telegramLinkExp: expires },
  });

  return NextResponse.json({
    ok: true,
    code,
    expiresAt: expires,
    // deep-link: бот получит код в /start и привяжет аккаунт сам
    botUrl: `https://t.me/${BOT}?start=${code}`,
    miniAppUrl: `https://t.me/${BOT}/app?startapp=${code}`,
  });
}

/** GET — статус привязки для UI. */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  return NextResponse.json({
    linked: !!me.telegramId,
    telegramUsername: me.telegramUsername,
    is2FAEnabled: me.is2FAEnabled,
    botUsername: BOT,
  });
}

/** DELETE — отвязать Telegram (и выключить 2FA). */
export async function DELETE() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  await prisma.user.update({
    where: { id: me.id },
    data: {
      telegramId: null,
      telegramUsername: null,
      is2FAEnabled: false,
      telegramLinkCode: null,
      telegramLinkExp: null,
    },
  });
  return NextResponse.json({ ok: true });
}
