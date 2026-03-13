'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateSequentialId } from "@/lib/ids";

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

    return await (prisma as any).bed.update({
        where: { id: bedId },
        data: { status: 'OCCUPIED' }
    });
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
    for (let i = 1; i <= count; i++) {
        const displayId = await generateSequentialId('BED');
        await (prisma as any).bed.create({
            data: {
                displayId,
                roomId,
                bedNumber: `${room.roomNumber}-${String.fromCharCode(64 + existingBeds + i)}`,
                status: 'AVAILABLE'
            }
        });
    }
    revalidatePath('/dashboard/owner/properties');
    // The original instruction snippet included `return bedsToCreate;` here,
    // but `bedsToCreate` is no longer defined. Removing for correctness.
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
