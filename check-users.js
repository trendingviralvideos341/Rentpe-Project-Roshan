const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, email: true, role: true, displayId: true },
            take: 20
        });
        console.log("Users in DB:");
        console.table(users);

        const adminOwner = users.find(u => u.email === 'admin_owner@test.com');
        if (adminOwner) {
            console.log("Found admin_owner@test.com:", adminOwner);
        } else {
            console.log("admin_owner@test.com NOT found.");
        }
    } catch (e) {
        console.error("Error querying users:", e);
    } finally {
        await prisma.$disconnect();
    }
}

checkUsers();
