import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import prisma from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-must-32-chars!!";
const JWT_EXPIRES = "7d";

export type JWTPayload = {
  id: string;
  username: string;
  role: string;
};

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export function signToken(payload: JWTPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user) return null;
  if (user.isBanned && user.banExpiresAt && user.banExpiresAt > new Date()) {
    // still banned but we return user with flag
  }
  return user;
}

export async function getAuthUserFromRequest(req: { headers: Headers }) {
  let user = await getCurrentUser();
  if (!user) {
    const auth = req.headers.get("authorization") || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (bearer) {
      const payload = verifyToken(bearer);
      if (payload) user = await prisma.user.findUnique({ where: { id: payload.id } });
    }
  }
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}
export async function requireModerator() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) return null;
  return user;
}

export function parseDuration(str: string): { ms: number; expiresAt: Date } | null {
  // format: 10m / 2h / 30d
  const match = str.match(/^(\d+)(m|h|d)$/i);
  if (!match) return null;
  const val = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  let ms = 0;
  if (unit === "m") ms = val * 60 * 1000;
  else if (unit === "h") ms = val * 60 * 60 * 1000;
  else if (unit === "d") ms = val * 24 * 60 * 60 * 1000;
  return { ms, expiresAt: new Date(Date.now() + ms) };
}

export function generateKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let rnd = "";
  for (let i = 0; i < 12; i++) rnd += chars[Math.floor(Math.random() * chars.length)];
  return `Lobok-${rnd}-client`;
}
