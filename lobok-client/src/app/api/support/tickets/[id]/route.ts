import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_:NextRequest, { params }:{ params:Promise<{id:string}>}){
  const { id } = await params;
  const me = await getCurrentUser();
  if(!me) return NextResponse.json({error:"Auth"},{status:401});
  const ticket = await prisma.supportTicket.findUnique({
    where:{ id },
    include:{
      author:{ select:{ username:true, role:true, avatarUrl:true }},
      messages:{ orderBy:{ createdAt:"asc"}, include:{ user:{ select:{ username:true, role:true, avatarUrl:true }}}}
    }
  });
  if(!ticket) return NextResponse.json({error:"Not found"},{status:404});
  if(me.role!=="ADMIN" && me.role!=="MODERATOR" && ticket.authorId!==me.id) return NextResponse.json({error:"Forbidden"},{status:403});
  return NextResponse.json({ ticket });
}
export async function POST(req: NextRequest, { params }:{ params:Promise<{id:string}>}){
  const { id } = await params;
  const me = await getCurrentUser();
  if(!me) return NextResponse.json({error:"Auth"},{status:401});
  const ticket = await prisma.supportTicket.findUnique({ where:{ id }});
  if(!ticket) return NextResponse.json({error:"Not found"},{status:404});
  if(me.role!=="ADMIN" && me.role!=="MODERATOR" && ticket.authorId!==me.id) return NextResponse.json({error:"Forbidden"},{status:403});
  const { content } = await req.json();
  if(!content?.trim()) return NextResponse.json({error:"Empty"},{status:400});
  const isPinned = me.role==="ADMIN"||me.role==="MODERATOR";
  const msg = await prisma.chatMessage.create({ data:{ channel:"SUPPORT", ticketId: id, userId: me.id, content: content.trim(), isPinned }});
  return NextResponse.json({ ok:true, message:msg });
}
export async function PATCH(req: NextRequest, { params }:{ params:Promise<{id:string}>}){
  const { id } = await params;
  const me = await getCurrentUser();
  if(!me) return NextResponse.json({error:"Не авторизован"},{status:401});

  const ticket = await prisma.supportTicket.findUnique({ where:{ id }});
  if(!ticket) return NextResponse.json({error:"Тикет не найден"},{status:404});

  const isStaff = me.role==="ADMIN" || me.role==="MODERATOR";
  const isAuthor = ticket.authorId === me.id;
  if(!isStaff && !isAuthor) return NextResponse.json({error:"Нет доступа"},{status:403});

  const { status, assigneeId } = await req.json();
  if(status && !["OPEN","PENDING","CLOSED"].includes(status)){
    return NextResponse.json({error:"Неизвестный статус"},{status:400});
  }
  // автор может только закрыть свой тикет; переоткрывать и назначать — саппорт
  if(!isStaff && status && status!=="CLOSED"){
    return NextResponse.json({error:"Переоткрыть тикет может только саппорт"},{status:403});
  }

  const updated = await prisma.supportTicket.update({
    where:{ id },
    data:{
      status: status||undefined,
      assigneeId: isStaff ? (assigneeId||undefined) : undefined,
    }
  });
  return NextResponse.json({ ok:true, ticket: updated });
}
