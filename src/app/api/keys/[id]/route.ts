import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, generateKey } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }:{ params:Promise<{id:string}>}){
  const { id } = await params;
  const me = await getCurrentUser();
  if(!me || me.role!=="ADMIN") return NextResponse.json({error:"Admin only"},{status:403});
  const body = await req.json();
  const { action, username, hwid, ip, status } = body;
  const key = await prisma.licenseKey.findUnique({ where:{ id }});
  if(!key) return NextResponse.json({error:"Not found"},{status:404});

  if(action==="revoke"){
    const updated = await prisma.licenseKey.update({ where:{id}, data:{ status:"REVOKED", revokedAt:new Date(), revokedReason: body.reason||"Revoked by admin", hwid:null, ip:null }});
    return NextResponse.json({ ok:true, key:updated });
  }
  if(action==="unrevoke"){
    const updated = await prisma.licenseKey.update({ where:{id}, data:{ status:"ACTIVE", revokedAt:null, revokedReason:null }});
    return NextResponse.json({ ok:true, key:updated });
  }
  if(action==="delete"){
    await prisma.licenseKey.delete({ where:{id }});
    return NextResponse.json({ ok:true });
  }
  if(action==="regenerate"){
    const newKey = generateKey();
    const updated = await prisma.licenseKey.update({ where:{id}, data:{ key:newKey, hwid:null, ip:null }});
    return NextResponse.json({ ok:true, key:updated });
  }
  if(action==="bind"){
    // bind to username + ip/hwid
    let ownerId = key.ownerId;
    let ownerUsername = key.ownerUsername;
    if(username){
      const u = await prisma.user.findUnique({ where:{ username }});
      if(u){ ownerId=u.id; ownerUsername=u.username; } else ownerUsername=username;
    }
    const updated = await prisma.licenseKey.update({ where:{id}, data:{ ownerId, ownerUsername, hwid: hwid||key.hwid, ip: ip||key.ip, status:"ACTIVE", activatedAt: new Date() }});
    return NextResponse.json({ ok:true, key:updated });
  }
  if(action==="unbind"){
    const updated = await prisma.licenseKey.update({ where:{id}, data:{ hwid:null, ip:null }});
    return NextResponse.json({ ok:true, key:updated });
  }
  // generic edit
  const updated = await prisma.licenseKey.update({ where:{id}, data:{
    ownerUsername: username!==undefined? username: undefined,
    hwid: hwid!==undefined? hwid: undefined,
    ip: ip!==undefined? ip: undefined,
    status: status||undefined,
  }});
  return NextResponse.json({ ok:true, key:updated });
}

export async function DELETE(_:NextRequest, { params }:{ params:Promise<{id:string}>}){
  const { id } = await params;
  const me = await getCurrentUser();
  if(!me || me.role!=="ADMIN") return NextResponse.json({error:"Admin only"},{status:403});
  await prisma.licenseKey.delete({ where:{ id }});
  return NextResponse.json({ ok:true });
}
