const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const all = await p.launcherVersion.findMany({ orderBy: { createdAt: 'desc' } });
  for (const v of all) {
    console.log(v.id, v.version, v.forClient, v.isLatest, v.downloadUrl);
  }
  // Delete ALL old client entries and keep only one correct one
  const clients = all.filter(v => v.forClient);
  if (clients.length > 1) {
    const keep = clients[0]; // latest
    const ids = clients.slice(1).map(v => v.id);
    await p.launcherVersion.deleteMany({ where: { id: { in: ids } } });
    console.log('Deleted', ids.length, 'old client entries');
  }
  // Fix URL on the remaining one
  await p.launcherVersion.updateMany({
    where: { forClient: true },
    data: { downloadUrl: 'https://github.com/ninepover-blip/Lobok-Client-/releases/download/v1.0.0/Lobok-1.0.0.jar' },
  });
  console.log('Fixed all client URLs');
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
