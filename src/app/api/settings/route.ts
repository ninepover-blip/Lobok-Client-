import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/** Публичные настройки сайта (ключ-значение). */
const PUBLIC_KEYS = ["guideVideoUrl", "launcherUrl", "discordInvite"] as const;

export async function GET() {
  const rows = await prisma.setting.findMany({ where: { key: { in: [...PUBLIC_KEYS] } } });
  const map: Record<string, string> = {};
  rows.forEach((r) => (map[r.key] = r.value));
  return NextResponse.json({ settings: map });
}

export async function PUT(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "Только админы" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const entries = Object.entries(body).filter(([k]) =>
    (PUBLIC_KEYS as readonly string[]).includes(k),
  );
  if (!entries.length) return NextResponse.json({ error: "Нечего сохранять" }, { status: 400 });

  await Promise.all(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(value ?? "") },
        create: { key, value: String(value ?? "") },
      }),
    ),
  );
  return NextResponse.json({ ok: true });
}
