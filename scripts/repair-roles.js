const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function repairRoles() {
    console.log('🔧 Checking for corrupted roles in DB...\n');

    // Find users with ADMIN in roles[] but role='USER'
    const corruptedAdmins = await prisma.user.findMany({
        where: { role: 'USER', roles: { has: 'ADMIN' } },
        select: { id: true, email: true, name: true, role: true, roles: true }
    });
    console.log(`Found ${corruptedAdmins.length} corrupted Admin(s):`, corruptedAdmins.map(u => u.email));

    for (const u of corruptedAdmins) {
        await prisma.user.update({ where: { id: u.id }, data: { role: 'ADMIN', primaryRole: 'ADMIN' } });
        console.log(`  ✅ Fixed Admin: ${u.email}`);
    }

    // Find users with OWNER in roles[] but role='USER' and no USER in roles (pure owners)
    const corruptedOwners = await prisma.user.findMany({
        where: { role: 'USER', roles: { has: 'OWNER' } },
        select: { id: true, email: true, name: true, role: true, roles: true }
    });
    console.log(`Found ${corruptedOwners.length} potential corrupted Owner(s):`, corruptedOwners.map(u => `${u.email} [${u.roles}]`));

    for (const u of corruptedOwners) {
        if (!u.roles.includes('USER')) {
            await prisma.user.update({ where: { id: u.id }, data: { role: 'OWNER', primaryRole: 'OWNER' } });
            console.log(`  ✅ Fixed pure Owner: ${u.email}`);
        } else {
            console.log(`  ℹ️  Skipped dual-role user (USER+OWNER): ${u.email} — this is valid`);
        }
    }

    // Find users with STAFF in roles[] but role='USER'
    const corruptedStaff = await prisma.user.findMany({
        where: { role: 'USER', roles: { has: 'STAFF' } },
        select: { id: true, email: true, role: true, roles: true }
    });
    console.log(`Found ${corruptedStaff.length} corrupted Staff:`, corruptedStaff.map(u => u.email));

    for (const u of corruptedStaff) {
        await prisma.user.update({ where: { id: u.id }, data: { role: 'STAFF', primaryRole: 'STAFF' } });
        console.log(`  ✅ Fixed Staff: ${u.email}`);
    }

    console.log('\n✅ Done! Repair complete.');
    await prisma.$disconnect();
}

repairRoles().catch(async e => {
    console.error('❌ Repair failed:', e);
    await prisma.$disconnect();
    process.exit(1);
});
