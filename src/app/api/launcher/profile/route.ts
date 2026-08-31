import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const keys = await prisma.licenseKey.findMany({
    where: { ownerId: user.id },
  });

  const activeKeys = keys.filter((k) => k.status === "ACTIVE");

  const playtimeMinutes = user.playtimeMinutes || 0;
  const hours = Math.floor(playtimeMinutes / 60);
  const mins = playtimeMinutes % 60;

  return NextResponse.json({
    username: user.username,
    role: user.role,
    keyCount: activeKeys.length,
    isActive: activeKeys.length > 0,
    playtime: hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`,
    createdAt: user.createdAt?.toLocaleDateString("ru-RU") || "",
    lastLogin: user.lastSeenAt?.toLocaleString("ru-RU") || "",
  });
}
