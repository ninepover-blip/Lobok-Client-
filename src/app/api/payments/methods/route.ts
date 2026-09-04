import { NextResponse } from "next/server";
import { METHODS, TARIFFS } from "@/lib/payments";
import { monoConfigured } from "@/lib/monobank";

/**
 * GET /api/payments/methods — публичная конфигурация оплаты для фронта:
 * тарифы, способы, какие из них с авто-подтверждением.
 * Секретов не отдаёт: только флаги доступности.
 */
export async function GET() {
  const yoomoneyUp = !!process.env.YOOMONEY_SECRET;
  const monoUp = monoConfigured();

  const methods = Object.values(METHODS).map((m) => ({
    id: m.id,
    title: m.title,
    currency: m.currency,
    auto:
      m.id === "YOOMONEY"
        ? yoomoneyUp
        : m.id === "MONO_UA" || m.id === "IBAN_UA"
          ? monoUp
          : false, // CARD_RU всегда ручной
  }));

  return NextResponse.json(
    { tariffs: Object.values(TARIFFS), methods },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
