import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { applyDiscount, checkPromo } from "@/lib/promo";
import { TARIFFS } from "@/lib/payments";

/**
 * POST /api/promo/check { code, keyType }
 * Проверяет промокод и возвращает пересчитанную цену — без создания заказа.
 * Нужен, чтобы покупатель видел скидку до нажатия «Оплатить».
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });

  const { code, keyType } = (await req.json().catch(() => ({}))) as {
    code?: string;
    keyType?: keyof typeof TARIFFS;
  };

  const res = await checkPromo(code || "", me.id);
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });

  const tariff = keyType && TARIFFS[keyType];
  const priced = tariff
    ? {
        rub: applyDiscount(tariff.rub, res.promo.discount),
        uah: applyDiscount(tariff.uah, res.promo.discount),
        fullRub: tariff.rub,
        fullUah: tariff.uah,
      }
    : null;

  return NextResponse.json({
    ok: true,
    code: res.promo.code,
    discount: res.promo.discount,
    expiresAt: res.promo.expiresAt,
    remaining:
      res.promo.maxUses === null ? null : Math.max(0, res.promo.maxUses - res.promo.uses),
    priced,
  });
}
