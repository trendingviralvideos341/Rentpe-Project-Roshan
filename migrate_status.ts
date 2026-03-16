import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateStatuses() {
  console.log('Starting property status migration...');
  
  const updates = [
    { old: 'SUBMITTED', new: 'PENDING_APPROVAL' },
    { old: 'LIVE', new: 'APPROVED' },
    { old: 'INACTIVE', new: 'SUSPENDED' },
    { old: 'PAYMENT_PENDING', new: 'APPROVED_PENDING_PAYMENT' },
    { old: 'VERIFYING', new: 'NEEDS_CORRECTION' },
    { old: 'PENDING_VERIFICATION', new: 'NEEDS_CORRECTION' }
  ];

  for (const { old, new: newStatus } of updates) {
    const result = await prisma.property.updateMany({
      where: { status: old },
      data: { status: newStatus }
    });
    console.log(`Updated ${result.count} properties from ${old} to ${newStatus}`);
  }

  console.log('Migration completed successfully.');
}

migrateStatuses()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
