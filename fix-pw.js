const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  await p.user.update({ where: { username: 'LayF' }, data: { is2FAEnabled: false, twoFACode: null, twoFACodeExpires: null } });
  console.log('2FA disabled for LayF');
  await p.$disconnect();
})();
