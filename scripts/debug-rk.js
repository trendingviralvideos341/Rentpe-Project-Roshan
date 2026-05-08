
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOwner() {
    const prop = await prisma.property.findFirst({
        where: { name: { contains: 'Roshuu' } },
        include: { owner: true }
    });
    console.log('Property:', prop.name);
    console.log('Owner ID:', prop.ownerId, 'Name:', prop.owner.name);
}

checkOwner().catch(console.error).finally(() => prisma.$disconnect());
