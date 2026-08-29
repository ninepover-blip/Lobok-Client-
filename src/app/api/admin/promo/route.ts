import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { normalizeCode } from "@/lib/promo";

/** GET — список промокодов со статистикой. Только админ. */
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "Только админы" }, { status: 403 });
  }

  const promos = await prisma.promo.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      redemptions: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: { select: { username: true } } },
      },
      _count: { select: { redemptions: true } },
    },
  });

  return NextResponse.json({ promos });
}

/** POST — создать промокод. */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "Только админы" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    code?: string;
    discount?: number | string;
    durationDays?: number | string | null;
    maxUses?: number | string | null;
    comment?: string;
  };

  const code = normalizeCode(body.code || "");
  if (!code) return NextResponse.json({ error: "Введите название промокода" }, { status: 400 });
  if (code.length < 3 || code.length > 32) {
    return NextResponse.json({ error: "Название: от 3 до 32 символов" }, { status: 400 });
  }
  if (!/^[A-Z0-9_-]+$/.test(code)) {
    return NextResponse.json(
      { error: "Только латиница, цифры, дефис и подчёркивание" },
      { status: 400 },
    );
  }

  const discount = Number(body.discount);
  if (!Number.isFinite(discount) || discount < 1 || discount > 100) {
    return NextResponse.json({ error: "Скидка должна быть от 1 до 100 %" }, { status: 400 });
  }

  // Длительность: пусто / 0 => бессрочно
  let durationDays: number | null = null;
  let expiresAt: Date | null = null;
  if (body.durationDays !== null && body.durationDays !== undefined && body.durationDays !== "") {
    const d = Number(body.durationDays);
    if (!Number.isFinite(d) || d < 0 || d > 3650) {
      return NextResponse.json({ error: "Длительность: от 1 до 3650 дней" }, { status: 400 });
    }
    if (d > 0) {
      durationDays = Math.floor(d);
      expiresAt = new Date(Date.now() + durationDays * 86400000);
    }
  }

  // Лимит использований: пусто / 0 => без ограничения
  let maxUses: number | null = null;
  if (body.maxUses !== null && body.maxUses !== undefined && body.maxUses !== "") {
    const m = Number(body.maxUses);
    if (!Number.isFinite(m) || m < 0 || m > 1_000_000) {
      return NextResponse.json({ error: "Лимит: от 1 до 1000000" }, { status: 400 });
    }
    if (m > 0) maxUses = Math.floor(m);
  }

  const dup = await prisma.promo.findUnique({ where: { code } });
  if (dup) return NextResponse.json({ error: `Промокод ${code} уже существует` }, { status: 409 });

  const promo = await prisma.promo.create({
    data: {
      code,
      discount: Math.floor(discount),
      durationDays,
      expiresAt,
      maxUses,
      comment: body.comment?.trim() || null,
      createdById: me.id,
    },
  });

  return NextResponse.json({ ok: true, promo });
}

/** PUT — включить/выключить или изменить параметры промокода. */
export async function PUT(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "Только админы" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    action?: "toggle" | "update";
    isActive?: boolean;
    discount?: number;
    maxUses?: number | null;
    addDays?: number;
  };

  if (!body.id) return NextResponse.json({ error: "Не указан промокод" }, { status: 400 });
  const promo = await prisma.promo.findUnique({ where: { id: body.id } });
  if (!promo) return NextResponse.json({ error: "Промокод не найден" }, { status: 404 });

  const data: Record<string, unknown> = {};

  if (body.action === "toggle") {
    data.isActive = !promo.isActive;
  } else {
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (body.discount !== undefined) {
      const d = Number(body.discount);
      if (!Number.isFinite(d) || d < 1 || d > 100) {
        return NextResponse.json({ error: "Скидка: от 1 до 100 %" }, { status: 400 });
      }
      data.discount = Math.floor(d);
    }
    if (body.maxUses !== undefined) {
      if (body.maxUses === null) data.maxUses = null;
      else {
        const m = Number(body.maxUses);
        if (!Number.isFinite(m) || m < 0) {
          return NextResponse.json({ error: "Некорректный лимит" }, { status: 400 });
        }
        data.maxUses = m > 0 ? Math.floor(m) : null;
      }
    }
    if (body.addDays !== undefined) {
      const add = Number(body.addDays);
      if (Number.isFinite(add) && add !== 0) {
        const base = promo.expiresAt && promo.expiresAt > new Date() ? promo.expiresAt : new Date();
        data.expiresAt = new Date(base.getTime() + add * 86400000);
      }
    }
  }

  const updated = await prisma.promo.update({ where: { id: promo.id }, data });
  return NextResponse.json({ ok: true, promo: updated });
}

/** DELETE — удалить промокод. История применений удалится каскадом. */
export async function DELETE(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "Только админы" }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Не указан промокод" }, { status: 400 });

  const promo = await prisma.promo.findUnique({
    where: { id },
    include: { _count: { select: { redemptions: true } } },
  });
  if (!promo) return NextResponse.json({ error: "Промокод не найден" }, { status: 404 });

  // Уже применённый промокод лучше выключить, чем стирать историю продаж
  if (promo._count.redemptions > 0) {
    const off = await prisma.promo.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({
      ok: true,
      promo: off,
      softDisabled: true,
      message: `Промокод использован ${promo._count.redemptions} раз — он выключен, но не удалён, чтобы сохранить историю покупок`,
    });
  }

  await prisma.promo.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: true });
}
