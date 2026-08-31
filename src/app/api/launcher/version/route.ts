import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const launcher = await prisma.release.findFirst({ where: { type: "launcher", isLatest: true, isActive: true }, orderBy: { createdAt: "desc" } });
  const client = await prisma.release.findFirst({ where: { type: "mod", isLatest: true, isActive: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({
    launcher: launcher ? { version: launcher.version, downloadUrl: launcher.filePath, changelog: "" } : { version: "1.0.0", downloadUrl: "", changelog: "Initial" },
    client: client ? { version: client.version, downloadUrl: client.filePath, changelog: "" } : { version: "1.0.0", downloadUrl: "", changelog: "Initial" },
  });
}
