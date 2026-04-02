const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAmit() {
    console.log('🔍 Searching for Amit Kumar...\n');
    const users = await prisma.user.findMany({
        where: { name: { contains: 'Amit Kumar', mode: 'insensitive' } },
        select: { id: true, email: true, name: true, role: true, roles: true, primaryRole: true }
    });

    if (users.length === 0) {
        console.log('❌ No user found with name "Amit Kumar"');
    } else {
        console.log(`✅ Found ${users.length} user(s):`);
        users.forEach(u => {
            console.log('-----------------------------------');
            console.log(`ID: ${u.id}`);
            console.log(`Name: ${u.name}`);
            console.log(`Email: ${u.email}`);
            console.log(`Authoritative Role (role column): ${u.role}`);
            console.log(`Allowed Roles (roles array): ${JSON.stringify(u.roles)}`);
            console.log(`Last Used/Primary Role: ${u.primaryRole}`);
            
            // Analyze the state
            if (u.role === 'OWNER' || (u.roles && u.roles.includes('OWNER'))) {
                console.log('Status: This user IS an Owner.');
            } else {
                console.log('Status: This user is NOT an Owner.');
            }
        });
    }
    await prisma.$disconnect();
}

checkAmit().catch(async e => {
    console.error('❌ Error checking Amit Kumar:', e);
    await prisma.$disconnect();
});
