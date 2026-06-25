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
    tokenFeesEnabled?: boolean;
    studentTokenFeeFlat?: number;
    ownerTokenFeeFlat?: number;
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
export async function calculateFees(amountStr: string, userId?: string, propertyName?: string, ownerId?: string, paymentType?: 'RENT' | 'TOKEN'): Promise<{
    feesEnabled: boolean;
    grossAmount: number;
    customerFee: number;
    totalCharged: number;
    ownerNet: number;
    ownerFee: number;
    platformEarned: number;
    commissionRate: number;
    gstOnStudentFee: number;   // 18% GST exclusive on student convenience fee
    gstOnOwnerFee: number;     // 18% GST exclusive on owner commission
    tdsAmount: number;         // 1% TDS on gross amount under Section 194-O
    totalGstCollected: number; // Total GST collected to remit to government
    cgst: number;              // CGST component (9% of fee)
    sgst: number;              // SGST component (9% of fee)
    sacCode: string;           // SAC 997312 — Short-term accommodation services
}> {
    const grossAmount = parseFloat(amountStr.replace(/[^0-9.]/g, "")) || 0;

    const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });

    if (!settings || !settings.feesEnabled) {
        return { feesEnabled: false, grossAmount, customerFee: 0, totalCharged: grossAmount, ownerNet: grossAmount, ownerFee: 0, platformEarned: 0, commissionRate: 0, gstOnStudentFee: 0, gstOnOwnerFee: 0, tdsAmount: 0, totalGstCollected: 0, cgst: 0, sgst: 0, sacCode: '997312' };
    }

    // Check exemptions
    let exemptCustomer = false;
    let exemptOwner = false;
    let exemptTds = false;
    let exemptions: any[] = [];
    if (userId || propertyName) {
        exemptions = await (prisma as any).feeExemption.findMany({
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
            if (ex.exemptTds) exemptTds = true;
        }
    }

    // Token fee exemption check
    let exemptCustomerToken = false;
    let exemptOwnerToken = false;
    for (const ex of exemptions) {
        if (ex.exemptStudentToken) exemptCustomerToken = true;
        if (ex.exemptOwnerToken) exemptOwnerToken = true;
    }

    const isToken = paymentType === 'TOKEN';
    const tokenFeesEnabled = (settings as any).tokenFeesEnabled ?? false;
    const studentTokenFeeFlat = (settings as any).studentTokenFeeFlat ?? 0;
    const ownerTokenFeeFlat = (settings as any).ownerTokenFeeFlat ?? 0;

    // Customer fee: use token or rent fee based on payment type
    let customerFee: number;
    if (isToken) {
        customerFee = (tokenFeesEnabled && !exemptCustomerToken) ? studentTokenFeeFlat : 0;
    } else {
        customerFee = exemptCustomer ? 0 : settings.studentRentFeeFlat;
        // Check custom student fee override
        if (!exemptCustomer && exemptions.length > 0) {
            for (const ex of exemptions) {
                if (ex.customStudentFee != null) {
                    customerFee = ex.customStudentFeeType === 'PERCENT'
                        ? Math.round((grossAmount * ex.customStudentFee) / 100 * 100) / 100
                        : ex.customStudentFee;
                    break;
                }
            }
        }
    }
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
    // Check custom owner fee from FeeExemption
    if (!exemptOwner && exemptions.length > 0) {
        for (const ex of exemptions) {
            if (ex.customOwnerFee != null) {
                commissionRate = ex.customOwnerFeeType === 'PERCENT'
                    ? Math.round((grossAmount * ex.customOwnerFee) / 100 * 100) / 100
                    : ex.customOwnerFee;
                break;
            }
        }
    }

    let ownerFee: number;
    if (isToken) {
        ownerFee = (tokenFeesEnabled && !exemptOwnerToken) ? ownerTokenFeeFlat : 0;
    } else {
        ownerFee = exemptOwner ? 0 : commissionRate;
    }
    // ── GST Calculation (Option B: EXCLUSIVE — charged ON TOP of fees) ────────
    // Indian GST law: 18% GST split equally as CGST 9% + SGST 9%
    // SAC Code 997312 — Short-term accommodation/leasing services
    const GST_RATE = 0.18;
    const TDS_RATE = 0.01; // Section 194-O — TDS by e-commerce aggregator on gross transaction

    const gstOnStudentFee = Math.round(customerFee * GST_RATE * 100) / 100;
    const gstOnOwnerFee   = Math.round(ownerFee * GST_RATE * 100) / 100;
    // TDS deducted from owner on the FULL gross rent (not just fee) under Sec 194-O
    const tdsAmount         = exemptTds ? 0 : Math.round(grossAmount * TDS_RATE * 100) / 100;
    const totalGstCollected = Math.round((gstOnStudentFee + gstOnOwnerFee) * 100) / 100;
    // CGST and SGST are each half of total GST (for invoice display purposes)
    const cgst = Math.round((gstOnStudentFee / 2) * 100) / 100;
    const sgst = Math.round((gstOnStudentFee / 2) * 100) / 100;

    // Recalculate totals including GST and TDS
    const totalChargedFinal = grossAmount + customerFee + gstOnStudentFee;
    const ownerNet          = grossAmount - ownerFee - gstOnOwnerFee - tdsAmount;
    const platformEarned    = customerFee + ownerFee; // GST is govt money, not our earnings

    return {
        feesEnabled: true,
        grossAmount,
        customerFee:        Math.round(customerFee * 100) / 100,
        totalCharged:       Math.round(totalChargedFinal * 100) / 100,
        ownerNet:           Math.round(ownerNet * 100) / 100,
        ownerFee:           Math.round(ownerFee * 100) / 100,
        platformEarned:     Math.round(platformEarned * 100) / 100,
        commissionRate:     (ownerId ? (await prisma.user.findUnique({ where: { id: ownerId }, select: { commissionRate: true } as any })) as any : null)?.commissionRate ?? settings.ownerRentFeeFlat,
        gstOnStudentFee,
        gstOnOwnerFee,
        tdsAmount,
        totalGstCollected,
        cgst,
        sgst,
        sacCode: '997312',
    };
}


// ── Record a platform fee after payment ───────────────
export async function recordPlatformFee(bookingId: string, amountStr: string, userId?: string, propertyName?: string, ownerId?: string) {
    const fees = await calculateFees(amountStr, userId, propertyName, ownerId);
    if (!fees.feesEnabled) return null;

    // Add platform earnings to wallet (GST excluded — that goes to government)
    await prisma.platformSettings.update({
        where: { id: "singleton" },
        data: { platformWalletBalance: { increment: fees.platformEarned } }
    });

    return await (prisma as any).platformFee.upsert({
        where: { bookingId },
        create: {
            bookingId,
            grossAmount:     fees.grossAmount,
            customerFee:     fees.customerFee,
            totalCharged:    fees.totalCharged,
            ownerNet:        fees.ownerNet,
            ownerFee:        fees.ownerFee,
            platformEarned:  fees.platformEarned,
            gstOnStudentFee: fees.gstOnStudentFee,
            gstOnOwnerFee:   fees.gstOnOwnerFee,
            tdsAmount:       fees.tdsAmount,
            sacCode:         fees.sacCode,
        },
        update: {
            grossAmount:     fees.grossAmount,
            customerFee:     fees.customerFee,
            totalCharged:    fees.totalCharged,
            ownerNet:        fees.ownerNet,
            ownerFee:        fees.ownerFee,
            platformEarned:  fees.platformEarned,
            gstOnStudentFee: fees.gstOnStudentFee,
            gstOnOwnerFee:   fees.gstOnOwnerFee,
            tdsAmount:       fees.tdsAmount,
            sacCode:         fees.sacCode,
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
    exemptTds?: boolean;
    tdsCertificateUrl?: string | null;
    tdsExemptionReason?: string | null;
    reason: string;
}) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    if (!data.reason?.trim()) throw new Error("Reason is required.");

    // Server-side validation for TDS exemption
    if (data.exemptTds) {
        if (!data.tdsCertificateUrl?.trim()) {
            throw new Error("TDS lower/nil deduction certificate is required when TDS exemption is enabled.");
        }
        if (!data.tdsExemptionReason?.trim()) {
            throw new Error("Reason notes specifically for TDS exemption are required.");
        }
    }

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
