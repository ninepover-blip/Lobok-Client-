import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUserFromRequest, generateKey } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const me = await getAuthUserFromRequest(req);
  if (!me || me.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const body = await req.json();
  const { action, days, key } = body;

  if (action === "create") {
    const keyStr = generateKey();
    let durationDays: number | null = null;
    let expiresAt: Date | null = null;
    let keyType: string = "D30";
    if (days === "forever") {
      keyType = "FOREVER";
    } else {
      const d = parseInt(days) || 30;
      durationDays = d;
      expiresAt = new Date(Date.now() + d * 86400000);
      if (d <= 1) keyType = "D1";
      else if (d <= 30) keyType = "D30";
      else if (d <= 90) keyType = "D90";
      else keyType = "FOREVER";
    }
    const k = await prisma.licenseKey.create({
      data: {
        key: keyStr, type: keyType as any, status: "UNUSED",
        durationDays, priceRub: null, priceUah: null, expiresAt,
        createdById: me.id,
      },
    });
    return NextResponse.json({ key: k.key, id: k.id });
  }

  if (action === "list") {
    const keys = await prisma.licenseKey.findMany({ orderBy: { createdAt: "desc" } });
    const licenses = keys.map((k) => ({
      id: k.id,
      key: k.key,
      hint: k.key ? k.key.slice(-12) : "",
      durationDays: k.durationDays,
      revoked: k.status === "REVOKED",
      activatedAt: k.activatedAt,
      hwidBound: !!k.hwid,
      hwid: k.hwid,
      ip: k.ip,
      status: k.status,
      ownerUsername: k.ownerUsername,
      createdAt: k.createdAt,
    }));
    return NextResponse.json({ licenses });
  }

  if (action === "reset") {
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
    const k = await prisma.licenseKey.findFirst({ where: { key } });
    if (!k) return NextResponse.json({ changed: false, error: "Key not found" });
    await prisma.licenseKey.update({ where: { id: k.id }, data: { hwid: null, ip: null } });
    return NextResponse.json({ changed: true });
  }

  if (action === "revoke") {
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
    const k = await prisma.licenseKey.findFirst({ where: { key } });
    if (!k) return NextResponse.json({ changed: false, error: "Key not found" });
    await prisma.licenseKey.update({
      where: { id: k.id },
      data: { status: "REVOKED", revokedAt: new Date(), revokedReason: "Revoked by admin", hwid: null, ip: null },
    });
    return NextResponse.json({ changed: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
