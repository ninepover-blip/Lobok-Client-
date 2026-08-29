import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-must-32-chars!!";

/**
 * POST /api/launcher/auth/verify-2fa
 * Body: { username, key, hwid, code }
 * Verifies the2FA code then issues a session token.
 */
export async function POST(req: NextRequest) {
  const { username, key, hwid, code } = await req.json();
  if (!username || !key || !code) {
    return NextResponse.json({ success: false, error: "username, key & code required" }, { status: 400 });
  }

  // Validate key
  const k = await prisma.licenseKey.findUnique({ where: { key } });
  if (!k) return NextResponse.json({ success: false, error: "Invalid key" }, { status: 404 });
  if (k.status === "REVOKED") return NextResponse.json({ success: false, error: "Key revoked" }, { status: 403 });
  if (k.status === "EXPIRED") return NextResponse.json({ success: false, error: "Key expired" }, { status: 403 });
  if (k.expiresAt && k.expiresAt < new Date()) {
    await prisma.licenseKey.update({ where: { id: k.id }, data: { status: "EXPIRED" } });
    return NextResponse.json({ success: false, error: "Key expired" }, { status: 403 });
  }
  if (k.ownerUsername && k.ownerUsername !== username) {
    return NextResponse.json({ success: false, error: "Key bound to another user" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  // Verify 2FA code
  if (!user.twoFACode || user.twoFACode !== code || !user.twoFACodeExpires || user.twoFACodeExpires < new Date()) {
    return NextResponse.json({ success: false, error: "Invalid or expired 2FA code" }, { status: 401 });
  }

  // Clear the code
  await prisma.user.update({ where: { id: user.id }, data: { twoFACode: null, twoFACodeExpires: null } });

  // HWID check (same as main auth)
  if (k.status !== "UNUSED") {
    if (k.hwid && hwid && k.hwid !== hwid) {
      return NextResponse.json(
        { success: false, error: "Key already bound to another device (HWID mismatch)" },
        { status: 403 },
      );
    }
    if (!k.hwid && hwid) {
      await prisma.licenseKey.update({ where: { id: k.id }, data: { hwid, ip: k.ip } });
    }
  }

  // Generate 24h session token
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, launcher: true },
    JWT_SECRET,
    { expiresIn: "24h" },
  );

  // Record login
  await prisma.user.update({
    where: { id: user.id },
    data: { hwid: hwid || user.hwid, ip: user.ip, lastSeenAt: new Date() },
  });

  // Get latest client version info
  const clientVersion = await prisma.launcherVersion.findFirst({
    where: { forClient: true, isLatest: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    success: true,
    token,
    username: user.username,
    expiresAt: expiresAt.toISOString(),
    clientVersion: clientVersion?.version || null,
    clientUrl: clientVersion?.downloadUrl || null,
  });
}
