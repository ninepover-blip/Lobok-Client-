import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { key, username, hwid, ip } = await req.json();
  if (!key) return NextResponse.json({ valid: false, message: "Key required" });

  const k = await prisma.licenseKey.findFirst({ where: { key } });
  if (!k) return NextResponse.json({ valid: false, message: "Key not found" });

  if (k.status === "REVOKED") {
    return NextResponse.json({ valid: false, message: "Key revoked" });
  }

  if (k.expiresAt && k.expiresAt < new Date()) {
    return NextResponse.json({ valid: false, message: "Key expired" });
  }

  if (k.status === "UNUSED") {
    // First activation — bind
    let ownerId = k.ownerId;
    let ownerUsername = k.ownerUsername;
    if (username) {
      const u = await prisma.user.findUnique({ where: { username } });
      if (u) {
        ownerId = u.id;
        ownerUsername = u.username;
      } else {
        ownerUsername = username;
      }
    }
    await prisma.licenseKey.update({
      where: { id: k.id },
      data: {
        status: "ACTIVE",
        ownerId, ownerUsername,
        hwid: hwid || null, ip: ip || null,
        activatedAt: new Date(),
      },
    });
    return NextResponse.json({ valid: true, message: "License activated" });
  }

  // ACTIVE key — check device binding
  if (k.hwid && k.hwid !== hwid) {
    return NextResponse.json({ valid: false, message: "Key bound to another device. Contact support to reset." });
  }
  if (k.ip && k.ip !== ip) {
    return NextResponse.json({ valid: false, message: "Key bound to another IP. Contact support to reset." });
  }

  // Bind if not yet bound
  if (!k.hwid && hwid) {
    await prisma.licenseKey.update({ where: { id: k.id }, data: { hwid, ip: ip || k.ip } });
  }

  return NextResponse.json({ valid: true, message: "License active" });
}
