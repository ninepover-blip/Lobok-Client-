import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildReceipt, ensureReceiptNumber } from "@/lib/receipt";

/**
 * GET /api/receipts/[id] — данные чека заказа (JSON).
 * Доступ: владелец заказа или админ. Чек есть только у оплаченных заказов —
 * номер создаётся автоматически при первом обращении после PAID.
 */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { user: { select: { username: true } } },
  });
  if (!payment) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  if (payment.userId !== me.id && me.role !== "ADMIN") {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }
  if (payment.status !== "PAID") {
    return NextResponse.json({ error: "Чек доступен после подтверждения оплаты" }, { status: 400 });
  }

  const receiptNumber = await ensureReceiptNumber(payment);

  let key: { key: string; expiresAt: Date | null } | null = null;
  if (payment.issuedKeyId) {
    key = await prisma.licenseKey.findUnique({
      where: { id: payment.issuedKeyId },
      select: { key: true, expiresAt: true },
    });
  }

  const receipt = buildReceipt(payment, {
    receiptNumber,
    username: payment.user?.username ?? null,
    keyString: key?.key ?? null,
    keyExpiresAt: key?.expiresAt ?? null,
  });

  return NextResponse.json({ receipt });
}
