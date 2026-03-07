'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/actions/notifications";

/** Get full student profile for the current user */
export async function getStudentProfile() {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const user = await prisma.user.findUnique({
        where: { id: (session as any).userId },
        select: {
            id: true, name: true, email: true, phone: true, displayId: true,
            status: true, createdAt: true, lastLoginAt: true,
            profilePhoto: true, dateOfBirth: true, gender: true,
            emergencyContact: true, currentAddress: true, college: true, bio: true,
            notifPrefs: true, deactivationRequested: true,
        } as any
    });

    if (!user) throw new Error("User not found");

    return {
        ...user,
        emergencyContact: (() => { try { return JSON.parse((user as any).emergencyContact || 'null'); } catch { return null; } })(),
        notifPrefs: (() => { try { return JSON.parse((user as any).notifPrefs || '{}'); } catch { return {}; } })(),
    };
}

/** Update student profile */
export async function updateStudentProfile(data: {
    name?: string;
    email?: string; // Sensitive field
    phone?: string;
    profilePhoto?: string;
    dateOfBirth?: string;
    gender?: string;
    emergencyContact?: { name: string; phone: string; relation: string } | null;
    currentAddress?: string;
    college?: string;
    bio?: string;
}) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const userId = (session as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (data.name && data.name.trim().length < 2) throw new Error("Name must be at least 2 characters");

    // Sensitive field protection: Email change requires a different flow (SIMULATED)
    if (data.email && data.email !== user?.email) {
        // In a real app, this triggers an OTP flow. Here we log it and reject direct update.
        await prisma.auditLog.create({
            data: {
                action: 'SENSITIVE_UPDATE_ATTEMPT',
                targetId: userId,
                targetType: 'USER',
                details: `Attempted email change to ${data.email}. Direct update blocked.`,
                performedBy: userId
            }
        });
        throw new Error("Email change requires OTP verification. Please contact support.");
    }

    const updated = await (prisma.user as any).update({
        where: { id: userId },
        data: {
            name: data.name?.trim(),
            phone: data.phone?.trim(),
            profilePhoto: data.profilePhoto,
            dateOfBirth: data.dateOfBirth,
            gender: data.gender,
            emergencyContact: data.emergencyContact ? JSON.stringify(data.emergencyContact) : undefined,
            currentAddress: data.currentAddress?.trim(),
            college: data.college?.trim(),
            bio: data.bio?.trim(),
        }
    });

    revalidatePath('/dashboard/student/profile');
    return { success: true };
}

/** Get KYC issues (rejected docs) */
export async function getStudentKycIssues() {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const userId = (session as any).userId;

    const bookings = await prisma.booking.findMany({
        where: { userId },
        select: { id: true, propertyName: true }
    });
    const bookingIds = bookings.map(b => b.id);

    const rejectedDocs = await prisma.tenantDocument.findMany({
        where: { bookingId: { in: bookingIds }, status: 'REJECTED' },
        select: { id: true, type: true, rejectedNote: true, bookingId: true }
    });

    return rejectedDocs.map(doc => ({
        ...doc,
        propertyName: bookings.find(b => b.id === doc.bookingId)?.propertyName
    }));
}

/** Update notification preferences */
export async function updateNotifPrefs(prefs: {
    bookings?: boolean;
    kyc?: boolean;
    messages?: boolean;
    disputes?: boolean;
    promotions?: boolean;
}) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const current = await prisma.user.findUnique({ where: { id: (session as any).userId } });
    const currentPrefs = (() => { try { return JSON.parse((current as any)?.notifPrefs || '{}'); } catch { return {}; } })();

    await (prisma as any).user.update({
        where: { id: (session as any).userId },
        data: { notifPrefs: JSON.stringify({ ...currentPrefs, ...prefs }) }
    });

    revalidatePath('/dashboard/student/settings');
    return { success: true };
}

/** Request account deactivation */
export async function requestAccountDeactivation(reason: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    if (!reason?.trim()) throw new Error("Reason is required");

    // Check for active bookings
    const activeBookings = await prisma.booking.count({
        where: {
            userId: (session as any).userId,
            status: { in: ['PENDING_APPROVAL', 'APPROVED_PENDING_TOKEN', 'ROOM_RESERVED', 'KYC_PENDING', 'AGREEMENT_PENDING', 'BOOKING_CONFIRMED'] }
        }
    });

    if (activeBookings > 0) {
        throw new Error(`Cannot deactivate account with ${activeBookings} active booking(s). Please cancel all bookings first.`);
    }

    await (prisma as any).user.update({
        where: { id: (session as any).userId },
        data: { deactivationRequested: true, deactivationReason: reason }
    });

    // Notify admin
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    for (const admin of admins) {
        await createNotification(admin.id, 'TICKET', `Account deactivation requested by ${(session as any).userId}. Reason: ${reason}`);
    }

    await prisma.auditLog.create({
        data: {
            action: 'DEACTIVATION_REQUESTED',
            targetId: (session as any).userId,
            targetType: 'USER',
            details: `Reason: ${reason}`,
            performedBy: (session as any).userId
        }
    });

    return { success: true, message: "Deactivation request submitted. Our team will process it within 24-48 hours." };
}

/** Get student dashboard home data — single API call */
export async function getStudentDashboardHome() {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const userId = (session as any).userId;

    const [recentBookings, savedCount, unreadNotifications, recentDisputes, profile] = await Promise.all([
        prisma.booking.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { id: true, displayId: true, propertyName: true, status: true, createdAt: true, moveInDate: true }
        }),
        (prisma as any).savedProperty.count({ where: { userId } }),
        prisma.notification.count({ where: { userId, isRead: false } }),
        (prisma as any).dispute.findMany({
            where: { raisedById: userId },
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: { id: true, displayId: true, subject: true, status: true, createdAt: true }
        }),
        prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, profilePhoto: true, college: true, status: true, displayId: true } as any
        })
    ]);

    // Check profile completeness
    const fullProfile = await prisma.user.findUnique({ where: { id: userId } });
    const profileFields = ['name', 'phone', 'dateOfBirth', 'gender', 'currentAddress', 'emergencyContact'] as const;
    const completedFields = profileFields.filter(f => !!(fullProfile as any)?.[f]).length;
    const profileCompleteness = Math.round((completedFields / profileFields.length) * 100);

    // Upcoming move-in
    const upcoming = recentBookings.find((b: any) =>
        ['BOOKING_CONFIRMED', 'AGREEMENT_PENDING'].includes(b.status) && b.moveInDate
    );

    return {
        profile,
        profileCompleteness,
        recentBookings,
        savedCount,
        unreadNotifications,
        recentDisputes,
        upcomingMoveIn: upcoming || null,
        pendingActions: recentBookings.filter((b: any) =>
            ['APPROVED_PENDING_TOKEN', 'KYC_PENDING', 'KYC_FAILED', 'AGREEMENT_PENDING'].includes(b.status)
        ).length
    };
}

/** Get student session history (security) */
export async function getMySessionHistory() {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    return (prisma as any).loginLog.findMany({
        where: { userId: (session as any).userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { success: true, ipAddress: true, userAgent: true, failReason: true, createdAt: true }
    });
}
