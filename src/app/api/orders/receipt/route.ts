import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { orderId, paymentMethod, amount, receiptText, payerName, paymentTime } = body;

  if (!orderId || !paymentMethod) {
    return NextResponse.json({ error: "orderId and paymentMethod are required" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
