import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const me = await getAuthUserFromRequest(req);
  if (!me || me.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const { type, version, filePath, fileSize, originalFilename } = await req.json();
  if (!type || !version || !filePath) return NextResponse.json({ error: "type, version, filePath required" }, { status: 400 });
  await prisma.release.updateMany({ where: { type, isLatest: true }, data: { isLatest: false } });
  const rel = await prisma.release.upsert({
    where: { type_version: { type, version } },
    create: { type, version, originalFilename: originalFilename || (type === "launcher" ? "LobokLauncher.exe" : "LobokClient-1.6.0.jar.enc"), filePath, fileSize: fileSize || 0, isLatest: true, isActive: true },
    update: { filePath, fileSize: fileSize || 0, originalFilename: originalFilename || undefined, isLatest: true, isActive: true },
  });
  return NextResponse.json({ ok: true, release: rel });
}
