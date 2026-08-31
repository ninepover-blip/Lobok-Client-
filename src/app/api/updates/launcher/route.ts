import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const latest = await prisma.release.findFirst({
    where: { type: "launcher", isLatest: true, isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, version: true, originalFilename: true, fileSize: true, createdAt: true },
  });

  if (!latest) {
    return NextResponse.json({ error: "No launcher version available" }, { status: 404 });
  }

  return NextResponse.json({
    latest_version: latest.version,
    download_url: `/api/releases/download?type=launcher`,
    file_name: latest.originalFilename,
    file_size: latest.fileSize,
    published_at: latest.createdAt,
  });
}
