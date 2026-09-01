import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
export async function DELETE(_:NextRequest, { params }:{ params:Promise<{id:string}>}){
  const { id } = await params;
  const me = await getAuthUserFromRequest(_);
  if(!me || me.role!=="ADMIN") return NextResponse.json({error:"Forbidden"},{status:403});
  await prisma.news.delete({ where:{ id }});
  return NextResponse.json({ok:true});
}
