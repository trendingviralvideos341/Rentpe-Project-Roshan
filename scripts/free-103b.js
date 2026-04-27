const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
    const ROOM_ID = '59e87221-d4e9-45bb-91db-7dd3c3995969';
    // 103-B is RESERVED for same booking as 103-C — free it since 103-C is now correct
    const bed = await p.bed.findFirst({ where: { bedNumber: '103-B', roomId: ROOM_ID } });
    console.log('103-B:', bed?.status, bed?.lockedByBookingId);
    if (bed && (bed.status === 'RESERVED' || bed.status === 'LOCKED')) {
        await p.bed.update({ where: { id: bed.id }, data: { status: 'AVAILABLE', lockedByBookingId: null } });
        console.log('Freed 103-B');
    }
    // Final state of all beds in room 103
    const all = await p.bed.findMany({ where: { roomId: ROOM_ID }, select: { bedNumber: true, status: true, lockedByBookingId: true } });
    console.log('Final:');
    all.forEach(b => console.log(' ', b.bedNumber, b.status, b.lockedByBookingId ? b.lockedByBookingId.substring(0,8) : ''));
    await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
