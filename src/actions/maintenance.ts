'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { generateMasterId } from "@/lib/ids";
import { uploadToCloudinary } from "@/lib/upload";

type MaintenanceCategory = 'ELECTRICAL' | 'PLUMBING' | 'FURNITURE' | 'CLEANLINESS' | 'WIFI' | 'SECURITY' | 'OTHER';
type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// Industry SLA hours by priority
const SLA_HOURS: Record<MaintenancePriority, number> = {
    URGENT: 4,
    HIGH: 24,
    MEDIUM: 72,
    LOW: 168, // 7 days
};

export async function createMaintenanceRequest(data: {
    bookingId: string;
    propertyId: string;
    category: MaintenanceCategory;
    title: string;
    description: string;
    priority: MaintenancePriority;
    photoFiles?: File[];
}) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const userId = (session as any).userId;

    const booking = await prisma.booking.findUnique({ where: { id: data.bookingId } });
    if (!booking || booking.userId !== userId) throw new Error("Unauthorized");

    // Upload photos if provided
    const photoUrls: string[] = [];
    if (data.photoFiles && data.photoFiles.length > 0) {
        for (const file of data.photoFiles.slice(0, 3)) {
            const url = await uploadToCloudinary(file, `maintenance/${data.bookingId}`, false);
            photoUrls.push(url);
        }
    }

    const displayId = await generateMasterId('MNT');
    const slaDeadline = new Date(Date.now() + SLA_HOURS[data.priority] * 60 * 60 * 1000);

    const request = await prisma.maintenanceRequest.create({
        data: {
            displayId,
            bookingId: data.bookingId,
            userId,
            propertyId: data.propertyId,
            category: data.category,
            title: data.title,
            description: data.description,
            photos: JSON.stringify(photoUrls),
            priority: data.priority,
            status: 'OPEN',
            slaDeadline,
        }
    });

    // Get property owner and notify them
    const property = await prisma.property.findUnique({ where: { id: data.propertyId } });
    if (property) {
        await prisma.notification.create({
            data: {
                userId: property.ownerId,
                type: 'MAINTENANCE_REQUEST',
                category: 'MAINTENANCE',
                message: `🔧 [${data.priority}] New maintenance request from ${booking.guestName}: "${data.title}" at ${booking.propertyName}.`,
                isPersistent: true,
                metadata: JSON.stringify({ requestId: request.id, priority: data.priority }),
            }
        });
    }

    logAuditEvent({
        actorId: userId,
        actorRole: 'USER',
        actorName: booking.guestName,
        actionType: 'CREATE',
        entityType: 'MAINTENANCE_REQUEST',
        entityId: request.id,
        description: `Maintenance request: ${data.title} [${data.priority}] in category ${data.category}`,
    });

    revalidatePath('/dashboard/student/maintenance');
    return request;
}

export async function getMyMaintenanceRequests() {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const userId = (session as any).userId;

    const requests = await prisma.maintenanceRequest.findMany({
        where: { userId, deletedAt: null },
        orderBy: [
            { priority: 'desc' },
            { createdAt: 'desc' }
        ]
    });

    return requests.map(r => ({
        ...r,
        photos: (() => { try { return JSON.parse(r.photos || '[]') as string[]; } catch { return [] as string[]; } })()
    }));
}

export async function getOwnerMaintenanceRequests() {
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

    const requests = await prisma.maintenanceRequest.findMany({
        where: { propertyId: { in: propertyIds }, deletedAt: null },
        include: {
            booking: { select: { guestName: true, propertyName: true } }
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }]
    });

    return requests.map(r => ({
        ...r,
        photos: (() => { try { return JSON.parse(r.photos || '[]') as string[]; } catch { return [] as string[]; } })()
    }));
}

export async function updateMaintenanceStatus(
    requestId: string,
    status: 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
    ownerNote?: string
) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const actorId = (session as any).userId;

    const request = await prisma.maintenanceRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error("Request not found");

    const updated = await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
            status,
            ownerNote: ownerNote || request.ownerNote,
            resolvedAt: status === 'RESOLVED' ? new Date() : request.resolvedAt,
        }
    });

    const statusMessages: Record<string, string> = {
        ACKNOWLEDGED: '👀 Your maintenance request has been acknowledged.',
        IN_PROGRESS: '🔧 Work has started on your maintenance request.',
        RESOLVED: `✅ Your maintenance request has been resolved.${ownerNote ? ` Resolution: ${ownerNote}` : ''}`,
        CLOSED: '🔒 Your maintenance request has been closed.',
    };

    await prisma.notification.create({
        data: {
            userId: request.userId,
            type: 'MAINTENANCE_UPDATE',
            category: 'MAINTENANCE',
            message: statusMessages[status] || `Maintenance request updated to ${status}.`,
            isPersistent: status === 'RESOLVED',
        }
    });

    logAuditEvent({
        actorId,
        actorRole: (session as any).role || 'OWNER',
        actorName: 'Owner',
        actionType: 'UPDATE',
        entityType: 'MAINTENANCE_REQUEST',
        entityId: requestId,
        description: `Maintenance request status updated to ${status}. Note: ${ownerNote || 'None'}`,
    });

    revalidatePath('/dashboard/owner/maintenance');
    return updated;
}
