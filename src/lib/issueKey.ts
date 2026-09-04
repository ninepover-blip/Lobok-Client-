import prisma from "@/lib/prisma";
import { generateKey } from "@/lib/auth";
import { TARIFFS } from "@/lib/payments";
import { redeemPromo } from "@/lib/promo";
import { ensureReceiptNumber } from "@/lib/receipt";
import { onOrderPaid, onOrderCancelled } from "@/lib/notify";

/**
 * Выдача и отмена ключей за заказы.
 *
 * issueKeyForPayment идемпотентна: повторный вызов (дубль webhook'а,
 * повторный клик админа) вернёт тот же ключ, а не выдаст новый.
 * Гонка двух одновременных подтверждений защищена атомарным
 * updateMany по (id, status = PENDING).
 */

export type IssueResult = { key: string; keyId: string } | { error: string };
export type CancelResult =
  | { payment: unknown; revokedKey: string | null }
  | { error: string };

const METHOD_TITLES: Record<string, string> = {
  YOOMONEY: "ЮMoney",
  CARD_RU: "Карта МИР",
  MONO_UA: "Monobank",
  IBAN_UA: "IBAN (Україна)",
};

const AUTO_METHODS = new Set(["YOOMONEY", "MONO_UA", "IBAN_UA"]);

/** Выдать ключ за оплаченный заказ. Вызывают: админ-confirm, webhook'и ЮMoney/Monobank. */
export async function issueKeyForPayment(paymentId: string): Promise<IssueResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: { select: { id: true, username: true } } },
  });
  if (!payment) return { error: "Заказ не найден" };

  // --- идемпотентность: уже выдан -> возвращаем существующий ключ ---
  if (payment.issuedKeyId) {
    const existing = await prisma.licenseKey.findUnique({ where: { id: payment.issuedKeyId } });
    if (existing) return { key: existing.key, keyId: existing.id };
  }
  if (payment.status !== "PENDING") {
    return { error: `Заказ уже обработан (статус ${payment.status})` };
  }

  const tariff = TARIFFS[payment.keyType as keyof typeof TARIFFS];
  if (!tariff) return { error: "Неизвестный тариф заказа" };

  // --- атомарный переход PENDING -> PAID (анти-гонка webhook'ов) ---
  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: "PENDING" },
    data: { status: "PAID", paidAt: new Date() },
  });
  if (claimed.count === 0) {
    const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
    if (fresh?.issuedKeyId) {
      const existing = await prisma.licenseKey.findUnique({ where: { id: fresh.issuedKeyId } });
      if (existing) return { key: existing.key, keyId: existing.id };
    }
    return { error: "Заказ уже обрабатывается другим запросом" };
  }

  // --- создаём ключ ---
  let keyRecord;
  for (let i = 0; i < 5; i++) {
    try {
      keyRecord = await prisma.licenseKey.create({
        data: {
          key: generateKey(),
          type: payment.keyType,
          durationDays: tariff.days,
          priceRub: payment.amountRub,
          priceUah: payment.amountUah,
          status: "UNUSED",
          ownerId: payment.user.id,
          ownerUsername: payment.user.username,
        },
      });
      break;
    } catch {
      // коллизия уникального ключа — перегенерируем
    }
  }
  if (!keyRecord) {
    // откатываем статус, чтобы не потерять заказ
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "PENDING", paidAt: null },
    });
    return { error: "Не удалось создать ключ — попробуйте ещё раз" };
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { issuedKeyId: keyRecord.id },
  });

  // --- промокод: фиксируем использование (после PAID, идемпотентно) ---
  if (payment.promoId) {
    try {
      await redeemPromo({ promoId: payment.promoId, userId: payment.user.id, paymentId: payment.id });
    } catch (e) {
      console.warn("[issueKey] redeemPromo failed:", e);
    }
  }

  // --- номер чека (после оплаты), best-effort ---
  try {
    await ensureReceiptNumber({ ...payment, status: "PAID" });
  } catch (e) {
    console.warn("[issueKey] ensureReceiptNumber failed:", e);
  }

  // --- уведомления, best-effort ---
  try {
    await onOrderPaid({
      userId: payment.user.id,
      username: payment.user.username,
      tariffTitle: tariff.title,
      key: keyRecord.key,
      paymentId: payment.id,
      methodTitle: METHOD_TITLES[payment.method] || payment.method,
      auto: AUTO_METHODS.has(payment.method),
    });
  } catch (e) {
    console.warn("[issueKey] notify failed:", e);
  }

  return { key: keyRecord.key, keyId: keyRecord.id };
}

/** Отменить заказ. Если был выдан ключ — отзывает его. Идемпотентно. */
export async function cancelPayment(
  paymentId: string,
  opts: { byUserId?: string; reason?: string; byAdmin?: boolean } = {},
): Promise<CancelResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: { select: { id: true, username: true } } },
  });
  if (!payment) return { error: "Заказ не найден" };
  if (payment.status === "CANCELLED") return { payment, revokedKey: null };

  let revokedKey: string | null = null;

  if (payment.status === "PAID" && payment.issuedKeyId) {
    const key = await prisma.licenseKey.findUnique({ where: { id: payment.issuedKeyId } });
    if (key && key.status !== "REVOKED") {
      await prisma.licenseKey.update({
        where: { id: key.id },
        data: {
          status: "REVOKED",
          revokedAt: new Date(),
          revokedReason: opts.reason || "Заказ отменён",
        },
      });
      revokedKey = key.key;
    } else if (key) {
      revokedKey = key.key;
    }
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "CANCELLED",
      cancelledById: opts.byUserId || null,
      cancelReason: opts.reason || null,
      cancelledAt: new Date(),
    },
  });

  try {
    const tariff = TARIFFS[payment.keyType as keyof typeof TARIFFS];
    await onOrderCancelled({
      userId: payment.user.id,
      username: payment.user.username,
      tariffTitle: tariff?.title || payment.keyType,
      label: payment.label,
      byAdmin: !!opts.byAdmin,
      revokedKey,
      reason: opts.reason || null,
    });
  } catch (e) {
    console.warn("[cancelPayment] notify failed:", e);
  }

  return { payment: updated, revokedKey };
}

/** Отозвать ключ напрямую (для админки). */
export async function revokeKey(keyId: string, reason?: string) {
  const key = await prisma.licenseKey.findUnique({ where: { id: keyId } });
  if (!key) return { error: "Ключ не найден" };
  if (key.status === "REVOKED") return { ok: true, already: true };
  await prisma.licenseKey.update({
    where: { id: keyId },
    data: { status: "REVOKED", revokedAt: new Date(), revokedReason: reason || null },
  });
  return { ok: true };
}
