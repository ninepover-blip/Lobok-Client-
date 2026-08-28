import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
export async function POST(req: NextRequest){
  const me = await getCurrentUser();
  if(!me) return NextResponse.json({error:"Auth"},{status:401});
  const { telegramUsername, telegramId } = await req.json();
  // telegramId comes from bot deep link, or username
  const user = await prisma.user.update({ where:{id:me.id}, data:{ telegramId: telegramId||null, telegramUsername: telegramUsername||null }});
  return NextResponse.json({ ok:true, telegramId:user.telegramId });
}
