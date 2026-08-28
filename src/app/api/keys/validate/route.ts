import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST { key, username, hwid, ip } - for launcher/client validation
export async function POST(req: NextRequest){
  const { key, username, hwid, ip } = await req.json();
  if(!key || !username) return NextResponse.json({ valid:false, error:"key & username required"},{status:400});
  const k = await prisma.licenseKey.findUnique({ where:{ key }});
  if(!k) return NextResponse.json({ valid:false, error:"Invalid key"},{status:404});
  if(k.status==="REVOKED") return NextResponse.json({ valid:false, error:"Key revoked" });
  if(k.status==="EXPIRED") return NextResponse.json({ valid:false, error:"Key expired" });
  if(k.expiresAt && k.expiresAt < new Date()){
    await prisma.licenseKey.update({ where:{id:k.id}, data:{ status:"EXPIRED"}});
    return NextResponse.json({ valid:false, error:"Key expired" });
  }
  // check bind to @USER + ip + hwid (1 device)
  const expectedUser = k.ownerUsername || null;
  if(expectedUser && expectedUser !== username){
    return NextResponse.json({ valid:false, error:"Key bound to another user" });
  }
  // if key unused, bind it now
  if(k.status==="UNUSED"){
    // find user if exists
    const u = await prisma.user.findUnique({ where:{ username }});
    await prisma.licenseKey.update({ where:{id:k.id}, data:{
      ownerId: u?.id||null, ownerUsername: username, hwid: hwid||null, ip: ip||null, status:"ACTIVE", activatedAt:new Date()
    }});
    return NextResponse.json({ valid:true, message:"Activated", expiresAt: k.expiresAt });
  }
  // HWID check: 1 key 1 device
  if(k.hwid && hwid && k.hwid!==hwid){
    return NextResponse.json({ valid:false, error:"Key already bound to another device (HWID mismatch). Передача запрещена." });
  }
  // IP check - allow but if mismatch and hwid empty, bind
  if(!k.hwid && hwid){
    await prisma.licenseKey.update({ where:{id:k.id}, data:{ hwid, ip: ip||k.ip }});
  }
  // if transfer attempt detection: if hwid changes after bind -> revoke opportunity
  return NextResponse.json({ valid:true, expiresAt: k.expiresAt, type: k.type });
}
