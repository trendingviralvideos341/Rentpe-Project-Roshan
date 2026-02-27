'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getTenants() {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");
    const userId = (session as any).userId;

    const tenants = await prisma.tenant.findMany({
        where: { property: { ownerId: userId } },
        include: {
            rentRecords: { orderBy: { createdAt: 'desc' } }
        },
        orderBy: { name: 'asc' }
    });

    // Attach action notes for each tenant
    const withNotes = await Promise.all(tenants.map(async (t) => {
        const notes = await prisma.actionNote.findMany({
            where: { targetId: t.id, targetType: 'TENANT' },
            orderBy: { timestamp: 'desc' }
        });
        return { ...t, actionNotes: notes };
    }));

    return withNotes;
}

export async function markRentAsPaid(recordId: string, note?: string) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const record = await prisma.rentRecord.update({
        where: { id: recordId },
        data: { paid: true, paidOn: today }
    });

    // Write action note if provided
    if (note?.trim()) {
        await prisma.actionNote.create({
            data: {
                targetId: record.tenantId,
                targetType: 'TENANT',
                action: 'PAYMENT_MARKED_PAID',
                reason: note.trim(),
                performedBy: (session as any).userId
            }
        });
    }

    await prisma.auditLog.create({
        data: {
            action: 'RENT_PAID',
            targetId: record.tenantId,
            targetType: 'TENANT',
            details: `Rent for ${record.month} marked as paid${note ? `. Note: ${note}` : ''}`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/owner/tenants');
    revalidatePath('/dashboard/owner/payments');
    return record;
}

export async function markRentAsUnpaid(recordId: string, note?: string) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const record = await prisma.rentRecord.update({
        where: { id: recordId },
        data: { paid: false, paidOn: null }
    });

    if (note?.trim()) {
        await prisma.actionNote.create({
            data: {
                targetId: record.tenantId,
                targetType: 'TENANT',
                action: 'PAYMENT_MARKED_UNPAID',
                reason: note.trim(),
                performedBy: (session as any).userId
            }
        });
    }

    await prisma.auditLog.create({
        data: {
            action: 'RENT_UNPAID',
            targetId: record.tenantId,
            targetType: 'TENANT',
            details: `Rent for ${record.month} reversed to Unpaid${note ? `. Note: ${note}` : ''}`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/owner/tenants');
    revalidatePath('/dashboard/owner/payments');
    return record;
}

export async function blockTenant(tenantId: string, note: string) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const timestamp = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    const tenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'VACATED', vacatedOn: timestamp }
    });

    await prisma.actionNote.create({
        data: {
            targetId: tenantId,
            targetType: 'TENANT',
            action: 'BLOCKED',
            reason: note,
            performedBy: (session as any).userId
        }
    });

    await prisma.auditLog.create({
        data: {
            action: 'TENANT_BLOCKED',
            targetId: tenantId,
            targetType: 'TENANT',
            details: `Blocked on ${timestamp}. Reason: ${note}`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/owner/tenants');
    return tenant;
}

export async function unblockTenant(tenantId: string, note: string) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const tenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'ACTIVE', vacatedOn: null }
    });

    await prisma.actionNote.create({
        data: {
            targetId: tenantId,
            targetType: 'TENANT',
            action: 'UNBLOCKED',
            reason: note,
            performedBy: (session as any).userId
        }
    });

    await prisma.auditLog.create({
        data: {
            action: 'TENANT_UNBLOCKED',
            targetId: tenantId,
            targetType: 'TENANT',
            details: `Unblocked. Reason: ${note}`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/owner/tenants');
    return tenant;
}

// Keep old names as aliases for backward compat
export const vacateTenant = blockTenant;
export async function unvacateTenant(tenantId: string) {
    return unblockTenant(tenantId, "Restored by owner");
}
