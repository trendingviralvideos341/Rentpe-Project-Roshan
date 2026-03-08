'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function getNotifications(role: string = 'USER') {
    const session = await getSession();
    if (!session) return [];

    return (prisma.notification as any).findMany({
        where: { 
            userId: (session as any).userId,
            targetRole: role
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
    });
}

/** Fetches active, unread, persistent notifications for real-time pop-ups */
export async function getPersistentNotifications() {
    const session = await getSession();
    if (!session) return [];

    return (prisma.notification as any).findMany({
        where: { 
            userId: (session as any).userId,
            isRead: false,
            isPersistent: true
        },
        orderBy: { createdAt: 'desc' }
    });
}

export async function getUnreadCount() {
    const session = await getSession();
    if (!session) return 0;

    return prisma.notification.count({
        where: { userId: (session as any).userId, isRead: false },
    });
}

export async function markNotificationRead(id: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    return prisma.notification.update({
        where: { id },
        data: { isRead: true },
    });
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
