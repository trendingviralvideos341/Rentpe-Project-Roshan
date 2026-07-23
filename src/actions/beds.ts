'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateSequentialId } from "@/lib/ids";
import { logAuditEvent } from "@/lib/audit";
import { TENANT_STATUS } from "@/lib/constants/statuses";


const LOCK_DURATION_MINUTES = 10; // Anti-ghost booking window

/**
 * ANTI-GHOST BOOKING: Temporarily lock a bed for 10 minutes when booking is initiated.
 * If token not paid within 10 min → lock expires and bed returns to AVAILABLE.
 * Check-on-demand: expired locks are released when next booking attempt is made.
 */
export async function lockBedForBooking(bedId: string, bookingId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const bed = await (prisma as any).bed.findUnique({ where: { id: bedId } });
    if (!bed) throw new Error("Bed not found");

    const now = new Date();

    // Release expired locks on-demand (no cron needed)
    if (bed.status === 'TEMP_LOCKED' && bed.lockExpiresAt && new Date(bed.lockExpiresAt) < now) {
        await (prisma as any).bed.update({
            where: { id: bedId },
            data: { status: 'AVAILABLE', lockedByBookingId: null, lockedAt: null, lockExpiresAt: null }
        });
    }

    // Re-fetch after potential release
    const freshBed = await (prisma as any).bed.findUnique({ where: { id: bedId } });
    if (freshBed.status !== 'AVAILABLE') {
        throw new Error(`Bed is not available. Current status: ${freshBed.status}`);
    }

    const lockExpiry = new Date(now.getTime() + LOCK_DURATION_MINUTES * 60 * 1000);

    const locked = await (prisma as any).bed.update({
        where: { id: bedId },
        data: {
            status: 'TEMP_LOCKED',
            lockedByBookingId: bookingId,
            lockedAt: now,
            lockExpiresAt: lockExpiry,
        }
    });

    return { bed: locked, lockExpiresAt: lockExpiry, minutesRemaining: LOCK_DURATION_MINUTES };
}

/**
 * Release a temporary lock (called when booking is cancelled or payment times out)
 */
export async function releaseBedLock(bedId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const released = await (prisma as any).bed.update({
        where: { id: bedId },
        data: { status: 'AVAILABLE', lockedByBookingId: null, lockedAt: null, lockExpiresAt: null }
    });

    revalidatePath('/dashboard/owner/bookings');
    return released;
}

/**
 * Convert temp lock to RESERVED after token payment confirmed
 */
export async function confirmBedReservation(bedId: string, bookingId: string) {
    const bed = await (prisma as any).bed.findUnique({ where: { id: bedId } });
    if (!bed) throw new Error("Bed not found");

    const now = new Date();
    if (bed.status === 'TEMP_LOCKED' && bed.lockExpiresAt && new Date(bed.lockExpiresAt) < now) {
        // Lock expired before payment confirmed
        await (prisma as any).bed.update({
            where: { id: bedId },
            data: { status: 'AVAILABLE', lockedByBookingId: null, lockedAt: null, lockExpiresAt: null }
        });
        throw new Error("Your bed reservation expired (10-min window). Please restart your booking.");
    }

    const reserved = await (prisma as any).bed.update({
        where: { id: bedId },
        data: { status: 'RESERVED', currentBookingId: bookingId, lockExpiresAt: null }
    });

    return reserved;
}

/**
 * Mark bed as OCCUPIED on check-in
 */
export async function occupyBed(bedId: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const updated = await (prisma as any).bed.update({
        where: { id: bedId },
        data: { status: 'OCCUPIED' }
    });

    // ✅ Audit Log: bed check-in
    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role,
        actorName: session.name || session.role,
        actionType: 'UPDATE',
        entityType: 'BED',
        entityId: bedId,
        description: `Bed ${updated.bedNumber || bedId} marked OCCUPIED (check-in) by ${session.role}.`,
        newValue: { status: 'OCCUPIED' },
    });

    return updated;
}

/**
 * Free a bed when tenant vacates or booking cancelled
 */
export async function freeBed(bedId: string) {
    return await (prisma as any).bed.update({
        where: { id: bedId },
        data: { status: 'AVAILABLE', lockedByBookingId: null, lockedAt: null, lockExpiresAt: null, currentBookingId: null }
    });
}

/**
 * Get all beds for a room with real-time status + expired lock cleanup
 */
export async function getBedsForRoom(roomId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const now = new Date();
    const beds = await (prisma as any).bed.findMany({ where: { roomId }, orderBy: { bedNumber: 'asc' } });

    // Release expired locks on-demand
    for (const bed of beds) {
        if (bed.status === 'TEMP_LOCKED' && bed.lockExpiresAt && new Date(bed.lockExpiresAt) < now) {
            await (prisma as any).bed.update({
                where: { id: bed.id },
                data: { status: 'AVAILABLE', lockedByBookingId: null, lockedAt: null, lockExpiresAt: null }
            });
            bed.status = 'AVAILABLE';
        }
    }

    return beds;
}

/**
 * Create beds for a room (owner sets up inventory)
 */
export async function createBedsForRoom(roomId: string, count: number) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new Error("Room not found");

    const existingBeds = await (prisma as any).bed.count({ where: { roomId } });
    const bedIdsList = await Promise.all(Array(count).fill(0).map(() => generateSequentialId('BED')));

    for (let i = 0; i < count; i++) {
        const displayId = bedIdsList[i];
        await (prisma as any).bed.create({
            data: {
                displayId,
                roomId,
                bedNumber: `${room.roomNumber}-${String.fromCharCode(64 + existingBeds + i + 1)}`,
                status: 'AVAILABLE'
            }
        });
    }
    revalidatePath('/dashboard/owner/properties');

    // ✅ Audit Log: beds created for a room
    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role,
        actorName: session.name || session.role,
        actionType: 'CREATE',
        entityType: 'BED',
        entityId: roomId,
        description: `${count} bed(s) created for Room ${roomId} by ${session.role}.`,
        newValue: { bedsCreated: count },
    });
}

/**
 * Delete a booking and immediately free the associated bed back to AVAILABLE.
 * Only OWNER / ADMIN / STAFF can call this.
 * Runs inside a transaction to safely delete all child records first,
 * avoiding FK constraint failures (payments, invoices, documents, etc.).
 */
export async function deleteBookingAndFreeBed(bookingId: string, bedId: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN' && session.role !== 'STAFF')) {
        throw new Error('Unauthorized');
    }

    await (prisma as any).$transaction(async (tx: any) => {
        // ── 1. Nullify tenant's bookingId reference (keep tenant record intact) ──
        await tx.tenant.updateMany({
            where: { booking: { id: bookingId } },
            data: { status: TENANT_STATUS.CHECKED_OUT }
        }).catch(() => {});

        // ── 2. Delete all child records that reference this booking ──
        await tx.tenantDocument.deleteMany({ where: { bookingId } }).catch(() => {});
        await tx.payment.deleteMany({ where: { bookingId } }).catch(() => {});
        await tx.creditNote.deleteMany({ where: { bookingId } }).catch(() => {});
        await tx.foodPreference.deleteMany({ where: { bookingId } }).catch(() => {});
        await tx.rentInvoice.deleteMany({ where: { bookingId } }).catch(() => {});
        await tx.platformFee.deleteMany({ where: { bookingId } }).catch(() => {});

        // ── 3. Hard-delete the booking ──
        await tx.booking.delete({ where: { id: bookingId } });

        // ── 4. Free the bed ──
        await tx.bed.update({
            where: { id: bedId },
            data: {
                status: 'AVAILABLE',
                lockedByBookingId: null,
                lockedAt: null,
                lockExpiresAt: null,
                currentBookingId: null,
                tenantId: null,
            },
        });
    });

    // ── 5. Audit trail (outside tx so it persists even if tx committed) ──
    await logAuditEvent({
        actorId: session.userId,
        actorRole: session.role as string,
        actorName: session.name || session.role,
        actionType: 'DELETE',
        entityType: 'BOOKING',
        entityId: bookingId,
        description: `Booking ${bookingId} deleted and Bed ${bedId} freed to AVAILABLE by ${session.role}.`,
        newValue: { bedStatus: 'AVAILABLE' },
    });

    revalidatePath('/dashboard/owner');
    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/owner/properties');
    revalidatePath('/dashboard/student');

    return { success: true };
}

/**
 * Smart room allocation: find best available bed automatically
 */
export async function autoAllocateBed(propertyId: string, bookingId: string, roomType?: string) {
    const now = new Date();

    // Get all rooms for this property (optionally filtered by type)
    const rooms = await prisma.room.findMany({
        where: { propertyId, ...(roomType ? { type: roomType } : {}) },
        include: { beds: true }
    });

    // For each room, clean expired locks and find first available bed
    for (const room of rooms) {
        for (const bed of (room as any).beds) {
            if (bed.status === 'TEMP_LOCKED' && bed.lockExpiresAt && new Date(bed.lockExpiresAt) < now) {
                await (prisma as any).bed.update({
                    where: { id: bed.id },
                    data: { status: 'AVAILABLE', lockedByBookingId: null, lockedAt: null, lockExpiresAt: null }
                });
                bed.status = 'AVAILABLE';
            }
        }

        const availableBed = (room as any).beds.find((b: any) => b.status === 'AVAILABLE');
        if (availableBed) {
            // Lock it immediately
            const lockExpiry = new Date(now.getTime() + LOCK_DURATION_MINUTES * 60 * 1000);
            const locked = await (prisma as any).bed.update({
                where: { id: availableBed.id },
                data: { status: 'TEMP_LOCKED', lockedByBookingId: bookingId, lockedAt: now, lockExpiresAt: lockExpiry }
            });
            return { bed: locked, room, lockExpiresAt: lockExpiry };
        }
    }

    return null; // No beds available — should trigger waitlist
}
