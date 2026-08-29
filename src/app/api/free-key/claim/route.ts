import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, generateKey } from "@/lib/auth";

// 1 free key per day globally, после подписки на Discord и верификации Telegram 2FA
export async function POST(req: NextRequest){
  const me = await getCurrentUser();
  if(!me) return NextResponse.json({error:"Войдите в аккаунт"},{status:401});
  const { discordConfirmed, twoFACode } = await req.json().catch(()=>({discordConfirmed:false,twoFACode:""}));
  if(!discordConfirmed) return NextResponse.json({error:"Подпишитесь на Discord https://discord.gg/ASXzHaQfvj и подтвердите"},{status:400});

  const user = await prisma.user.findUnique({ where:{ id: me.id } });
  if(!user) return NextResponse.json({error:"Пользователь не найден"},{status:404});
  if(!user.telegramId || !user.is2FAEnabled){
    return NextResponse.json({error:"Для получения фри-ключа необходимо привязать Telegram и включить 2FA в настройках аккаунта"},{status:403});
  }
  if(!twoFACode){
    return NextResponse.json({error:"Введите код 2FA из Telegram"},{status:400});
  }
  if(user.twoFACode !== twoFACode || !user.twoFACodeExpires || user.twoFACodeExpires < new Date()){
    return NextResponse.json({error:"Неверный или просроченный код 2FA"},{status:400});
  }
  await prisma.user.update({ where:{ id: me.id }, data:{ twoFACode: null, twoFACodeExpires: null } });

  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const alreadyToday = await prisma.freeKeyClaim.findFirst({ where:{ claimedAt:{ gte: todayStart }}});
  if(alreadyToday) return NextResponse.json({error:"Сегодня фри-ключ уже забрали. Приходи завтра в 00:00 МСК!"},{status:429});

  const userClaimedToday = await prisma.freeKeyClaim.findFirst({ where:{ userId: me.id, claimedAt:{ gte: todayStart }}});
  if(userClaimedToday) return NextResponse.json({error:"Ты уже забирал фри-ключ сегодня. Возвращайся завтра!"},{status:429});

  const oneDayAgo = new Date(Date.now()-24*3600*1000);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
  const ipClaimed = await prisma.freeKeyClaim.findFirst({ where:{ ip, claimedAt:{ gte: oneDayAgo }}});
  if(ipClaimed) return NextResponse.json({error:"С этого IP уже забирали ключ за 24ч"},{status:429});

  const keyStr = generateKey();
  const expiresAt = new Date(Date.now()+24*3600*1000); // фри-ключ на 1 день
  const k = await prisma.licenseKey.create({
    data:{
      key: keyStr, type:"D1", status:"ACTIVE", durationDays:1, priceRub:0, priceUah:0,
      ownerId: me.id, ownerUsername: me.username, activatedAt: new Date(), expiresAt,
      hwid:null, ip
    }
  });
  const claim = await prisma.freeKeyClaim.create({ data:{ userId: me.id, keyId: k.id, ip }});
  return NextResponse.json({ ok:true, key: k.key, expiresAt, claim });
}

export async function GET(){
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayClaim = await prisma.freeKeyClaim.findFirst({ where:{ claimedAt:{ gte: todayStart }}, include:{ user:{ select:{ username:true }}}});
  const taken = !!todayClaim;
  return NextResponse.json({ taken, by: todayClaim?.user.username||null, nextAt: new Date(todayStart.getTime()+24*3600*1000) });
}
