'use server';

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { NotificationService } from "@/lib/notifications";
import { generateMasterId } from "@/lib/ids";

// â”€â”€â”€ VACATING NOTICE ACTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fileVacatingNotice(data: {
    bookingId: string;
    plannedMoveOut: string; // ISO date string
    reason: string;
    tenantComment?: string; // Optional early-leave request message to owner
}) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const userId = (session as any).userId;

    const booking = await prisma.booking.findUnique({
        where: { id: data.bookingId },
        include: { property: true }
    });

    if (!booking || booking.userId !== userId) throw new Error("Unauthorized - not your booking");
    if (!['ACTIVE', 'MOVE_IN_SCHEDULED'].includes(booking.status)) {
        throw new Error("Notice can only be filed for an active booking.");
    }

    // Enforce 30-day minimum notice period
    const moveOut = new Date(data.plannedMoveOut);
    const today = new Date();
    const daysDiff = Math.ceil((moveOut.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 30) throw new Error("Minimum 30-day notice period required.");

    // Check for existing active notice
    const existingNotice = await prisma.vacatingNotice.findFirst({
        where: { bookingId: data.bookingId, deletedAt: null, status: { not: 'WITHDRAWN' } }
    });
    if (existingNotice) throw new Error("An active notice already exists for this booking.");

    const displayId = await generateMasterId('NOTICE');
    const notice = await prisma.vacatingNotice.create({
        data: {
            displayId,
            bookingId: data.bookingId,
            userId,
            propertyId: booking.propertyId!,
            ownerId: booking.property!.ownerId,
            plannedMoveOut: moveOut,
            reason: data.reason,
            tenantComment: data.tenantComment?.trim() || null,
            status: 'SUBMITTED',
        }
    });

    // Notify owner â€” flag if tenant is requesting early move-out
    const earlyLeaveNote = data.tenantComment?.trim()
        ? ` âš ï¸ Tenant has also requested an early move-out: "${data.tenantComment.trim()}"`
        : '';
    await prisma.notification.create({
        data: {
            userId: booking.property!.ownerId,
            type: 'VACATING_NOTICE',
            category: 'NOTICE',
            message: `${booking.guestName} has filed a vacating notice for ${booking.propertyName}. Planned move-out: ${moveOut.toLocaleDateString('en-IN')}.${earlyLeaveNote}`,
            isPersistent: true,
            metadata: JSON.stringify({ noticeId: notice.id, bookingId: data.bookingId }),
        }
    });

    logAuditEvent({
        actorId: userId,
        actorRole: 'USER',
        actorName: booking.guestName,
        actionType: 'CREATE',
        entityType: 'VACATING_NOTICE',
        entityId: notice.id,
        description: `Vacating notice filed. Planned move-out: ${moveOut.toLocaleDateString('en-IN')}`,
        newValue: { reason: data.reason, plannedMoveOut: data.plannedMoveOut, tenantComment: data.tenantComment }
    });

    revalidatePath('/dashboard/student/notice');
    return notice;
}

export async function withdrawVacatingNotice(noticeId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const userId = (session as any).userId;

    const notice = await prisma.vacatingNotice.findUnique({ where: { id: noticeId } });
    if (!notice || notice.userId !== userId) throw new Error("Unauthorized");
    if (notice.status !== 'SUBMITTED') throw new Error("Only SUBMITTED notices can be withdrawn.");

    // Cannot withdraw within 7 days of planned move-out
    const daysToMoveOut = Math.ceil((notice.plannedMoveOut.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysToMoveOut <= 7) throw new Error("Cannot withdraw notice within 7 days of planned move-out.");

    const updated = await prisma.vacatingNotice.update({
        where: { id: noticeId },
        data: { status: 'WITHDRAWN', deletedAt: new Date() }
    });

    logAuditEvent({
        actorId: userId,
        actorRole: 'USER',
        actorName: 'Tenant',
        actionType: 'UPDATE',
        entityType: 'VACATING_NOTICE',
        entityId: noticeId,
        description: 'Vacating notice withdrawn by tenant.',
    });

    revalidatePath('/dashboard/student/notice');
    return updated;
}

export async function acknowledgeVacatingNotice(noticeId: string, ownerNote?: string, approvedMoveOutDate?: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const actorId = (session as any).userId;

    const notice = await prisma.vacatingNotice.findUnique({
        where: { id: noticeId },
        include: { booking: true }
    });
    if (!notice) throw new Error("Notice not found");

    // Only the property owner or authorized staff can acknowledge
    const user = await prisma.user.findUnique({ where: { id: actorId } });
    const isOwner = notice.ownerId === actorId || user?.parentOwnerId === notice.ownerId;
    const isAdmin = ['ADMIN', 'STAFF'].includes((session as any).role);
    if (!isOwner && !isAdmin) throw new Error("Unauthorized");

    const updateData: Prisma.VacatingNoticeUpdateInput = {
        status: 'ACKNOWLEDGED',
        ownerNote: ownerNote || null,
        acknowledgedAt: new Date(),
        ...(approvedMoveOutDate ? { plannedMoveOut: new Date(approvedMoveOutDate) } : {}),
    };

    const updated = await prisma.vacatingNotice.update({
        where: { id: noticeId },
        data: updateData
    });

    // Notify student
    await prisma.notification.create({
        data: {
            userId: notice.userId,
            type: 'VACATING_NOTICE_ACKNOWLEDGED',
            category: 'NOTICE',
            message: `Your vacating notice (${notice.displayId}) has been acknowledged by the owner.${ownerNote ? ` Note: ${ownerNote}` : ''}`,
            isPersistent: true,
        }
    });

    logAuditEvent({
        actorId,
        actorRole: (session as any).role || 'OWNER',
        actorName: user?.name || 'Owner',
        actionType: 'UPDATE',
        entityType: 'VACATING_NOTICE',
        entityId: noticeId,
        description: `Vacating notice acknowledged. Note: ${ownerNote || 'None'}`,
    });

    revalidatePath('/dashboard/owner/notices');
    return updated;
}

export async function getMyVacatingNotice(bookingId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const userId = (session as any).userId;
    return await prisma.vacatingNotice.findFirst({
        where: { bookingId, userId, deletedAt: null }
    });
}

export async function getOwnerVacatingNotices() {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const userId = (session as any).userId;

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { staffProfile: true } });
    const ownerId = user?.parentOwnerId || userId;

    return await prisma.vacatingNotice.findMany({
        where: { ownerId, deletedAt: null },
        include: { booking: { select: { guestName: true, propertyName: true, displayId: true } } },
        orderBy: { createdAt: 'desc' }
    });
}

export async function getPendingVacatingNoticesCount(): Promise<number> {
    const session = await getSession();
    if (!session) return 0;
    const userId = (session as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const ownerId = user?.parentOwnerId || userId;
    return await prisma.vacatingNotice.count({
        where: { ownerId, status: 'SUBMITTED', deletedAt: null }
    });
}

// â”€â”€â”€ getTenantForSettlement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Fetches full tenant data (rent, rentRecords, phone) from a bookingId so the
// SettlementModal can compute pro-rata and security-deposit figures.
export async function getTenantForSettlement(bookingId: string) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes((session as any).role)) {
        throw new Error('Unauthorized');
    }

    const tenant = await prisma.tenant.findFirst({
        where: { bookingId },
        include: {
            rentRecords:    { orderBy: { createdAt: 'asc' } },
            billingProfile: { include: { deposit: true } },
            booking:        { select: { displayId: true, agreementSignedAt: true } },
            bed:            { select: { bedNumber: true } },
        },
    });

    if (!tenant) throw new Error('Tenant record not found for this booking.');

    const rentAmount =
        typeof tenant.rent === 'number'
            ? tenant.rent
            : parseFloat(String(tenant.rent).replace(/[^0-9.]/g, '')) || 0;

    // Prefer actual security deposit from billing profile, fall back to 1-month rent
    const securityDeposit =
        Number(tenant.billingProfile?.deposit?.amount) ||
        Number(tenant.billingProfile?.securityDeposit) ||
        rentAmount;

    // Bed number: "103-A" style
    const bedNo = (tenant as any).bed?.bedNumber
        ? `${tenant.roomNumber}-${(tenant as any).bed.bedNumber}`
        : null;

    // Fetch the active vacating notice for display in settlement receipt
    const vacatingNotice = await prisma.vacatingNotice.findFirst({
        where:   { bookingId, status: { not: 'WITHDRAWN' } },
        select:  { displayId: true },
        orderBy: { createdAt: 'desc' },
    });

    return {
        id:              tenant.id,
        displayId:       tenant.displayId,
        noticeDisplayId: vacatingNotice?.displayId || null,
        name:            tenant.name,
        phone:           tenant.phone,
        roomNumber:      tenant.roomNumber,
        roomType:        tenant.roomType,
        roomId:          tenant.roomId,
        bedId:           tenant.bedId,
        bedNo,
        rentAmount,
        securityDeposit,
        rentRecords:     tenant.rentRecords,
        startDate:       tenant.booking?.agreementSignedAt 
            ? tenant.booking.agreementSignedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) 
            : tenant.startDate,
        status:          tenant.status,
    };
}

// â”€â”€â”€ getSettlementForNotice â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function getSettlementForNotice(bookingId: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const tenant = await prisma.tenant.findFirst({
        where: { bookingId },
        include: {
            rentRecords:    { orderBy: { createdAt: 'asc' } },
            billingProfile: { include: { deposit: true } },
            booking:        { select: { displayId: true, userId: true, agreementSignedAt: true } },
            bed:            { select: { bedNumber: true } },
            property:       { select: { name: true, address: true } },
            settlementRecord: true,
        },
    });

    if (!tenant) throw new Error('Settlement data not found.');

    const isStudent = (session as any).role === 'USER' || (session as any).role === 'STUDENT';
    if (isStudent && tenant.booking?.userId !== (session as any).userId) {
        throw new Error('Unauthorized');
    }

    const monthlyRent = typeof tenant.rent === 'number'
        ? tenant.rent
        : parseFloat(String(tenant.rent).replace(/[^0-9.]/g, '')) || 0;

    const securityDeposit =
        Number(tenant.billingProfile?.deposit?.amount) ||
        Number((tenant.billingProfile as any)?.securityDeposit) ||
        monthlyRent;

    const bedNo = (tenant as any).bed?.bedNumber
        ? `${tenant.roomNumber}-${(tenant as any).bed.bedNumber}`
        : null;

    const vacatingNotice = await prisma.vacatingNotice.findFirst({
        where:   { bookingId, status: { not: 'WITHDRAWN' } },
        select:  { displayId: true, plannedMoveOut: true },
        orderBy: { createdAt: 'desc' },
    });

    const sr = (tenant as any).settlementRecord;

    // â”€â”€ Pro-rata computation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const moveOutDate = tenant.actualMoveOutDate
        ? new Date(tenant.actualMoveOutDate)
        : vacatingNotice?.plannedMoveOut
            ? new Date(vacatingNotice.plannedMoveOut)
            : new Date();

    const moveOutDay  = moveOutDate.getDate();
    const daysInMonth = new Date(moveOutDate.getFullYear(), moveOutDate.getMonth() + 1, 0).getDate();
    const dailyRate   = Math.round(monthlyRent / daysInMonth);
    const proRataAmt  = dailyRate * moveOutDay;

    // â”€â”€ Unpaid rent records (itemized) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const unpaidRecords = ((tenant as any).rentRecords || [])
        .filter((r: any) => !r.paid)
        .map((r: any) => ({ month: r.month, amount: Number(r.amount), note: r.note || null }));

    // â”€â”€ Parse deduction items from notes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // confirmMoveOut saves notes in format: "Deductions: Broken AC â‚¹500, Wall damage â‚¹500 | Owner note"
    let deductionItems: { description: string; amount: number }[] = [];
    const noteText = sr?.notes || '';
    const dedMatch = noteText.match(/Deductions:\s*(.+?)(?:\s*\||\s*$)/i);
    if (dedMatch) {
        const parts = dedMatch[1].split(',').map((p: string) => p.trim());
        for (const part of parts) {
            const amtMatch = part.match(/₹?([\d,]+)\s*$/);
            if (amtMatch) {
                const amount = parseFloat(amtMatch[1].replace(/,/g, '')) || 0;
                const description = part.replace(/₹?[\d,]+\s*$/, '').trim();
                if (description) deductionItems.push({ description, amount });
            }
        }
    }
    // If no items parsed but total deductions exist, show as single line
    const totalDeductions = sr ? Number(sr.damageDeductions) : 0;
    if (deductionItems.length === 0 && totalDeductions > 0) {
        deductionItems = [{ description: 'Damage / Maintenance', amount: totalDeductions }];
    }

    const netRefund = securityDeposit - (sr ? Number(sr.finalRentPending) : 0) - totalDeductions;

    return {
        // IDs
        tenantId:          tenant.id,
        tenantDisplayId:   tenant.displayId,
        bookingDisplayId:  tenant.booking?.displayId || null,
        noticeDisplayId:   vacatingNotice?.displayId || null,
        // Personal
        name:              tenant.name,
        phone:             tenant.phone,
        // Property / room
        propertyName:      (tenant as any).property?.name || null,
        propertyAddress:   (tenant as any).property?.address || null,
        roomNumber:        tenant.roomNumber,
        roomType:          tenant.roomType,
        bedNo,
        // Dates
        moveOutDate:       moveOutDate.toISOString(),
        moveInDate:        tenant.booking?.agreementSignedAt 
            ? tenant.booking.agreementSignedAt.toISOString() 
            : (tenant.startDate ? new Date(tenant.startDate).toISOString() : null),
        // Pro-rata
        monthlyRent,
        moveOutDay,
        daysInMonth,
        dailyRate,
        proRataAmt,
        // Financial summary
        securityDeposit,
        unpaidRecords,
        totalRentDue:    sr ? Number(sr.finalRentPending) : 0,
        deductionItems,
        totalDeductions,
        netRefund,
        depositRefunded: sr ? Number(sr.depositRefunded) : 0,
        // Notes
        settlementNotes: noteText.split('|').slice(1).join('|').trim() || null,
    };
}


