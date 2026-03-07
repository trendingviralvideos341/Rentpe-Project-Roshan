'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/actions/notifications";

// ─────────────────────────────────────────────────────────────────────────────
//  OWNER DASHBOARD HOME — Single API call for all summary cards
// ─────────────────────────────────────────────────────────────────────────────
export async function getOwnerDashboardHome() {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");
    const ownerId = (session as any).userId;

    const properties = await prisma.property.findMany({
        where: { ownerId },
        include: { rooms: { include: { beds: true } } }
    });

    const propertyIds = properties.map(p => p.id);

    // Beds breakdown
    let totalRooms = 0, totalBeds = 0, occupiedBeds = 0, availableBeds = 0, reservedBeds = 0, maintenanceBeds = 0;
    for (const prop of properties) {
        totalRooms += (prop as any).rooms.length;
        for (const room of (prop as any).rooms) {
            for (const bed of room.beds) {
                totalBeds++;
                if (bed.status === 'OCCUPIED') occupiedBeds++;
                else if (bed.status === 'AVAILABLE') availableBeds++;
                else if (bed.status === 'RESERVED' || bed.status === 'TEMP_LOCKED') reservedBeds++;
                else if (bed.status === 'MAINTENANCE') maintenanceBeds++;
            }
        }
    }

    // Bookings
    const [pendingRequests, activeBookings, activeTenants] = await Promise.all([
        prisma.booking.count({ where: { propertyId: { in: propertyIds }, status: 'PENDING_APPROVAL' } }),
        prisma.booking.count({ where: { propertyId: { in: propertyIds }, status: { in: ['BOOKING_CONFIRMED', 'CHECKED_IN', 'ROOM_RESERVED', 'KYC_PENDING'] } } }),
        prisma.tenant.count({ where: { propertyId: { in: propertyIds }, status: 'ACTIVE' } }),
    ]);

    // Monthly revenue (current month confirmed bookings, minus refunds)
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthlyBookings = await prisma.booking.findMany({
        where: { propertyId: { in: propertyIds }, status: { in: ['BOOKING_CONFIRMED', 'CHECKED_IN', 'PAID', 'CASH_PAID'] }, createdAt: { gte: monthStart } },
        select: { id: true, amount: true }
    });
    const monthlyRefunds = await (prisma as any).refundRecord.findMany({
        where: { bookingId: { in: monthlyBookings.map((b: any) => b.id) }, status: 'PROCESSED' }
    });
    const monthlyGross = monthlyBookings.reduce((sum: number, b: any) => sum + parseFloat(b.amount || '0'), 0);
    const monthlyRefunded = monthlyRefunds.reduce((sum: number, r: any) => sum + r.amount, 0);
    const monthlyRevenue = monthlyGross - monthlyRefunded;

    // Occupancy %
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return {
        totalProperties: properties.length,
        totalRooms,
        totalBeds,
        occupiedBeds,
        availableBeds,
        reservedBeds,
        maintenanceBeds,
        occupancyRate,
        pendingRequests,
        activeBookings,
        activeTenants,
        monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  REVENUE DASHBOARD — Monthly breakdown + per-property + refund impact
// ─────────────────────────────────────────────────────────────────────────────
export async function getOwnerRevenueDashboard(months: number = 6) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");
    const ownerId = (session as any).userId;

    const propertyIds = (await prisma.property.findMany({ where: { ownerId }, select: { id: true, name: true } }))
    const propIdList = propertyIds.map(p => p.id);

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const confirmedBookings = await prisma.booking.findMany({
        where: { propertyId: { in: propIdList }, status: { in: ['BOOKING_CONFIRMED','CHECKED_IN','PAID','CASH_PAID'] }, createdAt: { gte: cutoff } },
        select: { id: true, amount: true, propertyId: true, propertyName: true, createdAt: true }
    });

    const cancelledBookings = await prisma.booking.findMany({
        where: { propertyId: { in: propIdList }, status: 'CANCELLED', updatedAt: { gte: cutoff } },
        select: { id: true, amount: true, propertyId: true, createdAt: true }
    });

    const allBookingIds = confirmedBookings.map(b => b.id);
    const refunds = await (prisma as any).refundRecord.findMany({
        where: { bookingId: { in: allBookingIds }, status: 'PROCESSED' }
    });

    // Monthly breakdown
    const monthlyMap: Record<string, { month: string; gross: number; refunds: number; net: number; bookings: number }> = {};
    for (const b of confirmedBookings) {
        const key = `${b.createdAt.getFullYear()}-${String(b.createdAt.getMonth() + 1).padStart(2, '0')}`;
        const label = b.createdAt.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
        if (!monthlyMap[key]) monthlyMap[key] = { month: label, gross: 0, refunds: 0, net: 0, bookings: 0 };
        monthlyMap[key].gross += parseFloat(b.amount || '0');
        monthlyMap[key].bookings++;
    }
    for (const r of refunds) {
        const booking = confirmedBookings.find((b: any) => b.id === r.bookingId);
        if (!booking) continue;
        const key = `${booking.createdAt.getFullYear()}-${String(booking.createdAt.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyMap[key]) monthlyMap[key].refunds += r.amount;
    }
    const monthly = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => ({ ...v, net: Math.round((v.gross - v.refunds) * 100) / 100 }));

    // Per-property revenue
    const perProperty = propertyIds.map(p => {
        const propBookings = confirmedBookings.filter((b: any) => b.propertyId === p.id);
        const gross = propBookings.reduce((sum: number, b: any) => sum + parseFloat(b.amount || '0'), 0);
        const propRefunds = refunds.filter((r: any) => propBookings.find((b: any) => b.id === r.bookingId)).reduce((sum: number, r: any) => sum + r.amount, 0);
        return { propertyId: p.id, propertyName: p.name, gross, refunds: propRefunds, net: Math.round((gross - propRefunds) * 100) / 100, bookings: propBookings.length };
    });

    // Totals
    const lifetimeGross = confirmedBookings.reduce((sum: number, b: any) => sum + parseFloat(b.amount || '0'), 0);
    const lifetimeRefunds = refunds.reduce((sum: number, r: any) => sum + r.amount, 0);

    return {
        monthly,
        perProperty,
        totals: {
            lifetimeGross: Math.round(lifetimeGross * 100) / 100,
            lifetimeRefunds: Math.round(lifetimeRefunds * 100) / 100,
            lifetimeNet: Math.round((lifetimeGross - lifetimeRefunds) * 100) / 100,
            cancelledCount: cancelledBookings.length,
        }
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  OCCUPANCY TRACKING — Per-property occupancy rates
// ─────────────────────────────────────────────────────────────────────────────
export async function getOccupancyReport() {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");
    const ownerId = (session as any).userId;

    const properties = await prisma.property.findMany({
        where: { ownerId },
        include: { rooms: { include: { beds: true } } }
    });

    return properties.map((prop: any) => {
        let total = 0, occupied = 0, reserved = 0, available = 0, maintenance = 0;
        for (const room of prop.rooms) {
            for (const bed of room.beds) {
                total++;
                if (bed.status === 'OCCUPIED') occupied++;
                else if (bed.status === 'AVAILABLE') available++;
                else if (bed.status === 'RESERVED' || bed.status === 'TEMP_LOCKED') reserved++;
                else if (bed.status === 'MAINTENANCE') maintenance++;
            }
        }
        return {
            propertyId: prop.id, propertyName: prop.name, city: prop.city, status: prop.status,
            totalBeds: total, occupiedBeds: occupied, reservedBeds: reserved, availableBeds: available, maintenanceBeds: maintenance,
            occupancyRate: total > 0 ? Math.round((occupied / total) * 100) : 0,
            effectiveOccupancy: total > 0 ? Math.round(((occupied + reserved) / total) * 100) : 0,
        };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
//  PROPERTY PERFORMANCE ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────
export async function getPropertyPerformanceAnalytics() {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");
    const ownerId = (session as any).userId;

    const properties = await prisma.property.findMany({ where: { ownerId }, include: { rooms: { include: { beds: true } }, reviews: true } });

    const results = [];
    for (const prop of properties) {
        const propBookings = await prisma.booking.findMany({
            where: { propertyId: prop.id, status: { in: ['BOOKING_CONFIRMED', 'CHECKED_IN', 'PAID', 'CASH_PAID', 'CANCELLED'] } },
            select: { id: true, status: true, amount: true, moveInDate: true, createdAt: true, updatedAt: true }
        });

        const confirmed = propBookings.filter((b: any) => ['BOOKING_CONFIRMED','CHECKED_IN','PAID','CASH_PAID'].includes(b.status));
        const cancelled = propBookings.filter((b: any) => b.status === 'CANCELLED');

        // Avg booking duration (days between createdAt and updatedAt for confirmed)
        const durations = confirmed.map((b: any) => Math.abs(new Date(b.updatedAt).getTime() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        const avgDuration = durations.length ? Math.round(durations.reduce((a: number, d: number) => a + d, 0) / durations.length) : 0;

        // Revenue
        const totalRevenue = confirmed.reduce((sum: number, b: any) => sum + parseFloat(b.amount || '0'), 0);

        // Beds
        const beds = (prop as any).rooms.flatMap((r: any) => r.beds);
        const totalBeds = beds.length;
        const occupiedBeds = beds.filter((b: any) => b.status === 'OCCUPIED').length;

        // Reviews
        const avgRating = (prop as any).reviews.length > 0
            ? (prop as any).reviews.reduce((s: number, r: any) => s + r.rating, 0) / (prop as any).reviews.length
            : 0;

        results.push({
            propertyId: prop.id,
            propertyName: prop.name,
            status: prop.status,
            totalBookings: propBookings.length,
            confirmedBookings: confirmed.length,
            cancelledBookings: cancelled.length,
            cancellationRate: propBookings.length > 0 ? Math.round((cancelled.length / propBookings.length) * 100) : 0,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            avgBookingDuration: avgDuration,
            totalBeds, occupiedBeds,
            occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
            avgRating: Math.round(avgRating * 10) / 10,
            reviewCount: (prop as any).reviews.length,
        });
    }
    return results;
}

// ─────────────────────────────────────────────────────────────────────────────
//  BED MAINTENANCE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
export async function markBedMaintenance(bedId: string, reason: string) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const updated = await (prisma as any).bed.update({
        where: { id: bedId },
        data: { status: 'MAINTENANCE', maintenanceReason: reason, maintenanceSince: new Date() }
    });
    revalidatePath('/dashboard/owner/rooms');
    return updated;
}

export async function clearBedMaintenance(bedId: string) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const updated = await (prisma as any).bed.update({
        where: { id: bedId },
        data: { status: 'AVAILABLE', maintenanceReason: null, maintenanceSince: null }
    });
    revalidatePath('/dashboard/owner/rooms');
    return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
//  REFUND MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
export async function initiateRefund(data: {
    bookingId: string;
    amount: number;
    reason: string;
    refundType: 'FULL' | 'PARTIAL' | 'NONE';
}) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const refund = await (prisma as any).refundRecord.create({
        data: {
            bookingId: data.bookingId,
            amount: data.amount,
            reason: data.reason,
            refundType: data.refundType,
            initiatedBy: session.role,
            status: 'PENDING',
        }
    });

    // Notify admin
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    for (const admin of admins) {
        await createNotification(admin.id, 'PAYMENT', `Refund of ₹${data.amount} requested for booking ${data.bookingId}. Reason: ${data.reason}`);
    }

    await prisma.auditLog.create({
        data: {
            action: 'REFUND_INITIATED',
            targetId: data.bookingId,
            targetType: 'BOOKING',
            details: `₹${data.amount} ${data.refundType} refund. Reason: ${data.reason}`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/owner/payments');
    revalidatePath('/dashboard/admin');
    return refund;
}

export async function getOwnerRefunds() {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const propIds = (await prisma.property.findMany({ where: { ownerId: (session as any).userId }, select: { id: true } })).map(p => p.id);
    const bookingIds = (await prisma.booking.findMany({ where: { propertyId: { in: propIds } }, select: { id: true } })).map(b => b.id);

    return (prisma as any).refundRecord.findMany({
        where: { bookingId: { in: bookingIds } },
        orderBy: { createdAt: 'desc' }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
//  OWNER PROFILE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
export async function getOwnerProfile() {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const user = await prisma.user.findUnique({
        where: { id: (session as any).userId },
        select: {
            id: true, name: true, email: true, phone: true, displayId: true,
            status: true, createdAt: true, lastLoginAt: true,
            profilePhoto: true, businessName: true, notifPrefs: true,
        } as any
    });

    const onboarding = await (prisma as any).ownerOnboarding.findFirst({
        where: { userId: (session as any).userId },
        orderBy: { createdAt: 'desc' },
        select: { status: true, kycStatus: true, createdAt: true }
    });

    return {
        ...user,
        notifPrefs: (() => { try { return JSON.parse((user as any).notifPrefs || '{}'); } catch { return {}; } })(),
        verificationStatus: onboarding?.kycStatus || 'NOT_STARTED',
        onboardingStatus: onboarding?.status || 'NOT_STARTED',
    };
}

export async function updateOwnerProfile(data: {
    name?: string;
    phone?: string;
    businessName?: string;
    profilePhoto?: string;
}) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    await (prisma as any).user.update({
        where: { id: (session as any).userId },
        data: { name: data.name?.trim(), phone: data.phone?.trim(), businessName: data.businessName?.trim(), profilePhoto: data.profilePhoto }
    });

    revalidatePath('/dashboard/owner/settings');
    return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
//  FINANCIAL REPORT (exportable data)
// ─────────────────────────────────────────────────────────────────────────────
export async function getOwnerFinancialReport(fromDate?: Date, toDate?: Date) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");
    const ownerId = (session as any).userId;

    const from = fromDate || new Date(new Date().setMonth(new Date().getMonth() - 12));
    const to = toDate || new Date();

    const propertyIds = (await prisma.property.findMany({ where: { ownerId }, select: { id: true, name: true } }));
    const propIdList = propertyIds.map(p => p.id);

    const bookings = await prisma.booking.findMany({
        where: { propertyId: { in: propIdList }, createdAt: { gte: from, lte: to } },
        select: { id: true, displayId: true, propertyName: true, roomType: true, amount: true, status: true, createdAt: true, cancelReason: true }
    });

    const bookingIds = bookings.map(b => b.id);
    const refunds = await (prisma as any).refundRecord.findMany({ where: { bookingId: { in: bookingIds } } });

    const report = bookings.map((b: any) => {
        const refund = refunds.find((r: any) => r.bookingId === b.id);
        const isRevenue = ['BOOKING_CONFIRMED','CHECKED_IN','PAID','CASH_PAID'].includes(b.status);
        const gross = isRevenue ? parseFloat(b.amount || '0') : 0;
        const refundAmount = refund?.status === 'PROCESSED' ? refund.amount : 0;
        return {
            bookingId: b.displayId, property: b.propertyName, roomType: b.roomType,
            amount: b.amount, status: b.status, date: b.createdAt,
            revenueContribution: gross, refundAmount, netRevenue: gross - refundAmount
        };
    });

    const summary = {
        totalBookings: bookings.length,
        confirmedBookings: bookings.filter((b: any) => ['BOOKING_CONFIRMED','CHECKED_IN','PAID','CASH_PAID'].includes(b.status)).length,
        cancelledBookings: bookings.filter((b: any) => b.status === 'CANCELLED').length,
        totalGross: report.reduce((s: number, r: any) => s + r.revenueContribution, 0),
        totalRefunds: report.reduce((s: number, r: any) => s + r.refundAmount, 0),
        totalNet: report.reduce((s: number, r: any) => s + r.netRevenue, 0),
    };

    return { report, summary, generatedAt: new Date() };
}
