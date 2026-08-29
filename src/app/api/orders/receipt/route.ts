import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Неверные данные" }, { status: 400 });

  const { paymentId, receiptData, payerName, paymentTime } = body;

  if (!paymentId) {
    return NextResponse.json({ error: "paymentId обязателен" }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  if (payment.userId !== me.id && me.role !== "ADMIN") {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }
  if (payment.status !== "PENDING") {
    return NextResponse.json({ error: "Заказ уже обработан" }, { status: 400 });
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      receiptData: receiptData || null,
      payerName: payerName || null,
      paymentTime: paymentTime || null,
    },
  });

  return NextResponse.json({ ok: true });
}
