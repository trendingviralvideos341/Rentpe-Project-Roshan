'use server';

/**
 * Fraud Admin Actions — Admin-only APIs for managing fraud flags,
 * linked accounts, and taking remediation actions.
 */

import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

async function ensureAdmin() {
    const session = await getSession();
    if (!session?.userId) throw new Error('Unauthorized');
    const user = await prisma.user.findUnique({
        where: { id: session.userId as string },
        select: { roles: true, role: true }
    });
    if (!user?.roles.includes('ADMIN') && user?.role !== 'ADMIN') throw new Error('Unauthorized');
    return session;
}

// ─── GET: All fraud flags (paginated) ─────────────────────────────────────────
export async function getFraudFlags(status?: string, take = 50) {
    await ensureAdmin();
    return (prisma as any).fraudFlag.findMany({
        where: status ? { status } : undefined,
        include: {
            user: { select: { id: true, name: true, email: true, displayId: true, phone: true } },
            booking: { select: { id: true, displayId: true, propertyName: true, amount: true } }
        },
        orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
        take
    });
}

// ─── GET: Linked accounts ──────────────────────────────────────────────────────
export async function getLinkedAccounts(take = 50) {
    await ensureAdmin();
    return (prisma as any).linkedAccount.findMany({
        include: {
            userA: { select: { id: true, name: true, email: true, displayId: true } },
            userB: { select: { id: true, name: true, email: true, displayId: true } }
        },
        orderBy: { confidenceScore: 'desc' },
        take
    });
}

// ─── POST: Resolve a fraud flag ────────────────────────────────────────────────
export async function resolveFraudFlag(flagId: string, resolution: string) {
    const session = await ensureAdmin();
    const flag = await (prisma as any).fraudFlag.update({
        where: { id: flagId },
        data: { status: 'RESOLVED', metadata: { resolution } }
    });
    await logAuditEvent({
        actorId: session.userId as string,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'FRAUD_FLAG',
        entityId: flagId,
        description: `Admin resolved fraud flag. Resolution: ${resolution}`
    });
    revalidatePath('/dashboard/admin/fraud');
    return flag;
}

// ─── POST: Block a user (freeze account + all payouts) ────────────────────────
export async function blockFraudUser(userId: string, reason: string) {
    const session = await ensureAdmin();

    await prisma.user.update({
        where: { id: userId },
        data: { status: 'BANNED', bannedReason: reason }
    });

    // Open all their bookings' fraud flags
    await (prisma as any).fraudFlag.updateMany({
        where: { userId, status: 'OPEN' },
        data: { status: 'REVIEWED' }
    });

    await logAuditEvent({
        actorId: session.userId as string,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'REJECT',
        entityType: 'USER',
        entityId: userId,
        description: `Fraud: Account blocked. Reason: ${reason}`
    });

    revalidatePath('/dashboard/admin/fraud');
    return { success: true };
}

// ─── POST: Freeze payouts for a user ──────────────────────────────────────────
export async function freezeUserPayouts(ownerId: string, reason: string) {
    const session = await ensureAdmin();

    // Create a HIGH-RISK flag that will block payouts (used by validatePayout())
    await (prisma as any).fraudFlag.create({
        data: {
            userId: ownerId,
            reason: 'PAYOUT_FROZEN_BY_ADMIN',
            riskScore: 71,
            status: 'OPEN',
            metadata: { reason, frozenBy: session.userId }
        }
    });

    await logAuditEvent({
        actorId: session.userId as string,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'USER',
        entityId: ownerId,
        description: `Fraud: Payouts frozen for owner. Reason: ${reason}`
    });

    revalidatePath('/dashboard/admin/fraud');
    return { success: true };
}

// ─── POST: Approve a flagged booking (admin override) ─────────────────────────
export async function approveFlaggedBooking(bookingId: string, note: string) {
    const session = await ensureAdmin();

    await prisma.booking.update({
        where: { id: bookingId },
        data: { fraudRiskScore: 0 } as any
    });

    // Resolve any open flags for this booking
    await (prisma as any).fraudFlag.updateMany({
        where: { bookingId, status: 'OPEN' },
        data: { status: 'RESOLVED', metadata: { approvedBy: (session as any).userId, note } }
    });

    await logAuditEvent({
        actorId: session.userId as string,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'APPROVE',
        entityType: 'BOOKING',
        entityId: bookingId,
        description: `Admin override: Approved flagged booking. Note: ${note}`
    });

    revalidatePath('/dashboard/admin/fraud');
    return { success: true };
}

// ─── GET: Fraud dashboard summary ─────────────────────────────────────────────
export async function getFraudSummary() {
    await ensureAdmin();

    const [openFlags, highRiskFlags, linkedAccounts, blockedBookings] = await Promise.all([
        (prisma as any).fraudFlag.count({ where: { status: 'OPEN' } }),
        (prisma as any).fraudFlag.count({ where: { status: 'OPEN', riskScore: { gte: 71 } } }),
        (prisma as any).linkedAccount.count(),
        prisma.booking.count({ where: { fraudRiskScore: { gte: 71 } } as any })
    ]);

    return { openFlags, highRiskFlags, linkedAccounts, blockedBookings };
}
