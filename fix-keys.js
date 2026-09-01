const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function main() {
  const deleted = await prisma.licenseKey.deleteMany({});
  console.log('Deleted', deleted.count, 'keys');

  const layf = await prisma.user.findUnique({ where: { username: 'LayF' } });
  if (!layf) { console.log('LayF not found'); return; }
  console.log('Found LayF:', layf.id);

  const keys = [];
  for (let i = 0; i < 3; i++) {
    const keyStr = 'Lobok-' + crypto.randomBytes(6).toString('hex').toUpperCase() + '-client';
    const k = await prisma.licenseKey.create({
      data: {
        key: keyStr,
        type: 'D30',
        status: 'ACTIVE',
        durationDays: 30,
        priceRub: 100,
        priceUah: 50,
        expiresAt: new Date(Date.now() + 30 * 86400000),
        ownerId: layf.id,
        ownerUsername: 'LayF',
        activatedAt: new Date(),
      }
    });
    keys.push(k.key);
  }
  console.log('Created keys for LayF:', keys);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
