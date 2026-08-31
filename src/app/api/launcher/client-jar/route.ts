import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const client = await prisma.release.findFirst({
    where: { type: "mod", isLatest: true, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (!client) {
    return NextResponse.json({ error: "Client JAR not uploaded yet" }, { status: 404 });
  }

  if (client.filePath && client.filePath.startsWith("http")) {
    return NextResponse.redirect(client.filePath);
  }

  return NextResponse.json({
    version: client.version,
    downloadUrl: client.filePath || null,
    changelog: "",
  });
}
