import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
export async function POST(req: NextRequest){
  const { username, code } = await req.json();
  const user = await prisma.user.findUnique({ where:{ username }});
  if(!user) return NextResponse.json({error:"User not found"},{status:404});
  if(user.twoFACode===code && user.twoFACodeExpires && user.twoFACodeExpires>new Date()){
    return NextResponse.json({ ok:true });
  }
  return NextResponse.json({ ok:false, error:"Invalid code"},{status:400});
}
