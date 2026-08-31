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
  // demo releases
  const hasLauncher = await prisma.release.findFirst({ where:{ type:"launcher" }});
  if(!hasLauncher){
    console.log("No demo releases seeded (no file data)");
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
