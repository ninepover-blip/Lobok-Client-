import crypto from "crypto";
import prisma from "@/lib/prisma";
import { TARIFFS } from "@/lib/payments";

const SECRET =
  process.env.RECEIPT_SECRET ||
  process.env.JWT_SECRET ||
  "receipt-fallback-secret";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://lobok-client.vercel.app";

export type PaymentLike = {
  id: string;
  label: string;
  keyType: string;
  method: string;
  amountRub: number;
  amountUah: number;
  status: string;
  createdAt: Date | string;
  paidAt?: Date | string | null;
  receiptNumber?: string | null;
  promoCode?: string | null;
  promoDiscount?: number | null;
  fullAmountRub?: number | null;
  fullAmountUah?: number | null;
  issuedKeyId?: string | null;
};

/** Генерация красивого номера чека: LB-2026-7F3K9Q */
function genNumber(): string {
  const year = new Date().getFullYear();
  const rnd = crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  return `LB-${year}-${rnd}`;
}

/**
 * Возвращает номер чека заказа. Если его ещё нет (заказ только что оплатили),
 * создаёт и сохраняет. При коллизии уникального индекса — перегенерирует.
 * Если в БД ещё нет колонки receiptNumber (не запущен upgrade.sql) —
 * вернёт временный номер на базе метки, чтобы ничего не падало.
 */
export async function ensureReceiptNumber(payment: PaymentLike): Promise<string> {
  if (payment.receiptNumber) return payment.receiptNumber;
  for (let i = 0; i < 5; i++) {
    const num = genNumber();
    try {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { receiptNumber: num } as Record<string, unknown>,
      });
      return num;
    } catch (e: unknown) {
      const msg = String((e as { message?: string })?.message || e);
      if (msg.includes("receiptNumber")) return `TMP-${payment.label}`;
      // unique collision — пробуем ещё раз
    }
  }
  return `TMP-${payment.label}`;
}

/** Подпись чека — публичное доказательство подлинности. */
export function receiptSignature(receiptNumber: string): string {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`receipt:${receiptNumber}`)
    .digest("hex")
    .slice(0, 16);
}

export function receiptVerifyUrl(receiptNumber: string): string {
  return `${SITE}/api/receipts/verify?n=${encodeURIComponent(receiptNumber)}&s=${receiptSignature(receiptNumber)}`;
}

export function receiptPageUrl(paymentId: string): string {
  return `${SITE}/receipt/${paymentId}`;
}

/** Сравнение подписей за постоянное время. */
export function verifySignature(number: string, sig: string): boolean {
  const a = Buffer.from(receiptSignature(number));
  const b = Buffer.from(String(sig || "").toLowerCase());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const METHOD_TITLES: Record<string, string> = {
  YOOMONEY: "ЮMoney",
  CARD_RU: "Карта МИР",
  MONO_UA: "Monobank",
  IBAN_UA: "IBAN (Україна)",
};

/** Полные данные чека для страницы/API. */
export function buildReceipt(
  payment: PaymentLike,
  opts: {
    receiptNumber: string;
    username?: string | null;
    keyString?: string | null;
    keyExpiresAt?: Date | string | null;
  },
) {
  const tariff = TARIFFS[payment.keyType as keyof typeof TARIFFS];
  const cur = payment.method === "YOOMONEY" || payment.method === "CARD_RU" ? "RUB" : "UAH";
  const amount = cur === "RUB" ? payment.amountRub : payment.amountUah;
  return {
    receiptNumber: opts.receiptNumber,
    signature: receiptSignature(opts.receiptNumber),
    verifyUrl: receiptVerifyUrl(opts.receiptNumber),
    orderId: payment.id,
    label: payment.label,
    product: `Lobok Client — ${tariff?.title || payment.keyType}`,
    keyType: payment.keyType,
    method: payment.method,
    methodTitle: METHOD_TITLES[payment.method] || payment.method,
    amount,
    currency: cur,
    amountRub: payment.amountRub,
    amountUah: payment.amountUah,
    promo: payment.promoCode
      ? {
          code: payment.promoCode,
          discount: payment.promoDiscount,
          fullAmount: cur === "RUB" ? payment.fullAmountRub : payment.fullAmountUah,
        }
      : null,
    status: payment.status,
    createdAt: payment.createdAt,
    paidAt: payment.paidAt || null,
    username: opts.username ?? null,
    key: opts.keyString ?? null,
    keyExpiresAt: opts.keyExpiresAt ?? null,
  };
}
