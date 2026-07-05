import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        where: { displayId: null }
    });
    
    console.log(`Found ${users.length} users without displayId`);
    
    for (const user of users) {
        const randomNum = Math.floor(Math.random() * 9000000000) + 1000000000;
        const displayId = `RP-U-${randomNum}`;
        await prisma.user.update({
            where: { id: user.id },
            data: { displayId }
        });
        console.log(`Updated user ${user.email} with displayId ${displayId}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
