/**
 * Run: node scripts/fix-rahul-bed.js
 * Fixes Rahul's booking: roomAssigned shows 103-C but 103-A is locked.
 * Frees 103-A and locks 103-C for his booking.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const BOOKING_ID = '2dfbfa76-e4f4-4663-8220-158011908259';

    const booking = await prisma.booking.findUnique({ where: { id: BOOKING_ID }, select: { id: true, guestName: true, roomAssigned: true, roomId: true } });
    console.log('Booking:', booking);

    // Find which bed is currently locked for this booking
    const lockedBed = await prisma.bed.findFirst({ where: { lockedByBookingId: BOOKING_ID } });
    console.log('Currently locked bed:', lockedBed?.bedNumber, lockedBed?.status);

    // Find the 103-C bed
    const roomAssignedStr = booking?.roomAssigned || '';
    // Extract bed number from "103 — Bed 103-C" or similar
    const bedMatch = roomAssignedStr.match(/[Bb]ed\s+([^\s,]+)/);
    const targetBedNumber = bedMatch ? bedMatch[1] : null;
    console.log('Target bed number from roomAssigned:', targetBedNumber);

    if (!targetBedNumber || !booking?.roomId) {
        console.log('Cannot determine target bed — stopping');
        return;
    }

    // Find the target bed in the same room
    const targetBed = await prisma.bed.findFirst({
        where: { roomId: booking.roomId, bedNumber: targetBedNumber }
    });
    console.log('Target bed:', targetBed?.id, targetBed?.bedNumber, targetBed?.status);

    if (lockedBed && lockedBed.id !== targetBed?.id) {
        // Free the wrong bed
        await prisma.bed.update({
            where: { id: lockedBed.id },
            data: { status: 'AVAILABLE', lockedByBookingId: null, lockedAt: null }
        });
        console.log(`✅ Freed ${lockedBed.bedNumber} → AVAILABLE`);
    }

    if (targetBed) {
        await prisma.bed.update({
            where: { id: targetBed.id },
            data: { status: 'LOCKED', lockedByBookingId: BOOKING_ID, lockedAt: new Date() }
        });
        console.log(`✅ Locked ${targetBed.bedNumber} for booking`);
    }

    // Verify final state
    const allBeds = await prisma.bed.findMany({ where: { roomId: booking?.roomId }, select: { bedNumber: true, status: true, lockedByBookingId: true } });
    console.log('\nFinal bed states:');
    allBeds.forEach(b => console.log(`  ${b.bedNumber}: ${b.status} ${b.lockedByBookingId ? '→ ' + b.lockedByBookingId.substring(0, 8) : ''}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
