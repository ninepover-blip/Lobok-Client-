import crypto from "crypto";

/** Реквизиты для приёма оплаты. Значения можно переопределить через .env */
export const PAY = {
  yoomoneyWallet: process.env.YOOMONEY_WALLET || "4100117576587201",
  cardRu: process.env.PAY_CARD_RU || "2204120135024202",
  cardUa: process.env.PAY_CARD_UA || "4874070024567412",
  iban: process.env.PAY_IBAN || "UA343220010000026209375974850",
  ibanName: process.env.PAY_IBAN_NAME || "Зайцева Лілія Миколаївна",
  ibanTax: process.env.PAY_IBAN_TAX || "4074502105",
  ibanPurpose: process.env.PAY_IBAN_PURPOSE || "Поповнення рахунку",
} as const;

export type Tariff = {
  type: "D30" | "D90" | "FOREVER";
  title: string;
  rub: number;
  uah: number;
  days: number | null;
};

export const TARIFFS: Record<Tariff["type"], Tariff> = {
  D30: { type: "D30", title: "30 дней", rub: 100, uah: 50, days: 30 },
  D90: { type: "D90", title: "90 дней", rub: 250, uah: 125, days: 90 },
  FOREVER: { type: "FOREVER", title: "Навсегда", rub: 400, uah: 200, days: null },
};

export const METHODS = {
  YOOMONEY: { id: "YOOMONEY", title: "ЮMoney", currency: "RUB", auto: true },
  CARD_RU: { id: "CARD_RU", title: "Карта МИР", currency: "RUB", auto: false },
  MONO_UA: { id: "MONO_UA", title: "Monobank", currency: "UAH", auto: false },
  IBAN_UA: { id: "IBAN_UA", title: "IBAN (Україна)", currency: "UAH", auto: false },
} as const;

export type MethodId = keyof typeof METHODS;

/** Уникальная метка платежа — её покупатель указывает в комментарии к переводу. */
export function makeLabel(): string {
  return "LB" + crypto.randomBytes(6).toString("hex").toUpperCase();
}

/**
 * Ссылка на быструю оплату ЮMoney с меткой.
 * После оплаты ЮMoney дёргает наш webhook и ключ выдаётся автоматически.
 */
export function yoomoneyUrl(amountRub: number, label: string, successUrl: string) {
  const p = new URLSearchParams({
    receiver: PAY.yoomoneyWallet,
    "quickpay-form": "button",
    paymentType: "AC",
    sum: String(amountRub),
    label,
    successURL: successUrl,
    targets: `Lobok Client — ключ (${label})`,
  });
  return `https://yoomoney.ru/quickpay/confirm?${p.toString()}`;
}

/** Проверка подписи уведомления ЮMoney (HTTP-notification). */
export function verifyYoomoneyNotification(
  f: Record<string, string>,
  secret: string,
): boolean {
  const str = [
    f.notification_type,
    f.operation_id,
    f.amount,
    f.currency,
    f.datetime,
    f.sender,
    f.codepro,
    secret,
    f.label,
  ].join("&");
  const sha = crypto.createHash("sha1").update(str).digest("hex");
  return sha === (f.sha1_hash || "").toLowerCase();
}
