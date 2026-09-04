import prisma from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { receiptPageUrl } from "@/lib/receipt";

/**
 * Центральный модуль уведомлений.
 *
 * Кому шлём:
 *  - админы: чаты из TELEGRAM_ADMIN_CHAT_ID (можно список через запятую)
 *    + все юзеры с ролью ADMIN и привязанным Telegram.
 *  - пользователи: DM на привязанный telegramId.
 *
 * Все функции «fire-and-forget» безопасны: ошибки глотаются и пишутся в лог,
 * оплата/выдача никогда не упадёт из-за Телеграма.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://lobok-client.vercel.app";

export function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Кнопки подтверждения/отмены заказа для админов. */
export function paymentAdminKeyboard(paymentId: string) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Выдать ключ", callback_data: `pay:confirm:${paymentId}` },
        { text: "❌ Отклонить", callback_data: `pay:cancel:${paymentId}` },
      ],
      [{ text: "🖥 Админка", url: `${SITE}/admin` }],
    ],
  };
}

async function adminChats(): Promise<string[]> {
  const chats = new Set<string>();
  const env = (process.env.TELEGRAM_ADMIN_CHAT_ID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  env.forEach((c) => chats.add(c));
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", telegramId: { not: null } },
      select: { telegramId: true },
    });
    admins.forEach((a) => a.telegramId && chats.add(a.telegramId));
  } catch (e) {
    console.warn("[notify] adminChats db lookup failed:", e);
  }
  return [...chats];
}

/** Сообщение всем админам (env-чаты + привязанные админы). */
export async function notifyAdmins(
  text: string,
  replyMarkup?: Record<string, unknown>,
): Promise<void> {
  try {
    const chats = await adminChats();
    await Promise.allSettled(chats.map((c) => sendTelegramMessage(c, text, replyMarkup)));
  } catch (e) {
    console.warn("[notify] notifyAdmins failed:", e);
  }
}

/** Личное сообщение пользователю сайта (если у него привязан Telegram). */
export async function notifyUser(userId: string, text: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true },
    });
    if (user?.telegramId) await sendTelegramMessage(user.telegramId, text);
  } catch (e) {
    console.warn("[notify] notifyUser failed:", e);
  }
}

// ─────────────────────────── события оплаты ───────────────────────────

export function onOrderCreated(e: {
  paymentId: string;
  username: string;
  tariffTitle: string;
  amountRub: number;
  amountUah: number;
  methodTitle: string;
  label: string;
  promo?: string | null;
}) {
  const promoLine = e.promo ? `\n🏷 Промокод: <code>${esc(e.promo)}</code>` : "";
  return notifyAdmins(
    `📦 <b>Новый заказ</b>\n\n` +
      `👤 ${esc(e.username)}\n` +
      `📋 ${esc(e.tariffTitle)} — ${e.amountRub}₽ / ${e.amountUah}₴\n` +
      `💳 ${esc(e.methodTitle)}\n` +
      `🔖 Метка: <code>${esc(e.label)}</code>${promoLine}\n\n` +
      `Кнопки ниже: выдача после проверки перевода.`,
    paymentAdminKeyboard(e.paymentId),
  );
}

/** Покупатель нажал «Я оплатил» — админам летит заявка с кнопками. */
export function onPaymentClaimed(e: {
  paymentId: string;
  username: string;
  tariffTitle: string;
  amountRub: number;
  amountUah: number;
  methodTitle: string;
  label: string;
  payerName?: string | null;
}) {
  const payer = e.payerName ? `\n💰 Плательщик: <b>${esc(e.payerName)}</b>` : "";
  return notifyAdmins(
    `💰 <b>Заявка на проверку оплаты</b>\n\n` +
      `👤 ${esc(e.username)}\n` +
      `📋 ${esc(e.tariffTitle)} — ${e.amountRub}₽ / ${e.amountUah}₴\n` +
      `💳 ${esc(e.methodTitle)}\n` +
      `🔖 Метка: <code>${esc(e.label)}</code>${payer}\n\n` +
      `Проверь поступление и подтверди:`,
    paymentAdminKeyboard(e.paymentId),
  );
}

export function onOrderPaid(e: {
  userId: string;
  username: string;
  tariffTitle: string;
  key: string;
  paymentId: string;
  methodTitle: string;
  auto: boolean;
}) {
  void notifyUser(
    e.userId,
    `✅ <b>Оплата подтверждена!</b>\n\n` +
      `📋 Тариф: ${esc(e.tariffTitle)}\n` +
      `🔑 Твой ключ:\n<code>${esc(e.key)}</code>\n\n` +
      `🧾 Чек: ${receiptPageUrl(e.paymentId)}\n` +
      `Ключ также лежит в кабинете: ${SITE}/cabinet`,
  );
  return notifyAdmins(
    `✅ <b>Ключ выдан</b> (${e.auto ? "автооплата" : "вручную"})\n` +
      `👤 ${esc(e.username)} · 📋 ${esc(e.tariffTitle)} · 💳 ${esc(e.methodTitle)}\n` +
      `🔑 <code>${esc(e.key)}</code>`,
  );
}

export function onOrderCancelled(e: {
  userId: string;
  username: string;
  tariffTitle: string;
  label: string;
  byAdmin: boolean;
  revokedKey?: string | null;
  reason?: string | null;
}) {
  const reason = e.reason ? ` (${esc(e.reason)})` : "";
  if (e.byAdmin) {
    void notifyUser(
      e.userId,
      `❌ <b>Заказ отменён</b>${reason}\n🔖 Метка: <code>${esc(e.label)}</code>` +
        (e.revokedKey ? `\n🔑 Ключ <code>${esc(e.revokedKey)}</code> отозван.` : "") +
        `\n\nЕсли это ошибка — напиши в поддержку: ${SITE}/support`,
    );
  }
  return notifyAdmins(
    `❌ <b>Заказ отменён</b>${reason}\n👤 ${esc(e.username)} · 📋 ${esc(e.tariffTitle)}\n🔖 <code>${esc(e.label)}</code>` +
      (e.revokedKey ? `\n🔑 отозван: <code>${esc(e.revokedKey)}</code>` : ""),
  );
}

export function onKeyExpiringSoon(e: {
  userId: string;
  username: string;
  key: string;
  daysLeft: number;
}) {
  return notifyUser(
    e.userId,
    `⏳ <b>Ключ скоро истечёт</b>\n\n🔑 <code>${esc(e.key)}</code>\nОсталось дней: <b>${e.daysLeft}</b>\n\nПродлить: ${SITE}/buy`,
  );
}

export function onKeyRevoked(e: { userId?: string | null; key: string; reason?: string | null }) {
  if (!e.userId) return Promise.resolve();
  return notifyUser(
    e.userId,
    `🚫 <b>Ключ отозван</b>\n🔑 <code>${esc(e.key)}</code>` +
      (e.reason ? `\nПричина: ${esc(e.reason)}` : ""),
  );
}
