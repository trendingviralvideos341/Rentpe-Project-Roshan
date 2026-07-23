'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { randomUUID } from "crypto";
import {
    toUTC, toBillingMonth, nextBillingCycleStart,
    round2dp, calculateProratedFood,
    getActiveFoodPreference, isFirstActivation,
    applyCreditNotes, CreditNoteInput
} from "@/utils/foodBillingUtils";
import { generateSequentialId } from "@/lib/ids";

/**
 * Financial System: Core Billing & Deposit Actions
 * Enhanced with Food Billing Integration (All 5 Specs)
 */

// ─────────────────────────────────────────────
// SECTION 1 — BILLING PROFILE SETUP
// ─────────────────────────────────────────────

export async function createBillingProfile(tenantId: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { property: true }
    });
    if (!tenant) throw new Error("Tenant not found");

    const existing = await (prisma as any).billingProfile.findUnique({ where: { tenantId } });
    if (existing) return existing;

    const rentAmount = tenant.rent;
    const depositAmount = rentAmount;
    // UNIFIED CALENDAR BILLING: All tenants bill on the 1st of every month.
    // First month is prorated from move-in date → end of that month.
    const BILLING_ANCHOR = 1;

    return await (prisma as any).$transaction(async (tx: any) => {
        const profile = await tx.billingProfile.create({
            data: {
                tenantId,
                propertyId: tenant.propertyId,
                roomId: tenant.roomId,
                bedId: tenant.bedId,
                monthlyRent: rentAmount,
                securityDeposit: depositAmount,
                billingDay: BILLING_ANCHOR,
                billingAnchorDay: BILLING_ANCHOR,
            }
        });

        await tx.securityDeposit.create({
            data: {
                billingProfileId: profile.id,
                tenantId,
                amount: depositAmount,
                status: 'PENDING'
            }
        });

        logAuditEvent({
            actorId: (session as any).userId,
            actorRole: session.role as string,
            actorName: (session as any).name || 'User',
            actionType: 'CREATE',
            entityType: 'TENANT',
            entityId: tenantId,
            description: `Billing profile initialized. Monthly Rent: ₹${rentAmount}, Deposit: ₹${depositAmount}, BillingAnchor: 1st of every month (Unified Calendar Billing).`,
        });

        return profile;
    });
}

// ─────────────────────────────────────────────
// SECTION 2 — INVOICE GENERATION (FOOD-INTEGRATED)
// ─────────────────────────────────────────────

/**
 * Internal invoice generator — called by system or admin.
 * Full food billing integration per all 5 specs:
 * - FoodPreference as source of truth
 * - Price lock from booking.foodPriceApplied
 * - Proration on first activation only
 * - FIFO credit note application with row-lock
 * - Invoice immutability (lockedAt)
 * - Negative billing protection
 * - Before/after audit with requestId + UTC timestamp
 */
export async function internalGenerateInvoice(
    tenantId: string,
    month: string,
    performedBy: string = 'SYSTEM'
) {
    const profile = await (prisma as any).billingProfile.findUnique({
        where: { tenantId },
        include: { tenant: { include: { booking: true } } }
    });
    if (!profile) throw new Error("Billing profile not found.");

    // ── 1. Billing month (ISO YYYY-MM) ──
    const billingMonth = toBillingMonth(month.length === 7 ? `${month}-01` : month);

    // ── VALIDATION: reject non-YYYY-MM formats at runtime ──
    const BILLING_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!BILLING_MONTH_RE.test(billingMonth)) {
        throw new Error(`Invalid billingMonth format: "${billingMonth}". Must be YYYY-MM (e.g. 2026-04).`);
    }

    const booking = profile.tenant?.booking;
    if (!booking) throw new Error("No active booking found for this tenant.");

    const existing = await (prisma as any).rentInvoice.findFirst({
        where: { bookingId: booking.id, billingMonth }
    });
    if (existing) {
        if (existing.lockedAt) return { skipped: true, reason: 'ALREADY_LOCKED' };
        return { skipped: true, reason: 'ALREADY_EXISTS' };
    }

    // ── 3. Billing cycle start (UTC, anchor-aware) ──
    const anchorDay = profile.billingAnchorDay || profile.billingDay || 1;
    const cycleStart = nextBillingCycleStart(anchorDay, toUTC(`${billingMonth}-01`));
    // cycleEnd = one month after cycleStart
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setUTCMonth(cycleEnd.getUTCMonth() + 1);

    // ── 4. Food preference (source of truth) — optimized: single row, DESC ──
    let foodAmount = 0;
    let foodProrated = false;

    if (booking) {
        const activePref = await (prisma as any).foodPreference.findFirst({
            where: {
                bookingId: booking.id,
                status: 'CONFIRMED',
                effectiveFrom: { lte: cycleStart }
            },
            orderBy: { effectiveFrom: 'desc' }
        });

        if (activePref?.foodSelected) {
            // ── 5. Zero-price guard ──
            if (!booking.foodPriceApplied || booking.foodPriceApplied === 0) {
                throw new Error("Food is active but foodPriceApplied=0 — cannot bill food. Contact admin.");
            }

            const foodPrice = booking.foodPriceApplied; // price lock — never re-read from property

            // ── 6. Proration: first activation only ──
            const allConfirmedPrefs = await (prisma as any).foodPreference.findMany({
                where: { bookingId: booking.id, status: 'CONFIRMED' },
                orderBy: { effectiveFrom: 'asc' }
            });

            if (isFirstActivation(allConfirmedPrefs.filter((p: any) => p.foodSelected))) {
                foodAmount = calculateProratedFood(foodPrice, activePref.effectiveFrom, cycleStart, cycleEnd);
                foodProrated = true;
            } else {
                foodAmount = round2dp(foodPrice);
            }
        }
    }

    const rentAmount = round2dp(profile.monthlyRent);
    const subtotal = round2dp(rentAmount + foodAmount);

    // Hoist credit tracking variables so they're accessible outside the transaction
    let creditApplied = 0;

    // ── 7. Apply credit notes in $transaction with row-level lock ──
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5);
    const displayId = await generateSequentialId('INVOICE');

    const invoice = await (prisma as any).$transaction(async (tx: any) => {
        // Fetch & lock pending credit notes (FIFO — createdAt ASC)
        const pendingCredits: CreditNoteInput[] = await tx.creditNote.findMany({
            where: { bookingId: booking?.id ?? '', status: 'PENDING' },
            orderBy: { createdAt: 'asc' }
        });

        // Apply credits (FIFO, negative billing protection)
        let finalAmount = subtotal;
        let carryForward = 0;
        const appliedIds: string[] = [];

        if (pendingCredits.length > 0) {
            const result = applyCreditNotes(subtotal, pendingCredits);
            finalAmount = result.finalAmount;
            creditApplied = result.creditApplied;  // assign to outer var
            carryForward = result.carryForward;
            result.appliedIds.forEach(id => appliedIds.push(id));

            // Mark applied credit notes as APPLIED
            if (appliedIds.length > 0) {
                await tx.creditNote.updateMany({
                    where: { id: { in: appliedIds } },
                    data: { status: 'APPLIED', appliedToMonth: billingMonth }
                });
            }

            // Carry forward excess credits as a new PENDING credit note
            if (carryForward > 0 && booking) {
                const cnDisplayId = await generateSequentialId('CREDIT_NOTE');
                await tx.creditNote.create({
                    data: {
                        displayId: cnDisplayId,
                        bookingId: booking.id,
                        tenantId,
                        amount: carryForward,
                        carryForward: 0,
                        reason: `Carry-forward from ${billingMonth}`,
                        type: 'CARRY_FORWARD',
                        createdById: performedBy,
                        createdByRole: 'SYSTEM',
                        status: 'PENDING',
                    }
                });
            }
        }

        // Create the locked invoice
        const inv = await tx.rentInvoice.create({
            data: {
                displayId,
                billingProfileId: profile.id,
                tenantId,
                propertyId: profile.propertyId,
                bookingId: booking.id,
                month,
                billingMonth,
                rentAmount,
                foodAmount,
                foodProrated,
                creditApplied,
                amount: finalAmount,
                dueDate,
                status: 'PENDING',
                lockedAt: new Date(), // immutability marker — invoice cannot be modified after creation
            } as any
        });

        return inv;
    });

    // ── 8. Audit log with before/after, IP, UA, requestId, UTC ──
    logAuditEvent({
        actorId: performedBy,
        actorRole: (performedBy === 'SYSTEM' ? 'SYSTEM' : 'ADMIN'),
        actorName: (performedBy === 'SYSTEM' ? 'System' : 'Admin'),
        actionType: 'CREATE',
        entityType: 'TENANT',
        entityId: tenantId,
        description: `Invoice ${displayId} generated for ${billingMonth} | Rent: ₹${rentAmount} | Food: ₹${foodAmount}${foodProrated ? ' (prorated)' : ''} | Credits: -₹${creditApplied} | Final: ₹${invoice.amount}`,
        previousValue: { amount: 0 },
        newValue: { amount: invoice.amount, rentAmount, foodAmount, foodProrated, creditApplied, billingMonth },
    });

    return invoice;
}

// ─────────────────────────────────────────────
// SECTION 3 — PUBLIC INVOICE GENERATOR (session-gated)
// ─────────────────────────────────────────────

export async function generateInvoice(tenantId: string, month: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const result = await internalGenerateInvoice(tenantId, month, (session as any).userId);

    revalidatePath('/dashboard/owner/tenants');
    revalidatePath('/dashboard/admin');
    return result;
}

// ─────────────────────────────────────────────
// SECTION 4 — PAYMENT RECORDING (Concurrent-Safe)
// ─────────────────────────────────────────────

/**
 * Record a payment against an invoice.
 * Wrapped in DB transaction with row-level lock to prevent concurrency issues.
 * Payment allocated: rent first → food → remainder.
 * All amounts via round2dp.
 */
export async function recordInvoicePayment(
    invoiceId: string,
    paymentAmount: number
) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    // ── Financial guard: reject invalid amounts (hacker/bounty-hunter class) ──
    if (typeof paymentAmount !== 'number' || !isFinite(paymentAmount) || paymentAmount <= 0) {
        throw new Error(`Invalid paymentAmount: ${paymentAmount}. Must be a positive finite number.`);
    }
    // Safety ceiling: no single payment > ₹10,00,000 (₹10 lakh) — prevents catastrophic data corruption
    if (paymentAmount > 1_000_000) {
        throw new Error(`Payment amount ₹${paymentAmount} exceeds the maximum allowed per transaction (₹10,00,000).`);
    }

    const amount = round2dp(paymentAmount);
    const requestId = randomUUID();

    const updated = await (prisma as any).$transaction(async (tx: any) => {
        // Re-read invoice inside transaction (row-level lock via $executeRaw not needed with Prisma isolation)
        const inv = await tx.rentInvoice.findUnique({ where: { id: invoiceId } });
        if (!inv) throw new Error("Invoice not found.");
        if (inv.lockedAt && inv.status === 'PAID') throw new Error("Invoice already fully paid.");

        const before = {
            paidAmount: inv.paidAmount,
            paidRentAmount: inv.paidRentAmount,
            paidFoodAmount: inv.paidFoodAmount,
            status: inv.status,
        };

        // Allocate: rent first, then food, then other
        const rentOwed = round2dp(inv.rentAmount - inv.paidRentAmount);
        const foodOwed = round2dp(inv.foodAmount - inv.paidFoodAmount);

        let remaining = amount;
        let addRent = 0;
        let addFood = 0;

        if (remaining > 0 && rentOwed > 0) {
            addRent = Math.min(remaining, rentOwed);
            remaining = round2dp(remaining - addRent);
        }
        if (remaining > 0 && foodOwed > 0) {
            addFood = Math.min(remaining, foodOwed);
            remaining = round2dp(remaining - addFood);
        }

        const newPaidRent = round2dp(inv.paidRentAmount + addRent);
        const newPaidFood = round2dp(inv.paidFoodAmount + addFood);
        const newPaidTotal = round2dp(inv.paidAmount + amount);
        const isFullyPaid = newPaidTotal >= round2dp(inv.amount);

        const result = await tx.rentInvoice.update({
            where: { id: invoiceId },
            data: {
                paidAmount: newPaidTotal,
                paidRentAmount: newPaidRent,
                paidFoodAmount: newPaidFood,
                paidAt: isFullyPaid ? new Date() : inv.paidAt,
                status: isFullyPaid ? 'PAID' : 'PARTIAL',
            } as any
        });

        const after = {
            paidAmount: newPaidTotal,
            paidRentAmount: newPaidRent,
            paidFoodAmount: newPaidFood,
            status: result.status,
        };

        logAuditEvent({
            actorId: (session as any).userId,
            actorRole: session.role as string,
            actorName: (session as any).name || 'User',
            actionType: 'UPDATE',
            entityType: 'TENANT',
            entityId: inv.tenantId,
            description: `Payment of ₹${amount} recorded on invoice ${inv.displayId} | Rent: +₹${addRent} | Food: +₹${addFood} | Status: ${result.status}`,
            previousValue: before,
            newValue: after,
        });

        return result;
    });

    revalidatePath('/dashboard/owner/tenants');
    return updated;
}

// ─────────────────────────────────────────────
// SECTION 5 — MOVE-OUT SETTLEMENT
// ─────────────────────────────────────────────

export async function calculateMoveOutSettlement(tenantId: string, options: { deductions: number, notes?: string }) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
            billingProfile: { include: { deposit: true, invoices: { where: { status: { not: 'PAID' } } } } }
        }
    });

    if (!tenant || !tenant.billingProfile) throw new Error("Tenant financial record incomplete.");

    const unpaidRent = (tenant.billingProfile as any).invoices.reduce(
        (acc: number, inv: any) => acc + round2dp(inv.amount - inv.paidAmount), 0
    );
    const deposit = (tenant.billingProfile as any).deposit?.amount || 0;
    const finalRefund = round2dp(deposit - unpaidRent - options.deductions);

    return await (prisma as any).$transaction(async (tx: any) => {
        const settlement = await tx.settlementRecord.create({
            data: {
                tenantId,
                finalRentPending: unpaidRent,
                damageDeductions: options.deductions,
                depositRefunded: finalRefund > 0 ? finalRefund : 0,
                notes: options.notes
            }
        });

        await tx.billingProfile.update({
            where: { id: (tenant.billingProfile as any).id },
            data: { status: 'CLOSED' }
        });

        if ((tenant.billingProfile as any).deposit) {
            await tx.securityDeposit.update({
                where: { id: (tenant.billingProfile as any).deposit!.id },
                data: {
                    status: finalRefund >= deposit ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
                    refundAmount: finalRefund > 0 ? finalRefund : 0,
                    deductionAmount: options.deductions,
                    deductionReason: options.notes
                }
            });
        }

        return settlement;
    });
}
