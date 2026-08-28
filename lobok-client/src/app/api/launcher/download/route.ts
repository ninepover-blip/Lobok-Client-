import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest){
  const url = new URL(req.url);
  const forClient = url.searchParams.get("client")==="1";
  // log download
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
  await prisma.downloadStat.create({ data:{ ip, version: forClient? "client":"launcher" }}).catch(()=>{});
  // find latest version
  const ver = await prisma.launcherVersion.findFirst({ where:{ forClient, isLatest:true }, orderBy:{createdAt:"desc"}});
  const downloadUrl = ver?.downloadUrl || "https://example.com/lobok-launcher.exe";
  // if it's external url, redirect else return json
  if(downloadUrl.startsWith("http")){
    return NextResponse.redirect(downloadUrl);
  }
  return NextResponse.json({ downloadUrl, version: ver?.version||"1.0.0" });
}
