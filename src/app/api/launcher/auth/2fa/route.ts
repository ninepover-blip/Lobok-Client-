import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generate2FACode, sendTelegramMessage } from "@/lib/telegram";

/**
 * POST /api/launcher/auth/2fa
 * Body: { username, key, hwid }
 * If user has 2FA enabled, generate a code and send to Telegram.
 */
export async function POST(req: NextRequest) {
  const { username, key, hwid } = await req.json();
  if (!username || !key) {
    return NextResponse.json({ success: false, error: "username & key required" }, { status: 400 });
  }

  // Validate key exists
  const k = await prisma.licenseKey.findUnique({ where: { key } });
  if (!k) return NextResponse.json({ success: false, error: "Invalid key" }, { status: 404 });
  if (k.status === "REVOKED") return NextResponse.json({ success: false, error: "Key revoked" }, { status: 403 });
  if (k.status === "EXPIRED") return NextResponse.json({ success: false, error: "Key expired" }, { status: 403 });
  if (k.expiresAt && k.expiresAt < new Date()) {
    await prisma.licenseKey.update({ where: { id: k.id }, data: { status: "EXPIRED" } });
    return NextResponse.json({ success: false, error: "Key expired" }, { status: 403 });
  }
  if (k.ownerUsername && k.ownerUsername !== username) {
    return NextResponse.json({ success: false, error: "Key bound to another user" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  // If 2FA not enabled or no Telegram linked, skip — caller should go straight to auth
  if (!user.is2FAEnabled || !user.telegramId) {
    return NextResponse.json({ success: true, need2FA: false });
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

  return NextResponse.json({ success: true, need2FA: true });
}
