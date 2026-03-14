const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const counts = await prisma.property.groupBy({
        by: ['name'],
        _count: {
            id: true
        },
        orderBy: {
            _count: {
                id: 'desc'
            }
        },
        take: 5
    });
    console.log(JSON.stringify(counts, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
