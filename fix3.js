const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  await p.launcherVersion.updateMany({
    where: { forClient: false, isLatest: true },
    data: { downloadUrl: 'https://github.com/ninepover-blip/Lobok-Client-/releases/download/v1.0.0/Lobok-Launcher.exe' },
  });
  await p.launcherVersion.updateMany({
    where: { forClient: true, isLatest: true },
    data: { downloadUrl: 'https://github.com/ninepover-blip/Lobok-Client-/releases/download/v1.0.0/Lobok-Client.jar' },
  });
  console.log('Fixed URLs');
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
