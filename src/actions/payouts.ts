'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { withSafeAction } from "@/lib/safe-action";
import { requirePermission } from "@/actions/rbac";
import { revalidateGlobalPayments, revalidateAdminDashboard } from "@/lib/cache";
import { logAuditEvent } from "@/lib/audit";
import { encryptIfPresent, decryptIfPresent, maskBankAccount } from "@/lib/crypto";

/**
 * Admin creates a payout batch for an owner
 */
export async function createPayoutBatch(data: {
    ownerId: string;
    propertyId?: string;
    period: string;
    grossAmount: number;
    commissionAmount: number;
    bookingIds: string[];
    scheduledFor?: Date;
    paymentMode?: string;
    notes?: string;
}) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_PAYOUTS');

    const netAmount = data.grossAmount - data.commissionAmount;

    // Get owner bank details from property if available
    const property = data.propertyId
        ? await prisma.property.findUnique({ where: { id: data.propertyId } })
        : null;

    const payout = await prisma.ownerPayout.create({
        data: {
            displayId: `PAY-${Math.floor(Math.random() * 900000) + 100000}`,
            ownerId: data.ownerId,
            propertyId: data.propertyId,
            period: data.period,
            grossAmount: data.grossAmount,
            commissionAmount: data.commissionAmount,
            netAmount,
            bookingIds: JSON.stringify(data.bookingIds),
            status: 'PENDING',
            paymentMode: data.paymentMode,
            scheduledFor: data.scheduledFor,
            // SECURITY FIX: Encrypt bank details before storing
            bankAccountNoEncrypted: encryptIfPresent((property as any)?.bankAccountNoEncrypted
                ? decryptIfPresent((property as any).bankAccountNoEncrypted)
                : null),
            bankIfscEncrypted: encryptIfPresent((property as any)?.bankIfscEncrypted
                ? decryptIfPresent((property as any).bankIfscEncrypted)
                : null),
            notes: data.notes,
        }
    });

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role ?? 'ADMIN',
        actorName: session.name || 'Admin',
        actionType: 'CREATE',
        entityType: 'PAYOUT',
        entityId: payout.id,
        description: `Payout ₹${netAmount} created for owner ${data.ownerId} — Period: ${data.period}`,
    });

     revalidateAdminDashboard();
    return payout;
}

/**
 * Admin approves a payout batch
 */
export async function approvePayoutBatch(payoutId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_PAYOUTS');

    const payout = await prisma.ownerPayout.update({
        where: { id: payoutId },
        data: { status: 'APPROVED', approvedBy: session.userId }
    });

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role ?? 'ADMIN',
        actorName: session.name || 'Admin',
        actionType: 'APPROVE',
        entityType: 'PAYOUT',
        entityId: payoutId,
        description: `Payout ${payout.displayId} approved. Net: ₹${payout.netAmount}`,
    });

     revalidateAdminDashboard();
    return payout;
}

/**
 * Admin marks payout as paid (after actual bank transfer)
 */
export async function markPayoutPaid(payoutId: string, txnReference: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_PAYOUTS');

    const payout = await prisma.ownerPayout.update({
        where: { id: payoutId },
        data: { status: 'PAID', txnReference, paidAt: new Date() }
    });

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role ?? 'ADMIN',
        actorName: session.name || 'Admin',
        actionType: 'UPDATE', // Marked as paid
        entityType: 'PAYOUT',
        entityId: payoutId,
        description: `Payout ${payout.displayId} marked PAID. Txn: ${txnReference}`,
    });

     revalidateAdminDashboard();
    return payout;
}

/**
 * Admin gets all payouts
 */
export async function getAllPayouts(status?: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('VIEW_REPORTS');

    return prisma.ownerPayout.findMany({
        where: status ? { status } : {},
        orderBy: { createdAt: 'desc' }
    });
}

/**
 * Owner gets their own payouts — bank account numbers masked for display
 */
export async function getMyPayouts() {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const payouts = await prisma.ownerPayout.findMany({
        where: { ownerId: session.userId },
        orderBy: { createdAt: 'desc' }
    });

    // Decrypt and mask bank account for display (owner can see last 4 digits only)
    return payouts.map(p => ({
        ...p,
        bankAccountDisplay: p.bankAccountNoEncrypted
            ? maskBankAccount(decryptIfPresent(p.bankAccountNoEncrypted) || '')
            : null,
        bankIfscDisplay: p.bankIfscEncrypted
            ? decryptIfPresent(p.bankIfscEncrypted)
            : null,
        // Never return encrypted raw values
        bankAccountNoEncrypted: undefined,
        bankIfscEncrypted: undefined,
    }));
}

/**
 * Calculate what an owner is owed for a given period
 * Uses per-owner commissionRate if set, otherwise platform default
 */
export async function calculateOwnerEarnings(ownerId: string, period: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_PAYOUTS');

    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });

    // Per-owner commission rate override
    const commissionRate = owner?.commissionRate ?? settings?.ownerRentFeeFlat ?? 9;

    const propertyIds = (await prisma.property.findMany({ where: { ownerId }, select: { id: true } })).map(p => p.id);

    const confirmedBookings = await prisma.booking.findMany({
        where: {
            propertyId: { in: propertyIds },
            status: { in: ['BOOKING_CONFIRMED', 'CHECKED_IN', 'CONFIRMED', 'PAID', 'CASH_PAID'] },
        },
        select: { id: true, amount: true, propertyName: true }
    });

    const grossAmount = confirmedBookings.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const commissionAmount = Math.round((grossAmount * commissionRate) / 100 * 100) / 100;
    const netAmount = grossAmount - commissionAmount;

    return {
        ownerId,
        period,
        bookingCount: confirmedBookings.length,
        bookingIds: confirmedBookings.map(b => b.id),
        grossAmount,
        commissionRate,
        commissionAmount,
        netAmount
    };
}
