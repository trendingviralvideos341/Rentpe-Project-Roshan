import prisma from './src/lib/prisma';

async function main() {
    console.log("--- PROPERTIES ---");
    const properties = await prisma.property.findMany({
        select: { id: true, name: true, status: true, updatedAt: true }
    });
    console.log(JSON.stringify(properties, null, 2));

    console.log("\n--- RECENT AUDIT LOGS (PROPERTY) ---");
    const logs = await prisma.auditLog.findMany({
        where: { entityType: 'PROPERTY' },
        orderBy: { createdAt: 'desc' },
        take: 10
    });
    console.log(JSON.stringify(logs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
