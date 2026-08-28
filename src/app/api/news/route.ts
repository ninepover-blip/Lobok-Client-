import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(){
  const news = await prisma.news.findMany({ orderBy:{ createdAt:"desc" }, include:{ author:{ select:{ username:true, role:true, avatarUrl:true }}}});
  return NextResponse.json({ news });
}
export async function POST(req: NextRequest){
  const me = await getCurrentUser();
  if(!me || me.role!=="ADMIN") return NextResponse.json({error:"Только админы"},{status:403});
  const { title, content, mediaUrls, mediaType } = await req.json();
  if(!title||!content) return NextResponse.json({error:"Title/content"},{status:400});
  const n = await prisma.news.create({ data:{ title, content, mediaUrls: mediaUrls||[], mediaType: mediaType||null, authorId: me.id }});
  return NextResponse.json({ ok:true, news:n });
}
