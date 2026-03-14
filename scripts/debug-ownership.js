const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // 1. Check specific property
    const prop = await prisma.property.findFirst({
        where: { name: 'testtfourth' }, // Based on previous research
        select: { id: true, displayId: true, ownerId: true, name: true, createdAt: true }
    });
    console.log('--- TARGET PROPERTY ---');
    console.log(JSON.stringify(prop, null, 2));

    if (prop) {
        // 2. Check the owner of this property
        const owner = await prisma.user.findUnique({
            where: { id: prop.ownerId },
            select: { id: true, email: true, name: true, parentOwnerId: true }
        });
        console.log('\n--- PROPERTY OWNER ---');
        console.log(JSON.stringify(owner, null, 2));
    }

    // 3. Check all properties for the Amit Kumar user (from logs)
    const amitKumarId = '64ee5379-5e30-43bf-9d6f-da9b4183c171'; // Identified in logs
    const amitProps = await prisma.property.findMany({
        where: { ownerId: amitKumarId },
        select: { id: true, name: true, displayId: true }
    });
    console.log(`\n--- PROPERTIES FOR ${amitKumarId} ---`);
    console.log(JSON.stringify(amitProps, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
