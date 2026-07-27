'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidateGlobalRoomChanges } from "@/lib/cache";
import { logAuditEvent } from "@/lib/audit";
import { generateMasterId } from "@/lib/ids";
import { withSafeAction } from "@/lib/safe-action";

export const createRoomChangeRequest = withSafeAction(async function _createRoomChangeRequest(data: {
    bookingId: string;
    currentRoomId: string;
    requestedRoomId?: string;
    reason: string;
    preferredDate?: string;
}) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const userId = (session as any).userId;

    const booking = await prisma.booking.findUnique({
        where: { id: data.bookingId },
        include: { property: true }
    });
    if (!booking || booking.userId !== userId) throw new Error("Unauthorized");
    if (!['ACTIVE', 'MOVE_IN_SCHEDULED'].includes(booking.status)) {
        throw new Error("Room change can only be requested for an active booking.");
    }

    // Check no pending request already exists
    const pending = await prisma.roomChangeRequest.findFirst({
        where: { bookingId: data.bookingId, status: 'PENDING', deletedAt: null }
    });
    if (pending) throw new Error("A pending room change request already exists.");

    const displayId = await generateMasterId('RCR');
    const request = await prisma.roomChangeRequest.create({
        data: {
            displayId,
            bookingId: data.bookingId,
            userId,
            currentRoomId: data.currentRoomId,
            requestedRoomId: data.requestedRoomId || null,
            reason: data.reason,
            preferredDate: data.preferredDate ? new Date(data.preferredDate) : null,
        }
    });

    // Notify owner
    await prisma.notification.create({
        data: {
            userId: booking.property!.ownerId,
            type: 'ROOM_CHANGE_REQUEST',
            category: 'OPERATIONS',
            message: `🔄 ${booking.guestName} has requested a room change at ${booking.propertyName}. Reason: ${data.reason}`,
            isPersistent: true,
            metadata: JSON.stringify({ requestId: request.id, bookingId: data.bookingId }),
        }
    });

    logAuditEvent({
        actorId: userId,
        actorRole: 'USER',
        actorName: booking.guestName,
        actionType: 'CREATE',
        entityType: 'ROOM_CHANGE_REQUEST',
        entityId: request.id,
        description: `Room change request filed. Reason: ${data.reason}`,
    });

    // TODO: Add to cache.ts
    revalidateGlobalRoomChanges();
    return request;
});

export async function getMyRoomChangeRequests() {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const userId = (session as any).userId;

    return await prisma.roomChangeRequest.findMany({
        where: { userId, deletedAt: null },
        include: {
            currentRoom: { select: { roomNumber: true, type: true } },
            requestedRoom: { select: { roomNumber: true, type: true } },
        },
        orderBy: { createdAt: 'desc' }
    });
}

export async function getOwnerRoomChangeRequests() {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const userId = (session as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const ownerId = user?.parentOwnerId || userId;

    const properties = await prisma.property.findMany({
        where: { ownerId, deletedAt: null },
        select: { id: true }
    });
    const propertyIds = properties.map(p => p.id);

    const bookings = await prisma.booking.findMany({
        where: { propertyId: { in: propertyIds } },
        select: { id: true }
    });
    const bookingIds = bookings.map(b => b.id);

    return await prisma.roomChangeRequest.findMany({
        where: { bookingId: { in: bookingIds }, deletedAt: null },
        include: {
            booking: { select: { guestName: true, propertyName: true, displayId: true } },
            currentRoom: { select: { roomNumber: true, type: true } },
            requestedRoom: { select: { roomNumber: true, type: true } },
        },
        orderBy: { createdAt: 'desc' }
    });
}

export const updateRoomChangeStatus = withSafeAction(async function _updateRoomChangeStatus(
    requestId: string,
    status: 'APPROVED' | 'REJECTED' | 'COMPLETED',
    ownerNote?: string
) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const actorId = (session as any).userId;

    const request = await prisma.roomChangeRequest.findUnique({
        where: { id: requestId },
        include: { booking: true }
    });
    if (!request) throw new Error("Request not found");

    const updated = await prisma.roomChangeRequest.update({
        where: { id: requestId },
        data: { status, ownerNote: ownerNote || null }
    });

    await prisma.notification.create({
        data: {
            userId: request.userId,
            type: 'ROOM_CHANGE_UPDATE',
            category: 'OPERATIONS',
            message: status === 'APPROVED'
                ? `✅ Your room change request has been approved!${ownerNote ? ` Owner note: ${ownerNote}` : ''}`
                : status === 'REJECTED'
                ? `❌ Your room change request was declined.${ownerNote ? ` Reason: ${ownerNote}` : ''}`
                : `🔄 Your room change has been completed.`,
            isPersistent: true,
        }
    });

    logAuditEvent({
        actorId,
        actorRole: (session as any).role || 'OWNER',
        actorName: 'Owner',
        actionType: 'UPDATE',
        entityType: 'ROOM_CHANGE_REQUEST',
        entityId: requestId,
        description: `Room change request ${status}. Note: ${ownerNote || 'None'}`,
    });

    // TODO: Add to cache.ts
    revalidateGlobalRoomChanges();
    return updated;
});
