import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import prisma from "@/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";

export async function GET() {
  const releases = await prisma.release.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ releases });
}

export async function POST(req: NextRequest) {
  const me = await getAuthUserFromRequest(req);
  if (!me || me.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const formData = await req.formData();
  const version = formData.get("version") as string;
  const type = formData.get("type") as string; // "mod" or "launcher"
  const file = formData.get("file") as File;

  if (!version || !type || !file) {
    return NextResponse.json({ error: "version, type, and file are required" }, { status: 400 });
  }
  if (type !== "mod" && type !== "launcher") {
    return NextResponse.json({ error: "type must be 'mod' or 'launcher'" }, { status: 400 });
  }

  // Validate file extension
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (type === "mod" && ext !== "jar") {
    return NextResponse.json({ error: "Mod file must be .jar" }, { status: 400 });
  }
  if (type === "launcher" && ext !== "exe") {
    return NextResponse.json({ error: "Launcher file must be .exe" }, { status: 400 });
  }

  // Validate file size (max 200MB)
  if (file.size > 200 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 200MB)" }, { status: 400 });
  }

  // Check if version already exists for this type
  const existing = await prisma.release.findUnique({ where: { type_version: { type, version } } });
  if (existing) {
    return NextResponse.json({ error: `Version ${version} already exists for ${type}` }, { status: 409 });
  }

  // Store file in Vercel Blob
  const folder = type === "mod" ? "mods" : "launchers";
  const storedFilename = `${type}-${version.replace(/[^a-zA-Z0-9.-]/g, "_")}-${Date.now()}.${ext}`;
  const path = `${folder}/${version}/${storedFilename}`;

  let filePath: string;
  try {
    const blob = await put(path, file, {
      access: "public",
      contentType: file.type || (type === "mod" ? "application/java-archive" : "application/x-msdownload"),
    });
    filePath = blob.url;
  } catch (err: any) {
    return NextResponse.json({ error: `Upload failed: ${err.message}` }, { status: 500 });
  }

  // Mark previous latest as not latest
  await prisma.release.updateMany({ where: { type, isLatest: true }, data: { isLatest: false } });

  // Create release record
  const release = await prisma.release.create({
    data: {
      type,
      version,
      originalFilename: file.name,
      storedFilename,
      filePath,
      fileSize: file.size,
      mimeType: file.type || null,
      isLatest: true,
      isActive: true,
    },
  });

  return NextResponse.json({ ok: true, release });
}
