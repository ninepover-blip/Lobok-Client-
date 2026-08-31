import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const me = await getAuthUserFromRequest(req);
  if (!me || me.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const { version, changelog, downloadUrl, forClient } = await req.json();
  if (!version || !downloadUrl) return NextResponse.json({ error: "version & downloadUrl required" }, { status: 400 });

  const type = forClient ? "mod" : "launcher";
  await prisma.release.updateMany({ where: { type, isLatest: true }, data: { isLatest: false } });
  const v = await prisma.release.create({
    data: {
      type,
      version,
      originalFilename: downloadUrl.split("/").pop() || "file",
      storedFilename: downloadUrl.split("/").pop() || "file",
      filePath: downloadUrl,
      fileSize: 0,
      isLatest: true,
      isActive: true,
    },
  });
  return NextResponse.json({ ok: true, version: v });
}

export async function GET() {
  const releases = await prisma.release.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ versions: releases.map(r => ({ ...r, downloadUrl: r.filePath, forClient: r.type === "mod" })) });
}
