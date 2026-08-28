import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest){
  const { ip, username } = await req.json();
  if(!ip) return NextResponse.json({error:"ip required"},{status:400});
  // upsert
  const cleaned = ip.trim().toLowerCase();
  const existing = await prisma.serverStat.findUnique({ where:{ ip: cleaned }});
  let uId=null;
  if(username){
    const u = await prisma.user.findUnique({ where:{ username }});
    if(u) uId=u.id;
  }
  if(existing){
    await prisma.serverStat.update({ where:{ ip:cleaned }, data:{ count:{ increment:1 }, lastSeenAt:new Date(), userId: uId||existing.userId }});
  } else {
    await prisma.serverStat.create({ data:{ ip: cleaned, count:1, userId:uId }});
  }
  return NextResponse.json({ ok:true });
}

export async function GET(req: NextRequest){
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit")||"20"),100);
  const servers = await prisma.serverStat.findMany({ orderBy:{ count:"desc"}, take:limit });
  return NextResponse.json({ servers });
}
