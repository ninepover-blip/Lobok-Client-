import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const releases = await prisma.release.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, version: true, originalFilename: true, filePath: true, fileSize: true, mimeType: true, isLatest: true, isActive: true, createdAt: true },
  });
  return NextResponse.json({ releases });
}

export async function POST(req: NextRequest) {
  const me = await getAuthUserFromRequest(req);
  if (!me || me.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  let version = "";
  let type = "";
  let file: File | null = null;

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    version = (formData.get("version") as string) || "";
    type = (formData.get("type") as string) || "";
    file = formData.get("file") as File;
  } else if (contentType.includes("application/json")) {
    return NextResponse.json({ error: "Use multipart/form-data for file upload" }, { status: 400 });
  } else {
    return NextRequest.json({ error: "Unsupported content type" }, { status: 400 });
  }

  if (!version || !type || !file) {
    return NextResponse.json({ error: "version, type, and file are required" }, { status: 400 });
  }
  if (type !== "mod" && type !== "launcher") {
    return NextResponse.json({ error: "type must be 'mod' or 'launcher'" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (type === "mod" && ext !== "jar") {
    return NextResponse.json({ error: "Mod file must be .jar" }, { status: 400 });
  }
  if (type === "launcher" && ext !== "exe") {
    return NextResponse.json({ error: "Launcher file must be .exe" }, { status: 400 });
  }

  if (file.size > 200 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 200MB)" }, { status: 400 });
  }

  const existing = await prisma.release.findUnique({ where: { type_version: { type, version } } });
  if (existing) {
    return NextResponse.json({ error: `Version ${version} already exists for ${type}` }, { status: 409 });
  }

  // Read file bytes
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Mark previous latest as not latest
  await prisma.release.updateMany({ where: { type, isLatest: true }, data: { isLatest: false } });

  // Create release record with file data stored in DB
  const release = await prisma.release.create({
    data: {
      type,
      version,
      originalFilename: file.name,
      filePath: `/api/releases/${type}/latest/download`,
      fileData: buffer,
      fileSize: file.size,
      mimeType: file.type || (type === "mod" ? "application/java-archive" : "application/x-msdownload"),
      isLatest: true,
      isActive: true,
    },
  });

  return NextResponse.json({
    ok: true,
    release: {
      id: release.id,
      type: release.type,
      version: release.version,
      originalFilename: release.originalFilename,
      fileSize: release.fileSize,
      isLatest: release.isLatest,
      createdAt: release.createdAt,
    },
  });
}
