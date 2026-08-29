import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { cancelPayment, issueKeyForPayment } from "@/lib/issueKey";

/** GET — статус одного заказа (для опроса из кабинета). */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  if (payment.userId !== me.id && me.role !== "ADMIN") {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  let key = null;
  if (payment.issuedKeyId) {
    key = await prisma.licenseKey.findUnique({
      where: { id: payment.issuedKeyId },
      select: { key: true, type: true, expiresAt: true, status: true },
    });
  }
  return NextResponse.json({ payment, key });
}

/**
 * PATCH — действия с заказом.
 *  { action: "confirm" }  — админ подтверждает ручной перевод, ключ выдаётся
 *  { action: "cancel"  }  — отмена (админ или сам покупатель)
 *  { action: "paid"    }  — покупатель сообщает «я оплатил» (заявка админу)
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { action, reason } = (await req.json().catch(() => ({}))) as {
    action?: string;
    reason?: string;
  };
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });

  const isOwner = payment.userId === me.id;
  const isAdmin = me.role === "ADMIN";

  if (action === "paid") {
    if (!isOwner && !isAdmin) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    // статус не меняем — заказ остаётся PENDING до подтверждения админом
    return NextResponse.json({
      ok: true,
      message: "Заявка отправлена. Админ проверит перевод и выдаст ключ.",
    });
  }

  if (action === "confirm") {
    if (!isAdmin) return NextResponse.json({ error: "Только админы" }, { status: 403 });
    const result = await issueKeyForPayment(payment.id);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    await prisma.payment.update({ where: { id }, data: { confirmedById: me.id } });
    return NextResponse.json({ ok: true, key: result.key });
  }

  if (action === "cancel") {
    if (!isAdmin && !isOwner) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    // Покупатель может отменить только неоплаченный заказ.
    // Админ отменяет любой — включая оплаченный, тогда выданный ключ отзывается.
    if (payment.status === "PAID" && !isAdmin) {
      return NextResponse.json(
        { error: "Заказ уже оплачен. Отмену делает админ — напиши в поддержку." },
        { status: 400 },
      );
    }
    const result = await cancelPayment(payment.id, { byUserId: me.id, reason });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({
      ok: true,
      payment: result.payment,
      revokedKey: result.revokedKey,
      message: result.revokedKey
        ? `Заказ отменён, ключ ${result.revokedKey} отозван`
        : "Заказ отменён",
    });
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
}
