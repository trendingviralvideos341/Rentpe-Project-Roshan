import prisma from './src/lib/prisma';

async function main() {
    const properties = await prisma.property.findMany({
        select: { id: true, name: true, status: true }
    });
    console.log(JSON.stringify(properties, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
