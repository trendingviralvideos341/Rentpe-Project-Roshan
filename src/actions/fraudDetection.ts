'use server';

import prisma from "@/lib/prisma";
import { requirePermission } from "@/actions/rbac";
import { getSession } from "@/lib/auth";

/**
 * Automatic fraud pattern detection
 * Called at key moments: booking creation, login, property listing
 * No external ML needed — pure rule-based detection
 */

const THRESHOLDS = {
    MAX_BOOKINGS_PER_HOUR: 5,          // student spam
    MAX_LISTINGS_PER_DAY: 3,           // owner spam
    MAX_CANCELLATIONS_IN_7_DAYS: 4,    // serial canceller
    MAX_FAILED_LOGINS_IN_HOUR: 10,     // brute force
};

/**
 * Run all fraud checks for a user — call after critical actions
 */
export async function runFraudChecks(userId: string, context: 'booking' | 'listing' | 'login' | 'cancellation') {
    const alerts: any[] = [];

    if (context === 'booking') {
        const a = await checkHighBookingVolume(userId);
        if (a) alerts.push(a);
        const b = await checkDuplicateContact(userId);
        if (b) alerts.push(b);
    }

    if (context === 'listing') {
        const a = await checkRapidListings(userId);
        if (a) alerts.push(a);
    }

    if (context === 'cancellation') {
        const a = await checkRapidCancellations(userId);
        if (a) alerts.push(a);
    }

    return alerts;
}

/**
 * Detect student submitting too many booking requests in 1 hour
 */
async function checkHighBookingVolume(userId: string) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const count = await prisma.booking.count({
        where: { userId, createdAt: { gte: oneHourAgo } }
    });

    if (count > THRESHOLDS.MAX_BOOKINGS_PER_HOUR) {
        return createFraudAlert({
            type: 'HIGH_BOOKING_VOLUME',
            severity: 'HIGH',
            targetId: userId,
            targetType: 'USER',
            description: `User sent ${count} booking requests in the last hour (threshold: ${THRESHOLDS.MAX_BOOKINGS_PER_HOUR})`,
            metadata: { count, threshold: THRESHOLDS.MAX_BOOKINGS_PER_HOUR }
        });
    }
    return null;
}

/**
 * Detect duplicate accounts with same phone or email patterns
 */
async function checkDuplicateContact(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true, email: true } });
    if (!user?.phone) return null;

    const duplicates = await prisma.user.findMany({
        where: { phone: user.phone, id: { not: userId } },
        select: { id: true }
    });

    if (duplicates.length > 0) {
        return createFraudAlert({
            type: 'DUPLICATE_CONTACT',
            severity: 'CRITICAL',
            targetId: userId,
            targetType: 'USER',
            description: `User shares phone number with ${duplicates.length} other account(s). Possible duplicate/fake account.`,
            metadata: { duplicateUserIds: duplicates.map(d => d.id), phone: user.phone }
        });
    }
    return null;
}

/**
 * Detect owner creating too many listings in one day (fake properties)
 */
async function checkRapidListings(ownerId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const count = await prisma.property.count({
        where: { ownerId, createdAt: { gte: startOfDay } }
    });

    if (count >= THRESHOLDS.MAX_LISTINGS_PER_DAY) {
        return createFraudAlert({
            type: 'RAPID_LISTINGS',
            severity: 'HIGH',
            targetId: ownerId,
            targetType: 'USER',
            description: `Owner created ${count} properties today (threshold: ${THRESHOLDS.MAX_LISTINGS_PER_DAY}). Possible fake listing spam.`,
            metadata: { count }
        });
    }
    return null;
}

/**
 * Detect serial cancellations (ghost booking fraud)
 */
async function checkRapidCancellations(userId: string) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const count = await prisma.booking.count({
        where: { userId, status: 'CANCELLED', updatedAt: { gte: sevenDaysAgo } }
    });

    if (count >= THRESHOLDS.MAX_CANCELLATIONS_IN_7_DAYS) {
        return createFraudAlert({
            type: 'RAPID_CANCELLATIONS',
            severity: 'MEDIUM',
            targetId: userId,
            targetType: 'USER',
            description: `User cancelled ${count} bookings in the last 7 days. Possible ghost booking behaviour.`,
            metadata: { count }
        });
    }
    return null;
}

import { FraudAlert } from "@/types/models";

/**
 * Internal: create a fraud alert, skip if duplicate OPEN alert exists
 */
async function createFraudAlert(data: {
    type: string;
    severity: string;
    targetId: string;
    targetType: string;
    description: string;
    metadata: any;
}) {
    // Don't spam duplicate alerts (Prisma 5+ handles this better, but we check manually for status: OPEN)
    const existing = await prisma.fraudAlert.findFirst({
        where: { type: data.type, targetId: data.targetId, status: 'OPEN' }
    });
    if (existing) return existing;

    return await prisma.fraudAlert.create({
        data: { 
            type: data.type,
            severity: data.severity,
            targetId: data.targetId,
            targetType: data.targetType,
            description: data.description,
            metadata: JSON.stringify(data.metadata),
            user: { connect: { id: data.targetId } } // Assuming targetId is userId for USER type alerts
        }
    });
}

// ── Admin actions on fraud alerts ──

export async function getFraudAlerts(status?: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('VIEW_FRAUD_ALERTS');

    return await prisma.fraudAlert.findMany({
        where: status ? { status } : {},
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }]
    });
}

export async function investigateFraudAlert(alertId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('VIEW_FRAUD_ALERTS');

    const userId = session.userId;

    return await prisma.fraudAlert.update({
        where: { id: alertId },
        data: { status: 'UNDER_INVESTIGATION', investigatedBy: userId }
    });
}

export async function resolveFraudAlert(alertId: string, resolution: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('RESOLVE_FRAUD');

    const userId = session.userId;

    return await prisma.fraudAlert.update({
        where: { id: alertId },
        data: { status: 'RESOLVED', resolution, investigatedBy: userId }
    });
}

export async function dismissFraudAlert(alertId: string, reason: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('RESOLVE_FRAUD');

    return await prisma.fraudAlert.update({
        where: { id: alertId },
        data: { status: 'DISMISSED', resolution: reason }
    });
}
