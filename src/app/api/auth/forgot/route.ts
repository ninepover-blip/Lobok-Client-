import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { generate2FACode, sendTelegramMessage } from "@/lib/telegram";

/**
 * Восстановление пароля через Telegram.
 *
 * POST { username }                     — прислать код в Telegram
 * POST { username, code, newPassword }  — установить новый пароль
 *
 * Работает только для аккаунтов с привязанным Telegram: другого доверенного
 * канала у нас нет (email не собираем). Существование аккаунта не раскрываем.
 */

const VAGUE = "Если аккаунт существует и к нему привязан Telegram — код отправлен";

export async function POST(req: NextRequest) {
  const { username, code, newPassword } = (await req.json().catch(() => ({}))) as {
    username?: string;
    code?: string;
    newPassword?: string;
  };

  if (!username) return NextResponse.json({ error: "Укажи логин" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { username } });

  // ---------- шаг 2: подтверждение кода и смена пароля ----------
  if (code && newPassword) {
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Пароль минимум 6 символов" }, { status: 400 });
    }
    if (
      !user ||
      !user.resetCode ||
      !user.resetCodeExpires ||
      user.resetCodeExpires < new Date() ||
      user.resetCode !== code
    ) {
      return NextResponse.json({ error: "Неверный или просроченный код" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        resetCode: null,
        resetCodeExpires: null,
        // на всякий случай гасим и код 2FA, чтобы старый не подошёл
        twoFACode: null,
        twoFACodeExpires: null,
      },
    });

    if (user.telegramId) {
      await sendTelegramMessage(
        user.telegramId,
        "🔑 Пароль от аккаунта <b>Lobok Client</b> изменён.\n\nЕсли это был не ты — сразу напиши в поддержку.",
      );
    }
    return NextResponse.json({ ok: true, message: "Пароль изменён, теперь войди с новым" });
  }

  // ---------- шаг 1: запрос кода ----------
  if (!user || !user.telegramId) {
    // не раскрываем, есть ли такой аккаунт
    return NextResponse.json({ ok: true, message: VAGUE });
  }

  const fresh = generate2FACode();
  await prisma.user.update({
    where: { id: user.id },
    data: { resetCode: fresh, resetCodeExpires: new Date(Date.now() + 10 * 60 * 1000) },
  });

  await sendTelegramMessage(
    user.telegramId,
    `🔑 Код для восстановления пароля: <b>${fresh}</b>\nДействует 10 минут.\n\n` +
      "Если ты не запрашивал восстановление — просто проигнорируй это сообщение.",
  );

  return NextResponse.json({ ok: true, message: VAGUE, sent: true });
}
