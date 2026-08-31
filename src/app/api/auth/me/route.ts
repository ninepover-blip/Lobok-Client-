import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const u = await getAuthUserFromRequest(req);
  if (!u) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { id: u.id, username: u.username, role: u.role, avatarUrl: u.avatarUrl, telegramId: u.telegramId, is2FAEnabled: u.is2FAEnabled } });
}
