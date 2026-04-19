const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
// Update all APPROVED properties to LIVE (Stanza Living + any others)
p.property.updateMany({
  where: { status: 'APPROVED' },
  data: { status: 'LIVE' }
}).then(r => {
  console.log('Updated APPROVED → LIVE count:', r.count);
  p.$disconnect();
}).catch(e => { console.error(e.message); p.$disconnect(); });
