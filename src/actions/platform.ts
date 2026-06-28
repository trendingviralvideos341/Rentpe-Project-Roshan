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
    studentRentFeeType?: string;
    ownerRentFeeFlat?: number;
    ownerRentFeeType?: string;
    ownerOnboardingFeeFlat?: number;
    allowCashPayment?: boolean;
    tokenFeesEnabled?: boolean;
    studentTokenFeeFlat?: number;
    studentTokenFeeType?: string;
    ownerTokenFeeFlat?: number;
    ownerTokenFeeType?: string;
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
export async function calculateFees(amountStr: string, userId?: string, propertyName?: string, ownerId?: string, paymentType?: 'RENT' | 'TOKEN', depositAmountNum?: number): Promise<{
    feesEnabled: boolean;
    grossAmount: number;
    customerFee: number;
    studentFeeBase: number;    // base fee excl. GST (e.g. ₹7.63)
    totalCharged: number;
    ownerNet: number;
    ownerFee: number;
    ownerFeeBase: number;      // owner fee excl. GST (e.g. ₹7.63)
    platformEarned: number;
    commissionRate: number;
    gstOnStudentFee: number;   // GST extracted from inclusive fee (e.g. ₹1.37)
    gstOnOwnerFee: number;     // GST extracted from inclusive owner fee (e.g. ₹1.37)
    tdsAmount: number;         // 1% TDS on gross amount under Section 194-O
    totalGstCollected: number; // Total GST to remit to government
    cgst: number;              // CGST component (9%) e.g. ₹0.68
    sgst: number;              // SGST component (9%) e.g. ₹0.69
    sacCode: string;           // SAC 997312 — Short-term accommodation services
}> {
    const grossAmount = parseFloat(amountStr.replace(/[^0-9.]/g, "")) || 0;
    // Security deposit is refundable capital — NOT taxable income under IT Act.
    // TDS u/s 194-O must only apply to the rent portion of the gross transaction.
    const depositAmt  = depositAmountNum || 0;
    const rentOnlyAmt = Math.max(0, grossAmount - depositAmt); // rent = total paid - deposit

    const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });

    if (!settings || !settings.feesEnabled) {
        return { feesEnabled: false, grossAmount, customerFee: 0, studentFeeBase: 0, totalCharged: grossAmount, ownerNet: grossAmount, ownerFee: 0, ownerFeeBase: 0, platformEarned: 0, commissionRate: 0, gstOnStudentFee: 0, gstOnOwnerFee: 0, tdsAmount: 0, totalGstCollected: 0, cgst: 0, sgst: 0, sacCode: '997312' };
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
        const tokenType = (settings as any).studentTokenFeeType || 'FLAT';
        const rawFee = (tokenFeesEnabled && !exemptCustomerToken) ? studentTokenFeeFlat : 0;
        customerFee = tokenType === 'PERCENT'
            ? Math.round((grossAmount * rawFee) / 100 * 100) / 100
            : rawFee;
    } else {
        const rentType = (settings as any).studentRentFeeType || 'FLAT';
        const rawFee = exemptCustomer ? 0 : settings.studentRentFeeFlat;
        customerFee = rentType === 'PERCENT'
            ? Math.round((grossAmount * rawFee) / 100 * 100) / 100
            : rawFee;
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
    const globalOwnerRentType = (settings as any).ownerRentFeeType || 'FLAT';
    let commissionRate = globalOwnerRentType === 'PERCENT'
        ? Math.round((grossAmount * settings.ownerRentFeeFlat) / 100 * 100) / 100
        : settings.ownerRentFeeFlat;

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
        const tokenOwnerType = (settings as any).ownerTokenFeeType || 'FLAT';
        const rawFee = (tokenFeesEnabled && !exemptOwnerToken) ? ownerTokenFeeFlat : 0;
        ownerFee = tokenOwnerType === 'PERCENT'
            ? Math.round((grossAmount * rawFee) / 100 * 100) / 100
            : rawFee;
    } else {
        ownerFee = exemptOwner ? 0 : commissionRate;
    }
    // ── GST Calculation: INCLUSIVE — ₹9 is the all-in total the student pays ──────
    // Business decision: ₹9 fee is stated as GST-inclusive (no extra surprise charge).
    // For invoice/tax purposes we decompose: ₹9 = ₹7.63 (base) + ₹1.37 (18% GST)
    // Formula: gst = fee * 0.18 / 1.18  |  base = fee - gst
    // Indian GST law: 18% split equally as CGST 9% + SGST 9%
    // SAC Code 997312 — Short-term accommodation/leasing services
    const GST_RATE = 0.18;
    const TDS_RATE = 0.01; // Section 194-O — TDS by e-commerce aggregator on RENT only

    // INCLUSIVE mode: extract GST that is already baked into the fee
    const gstOnStudentFee = Math.round((customerFee * GST_RATE / (1 + GST_RATE)) * 100) / 100;
    const studentFeeBase  = Math.round((customerFee - gstOnStudentFee) * 100) / 100; // ₹7.63
    const gstOnOwnerFee   = Math.round((ownerFee * GST_RATE / (1 + GST_RATE)) * 100) / 100;
    const ownerFeeBase    = Math.round((ownerFee - gstOnOwnerFee) * 100) / 100;

    // ── LEGAL FIX: TDS u/s 194-O applies ONLY to the rent component, NOT the refundable
    // security deposit. A security deposit is a capital receipt, not income — it is returned
    // to the tenant on exit and is therefore NOT subject to tax deduction at source.
    // Reference: CBDT Circular No. 718 & Income Tax Act Section 194-O r/w Explanation.
    const tdsAmount = exemptTds ? 0 : Math.round(rentOnlyAmt * TDS_RATE * 100) / 100;

    const totalGstCollected = Math.round((gstOnStudentFee + gstOnOwnerFee) * 100) / 100;
    // CGST and SGST are each half of total GST (for invoice display purposes)
    const cgst = Math.round((gstOnStudentFee / 2) * 100) / 100;  // ₹0.68
    const sgst = Math.round((gstOnStudentFee - cgst) * 100) / 100; // ₹0.69

    // INCLUSIVE: student pays grossAmount + customerFee (GST already inside customerFee)
    // No extra GST is added on top — ₹9 is the final all-in platform fee
    const totalChargedFinal = grossAmount + customerFee;
    // Owner net = what student paid as rent - owner platform fee (incl. GST) - TDS
    const ownerNet = grossAmount - ownerFee - tdsAmount;
    // Platform earns the base fee portion only (GST is remitted to government)
    const platformEarned = studentFeeBase + ownerFeeBase;

    return {
        feesEnabled: true,
        grossAmount,
        customerFee:        Math.round(customerFee * 100) / 100,       // ₹9 (incl. GST)
        studentFeeBase,                                                  // ₹7.63 (excl. GST)
        totalCharged:       Math.round(totalChargedFinal * 100) / 100,  // rent + ₹9
        ownerNet:           Math.round(ownerNet * 100) / 100,
        ownerFee:           Math.round(ownerFee * 100) / 100,           // ₹9 (incl. GST)
        ownerFeeBase,                                                    // ₹7.63 (excl. GST)
        platformEarned:     Math.round(platformEarned * 100) / 100,
        commissionRate:     (ownerId ? (await prisma.user.findUnique({ where: { id: ownerId }, select: { commissionRate: true } as any })) as any : null)?.commissionRate ?? settings.ownerRentFeeFlat,
        gstOnStudentFee,    // ₹1.37 — the GST component extracted from ₹9
        gstOnOwnerFee,      // ₹1.37 — GST on owner commission
        tdsAmount,
        totalGstCollected,
        cgst,               // ₹0.68
        sgst,               // ₹0.69
        sacCode: '997312',
    };
}

// ── calculateCheckoutFees: Single source of truth for checkout screen ─────
// Called by the payment page (client) and by createRazorpayOrder (server)
// to ensure EXACTLY the same amount is shown on screen and charged by Razorpay.
//
// CHECKLIST this function enforces:
//   [1] Is the platform fee globally enabled?
//   [2] Is this student or property exempt from convenience fee?
//   [3] Is this student or property exempt from GST on their fee?
//   [4] For JOINING payment: compute prorated first-month rent (not full month)
//   [5] For JOINING payment: deduct token advance already paid (₹1,000)
//   [6] For TOKEN payment: use token fee settings if enabled, not rent settings
//   [7] For RENT_INVOICE: use invoice amount as base (no proration needed)
//   [8] Compute GST (18% CGST+SGST) on convenience fee (exclusive — on top of fee)
export async function calculateCheckoutFees(
    bookingId: string,
    paymentType: 'JOINING' | 'TOKEN' | 'RENT_INVOICE',
    invoiceId?: string,
): Promise<{
    baseAmount:         number;
    rentBase:           number;
    depositBase:        number;
    convenienceFee:     number;      // all-in platform fee incl. GST (e.g. ₹9)
    convenienceFeeBase: number;      // base fee excl. GST (e.g. ₹7.63)
    gstOnFee:           number;      // GST extracted from fee (e.g. ₹1.37)
    cgst:               number;      // CGST 9% (e.g. ₹0.68)
    sgst:               number;      // SGST 9% (e.g. ₹0.69)
    totalCharged:       number;      // baseAmount + convenienceFee (GST inside)
    feesEnabled:        boolean;
    isExempt:           boolean;
    exemptReason:       string;
    feeType:            'FLAT' | 'PERCENT' | 'NONE';
    sacCode:            string;
    ownerFee:           number;      // all-in owner commission (e.g. ₹9)
    ownerFeeBase:       number;      // owner fee excl. GST (e.g. ₹7.63)
    ownerNet:           number;
    ownerFeeExempt:     boolean;
    tdsAmount:          number;
    tdsExempt:          boolean;
    gstOnOwnerFee:      number;
}> {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    // ── STEP 1: Fetch booking with full context ──────────────────────────────
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            room: { include: { property: { include: { owner: true } } } }
        }
    });
    if (!booking) throw new Error('Booking not found');

    const rentAmount    = Number(booking.amount || 0);
    const depositAmount = Number((booking as any).depositAmount || 0);
    const tokenPaid     = !!(booking as any).tokenPaidAt; // true if token already paid

    // ── STEP 2: Compute base amount per payment type ─────────────────────────
    // JOINING: prorated first-month rent (move-in date → last day of move-in month)
    //          + full security deposit
    //          - token advance (₹1,000) already paid
    //
    // TOKEN: flat ₹1,000 — no proration
    //
    // RENT_INVOICE: invoice amount as stored in DB

    let baseAmount     = 0;
    let rentBase       = 0;   // rent-only component (for TDS)
    let depositBase    = 0;   // deposit component (refundable — no TDS)
    let apiPaymentType: 'RENT' | 'TOKEN' = 'RENT';

    if (paymentType === 'TOKEN') {
        baseAmount     = 1000;
        rentBase       = 1000;
        depositBase    = 0;
        apiPaymentType = 'TOKEN';

    } else if (paymentType === 'RENT_INVOICE') {
        let invAmount = rentAmount; // fallback
        if (invoiceId) {
            const inv = await prisma.rentInvoice.findUnique({ where: { id: invoiceId } });
            if (inv) invAmount = Number(inv.amount);
        }
        baseAmount   = invAmount;
        rentBase     = invAmount;
        depositBase  = 0;
        apiPaymentType = 'RENT';

    } else {
        // JOINING — compute prorated rent from move-in / onboarding date
        let moveInDate = new Date();
        const rawDate = (booking as any).onboardingDate || (booking as any).moveInDate;
        if (rawDate) {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) moveInDate = d;
        }

        const daysInMo     = new Date(moveInDate.getFullYear(), moveInDate.getMonth() + 1, 0).getDate();
        const daysLeft     = daysInMo - moveInDate.getDate() + 1;
        const isFirst      = moveInDate.getDate() === 1;
        const proratedRent = isFirst ? rentAmount : Math.round((rentAmount / daysInMo) * daysLeft);

        const TOKEN_DEDUCT  = tokenPaid ? 1000 : 0;
        rentBase            = proratedRent;
        depositBase         = depositAmount;
        baseAmount          = Math.max(0, proratedRent + depositAmount - TOKEN_DEDUCT);
        apiPaymentType      = 'RENT';
    }

    // ── STEP 3: Run full fee calculation (exemptions, custom rates, GST, TDS) ─
    const propertyName  = booking.room?.property?.name || booking.propertyName;
    const ownerId       = booking.room?.property?.ownerId;
    const userId        = booking.userId;

    // Pass rent-only amount as the "gross" for TDS; pass deposit separately
    // calculateFees handles: exempt check, flat vs %, GST, TDS (only on rent)
    const fees = await calculateFees(
        String(rentBase),          // gross = rent only (TDS applies here)
        userId,
        propertyName,
        ownerId,
        apiPaymentType,
        depositBase                // passed so TDS excludes deposit
    );

    // ── STEP 4: Build exemption display message ──────────────────────────────
    let exemptReason = '';
    const isExempt   = fees.feesEnabled && fees.customerFee === 0;
    if (!fees.feesEnabled)        exemptReason = 'Platform fees are currently disabled';
    else if (isExempt)            exemptReason = 'This booking/property is fee-exempt';

    // ── STEP 5: Final totals ─────────────────────────────────────────────────
    // INCLUSIVE GST: totalCharged = baseAmount + convenienceFee (GST is already inside the ₹9)
    // Student pays exactly: rent + ₹9 (no extra GST surprise)
    const totalCharged = baseAmount + fees.customerFee;

    return {
        baseAmount:       Math.round(baseAmount * 100) / 100,
        rentBase:         Math.round(rentBase * 100) / 100,
        depositBase:      Math.round(depositBase * 100) / 100,
        convenienceFee:   fees.customerFee,          // ₹9 — all-in (incl. GST)
        convenienceFeeBase: (fees as any).studentFeeBase ?? 0,  // ₹7.63 — for invoice
        gstOnFee:         fees.gstOnStudentFee,       // ₹1.37 — extracted GST for display
        cgst:             fees.cgst,                  // ₹0.68
        sgst:             fees.sgst,                  // ₹0.69
        totalCharged:     Math.round(totalCharged * 100) / 100,
        feesEnabled:      fees.feesEnabled,
        isExempt,
        exemptReason,
        feeType:          fees.feesEnabled ? 'FLAT' : 'NONE',
        sacCode:          fees.sacCode,
        // Owner-side breakdown (for tax summary)
        ownerFee:         fees.ownerFee,              // ₹9 (incl. GST) deducted from owner
        ownerFeeBase:     (fees as any).ownerFeeBase ?? 0,  // ₹7.63 — for invoice
        ownerNet:         fees.ownerNet,              // grossRent - ownerFee
        ownerFeeExempt:   fees.feesEnabled && fees.ownerFee === 0,
        tdsAmount:        fees.tdsAmount,
        tdsExempt:        fees.tdsAmount === 0 && fees.feesEnabled,
        gstOnOwnerFee:    fees.gstOnOwnerFee,
    };
}

// ── Record a platform fee after payment ───────────────
export async function recordPlatformFee(paymentId: string, bookingId: string, amountStr: string, userId?: string, propertyName?: string, ownerId?: string, depositAmount?: number, paymentType?: 'RENT' | 'TOKEN') {
    const fees = await calculateFees(amountStr, userId, propertyName, ownerId, paymentType, depositAmount);
    if (!fees.feesEnabled) return null;

    // Add platform earnings to wallet (GST excluded — that goes to government)
    await prisma.platformSettings.update({
        where: { id: "singleton" },
        data: { platformWalletBalance: { increment: fees.platformEarned } }
    });

    return await (prisma as any).platformFee.upsert({
        where: { paymentId },
        create: {
            bookingId,
            paymentId,
            paymentType,
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

// ── ADMIN: Get full financial ledger with all IDs and tax breakdown ──
export async function getAdminFinancialLedger(fromDate?: Date, toDate?: Date) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error('Unauthorized');

    const from = fromDate || new Date(new Date().getFullYear(), 3, 1); // April 1 of current year
    const to = toDate || new Date();

    const payments = await (prisma as any).payment.findMany({
        where: {
            createdAt: { gte: from, lte: to },
            status: { in: ['SUCCESS', 'VERIFIED', 'CAPTURED'] }
        },
        orderBy: { createdAt: 'desc' },
        include: {
            booking: {
                select: {
                    id: true, displayId: true, propertyName: true, propertyId: true, roomType: true,
                    status: true, createdAt: true,
                    user: { select: { id: true, name: true, email: true, phone: true, displayId: true } },
                    room: {
                        select: {
                            property: {
                                select: {
                                    id: true, name: true, city: true,
                                    owner: { select: { id: true, name: true, displayId: true, email: true } }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    // Join with PlatformFee records for tax data
    const paymentIds = payments.map((p: any) => p.id).filter(Boolean);
    const feeRecords = await (prisma as any).platformFee.findMany({
        where: { paymentId: { in: paymentIds } }
    });
    const feeMap: Record<string, any> = {};
    for (const f of feeRecords) feeMap[f.paymentId] = f;

    const rows = payments.map((p: any) => {
        const fee = feeMap[p.id] || {};
        const booking = p.booking || {};
        const owner = booking?.room?.property?.owner || {};
        const property = booking?.room?.property || {};
        return {
            // === IDs (Audit Trail) ===
            rentpePaymentId: p.id,
            rentpeBookingId: booking.displayId || booking.id,
            razorpayOrderId: p.razorpayOrderId || '—',
            razorpayPaymentId: p.razorpayId || '—',
            razorpayTransferId: p.razorpayTransferId || '—',
            // === Who Paid ===
            studentName: booking?.user?.name || '—',
            studentEmail: booking?.user?.email || '—',
            studentId: booking?.user?.displayId || '—',
            // === What For ===
            propertyName: property.name || booking.propertyName || '—',
            propertyCity: property.city || '—',
            roomType: booking.roomType || '—',
            // === Owner ===
            ownerName: owner.name || '—',
            ownerId: owner.displayId || '—',
            ownerEmail: owner.email || '—',
            // === Money Breakdown ===
            grossAmount: fee.grossAmount || p.amount || 0,
            platformFeeStudent: fee.customerFee || 0,
            platformFeeOwner: fee.ownerFee || 0,
            gstOnStudentFee: fee.gstOnStudentFee || 0,
            gstOnOwnerFee: fee.gstOnOwnerFee || 0,
            cgst: fee.gstOnStudentFee ? Math.round(fee.gstOnStudentFee / 2 * 100) / 100 : 0,
            sgst: fee.gstOnStudentFee ? Math.round(fee.gstOnStudentFee / 2 * 100) / 100 : 0,
            tdsDeducted: fee.tdsAmount || 0,
            ownerNetPayout: fee.ownerNet || 0,
            totalCharged: fee.totalCharged || p.amount || 0,
            platformEarned: fee.platformEarned || 0,
            sacCode: fee.sacCode || '997312',
            paymentMethod: p.method || '—',
            status: p.status,
            date: p.createdAt,
            type: 'RENT_COLLECTION',
        };
    });

    // Fetch all properties with paid onboarding fees in the range
    const onboardingPaidProperties = await prisma.property.findMany({
        where: {
            onboardingPaidAt: { gte: from, lte: to }
        },
        include: {
            owner: { select: { id: true, name: true, displayId: true, email: true } }
        }
    });

    const cgstVal = 7.55;
    const sgstVal = 7.55;
    const baseAmount = 83.90;
    const onboardingFeeAmount = 99;

    const onboardingRows = onboardingPaidProperties.map((p: any) => ({
        rentpePaymentId: `ONB-PAY-${p.id.slice(0, 8).toUpperCase()}`,
        rentpeBookingId: `ONB-${p.displayId || p.id.slice(0, 6).toUpperCase()}`,
        razorpayOrderId: p.onboardingRazorpayOrderId || '—',
        razorpayPaymentId: p.onboardingRazorpayId || '—',
        razorpayTransferId: '—',
        studentName: '—',
        studentEmail: '—',
        studentId: '—',
        propertyName: p.name || '—',
        propertyCity: p.city || '—',
        roomType: 'Property Onboarding',
        ownerName: p.owner?.name || '—',
        ownerId: p.owner?.displayId || '—',
        ownerEmail: p.owner?.email || '—',
        grossAmount: 0,
        platformFeeStudent: 0,
        platformFeeOwner: baseAmount,
        gstOnStudentFee: 0,
        gstOnOwnerFee: cgstVal + sgstVal,
        cgst: cgstVal,
        sgst: sgstVal,
        tdsDeducted: 0,
        ownerNetPayout: -onboardingFeeAmount,
        totalCharged: onboardingFeeAmount,
        platformEarned: baseAmount,
        sacCode: '998314',
        paymentMethod: 'Razorpay',
        status: 'SUCCESS',
        date: p.onboardingPaidAt!,
        type: 'PROPERTY_ONBOARDING',
    }));

    const combinedRows = [...rows, ...onboardingRows].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // === Aggregate totals ===
    const totals = {
        totalGrossCollected: rows.reduce((s: number, r: any) => s + r.grossAmount, 0),
        totalPlatformEarned: combinedRows.reduce((s: number, r: any) => s + r.platformEarned, 0),
        totalGstCollected: combinedRows.reduce((s: number, r: any) => s + r.gstOnStudentFee + r.gstOnOwnerFee, 0),
        totalCgst: combinedRows.reduce((s: number, r: any) => s + r.cgst, 0),
        totalSgst: combinedRows.reduce((s: number, r: any) => s + r.sgst, 0),
        totalTdsWithheld: rows.reduce((s: number, r: any) => s + r.tdsDeducted, 0),
        totalOwnerPayouts: combinedRows.reduce((s: number, r: any) => s + r.ownerNetPayout, 0),
        transactionCount: combinedRows.length,
        totalOnboardingEarned: onboardingRows.reduce((s: number, r: any) => s + r.platformFeeOwner, 0),
        totalOnboardingGst: onboardingRows.reduce((s: number, r: any) => s + r.gstOnOwnerFee, 0),
    };

    return { rows: combinedRows, totals, generatedAt: new Date(), from, to };
}

// ── ADMIN: Monthly GST + TDS tax liability summary ──
export async function getAdminTaxLiability(fromDate?: Date, toDate?: Date) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error('Unauthorized');

    const from = fromDate || new Date(new Date().getFullYear(), 3, 1);
    const to = toDate || new Date();

    const fees = await (prisma as any).platformFee.findMany({
        where: { createdAt: { gte: from, lte: to }, status: 'ACTIVE' },
        include: {
            booking: {
                select: {
                    propertyName: true, propertyId: true, createdAt: true,
                    room: { select: { property: { select: { owner: { select: { id: true, name: true, displayId: true, email: true } }, name: true } } } }
                }
            }
        },
        orderBy: { createdAt: 'asc' }
    });

    const onboardingPaidProperties = await prisma.property.findMany({
        where: { onboardingPaidAt: { gte: from, lte: to } },
        include: {
            owner: { select: { id: true, name: true, displayId: true, email: true } }
        }
    });

    // Group by month
    const monthlyMap: Record<string, any> = {};
    for (const f of fees) {
        const d = new Date(f.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
        if (!monthlyMap[key]) monthlyMap[key] = { month: label, key, gst: 0, cgst: 0, sgst: 0, tds: 0, transactions: 0, platformEarned: 0, onboardingFees: 0, onboardingGst: 0 };
        monthlyMap[key].gst += (f.gstOnStudentFee || 0) + (f.gstOnOwnerFee || 0);
        monthlyMap[key].cgst += f.gstOnStudentFee ? f.gstOnStudentFee / 2 : 0;
        monthlyMap[key].sgst += f.gstOnStudentFee ? f.gstOnStudentFee / 2 : 0;
        monthlyMap[key].tds += f.tdsAmount || 0;
        monthlyMap[key].transactions++;
        monthlyMap[key].platformEarned += f.platformEarned || 0;
    }

    for (const p of onboardingPaidProperties) {
        const d = new Date(p.onboardingPaidAt!);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
        if (!monthlyMap[key]) monthlyMap[key] = { month: label, key, gst: 0, cgst: 0, sgst: 0, tds: 0, transactions: 0, platformEarned: 0, onboardingFees: 0, onboardingGst: 0 };
        const cgstVal = 7.55;
        const sgstVal = 7.55;
        const baseAmount = 83.90;
        monthlyMap[key].gst += cgstVal + sgstVal;
        monthlyMap[key].cgst += cgstVal;
        monthlyMap[key].sgst += sgstVal;
        monthlyMap[key].transactions++;
        monthlyMap[key].platformEarned += baseAmount;
        monthlyMap[key].onboardingFees += 99;
        monthlyMap[key].onboardingGst += cgstVal + sgstVal;
    }

    // TDS by owner
    const ownerTdsMap: Record<string, any> = {};
    for (const f of fees) {
        const owner = f.booking?.room?.property?.owner;
        if (!owner) continue;
        if (!ownerTdsMap[owner.id]) ownerTdsMap[owner.id] = { ownerName: owner.name, ownerId: owner.displayId, ownerEmail: owner.email, totalTds: 0, transactions: 0 };
        ownerTdsMap[owner.id].totalTds += f.tdsAmount || 0;
        ownerTdsMap[owner.id].transactions++;
    }

    // TDS exempt owners
    const exemptOwners = await (prisma as any).feeExemption.findMany({
        where: { status: 'ACTIVE', exemptTds: true },
        orderBy: { createdAt: 'desc' }
    });

    const monthly = Object.values(monthlyMap).sort((a: any, b: any) => a.key.localeCompare(b.key));
    const ownerTds = Object.values(ownerTdsMap).sort((a: any, b: any) => b.totalTds - a.totalTds);

    const totals = {
        totalGst: monthly.reduce((s: number, m: any) => s + m.gst, 0),
        totalCgst: monthly.reduce((s: number, m: any) => s + m.cgst, 0),
        totalSgst: monthly.reduce((s: number, m: any) => s + m.sgst, 0),
        totalTds: monthly.reduce((s: number, m: any) => s + m.tds, 0),
        totalPlatformEarned: monthly.reduce((s: number, m: any) => s + m.platformEarned, 0),
        totalOnboardingFees: monthly.reduce((s: number, m: any) => s + (m.onboardingFees || 0), 0),
        totalOnboardingGst: monthly.reduce((s: number, m: any) => s + (m.onboardingGst || 0), 0),
    };

    return { monthly, ownerTds, exemptOwners, totals, generatedAt: new Date(), from, to };
}

// ── ADMIN: Per-property unit economics ──
export async function getAdminPropertyUnitEconomics(fromDate?: Date, toDate?: Date) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error('Unauthorized');

    const from = fromDate || new Date(new Date().getFullYear(), 3, 1);
    const to = toDate || new Date();

    const fees = await (prisma as any).platformFee.findMany({
        where: { createdAt: { gte: from, lte: to }, status: 'ACTIVE' },
        include: {
            booking: {
                select: {
                    propertyId: true, propertyName: true,
                    user: { select: { name: true, displayId: true } },
                    room: { select: { property: { select: { name: true, city: true, owner: { select: { name: true, displayId: true } } } } } }
                }
            }
        }
    });

    const propMap: Record<string, any> = {};
    for (const f of fees) {
        const propId = f.booking?.propertyId || 'unknown';
        const propName = f.booking?.room?.property?.name || f.booking?.propertyName || 'Unknown';
        const city = f.booking?.room?.property?.city || '—';
        const owner = f.booking?.room?.property?.owner;
        if (!propMap[propId]) {
            propMap[propId] = {
                propertyId: propId,
                propertyName: propName,
                city,
                ownerName: owner?.name || '—',
                ownerId: owner?.displayId || '—',
                totalGrossRent: 0,
                totalPlatformFee: 0,
                totalGst: 0,
                totalTds: 0,
                totalOwnerPayout: 0,
                platformEarned: 0,
                transactions: 0,
                students: new Set<string>(),
            };
        }
        propMap[propId].totalGrossRent += f.grossAmount || 0;
        propMap[propId].totalPlatformFee += (f.customerFee || 0) + (f.ownerFee || 0);
        propMap[propId].totalGst += (f.gstOnStudentFee || 0) + (f.gstOnOwnerFee || 0);
        propMap[propId].totalTds += f.tdsAmount || 0;
        propMap[propId].totalOwnerPayout += f.ownerNet || 0;
        propMap[propId].platformEarned += f.platformEarned || 0;
        propMap[propId].transactions++;
        if (f.booking?.user?.displayId) propMap[propId].students.add(f.booking.user.displayId);
    }

    const properties = Object.values(propMap).map((p: any) => ({
        ...p,
        uniqueStudents: p.students.size,
        students: undefined, // remove Set before serializing
    })).sort((a: any, b: any) => b.totalGrossRent - a.totalGrossRent);

    return { properties, generatedAt: new Date(), from, to };
}
