'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/actions/notifications";
import { logAuditEvent } from "@/lib/audit";
import { TENANT_STATUS } from "@/lib/constants/statuses";

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

    // Bookings & Tenant Lifecycle
    const [pendingRequests, activeBookings, upcomingMoveIns, activeTenants, scheduledMoveOuts] = await Promise.all([
        prisma.booking.count({ where: { propertyId: { in: propertyIds }, status: 'PENDING_APPROVAL' } }),
        prisma.booking.count({ where: { propertyId: { in: propertyIds }, status: { in: ['BOOKING_CONFIRMED', 'CHECKED_IN', 'ROOM_RESERVED', 'KYC_PENDING'] } } }),
        (prisma.tenant as any).count({ where: { propertyId: { in: propertyIds }, status: TENANT_STATUS.UPCOMING } }),
        (prisma.tenant as any).count({ where: { propertyId: { in: propertyIds }, status: TENANT_STATUS.ACTIVE } }),
        // Scheduled move-outs = active vacating notices not yet withdrawn
        prisma.vacatingNotice.count({ where: { booking: { propertyId: { in: propertyIds } }, status: { not: 'WITHDRAWN' }, deletedAt: null } }),
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

    // ── FINANCIAL AGGREGATES ──
    const [unpaidInvoices, depositsHeld] = await Promise.all([
        (prisma as any).rentInvoice.findMany({
            where: { propertyId: { in: propertyIds }, status: { not: 'PAID' } },
            select: { amount: true, paidAmount: true }
        }),
        (prisma as any).securityDeposit.findMany({
            where: { billingProfile: { propertyId: { in: propertyIds } }, status: 'PAID' },
            select: { amount: true, refundAmount: true }
        })
    ]);

    const totalOutstandingRent = (unpaidInvoices as any[]).reduce((sum, inv) => sum + (inv.amount - (inv.paidAmount || 0)), 0);
    // Net deposits held = collected amount minus any refunds already returned to tenants
    const totalDepositsHeld = (depositsHeld as any[]).reduce(
        (sum, dep) => sum + Math.max(0, dep.amount - (dep.refundAmount || 0)), 0
    );

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
        upcomingMoveIns,
        activeTenants,
        scheduledMoveOuts,
        monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
        totalOutstandingRent,
        totalDepositsHeld,
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
        monthlyMap[key].gross += (b as any).amount || 0;
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
        const gross = propBookings.reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
        const propRefunds = refunds.filter((r: any) => propBookings.find((b: any) => b.id === r.bookingId)).reduce((sum: number, r: any) => sum + r.amount, 0);
        return { propertyId: p.id, propertyName: p.name, gross, refunds: propRefunds, net: Math.round((gross - propRefunds) * 100) / 100, bookings: propBookings.length };
    });

    // Totals
    const lifetimeGross = confirmedBookings.reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
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

    const properties = await prisma.property.findMany({ where: { ownerId }, include: { rooms: { include: { beds: true } }, reviews: true } as any });

    const results = [];
    for (const prop of properties) {
        const stats = await prisma.$transaction([
            prisma.booking.count({ where: { propertyId: prop.id, status: { in: ['BOOKING_CONFIRMED', 'CHECKED_IN', 'PAID', 'CASH_PAID', 'CANCELLED'] } } }),
            prisma.booking.count({ where: { propertyId: prop.id, status: { in: ['BOOKING_CONFIRMED', 'CHECKED_IN', 'PAID', 'CASH_PAID'] } } }),
            prisma.booking.count({ where: { propertyId: prop.id, status: 'CANCELLED' } }),
            prisma.booking.aggregate({
                where: { propertyId: prop.id, status: { in: ['BOOKING_CONFIRMED', 'CHECKED_IN', 'PAID', 'CASH_PAID'] } },
                _sum: { amount: true }
            })
        ]);

        const totalBookings = stats[0];
        const confirmedCount = stats[1];
        const cancelledCount = stats[2];
        const totalRevenue = (stats[3] as any)._sum.amount || 0;

        // Avg Rating
        const reviews = await (prisma as any).review.findMany({ where: { propertyId: prop.id } });
        const avgRating = reviews.length > 0 ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length : 0;

        // Beds
        const beds = (prop as any).rooms.flatMap((r: any) => r.beds);
        const totalBeds = beds.length;
        const occupiedBeds = beds.filter((b: any) => b.status === 'OCCUPIED').length;

        results.push({
            propertyId: prop.id,
            propertyName: prop.name,
            status: prop.status,
            totalBookings,
            confirmedBookings: confirmedCount,
            cancelledBookings: cancelledCount,
            cancellationRate: totalBookings > 0 ? Math.round((cancelledCount / totalBookings) * 100) : 0,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            avgRating: Math.round(avgRating * 10) / 10,
            totalBeds, occupiedBeds,
            occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
            reviewCount: reviews.length,
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

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'OWNER',
        actorName: (session as any).name || 'Owner',
        actionType: 'CREATE',
        entityType: 'BOOKING',
        entityId: data.bookingId,
        description: `₹${data.amount} ${data.refundType} refund. Reason: ${data.reason}`,
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
    businessName?: string;
    profilePhoto?: string;
}) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    await (prisma as any).user.update({
        where: { id: (session as any).userId },
        data: { businessName: data.businessName?.trim(), profilePhoto: data.profilePhoto }
    });

    revalidatePath('/dashboard/owner/settings');
    return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
//  FINANCIAL REPORT (exportable data)
// ─────────────────────────────────────────────────────────────────────────────
export async function getOwnerFinancialReport(fromDate?: Date, toDate?: Date) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    let ownerId: string;
    if (session.role === 'OWNER') {
        ownerId = (session as any).userId;
    } else if (session.role === 'STAFF') {
        const staffUser = await prisma.user.findUnique({
            where: { id: (session as any).userId },
            select: { parentOwnerId: true, staffPermissions: true }
        });
        if (!staffUser || !staffUser.parentOwnerId) throw new Error('Unauthorized');
        let permissions: string[] = [];
        try { permissions = JSON.parse(staffUser.staffPermissions || '[]'); } catch { permissions = []; }
        if (!permissions.includes('view_financials')) {
            throw new Error('You do not have permission to view financial statements.');
        }
        ownerId = staffUser.parentOwnerId;
    } else {
        throw new Error('Unauthorized');
    }

    const from = fromDate || new Date(new Date().setMonth(new Date().getMonth() - 12));
    const to = toDate || new Date();

    const propertyList = await prisma.property.findMany({ where: { ownerId }, select: { id: true, name: true } });
    const propIdList = propertyList.map(p => p.id);

    const owner = await prisma.user.findUnique({
        where: { id: ownerId },
        select: { name: true, businessName: true, displayId: true }
    });

    const bookings = await prisma.booking.findMany({
        where: { propertyId: { in: propIdList }, createdAt: { gte: from, lte: to } },
        select: {
            id: true, displayId: true, propertyName: true, propertyId: true,
            amount: true, status: true, createdAt: true, cancelReason: true, occupancy: true,
            room: { select: { type: true } },
            user: { select: { name: true } },
            tenant: { select: { displayId: true } }
        }
    });

    const bookingIds = bookings.map((b: any) => b.id);
    const [refunds, platformFees, payments] = await Promise.all([
        (prisma as any).refundRecord.findMany({ where: { bookingId: { in: bookingIds } } }),
        (prisma as any).platformFee.findMany({ where: { bookingId: { in: bookingIds } } }),
        (prisma as any).payment.findMany({
            where: { bookingId: { in: bookingIds }, status: { in: ['SUCCESS', 'VERIFIED', 'CAPTURED'] } },
            select: { bookingId: true, razorpayOrderId: true, razorpayId: true, method: true, depositId: true, amount: true }
        }),
    ]);

    const feeMap: Record<string, any> = {};
    for (const f of platformFees) feeMap[f.bookingId] = f;
    const payMap: Record<string, any> = {};
    for (const p of payments) payMap[p.bookingId] = p;

    // TDS exemption status
    const exemption = await (prisma as any).feeExemption.findFirst({
        where: { OR: [{ userId: ownerId }, { propertyId: { in: propIdList } }], status: 'ACTIVE', exemptTds: true },
        orderBy: { createdAt: 'desc' }
    });

    const report = bookings.map((b: any) => {
        const refund = refunds.find((r: any) => r.bookingId === b.id);
        const fee = feeMap[b.id] || {};
        
        const bPayments = payments.filter((p: any) => p.bookingId === b.id);
        const pay = bPayments[0] || {};
        let depositAmount = 0;
        let rentAmount = 0;
        for (const p of bPayments) {
            if (p.depositId) depositAmount += p.amount;
            else rentAmount += p.amount;
        }

        const isRevenue = ['BOOKING_CONFIRMED', 'CHECKED_IN', 'PAID', 'CASH_PAID', 'ACTIVE'].includes(b.status);
        const gross = isRevenue ? (b.amount || 0) : 0;
        const refundAmount = refund?.status === 'PROCESSED' ? refund.amount : 0;
        
        // If no explicit payment found, fallback to total gross logic
        if (rentAmount === 0 && depositAmount === 0) {
            rentAmount = gross;
        }

        return {
            bookingId: b.displayId,
            internalBookingId: b.id,
            tenantName: b.user?.name || 'N/A',
            tenantId: b.tenant?.displayId || '—',
            property: b.propertyName,
            roomType: b.room?.type || b.occupancy || '—',
            amount: b.amount,
            status: b.status,
            date: b.createdAt,
            razorpayOrderId: pay.razorpayOrderId || '—',
            razorpayPaymentId: pay.razorpayId || '—',
            razorpayTransferId: pay.razorpayTransferId || '—',
            paymentMethod: pay.method || '—',
            revenueContribution: gross,
            rentAmount: isRevenue ? rentAmount : 0,
            depositAmount: isRevenue ? depositAmount : 0,
            refundAmount,
            netRevenue: gross - refundAmount,
            // === Tax Breakdown (Owner commission and GST only) ===
            platformFeeCharged: fee.ownerFee || 0,
            gstCharged: fee.gstOnOwnerFee || 0,
            tdsDeducted: fee.tdsAmount || 0,
            ownerNetPayout: fee.ownerNet || 0,
            type: 'RENT_COLLECTION',
        };
    });

    // Fetch property onboarding fees paid by this owner in this period
    const onboardingPaidProperties = await prisma.property.findMany({
        where: {
            ownerId,
            onboardingPaidAt: { gte: from, lte: to }
        },
        select: {
            id: true,
            displayId: true,
            name: true,
            onboardingPaidAt: true,
            onboardingRazorpayOrderId: true,
            onboardingRazorpayId: true,
        }
    });

    const onboardingRows = onboardingPaidProperties.map((p: any) => {
        const cgst = 7.55;
        const sgst = 7.55;
        const baseAmount = 83.90;
        const onboardingFeeAmount = 99;
        return {
            bookingId: `ONB-${p.displayId || p.id.slice(0, 6).toUpperCase()}`,
            internalBookingId: p.id,
            tenantName: "RentPe Platform",
            property: p.name,
            roomType: "Property Onboarding",
            amount: onboardingFeeAmount,
            status: "PAID",
            date: p.onboardingPaidAt!,
            razorpayOrderId: p.onboardingRazorpayOrderId || '—',
            razorpayPaymentId: p.onboardingRazorpayId || '—',
            razorpayTransferId: '—',
            paymentMethod: 'Razorpay',
            revenueContribution: 0,
            rentAmount: 0,
            depositAmount: 0,
            refundAmount: 0,
            netRevenue: 0,
            platformFeeCharged: baseAmount,
            gstCharged: cgst + sgst,
            tdsDeducted: 0,
            ownerNetPayout: -onboardingFeeAmount,
            type: 'PROPERTY_ONBOARDING',
            tenantId: '—',
        };
    });

    const combinedReport = [...report, ...onboardingRows].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const revenueRows = report.filter((r: any) => ['BOOKING_CONFIRMED', 'CHECKED_IN', 'PAID', 'CASH_PAID'].includes(r.status));

    const totalOnboardingPaid = onboardingRows.reduce((s: number, r: any) => s + r.amount, 0);
    const totalOnboardingGst = onboardingRows.reduce((s: number, r: any) => s + r.gstCharged, 0);
    const totalOnboardingBase = onboardingRows.reduce((s: number, r: any) => s + r.platformFeeCharged, 0);

    const summary = {
        ownerName: owner?.name || 'Owner',
        businessName: (owner as any)?.businessName || 'RentPe Property Partner',
        ownerId: owner?.displayId,
        totalBookings: bookings.length,
        confirmedBookings: revenueRows.length,
        cancelledBookings: bookings.filter((b: any) => b.status === 'CANCELLED').length,
        totalGross: revenueRows.reduce((s: number, r: any) => s + r.revenueContribution, 0),
        totalRefunds: report.reduce((s: number, r: any) => s + r.refundAmount, 0),
        totalNet: revenueRows.reduce((s: number, r: any) => s + r.netRevenue, 0),
        // === NEW TAX FIELDS ===
        totalPlatformFeeCharged: revenueRows.reduce((s: number, r: any) => s + r.platformFeeCharged, 0),
        totalGstCharged: revenueRows.reduce((s: number, r: any) => s + r.gstCharged, 0),
        totalTdsDeducted: revenueRows.reduce((s: number, r: any) => s + r.tdsDeducted, 0),
        totalOwnerNetPayout: revenueRows.reduce((s: number, r: any) => s + r.ownerNetPayout, 0),
        tdsExempt: !!exemption,
        tdsExemptionReason: exemption?.tdsExemptionReason || null,
        tdsCertificateUrl: exemption?.tdsCertificateUrl || null,
        // === ONBOARDING SPECIFIC SUMMARY ===
        totalOnboardingPaid,
        totalOnboardingGst,
        totalOnboardingBase,
    };

    return { report: combinedReport, summary, generatedAt: new Date() };
}

// ── Owner: Monthly GST + TDS breakdown for tax summary page ──
export async function getOwnerMonthlyTaxBreakdown(fromDate?: Date, toDate?: Date) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    let ownerId: string;
    if (session.role === 'OWNER') {
        ownerId = (session as any).userId;
    } else if (session.role === 'STAFF') {
        const staffUser = await prisma.user.findUnique({
            where: { id: (session as any).userId },
            select: { parentOwnerId: true, staffPermissions: true }
        });
        if (!staffUser || !staffUser.parentOwnerId) throw new Error('Unauthorized');
        let permissions: string[] = [];
        try { permissions = JSON.parse(staffUser.staffPermissions || '[]'); } catch { permissions = []; }
        if (!permissions.includes('view_financials')) {
            throw new Error('You do not have permission to view financial statements.');
        }
        ownerId = staffUser.parentOwnerId;
    } else {
        throw new Error('Unauthorized');
    }

    const from = fromDate || new Date(new Date().getFullYear(), 3, 1);
    const to = toDate || new Date();

    const propIdList = (await prisma.property.findMany({ where: { ownerId }, select: { id: true } })).map(p => p.id);
    const bookingIds = (await prisma.booking.findMany({
        where: { propertyId: { in: propIdList }, status: { in: ['BOOKING_CONFIRMED', 'CHECKED_IN', 'PAID', 'CASH_PAID', 'ACTIVE', 'VERIFIED'] }, createdAt: { gte: from, lte: to } },
        select: { id: true, createdAt: true }
    }));

    const fees = await (prisma as any).platformFee.findMany({
        where: { bookingId: { in: bookingIds.map(b => b.id) }, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' }
    });

    const onboardingPaid = await prisma.property.findMany({
        where: {
            ownerId,
            onboardingPaidAt: { gte: from, lte: to }
        },
        select: {
            onboardingPaidAt: true,
        }
    });

    const bookingDateMap: Record<string, Date> = {};
    for (const b of bookingIds) bookingDateMap[b.id] = b.createdAt;

    const monthlyMap: Record<string, any> = {};

    // Fetch payments to resolve rent vs deposit breakdown
    const payments = await prisma.payment.findMany({
        where: { bookingId: { in: bookingIds.map(b => b.id) }, status: { in: ['SUCCESS', 'VERIFIED', 'CAPTURED'] } },
        select: { bookingId: true, amount: true, depositId: true }
    });
    
    const paymentMap: Record<string, any[]> = {};
    for (const p of payments) {
        if (!paymentMap[p.bookingId]) paymentMap[p.bookingId] = [];
        paymentMap[p.bookingId].push(p);
    }

    for (const f of fees) {
        const d = new Date(f.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
        if (!monthlyMap[key]) monthlyMap[key] = { month: label, key, grossRent: 0, rentAmount: 0, depositAmount: 0, platformFee: 0, gst: 0, tds: 0, netPayout: 0, transactions: 0, onboardingFees: 0, onboardingGst: 0 };
        
        let bDeposit = 0;
        let bRent = 0;
        const bPayments = paymentMap[f.bookingId] || [];
        for (const p of bPayments) {
            if (p.depositId) bDeposit += p.amount;
            else bRent += p.amount;
        }
        if (bRent === 0 && bDeposit === 0) bRent = f.grossAmount || 0; // fallback

        monthlyMap[key].grossRent += f.grossAmount || 0;
        monthlyMap[key].rentAmount += bRent;
        monthlyMap[key].depositAmount += bDeposit;
        monthlyMap[key].platformFee += f.ownerFee || 0;
        monthlyMap[key].gst += f.gstOnOwnerFee || 0;
        monthlyMap[key].tds += f.tdsAmount || 0;
        monthlyMap[key].netPayout += f.ownerNet || 0;
        monthlyMap[key].transactions++;
    }

    for (const p of onboardingPaid) {
        const d = new Date(p.onboardingPaidAt!);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
        if (!monthlyMap[key]) monthlyMap[key] = { month: label, key, grossRent: 0, platformFee: 0, gst: 0, tds: 0, netPayout: 0, transactions: 0, onboardingFees: 0, onboardingGst: 0 };
        if (monthlyMap[key].onboardingFees === undefined) {
            monthlyMap[key].onboardingFees = 0;
            monthlyMap[key].onboardingGst = 0;
        }
        monthlyMap[key].onboardingFees += 99;
        monthlyMap[key].onboardingGst += 15.10;
        // Onboarding fees are paid separately, not deducted from net payouts

    }

    return Object.values(monthlyMap).sort((a: any, b: any) => a.key.localeCompare(b.key));
}
