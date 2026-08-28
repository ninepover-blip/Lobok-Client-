import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

async function main(){
  const layfHash = await bcrypt.hash(process.env.ADMIN_LAYF_PASSWORD||"sashalordan",10);
  const vybeHash = await bcrypt.hash(process.env.ADMIN_VYBE_PASSWORD||"LobokClient",10);

  for(const [username,hash] of [["LayF",layfHash],["Vybe",vybeHash]] as const){
    const exists = await prisma.user.findUnique({ where:{ username }});
    if(!exists){
      await prisma.user.create({ data:{ username, passwordHash: hash, role:"ADMIN" }});
      console.log(`Created admin ${username}`);
    } else {
      await prisma.user.update({ where:{ username }, data:{ passwordHash: hash, role:"ADMIN" }});
      console.log(`Updated admin ${username} -> ADMIN`);
    }
  }
  // demo launcher versions
  const hasLauncher = await prisma.launcherVersion.findFirst({ where:{ forClient:false }});
  if(!hasLauncher){
    await prisma.launcherVersion.create({
      data:{
        version:"1.0.3",
        downloadUrl:"https://example.com/lobok-launcher.exe",
        changelog:"Initial launcher with auto-update",
        isLatest:true,
        forClient:false
      }
    });
    await prisma.launcherVersion.create({
      data:{
        version:"2.4.0",
        downloadUrl:"https://example.com/lobok-client.jar",
        changelog:"HvH MetaHvH fixes, Resolver improvements",
        isLatest:true,
        forClient:true
      }
    });
    console.log("Seeded launcher versions");
  }
  // example news
  const layf = await prisma.user.findUnique({ where:{ username:"LayF"}});
  if(layf){
    const n = await prisma.news.count();
    if(n===0){
      await prisma.news.create({
        data:{
          title:"Lobok Client 2.4 — HvH Update",
          content:"Обнова для MetaHvH: улучшен Resolver, фикс Velocity, новый TargetHUD. Скачай лаунчер и обновись автоматически.",
          mediaUrls:["/lobok.jpg"],
          authorId: layf.id
        }
      });
      console.log("Seeded news");
    }
  }
}
main().finally(()=>prisma.$disconnect());
