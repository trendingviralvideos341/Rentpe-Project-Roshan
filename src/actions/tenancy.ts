'use server';

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { NotificationService } from "@/lib/notifications";
import { generateMasterId } from "@/lib/ids";

// ─── VACATING NOTICE ACTIONS ─────────────────────────────

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

    // Notify owner — flag if tenant is requesting early move-out
    const earlyLeaveNote = data.tenantComment?.trim()
        ? ` ⚠️ Tenant has also requested an early move-out: "${data.tenantComment.trim()}"`
        : '';
    await prisma.notification.create({
        data: {
            userId: booking.property!.ownerId,
            type: 'VACATING_NOTICE',
            category: 'NOTICE',
            message: `📋 ${booking.guestName} has filed a vacating notice for ${booking.propertyName}. Planned move-out: ${moveOut.toLocaleDateString('en-IN')}.${earlyLeaveNote}`,
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
            message: `✅ Your vacating notice (${notice.displayId}) has been acknowledged by the owner.${ownerNote ? ` Note: ${ownerNote}` : ''}`,
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

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { employeeProfile: true } });
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

// ─── getTenantForSettlement ──────────────────────────────────────────────────
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
            booking:        { select: { displayId: true } },
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
        startDate:       tenant.startDate,
        status:          tenant.status,
    };
}


