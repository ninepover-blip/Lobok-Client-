import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(){
  const launcher = await prisma.launcherVersion.findFirst({ where:{ forClient:false, isLatest:true }, orderBy:{ createdAt:"desc"}});
  const client = await prisma.launcherVersion.findFirst({ where:{ forClient:true, isLatest:true }, orderBy:{ createdAt:"desc"}});
  return NextResponse.json({
    launcher: launcher || { version:"1.0.0", downloadUrl:"/api/launcher/download", changelog:"Initial" },
    client: client || { version:"2.4.0", changelog:"HvH fixes" },
  });
}
