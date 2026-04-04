const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const properties = await prisma.property.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
            id: true,
            displayId: true,
            name: true,
            ownerId: true,
            createdAt: true
        }
    });
    console.log('--- RECENT PROPERTIES ---');
    console.log(JSON.stringify(properties, null, 2));

    const owners = await prisma.user.findMany({
        where: { role: 'OWNER' },
        take: 5,
        select: {
            id: true,
            email: true,
            name: true
        }
    });
    console.log('\n--- RECENT OWNERS ---');
    console.log(JSON.stringify(owners, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
