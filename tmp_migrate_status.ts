import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Data Migration: PENDING_APPROVAL -> PENDING_VERIFICATION');
  
  const properties = await prisma.property.updateMany({
    where: {
      status: 'PENDING_APPROVAL'
    },
    data: {
      status: 'PENDING_VERIFICATION'
    }
  });

  console.log(`✅ Migrated ${properties.count} properties to PENDING_VERIFICATION`);

  const underReview = await prisma.property.updateMany({
    where: {
      status: 'UNDER_REVIEW'
    },
    data: {
      status: 'VERIFYING_DOCUMENTS'
    }
  });

  console.log(`✅ Migrated ${underReview.count} properties to VERIFYING_DOCUMENTS`);
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
