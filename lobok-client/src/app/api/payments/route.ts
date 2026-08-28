import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { METHODS, MethodId, PAY, TARIFFS, makeLabel, yoomoneyUrl } from "@/lib/payments";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://lobok-client.vercel.app";

/** GET — мои заказы (или все, если админ). */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const all = new URL(req.url).searchParams.get("all") === "1";
  if (all && me.role !== "ADMIN") {
    return NextResponse.json({ error: "Только админы" }, { status: 403 });
  }

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

  const { keyType, method } = (await req.json().catch(() => ({}))) as {
    keyType?: keyof typeof TARIFFS;
    method?: MethodId;
  };

  const tariff = keyType && TARIFFS[keyType];
  if (!tariff) return NextResponse.json({ error: "Неизвестный тариф" }, { status: 400 });
  if (!method || !METHODS[method]) {
    return NextResponse.json({ error: "Выберите способ оплаты" }, { status: 400 });
  }

  const label = makeLabel();
  const payment = await prisma.payment.create({
    data: {
      userId: me.id,
      keyType: tariff.type,
      method,
      amountRub: tariff.rub,
      amountUah: tariff.uah,
      label,
      status: "PENDING",
    },
  });

  // Реквизиты для ручных методов + ссылка для автоматического ЮMoney
  const instructions: Record<string, unknown> = { label };
  if (method === "YOOMONEY") {
    instructions.payUrl = yoomoneyUrl(tariff.rub, label, `${SITE}/cabinet?paid=${label}`);
    instructions.note = "После оплаты ключ придёт автоматически в кабинет.";
  } else if (method === "CARD_RU") {
    instructions.card = PAY.cardRu;
    instructions.amount = `${tariff.rub} ₽`;
    instructions.note = `Перевод на карту МИР. В комментарии укажи метку ${label}, затем нажми «Я оплатил».`;
  } else if (method === "MONO_UA") {
    instructions.card = PAY.cardUa;
    instructions.amount = `${tariff.uah} ₴`;
    instructions.note = `Перевод на Monobank. В комментарии укажи метку ${label}, затем нажми «Я оплатил».`;
  } else if (method === "IBAN_UA") {
    instructions.iban = PAY.iban;
    instructions.recipient = PAY.ibanName;
    instructions.tax = PAY.ibanTax;
    instructions.purpose = `${PAY.ibanPurpose} ${label}`;
    instructions.amount = `${tariff.uah} ₴`;
    instructions.note = `Оплата по IBAN. В назначении платежа обязательно укажи метку ${label}.`;
  }

  return NextResponse.json({ ok: true, payment, instructions });
}
