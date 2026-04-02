const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAmit() {
    console.log('🛠️ Repairing Amit Kumar (owner@rentpe.in) identity...\n');
    
    const user = await prisma.user.findUnique({
        where: { email: 'owner@rentpe.in' }
    });

    if (!user) {
        console.log('❌ User not found.');
        return;
    }

    // Correcting the roles array and primary dashboard
    await prisma.user.update({
        where: { email: 'owner@rentpe.in' },
        data: {
            roles: ['USER', 'OWNER'], // Ensuring he has both roles properly
            primaryRole: 'OWNER',     // Setting his default dashboard to Owner
            role: 'OWNER'             // Double-confirming authoritative role
        }
    });

    console.log('✅ Success! Amit Kumar has been corrected.');
    console.log('   - Roles: ["USER", "OWNER"]');
    console.log('   - Default Dashboard: OWNER');
    
    await prisma.$disconnect();
}

fixAmit().catch(async e => {
    console.error('❌ Error fixing Amit Kumar:', e);
    await prisma.$disconnect();
});
