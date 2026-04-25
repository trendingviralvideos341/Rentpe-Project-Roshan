'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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

export async function getUnreadCount() {
    const session = await getSession();
    if (!session) return 0;

    const TOKEN_CATEGORIES = ['REQUEST_ACCEPTED', 'TOKEN_CASH_CONFIRMED', 'APPROVED_PENDING_TOKEN', 'ONBOARDING_COMPLETED'];

    return prisma.notification.count({
        where: { 
            userId: (session as any).userId, 
            isRead: false,
            category: { notIn: TOKEN_CATEGORIES } as any
        },
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
