import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword, signToken } from "@/lib/auth";

export async function POST(req: NextRequest){
  const { username, password, code } = await req.json();
  if(!username||!password) return NextResponse.json({error:"Введите логин и пароль"},{status:400});
  const user = await prisma.user.findUnique({ where:{ username }});
  if(!user) return NextResponse.json({error:"Неверный логин или пароль"},{status:401});
  // check ban
  if(user.isBanned && user.banExpiresAt && user.banExpiresAt > new Date()){
    return NextResponse.json({error:`Вы забанены до ${user.banExpiresAt.toLocaleString("ru-RU")}`},{status:403});
  }
  // also check punishment table IP_BAN / BAN active
  const ban = await prisma.punishment.findFirst({ where:{ type:"BAN", targetId:user.id, active:true, OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]}});
  if(ban) return NextResponse.json({error:`Бан до ${ban.expiresAt? ban.expiresAt.toLocaleString("ru-RU"):"перманентно"} Причина: ${ban.reason||"—"}`},{status:403});
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipBan = await prisma.punishment.findFirst({ where:{ type:"IP_BAN", targetIp: ip, active:true, OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]}});
  if(ipBan) return NextResponse.json({error:"IP забанен"},{status:403});

  const ok = await verifyPassword(password, user.passwordHash);
  if(!ok) return NextResponse.json({error:"Неверный логин или пароль"},{status:401});

  // 2FA via Telegram if enabled
  if(user.is2FAEnabled && user.telegramId){
    if(!code){
      return NextResponse.json({ need2FA:true, message:"Введите код из Telegram"},{status:200});
    }
    if(user.twoFACode !== code || !user.twoFACodeExpires || user.twoFACodeExpires < new Date()){
      return NextResponse.json({error:"Неверный или просроченный код 2FA"},{status:401});
    }
    // clear code
    await prisma.user.update({ where:{ id:user.id }, data:{ twoFACode:null, twoFACodeExpires:null }});
  }

  // seed admins if LayF/Vybe but ensure ADMIN role
  if((username==="LayF"||username==="Vybe") && user.role!=="ADMIN"){
    await prisma.user.update({ where:{id:user.id}, data:{ role:"ADMIN"}});
    user.role="ADMIN";
  }

  const token = signToken({ id:user.id, username:user.username, role:user.role });
  const res = NextResponse.json({ ok:true, user:{ id:user.id, username:user.username, role:user.role }});
  res.cookies.set("token", token, { httpOnly:true, sameSite:"lax", path:"/", maxAge:7*24*3600, secure: process.env.NODE_ENV==="production"});
  return res;
}
