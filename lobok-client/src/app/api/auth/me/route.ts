import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
export async function GET(){
  const u = await getCurrentUser();
  if(!u) return NextResponse.json({ user:null });
  return NextResponse.json({ user:{ id:u.id, username:u.username, role:u.role, avatarUrl:u.avatarUrl, telegramId:u.telegramId, is2FAEnabled:u.is2FAEnabled }});
}
