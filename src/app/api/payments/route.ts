import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { METHODS, MethodId, PAY, TARIFFS, makeLabel, yoomoneyUrl } from "@/lib/payments";
import { monoConfigured } from "@/lib/monobank";
import { onOrderCreated } from "@/lib/notify";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://lobok-client.vercel.app";

/** Сколько живёт неоплаченный заказ, после чего авто-отменяется. */
const ORDER_TTL_MS = 24 * 60 * 60 * 1000;

const METHOD_TITLES: Record<string, string> = {
  YOOMONEY: "ЮMoney",
  CARD_RU: "Карта МИР",
  MONO_UA: "Monobank",
  IBAN_UA: "IBAN (Україна)",
};

/** Ленивая авто-отмена протухших PENDING-заказов (без cron). */
async function sweepExpired(userId?: string) {
  try {
    const expired = await prisma.payment.findMany({
      where: {
        status: "PENDING",
        ...(userId ? { userId } : {}),
        createdAt: { lt: new Date(Date.now() - ORDER_TTL_MS) },
      },
      select: { id: true },
      take: 50,
    });
    if (expired.length) {
      await prisma.payment.updateMany({
        where: { id: { in: expired.map((p) => p.id) }, status: "PENDING" },
        data: { status: "CANCELLED", cancelReason: "Истекло время оплаты (24ч)", cancelledAt: new Date() },
      });
    }
  } catch (e) {
    console.warn("[payments] sweepExpired failed:", e);
  }
}

/** GET — мои заказы (или все, если админ: ?all=1). */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const all = new URL(req.url).searchParams.get("all") === "1";
  if (all && me.role !== "ADMIN") {
    return NextResponse.json({ error: "Только админы" }, { status: 403 });
  }

  await sweepExpired(all ? undefined : me.id);

  const payments = await prisma.payment.findMany({
    where: all ? {} : { userId: me.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { username: true, role: true, avatarUrl: true } } },
  });
  return NextResponse.json({ payments });
}

/** POST — создать заказ и получить реквизиты/ссылку на оплату. */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });

  // защита от спама заказами
  const rl = rateLimit(`pay:${me.id}:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Слишком много заказов. Подожди ${rl.retryAfter} сек.` },
      { status: 429 },
    );
  }

  const { keyType, method } = (await req.json().catch(() => ({}))) as {
    keyType?: keyof typeof TARIFFS;
    method?: MethodId;
  };

  const tariff = keyType && TARIFFS[keyType];
  if (!tariff) return NextResponse.json({ error: "Неизвестный тариф" }, { status: 400 });
  if (!method || !METHODS[method]) {
    return NextResponse.json({ error: "Выберите способ оплаты" }, { status: 400 });
  }

  const amountRub = tariff.rub;
  const amountUah = tariff.uah;

  // --- идемпотентность: есть живой PENDING такой же -> возвращаем его ---
  await sweepExpired(me.id);
  const existing = await prisma.payment.findFirst({
    where: {
      userId: me.id,
      keyType: tariff.type,
      method,
      status: "PENDING",
      amountRub,
      amountUah,
    },
    orderBy: { createdAt: "desc" },
  });

  let payment = existing;
  if (!payment) {
    payment = await prisma.payment.create({
      data: {
        userId: me.id,
        keyType: tariff.type,
        method,
        amountRub,
        amountUah,
        label: makeLabel(),
        status: "PENDING",
      },
    });

    void onOrderCreated({
      paymentId: payment.id,
      username: me.username,
      tariffTitle: tariff.title,
      amountRub,
      amountUah,
      methodTitle: METHOD_TITLES[method] || method,
      label: payment.label,
    });
  }

  // Реквизиты/ссылка.
  const instructions: Record<string, unknown> = { label: payment.label, reused: !!existing };
  if (method === "YOOMONEY") {
    instructions.payUrl = yoomoneyUrl(amountRub, payment.label, `${SITE}/cabinet?paid=${payment.label}`);
    instructions.note = "После оплаты ключ придёт автоматически в кабинет.";
  } else if (method === "CARD_RU") {
    instructions.card = PAY.cardRu;
    instructions.amount = `${amountRub} ₽`;
    instructions.note = `Перевод на карту МИР. В комментарии укажи метку ${payment.label}, затем нажми «Я оплатил».`;
  } else if (method === "MONO_UA") {
    instructions.card = PAY.cardUa;
    instructions.amount = `${amountUah} ₴`;
    instructions.auto = monoConfigured();
    instructions.note = monoConfigured()
      ? `Перевод на Monobank. Обязательно укажи метку ${payment.label} в комментарии — ключ придёт автоматически.`
      : `Перевод на Monobank. В комментарии укажи метку ${payment.label}, затем нажми «Я оплатил».`;
  } else if (method === "IBAN_UA") {
    instructions.iban = PAY.iban;
    instructions.recipient = PAY.ibanName;
    instructions.tax = PAY.ibanTax;
    instructions.purpose = `${PAY.ibanPurpose} ${payment.label}`;
    instructions.amount = `${amountUah} ₴`;
    instructions.auto = monoConfigured();
    instructions.note = monoConfigured()
      ? `Оплата по IBAN. Метку ${payment.label} в назначении платежа указывать обязательно — ключ придёт автоматически.`
      : `Оплата по IBAN. В назначении платежа обязательно укажи метку ${payment.label}.`;
  }

  return NextResponse.json({ ok: true, payment, instructions });
}