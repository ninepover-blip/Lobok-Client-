import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthUserFromRequest(req);
  if (!me || me.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await params;
  const release = await prisma.release.findUnique({ where: { id } });
  if (!release) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If this was the latest, promote the previous version
  if (release.isLatest) {
    const prev = await prisma.release.findFirst({
      where: { type: release.type, isActive: true, id: { not: id } },
      orderBy: { createdAt: "desc" },
    });
    if (prev) {
      await prisma.release.update({ where: { id: prev.id }, data: { isLatest: true } });
    }
  }

  await prisma.release.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
