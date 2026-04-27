const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
    const BOOKING_ID = '2dfbfa76-e4f4-4663-8220-158011908259';
    const ROOM_ID = '59e87221-d4e9-45bb-91db-7dd3c3995969';
    
    const beds = await p.bed.findMany({ where: { roomId: ROOM_ID }, select: { id: true, bedNumber: true, status: true, lockedByBookingId: true } });
    console.log('Room 103 beds:');
    beds.forEach(b => console.log(' ', b.bedNumber, b.status, b.lockedByBookingId || ''));
    
    const bk = await p.booking.findUnique({ where: { id: BOOKING_ID }, select: { roomAssigned: true, status: true, occupancy: true } });
    console.log('Booking:', bk);
    
    // The booking says roomAssigned = "103 — Bed 103-C"
    // But after user tried Change Type to 103-A, the beds got swapped incorrectly
    // Fix: match bed locks to what the booking says (103-C)
    const bed103C = beds.find(b => b.bedNumber === '103-C');
    const bed103A = beds.find(b => b.bedNumber === '103-A');
    
    if (bed103A && (bed103A.status === 'LOCKED' || bed103A.status === 'RESERVED') && bed103A.lockedByBookingId === BOOKING_ID) {
        await p.bed.update({ where: { id: bed103A.id }, data: { status: 'AVAILABLE', lockedByBookingId: null, lockedAt: null } });
        console.log('Freed 103-A (was wrongly locked)');
    }
    if (bed103C && bed103C.status !== 'LOCKED') {
        await p.bed.update({ where: { id: bed103C.id }, data: { status: 'LOCKED', lockedByBookingId: BOOKING_ID, lockedAt: new Date() } });
        console.log('Locked 103-C (matches booking roomAssigned)');
    }
    
    const finalBeds = await p.bed.findMany({ where: { roomId: ROOM_ID }, select: { bedNumber: true, status: true } });
    console.log('Final:');
    finalBeds.forEach(b => console.log(' ', b.bedNumber, b.status));
    await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
