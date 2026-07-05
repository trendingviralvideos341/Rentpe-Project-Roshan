const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const admins = await prisma.user.findMany({ 
        where: { role: 'ADMIN' }, 
        select: { id: true, email: true, name: true } 
    });
    console.log("Admins:", admins);
}

main().finally(() => prisma.$disconnect());
