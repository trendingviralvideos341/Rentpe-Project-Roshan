'use server';

/**
 * Super Admin Business Control Panel
 * Role: SUPER_ADMIN only (enforced via adminRole field)
 *
 * Provides: Platform-wide business analytics, revenue intelligence,
 * user growth, booking conversion, commission config, admin team management,
 * platform health, and exportable business reports.
 */

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/actions/rbac";
import { logAuditEvent } from "@/lib/audit";

async function isSuperAdmin() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    const user = await prisma.user.findUnique({ where: { id: (session as any).userId } });
    if ((user as any)?.adminRole !== 'SUPER_ADMIN') throw new Error("Super Admin access required");
    return (session as any).userId as string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  PLATFORM BUSINESS DASHBOARD — All high-level KPIs in one call
// ─────────────────────────────────────────────────────────────────────────────
export async function getSuperAdminBusinessSnapshot() {
    const adminId = await isSuperAdmin();

    const [
        totalStudents, totalOwners, totalAdmins,
        totalProperties, liveProperties, suspendedProperties,
        totalRooms, totalBeds,
        totalActiveTenants, totalUpcomingMoveIns, totalScheduledMoveOuts,
        totalBookingRequests, totalConfirmedBookings,
        totalCancelledBookings, totalDisputes, resolvedDisputes, openDisputes,
        totalFraudAlerts, openFraudAlerts,
        totalTickets, todayAttendance,
        settings,
        platformFees,
        adminUser,
    ] = await Promise.all([
        prisma.user.count({ where: { role: 'USER', deletedAt: null } }),
        prisma.user.count({ where: { role: 'OWNER', deletedAt: null } }),
        prisma.user.count({ where: { role: 'ADMIN', deletedAt: null } }),
        prisma.property.count(),
        prisma.property.count({ where: { status: 'LIVE' } }),
        prisma.property.count({ where: { status: 'SUSPENDED' } }),
        prisma.room.count(),
        (prisma as any).bed.count(),
        (prisma.tenant as any).count({ where: { status: 'ACTIVE_TENANT' } }),
        (prisma.tenant as any).count({ where: { status: 'UPCOMING_MOVE_IN' } }),
        (prisma.tenant as any).count({ where: { status: 'MOVE_OUT_SCHEDULED' } }),
        prisma.booking.count(),
        prisma.booking.count({ where: { status: { in: ['BOOKING_CONFIRMED','CHECKED_IN','PAID','CASH_PAID'] } } }),
        prisma.booking.count({ where: { status: 'CANCELLED' } }),
        (prisma as any).dispute.count(),
        (prisma as any).dispute.count({ where: { status: 'RESOLVED' } }),
        (prisma as any).dispute.count({ where: { status: { in: ['OPEN','UNDER_REVIEW'] } } }),
        (prisma as any).fraudAlert.count(),
        (prisma as any).fraudAlert.count({ where: { status: 'OPEN' } }),
        (prisma as any).ticket.count(),
        (prisma as any).attendance.count({ where: { date: new Date().toISOString().split('T')[0] } }),
        prisma.platformSettings.findUnique({ where: { id: 'singleton' } }),
        (prisma as any).platformFee.aggregate({ _sum: { platformEarned: true } }),
        prisma.user.findUnique({ 
            where: { id: adminId },
            select: { id: true, name: true, email: true, role: true, adminRole: true, phone: true, createdAt: true, displayId: true }
        }),
    ]);

    // Owner payouts total
    const payoutData = await (prisma as any).ownerPayout.aggregate({ _sum: { netAmount: true }, where: { status: 'PAID' } });
    // Refunds issued
    const refundData = await (prisma as any).refundRecord.aggregate({ _sum: { amount: true }, where: { status: 'PROCESSED' } });

    // Conversion rate
    const conversionRate = totalBookingRequests > 0
        ? Math.round((totalConfirmedBookings / totalBookingRequests) * 100)
        : 0;

    // Beds breakdown
    const bedStats = await (prisma as any).bed.groupBy({ by: ['status'], _count: { id: true } });
    const bedMap: Record<string, number> = {};
    for (const b of bedStats) bedMap[b.status] = b._count.id;

    return {
        users: { students: totalStudents, owners: totalOwners, admins: totalAdmins, total: totalStudents + totalOwners + totalAdmins },
        properties: { total: totalProperties, live: liveProperties, suspended: suspendedProperties },
        inventory: { rooms: totalRooms, beds: totalBeds, available: bedMap['AVAILABLE'] || 0, occupied: bedMap['OCCUPIED'] || 0, reserved: (bedMap['RESERVED'] || 0) + (bedMap['TEMP_LOCKED'] || 0), maintenance: bedMap['MAINTENANCE'] || 0 },
        bookings: { total: totalBookingRequests, confirmed: totalConfirmedBookings, cancelled: totalCancelledBookings, conversionRate },
        tenants: { active: totalActiveTenants, upcoming: totalUpcomingMoveIns, moveOutScheduled: totalScheduledMoveOuts },
        revenue: {
            platformEarned: platformFees._sum?.platformEarned ?? 0,
            ownerPayoutsIssued: payoutData._sum?.netAmount ?? 0,
            refundsIssued: refundData._sum?.amount ?? 0,
            walletBalance: settings?.platformWalletBalance ?? 0,
            globalCommissionRate: (settings as any)?.globalCommissionRate ?? 10,
        },
        disputes: { total: totalDisputes, open: openDisputes, resolved: resolvedDisputes },
        fraud: { total: totalFraudAlerts, open: openFraudAlerts },
        support: { tickets: totalTickets, attendanceToday: todayAttendance },
        user: {
            id: adminUser?.id,
            name: adminUser?.name || 'Platform Admin',
            email: adminUser?.email,
            role: adminUser?.role,
            adminRole: adminUser?.adminRole,
            phone: adminUser?.phone,
            createdAt: adminUser?.createdAt,
            displayId: adminUser?.displayId,
        }
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  ONBOARDED PROPERTIES — All fully registered & live/approved properties
// ─────────────────────────────────────────────────────────────────────────────
export async function getOnboardedProperties() {
    await isSuperAdmin();

    const properties = await prisma.property.findMany({
        where: {
            status: { in: ['LIVE', 'APPROVED'] }
        },
        include: {
            owner: {
                select: { id: true, name: true, email: true, phone: true, displayId: true }
            },
            rooms: {
                select: { id: true, roomNumber: true, type: true, price: true, availability: true, totalBeds: true, status: true }
            },
            _count: {
                select: { bookings: true, reviews: true }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });

    // Get all room IDs upfront for bulk bed queries
    const allRoomIdsByProp = new Map<string, string[]>();
    for (const prop of properties) {
        allRoomIdsByProp.set(prop.id, (prop as any).rooms.map((r: any) => r.id));
    }

    // Enrich each property with active tenant count, revenue and accurate bed counts
    const enriched = await Promise.all(properties.map(async (prop: any) => {
        const roomIds = allRoomIdsByProp.get(prop.id) || [];

        const [activeTenants, revenue, avgRating, totalBedCount, availableBedCount] = await Promise.all([
            (prisma.tenant as any).count({ where: { propertyId: prop.id, status: 'ACTIVE_TENANT' } }),
            prisma.booking.aggregate({
                where: { propertyId: prop.id, status: { in: ['BOOKING_CONFIRMED', 'CHECKED_IN', 'PAID', 'CASH_PAID'] } },
                _sum: { amount: true }
            }),
            prisma.review.aggregate({
                where: { propertyId: prop.id },
                _avg: { rating: true }
            }),
            // Accurate total bed count from actual bed records
            roomIds.length > 0
                ? (prisma as any).bed.count({ where: { roomId: { in: roomIds } } })
                : 0,
            // Accurate available bed count — only beds with status AVAILABLE
            roomIds.length > 0
                ? (prisma as any).bed.count({ where: { roomId: { in: roomIds }, status: 'AVAILABLE' } })
                : 0,
        ]);

        const totalBeds = totalBedCount as number;
        const availableBeds = availableBedCount as number;

        return {
            id: prop.id,
            displayId: prop.displayId,
            name: prop.name,
            propertyType: prop.propertyType || 'PG',
            address: prop.address,
            city: prop.city,
            status: prop.status,
            genderType: prop.genderType,
            isVerified: prop.isVerified,
            totalRooms: prop.rooms.length,
            totalBeds,
            availableBeds,
            activeTenants,
            totalBookings: prop._count.bookings,
            totalRevenue: revenue._sum?.amount ?? 0,
            avgRating: Math.round((avgRating._avg?.rating ?? 0) * 10) / 10,
            reviewCount: prop._count.reviews,
            owner: prop.owner,
            rooms: prop.rooms,
            createdAt: prop.createdAt,
            updatedAt: prop.updatedAt,
            amenities: prop.amenities,
            description: prop.description,
            foodType: prop.foodType,
        };
    }));

    return enriched;
}

// ─────────────────────────────────────────────────────────────────────────────
//  PLATFORM REVENUE TRENDS — Monthly breakdown
// ─────────────────────────────────────────────────────────────────────────────
export async function getPlatformRevenueTrends(months: number = 12) {
    await isSuperAdmin();

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const fees = await (prisma as any).platformFee.findMany({
        where: { createdAt: { gte: cutoff } },
        include: { booking: { select: { createdAt: true, amount: true } } },
        orderBy: { createdAt: 'asc' }
    });

    const monthlyMap: Record<string, { month: string; platformEarned: number; grossVolume: number; transactions: number }> = {};

    for (const f of fees) {
        const d = new Date(f.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
        if (!monthlyMap[key]) monthlyMap[key] = { month: label, platformEarned: 0, grossVolume: 0, transactions: 0 };
        monthlyMap[key].platformEarned += f.platformEarned;
        monthlyMap[key].grossVolume += f.grossAmount;
        monthlyMap[key].transactions++;
    }

    const monthly = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => ({ ...v, platformEarned: Math.round(v.platformEarned * 100) / 100, grossVolume: Math.round(v.grossVolume * 100) / 100 }));

    // MoM growth
    const withGrowth = monthly.map((m, i) => ({
        ...m,
        momGrowth: i > 0 && monthly[i - 1].platformEarned > 0
            ? Math.round(((m.platformEarned - monthly[i - 1].platformEarned) / monthly[i - 1].platformEarned) * 100)
            : 0
    }));

    return { monthly: withGrowth, total: monthly.reduce((s, m) => s + m.platformEarned, 0) };
}

// ─────────────────────────────────────────────────────────────────────────────
//  USER GROWTH ANALYTICS — New users per month
// ─────────────────────────────────────────────────────────────────────────────
export async function getUserGrowthAnalytics(months: number = 12) {
    await isSuperAdmin();

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const [students, owners] = await Promise.all([
        prisma.user.findMany({ where: { role: 'USER', createdAt: { gte: cutoff } }, select: { createdAt: true } }),
        prisma.user.findMany({ where: { role: 'OWNER', createdAt: { gte: cutoff } }, select: { createdAt: true } }),
    ]);

    const monthlyMap: Record<string, { month: string; newStudents: number; newOwners: number; total: number }> = {};

    const addToMap = (users: any[], field: 'newStudents' | 'newOwners') => {
        for (const u of users) {
            const d = new Date(u.createdAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
            if (!monthlyMap[key]) monthlyMap[key] = { month: label, newStudents: 0, newOwners: 0, total: 0 };
            monthlyMap[key][field]++;
            monthlyMap[key].total++;
        }
    };

    addToMap(students, 'newStudents');
    addToMap(owners, 'newOwners');

    return Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => v);
}

// ─────────────────────────────────────────────────────────────────────────────
//  BOOKING ANALYTICS — Conversion funnel
// ─────────────────────────────────────────────────────────────────────────────
export async function getBookingConversionAnalytics(months: number = 6) {
    await isSuperAdmin();

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const allBookings = await prisma.booking.findMany({
        where: { createdAt: { gte: cutoff } },
        select: { id: true, status: true, createdAt: true, propertyId: true }
    });

    const monthlyMap: Record<string, { month: string; requested: number; accepted: number; confirmed: number; cancelled: number; conversionRate: number }> = {};

    for (const b of allBookings) {
        const d = new Date(b.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
        if (!monthlyMap[key]) monthlyMap[key] = { month: label, requested: 0, accepted: 0, confirmed: 0, cancelled: 0, conversionRate: 0 };
        monthlyMap[key].requested++;
        if (['APPROVED_PENDING_TOKEN','ROOM_RESERVED','KYC_PENDING','AGREEMENT_PENDING','BOOKING_CONFIRMED','CHECKED_IN','PAID','CASH_PAID'].includes(b.status)) monthlyMap[key].accepted++;
        if (['BOOKING_CONFIRMED','CHECKED_IN','PAID','CASH_PAID'].includes(b.status)) monthlyMap[key].confirmed++;
        if (b.status === 'CANCELLED') monthlyMap[key].cancelled++;
    }

    return Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => ({ ...v, conversionRate: v.requested > 0 ? Math.round((v.confirmed / v.requested) * 100) : 0 }));
}

// ─────────────────────────────────────────────────────────────────────────────
//  PROPERTY PERFORMANCE — Platform-wide top/bottom properties
// ─────────────────────────────────────────────────────────────────────────────
export async function getPlatformPropertyPerformance(limit: number = 20) {
    await isSuperAdmin();

    const properties = await prisma.property.findMany({
        where: { status: 'LIVE' },
        include: { rooms: true, reviews: true, _count: { select: { bookings: true } } }
    });

    const result = await Promise.all(properties.map(async (prop: any) => {
        const confirmed = await prisma.booking.count({ where: { propertyId: prop.id, status: { in: ['BOOKING_CONFIRMED','CHECKED_IN','PAID','CASH_PAID'] } } });
        const cancelled = await prisma.booking.count({ where: { propertyId: prop.id, status: 'CANCELLED' } });
        const revenue = await prisma.booking.aggregate({ where: { propertyId: prop.id, status: { in: ['BOOKING_CONFIRMED','CHECKED_IN','PAID','CASH_PAID'] } }, _sum: { amount: true } });
        const avgRating = prop.reviews.length > 0 ? prop.reviews.reduce((s: number, r: any) => s + r.rating, 0) / prop.reviews.length : 0;
        const prices = prop.rooms.map((r: any) => r.price).filter(Boolean);
        return {
            propertyId: prop.id, propertyName: prop.name, city: prop.city, ownerId: prop.ownerId,
            isVerified: prop.isVerified, genderType: prop.genderType,
            totalBookings: prop._count.bookings, confirmedBookings: confirmed, cancelledBookings: cancelled,
            totalRevenue: revenue._sum?.amount ?? 0,
            avgRating: Math.round(avgRating * 10) / 10,
            reviewCount: prop.reviews.length,
            avgRent: prices.length ? Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length) : 0,
            conversionRate: prop._count.bookings > 0 ? Math.round((confirmed / prop._count.bookings) * 100) : 0,
        };
    }));

    return {
        topByRevenue: [...result].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, limit),
        topByRating: [...result].sort((a, b) => b.avgRating - a.avgRating).slice(0, limit),
        topByBookings: [...result].sort((a, b) => b.confirmedBookings - a.confirmedBookings).slice(0, limit),
        lowestConversion: [...result].sort((a, b) => a.conversionRate - b.conversionRate).slice(0, 10),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  CANCELLATION & REFUND REPORT
// ─────────────────────────────────────────────────────────────────────────────
export async function getPlatformCancellationReport(months: number = 6) {
    await isSuperAdmin();

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const cancelled = await prisma.booking.findMany({
        where: { status: 'CANCELLED', updatedAt: { gte: cutoff } },
        select: { id: true, displayId: true, propertyName: true, cancelReason: true, updatedAt: true, amount: true }
    });

    const refunds = await (prisma as any).refundRecord.findMany({
        where: { createdAt: { gte: cutoff } },
        orderBy: { createdAt: 'desc' }
    });

    // Reason breakdown
    const reasonCounts: Record<string, number> = {};
    for (const b of cancelled) {
        const reason = b.cancelReason || 'Not specified';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }

    return {
        totalCancellations: cancelled.length,
        totalRefundsIssued: refunds.length,
        totalRefundAmount: refunds.reduce((s: number, r: any) => s + r.amount, 0),
        pendingRefunds: refunds.filter((r: any) => r.status === 'PENDING').length,
        reasonBreakdown: Object.entries(reasonCounts).sort(([, a], [, b]) => b - a).map(([reason, count]) => ({ reason, count })),
        recentCancellations: cancelled.slice(0, 20),
        recentRefunds: refunds.slice(0, 20),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN TEAM ACTIVITY REPORT
// ─────────────────────────────────────────────────────────────────────────────
export async function getAdminTeamActivityReport() {
    await isSuperAdmin();

    const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true, name: true, email: true, adminRole: true, status: true, lastLoginAt: true, createdAt: true } as any
    });

    const result = await Promise.all(admins.map(async (admin: any) => {
        const [auditCount, lastAudit, loginCount] = await Promise.all([
            prisma.auditLog.count({ where: { actorId: admin.id } }),
            prisma.auditLog.findFirst({ where: { actorId: admin.id }, orderBy: { createdAt: 'desc' }, select: { actionType: true, createdAt: true } }),
            (prisma as any).loginLog.count({ where: { userId: admin.id, success: true, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
        ]);
        return { ...admin, auditActions: auditCount, lastAction: lastAudit, loginsLast30Days: loginCount };
    }));

    return result.sort((a, b) => b.auditActions - a.auditActions);
}

// ─────────────────────────────────────────────────────────────────────────────
//  PLATFORM CONFIGURATION — Super Admin configures business rules
// ─────────────────────────────────────────────────────────────────────────────
export async function updatePlatformConfig(config: {
    globalCommissionRate?: number;
    kycRequired?: boolean;
    tokenPaymentRequired?: boolean;
    maxBookingsPerStudentDay?: number;
    maxListingsPerOwnerDay?: number;
    reservationWindowMins?: number;
    maintenanceMode?: boolean;
    maintenanceMessage?: string;
    feesEnabled?: boolean;
    studentRentFeeFlat?: number;
    ownerRentFeeFlat?: number;
}) {
    const adminId = await isSuperAdmin();

    if (config.globalCommissionRate !== undefined && (config.globalCommissionRate < 0 || config.globalCommissionRate > 50)) {
        throw new Error("Commission rate must be between 0% and 50%");
    }

    const updated = await prisma.platformSettings.upsert({
        where: { id: 'singleton' },
        create: { id: 'singleton', ...config },
        update: config as any
    });

    logAuditEvent({
        actorId: adminId,
        actorRole: 'ADMIN',
        actorName: 'Super Admin',
        actionType: 'UPDATE',
        entityType: 'ADMIN',
        entityId: 'singleton',
        description: `Config changed: ${Object.entries(config).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    });

    revalidatePath('/dashboard/admin/platform-fees');
    revalidatePath('/dashboard/admin/settings');
    return updated;
}

export async function getPlatformConfig() {
    await isSuperAdmin();
    let settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
    if (!settings) {
        settings = await prisma.platformSettings.create({ data: { id: 'singleton' } });
    }
    return settings;
}

// ─────────────────────────────────────────────────────────────────────────────
//  PLATFORM HEALTH — System errors, login failures, security events
// ─────────────────────────────────────────────────────────────────────────────
export async function getPlatformHealthReport() {
    await isSuperAdmin();

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [errors24h, warnings24h, loginFailures24h, rateLimitHits24h, suspiciousAccess24h,
        errors7d, openFraudAlerts, criticalEvents, recentErrors] = await Promise.all([
        (prisma as any).systemEvent.count({ where: { severity: { in: ['ERROR','CRITICAL'] }, createdAt: { gte: last24h } } }),
        (prisma as any).systemEvent.count({ where: { severity: 'WARNING', createdAt: { gte: last24h } } }),
        (prisma as any).loginLog.count({ where: { success: false, createdAt: { gte: last24h } } }),
        (prisma as any).systemEvent.count({ where: { type: 'RATE_LIMIT_HIT', createdAt: { gte: last24h } } }),
        (prisma as any).systemEvent.count({ where: { type: 'SUSPICIOUS_ACCESS', createdAt: { gte: last24h } } }),
        (prisma as any).systemEvent.count({ where: { severity: { in: ['ERROR','CRITICAL'] }, createdAt: { gte: last7d } } }),
        (prisma as any).fraudAlert.count({ where: { status: 'OPEN' } }),
        (prisma as any).systemEvent.findMany({ where: { severity: 'CRITICAL' }, orderBy: { createdAt: 'desc' }, take: 5 }),
        (prisma as any).systemEvent.findMany({ where: { severity: { in: ['ERROR','CRITICAL'] }, createdAt: { gte: last24h } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);

    const healthScore = Math.max(0, 100 - (errors24h * 5) - (loginFailures24h * 1) - (openFraudAlerts * 3));

    return {
        healthScore: Math.min(100, healthScore),
        status: healthScore >= 90 ? 'HEALTHY' : healthScore >= 70 ? 'DEGRADED' : 'CRITICAL',
        last24hours: { errors: errors24h, warnings: warnings24h, loginFailures: loginFailures24h, rateLimitHits: rateLimitHits24h, suspiciousAccess: suspiciousAccess24h },
        last7days: { errors: errors7d },
        security: { openFraudAlerts },
        criticalEvents,
        recentErrors,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXPORTABLE BUSINESS REPORT — Full platform report for management
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMasterBusinessReport() {
    await isSuperAdmin();

    const [snapshot, revenueTrends, userGrowth, bookingAnalytics, cancellationReport, healthReport] = await Promise.all([
        getSuperAdminBusinessSnapshot(),
        getPlatformRevenueTrends(12),
        getUserGrowthAnalytics(12),
        getBookingConversionAnalytics(6),
        getPlatformCancellationReport(6),
        getPlatformHealthReport(),
    ]);

    return {
        generatedAt: new Date().toISOString(),
        generatedBy: 'Super Admin — Automated Report',
        snapshot,
        revenueTrends,
        userGrowth,
        bookingAnalytics,
        cancellationReport,
        healthReport,
    };
}
