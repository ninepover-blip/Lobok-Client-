import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyMiniAppInitData } from "@/lib/telegram";

/**
 * POST /api/telegram/miniapp
 * Вызывается из Telegram MiniApp. Привязывает аккаунт по подписанному initData
 * + одноразовому коду (startapp), без ручного ввода ID и без команд.
 */
export async function POST(req: NextRequest) {
  const { initData, code } = await req.json().catch(() => ({}) as Record<string, string>);

  const check = verifyMiniAppInitData(initData || "");
  if (!check.ok || !check.user?.id) {
    return NextResponse.json({ error: "Подпись Telegram недействительна" }, { status: 401 });
  }

  if (!code) return NextResponse.json({ error: "Нет кода привязки" }, { status: 400 });

  const target = await prisma.user.findFirst({
    where: { telegramLinkCode: code, telegramLinkExp: { gt: new Date() } },
  });
  if (!target) {
    return NextResponse.json({ error: "Код устарел — сгенерируй новый в кабинете" }, { status: 400 });
  }

  const tgId = String(check.user.id);
  const busy = await prisma.user.findFirst({ where: { telegramId: tgId, NOT: { id: target.id } } });
  if (busy) {
    return NextResponse.json(
      { error: `Этот Telegram уже привязан к аккаунту ${busy.username}` },
      { status: 409 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      telegramId: tgId,
      telegramUsername: check.user.username || null,
      telegramLinkCode: null,
      telegramLinkExp: null,
    },
  });

  return NextResponse.json({
    ok: true,
    username: updated.username,
    telegramUsername: updated.telegramUsername,
  });
}
