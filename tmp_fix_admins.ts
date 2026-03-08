
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Checking Admin profiles...");
    const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' }
    });

    for (const admin of admins) {
        console.log(`- ${admin.email}: role=${admin.role}, adminRole=${(admin as any).adminRole}`);
        if (!(admin as any).adminRole) {
            console.log(`  Fixing ${admin.email} -> OPERATIONS`);
            await prisma.user.update({
                where: { id: admin.id },
                data: { adminRole: 'OPERATIONS' } as any
            });
        }
    }
    console.log("Done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
