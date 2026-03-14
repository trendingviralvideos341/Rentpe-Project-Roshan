const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const properties = await prisma.property.findMany({
        where: { name: 'testtfourth' },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            displayId: true,
            name: true,
            createdAt: true,
            ownerId: true
        }
    });
    console.log(JSON.stringify(properties, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
