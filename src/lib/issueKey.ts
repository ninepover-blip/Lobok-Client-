import prisma from "@/lib/prisma";
import { generateKey } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/telegram";
import { TARIFFS } from "@/lib/payments";
import { redeemPromo } from "@/lib/promo";

/**
 * Помечает платёж оплаченным и выдаёт ключ владельцу.
 * Идемпотентно: повторный вызов вернёт уже выданный ключ.
 */
export async function issueKeyForPayment(paymentId: string, operationId?: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: true },
  });
  if (!payment) return { error: "Платёж не найден" as const };

  if (payment.status === "PAID" && payment.issuedKeyId) {
    const existing = await prisma.licenseKey.findUnique({ where: { id: payment.issuedKeyId } });
    return { ok: true as const, key: existing, payment };
  }

  const tariff = TARIFFS[payment.keyType as keyof typeof TARIFFS];
  const days = tariff?.days ?? null;
  const expiresAt = days ? new Date(Date.now() + days * 86400000) : null;

  const key = await prisma.licenseKey.create({
    data: {
      key: generateKey(),
      type: payment.keyType,
      status: "ACTIVE",
      durationDays: days,
      priceRub: payment.amountRub,
      priceUah: payment.amountUah,
      ownerId: payment.userId,
      ownerUsername: payment.user?.username ?? null,
      activatedAt: new Date(),
      expiresAt,
    },
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      issuedKeyId: key.id,
      operationId: operationId ?? payment.operationId,
    },
  });

  // Промокод засчитываем только после фактической оплаты, а не при создании
  // заказа — иначе брошенные корзины съедали бы лимит использований.
  if (payment.promoId) {
    await redeemPromo({
      promoId: payment.promoId,
      userId: payment.userId,
      paymentId: payment.id,
    });
  }

  if (payment.user?.telegramId) {
    await sendTelegramMessage(
      payment.user.telegramId,
      `✅ Оплата получена!\n\nТвой ключ:\n<code>${key.key}</code>\n\n` +
        `Тариф: ${tariff?.title ?? payment.keyType}\n` +
        (payment.promoCode
          ? `Промокод: ${payment.promoCode} (−${payment.promoDiscount}%)\n`
          : "") +
        `Действует: ${expiresAt ? `до ${expiresAt.toLocaleDateString("ru-RU")}` : "навсегда"}`,
    );
  }

  return { ok: true as const, key, payment };
}

/**
 * Отмена заказа. Работает и для уже оплаченных покупок:
 * выданный ключ отзывается (REVOKED), заказ помечается CANCELLED.
 * Идемпотентно — повторный вызов не ломает данные.
 */
export async function cancelPayment(
  paymentId: string,
  opts: { byUserId?: string; reason?: string } = {},
) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: true },
  });
  if (!payment) return { error: "Заказ не найден" as const };
  if (payment.status === "CANCELLED") {
    return { ok: true as const, payment, alreadyCancelled: true };
  }

  // если ключ уже был выдан — отзываем его
  let revokedKey: string | null = null;
  if (payment.issuedKeyId) {
    const key = await prisma.licenseKey.findUnique({ where: { id: payment.issuedKeyId } });
    if (key && key.status !== "REVOKED") {
      await prisma.licenseKey.update({
        where: { id: key.id },
        data: { status: "REVOKED" },
      });
      revokedKey = key.key;
    }
  }

  // Заказ отменён — возвращаем использование промокода обратно:
  // и лимит кода, и право этого пользователя применить его ещё раз.
  const redemption = await prisma.promoRedemption.findUnique({
    where: { paymentId: payment.id },
  });
  if (redemption) {
    await prisma.$transaction([
      prisma.promoRedemption.delete({ where: { id: redemption.id } }),
      prisma.promo.update({
        where: { id: redemption.promoId },
        data: { uses: { decrement: 1 } },
      }),
    ]);
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "CANCELLED",
      cancelledById: opts.byUserId ?? null,
      cancelReason: opts.reason ?? null,
      cancelledAt: new Date(),
    },
  });

  if (payment.user?.telegramId) {
    await sendTelegramMessage(
      payment.user.telegramId,
      `❌ Заказ <code>${payment.label}</code> отменён.` +
        (revokedKey ? `\n\nКлюч <code>${revokedKey}</code> отозван и больше не действует.` : "") +
        (opts.reason ? `\n\nПричина: ${opts.reason}` : ""),
    );
  }

  return { ok: true as const, payment: updated, revokedKey };
}
