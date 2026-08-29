import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyYoomoneyNotification } from "@/lib/payments";
import { issueKeyForPayment } from "@/lib/issueKey";

/**
 * Webhook ЮMoney (HTTP-уведомления).
 * Настройка: https://yoomoney.ru/transfer/myservices/http-notification
 *   URL      : https://lobok-client.vercel.app/api/payments/yoomoney
 *   Секрет   : положить в YOOMONEY_SECRET
 * Приходит application/x-www-form-urlencoded. Отвечать нужно 200, иначе ЮMoney повторит.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.YOOMONEY_SECRET || "";
  const raw = await req.text();
  const form = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>;

  if (!secret) {
    console.error("[yoomoney] YOOMONEY_SECRET не задан");
    return new NextResponse("ok", { status: 200 });
  }
  if (!verifyYoomoneyNotification(form, secret)) {
    console.warn("[yoomoney] неверная подпись уведомления");
    return new NextResponse("bad sign", { status: 403 });
  }
  // Кнопка «Протестировать» в настройках ЮMoney — подпись валидна,
  // но реального перевода не было. Отвечаем 200 и ничего не выдаём.
  if (form.test_notification === "true") {
    console.log("[yoomoney] тестовое уведомление — настройки верны");
    return new NextResponse("ok", { status: 200 });
  }
  // codepro=true — оплата «с протекцией», деньги ещё не зачислены
  if (form.unaccepted === "true" || form.codepro === "true") {
    return new NextResponse("ok", { status: 200 });
  }

  const label = form.label;
  if (!label) return new NextResponse("ok", { status: 200 });

  const payment = await prisma.payment.findUnique({ where: { label } });
  if (!payment) {
    console.warn("[yoomoney] платёж с меткой не найден:", label);
    return new NextResponse("ok", { status: 200 });
  }
  if (payment.status === "PAID") return new NextResponse("ok", { status: 200 });

  // проверяем, что пришло не меньше суммы заказа
  const received = Number(form.withdraw_amount || form.amount || 0);
  if (received + 0.01 < payment.amountRub) {
    console.warn(`[yoomoney] недоплата по ${label}: ${received} < ${payment.amountRub}`);
    return new NextResponse("ok", { status: 200 });
  }

  await issueKeyForPayment(payment.id, form.operation_id);
  return new NextResponse("ok", { status: 200 });
}
