'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";

// ── Get or create the singleton settings row ──────────
export async function getPlatformSettings() {
    // Accessible to logged-in users to check fee rates
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    let settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    if (!settings) {
        settings = await prisma.platformSettings.create({
            data: { id: "singleton" }
        });
    }
    return settings;
}

// ── Update settings (admin only) ─────────────────────
export async function updatePlatformSettings(data: {
    feesEnabled?: boolean;
    studentRentFeeFlat?: number;
    ownerRentFeeFlat?: number;
    ownerOnboardingFeeFlat?: number;
    allowCashPayment?: boolean;
}) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const settings = await prisma.platformSettings.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", ...data },
        update: data,
    });

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'ADMIN',
        entityId: 'singleton',
        description: `Fees ${data.feesEnabled !== undefined ? (data.feesEnabled ? 'ENABLED' : 'DISABLED') : 'rates updated'}`,
    });

    revalidatePath('/dashboard/admin/platform-fees');
    return settings;
}

// ── Public: any logged-in user can check if cash payment is enabled ────────────
export async function getCashPaymentEnabled(): Promise<boolean> {
    const session = await getSession();
    if (!session) return false;
    const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
    return settings?.allowCashPayment ?? false;
}

// ── Internal: calculate fees for a given amount ───────
export async function calculateFees(amountStr: string, userId?: string, propertyName?: string, ownerId?: string): Promise<{
    feesEnabled: boolean;
    grossAmount: number;
    customerFee: number;
    totalCharged: number;
    ownerNet: number;
    ownerFee: number;
    platformEarned: number;
    commissionRate: number;
}> {
    const grossAmount = parseFloat(amountStr.replace(/[^0-9.]/g, "")) || 0;

    const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });

    if (!settings || !settings.feesEnabled) {
        return { feesEnabled: false, grossAmount, customerFee: 0, totalCharged: grossAmount, ownerNet: grossAmount, ownerFee: 0, platformEarned: 0, commissionRate: 0 };
    }

    // Check exemptions
    let exemptCustomer = false;
    let exemptOwner = false;
    if (userId || propertyName) {
        const exemptions = await (prisma as any).feeExemption.findMany({
            where: {
                OR: [
                    { userId: userId || undefined },
                    { propertyName: propertyName || undefined },
                    { userId: null, propertyName: null },
                ]
            }
        });
        for (const ex of exemptions) {
            if (ex.exemptCustomer) exemptCustomer = true;
            if (ex.exemptOwner) exemptOwner = true;
        }
    }

    // Customer fee: flat ₹9 (or 0 if exempt)
    const customerFee = exemptCustomer ? 0 : settings.studentRentFeeFlat;
    const totalCharged = grossAmount + customerFee;

    // Per-owner commission override — check owner's commissionRate first
    let commissionRate = settings.ownerRentFeeFlat; // default flat fee
    if (ownerId) {
        const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { commissionRate: true } as any });
        if (owner && (owner as any).commissionRate != null) {
            // Use percentage-based commission if owner has custom rate
            commissionRate = Math.round((grossAmount * (owner as any).commissionRate) / 100 * 100) / 100;
        }
    }

    const ownerFee = exemptOwner ? 0 : commissionRate;
    const ownerNet = grossAmount - ownerFee;
    const platformEarned = customerFee + ownerFee;

    return {
        feesEnabled: true,
        grossAmount,
        customerFee: Math.round(customerFee * 100) / 100,
        totalCharged: Math.round(totalCharged * 100) / 100,
        ownerNet: Math.round(ownerNet * 100) / 100,
        ownerFee: Math.round(ownerFee * 100) / 100,
        platformEarned: Math.round(platformEarned * 100) / 100,
        commissionRate: (ownerId ? (await prisma.user.findUnique({ where: { id: ownerId }, select: { commissionRate: true } as any })) as any : null)?.commissionRate ?? settings.ownerRentFeeFlat,
    };
}


// ── Record a platform fee after payment ───────────────
export async function recordPlatformFee(bookingId: string, amountStr: string, userId?: string, propertyName?: string) {
    const fees = await calculateFees(amountStr, userId, propertyName);
    if (!fees.feesEnabled) return null;

    // Add to platform wallet
    await prisma.platformSettings.update({
        where: { id: "singleton" },
        data: { platformWalletBalance: { increment: fees.platformEarned } }
    });

    return await (prisma as any).platformFee.upsert({
        where: { bookingId },
        create: {
            bookingId,
            grossAmount: fees.grossAmount,
            customerFee: fees.customerFee,
            totalCharged: fees.totalCharged,
            ownerNet: fees.ownerNet,
            ownerFee: fees.ownerFee,
            platformEarned: fees.platformEarned,
        },
        update: {
            grossAmount: fees.grossAmount,
            customerFee: fees.customerFee,
            totalCharged: fees.totalCharged,
            ownerNet: fees.ownerNet,
            ownerFee: fees.ownerFee,
            platformEarned: fees.platformEarned,
        }
    });
}

// ── Get platform wallet balance (admin only) ──────────
export async function getPlatformWalletBalance() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    return settings?.platformWalletBalance ?? 0;
}

// ── Get all platform fee records with booking/user details ──
export async function getPlatformFees() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    return await (prisma as any).platformFee.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            booking: {
                include: {
                    user: { select: { id: true, name: true, email: true, displayId: true } }
                }
            }
        }
    });
}

// ── Get platform settings change log (audit logs) ──────
export async function getPlatformChangeLogs() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    return await prisma.auditLog.findMany({
        where: { entityType: 'ADMIN' },
        orderBy: { createdAt: 'desc' },
        take: 100
    });
}

// ── Fee Exemptions ────────────────────────────────────
export async function getFeeExemptions() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    return await (prisma as any).feeExemption.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' }
    });
}

export async function addFeeExemption(data: {
    userId?: string;
    propertyId?: string;
    propertyName?: string;
    exemptCustomer?: boolean;
    customStudentFee?: number | null;
    customStudentFeeType?: string | null;
    exemptOwner?: boolean;
    exemptOnboardingFee?: boolean;
    customOnboardingFee?: number | null;
    customOnboardingFeeType?: string | null;
    customOwnerFee?: number | null;
    customOwnerFeeType?: string | null;
    reason: string;
}) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    if (!data.reason?.trim()) throw new Error("Reason is required.");

    const exemption = await (prisma as any).feeExemption.create({ data });

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'CREATE',
        entityType: 'ADMIN',
        entityId: exemption.id,
        description: `Fee exemption added: ${data.propertyName || 'All PGs'} / ${data.userId || 'All Users'}. Reason: ${data.reason}`,
    });

    revalidatePath('/dashboard/admin/platform-fees');
    return exemption;
}

export async function removeFeeExemption(id: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    await (prisma as any).feeExemption.update({
        where: { id },
        data: { status: 'CANCELLED', deletedAt: new Date() }
    });

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'DELETE',
        entityType: 'ADMIN',
        entityId: id,
        description: `Fee exemption ${id} removed.`,
    });

    revalidatePath('/dashboard/admin/platform-fees');
}

/** Get all submitted/live properties (for exemption property picker) */
export async function getRegisteredPropertiesForExemption() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const properties = await prisma.property.findMany({
        where: {
            status: {
                notIn: ['REJECTED', 'DEACTIVATED', 'DELETED'],
            },
            deletedAt: null,
        },
        select: {
            id: true, displayId: true, applicationId: true, name: true, city: true,
            status: true, createdAt: true, isVerified: true,
            onboardingPaidAt: true,
            owner: { select: { name: true, phone: true, email: true, displayId: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    return properties;

}

/** Get all active students/tenants (for exemption student picker) */
export async function getActiveStudentsForExemption() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const bookings = await prisma.booking.findMany({
        where: { status: { in: ['ACTIVE', 'CONFIRMED', 'CHECKED_IN'] } },
        select: {
            id: true, displayId: true, propertyName: true,
            guestName: true, guestPhone: true, guestEmail: true,
            createdAt: true, activeAt: true,
            user: { select: { id: true, name: true, phone: true, email: true, displayId: true } },
            tenant: { select: { displayId: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    return bookings;
}


// ── P8: Owner Razorpay Account Linking (DUMMY) ──
export async function updateOwnerRazorpayAccount(accountId: string | null) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    await prisma.user.update({
        where: { id: (session as any).userId },
        data: { razorpayAccountId: accountId }
    });

    revalidatePath('/dashboard/owner/settings/payment');
    return { success: true };
}
