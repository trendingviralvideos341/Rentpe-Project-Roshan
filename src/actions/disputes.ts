'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/actions/notifications";

/**
 * Student or owner raises a dispute
 */
export async function raiseDispute(data: {
    bookingId?: string;
    type: 'REFUND' | 'DAMAGE' | 'FRAUD' | 'KYC' | 'OTHER';
    subject: string;
    description: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    evidenceData?: string;
    evidenceName?: string;
}) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    if (!data.subject?.trim() || !data.description?.trim()) throw new Error("Subject and description are required");

    const dispute = await (prisma as any).dispute.create({
        data: {
            displayId: `DIS-${Math.floor(Math.random() * 900000) + 100000}`,
            bookingId: data.bookingId,
            raisedById: (session as any).userId,
            raisedByRole: session.role,
            type: data.type,
            subject: data.subject,
            description: data.description,
            priority: data.priority || 'MEDIUM',
            evidenceData: data.evidenceData,
            evidenceName: data.evidenceName,
            status: 'OPEN',
        }
    });

    // Notify admin team
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    for (const admin of admins) {
        await createNotification(admin.id, 'TICKET', `New ${data.type} dispute raised: "${data.subject}" — Priority: ${data.priority || 'MEDIUM'}`);
    }

    await prisma.auditLog.create({
        data: {
            action: 'DISPUTE_RAISED',
            targetId: dispute.id,
            targetType: 'DISPUTE',
            details: `${data.type} dispute raised by ${session.role}: ${data.subject}`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/student');
    revalidatePath('/dashboard/owner');
    revalidatePath('/dashboard/admin/disputes');
    return dispute;
}

/**
 * Admin marks dispute as under review
 */
export async function reviewDispute(disputeId: string, adminNotes?: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const dispute = await (prisma as any).dispute.update({
        where: { id: disputeId },
        data: { status: 'UNDER_REVIEW', adminNotes }
    });

    await createNotification(dispute.raisedById, 'TICKET', `Your dispute "${dispute.subject}" is now under review by our team.`);

    revalidatePath('/dashboard/admin/disputes');
    return dispute;
}

/**
 * Admin resolves a dispute
 */
export async function resolveDispute(disputeId: string, resolution: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    if (!resolution?.trim()) throw new Error("Resolution is required");

    const dispute = await (prisma as any).dispute.update({
        where: { id: disputeId },
        data: {
            status: 'RESOLVED',
            resolution,
            resolvedById: (session as any).userId,
            resolvedAt: new Date()
        }
    });

    await createNotification(dispute.raisedById, 'TICKET', `Your dispute "${dispute.subject}" has been resolved: ${resolution}`);

    await prisma.auditLog.create({
        data: {
            action: 'DISPUTE_RESOLVED',
            targetId: disputeId,
            targetType: 'DISPUTE',
            details: `Dispute resolved. Resolution: ${resolution}`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/admin/disputes');
    return dispute;
}

/**
 * Close a dispute (no further action needed)
 */
export async function closeDispute(disputeId: string, notes?: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const dispute = await (prisma as any).dispute.update({
        where: { id: disputeId },
        data: { status: 'CLOSED', adminNotes: notes, resolvedAt: new Date(), resolvedById: (session as any).userId }
    });

    revalidatePath('/dashboard/admin/disputes');
    return dispute;
}

/**
 * Get all disputes (admin)
 */
export async function getAllDisputes(filters?: { status?: string; type?: string; priority?: string }) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.type) where.type = filters.type;
    if (filters?.priority) where.priority = filters.priority;

    return (prisma as any).dispute.findMany({ where, orderBy: { createdAt: 'desc' } });
}

/**
 * Get my disputes (student or owner)
 */
export async function getMyDisputes() {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    return (prisma as any).dispute.findMany({
        where: { raisedById: (session as any).userId },
        orderBy: { createdAt: 'desc' }
    });
}
