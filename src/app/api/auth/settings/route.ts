import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, hashPassword, verifyPassword, signToken } from "@/lib/auth";

export async function PUT(req: NextRequest){
  const me = await getCurrentUser();
  if(!me) return NextResponse.json({error:"Не авторизован"},{status:401});
  const body = await req.json();
  const { newUsername, oldPassword, newPassword, avatarUrl, telegramId, is2FAEnabled } = body;

  let updated = me;
  // change username
  if(newUsername && newUsername!==me.username){
    if(!/^[a-zA-Z0-9_]{3,20}$/.test(newUsername)) return NextResponse.json({error:"Логин 3-20 латиница/цифры/_"},{status:400});
    const exists = await prisma.user.findUnique({ where:{ username:newUsername }});
    if(exists) return NextResponse.json({error:"Логин занят"},{status:409});
    updated = await prisma.user.update({ where:{id:me.id}, data:{ previousUsername:me.username, username:newUsername }});
  }
  // change password
  if(newPassword){
    if(!oldPassword) return NextResponse.json({error:"Введите старый пароль"},{status:400});
    const ok = await verifyPassword(oldPassword, me.passwordHash);
    if(!ok) return NextResponse.json({error:"Неверный старый пароль"},{status:401});
    if(newPassword.length<4) return NextResponse.json({error:"Новый пароль минимум 4"},{status:400});
    const hash = await hashPassword(newPassword);
    updated = await prisma.user.update({ where:{id:me.id}, data:{ passwordHash:hash }});
  }
  // avatar
  if(avatarUrl!==undefined){
    updated = await prisma.user.update({ where:{id:me.id}, data:{ avatarUrl: avatarUrl||null }});
  }
  // telegram
  if(telegramId!==undefined){
    updated = await prisma.user.update({ where:{id:me.id}, data:{ telegramId: telegramId||null }});
  }
  if(is2FAEnabled!==undefined){
    if(is2FAEnabled && !updated.telegramId) return NextResponse.json({error:"Сначала привяжите Telegram"},{status:400});
    updated = await prisma.user.update({ where:{id:me.id}, data:{ is2FAEnabled: !!is2FAEnabled }});
  }

  // reissue token if username changed
  if(newUsername && newUsername!==me.username){
    const token = signToken({ id:updated.id, username:updated.username, role:updated.role });
    const res = NextResponse.json({ ok:true, user:{ id:updated.id, username:updated.username, role:updated.role }});
    res.cookies.set("token", token, { httpOnly:true, sameSite:"lax", path:"/", maxAge:7*24*3600, secure: process.env.NODE_ENV==="production"});
    return res;
  }
  return NextResponse.json({ ok:true, user:{ id:updated.id, username:updated.username, role:updated.role, avatarUrl:updated.avatarUrl, telegramId:updated.telegramId, is2FAEnabled:updated.is2FAEnabled }});
}
