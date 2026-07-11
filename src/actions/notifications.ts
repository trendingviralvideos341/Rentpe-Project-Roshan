'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function getNotifications(role: string = 'USER') {
    const session = await getSession();
    if (!session) return [];

    const TOKEN_CATEGORIES = ['REQUEST_ACCEPTED', 'TOKEN_CASH_CONFIRMED', 'APPROVED_PENDING_TOKEN', 'ONBOARDING_COMPLETED'];

    return (prisma.notification as any).findMany({
        where: { 
            userId: (session as any).userId,
            targetRole: role,
            category: { notIn: TOKEN_CATEGORIES }
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
    });
}

/** Fetches active, unread, persistent notifications for real-time pop-ups */
export async function getPersistentNotifications() {
    const session = await getSession();
    if (!session) return [];

    const TOKEN_CATEGORIES = ['REQUEST_ACCEPTED', 'TOKEN_CASH_CONFIRMED', 'APPROVED_PENDING_TOKEN', 'ONBOARDING_COMPLETED'];

    return (prisma.notification as any).findMany({
        where: { 
            userId: (session as any).userId,
            isRead: false,
            isPersistent: true,
            category: { notIn: TOKEN_CATEGORIES }
        },
        orderBy: { createdAt: 'desc' }
    });
}

export async function getUnreadCount(role: string = 'USER') {
    const session = await getSession();
    if (!session) return 0;

    const TOKEN_CATEGORIES = ['REQUEST_ACCEPTED', 'TOKEN_CASH_CONFIRMED', 'APPROVED_PENDING_TOKEN', 'ONBOARDING_COMPLETED'];

    return prisma.notification.count({
        where: { 
            userId: (session as any).userId, 
            targetRole: role,
            isRead: false,
            category: { notIn: TOKEN_CATEGORIES } as any
        },
    });
}

export async function markNotificationRead(id: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const notification = await (prisma.notification as any).findUnique({
        where: { id }
    });
    if (!notification) throw new Error("Notification not found");

    const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true },
    });

    await logAuditEvent({
        actorId: (session as any).userId as string,
        actorRole: session.role as string,
        actorName: (session as any).name || 'User',
        actionType: 'CONFIRM',
        entityType: 'NOTIFICATION',
        entityId: id,
        entityName: notification.category || notification.type,
        description: `Notification confirmed: "${notification.message}"`,
        previousValue: { isRead: false },
        newValue: { isRead: true }
    });

    return updated;
}

export async function markAllNotificationsRead() {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    return prisma.notification.updateMany({
        where: { userId: (session as any).userId, isRead: false },
        data: { isRead: true },
    });
}

// Legacy helper - redirected to NotificationService or updated
export async function createNotification(userId: string, type: string, message: string, category?: string, role: string = 'USER') {
    return (prisma.notification as any).create({
        data: { userId, type, message, category, targetRole: role },
    });
}
