// DB Repair Script — Fix corrupted `role` columns caused by the switchRole() bug
// Run once: npx ts-node scripts/repair-corrupted-roles.ts
// This script finds all users where `role` was corrupted (set to USER when they should be ADMIN/OWNER)
// and restores it from their `primaryRole` or `roles[]` array.

import prisma from '../src/lib/prisma';

async function repairCorruptedRoles() {
    console.log('🔧 Starting DB role repair...');

    // --- FIX 1: Users who have ADMIN in their roles[] but role='USER' ---
    const corruptedAdmins = await prisma.user.findMany({
        where: {
            role: 'USER',
            roles: { has: 'ADMIN' }
        },
        select: { id: true, email: true, name: true, role: true, roles: true, primaryRole: true }
    });

    for (const user of corruptedAdmins) {
        console.log(`🛠️  Repairing Admin: ${user.email} (role was '${user.role}', restoring to 'ADMIN')`);
        await prisma.user.update({
            where: { id: user.id },
            data: { role: 'ADMIN', primaryRole: 'ADMIN' }
        });
    }

    // --- FIX 2: Users who have OWNER in their roles[] but role='USER' and NO USER in roles ---
    const corruptedOwners = await prisma.user.findMany({
        where: {
            role: 'USER',
            roles: { has: 'OWNER' },
            // We DON'T fix dual-role users (USER+OWNER) who are legitimately in student mode
        },
        select: { id: true, email: true, name: true, role: true, roles: true, primaryRole: true }
    });

    for (const user of corruptedOwners) {
        const hasUserRole = user.roles.includes('USER');
        if (!hasUserRole) {
            // Pure owner whose role got corrupted to USER
            console.log(`🛠️  Repairing Owner: ${user.email} (role was '${user.role}', restoring to 'OWNER')`);
            await prisma.user.update({
                where: { id: user.id },
                data: { role: 'OWNER', primaryRole: 'OWNER' }
            });
        } else {
            // Dual role user in student mode — this is valid, but ensure primaryRole is set correctly
            if (!user.primaryRole) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { primaryRole: 'OWNER' } // Default dual-role to owner mode
                });
                console.log(`ℹ️  Set primaryRole for dual-role user: ${user.email}`);
            }
        }
    }

    // --- FIX 3: Users who have STAFF in roles[] but role='USER' ---
    const corruptedStaff = await prisma.user.findMany({
        where: {
            role: 'USER',
            roles: { has: 'STAFF' }
        },
        select: { id: true, email: true, role: true, roles: true }
    });

    for (const user of corruptedStaff) {
        console.log(`🛠️  Repairing Staff: ${user.email} (role was '${user.role}', restoring to 'STAFF')`);
        await prisma.user.update({
            where: { id: user.id },
            data: { role: 'STAFF', primaryRole: 'STAFF' }
        });
    }

    console.log(`\n✅ Role repair complete!`);
    console.log(`   Fixed Admins: ${corruptedAdmins.length}`);
    console.log(`   Fixed Owners: ${corruptedOwners.filter(u => !u.roles.includes('USER')).length}`);
    console.log(`   Fixed Staff: ${corruptedStaff.length}`);
    
    await prisma.$disconnect();
}

repairCorruptedRoles().catch(e => {
    console.error('❌ Repair failed:', e);
    prisma.$disconnect();
    process.exit(1);
});
