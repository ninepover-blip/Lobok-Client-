const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany({ select: { username: true, role: true } }).then(users => {
  console.log(JSON.stringify(users));
  p.$disconnect();
});
