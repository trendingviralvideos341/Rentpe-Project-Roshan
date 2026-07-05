import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const result = await prisma.platformSettings.upsert({
        where: { id: 'singleton' },
        update: { feesEnabled: true, ownerOnboardingFeeFlat: 99 },
        create: { id: 'singleton', feesEnabled: true, ownerOnboardingFeeFlat: 99 },
    });
    console.log('✅ feesEnabled:', result.feesEnabled);
    console.log('✅ ownerOnboardingFeeFlat:', result.ownerOnboardingFeeFlat);
    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
