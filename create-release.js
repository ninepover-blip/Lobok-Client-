const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Create mod release
  await prisma.release.updateMany({ where: { type: 'mod', isLatest: true }, data: { isLatest: false } });
  const modRelease = await prisma.release.create({
    data: {
      type: 'mod',
      version: '1.0.0',
      originalFilename: 'Lobok-1.0.0.jar',
      filePath: 'https://github.com/ninepover-blip/Lobok-Client-/releases/download/v1.0.0-client/Lobok-1.0.0.jar',
      fileSize: 128509155,
      mimeType: 'application/java-archive',
      isLatest: true,
      isActive: true,
    },
  });
  console.log('Mod release:', JSON.stringify(modRelease, null, 2));
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
