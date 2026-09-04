import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/**
 * POST /api/keys/validate — проверка/активация ключа из лаунчера/клиента.
 *
 * Что усилено по сравнению со старой версией:
 *  - rate limit: по IP и по ключу (анти-брутфорс ключей);
 *  - бан-проверки: юзер в бане / активный BAN / IP_BAN из Punishment;
 *  - привязка 1 ключ = 1 юзер + 1 устройство (HWID), IP фиксируется;
 *  - активация выставляет expiresAt = сейчас + durationDays (раньше ключ
 *    без expiresAt жил вечно — баг);
 *  - статистика: validationCount / lastValidatedAt (после upgrade.sql,
 *    без него — молча пропускается);
 *  - заголовок X-LB-Sign: HMAC-подпись ответа, чтобы клиент мог убедиться,
 *    что отвечает настоящий сервер (защита от локального фейк-сервера);
 *  - Cache-Control: no-store — ответ нельзя закэшировать и переиспользовать;
 *  - единый формат ошибок: { valid:false, code, error }.
 */

const SIGN_SECRET = process.env.KEY_SIGN_SECRET || process.env.JWT_SECRET || "key-sign-fallback";

function sign(payload: string): string {
  return crypto.createHmac("sha256", SIGN_SECRET).update(payload).digest("hex").slice(0, 24);
}

function reply(
  status: number,
  body: Record<string, unknown>,
  sigPayload?: { key: string; hwid?: string; valid: boolean },
) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (sigPayload) {
    headers["X-LB-Sign"] = sign(
      `${sigPayload.key}|${sigPayload.hwid || ""}|${sigPayload.valid}`,
    );
  }
  return NextResponse.json(body, { status, headers });
}

/** Лог неудачных/успешных проверок, best-effort (таблица из upgrade.sql). */
async function logValidation(entry: {
  keyId?: string | null;
  keyMask: string;
  ip: string;
  hwid?: string | null;
  ok: boolean;
  error?: string | null;
}) {
  try {
    await prisma.$executeRaw`
      INSERT INTO "KeyValidationLog" ("id", "keyId", "keyMask", "ip", "hwid", "ok", "error", "createdAt")
      VALUES (${crypto.randomUUID()}, ${entry.keyId ?? null}, ${entry.keyMask}, ${entry.ip},
              ${entry.hwid ?? null}, ${entry.ok}, ${entry.error ?? null}, NOW())`;
  } catch {
    /* таблицы ещё нет — просто пропускаем */
  }
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  const body = (await req.json().catch(() => null)) as {
    key?: string;
    username?: string;
    hwid?: string;
    ip?: string;
  } | null;
  if (!body) return reply(400, { valid: false, code: "BAD_JSON", error: "Неверный запрос" });

  const key = String(body.key || "").trim();
  const username = String(body.username || "").trim();
  const hwid = body.hwid ? String(body.hwid).trim() : "";
  const clientIpReported = body.ip ? String(body.ip).trim() : ip;

  if (!key || !username) {
    return reply(400, { valid: false, code: "MISSING", error: "key & username required" });
  }
  // быстрая sanity-проверка формата, чтобы не дёргать БД мусором
  if (!/^Lobok-[A-Z0-9]{12}-client$/i.test(key)) {
    return reply(400, { valid: false, code: "BAD_FORMAT", error: "Invalid key format" });
  }
  const keyNorm = key.replace(/^lobok-/i, "Lobok-").replace(/-client$/i, "-client");
  const keyMask = keyNorm.slice(0, 12) + "…";

  // --- rate limit: 20/мин с IP, 6/мин по ключу ---
  const rlIp = rateLimit(`val:ip:${ip}`, 20, 60_000);
  if (!rlIp.ok) {
    return reply(429, { valid: false, code: "RATE_LIMIT", error: "Слишком много попыток", retryAfter: rlIp.retryAfter });
  }
  const rlKey = rateLimit(`val:key:${keyNorm}`, 6, 60_000);
  if (!rlKey.ok) {
    return reply(429, { valid: false, code: "RATE_LIMIT", error: "Слишком частые проверки ключа", retryAfter: rlKey.retryAfter });
  }

  const sigBase = { key: keyNorm, hwid, valid: true };
  const fail = async (
    status: number,
    code: string,
    error: string,
    keyId: string | null = null,
  ) => {
    void logValidation({ keyId, keyMask, ip, hwid, ok: false, error: code });
    return reply(status, { valid: false, code, error }, { ...sigBase, valid: false });
  };

  const k = await prisma.licenseKey.findUnique({ where: { key: keyNorm } });
  if (!k) return fail(404, "NOT_FOUND", "Ключ не найден");

  if (k.status === "REVOKED") {
    return fail(403, "REVOKED", "Ключ отозван" + (k.revokedReason ? `: ${k.revokedReason}` : ""), k.id);
  }
  if (k.status === "EXPIRED") return fail(403, "EXPIRED", "Срок ключа истёк", k.id);

  // ленивая конверсия в EXPIRED
  if (k.expiresAt && k.expiresAt.getTime() < Date.now()) {
    await prisma.licenseKey.update({ where: { id: k.id }, data: { status: "EXPIRED" } });
    return fail(403, "EXPIRED", "Срок ключа истёк", k.id);
  }

  // привязка к @USER
  if (k.ownerUsername && k.ownerUsername !== username) {
    return fail(403, "OTHER_USER", "Ключ привязан к другому пользователю", k.id);
  }

  // --- баны: юзер / BAN / IP_BAN (только для уже привязанного ключа юзера) ---
  const user = await prisma.user.findUnique({ where: { username } });
  if (user) {
    if (user.isBanned && (!user.banExpiresAt || user.banExpiresAt > new Date())) {
      return fail(403, "USER_BANNED", "Аккаунт заблокирован", k.id);
    }
    const activeBan = await prisma.punishment.findFirst({
      where: {
        active: true,
        OR: [
          { type: "BAN", targetId: user.id, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          { type: "IP_BAN", targetIp: ip, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        ],
      },
    });
    if (activeBan) {
      return fail(403, activeBan.type === "IP_BAN" ? "IP_BANNED" : "USER_BANNED", "Доступ заблокирован (бан)", k.id);
    }
  }

  const now = new Date();

  // --- первая активация: привязываем юзера + HWID + IP, стартует срок действия ---
  if (k.status === "UNUSED") {
    const expiresAt =
      k.durationDays && !k.expiresAt
        ? new Date(now.getTime() + k.durationDays * 86_400_000)
        : k.expiresAt;

    const updated = await prisma.licenseKey.update({
      where: { id: k.id },
      data: {
        ownerId: k.ownerId || user?.id || null,
        ownerUsername: k.ownerUsername || username,
        hwid: hwid || null,
        ip: clientIpReported || null,
        status: "ACTIVE",
        activatedAt: now,
        expiresAt,
      },
    });

    void bumpStats(k.id);
    void logValidation({ keyId: k.id, keyMask, ip, hwid, ok: true });
    return ok(k, updated.expiresAt, true, sigBase);
  }

  // --- ACTIVE: HWID = 1 устройство ---
  if (k.hwid && hwid && k.hwid !== hwid) {
    return fail(
      403,
      "HWID_MISMATCH",
      "Ключ уже привязан к другому устройству. Передача ключа запрещена — обратись к админу для сброса HWID.",
      k.id,
    );
  }
  // добор HWID, если по какой-то причине не был привязан
  if (!k.hwid && hwid) {
    try {
      await prisma.licenseKey.update({ where: { id: k.id }, data: { hwid, ip: clientIpReported || k.ip } });
    } catch {}
  }

  void bumpStats(k.id);
  void logValidation({ keyId: k.id, keyMask, ip, hwid, ok: true });
  return ok(k, k.expiresAt, false, sigBase);
}

async function bumpStats(keyId: string) {
  try {
    await prisma.licenseKey.update({
      where: { id: keyId },
      data: {
        validationCount: { increment: 1 },
        lastValidatedAt: new Date(),
      } as Record<string, unknown>,
    });
  } catch {
    /* колонок ещё нет — пропускаем */
  }
}

function ok(
  k: { type: string },
  expiresAt: Date | null,
  activated: boolean,
  sigBase: { key: string; hwid?: string; valid: boolean },
) {
  const now = Date.now();
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - now) / 86_400_000)) : null;
  return reply(
    200,
    {
      valid: true,
      activated: activated || undefined,
      message: activated ? "Ключ активирован" : "OK",
      type: k.type,
      expiresAt,
      daysLeft,
      serverTime: new Date(now).toISOString(),
    },
    sigBase,
  );
}
