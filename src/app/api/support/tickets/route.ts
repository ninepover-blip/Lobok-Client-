import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/telegram";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ADMIN_IDS = ["8618210982", "7290948132"];
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://lobok-client.vercel.app";

export async function GET(){
  const me = await getCurrentUser();
  if(!me) return NextResponse.json({error:"Auth"},{status:401});
  let tickets;
  if(me.role==="ADMIN"||me.role==="MODERATOR"){
    tickets = await prisma.supportTicket.findMany({
      orderBy:{ createdAt:"desc" },
      include:{
        author:{ select:{ username:true, role:true, avatarUrl:true }},
        messages:{ include:{ user:{ select:{ username:true, role:true }}}}
      }
    });
  } else {
    tickets = await prisma.supportTicket.findMany({
      where:{ authorId: me.id },
      orderBy:{ createdAt:"desc" },
      include:{
        author:{ select:{ username:true, role:true, avatarUrl:true }},
        messages:true
      }
    });
  }
  return NextResponse.json({ tickets });
}
export async function POST(req: NextRequest){
  const me = await getCurrentUser();
  if(!me) return NextResponse.json({error:"Auth"},{status:401});
  const { title, description } = await req.json();
  if(!title||!description) return NextResponse.json({error:"Title/desc"},{status:400});
  const t = await prisma.supportTicket.create({ data:{ title, description, authorId: me.id }});

  if (BOT_TOKEN) {
    const msg =
      `📝 *Новый тикет поддержки*\n\n` +
      `Пользователь: ${me.username}\n` +
      `Заголовок: ${title}\n` +
      `Описание: ${description.slice(0, 300)}\n\n` +
      `[Открыть тикет](${SITE}/support)`;
    for (const id of ADMIN_IDS) {
      try { await sendTelegramMessage(id, msg); } catch {}
    }
  }

  return NextResponse.json({ ok:true, ticket:t });
}
