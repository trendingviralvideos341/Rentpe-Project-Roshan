'use server';

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
            include: { employeeProfile: true }
        });
        
        if (user?.employeeProfile) {
            const assignments = await prisma.employeePropertyAssignment.findMany({
                where: { employeeId: user.employeeProfile.id },
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
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) {
        throw new Error("Unauthorized");
    }

    const where: any = { availability: { gt: 0 } };
    if (propertyId) {
        where.propertyId = propertyId;
    } else if (session.role === 'OWNER' || session.role === 'STAFF') {
        const user = await prisma.user.findUnique({ 
            where: { id: session.userId },
            include: { employeeProfile: true }
        });
        
        if (user?.employeeProfile) {
            const assignments = await prisma.employeePropertyAssignment.findMany({
                where: { employeeId: user.employeeProfile.id },
                select: { propertyId: true }
            });
            where.propertyId = { in: assignments.map(a => a.propertyId) };
        } else {
            where.property = { ownerId: user?.parentOwnerId || session.userId };
        }
    }

    return prisma.room.findMany({
        where,
        select: { id: true, roomNumber: true, type: true, price: true, propertyId: true, availability: true }
    });
}

export async function deleteRoomByOwner(roomId: string) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') {
        throw new Error("Unauthorized");
    }

    // Verify the room belongs to this owner's property
    const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { 
            property: { select: { ownerId: true, status: true } },
            tenants: { where: { status: { notIn: ['MOVED_OUT'] } } },
            bookings: { where: { status: { notIn: ['CANCELLED', 'REJECTED', 'COMPLETED'] } } },
            beds:    { where: { status: { notIn: ['AVAILABLE', 'MAINTENANCE'] } } }
        }
    });

    if (!room) throw new Error("Room not found.");
    if (room.property.ownerId !== session.userId) throw new Error("You do not own this room.");
    if (room.property.status !== 'APPROVED') throw new Error("Rooms can only be deleted from approved properties.");

    // 🚫 Block 1: Active tenants living in this room
    if (room.tenants.length > 0) {
        throw new Error(`This room has ${room.tenants.length} active tenant(s). Move them out before deleting.`);
    }

    // 🚫 Block 2: Pending/confirmed bookings for this room
    if (room.bookings.length > 0) {
        throw new Error(`This room has ${room.bookings.length} active booking(s). Cancel them before deleting.`);
    }

    // 🚫 Block 3: Any bed currently occupied/locked
    if (room.beds.length > 0) {
        throw new Error(`One or more beds in this room are occupied or reserved. Free all beds first.`);
    }

    // ✅ Industry Standard: delete child Bed records first (cascade), then delete the Room
    // This prevents Prisma P2003 (Foreign key constraint violated on Bed_roomId_fkey)
    await prisma.$transaction([
        prisma.bed.deleteMany({ where: { roomId } }),
        prisma.room.delete({ where: { id: roomId } }),
    ]);

    // ✅ Audit Log: captured in BOTH Owner Activity Log + Admin System Audit Log
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

    return { success: true };
}

export async function getBedsForRoom(roomId: string) {
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

    // Verify ownership
    const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { property: { select: { ownerId: true } } }
    });

    if (!room) throw new Error("Room not found.");
    if (session.role === 'OWNER' && room.property.ownerId !== session.userId) {
        throw new Error("You do not own this room.");
    }

    const updated = await prisma.room.update({
        where: { id: roomId },
        data: {
            roomNumber: data.roomNumber,
            type: data.type,
            price: data.price,
            availability: data.availability,
        }
    });

    // ✅ Audit Log: update room — captured in Owner Activity Log + Admin Audit Log
    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role,
        actorName: session.name || 'Owner',
        actionType: 'UPDATE',
        entityType: 'ROOM',
        entityId: roomId,
        description: `Room "${data.roomNumber}" updated by ${session.role}. Type: ${data.type}, Price: ₹${data.price}, Beds: ${data.availability}.`,
        previousValue: { roomNumber: room.roomNumber, type: room.type, price: (room as any).price, availability: room.availability },
        newValue: data as any,
    });

    return updated;
}
