import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * Учёт игрового времени и серверов. Вызывает лаунчер/клиент.
 *
 *  POST { key, serverIp, minutes? , action?: "start" | "ping" | "stop" }
 *
 *  - start : открыть сессию при заходе на сервер
 *  - ping  : раз в минуту, добавляет время (по умолчанию)
 *  - stop  : закрыть сессию при выходе
 *
 * Пользователь определяется по лицензионному ключу, отдельная авторизация не нужна.
 */
export async function POST(req: NextRequest) {
  const { key, serverIp, minutes, action = "ping" } = (await req.json().catch(() => ({}))) as {
    key?: string;
    serverIp?: string;
    minutes?: number;
    action?: "start" | "ping" | "stop";
  };

  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  const license = await prisma.licenseKey.findUnique({ where: { key } });
  if (!license || !license.ownerId) {
    return NextResponse.json({ error: "Ключ не найден или не привязан" }, { status: 404 });
  }
  if (license.status === "REVOKED" || license.status === "EXPIRED") {
    return NextResponse.json({ error: "Ключ неактивен" }, { status: 403 });
  }

  const ip = serverIp?.trim().toLowerCase() || null;
  const now = new Date();

  // считаем сервер в общей статистике
  if (ip) {
    await prisma.serverStat.upsert({
      where: { ip },
      update: { count: { increment: action === "start" ? 1 : 0 }, lastSeenAt: now, userId: license.ownerId },
      create: { ip, count: 1, userId: license.ownerId },
    });
  }

  const open = await prisma.playSession.findFirst({
    where: { userId: license.ownerId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });

  if (action === "start") {
    if (open) await prisma.playSession.update({ where: { id: open.id }, data: { endedAt: now } });
    const session = await prisma.playSession.create({
      data: { userId: license.ownerId, serverIp: ip },
    });
    await prisma.user.update({ where: { id: license.ownerId }, data: { lastSeenAt: now } });
    return NextResponse.json({ ok: true, sessionId: session.id });
  }

  const add = Math.max(0, Math.min(Number(minutes ?? 1), 15)); // защита от накрутки

  if (action === "stop") {
    if (open) {
      await prisma.playSession.update({
        where: { id: open.id },
        data: { endedAt: now, minutes: { increment: add } },
      });
    }
    if (add) {
      await prisma.user.update({
        where: { id: license.ownerId },
        data: { playtimeMinutes: { increment: add }, lastSeenAt: now },
      });
    }
    return NextResponse.json({ ok: true, closed: true });
  }

  // ping
  const session = open
    ? await prisma.playSession.update({
        where: { id: open.id },
        data: { minutes: { increment: add }, serverIp: ip ?? open.serverIp },
      })
    : await prisma.playSession.create({
        data: { userId: license.ownerId, serverIp: ip, minutes: add },
      });

  const user = await prisma.user.update({
    where: { id: license.ownerId },
    data: { playtimeMinutes: { increment: add }, lastSeenAt: now },
  });

  return NextResponse.json({
    ok: true,
    sessionId: session.id,
    totalMinutes: user.playtimeMinutes,
  });
}
