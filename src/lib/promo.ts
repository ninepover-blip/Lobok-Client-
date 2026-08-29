import prisma from "@/lib/prisma";

/**
 * Промокоды на скидку.
 *
 * Правила:
 *  - код нечувствителен к регистру и пробелам, в базе лежит в UPPERCASE;
 *  - скидка 1..100 %, считается от цены тарифа, округление вниз (в пользу покупателя);
 *  - цена после скидки не опускается ниже 1 (нулевой платёж нельзя подтвердить переводом);
 *  - лимит использований и срок жизни проверяются и при создании заказа, и при выдаче ключа;
 *  - один пользователь может активировать конкретный промокод только один раз.
 */

export type PromoCheckOk = {
  ok: true;
  promo: {
    id: string;
    code: string;
    discount: number;
    expiresAt: Date | null;
    maxUses: number | null;
    uses: number;
  };
};
export type PromoCheckErr = { ok: false; error: string };
export type PromoCheck = PromoCheckOk | PromoCheckErr;

/** Приводит введённый код к каноническому виду. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/** Применяет скидку к цене. Округление вниз, минимум 1. */
export function applyDiscount(price: number, discount: number): number {
  const out = Math.floor(price * (1 - discount / 100));
  return Math.max(1, out);
}

/**
 * Проверяет промокод для конкретного пользователя.
 * Ничего не меняет в базе — только читает.
 */
export async function checkPromo(rawCode: string, userId: string): Promise<PromoCheck> {
  const code = normalizeCode(rawCode || "");
  if (!code) return { ok: false, error: "Введите промокод" };

  const promo = await prisma.promo.findUnique({ where: { code } });
  if (!promo) return { ok: false, error: "Такого промокода не существует" };
  if (!promo.isActive) return { ok: false, error: "Промокод отключён" };

  if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Срок действия промокода истёк" };
  }
  if (promo.maxUses !== null && promo.uses >= promo.maxUses) {
    return { ok: false, error: "Промокод исчерпан — лимит использований закончился" };
  }

  const already = await prisma.promoRedemption.findUnique({
    where: { promoId_userId: { promoId: promo.id, userId } },
  });
  if (already) return { ok: false, error: "Ты уже использовал этот промокод" };

  return {
    ok: true,
    promo: {
      id: promo.id,
      code: promo.code,
      discount: promo.discount,
      expiresAt: promo.expiresAt,
      maxUses: promo.maxUses,
      uses: promo.uses,
    },
  };
}

/**
 * Фиксирует использование промокода после успешной оплаты.
 *
 * Вызывается из issueKeyForPayment. Идемпотентно: если запись о применении
 * уже есть (повторный webhook), счётчик второй раз не увеличится —
 * защита стоит на уникальном индексе paymentId.
 */
export async function redeemPromo(opts: {
  promoId: string;
  userId: string;
  paymentId: string;
}): Promise<{ ok: boolean; alreadyRedeemed?: boolean }> {
  const existing = await prisma.promoRedemption.findUnique({
    where: { paymentId: opts.paymentId },
  });
  if (existing) return { ok: true, alreadyRedeemed: true };

  try {
    await prisma.$transaction([
      prisma.promoRedemption.create({
        data: { promoId: opts.promoId, userId: opts.userId, paymentId: opts.paymentId },
      }),
      prisma.promo.update({
        where: { id: opts.promoId },
        data: { uses: { increment: 1 } },
      }),
    ]);
    return { ok: true };
  } catch {
    // гонка двух webhook-ов: уникальный индекс не дал создать дубль — это норма
    return { ok: true, alreadyRedeemed: true };
  }
}

/** Человекочитаемый статус промокода для админки. */
export function promoState(p: {
  isActive: boolean;
  expiresAt: Date | string | null;
  maxUses: number | null;
  uses: number;
}): { label: string; tone: "ok" | "warn" | "dead" } {
  if (!p.isActive) return { label: "Выключен", tone: "dead" };
  if (p.expiresAt && new Date(p.expiresAt).getTime() < Date.now()) {
    return { label: "Истёк", tone: "dead" };
  }
  if (p.maxUses !== null && p.uses >= p.maxUses) {
    return { label: "Исчерпан", tone: "dead" };
  }
  if (p.maxUses !== null && p.uses >= p.maxUses * 0.8) {
    return { label: "Заканчивается", tone: "warn" };
  }
  return { label: "Активен", tone: "ok" };
}
