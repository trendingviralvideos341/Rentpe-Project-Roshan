'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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
