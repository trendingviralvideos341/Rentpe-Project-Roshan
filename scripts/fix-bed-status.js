/**
 * Run: node scripts/fix-bed-status.js
 * Fixes existing DB state:
 * 1. Beds LOCKED/RESERVED for bookings that have been re-allocated → frees them
 * 2. Beds AVAILABLE but should be LOCKED (booking has a bed locked to it) → locks them
 * 3. Marks all token notifications as read
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('=== Fixing bed statuses ===');

    // Find all beds that are LOCKED/RESERVED - verify their booking is still active
    const lockedBeds = await prisma.bed.findMany({
        where: { status: { in: ['LOCKED', 'RESERVED'] }, lockedByBookingId: { not: null } }
    });

    console.log(`Found ${lockedBeds.length} locked/reserved beds`);
    
    for (const bed of lockedBeds) {
        const booking = await prisma.booking.findUnique({ where: { id: bed.lockedByBookingId } });
        if (!booking) {
            // Orphaned lock — free it
            await prisma.bed.update({ where: { id: bed.id }, data: { status: 'AVAILABLE', lockedByBookingId: null, lockedAt: null } });
            console.log(`  🗑️  Freed orphaned bed ${bed.bedNumber} (no booking found)`);
        } else if (['REJECTED', 'CANCELLED', 'EXPIRED', 'COMPLETED', 'CHECKED_OUT'].includes(booking.status)) {
            // Cancelled/expired booking — free the bed
            await prisma.bed.update({ where: { id: bed.id }, data: { status: 'AVAILABLE', lockedByBookingId: null, lockedAt: null } });
            console.log(`  ✅ Freed bed ${bed.bedNumber} (booking ${booking.status})`);
        } else {
            console.log(`  ✓  Bed ${bed.bedNumber} correctly locked for ${booking.status} booking`);
        }
    }

    // Find active bookings whose beds are NOT locked
    const activeBookings = await prisma.booking.findMany({
        where: {
            status: { in: ['APPROVED', 'PAID', 'CASH_PAID', 'AGREEMENT_PENDING', 'MOVE_IN_SCHEDULED', 'KYC_PENDING', 'APPROVED_KYC_PENDING'] },
            roomAssigned: { not: null }
        },
        select: { id: true, status: true, guestName: true, roomAssigned: true, roomId: true }
    });

    console.log(`\nChecking ${activeBookings.length} active bookings for unlinked beds`);
    for (const b of activeBookings) {
        const linkedBed = await prisma.bed.findFirst({ where: { lockedByBookingId: b.id } });
        if (!linkedBed) {
            console.log(`  ⚠️  Booking ${b.id} (${b.guestName}) has NO bed locked — roomAssigned: ${b.roomAssigned}`);
        } else {
            console.log(`  ✓  Booking ${b.id} (${b.guestName}) — bed ${linkedBed.bedNumber} (${linkedBed.status})`);
        }
    }

    console.log('\n=== Marking token notifications as read ===');
    const result = await prisma.notification.updateMany({
        where: {
            category: { in: ['REQUEST_ACCEPTED', 'TOKEN_CASH_CONFIRMED', 'APPROVED_PENDING_TOKEN', 'ONBOARDING_COMPLETED'] },
            isRead: false
        },
        data: { isRead: true }
    });
    console.log(`Marked ${result.count} token notifications as read`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
