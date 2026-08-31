import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-must-32-chars!!";

/** Shared key validation + session issuance for the launcher. */
async function validateKeyAndIssueToken(
  key: string,
  username: string,
  hwid?: string,
  ip?: string,
  version?: string,
) {
  const k = await prisma.licenseKey.findUnique({ where: { key } });
  if (!k) return NextResponse.json({ success: false, error: "Invalid key" }, { status: 404 });
  if (k.status === "REVOKED") return NextResponse.json({ success: false, error: "Key revoked" }, { status: 403 });
  if (k.status === "EXPIRED") return NextResponse.json({ success: false, error: "Key expired" }, { status: 403 });
  if (k.expiresAt && k.expiresAt < new Date()) {
    await prisma.licenseKey.update({ where: { id: k.id }, data: { status: "EXPIRED" } });
    return NextResponse.json({ success: false, error: "Key expired" }, { status: 403 });
  }

  const expectedUser = k.ownerUsername || null;
  if (expectedUser && expectedUser !== username) {
    return NextResponse.json({ success: false, error: "Key bound to another user" }, { status: 403 });
  }

  // Activate UNUSED key
  if (k.status === "UNUSED") {
    const u = await prisma.user.findUnique({ where: { username } });
    await prisma.licenseKey.update({
      where: { id: k.id },
      data: {
        ownerId: u?.id || null,
        ownerUsername: username,
        hwid: hwid || null,
        ip: ip || null,
        status: "ACTIVE",
        activatedAt: new Date(),
      },
    });
  } else {
    // HWID check: 1 key = 1 device
    if (k.hwid && hwid && k.hwid !== hwid) {
      return NextResponse.json(
        { success: false, error: "Key already bound to another device (HWID mismatch)" },
        { status: 403 },
      );
    }
    // Bind HWID if not yet bound
    if (!k.hwid && hwid) {
      await prisma.licenseKey.update({ where: { id: k.id }, data: { hwid, ip: ip || k.ip } });
    }
  }

  // Find user for JWT payload
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  // Check ban
  if (user.isBanned && user.banExpiresAt && user.banExpiresAt > new Date()) {
    return NextResponse.json(
      { success: false, error: `Banned until ${user.banExpiresAt.toLocaleString("ru-RU")}` },
      { status: 403 },
    );
  }

  // Generate 24h session token
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, launcher: true },
    JWT_SECRET,
    { expiresIn: "24h" },
  );

  // Record the login
  await prisma.user.update({
    where: { id: user.id },
    data: { hwid: hwid || user.hwid, ip: ip || user.ip, lastSeenAt: new Date() },
  });

  // Get latest client version info
  const clientVersion = await prisma.release.findFirst({
    where: { type: "mod", isLatest: true, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    success: true,
    token,
    username: user.username,
    expiresAt: expiresAt.toISOString(),
    clientVersion: clientVersion?.version || null,
    clientUrl: clientVersion?.filePath || null,
  });
}

/**
 * POST /api/launcher/auth
 * Body: { key, username, hwid, ip, version }
 */
export async function POST(req: NextRequest) {
  const { key, username, hwid, ip, version } = await req.json();
  if (!key || !username) {
    return NextResponse.json({ success: false, error: "key & username required" }, { status: 400 });
  }
  return validateKeyAndIssueToken(key, username, hwid, ip, version);
}
