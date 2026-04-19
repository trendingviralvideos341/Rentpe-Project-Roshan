const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.property.update({
  where: { id: '6ce22a03-eac0-41e4-9c29-94513aea771f' },
  data: { status: 'LIVE' }
}).then(r => {
  console.log('Updated:', r.name, '->', r.status);
  p.$disconnect();
}).catch(e => {
  console.error(e.message);
  p.$disconnect();
});
