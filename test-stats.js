
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testStats() {
    // Attempt to mimic a userId from the system
    try {
        const owners = await prisma.user.findMany({ where: { role: 'OWNER' }, take: 1 });
        if (owners.length === 0) {
            console.log("No owners found in DB.");
            return;
        }
        const userId = owners[0].id;
        console.log(`Testing stats for owner: ${owners[0].email} (${userId})`);

        const [propertyCount, tenantCount, paidRecords, recentActivity] = await Promise.all([
            prisma.property.count({ where: { ownerId: userId } }),
            prisma.tenant.count({
                where: {
                    property: { ownerId: userId },
                    status: 'ACTIVE'
                }
            }),
            prisma.rentRecord.findMany({
                where: {
                    paid: true,
                    tenant: {
                        property: { ownerId: userId }
                    }
                },
                select: { amount: true }
            }),
            prisma.auditLog.findMany({
                where: { performedBy: userId },
                orderBy: { timestamp: 'desc' },
                take: 5
            })
        ]);

        console.log("Property Count:", propertyCount);
        console.log("Tenant Count:", tenantCount);
        console.log("Paid Records Count:", paidRecords.length);
        console.log("Recent Activity Count:", recentActivity.length);

        const totalRevenue = paidRecords.reduce((sum, record) => {
            const value = parseFloat(record.amount.replace(/[^0-9.]/g, '')) || 0;
            return sum + value;
        }, 0);

        console.log("Total Revenue:", totalRevenue);
        console.log("SUCCESS: All queries passed.");
    } catch (e) {
        console.error("FAILURE: Database query error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

testStats();
