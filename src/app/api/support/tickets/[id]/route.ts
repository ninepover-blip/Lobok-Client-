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
  if(!me || (me.role!=="ADMIN" && me.role!=="MODERATOR")) return NextResponse.json({error:"Forbidden"},{status:403});
  const { status, assigneeId } = await req.json();
  const updated = await prisma.supportTicket.update({ where:{ id }, data:{ status: status||undefined, assigneeId: assigneeId||undefined }});
  return NextResponse.json({ ok:true, ticket: updated });
}
