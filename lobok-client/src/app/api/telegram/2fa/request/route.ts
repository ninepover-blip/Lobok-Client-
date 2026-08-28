import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generate2FACode, sendTelegramMessage } from "@/lib/telegram";

/**
 * POST /api/telegram/2fa/request  { username }
 * Отправляет код входа в Telegram. Вызывается со страницы логина,
 * когда сервер ответил need2FA — пользователю ничего вводить в боте не нужно.
 */
export async function POST(req: NextRequest) {
  const { username } = await req.json().catch(() => ({}) as { username?: string });
  if (!username) return NextResponse.json({ error: "Укажите логин" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { username } });
  // не раскрываем существование аккаунта
  if (!user || !user.telegramId || !user.is2FAEnabled) {
    return NextResponse.json({ ok: true, message: "Если 2FA включена — код отправлен в Telegram" });
  }

  const code = generate2FACode();
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFACode: code, twoFACodeExpires: new Date(Date.now() + 5 * 60 * 1000) },
  });

  await sendTelegramMessage(
    user.telegramId,
    `🔐 Код для входа в <b>Lobok Client</b>: <b>${code}</b>\nДействует 5 минут.\n\nЕсли это не ты — просто проигнорируй сообщение.`,
  );

  return NextResponse.json({ ok: true, message: "Код отправлен в Telegram" });
}
