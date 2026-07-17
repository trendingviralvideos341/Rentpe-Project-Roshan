import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * 48-Hour Token Expiry Cron
 * Trigger: Every hour (vercel.json cron: "0 * * * *")
 * Security: Requires Authorization: Bearer <CRON_SECRET> in production.
 *
 * Logic:
 *   1. Find all APPROVED_PENDING_TOKEN bookings where tokenDeadline < now
 *   2. For each:
 *      a. Set status → REJECTED, rejectionReason = auto-cancellation message
 *      b. Release the locked bed → AVAILABLE
 *      c. Notify student + owner
 *      d. Log to SystemEvent
 *
 * QA / Security note:
 *   Prevents spammers from locking beds indefinitely without paying.
 *   Ensures inventory stays listable and real applicants can book.
 */
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (
        process.env.NODE_ENV === 'production' &&
        (!cronSecret || authHeader !== `Bearer ${cronSecret}`)
    ) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    const results = {
        checked: 0,
        autoRejected: 0,
        errors: 0,
        details: [] as { bookingId: string; displayId: string; student: string }[],
    };

    try {
        // ── 1. Find all expired token-pending bookings ────────────────────────
        const expiredBookings = await prisma.booking.findMany({
            where: {
                status: 'APPROVED_PENDING_TOKEN',
                tokenDeadline: { lt: now },
                deletedAt: null,
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
                property: { select: { ownerId: true, name: true } },
            },
        });

        results.checked = expiredBookings.length;

        const CHUNK_SIZE = 50;
        for (let i = 0; i < expiredBookings.length; i += CHUNK_SIZE) {
            const chunk = expiredBookings.slice(i, i + CHUNK_SIZE);
            await Promise.allSettled(chunk.map(async (booking) => {
                try {
                    const REJECTION_REASON =
                        'Cancelled automatically due to non-payment within 48 hours.';

                    // ── 2a. Mark booking as REJECTED ──────────────────────────────
                    await prisma.booking.update({
                        where: { id: booking.id },
                        data: {
                            status: 'REJECTED',
                            rejectedAt: now,
                            rejectionReason: REJECTION_REASON,
                            tokenDeadline: null, // clear so it doesn't re-trigger
                        },
                    });

                    // ── 2b. Release locked bed back to AVAILABLE ──────────────────
                    const lockedBed = await prisma.bed
                        .findFirst({ where: { lockedByBookingId: booking.id } })
                        .catch(() => null);

                    if (lockedBed) {
                        await prisma.bed.update({
                            where: { id: lockedBed.id },
                            data: {
                                status: 'AVAILABLE',
                                lockedByBookingId: null,
                                lockedAt: null,
                            },
                        });

                        // Recalculate room availability count
                        if (booking.roomId) {
                            const room = await prisma.room.findUnique({
                                where: { id: booking.roomId },
                                include: { beds: { select: { status: true } } },
                            });
                            if (room) {
                                const availCount = room.beds.filter(
                                    (b) => b.status === 'AVAILABLE',
                                ).length;
                                await prisma.room.update({
                                    where: { id: booking.roomId },
                                    data: { availability: availCount },
                                });
                            }
                        }
                    }

                    // ── 2c. Notify student ─────────────────────────────────────────
                    await prisma.notification.create({
                        data: {
                            userId: booking.userId,
                            type: 'BOOKING_REJECTED',
                            category: 'BOOKING',
                            message: `⏰ Your booking at "${booking.propertyName}" (Ref: ${booking.displayId}) was automatically cancelled because the ₹1,000 token was not paid within 48 hours. You may re-apply for this property.`,
                            isPersistent: true,
                            targetRole: 'USER',
                        },
                    });

                    // ── 2d. Notify owner ───────────────────────────────────────────
                    if (booking.property?.ownerId) {
                        await prisma.notification.create({
                            data: {
                                userId: booking.property.ownerId,
                                type: 'BOOKING_REJECTED',
                                category: 'BOOKING',
                                message: `🔔 Booking ${booking.displayId} for "${booking.propertyName}" was auto-cancelled — student did not pay the token within 48 hours. The bed has been released back to inventory.`,
                                isPersistent: true,
                                targetRole: 'OWNER',
                            },
                        });
                    }

                    results.autoRejected++;
                    results.details.push({
                        bookingId: booking.id,
                        displayId: booking.displayId,
                        student: booking.user?.name || booking.userId,
                    });
                } catch (err: any) {
                    results.errors++;
                    console.error(`[token-expiry cron] Failed for booking ${booking.id}:`, err);
                }
            }));
        }

        // ── 3. Log system event ───────────────────────────────────────────────
        if (results.autoRejected > 0 || results.errors > 0) {
            await prisma.systemEvent.create({
                data: {
                    type: 'TOKEN_EXPIRY_CRON_COMPLETED',
                    severity: results.errors > 0 ? 'WARNING' : 'INFO',
                    message: `Token expiry cron: ${results.autoRejected} booking(s) auto-rejected, ${results.errors} error(s).`,
                    metadata: JSON.stringify(results),
                },
            }).catch(() => {}); // don't crash if SystemEvent table differs
        }

        return NextResponse.json({ success: true, ...results });
    } catch (error: any) {
        console.error('[token-expiry cron] Fatal error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
