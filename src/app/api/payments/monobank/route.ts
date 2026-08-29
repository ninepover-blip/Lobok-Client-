import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { issueKeyForPayment } from "@/lib/issueKey";
import { extractLabel, isIncomingUah, MonoWebhook } from "@/lib/monobank";

/**
 * Вебхук монобанка — автооплата для Украины (карта моно и IBAN).
 *
 * Настройка: GET /api/payments/monobank?setWebhook=1 (только админ)
 * или вручную POST https://api.monobank.ua/personal/webhook.
 *
 * Банк ждёт строго HTTP 200, иначе повторит через 60 и 600 секунд,
 * а после третьей неудачи выключит вебхук. Поэтому отвечаем 200 всегда,
 * кроме случая, когда действительно хотим повтора.
 */

/** Монобанк проверяет адрес GET-запросом и ждёт ровно 200. */
export async function GET(req: NextRequest) {
  const setup = new URL(req.url).searchParams.get("setWebhook");
  if (setup !== "1") {
    // валидация адреса банком
    return new NextResponse("ok", { status: 200 });
  }

  // ручная регистрация вебхука — только для админа
  const { getCurrentUser } = await import("@/lib/auth");
  const { setMonoWebhook, monoClientInfo } = await import("@/lib/monobank");
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "Только админы" }, { status: 403 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://lobok-client.vercel.app";
  const result = await setMonoWebhook(`${site}/api/payments/monobank`);
  const info = await monoClientInfo();
  return NextResponse.json({
    ...result,
    webHookUrl: info.ok ? info.info?.webHookUrl : undefined,
  });
}

export async function POST(req: NextRequest) {
  let body: MonoWebhook;
  try {
    body = (await req.json()) as MonoWebhook;
  } catch {
    return new NextResponse("ok", { status: 200 });
  }

  const item = body?.data?.statementItem;
  if (body?.type !== "StatementItem" || !item) {
    return new NextResponse("ok", { status: 200 });
  }

  // интересуют только входящие зачисленные гривневые переводы
  if (!isIncomingUah(item)) return new NextResponse("ok", { status: 200 });

  const label = extractLabel(item);
  if (!label) {
    console.warn("[mono] перевод без метки заказа:", item.id, item.comment);
    return new NextResponse("ok", { status: 200 });
  }

  const payment = await prisma.payment.findUnique({ where: { label } });
  if (!payment) {
    console.warn("[mono] заказ с меткой не найден:", label);
    return new NextResponse("ok", { status: 200 });
  }
  if (payment.status === "PAID") return new NextResponse("ok", { status: 200 });
  if (payment.status === "CANCELLED") {
    console.warn("[mono] платёж по отменённому заказу:", label);
    return new NextResponse("ok", { status: 200 });
  }

  // amount приходит в копейках
  const receivedUah = item.amount / 100;
  if (receivedUah + 0.01 < payment.amountUah) {
    console.warn(`[mono] недоплата по ${label}: ${receivedUah} < ${payment.amountUah}`);
    return new NextResponse("ok", { status: 200 });
  }

  await issueKeyForPayment(payment.id, item.id);
  console.log(`[mono] ключ выдан по заказу ${label}`);
  return new NextResponse("ok", { status: 200 });
}
