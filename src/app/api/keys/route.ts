import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUserFromRequest, generateKey } from "@/lib/auth";

export async function GET(req: NextRequest){
  const me = await getAuthUserFromRequest(req);
  if(!me) return NextResponse.json({error:"Auth"},{status:401});
  const url = new URL(req.url);
  const mine = url.searchParams.get("mine")==="1";
  if(mine){
    const keys = await prisma.licenseKey.findMany({ where:{ ownerId: me.id }, orderBy:{ createdAt:"desc" }});
    return NextResponse.json({ keys });
  }
  if(me.role!=="ADMIN") return NextResponse.json({error:"Admin only"},{status:403});
  const keys = await prisma.licenseKey.findMany({ orderBy:{ createdAt:"desc" }, include:{ owner:{ select:{ username:true }}, createdBy:{ select:{ username:true }}}});
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest){
  const me = await getCurrentUser();
  if(!me || me.role!=="ADMIN") return NextResponse.json({error:"Admin only"},{status:403});
  const { type, username, duration, count } = await req.json();
  // type: D30/D90/FOREVER/FREE , username optional for bound generation
  const n = Math.min(parseInt(count)||1, 50);
  const results=[];
  for(let i=0;i<n;i++){
    const keyStr = generateKey();
    let expiresAt:Date|null=null;
    let durationDays:number|null=null;
    let priceRub:number|null=null, priceUah:number|null=null, keyType:any=type||"D30";
    if(keyType==="D30"){ durationDays=30; priceRub=100; priceUah=50; expiresAt=new Date(Date.now()+30*86400000); }
    else if(keyType==="D90"){ durationDays=90; priceRub=250; priceUah=125; expiresAt=new Date(Date.now()+90*86400000); }
    else if(keyType==="FOREVER"){ durationDays=null; priceRub=400; priceUah=200; expiresAt=null; }
    else if(keyType==="FREE"){ durationDays=7; priceRub=0; priceUah=0; expiresAt=new Date(Date.now()+7*86400000); }
    else if(duration){ // custom like 30d
      // parse
    }
    let ownerId=null, ownerUsername=null;
    if(username){
      const u = await prisma.user.findUnique({ where:{ username }});
      if(u){ ownerId=u.id; ownerUsername=u.username; }
      else { ownerUsername=username; }
    }
    const k = await prisma.licenseKey.create({
      data:{
        key: keyStr, type: keyType, status: ownerId?"ACTIVE":"UNUSED",
        durationDays, priceRub, priceUah, expiresAt,
        ownerId, ownerUsername,
        createdById: me.id,
        activatedAt: ownerId? new Date():null
      }
    });
    results.push(k);
  }
  return NextResponse.json({ ok:true, keys: results });
}
