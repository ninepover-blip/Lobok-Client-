import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyYoomoneyNotification } from "@/lib/payments";
import { issueKeyForPayment } from "@/lib/issueKey";
import { notifyAdmins } from "@/lib/notify";

/**
 * POST — webhook ЮMoney о входящем переводе (http-уведомления кошелька).
 *
 * Настройка: https://yoomoney.ru/transfer/myservices/http-notification
 *  URL: https://lobok-client.vercel.app/api/payments/yoomoney
 *  Секрет: YOOMONEY_SECRET (env на Vercel, должен совпадать).
 *
 * Всегда отвечаем 200 на штатные сценарии, чтобы ЮMoney не долбил повторами,
 * но 400/401 на битые/подписанные неверно — такие повторы тоже прекращаются.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.YOOMONEY_SECRET;
  if (!secret) {
    console.error("[yoomoney] YOOMONEY_SECRET не задан — webhook отключён");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "bad form" }, { status: 400 });

  const f: Record<string, string> = {};
  form.forEach((v, k) => (f[k] = String(v)));

  // 1) подпись
  if (!verifyYoomoneyNotification(f, secret)) {
    console.warn("[yoomoney] bad signature, label:", f.label);
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  // 2) тестовые уведомления из кабинета ЮMoney — просто подтверждаем
  if (f.test_notification === "true") {
    return NextResponse.json({ ok: true, test: true });
  }

  // 3) нас интересуют только реальные принятые переводы
  if (f.notification_type !== "p2p-incoming" && f.notification_type !== "card-incoming") {
    return NextResponse.json({ ok: true, ignored: "type" });
  }
  if (f.codepro === "true" || f.unaccepted === "true") {
    return NextResponse.json({ ok: true, ignored: "codepro/unaccepted" });
  }
  if (!f.label) {
    return NextResponse.json({ ok: true, ignored: "no label" });
  }

  // 4) заказ
  const payment = await prisma.payment.findUnique({ where: { label: f.label } });
  if (!payment || payment.method !== "YOOMONEY") {
    console.warn("[yoomoney] unknown label:", f.label);
    return NextResponse.json({ ok: true, ignored: "unknown label" });
  }
  if (payment.status !== "PENDING") {
    return NextResponse.json({ ok: true, already: payment.status });
  }

  // 5) сумма: принимаем переплату (“покупатель скинул больше”), недоплату — нет
  const paid = Math.round(parseFloat(f.withdraw_amount || f.amount || "0"));
  if (!Number.isFinite(paid) || paid < payment.amountRub) {
    console.warn(`[yoomoney] underpay label=${f.label} paid=${paid} need=${payment.amountRub}`);
    void notifyAdmins(
      `⚠️ <b>Недоплата по заказу</b>\n🔖 <code>${f.label}</code>\nПришло ${paid}₽ из ${payment.amountRub}₽. Разберись вручную в админке.`,
    );
    return NextResponse.json({ ok: true, ignored: "underpaid" });
  }

  // 6) фиксируем operation_id (потом выдаём ключ) — защита от повторной обработки того же operation_id
  try {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { operationId: f.operation_id || payment.operationId },
    });
  } catch {}

  const result = await issueKeyForPayment(payment.id);
  if ("error" in result) {
    console.error("[yoomoney] issueKey failed:", result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  console.log(`[yoomoney] PAID label=${f.label} key=${result.key.slice(0, 12)}…`);
  return NextResponse.json({ ok: true });
}
