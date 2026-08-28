import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
export async function POST(req: NextRequest){
  const me = await getCurrentUser();
  const { version } = await req.json().catch(()=>({}));
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  await prisma.downloadStat.create({ data:{ userId: me?.id||null, ip, version: version||null }});
  return NextResponse.json({ ok:true });
}
