import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const client = await prisma.launcherVersion.findFirst({
    where: { forClient: true, isLatest: true },
    orderBy: { createdAt: "desc" },
  });

  if (!client) {
    return NextResponse.json(
      { error: "Client JAR not uploaded yet" },
      { status: 404 }
    );
  }

  if (client.downloadUrl && client.downloadUrl.startsWith("http")) {
    return NextResponse.redirect(client.downloadUrl);
  }

  return NextResponse.json({
    version: client.version,
    downloadUrl: client.downloadUrl || null,
    changelog: client.changelog || "",
  });
}
