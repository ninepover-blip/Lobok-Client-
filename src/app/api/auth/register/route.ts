import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) return NextResponse.json({ error: "Логин и пароль обязательны" }, { status: 400 });
    if (username.length < 3 || username.length > 20) return NextResponse.json({ error: "Логин 3-20 символов" }, { status: 400 });
    if (password.length < 4) return NextResponse.json({ error: "Пароль минимум 4 символа" }, { status: 400 });
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return NextResponse.json({ error: "Только латиница, цифры, _" }, { status: 400 });

    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) return NextResponse.json({ error: "Пользователь уже существует" }, { status: 409 });

    // check IP ban
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const ipBan = await prisma.punishment.findFirst({ where: { type: "IP_BAN", targetIp: ip, active: true, OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}] } });
    if (ipBan) return NextResponse.json({ error: "Ваш IP забанен" }, { status: 403 });

    // auto-assign admin if LayF/Vybe
    let role: "USER"|"ADMIN"|"MODERATOR" = "USER";
    if ((username==="LayF" && password===process.env.ADMIN_LAYF_PASSWORD) || (username==="Vybe" && password===process.env.ADMIN_VYBE_PASSWORD)) {
      role="ADMIN";
    }
    // also allow predefined admins even if password not exactly env but check hash after: first time we allow explicit passwords
    if (username==="LayF" || username==="Vybe") role="ADMIN";

    const hash = await hashPassword(password);
    // if predefined admin but password mismatch - still block? Check env passwords
    if (username==="LayF" && password!==process.env.ADMIN_LAYF_PASSWORD && process.env.ADMIN_LAYF_PASSWORD) {
      // allow registration but keep USER if password wrong? Actually enforce correct password for admins
      const adminExists = await prisma.user.findUnique({ where:{username:"LayF"}});
      if (!adminExists) return NextResponse.json({ error:"Неверный пароль для админа LayF"},{status:403});
    }
    if (username==="Vybe" && password!==process.env.ADMIN_VYBE_PASSWORD && process.env.ADMIN_VYBE_PASSWORD) {
      const adminExists = await prisma.user.findUnique({ where:{username:"Vybe"}});
      if (!adminExists) return NextResponse.json({ error:"Неверный пароль для Vybe"},{status:403});
    }

    const user = await prisma.user.create({
      data: { username, passwordHash: hash, role, ip },
    });

    const token = signToken({ id: user.id, username: user.username, role: user.role });
    const res = NextResponse.json({ ok:true, user: { id:user.id, username:user.username, role:user.role }});
    res.cookies.set("token", token, { httpOnly:true, sameSite:"lax", path:"/", maxAge:7*24*3600, secure: process.env.NODE_ENV==="production" });
    return res;
  } catch (e:any) {
    return NextResponse.json({ error: e.message||"Ошибка" }, { status:500 });
  }
}
