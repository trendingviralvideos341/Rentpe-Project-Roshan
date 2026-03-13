const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyAuth() {
    try {
        const seededUsers = [
            "admin@rentpe.in",
            "owner@rentpe.in",
            "rahul@example.com"
        ];

        console.log("Checking for seeded users...");
        
        for (const email of seededUsers) {
            const user = await prisma.user.findUnique({
                where: { email },
                select: { id: true, email: true, role: true }
            });
            if (user) {
                console.log(`✅ Found: ${email} (${user.role})`);
            } else {
                console.log(`❌ Missing: ${email}`);
            }
        }

        const count = await prisma.user.count();
        console.log(`\nTotal users in DB: ${count}`);

    } catch (e) {
        console.error("Verification error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

verifyAuth();
