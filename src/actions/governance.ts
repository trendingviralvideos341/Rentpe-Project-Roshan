'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/actions/notifications";

// ─────────────────────────────────────────────────────────────────────────────
//  DISPUTE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export async function raiseDispute(data: {
    tenantId: string;
    bookingId?: string;
    type: string; // REFUND | DAMAGE | FRAUD | KYC | OTHER
    subject: string;
    description: string;
    priority?: string;
    evidenceData?: string;
    evidenceName?: string;
}) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const userId = (session as any).userId;

    const displayId = `DISP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const dispute = await (prisma.dispute as any).create({
        data: {
            ...data,
            displayId,
            raisedById: userId,
            raisedByRole: session.role,
            status: 'OPEN',
            priority: data.priority || 'MEDIUM'
        }
    });

    // Notify Super Admin / Support
    await createNotification('system-admin', 'ADMIN_ALERT', `A new ${data.type} dispute (${displayId}) has been raised regarding ${data.subject}.`);

    revalidatePath('/dashboard/support/disputes');
    return dispute;
}

export async function resolveDispute(disputeId: string, resolution: string, adminNotes?: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Only Admins can resolve disputes");
    const adminId = (session as any).userId;

    const dispute = await (prisma.dispute as any).update({
        where: { id: disputeId },
        data: {
            status: 'RESOLVED',
            resolution,
            adminNotes,
            resolvedById: adminId,
            resolvedAt: new Date()
        }
    });

    // Notify the person who raised it
    await createNotification(dispute.raisedById, 'INFO', `Your dispute (${dispute.displayId}) has been resolved. Outcome: ${resolution}`);

    revalidatePath('/dashboard/admin/disputes');
    return dispute;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SYSTEM EVENTS & SECURITY LOGGING
// ─────────────────────────────────────────────────────────────────────────────

export async function logSystemEvent(data: {
    type: string;
    severity: string;
    message: string;
    userId?: string;
    ipAddress?: string;
    path?: string;
    metadata?: any;
}) {
    return await (prisma.systemEvent as any).create({
        data: {
            ...data,
            metadata: data.metadata ? JSON.stringify(data.metadata) : "{}"
        }
    });
}

export async function createFraudAlert(data: {
    userId: string;
    type: string;
    severity: string;
    targetId: string;
    targetType: string;
    description: string;
}) {
    const alert = await (prisma.fraudAlert as any).create({
        data: {
            ...data,
            status: 'OPEN'
        }
    });

    // High priority notification to admins
    if (data.severity === 'CRITICAL' || data.severity === 'HIGH') {
        await createNotification('all-admins', 'SECURITY_ALERT', `${data.type}: ${data.description}`);
    }

    return alert;
}

// ─────────────────────────────────────────────────────────────────────────────
//  OPERATIONS: ATTENDANCE & FOOD
// ─────────────────────────────────────────────────────────────────────────────

export async function markAttendance(data: {
    tenantId: string;
    propertyId: string;
    status: string; // PRESENT | ABSENT | LATE | LEAVE
    mealType?: string;
    date?: string;
}) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const date = data.date || new Date().toISOString().split('T')[0];

    return await (prisma.attendance as any).upsert({
        where: {
            // Need a unique constraint for lookup if upserting
            id: `${data.tenantId}-${date}-${data.mealType || 'GENERAL'}` 
        },
        create: {
            ...data,
            date
        },
        update: {
            status: data.status
        }
    });
}

export async function getAttendanceReport(tenantId: string, month: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    return await (prisma.attendance as any).findMany({
        where: {
            tenantId,
            date: { startsWith: month } // month = "2026-03"
        },
        orderBy: { date: 'desc' }
    });
}
