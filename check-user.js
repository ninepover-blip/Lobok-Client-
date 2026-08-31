const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findUnique({ where: { username: 'LayF' } }).then(u => {
  console.log('passwordHash length:', u?.passwordHash?.length);
  console.log('passwordHash prefix:', u?.passwordHash?.substring(0, 20));
  p.$disconnect();
}).catch(e => { console.error(e.message); p.$disconnect(); });
