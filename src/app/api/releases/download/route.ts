import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "launcher";

  const latest = await prisma.release.findFirst({
    where: { type, isLatest: true, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (!latest || !latest.fileData) {
    return NextResponse.json({ error: "No file available" }, { status: 404 });
  }

  return new NextResponse(latest.fileData, {
    status: 200,
    headers: {
      "Content-Type": latest.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${latest.originalFilename}"`,
      "Content-Length": String(latest.fileSize),
    },
  });
}
