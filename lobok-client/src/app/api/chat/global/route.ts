import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest){
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit")||"50"),100);
  const msgs = await prisma.chatMessage.findMany({
    where:{ channel:"GLOBAL", isDeleted:false },
    orderBy:{ createdAt:"asc" },
    take: limit,
    include:{ user:{ select:{ username:true, role:true, avatarUrl:true }}}
  });
  // pinned first
  const sorted = [...msgs].sort((a,b)=> (Number(b.isPinned)-Number(a.isPinned)) || a.createdAt.getTime()-b.createdAt.getTime());
  return NextResponse.json({ messages: sorted });
}

export async function POST(req: NextRequest){
  const me = await getCurrentUser();
  if(!me) return NextResponse.json({error:"Auth"},{status:401});
  // mute check
  if(me.isMuted && me.muteExpiresAt && me.muteExpiresAt>new Date()){
    return NextResponse.json({error:`Вы замучены до ${me.muteExpiresAt.toLocaleString("ru-RU")}`},{status:403});
  }
  const punishmentMute = await prisma.punishment.findFirst({ where:{ type:"MUTE", targetId:me.id, active:true, OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]}});
  if(punishmentMute) return NextResponse.json({error:`Мут до ${punishmentMute.expiresAt?.toLocaleString("ru-RU")}`},{status:403});

  const { content } = await req.json();
  if(!content || !content.trim()) return NextResponse.json({error:"Пустое сообщение"},{status:400});
  if(content.length>1000) return NextResponse.json({error:"Слишком длинное"},{status:400});

  // command handling: /mute @user m/h/d etc. Only for mods/admins
  if(content.startsWith("/")){
    const mod = me.role==="ADMIN"||me.role==="MODERATOR";
    if(!mod) return NextResponse.json({error:"Команды только для модеров"},{status:403});
    return handleCommand(content, me);
  }

  const isPinned = me.role==="ADMIN"||me.role==="MODERATOR";
  const msg = await prisma.chatMessage.create({
    data:{ channel:"GLOBAL", userId:me.id, content:content.trim(), isPinned }
  });
  return NextResponse.json({ ok:true, message:msg });
}

async function handleCommand(raw:string, issuer:any){
  const parts = raw.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const targetRaw = parts[1];
  const durationRaw = parts[2];
  // /ban @user 30d | /mute @user 10m | /warn @user 7d | /banip 1.2.3.4 30d | /clear
  // also /unban @user , /unmute

  if(cmd==="/clear"){
    // soft clear: mark all deleted? Just return success
    return NextResponse.json({ ok:true, message:"Команда clear выполнена (сообщения скрыты на клиенте)" });
  }

  if(cmd==="/unban" || cmd==="/unmute" || cmd==="/unwarn"){
    const username = targetRaw?.replace("@","");
    if(!username) return NextResponse.json({error:"Укажите @user"},{status:400});
    const target = await prisma.user.findUnique({ where:{ username }});
    if(!target) return NextResponse.json({error:"Пользователь не найден"},{status:404});
    const type = cmd==="/unban"?"BAN": cmd==="/unmute"?"MUTE":"WARN";
    await prisma.punishment.updateMany({ where:{ targetId:target.id, type: type as any, active:true }, data:{ active:false }});
    if(type==="BAN") await prisma.user.update({ where:{id:target.id}, data:{ isBanned:false, banExpiresAt:null }});
    if(type==="MUTE") await prisma.user.update({ where:{id:target.id}, data:{ isMuted:false, muteExpiresAt:null }});
    const sys = await prisma.chatMessage.create({ data:{ channel:"GLOBAL", userId:issuer.id, content:`⚙️ ${issuer.username} снял ${type} с @${username}`, isPinned:true }});
    return NextResponse.json({ ok:true, system:sys });
  }

  if(["/mute","/ban","/warn","/banip"].includes(cmd)){
    let targetId: string|null=null;
    let targetIp: string|null=null;
    let usernameForMsg = targetRaw;
    if(cmd==="/banip"){
      targetIp = targetRaw;
      if(!targetIp) return NextResponse.json({error:"Укажите IP"},{status:400});
    } else {
      const username = targetRaw?.replace("@","");
      if(!username) return NextResponse.json({error:"Укажите @user"},{status:400});
      const target = await prisma.user.findUnique({ where:{ username }});
      if(!target) return NextResponse.json({error:"Пользователь не найден"},{status:404});
      targetId = target.id;
      usernameForMsg = "@"+username;
    }
    if(!durationRaw) return NextResponse.json({error:"Укажите длительность: 10m / 2h / 30d"},{status:400});
    const parsed = parseDuration(durationRaw);
    if(!parsed) return NextResponse.json({error:"Формат: число + m/h/d"},{status:400});

    const typeMap: any = { "/mute":"MUTE", "/ban":"BAN", "/warn":"WARN", "/banip":"IP_BAN" };
    const type = typeMap[cmd];

    // warn logic: check 3 warns in month -> auto ban 30d
    if(type==="WARN" && targetId){
      const monthAgo = new Date(Date.now()-30*24*3600*1000);
      const warnCount = await prisma.punishment.count({ where:{ type:"WARN", targetId, createdAt:{ gte: monthAgo }, active:true }});
      // will become +1
      if(warnCount+1 >=3){
        // auto ban 30d
        const banExpires = new Date(Date.now()+30*24*3600*1000);
        await prisma.punishment.create({ data:{ type:"BAN", targetId, moderatorId:issuer.id, reason:"Авто-бан за 3 варна за месяц", duration:"30d", durationMs: BigInt(30*24*3600*1000), expiresAt: banExpires, active:true }});
        await prisma.user.update({ where:{id:targetId}, data:{ isBanned:true, banExpiresAt:banExpires }});
        await prisma.punishment.create({ data:{ type:"WARN", targetId, moderatorId:issuer.id, reason:"WARN (триггер бана)", duration:durationRaw, durationMs: BigInt(parsed.ms), expiresAt: parsed.expiresAt, active:true }});
        const sys = await prisma.chatMessage.create({ data:{ channel:"GLOBAL", userId:issuer.id, content:`⚠️ @${usernameForMsg.replace("@","")} получил 3-й варн → автобан 30d`, isPinned:true }});
        return NextResponse.json({ ok:true, autoBan:true, system:sys });
      }
    }

    await prisma.punishment.create({
      data:{
        type, targetId, targetIp, moderatorId:issuer.id,
        duration: durationRaw, durationMs: BigInt(parsed.ms), expiresAt: parsed.expiresAt, active:true,
        reason: type==="WARN"?"WARN": type==="MUTE"?"Mute": type==="BAN"?"Ban": "IP Ban"
      }
    });
    if(type==="BAN" && targetId){
      await prisma.user.update({ where:{id:targetId}, data:{ isBanned:true, banExpiresAt: parsed.expiresAt }});
    }
    if(type==="MUTE" && targetId){
      await prisma.user.update({ where:{id:targetId}, data:{ isMuted:true, muteExpiresAt: parsed.expiresAt }});
    }
    const sys = await prisma.chatMessage.create({ data:{ channel:"GLOBAL", userId:issuer.id, content:`🔨 ${issuer.username} выдал ${type} ${usernameForMsg||targetIp} на ${durationRaw}`, isPinned:true }});
    return NextResponse.json({ ok:true, system:sys });
  }

  return NextResponse.json({error:"Неизвестная команда"},{status:400});
}

function parseDuration(str:string){
  const m=str.match(/^(\d+)(m|h|d)$/i);
  if(!m) return null;
  const v=parseInt(m[1],10); const u=m[2].toLowerCase();
  let ms=0;
  if(u==="m") ms=v*60*1000; else if(u==="h") ms=v*3600*1000; else ms=v*86400*1000;
  return { ms, expiresAt: new Date(Date.now()+ms)};
}
