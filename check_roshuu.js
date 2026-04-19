const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Check the ID from the owner URL
  const byUrl = await p.property.findUnique({
    where: { id: '0edd9e2e-58e7-4b78-89f0-1a4ea8466d19' },
    select: { id: true, name: true, status: true, displayId: true }
  });
  console.log('By URL id:', JSON.stringify(byUrl));

  // Check RP-REG-0008
  const byDisplayId = await p.property.findFirst({
    where: { displayId: 'RP-REG-0008' },
    select: { id: true, name: true, status: true, displayId: true }
  });
  console.log('RP-REG-0008:', JSON.stringify(byDisplayId));

  // Count all properties and their statuses
  const all = await p.property.findMany({
    select: { id: true, name: true, status: true, displayId: true },
    orderBy: { createdAt: 'desc' }
  });
  console.log('\nAll properties:');
  all.forEach(p => console.log(`  ${p.displayId} | ${p.name.trim()} | ${p.status} | ${p.id}`));

  p.$disconnect();
}
main();
