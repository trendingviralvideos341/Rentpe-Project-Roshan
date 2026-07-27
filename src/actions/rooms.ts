'use server';

import { unstable_noStore as noStore } from 'next/cache';
import { revalidateGlobalRooms } from "@/lib/cache";


import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";


export async function getRoomsAction(propertyId?: string) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) {
        throw new Error("Unauthorized");
    }

    const where: any = {};
    if (propertyId) {
        where.propertyId = propertyId;
    } else if (session.role === 'OWNER' || session.role === 'STAFF') {
        const user = await prisma.user.findUnique({ 
            where: { id: session.userId },
            include: { staffProfile: true }
        });
        
        if (user?.staffProfile) {
            const assignments = await prisma.staffPropertyAssignment.findMany({
                where: { staffMemberId: user.staffProfile.id },
                select: { propertyId: true }
            });
            where.propertyId = { in: assignments.map(a => a.propertyId) };
        } else {
            where.property = { ownerId: user?.parentOwnerId || session.userId };
        }
    }

    return prisma.room.findMany({
        where,
        include: { property: { select: { name: true } } },
        orderBy: { roomNumber: 'asc' }
    });
}

export async function getAvailableRooms(propertyId?: string) {
    noStore();
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) {
        throw new Error("Unauthorized");
    }

    const where: any = {};
    if (propertyId) {
        where.propertyId = propertyId;
    } else if (session.role === 'OWNER' || session.role === 'STAFF') {
        const user = await prisma.user.findUnique({ 
            where: { id: session.userId },
            include: { staffProfile: true }
        });
        
        if (user?.staffProfile) {
            const assignments = await prisma.staffPropertyAssignment.findMany({
                where: { staffMemberId: user.staffProfile.id },
                select: { propertyId: true }
            });
            where.propertyId = { in: assignments.map(a => a.propertyId) };
        } else {
            where.property = { ownerId: user?.parentOwnerId || session.userId };
        }
    }

    const rooms = await prisma.room.findMany({
        where,
        include: {
            beds: { select: { status: true } }
        }
    });

    // Map to include real-time availability and filter only those with beds available
    return rooms.map(r => ({
        id: r.id,
        roomNumber: r.roomNumber,
        type: r.type,
        price: r.price,
        propertyId: r.propertyId,
        availability: r.beds.filter(b => b.status === 'AVAILABLE').length,
    })).filter(r => r.availability > 0);
}

export async function deleteRoomByOwner(roomId: string) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) {
        throw new Error("Unauthorized");
    }

    // Verify the room exists and get its propertyId
    const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { 
            property: { select: { id: true, ownerId: true, status: true } },
            tenants: { where: { status: { notIn: ['MOVED_OUT'] } } },
            bookings: { where: { status: { notIn: ['CANCELLED', 'REJECTED', 'COMPLETED'] } } },
            beds:    { where: { status: { notIn: ['AVAILABLE', 'MAINTENANCE'] } } }
        }
    });

    if (!room) throw new Error("Room not found.");

    // Enforce Granular Security using verifyPropertyAccess
    const { verifyPropertyAccess } = await import('@/actions/properties');
    await verifyPropertyAccess(session, room.property.id);

    if (room.property.status !== 'APPROVED') throw new Error("Rooms can only be deleted from approved properties.");

    // Block 1: Active tenants living in this room
    if (room.tenants.length > 0) {
        throw new Error(`This room has ${room.tenants.length} active tenant(s). Move them out before deleting.`);
    }

    // Block 2: Pending/confirmed bookings for this room
    if (room.bookings.length > 0) {
        throw new Error(`This room has ${room.bookings.length} active booking(s). Cancel them before deleting.`);
    }

    // Block 3: Any bed currently occupied/locked
    if (room.beds.length > 0) {
        throw new Error(`One or more beds in this room are occupied or reserved. Free all beds first.`);
    }

    // Industry Standard: delete child Bed records first (cascade), then delete the Room
    // This prevents Prisma P2003 (Foreign key constraint violated on Bed_roomId_fkey)
    await prisma.$transaction([
        prisma.bed.deleteMany({ where: { roomId } }),
        prisma.room.delete({ where: { id: roomId } }),
    ]);

    // Audit Log: captured in BOTH Owner Activity Log + Admin System Audit Log
    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role,
        actorName: session.name || 'Owner',
        actionType: 'DELETE',
        entityType: 'ROOM',
        entityId: roomId,
        description: `Room "${room.roomNumber}" (${room.type}) permanently deleted by ${session.role}. All ${room.beds.length} bed records removed.`,
        previousValue: { roomNumber: room.roomNumber, type: room.type, price: (room as any).price },
    });

    revalidateGlobalRooms(room.property.id);

    return { success: true };
}

export async function getBedsForRoom(roomId: string) {
    noStore();
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) {
        throw new Error("Unauthorized");
    }

    return prisma.bed.findMany({
        where: { roomId },
        select: {
            id: true,
            bedNumber: true,
            status: true,
            tenantId: true,
            lockedByBookingId: true,
            tenant: { select: { name: true } }
        },
        orderBy: { bedNumber: 'asc' }
    });
}

export async function updateRoomByOwner(roomId: string, data: {
    roomNumber: string;
    type: string;
    price: number;
    availability: number;
}) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) {
        throw new Error("Unauthorized");
    }

    // Verify the room exists and get its propertyId
    const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { 
            property: { select: { id: true, ownerId: true } },
            beds: { orderBy: { bedNumber: 'desc' } }
        }
    });

    if (!room) throw new Error("Room not found.");

    // Enforce Granular Security using verifyPropertyAccess
    const { verifyPropertyAccess } = await import('@/actions/properties');
    await verifyPropertyAccess(session, room.property.id);

    if (data.roomNumber) {
        data.roomNumber = data.roomNumber.toString().replace(/[^a-zA-Z0-9\-_]/g, '');
        if (!data.roomNumber.trim()) throw new Error("Valid Room Number is required.");
    }
    if (data.price && data.price <= 0) {
        throw new Error("Valid monthly rent is required.");
    }
    if (data.type && !data.type.trim()) {
        throw new Error("Bed Type cannot be empty.");
    }

    const oldAvailability = room.availability;
    const newAvailability = data.availability;

    const transactionResult = await prisma.$transaction(async (tx) => {
        const updated = await tx.room.update({
            where: { id: roomId },
            data: {
                roomNumber: data.roomNumber,
                type: data.type,
                price: data.price,
                availability: newAvailability,
                totalBeds: newAvailability
            }
        });

        // 1. If availability increased, add more beds
        if (newAvailability > oldAvailability) {
            const bedsToAdd = newAvailability - oldAvailability;
            const { generateSequentialId } = await import('@/lib/ids');
            const bedIdsList = await Promise.all(Array(bedsToAdd).fill(0).map(() => generateSequentialId('BED')));
            
            const bedsData = Array(bedsToAdd).fill(0).map((_, i) => ({
                displayId: bedIdsList[i],
                roomId: roomId,
                bedNumber: `${updated.roomNumber}-${String.fromCharCode(64 + oldAvailability + i + 1)}`,
                status: 'AVAILABLE'
            }));
            await (tx as any).bed.createMany({ data: bedsData });
        }

        // 2. If availability decreased, safely remove beds from the end (A, B, C -> remove C)
        if (newAvailability < oldAvailability) {
            const bedsToRemoveCount = oldAvailability - newAvailability;
            let removedCount = 0;
            
            for (const bed of room.beds) {
                if (removedCount >= bedsToRemoveCount) break;
                if (bed.status !== 'AVAILABLE' && bed.status !== 'MAINTENANCE') {
                    throw new Error(`Cannot decrease beds. Bed ${bed.bedNumber} is currently occupied or reserved. Free it first.`);
                }
                await tx.bed.delete({ where: { id: bed.id } });
                removedCount++;
            }
        }

        // Audit Log
        const { logAuditEvent } = await import('@/lib/audit');
        logAuditEvent({
            actorId: session.userId,
            actorRole: session.role,
            actorName: session.name || 'User',
            actionType: 'UPDATE',
            entityType: 'ROOM',
            entityId: roomId,
            description: `Room "${data.roomNumber}" updated. Type: ${data.type}, Beds changed: ${oldAvailability} -> ${newAvailability}.`,
            previousValue: { roomNumber: room.roomNumber, type: room.type, price: (room as any).price, availability: oldAvailability },
            newValue: data as any,
        });

        // Return the fresh room with beds so UI state updates correctly
        const result = await tx.room.findUnique({
            where: { id: roomId },
            include: { beds: { orderBy: { bedNumber: 'asc' } } }
        });

        return result;
    });

    // CACHE INVALIDATION: ensure updates reflect across the entire app
    revalidateGlobalRooms(room.property.id);

    return transactionResult;
}

/** Get rooms for the allocation modal â€” filtered by type with available bed count */
export async function getRoomsForAllocation(propertyId: string, roomType?: string) {
    noStore();
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) {
        throw new Error("Unauthorized");
    }

    const whereClause: any = { propertyId };
    if (roomType) whereClause.type = { contains: roomType, mode: 'insensitive' };

    const rooms = await prisma.room.findMany({
        where: whereClause,
        include: {
            beds: { select: { id: true, bedNumber: true, status: true, tenantId: true, lockedByBookingId: true, tenant: { select: { name: true } } } }
        },
        orderBy: { roomNumber: 'asc' }
    });

    return rooms.map(r => ({
        ...r,
        availableBeds: r.beds.filter(b => b.status === 'AVAILABLE').length,
        beds: r.beds,
    }));
}

