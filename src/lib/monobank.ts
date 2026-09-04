/**
 * Monobank: приём уведомлений о пополнениях (webhook "StatementItem").
 *
 * У Monobank нет подписи webhook'ов — секретность обеспечивается
 * неугадываемым URL с токеном:
 *   https://SITE/api/payments/monobank?token=MONOBANK_WEBHOOK_SECRET
 * Токен задаётся в env и проверяется сверкой в route.
 *
 * Как включить:
 *  1. Задать в Vercel env: MONOBANK_TOKEN (токен из monobank.ua/api),
 *     MONOBANK_WEBHOOK_SECRET (любая длинная случайная строка).
 *  2. Один раз выставить webhook (см. install_webhook.sh или ЧИТАЙ_МЕНЯ.md).
 */

export function monoConfigured(): boolean {
  return !!(process.env.MONOBANK_TOKEN && process.env.MONOBANK_WEBHOOK_SECRET);
}

export function monoTokenOk(token: string | null): boolean {
  const secret = process.env.MONOBANK_WEBHOOK_SECRET || "";
  return !!secret && !!token && token === secret;
}

/** Вытаскивает платёжную метку LBXXXXXXXXXXXX из текста перевода. */
export function extractLabel(...texts: Array<string | null | undefined>): string | null {
  for (const t of texts) {
    if (!t) continue;
    const m = String(t).toUpperCase().match(/\bLB[0-9A-F]{12}\b/);
    if (m) return m[0];
  }
  return null;
}

export type MonoStatementItem = {
  id: string;
  time: number;
  description?: string;
  comment?: string;
  amount: number; // в копейках, пополнение > 0
  currencyCode: number; // 980 = UAH
  operationAmount?: number;
};

/** Достаёт StatementItem из тела webhook'a monobank. */
export function parseMonoWebhook(body: unknown): MonoStatementItem | null {
  try {
    const b = body as {
      type?: string;
      data?: { statementItem?: MonoStatementItem };
    };
    if (!b || b.type !== "StatementItem" || !b.data?.statementItem) return null;
    return b.data.statementItem;
  } catch {
    return null;
  }
}
