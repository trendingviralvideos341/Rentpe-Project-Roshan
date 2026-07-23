'use server';
import { withSafeAction } from "@/lib/safe-action";

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
import { TENANT_STATUS } from "@/lib/constants/statuses";
import { getISTDate, getFYDateRange, getCurrentFY } from "@/lib/date";

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
export async function getSuperAdminBusinessSnapshot(fyYearStr?: string) {
    const adminId = await isSuperAdmin();

    const parsedYear = parseInt(fyYearStr || "");
    const now = getISTDate(new Date());
    const currentFY = getCurrentFY(now);
    const fyYear = isNaN(parsedYear) || parsedYear > currentFY ? currentFY : parsedYear;
    const fyRange = getFYDateRange(fyYear, 'all');

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
        (prisma.tenant as any).count({ where: { status: TENANT_STATUS.ACTIVE } }),
        (prisma.tenant as any).count({ where: { status: TENANT_STATUS.UPCOMING } }),
        // Platform-wide scheduled move-outs = active non-withdrawn vacating notices
        prisma.vacatingNotice.count({ where: { status: { not: 'WITHDRAWN' }, deletedAt: null } }),
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
        (prisma as any).platformFee.aggregate({
            _sum: { platformEarned: true },
            where: { createdAt: { gte: fyRange.gte, lt: fyRange.lt } }
        }),
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

        const [activeTenants, revenue, avgRating, availableBedCount] = await Promise.all([
            (prisma.tenant as any).count({ where: { propertyId: prop.id, status: TENANT_STATUS.ACTIVE } }),
            prisma.booking.aggregate({
                where: { propertyId: prop.id, status: { in: ['BOOKING_CONFIRMED', 'CHECKED_IN', 'PAID', 'CASH_PAID'] } },
                _sum: { amount: true }
            }),
            prisma.review.aggregate({
                where: { propertyId: prop.id },
                _avg: { rating: true }
            }),
            // Available beds from bed records (AVAILABLE status only)
            roomIds.length > 0
                ? (prisma as any).bed.count({ where: { roomId: { in: roomIds }, status: 'AVAILABLE' } })
                : 0,
        ]);

        // totalBeds = sum of room.totalBeds (configured capacity — always reliable from rooms table)
        const totalBeds = prop.rooms.reduce((s: number, r: any) => s + (r.totalBeds || r.availability || 0), 0);
        // availableBeds = actual AVAILABLE bed records; if bed table is empty (data gap), fall back to totalBeds
        const availableBeds = Math.min(availableBedCount as number, totalBeds);

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
export async function getPlatformRevenueTrends(yearStr?: string, monthStr?: string) {
    await isSuperAdmin();

    const now = getISTDate(new Date());
    const currentFY = getCurrentFY(now);
    const parsedYear = parseInt(yearStr || "");
    const year = isNaN(parsedYear) || parsedYear > currentFY ? currentFY : parsedYear;

    let startDate: Date;
    let endDate: Date;
    let isWeekly = false;

    if (monthStr && monthStr !== 'all') {
        const parsedMonth = parseInt(monthStr, 10);
        if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
            throw new Error("Invalid month parameter");
        }
        const queryYear = parsedMonth < 4 ? year + 1 : year;
        startDate = new Date(Date.UTC(queryYear, parsedMonth - 2, new Date(queryYear, parsedMonth - 1, 0).getDate(), 18, 30, 0, 0));
        endDate = new Date(Date.UTC(queryYear, parsedMonth - 1, new Date(queryYear, parsedMonth, 0).getDate(), 18, 29, 59, 999));
        isWeekly = true;
    } else {
        startDate = new Date(Date.UTC(year, 2, 31, 18, 30, 0, 0));
        endDate = new Date(Date.UTC(year + 1, 2, 31, 18, 29, 59, 999));
    }

    const fees = await (prisma as any).platformFee.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } },
        orderBy: { createdAt: 'asc' }
    });

    if (isWeekly) {
        let w1Earned = 0, w2Earned = 0, w3Earned = 0, w4Earned = 0;
        let w1Gross = 0, w2Gross = 0, w3Gross = 0, w4Gross = 0;
        let w1Count = 0, w2Count = 0, w3Count = 0, w4Count = 0;
        for (const f of fees) {
            const day = getISTDate(new Date(f.createdAt)).getDate();
            const earned = Number(f.platformEarned || 0);
            const gross = Number(f.grossAmount || 0);
            if (day <= 7) { w1Earned += earned; w1Gross += gross; w1Count++; }
            else if (day <= 14) { w2Earned += earned; w2Gross += gross; w2Count++; }
            else if (day <= 21) { w3Earned += earned; w3Gross += gross; w3Count++; }
            else { w4Earned += earned; w4Gross += gross; w4Count++; }
        }
        const weekly = [
            { month: 'Week 1 (1-7)', platformEarned: Math.round(w1Earned * 100) / 100, grossVolume: Math.round(w1Gross * 100) / 100, transactions: w1Count },
            { month: 'Week 2 (8-14)', platformEarned: Math.round(w2Earned * 100) / 100, grossVolume: Math.round(w2Gross * 100) / 100, transactions: w2Count },
            { month: 'Week 3 (15-21)', platformEarned: Math.round(w3Earned * 100) / 100, grossVolume: Math.round(w3Gross * 100) / 100, transactions: w3Count },
            { month: 'Week 4 (22+)', platformEarned: Math.round(w4Earned * 100) / 100, grossVolume: Math.round(w4Gross * 100) / 100, transactions: w4Count },
        ];
        return { monthly: weekly, total: weekly.reduce((s, m) => s + m.platformEarned, 0) };
    } else {
        const monthMap: Record<string, { month: string; platformEarned: number; grossVolume: number; transactions: number }> = {};
        for (let i = 0; i < 12; i++) {
            const d = new Date(year, 3 + i, 1);
            const mName = d.toLocaleString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' });
            monthMap[mName] = { month: mName, platformEarned: 0, grossVolume: 0, transactions: 0 };
        }
        for (const f of fees) {
            const d = getISTDate(new Date(f.createdAt));
            const mName = d.toLocaleString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' });
            if (monthMap[mName]) {
                monthMap[mName].platformEarned += Number(f.platformEarned || 0);
                monthMap[mName].grossVolume += Number(f.grossAmount || 0);
                monthMap[mName].transactions++;
            }
        }
        const monthly = Object.keys(monthMap).map(k => ({
            ...monthMap[k],
            platformEarned: Math.round(monthMap[k].platformEarned * 100) / 100,
            grossVolume: Math.round(monthMap[k].grossVolume * 100) / 100
        }));
        return { monthly, total: monthly.reduce((s, m) => s + m.platformEarned, 0) };
    }
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
async function _updatePlatformConfig(config: {
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

    // Indian Financial Year: April 1st 00:00:00 IST = March 31st 18:30:00 UTC
    const nowFY = new Date();
    const fyStartYear = nowFY.getMonth() >= 3 ? nowFY.getFullYear() : nowFY.getFullYear() - 1;
    const fyStart = new Date(Date.UTC(fyStartYear, 2, 31, 18, 30, 0, 0)); // April 1 00:00 IST
    const fyEnd   = new Date(Date.UTC(fyStartYear + 1, 2, 31, 18, 29, 59, 999)); // March 31 23:59 IST

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
        getPlatformRevenueTrends(),
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

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN PROPERTY DASHBOARD — Owners + properties dropdown seed
//  Accessible to all ADMIN roles (not just super admin)
// ─────────────────────────────────────────────────────────────────────────────
export async function getOwnersWithProperties() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error('Unauthorized');
    await requirePermission('VIEW_PROPERTIES');

    const owners = await prisma.user.findMany({
        where: { role: 'OWNER', deletedAt: null },
        select: {
            id: true,
            name: true,
            email: true,
            displayId: true,
            properties: {
                where: { status: { in: ['LIVE', 'APPROVED', 'PENDING'] } },
                select: { id: true, name: true, propertyType: true, city: true, status: true }
            }
        },
        orderBy: { name: 'asc' }
    });

    // Only return owners who actually have properties
    return owners
        .filter((o: any) => o.properties.length > 0)
        .map((o: any) => ({
            id: o.id,
            name: o.name || o.email,
            email: o.email,
            displayId: o.displayId,
            properties: o.properties
        }));
}

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN PROPERTY DASHBOARD — Full property-level dashboard for any property
//  CA/GST Compliant: rent revenue separated from security deposits
// ─────────────────────────────────────────────────────────────────────────────
export async function getAdminPropertyDashboard(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error('Unauthorized');
    await requirePermission('VIEW_REPORTS');
    if (!propertyId) throw new Error('Property ID required');

    // Fetch core property data
    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        include: {
            owner: { select: { id: true, name: true, email: true, phone: true, displayId: true, createdAt: true } },
            rooms: { include: { beds: { select: { id: true, status: true, bedNumber: true } } } },
            _count: { select: { bookings: true, reviews: true } }
        }
    });
    if (!property) throw new Error('Property not found');

    // Indian Financial Year: April 1st 00:00:00 IST = March 31st 18:30:00 UTC
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-indexed; 3 = April
    const fyStartYear = currentMonth >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStart = new Date(Date.UTC(fyStartYear, 2, 31, 18, 30, 0, 0)); // April 1 00:00 IST
    const fyEnd = new Date(Date.UTC(fyStartYear + 1, 2, 31, 18, 29, 59, 999)); // March 31 23:59 IST

    const [
        activeTenants,
        pendingBookings,
        confirmedBookings,
        upcomingMoveOuts,
        avgRating,
        ownerPropertyCount,
        depositsHeld,
        recentTenants,
    ] = await Promise.all([
        // Active tenants
        (prisma.tenant as any).count({ where: { propertyId, status: TENANT_STATUS.ACTIVE } }),
        // Pending booking requests
        prisma.booking.count({ where: { propertyId, status: 'PENDING_APPROVAL' } }),
        // Confirmed bookings — Current Financial Year (April to March) — rent revenue only
        prisma.booking.findMany({
            where: {
                propertyId,
                status: { in: ['BOOKING_CONFIRMED', 'CHECKED_IN', 'PAID', 'CASH_PAID', 'COMPLETED'] },
                createdAt: { gte: fyStart, lte: fyEnd }
            },
            select: { createdAt: true, amount: true, depositAmount: true }
        }),
        // Upcoming move-outs — count active vacating notices for this property
        prisma.vacatingNotice.count({ where: { propertyId, status: { not: 'WITHDRAWN' }, deletedAt: null } }),
        // Average review rating
        prisma.review.aggregate({ where: { propertyId }, _avg: { rating: true } }),
        // How many properties does this owner have total?
        prisma.property.count({ where: { ownerId: property.ownerId } }),
        // Security deposits held (net: collected - refunded)
        (prisma as any).securityDeposit.findMany({
            where: {
                billingProfile: { propertyId },
                status: 'PAID'
            },
            select: { amount: true, refundAmount: true }
        }),
        // Recent active tenants (for the tenant list)
        (prisma.tenant as any).findMany({
            where: { propertyId, status: { in: [TENANT_STATUS.ACTIVE, TENANT_STATUS.UPCOMING] } },
            select: { id: true, name: true, phone: true, status: true, startDate: true, roomId: true },
            orderBy: { startDate: 'desc' },
            take: 20
        }),
    ]);

    // ── Revenue: monthly map (rent only — CA compliant) ──────────────────────
    const monthMap: Record<string, number> = {};
    for (const b of confirmedBookings) {
        const d = new Date(b.createdAt);
        const key = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
        monthMap[key] = (monthMap[key] || 0) + Number(b.amount || 0);
    }
    // FY revenue history: April to March (12 months, CA/GST compliant)
    const revenueHistory = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(fyStartYear, 3 + i, 1); // starts from April (month=3)
        const key = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
        return { month: d.toLocaleString('en-IN', { month: 'short' }), revenue: monthMap[key] || 0 };
    });
    const totalRevenue = confirmedBookings.reduce((s: number, b: any) => s + Number(b.amount || 0), 0);

    // ── Deposits held (net liability) ────────────────────────────────────────
    const totalDepositsHeld = (depositsHeld as any[]).reduce(
        (sum: number, dep: any) => sum + Math.max(0, Number(dep.amount || 0) - Number(dep.refundAmount || 0)),
        0
    );

    // ── Bed / Occupancy stats ────────────────────────────────────────────────
    const allBeds = (property as any).rooms.flatMap((r: any) => r.beds || []);
    const totalBeds = allBeds.length || (property as any).rooms.reduce((s: number, r: any) => s + (r.totalBeds || 0), 0);
    const occupiedBeds = allBeds.filter((b: any) => b.status === 'OCCUPIED').length;
    const vacantBeds = Math.max(0, totalBeds - occupiedBeds);

    // ── Rooms breakdown ──────────────────────────────────────────────────────
    const roomsBreakdown = (property as any).rooms.map((r: any) => ({
        id: r.id,
        roomNumber: r.roomNumber,
        type: r.type,
        price: r.price,
        totalBeds: r.beds?.length || r.totalBeds || 0,
        occupiedBeds: (r.beds || []).filter((b: any) => b.status === 'OCCUPIED').length,
        vacantBeds: Math.max(0, (r.beds?.length || r.totalBeds || 0) - (r.beds || []).filter((b: any) => b.status === 'OCCUPIED').length),
        status: r.status,
        availability: r.availability,
    }));

    // ── Owner's other properties count ───────────────────────────────────────
    return {
        property: {
            id: property.id,
            displayId: (property as any).displayId,
            name: property.name,
            propertyType: (property as any).propertyType || 'PG',
            address: property.address,
            city: property.city,
            status: property.status,
            genderType: (property as any).genderType,
            isVerified: (property as any).isVerified,
            foodType: (property as any).foodType,
            amenities: (property as any).amenities,
            createdAt: property.createdAt,
        },
        owner: {
            ...(property as any).owner,
            totalPropertiesOwned: ownerPropertyCount,
        },
        kpis: {
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalDepositsHeld: Math.round(totalDepositsHeld * 100) / 100,
            activeTenants,
            pendingBookings,
            upcomingMoveOuts,
            totalBeds,
            occupiedBeds,
            vacantBeds,
            avgRating: Math.round(((avgRating._avg?.rating ?? 0)) * 10) / 10,
            totalBookings: (property as any)._count.bookings,
            totalReviews: (property as any)._count.reviews,
        },
        revenueHistory,
        roomsBreakdown,
        recentTenants,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  RECENT PLATFORM ACTIVITY — Latest audit log entries for the activity feed
//  Accessible to ALL ADMIN roles (not just super admin)
// ─────────────────────────────────────────────────────────────────────────────
export async function getRecentPlatformActivity(limit: number = 25) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error('Unauthorized');
    await requirePermission('VIEW_AUDIT_LOGS');

    const logs = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
            id: true,
            actorName: true,
            actorRole: true,
            actionType: true,
            entityType: true,
            entityName: true,
            description: true,
            createdAt: true,
        },
    });

    return logs.map((log) => ({
        id: log.id,
        actorName: log.actorName,
        actorRole: log.actorRole,
        actionType: log.actionType,
        entityType: log.entityType,
        entityName: log.entityName ?? '',
        description: log.description,
        createdAt: log.createdAt.toISOString(),
    }));
}


export const updatePlatformConfig = withSafeAction(_updatePlatformConfig);
