const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const stats = await prisma.property.groupBy({
        by: ['status'],
        _count: { id: true }
    });
    console.log("PROPERTY STATS:");
    console.log(JSON.stringify(stats, null, 2));

    const verifyDocs = await prisma.property.findMany({
        where: { status: 'VERIFYING_DOCUMENTS' },
        select: { name: true, id: true }
    });
    console.log("\nPROPERTIES IN VERIFYING_DOCUMENTS:");
    console.log(JSON.stringify(verifyDocs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
