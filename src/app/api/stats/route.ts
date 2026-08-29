import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(){
  const downloads = await prisma.downloadStat.count();
  const servers = await prisma.serverStat.count();
  const totalServerJoins = await prisma.serverStat.aggregate({ _sum:{ count:true }});
  const users = await prisma.user.count();
  const keys = await prisma.licenseKey.count({ where:{ status:"ACTIVE"}});
  // last 7 days downloads
  const weekAgo = new Date(Date.now()-7*86400000);
  const weekDownloads = await prisma.downloadStat.count({ where:{ createdAt:{ gte: weekAgo }}});

  const playAgg = await prisma.user.aggregate({ _sum:{ playtimeMinutes:true }});

  return NextResponse.json({
    downloads,
    servers,
    totalJoins: totalServerJoins._sum.count ?? 0,
    users,
    activeKeys: keys,
    weekDownloads,
    playHours: Math.round((playAgg._sum.playtimeMinutes ?? 0)/60),
  });
}
