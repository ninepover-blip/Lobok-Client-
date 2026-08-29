import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  const adminIds = admins.map(a => a.id);
  console.log(`Admins to keep: ${adminIds.join(", ")}`);

  const nonAdmins = await prisma.user.findMany({ where: { id: { notIn: adminIds } }, select: { id: true, username: true } });
  console.log(`Non-admin users to delete: ${nonAdmins.length}`);
  for (const u of nonAdmins) console.log(`  - ${u.id} (${u.username})`);

  for (const u of nonAdmins) {
    await prisma.playSession.deleteMany({ where: { userId: u.id } });
    await prisma.chatMessage.deleteMany({ where: { userId: u.id } });
    await prisma.freeKeyClaim.deleteMany({ where: { userId: u.id } });
    await prisma.downloadStat.deleteMany({ where: { userId: u.id } });
    await prisma.payment.deleteMany({ where: { userId: u.id } });
    await prisma.licenseKey.deleteMany({ where: { ownerId: u.id } });
    await prisma.promoRedemption.deleteMany({ where: { userId: u.id } });
    await prisma.supportTicket.updateMany({ where: { authorId: u.id }, data: { authorId: adminIds[0] } });
    await prisma.punishment.deleteMany({ where: { targetId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }
  console.log("Done! Only admins remain.");
}
main().finally(() => prisma.$disconnect());
