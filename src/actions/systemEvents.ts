'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// ── System Event Logger ─────────────────────────────────────────────────────

/**
 * Log a system event (operational health monitoring)
 * Called from API routes, middleware, or action error handlers
 */
export async function logSystemEvent(data: {
    type: string;       // LOGIN_FAILURE | SERVER_ERROR | BOOKING_FAILURE | SUSPICIOUS_ACCESS | RATE_LIMIT_HIT
    severity?: string;  // INFO | WARNING | ERROR | CRITICAL
    message: string;
    userId?: string;
    ipAddress?: string;
    path?: string;
    metadata?: Record<string, any>;
}) {
    await (prisma as any).systemEvent.create({
        data: {
            type: data.type,
            severity: data.severity || 'INFO',
            message: data.message,
            userId: data.userId,
            ipAddress: data.ipAddress,
            path: data.path,
            metadata: JSON.stringify(data.metadata || {}),
        }
    });
}

/**
 * Get system events — admin only
 */
export async function getSystemEvents(filters?: {
    severity?: string;
    type?: string;
    limit?: number;
}) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const where: any = {};
    if (filters?.severity) where.severity = filters.severity;
    if (filters?.type) where.type = filters.type;

    return (prisma as any).systemEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 200
    });
}

// ── Login Security Tracking ─────────────────────────────────────────────────

/**
 * Log a login attempt (success or failure)
 * Call from auth.ts after login attempt
 */
export async function logLoginAttempt(data: {
    userId: string;
    userRole: string;
    adminRole?: string;
    success: boolean;
    ipAddress?: string;
    userAgent?: string;
    failReason?: string;
}) {
    await (prisma as any).loginLog.create({ data });

    // Log to system events if it's a failure
    if (!data.success) {
        await logSystemEvent({
            type: 'LOGIN_FAILURE',
            severity: 'WARNING',
            message: `Login failed for user ${data.userId}. Reason: ${data.failReason || 'Unknown'}`,
            userId: data.userId,
            ipAddress: data.ipAddress,
        });
    }
}

/**
 * Get login history for an admin user (security audit)
 */
export async function getLoginHistory(userId?: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    return (prisma as any).loginLog.findMany({
        where: userId ? { userId } : {},
        orderBy: { createdAt: 'desc' },
        take: 100
    });
}

/**
 * Check for repeated login failures from same IP (brute force detection)
 */
export async function checkBruteForce(ipAddress: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const failures = await (prisma as any).loginLog.count({
        where: { ipAddress, success: false, createdAt: { gte: oneHourAgo } }
    });

    if (failures >= 10) {
        await logSystemEvent({
            type: 'SUSPICIOUS_ACCESS',
            severity: 'CRITICAL',
            message: `Brute force detected: ${failures} failed logins from IP ${ipAddress} in the last hour`,
            ipAddress,
        });
        return true; // blocked
    }
    return false;
}

// ── Rate Limiting ────────────────────────────────────────────────────────────

const RATE_LIMITS: Record<string, { max: number; windowMinutes: number }> = {
    booking_request: { max: 5, windowMinutes: 60 },
    listing_create:  { max: 3, windowMinutes: 1440 }, // per day
    login:           { max: 10, windowMinutes: 60 },
    kyc_upload:      { max: 10, windowMinutes: 60 },
    dispute_raise:   { max: 3, windowMinutes: 1440 },
};

/**
 * Check and increment rate limit counter
 * Returns true if allowed, false if rate limit exceeded
 * Key format: "action:identifier" e.g. "booking_request:user-123" or "login:1.2.3.4"
 */
export async function checkRateLimit(action: string, identifier: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const limit = RATE_LIMITS[action];
    if (!limit) return { allowed: true, remaining: 999, resetAt: new Date() };

    const key = `${action}:${identifier}`;
    const now = new Date();
    const windowEnd = new Date(now.getTime() + limit.windowMinutes * 60 * 1000);

    let record = await (prisma as any).rateLimit.findUnique({ where: { key } });

    // Window expired — reset
    if (record && new Date(record.windowEnd) < now) {
        record = await (prisma as any).rateLimit.update({
            where: { key },
            data: { count: 1, windowStart: now, windowEnd }
        });
        return { allowed: true, remaining: limit.max - 1, resetAt: windowEnd };
    }

    // Create first record
    if (!record) {
        await (prisma as any).rateLimit.create({ data: { key, action, count: 1, windowStart: now, windowEnd } });
        return { allowed: true, remaining: limit.max - 1, resetAt: windowEnd };
    }

    // Check limit
    if (record.count >= limit.max) {
        await logSystemEvent({
            type: 'RATE_LIMIT_HIT',
            severity: 'WARNING',
            message: `Rate limit exceeded for action '${action}' by '${identifier}'`,
            metadata: { action, identifier, count: record.count }
        });
        return { allowed: false, remaining: 0, resetAt: new Date(record.windowEnd) };
    }

    // Increment
    await (prisma as any).rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    return { allowed: true, remaining: limit.max - record.count - 1, resetAt: new Date(record.windowEnd) };
}

// ── Admin Operations Dashboard Data ──────────────────────────────────────────

/**
 * Comprehensive admin dashboard stats — single API call
 */
export async function getAdminDashboardStats() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const [
        totalUsers, totalOwners, totalStudents,
        totalProperties, liveProperties, pendingProperties,
        totalBookings, pendingBookings, confirmedBookings,
        openDisputes, openFraudAlerts, pendingKyc,
        recentSystemErrors, todayLogins
    ] = await Promise.all([
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.user.count({ where: { role: 'OWNER', deletedAt: null } }),
        prisma.user.count({ where: { role: 'USER', deletedAt: null } }),
        prisma.property.count(),
        prisma.property.count({ where: { status: 'LIVE' } }),
        prisma.property.count({ where: { status: { in: ['PENDING_APPROVAL', 'LISTING_SUBMITTED'] } } }),
        prisma.booking.count(),
        prisma.booking.count({ where: { status: 'PENDING_APPROVAL' } }),
        prisma.booking.count({ where: { status: { in: ['BOOKING_CONFIRMED', 'CHECKED_IN'] } } }),
        (prisma as any).dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
        (prisma as any).fraudAlert.count({ where: { status: 'OPEN' } }),
        prisma.booking.count({ where: { status: { in: ['KYC_PENDING', 'ROOM_RESERVED'] } } }),
        (prisma as any).systemEvent.count({ where: { severity: { in: ['ERROR', 'CRITICAL'] }, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
        (prisma as any).loginLog.count({ where: { createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) } } }),
    ]);

    return {
        users: { total: totalUsers, owners: totalOwners, students: totalStudents },
        properties: { total: totalProperties, live: liveProperties, pending: pendingProperties },
        bookings: { total: totalBookings, pending: pendingBookings, confirmed: confirmedBookings, pendingKyc },
        alerts: { openDisputes, openFraudAlerts, recentSystemErrors },
        activity: { todayLogins }
    };
}
