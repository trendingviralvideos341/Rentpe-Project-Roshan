/**
 * Run: node scripts/cleanup-sharing-notifs.js
 * Marks duplicate SHARING_TYPE_CHANGED notifications as read — keeps only the latest one per user.
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
    // Find all unread sharing type notifications grouped by userId
    const notifs = await p.notification.findMany({
        where: { category: 'SHARING_TYPE_CHANGED', isRead: false },
        orderBy: { createdAt: 'desc' }
    });
    
    console.log(`Found ${notifs.length} unread SHARING_TYPE_CHANGED notifications`);
    
    // Group by userId
    const byUser = {};
    for (const n of notifs) {
        if (!byUser[n.userId]) byUser[n.userId] = [];
        byUser[n.userId].push(n);
    }
    
    let marked = 0;
    for (const [userId, userNotifs] of Object.entries(byUser)) {
        if (userNotifs.length <= 1) continue; // Only one, keep it
        // Mark all but the latest as read
        const toMark = userNotifs.slice(1).map(n => n.id);
        await p.notification.updateMany({
            where: { id: { in: toMark } },
            data: { isRead: true }
        });
        console.log(`  Marked ${toMark.length} old duplicates as read for user ${userId.substring(0, 8)}`);
        marked += toMark.length;
    }
    console.log(`Done — marked ${marked} duplicate notifications as read`);
    await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
