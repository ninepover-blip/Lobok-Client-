import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  let user = null;

  if (token) {
    try {
      const { verifyToken } = await import("@/lib/auth");
      const payload = verifyToken(token);
      if (payload) {
        user = await prisma.user.findUnique({ where: { id: payload.id } });
      }
    } catch {}
  }

  if (!user) {
    user = await getCurrentUser();
  }

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
