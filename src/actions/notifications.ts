'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function getNotifications() {
    const session = await getSession();
    if (!session) return [];

    return prisma.notification.findMany({
        where: { userId: (session as any).userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
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

// Helper to create notifications (called from other server actions)
export async function createNotification(userId: string, type: string, message: string) {
    return prisma.notification.create({
        data: { userId, type, message },
    });
}
