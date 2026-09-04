import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifySignature, receiptSignature } from "@/lib/receipt";
import { TARIFFS, METHODS } from "@/lib/payments";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/**
 * GET /api/receipts/verify?n=LB-2026-XXXXXX&s=подпись
 * Публичная проверка подлинности чека — без авторизации, но только по
 * правильной HMAC-подписи номера. Никаких лишних данных не отдаёт:
 * маскированный юзернейм, тариф, сумма, дата.
 */
export async function GET(req: NextRequest) {
  const rl = rateLimit(`receipt-verify:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ valid: false, error: "Слишком много запросов" }, { status: 429 });
  }

  const url = new URL(req.url);
  const n = (url.searchParams.get("n") || "").trim().toUpperCase();
  const s = (url.searchParams.get("s") || "").trim().toLowerCase();

  if (!n || !s) {
    return NextResponse.json({ valid: false, error: "Нужны параметры n и s" }, { status: 400 });
  }
  if (!verifySignature(n, s)) {
    return NextResponse.json({ valid: false, error: "Подпись не совпадает — чек поддельный" });
  }

  let payment = null;
  try {
    payment = await prisma.payment.findFirst({
      where: { receiptNumber: n } as Record<string, unknown>,
      include: { user: { select: { username: true } } },
    });
  } catch {
    return NextResponse.json(
      { valid: false, error: "Проверка временно недоступна (нет колонки receiptNumber)" },
      { status: 503 },
    );
  }

  if (!payment || payment.status !== "PAID") {
    return NextResponse.json({ valid: false, error: "Чек не найден или заказ не оплачен" });
  }

  const username = payment.user?.username || "";
  const masked = username.length <= 2 ? username[0] + "*" : username[0] + "***" + username.slice(-1);
  const tariff = TARIFFS[payment.keyType as keyof typeof TARIFFS];
  const cur = payment.method === "YOOMONEY" || payment.method === "CARD_RU" ? "RUB" : "UAH";

  return NextResponse.json({
    valid: true,
    receiptNumber: n,
    signature: receiptSignature(n),
    product: `Lobok Client — ${tariff?.title || payment.keyType}`,
    amount: cur === "RUB" ? payment.amountRub : payment.amountUah,
    currency: cur,
    method: METHODS[payment.method as keyof typeof METHODS]?.title || payment.method,
    paidAt: payment.paidAt,
    buyer: masked,
  });
}
