import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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
  return NextResponse.json({ ok:true, ticket:t });
}
