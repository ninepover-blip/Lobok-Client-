/**
 * Монобанк — автоматическая оплата для Украины.
 *
 * Работает на personal API (https://api.monobank.ua/docs/index.html):
 * банк присылает вебхук на каждое движение по счёту, мы ищем среди входящих
 * переводов тот, в комментарии которого есть метка заказа (LBxxxxxxxxxxxx).
 *
 * Токен берётся в личном кабинете https://api.monobank.ua/ (кнопка «Отримати токен»).
 * Внешние библиотеки не нужны — это обычные HTTP-запросы.
 */

const MONO_API = "https://api.monobank.ua";

/** Валюта UAH по ISO 4217. */
export const UAH = 980;

export type MonoStatementItem = {
  id: string;
  time: number;
  description?: string;
  comment?: string;
  amount: number; // в копейках; > 0 — приход
  operationAmount?: number;
  currencyCode: number;
  balance?: number;
  hold?: boolean;
};

export type MonoWebhook = {
  type?: string;
  data?: { account?: string; statementItem?: MonoStatementItem };
};

function token(): string {
  return process.env.MONOBANK_TOKEN || "";
}

export function monoConfigured(): boolean {
  return Boolean(token());
}

/**
 * Регистрирует вебхук в монобанке.
 * Банк сначала делает GET на этот URL и ждёт ровно 200 — иначе не включит.
 */
export async function setMonoWebhook(url: string) {
  if (!token()) return { ok: false, error: "MONOBANK_TOKEN не задан" };
  const r = await fetch(`${MONO_API}/personal/webhook`, {
    method: "POST",
    headers: { "X-Token": token(), "Content-Type": "application/json" },
    body: JSON.stringify({ webHookUrl: url }),
  });
  const text = await r.text();
  return r.ok
    ? { ok: true as const, response: text }
    : { ok: false as const, error: `mono ${r.status}: ${text}` };
}

/** Информация о клиенте — заодно показывает текущий webHookUrl. */
export async function monoClientInfo() {
  if (!token()) return { ok: false as const, error: "MONOBANK_TOKEN не задан" };
  const r = await fetch(`${MONO_API}/personal/client-info`, {
    headers: { "X-Token": token() },
  });
  if (!r.ok) return { ok: false as const, error: `mono ${r.status}: ${await r.text()}` };
  return { ok: true as const, info: await r.json() };
}

/**
 * Достаёт метку заказа (LB + 12 hex) из комментария или описания перевода.
 * Плательщики часто пишут метку в разном регистре и с лишним текстом.
 */
export function extractLabel(item: MonoStatementItem): string | null {
  const haystack = `${item.comment ?? ""} ${item.description ?? ""}`.toUpperCase();
  const m = haystack.match(/LB[0-9A-F]{12}/);
  return m ? m[0] : null;
}

/**
 * Проверяет, что это входящий зачисленный платёж в гривне.
 * hold=true — деньги ещё не зачислены, ключ выдавать рано.
 */
export function isIncomingUah(item: MonoStatementItem): boolean {
  return item.amount > 0 && item.currencyCode === UAH && item.hold !== true;
}
