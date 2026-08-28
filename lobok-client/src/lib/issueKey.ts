import prisma from "@/lib/prisma";
import { generateKey } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/telegram";
import { TARIFFS } from "@/lib/payments";

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

  if (payment.user?.telegramId) {
    await sendTelegramMessage(
      payment.user.telegramId,
      `✅ Оплата получена!\n\nТвой ключ:\n<code>${key.key}</code>\n\n` +
        `Тариф: ${tariff?.title ?? payment.keyType}\n` +
        `Действует: ${expiresAt ? `до ${expiresAt.toLocaleDateString("ru-RU")}` : "навсегда"}`,
    );
  }

  return { ok: true as const, key, payment };
}
