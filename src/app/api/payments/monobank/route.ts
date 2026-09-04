import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { extractLabel, monoTokenOk, parseMonoWebhook } from "@/lib/monobank";
import { issueKeyForPayment } from "@/lib/issueKey";
import { notifyAdmins } from "@/lib/notify";

/**
 * POST — webhook Monobank о пополнении счёта/карты.
 * URL с токеном: /api/payments/monobank?token=MONOBANK_WEBHOOK_SECRET
 *
 * Логика: ищем метку LB… в комментарии/назначении платежа, сверяем сумму
 * (сума в копейках), выдаём ключ через issueKeyForPayment (идемпотентно).
 * Monobank шлёт повторы, пока не получит 200 — поэтому почти всегда 200.
 */
export async function POST(req: NextRequest) {
  if (!monoTokenOk(new URL(req.url).searchParams.get("token"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const item = parseMonoWebhook(body);
  if (!item) return NextResponse.json({ ok: true, ignored: "not a statement item" });

  // только пополнения в гривне
  if (item.amount <= 0) return NextResponse.json({ ok: true, ignored: "outgoing" });
  if (item.currencyCode !== 980) return NextResponse.json({ ok: true, ignored: "not UAH" });

  const label = extractLabel(item.comment, item.description);
  if (!label) return NextResponse.json({ ok: true, ignored: "no label" });

  const payment = await prisma.payment.findUnique({ where: { label } });
  if (!payment || (payment.method !== "MONO_UA" && payment.method !== "IBAN_UA")) {
    console.warn("[monobank] unknown label:", label);
    return NextResponse.json({ ok: true, ignored: "unknown label" });
  }
  if (payment.status !== "PENDING") {
    return NextResponse.json({ ok: true, already: payment.status });
  }

  // защита от повторной обработки той же транзакции
  if (payment.operationId && payment.operationId === item.id) {
    return NextResponse.json({ ok: true, already: "same operation" });
  }

  const paidUah = Math.floor(item.amount / 100);
  if (paidUah < payment.amountUah) {
    console.warn(`[monobank] underpay label=${label} paid=${paidUah} need=${payment.amountUah}`);
    void notifyAdmins(
      `⚠️ <b>Недоплата по заказу</b>\n🔖 <code>${label}</code>\nПришло ${paidUah}₴ из ${payment.amountUah}₴. Разберись вручную в админке.`,
    );
    return NextResponse.json({ ok: true, ignored: "underpaid" });
  }

  try {
    await prisma.payment.update({ where: { id: payment.id }, data: { operationId: item.id } });
  } catch {}

  const result = await issueKeyForPayment(payment.id);
  if ("error" in result) {
    console.error("[monobank] issueKey failed:", result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  console.log(`[monobank] PAID label=${label} opId=${item.id}`);
  return NextResponse.json({ ok: true });
}

/** GET — проверка, что webhook жив (для отладки, без секретов). */
export async function GET(req: NextRequest) {
  const ok = monoTokenOk(new URL(req.url).searchParams.get("token"));
  return NextResponse.json({ ok, webhook: ok ? "configured" : "bad or missing token" });
}
