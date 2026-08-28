import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generate2FACode, sendTelegramMessage } from "@/lib/telegram";

export async function POST(req: NextRequest){
  const { username } = await req.json();
  if(!username) return NextResponse.json({error:"Username required"},{status:400});
  const user = await prisma.user.findUnique({ where:{ username }});
  if(!user || !user.telegramId) return NextResponse.json({error:"Telegram не привязан"},{status:400});
  const code = generate2FACode();
  await prisma.user.update({ where:{id:user.id}, data:{ twoFACode:code, twoFACodeExpires:new Date(Date.now()+5*60*1000)}});
  await sendTelegramMessage(user.telegramId, `🔐 Код 2FA для Lobok Client: <b>${code}</b>\nДействует 5 минут.`);
  return NextResponse.json({ ok:true, message:"Код отправлен в Telegram" });
}
