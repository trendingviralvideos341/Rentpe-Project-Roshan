'use server';

import prisma from "@/lib/prisma";

const EXPIRY_HOURS = 48;
const CANCEL_REASON = 'Token payment not received within 48 hours (Auto-Expired)';

/**
 * runOnDemandExpiry
 *
 * Phase 1 — Cron-free, on-demand expiry engine.
 *
 * Called at the top of dashboard data-fetching server actions so that every
 * dashboard load opportunistically cleans up stale bookings without any
 * external scheduler.
 *
 * What it does (inside a single Prisma transaction):
 *  1. Finds all bookings with status APPROVED_PENDING_TOKEN that are older
 *     than 48 hours (createdAt < now - 48h).
 *  2. Cancels each booking — sets status=CANCELLED, cancelReason=<reason>.
 *  3. Releases any TEMP_LOCKED or RESERVED beds associated with those
 *     bookings back to AVAILABLE.
 *  4. Creates an AuditLog row for each cancellation with action AUTO_EXPIRED.
 *
 * The entire function is wrapped in a try/catch so it NEVER crashes the
 * calling page load if something goes wrong.
 */
export async function runOnDemandExpiry(): Promise<void> {
    try {
        const cutoff = new Date(Date.now() - EXPIRY_HOURS * 60 * 60 * 1000);

        // Find all stale bookings first (read outside tx for performance)
        const staleBookings = await prisma.booking.findMany({
            where: {
                status: 'APPROVED_PENDING_TOKEN',
                createdAt: { lt: cutoff },
            },
            select: {
                id: true,
                displayId: true,
                propertyId: true,
                guestName: true,
                userId: true,
            },
        });

        if (staleBookings.length === 0) return;

        const bookingIds = staleBookings.map((b) => b.id);

        // Resolve a system actor for the audit log.
        // We look for an ADMIN user to satisfy the required FK on AuditLog.actorId.
        // If none exists, we skip the audit log rather than crashing.
        const systemActor = await prisma.user.findFirst({
            where: { role: 'ADMIN' },
            select: { id: true, name: true, role: true },
        });

        await prisma.$transaction(async (tx) => {
            // ── 1. Cancel all stale bookings in one batch ──────────────────
            await tx.booking.updateMany({
                where: { id: { in: bookingIds } },
                data: {
                    status: 'CANCELLED',
                    cancelReason: CANCEL_REASON,
                },
            });

            // ── 2. Release associated TEMP_LOCKED / RESERVED beds ─────────
            // Beds can be linked via lockedByBookingId (TEMP_LOCKED) or
            // currentBookingId (RESERVED). Release both.
            await tx.bed.updateMany({
                where: {
                    status: { in: ['TEMP_LOCKED', 'RESERVED'] },
                    OR: [
                        { lockedByBookingId: { in: bookingIds } },
                        { currentBookingId: { in: bookingIds } },
                    ],
                },
                data: {
                    status: 'AVAILABLE',
                    lockedByBookingId: null,
                    currentBookingId: null,
                    lockedAt: null,
                    lockExpiresAt: null,
                },
            });

            // ── 3. Write AuditLog entries (one per cancelled booking) ──────
            if (systemActor) {
                await tx.auditLog.createMany({
                    data: staleBookings.map((booking) => ({
                        actorId: systemActor.id,
                        actorRole: systemActor.role,
                        actorName: systemActor.name || 'System',
                        actionType: 'AUTO_EXPIRED',
                        entityType: 'BOOKING',
                        entityId: booking.id,
                        entityName: booking.displayId,
                        description: `Booking ${booking.displayId} auto-expired: ${CANCEL_REASON}`,
                        newValue: {
                            status: 'CANCELLED',
                            cancelReason: CANCEL_REASON,
                        },
                    })),
                    skipDuplicates: true,
                });
            }
        });

        console.log(
            `[runOnDemandExpiry] Auto-expired ${staleBookings.length} booking(s): ${staleBookings.map((b) => b.displayId).join(', ')}`
        );
    } catch (err) {
        // Never crash the calling dashboard load — just log and move on.
        console.error('[runOnDemandExpiry] Failed silently:', err);
    }
}
