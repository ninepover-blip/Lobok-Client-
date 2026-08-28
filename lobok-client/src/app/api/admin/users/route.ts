import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(){
  const me = await getCurrentUser();
  if(!me || me.role!=="ADMIN") return NextResponse.json({error:"Admin only"},{status:403});
  const users = await prisma.user.findMany({ orderBy:{ createdAt:"desc" }, select:{ id:true, username:true, role:true, avatarUrl:true, createdAt:true, isBanned:true, isMuted:true, telegramId:true, is2FAEnabled:true }});
  return NextResponse.json({ users });
}

export async function PUT(req: NextRequest){
  const me = await getCurrentUser();
  if(!me || me.role!=="ADMIN") return NextResponse.json({error:"Admin only"},{status:403});
  const { userId, role } = await req.json();
  if(!["USER","MODERATOR","ADMIN"].includes(role)) return NextResponse.json({error:"Invalid role"},{status:400});
  // prevent demoting last admin? skip
  const updated = await prisma.user.update({ where:{id:userId}, data:{ role }});
  return NextResponse.json({ ok:true, user: updated });
}
