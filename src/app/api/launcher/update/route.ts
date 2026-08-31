import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest){
  const me = await getAuthUserFromRequest(req);
  if(!me || me.role!=="ADMIN") return NextResponse.json({error:"Admin only"},{status:403});
  const { version, changelog, downloadUrl, forClient } = await req.json();
  if(!version||!downloadUrl) return NextResponse.json({error:"version & downloadUrl required"},{status:400});
  await prisma.launcherVersion.updateMany({ where:{ forClient: !!forClient, isLatest:true }, data:{ isLatest:false }});
  const v = await prisma.launcherVersion.create({ data:{ version, changelog, downloadUrl, forClient: !!forClient, isLatest:true }});
  return NextResponse.json({ ok:true, version:v });
}
export async function GET(){
  const versions = await prisma.launcherVersion.findMany({ orderBy:{ createdAt:"desc" }});
  return NextResponse.json({ versions });
}
