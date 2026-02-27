'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function getRoomsAction(propertyId?: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) {
        throw new Error("Unauthorized");
    }

    const where: any = {};
    if (propertyId) {
        where.propertyId = propertyId;
    } else if (session.role === 'OWNER') {
        where.property = { ownerId: (session as any).userId };
    }

    return prisma.room.findMany({
        where,
        include: { property: { select: { name: true } } },
        orderBy: { roomNumber: 'asc' }
    });
}

export async function getAvailableRooms(propertyId?: string) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') {
        throw new Error("Unauthorized");
    }

    const where: any = { availability: { gt: 0 } };
    if (propertyId) {
        where.propertyId = propertyId;
    } else {
        where.property = { ownerId: (session as any).userId };
    }

    return prisma.room.findMany({
        where,
        select: { id: true, roomNumber: true, type: true, price: true, propertyId: true }
    });
}
