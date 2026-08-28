import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(_:NextRequest, { params }:{ params:Promise<{id:string}>}){
  const { id } = await params;
  const me = await getCurrentUser();
  if(!me || (me.role!=="ADMIN" && me.role!=="MODERATOR")) return NextResponse.json({error:"Forbidden"},{status:403});
  await prisma.chatMessage.update({ where:{ id }, data:{ isDeleted:true, deletedById: me.id }});
  return NextResponse.json({ ok:true });
}
