/**
 * Простой in-memory rate limiter (per serverless instance).
 * Не идеален на нескольких инстансах Vercel, но от базового абуза спасает.
 * Для жёсткого лимита можно потом прикрутить Upstash Redis — интерфейс тот же.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
}

/**
 * @param key       уникальный ключ бакета (например `pay:${userId}` или `val:${ip}`)
 * @param limit     максимум попыток за окно
 * @param windowMs  размер окна в мс
 * @returns { ok: true } либо { ok: false, retryAfter: секунды до конца окна }
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true; remaining: number } | { ok: false; retryAfter: number } {
  const now = Date.now();
  sweep(now);

  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true, remaining: limit - b.count };
}

/** Достаёт IP клиента из запроса (Vercel/прокси). */
export function clientIp(req: Request): string {
  const h = (n: string) => (req.headers.get(n) || "").trim();
  const fwd = h("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h("x-real-ip") || h("cf-connecting-ip") || "unknown";
}
