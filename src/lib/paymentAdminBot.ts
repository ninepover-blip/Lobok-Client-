import prisma from "@/lib/prisma";
import { tgApi, sendTelegramMessage } from "@/lib/telegram";
import { cancelPayment, issueKeyForPayment } from "@/lib/issueKey";

/**
 * Обработка нажатий админских кнопок под уведомлениями о заказах:
 *   callback_data: "pay:confirm:<paymentId>" | "pay:cancel:<paymentId>"
 *
 * Подключается одной вставкой в src/app/api/bot/telegram/route.ts
 * (см. bot_patch.md в корне пакета).
 *
 * Безопасность: кнопка сработает только если нажавший — пользователь сайта
 * с ролью ADMIN и привязанным Telegram.
 */

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function handlePaymentAdminCallback(args: {
  data: string;
  chatId: string;
  callbackId: string;
  messageId?: number;
}): Promise<boolean> {
  const { data, chatId, callbackId, messageId } = args;
  const m = data.match(/^pay:(confirm|cancel):([A-Za-z0-9]+)$/);
  if (!m) return false;
  const [, action, paymentId] = m;

  // кто жмёт?
  const admin = await prisma.user.findFirst({
    where: { telegramId: chatId, role: "ADMIN" },
    select: { id: true, username: true },
  });
  if (!admin) {
    await tgApi("answerCallbackQuery", {
      callback_query_id: callbackId,
      text: "⛔ Только для админов сайта",
      show_alert: true,
    });
    return true;
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: { select: { username: true } } },
  });
  if (!payment) {
    await tgApi("answerCallbackQuery", { callback_query_id: callbackId, text: "Заказ не найден" });
    return true;
  }

  const footer = `\n\n— через кнопку: @${esc(admin.username)}`;
  let resultText: string;
  let toast: string;

  if (action === "confirm") {
    const res = await issueKeyForPayment(paymentId);
    if ("error" in res) {
      resultText = `⚠️ ${esc(res.error)}`;
      toast = res.error;
    } else {
      try {
        await prisma.payment.update({ where: { id: paymentId }, data: { confirmedById: admin.id } });
      } catch {}
      resultText = `✅ <b>Ключ выдан:</b>\n<code>${esc(res.key)}</code>`;
      toast = "Ключ выдан ✔";
    }
  } else {
    const res = await cancelPayment(paymentId, {
      byUserId: admin.id,
      byAdmin: true,
      reason: `Отклонено админом @${admin.username}`,
    });
    if ("error" in res) {
      resultText = `⚠️ ${esc(res.error)}`;
      toast = res.error;
    } else {
      resultText =
        "❌ <b>Заказ отклонён</b>" +
        (res.revokedKey ? `\n🔑 отозван: <code>${esc(res.revokedKey)}</code>` : "");
      toast = "Заказ отклонён";
    }
  }

  await tgApi("answerCallbackQuery", { callback_query_id: callbackId, text: toast });

  // подписываем исходное сообщение и убираем кнопки
  if (messageId) {
    const buyer = payment.user?.username ? `👤 ${esc(payment.user.username)}` : "";
    await tgApi("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      text:
        `📦 Заказ <code>${esc(payment.label)}</code> ${buyer}\n` +
        `${payment.amountRub}₽ / ${payment.amountUah}₴ · ${esc(payment.method)}\n\n` +
        resultText + footer,
    });
  } else {
    await sendTelegramMessage(chatId, resultText + footer);
  }

  return true;
}
