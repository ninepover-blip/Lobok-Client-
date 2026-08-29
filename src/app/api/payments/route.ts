import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { METHODS, MethodId, PAY, TARIFFS, makeLabel, yoomoneyUrl } from "@/lib/payments";
import { monoConfigured } from "@/lib/monobank";
import { applyDiscount, checkPromo } from "@/lib/promo";

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

  const { keyType, method, promoCode } = (await req.json().catch(() => ({}))) as {
    keyType?: keyof typeof TARIFFS;
    method?: MethodId;
    promoCode?: string;
  };

  const tariff = keyType && TARIFFS[keyType];
  if (!tariff) return NextResponse.json({ error: "Неизвестный тариф" }, { status: 400 });
  if (!method || !METHODS[method]) {
    return NextResponse.json({ error: "Выберите способ оплаты" }, { status: 400 });
  }

  // --- промокод: скидку считаем на сервере, клиенту цену не доверяем ---
  let amountRub = tariff.rub;
  let amountUah = tariff.uah;
  let promo: { id: string; code: string; discount: number } | null = null;

  if (promoCode && promoCode.trim()) {
    const res = await checkPromo(promoCode, me.id);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    promo = { id: res.promo.id, code: res.promo.code, discount: res.promo.discount };
    amountRub = applyDiscount(tariff.rub, promo.discount);
    amountUah = applyDiscount(tariff.uah, promo.discount);
  }

  const label = makeLabel();
  const payment = await prisma.payment.create({
    data: {
      userId: me.id,
      keyType: tariff.type,
      method,
      amountRub,
      amountUah,
      label,
      status: "PENDING",
      promoId: promo?.id ?? null,
      promoCode: promo?.code ?? null,
      promoDiscount: promo?.discount ?? null,
      fullAmountRub: promo ? tariff.rub : null,
      fullAmountUah: promo ? tariff.uah : null,
    },
  });

  // Реквизиты для ручных методов + ссылка для автоматического ЮMoney.
  // Везде используем amountRub/amountUah — это цена уже со скидкой.
  const instructions: Record<string, unknown> = { label };
  if (promo) {
    instructions.promo = {
      code: promo.code,
      discount: promo.discount,
      fullRub: tariff.rub,
      fullUah: tariff.uah,
      savedRub: tariff.rub - amountRub,
      savedUah: tariff.uah - amountUah,
    };
  }
  if (method === "YOOMONEY") {
    instructions.payUrl = yoomoneyUrl(amountRub, label, `${SITE}/cabinet?paid=${label}`);
    instructions.note = "После оплаты ключ придёт автоматически в кабинет.";
  } else if (method === "CARD_RU") {
    instructions.card = PAY.cardRu;
    instructions.amount = `${amountRub} ₽`;
    instructions.note = `Перевод на карту МИР. В комментарии укажи метку ${label}, затем нажми «Я оплатил».`;
  } else if (method === "MONO_UA") {
    instructions.card = PAY.cardUa;
    instructions.amount = `${amountUah} ₴`;
    instructions.auto = monoConfigured();
    instructions.note = monoConfigured()
      ? `Перевод на Monobank. Обязательно укажи метку ${label} в комментарии — ключ придёт автоматически.`
      : `Перевод на Monobank. В комментарии укажи метку ${label}, затем нажми «Я оплатил».`;
  } else if (method === "IBAN_UA") {
    instructions.iban = PAY.iban;
    instructions.recipient = PAY.ibanName;
    instructions.tax = PAY.ibanTax;
    instructions.purpose = `${PAY.ibanPurpose} ${label}`;
    instructions.amount = `${amountUah} ₴`;
    instructions.auto = monoConfigured();
    instructions.note = monoConfigured()
      ? `Оплата по IBAN. Метку ${label} в назначении платежа указывать обязательно — ключ придёт автоматически.`
      : `Оплата по IBAN. В назначении платежа обязательно укажи метку ${label}.`;
  }

  return NextResponse.json({ ok: true, payment, instructions });
}
