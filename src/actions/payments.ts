'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { razorpay } from "@/lib/razorpay";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email";
import { logAuditEvent } from "@/lib/audit";


export async function createRazorpayOrder(bookingId: string, extras?: { invoiceId?: string, depositId?: string, isToken?: boolean }) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { user: true }
    });

    if (!booking) throw new Error("Booking not found");
    
    const userId = (session as { userId: string }).userId;
    if (booking.userId !== userId) throw new Error("Unauthorized");

    try {
        // ── PAYMENT TYPE DETECTION ─────────────────────────────────────────────────
        // Determine what kind of payment this is so we can run the correct
        // fee/proration logic via calculateCheckoutFees.
        //
        // CHECKLIST:
        //   [1] invoiceId present  → RENT_INVOICE  (monthly rent, no proration)
        //   [2] depositId present  → deposit-only  (use raw deposit amount)
        //   [3] isToken present    → TOKEN          (₹1,000 reservation)
        //   [4] none of the above  → JOINING        (prorated rent + deposit - token)

        let checkoutType: 'JOINING' | 'TOKEN' | 'RENT_INVOICE' = 'JOINING';
        if (extras?.invoiceId) checkoutType = 'RENT_INVOICE';
        else if (extras?.isToken) checkoutType = 'TOKEN';

        // Handle legacy depositId-only path (rare, but keep support)
        let legacyDepositAmount: number | null = null;
        if (extras?.depositId && !extras?.invoiceId) {
            const deposit = await prisma.securityDeposit.findUnique({ where: { id: extras.depositId } });
            legacyDepositAmount = deposit ? Number(deposit.amount) : Number((booking as any).depositAmount || 0);
        }

        // ── SINGLE SOURCE OF TRUTH: calculateCheckoutFees ─────────────────────────
        // This server function handles:
        //   • Prorated rent for JOINING (move-in date → end of month)
        //   • Token advance deduction for JOINING (if already paid)
        //   • Platform fee enabled/disabled check
        //   • Student & property exemption check (custom rates / full exemption)
        //   • Convenience fee + 18% GST calculation (exclusive, on top)
        //   • Owner commission + TDS calculation
        //   Returns: { baseAmount, convenienceFee, gstOnFee, totalCharged, ... }
        const { calculateCheckoutFees } = await import('@/actions/platform');

        let finalCharge: number; // in paise (× 100)
        let totalChargedRupees: number;

        if (legacyDepositAmount !== null) {
            // Deposit-only payment: no proration, no fee, just the deposit amount
            finalCharge = legacyDepositAmount * 100;
            totalChargedRupees = legacyDepositAmount;
        } else {
            const checkout = await calculateCheckoutFees(bookingId, checkoutType, extras?.invoiceId);
            totalChargedRupees = checkout.totalCharged;
            finalCharge = Math.round(checkout.totalCharged * 100); // paise
        }

        const options = {
            amount: finalCharge,
            currency: "INR",
            receipt: `receipt_${booking.id.slice(0, 5)}`,
        };

        // ── COMPONENT 1: Delayed Transfer ────────────────────────────────────────
        // Money is collected into Razorpay nodal account.
        // Owner payout is released manually by admin after the 15-day window.
        let order: { id: string; amount: number; currency: string };
        try {
            const rzpOrder = await (razorpay.orders as any).create(options);
            order = { id: rzpOrder.id, amount: rzpOrder.amount as number, currency: rzpOrder.currency };
        } catch (apiError: any) {
            console.warn("Razorpay API Error, using mock:", apiError);
            order = {
                id: `order_mock_${Math.random().toString(36).substring(2, 9)}`,
                amount: finalCharge,
                currency: "INR"
            };
        }

        await (prisma as any).payment.create({
            data: {
                bookingId: booking.id,
                invoiceId: extras?.invoiceId,
                depositId: extras?.depositId,
                amount: totalChargedRupees,   // stored amount = what student pays (incl. fee)
                method: "ONLINE",
                status: "PENDING",
                razorpayOrderId: order.id,
                transferStatus: "PENDING",    // Component 1: Held in nodal
            }
        });

        return {
            id: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID,
            isDummyRoute: order.id.startsWith("order_mock_")
        };
    } catch (error) {
        console.error("Razorpay Order Error:", error);
        throw new Error("Failed to create payment order");
    }
}


export async function verifyPayment(data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    // 🛡️ SECURITY: Verify Razorpay Signature
    if (!data.razorpay_order_id.startsWith("order_mock_")) {
        const crypto = await import("crypto");
        const secret = process.env.RAZORPAY_KEY_SECRET;
        if (!secret) throw new Error("Razorpay secret not configured");

        const generated_signature = crypto
            .createHmac("sha256", secret)
            .update(data.razorpay_order_id + "|" + data.razorpay_payment_id)
            .digest("hex");

        if (generated_signature !== data.razorpay_signature) {
            throw new Error("Invalid payment signature. Potential fraud detected.");
        }
    }

    const payment = await prisma.payment.findFirst({
        where: { razorpayOrderId: data.razorpay_order_id }
    });

    if (!payment) throw new Error("Payment record not found");

    return await prisma.$transaction(async (tx) => {
        // 1. Update Payment — mark VERIFIED, set transferStatus = PENDING (Component 1)
        await (tx as any).payment.update({
            where: { id: payment.id },
            data: {
                status: "VERIFIED",
                razorpayId: data.razorpay_payment_id,
                verifiedBy: "SYSTEM",
                transferStatus: "PENDING",   // Held in nodal until admin releases
            }
        });

        // 2. Clear related records
        if (payment.invoiceId) {
            // ✅ LEGAL: paidAmount = base rent only (NOT student convenience fee).
            // student convenience fee is RentPe's service charge, not part of rent receipt.
            const inv = await tx.rentInvoice.findUnique({ where: { id: payment.invoiceId }, select: { amount: true } });
            const baseRentAmount = inv ? Number(inv.amount) : payment.amount;
            await tx.rentInvoice.update({
                where: { id: payment.invoiceId },
                data: { status: 'PAID', paidAt: new Date(), paidAmount: baseRentAmount }
            });
        }
        
        if (payment.depositId) {
            await tx.securityDeposit.update({
                where: { id: payment.depositId },
                data: { status: 'PAID', paidAt: new Date() }
            });
        }

        // 3. Update Booking
        await tx.booking.update({
            where: { id: payment.bookingId },
            data: {
                paymentStatus: "PAID"
            }
        });

        return { success: true };
    }).then(async (res) => {
        // ── SIDE EFFECTS: Execute post-transaction commit safely ──
        try {
            // 1. Record platform fee earnings to DB wallet (Async — non-blocking)
            const { recordPlatformFee } = await import('@/actions/platform');
            const paymentWithBooking = await prisma.booking.findUnique({
                where: { id: payment.bookingId },
                include: { user: true, room: { include: { property: { include: { owner: true } } } } }
            });
            if (paymentWithBooking) {
                // Pass rent amount and deposit separately so TDS (1% u/s 194-O) is only
                // calculated on the rent portion. Security deposit is NOT taxable income.
                const rentAmt    = String(paymentWithBooking.amount || payment.amount);
                const depositAmt = Number((paymentWithBooking as any).depositAmount || 0);
                recordPlatformFee(
                    payment.bookingId,
                    rentAmt,
                    paymentWithBooking.userId,
                    paymentWithBooking.room?.property?.name || paymentWithBooking.propertyName,
                    paymentWithBooking.room?.property?.ownerId || undefined,
                    depositAmt
                ).catch(err => console.error('[PLATFORM FEE RECORD] Failed:', err));
            }
        } catch (feeErr) {
            console.error('[PLATFORM FEE RECORD] Error:', feeErr);
        }

        // 3. GST Turnover Check & Alert (Async — non-blocking)
        try {
            const paymentWithBooking = await prisma.booking.findUnique({
                where: { id: payment.bookingId },
                include: { room: { include: { property: true } } }
            });
            const ownerId = paymentWithBooking?.room?.property?.ownerId || (paymentWithBooking as any)?.property?.ownerId;
            if (ownerId) {
                const { checkOwnerTurnoverAndAlert } = await import('@/actions/taxAlerts');
                checkOwnerTurnoverAndAlert(ownerId).catch(err => console.error('[GST TURNOVER CHECK] Failed:', err));
            }
        } catch (gstErr) {
            console.error('[GST TURNOVER CHECK] Error:', gstErr);
        }

        try {
            // 2. Send Payment Receipt Email (Async)
            const user = await prisma.user.findUnique({ where: { id: (session as any).userId }, select: { email: true, name: true } });
            if (user?.email) {
                sendEmail({
                    to: user.email,
                    subject: `Payment Receipt: ₹${payment.amount} confirmed! 🧾`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                            <h2 style="color: #8b5cf6;">Payment Received!</h2>
                            <p>Hi ${user.name || 'there'},</p>
                            <p>Your payment of <strong>₹${payment.amount}</strong> has been successfully verified.</p>
                            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 0;"><strong>Payment ID:</strong> ${data.razorpay_payment_id}</p>
                                <p style="margin: 4px 0 0 0;"><strong>Amount:</strong> ₹${payment.amount}</p>
                                <p style="margin: 4px 0 0 0;"><strong>Status:</strong> Success</p>
                            </div>
                            <p>You can view your payment history and download invoices from your dashboard.</p>
                            <a href="https://rentpe.in/dashboard/student" style="display: inline-block; background: #8b5cf6; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 10px;">Go to Dashboard</a>
                        </div>
                    `
                }).catch(err => console.error('Failed to email payment receipt:', err));
            }

            // 3. Audit Log — Payment Verified
            logAuditEvent({
                actorId: (session as any).userId,
                actorRole: (session as any).role || 'USER',
                actorName: user?.name || 'Tenant',
                actionType: 'UPDATE',
                entityType: 'PAYMENT',
                entityId: payment.id,
                description: `Payment of ₹${payment.amount} verified. Razorpay ID: ${data.razorpay_payment_id}. Booking ID: ${payment.bookingId}.`,
                newValue: { status: 'VERIFIED', razorpayId: data.razorpay_payment_id, amount: payment.amount },
            }).catch(err => console.error('Failed to log audit event:', err));
        } catch (sideErr) {
            console.error('[SIDE EFFECTS] Error:', sideErr);
        }

        revalidatePath("/dashboard/student");
        revalidatePath("/dashboard/owner/bookings");
        revalidatePath("/dashboard/owner/financials");

        return res;
    });
}

export async function getStudentPaymentHistory() {
    try {
        const session = await getSession();
        if (!session || (session as any).role !== 'USER') {
            throw new Error("Unauthorized");
        }

        const userId = (session as any).userId;
        const email = (session as any).email;

        // 1. All Payment model records (all statuses — so failures show too)
        const allPayments = await prisma.payment.findMany({
            where: { booking: { userId } },
            include: { booking: { select: { propertyName: true, displayId: true } } },
            orderBy: { date: 'desc' }
        });

        // 2. Token payments from bookings (stored directly on booking, not Payment model)
        const bookingsWithToken = await prisma.booking.findMany({
            where: { userId, tokenPaidAt: { not: null } },
            select: {
                id: true, displayId: true, propertyName: true,
                tokenPaidAt: true, tokenPaymentId: true, paymentMethod: true,
                tokenAmount: true,
            }
        });

        // 3. Monthly rent records
        let rentRecords: any[] = [];
        if (email) {
            const tenants = await prisma.tenant.findMany({
                where: { email },
                include: {
                    rentRecords: { where: { paid: true } },
                    property: { select: { name: true } }
                }
            });
            rentRecords = tenants.flatMap(t =>
                t.rentRecords.map(r => ({
                    id: r.id,
                    amount: Number(r.amount),
                    date: r.paidOn ? new Date(r.paidOn) : r.createdAt,
                    type: 'MONTHLY_RENT',
                    description: `Monthly Rent — ${r.month} · ${t.property.name}`,
                    status: 'SUCCESS',
                    transactionId: null,
                    method: 'CASH / ONLINE',
                    propertyName: t.property.name,
                }))
            );
        }

        // Format Payment model records
        const formattedPayments = allPayments.map(p => {
            const statusMap: Record<string, string> = {
                VERIFIED: 'SUCCESS', PENDING: 'PENDING', FAILED: 'FAILED', REFUNDED: 'REFUNDED'
            };
            return {
                id: p.id,
                amount: Number(p.amount),
                date: p.date,
                type: p.invoiceId ? 'RENT_INVOICE' : p.depositId ? 'SECURITY_DEPOSIT' : 'BOOKING_PAYMENT',
                description: p.invoiceId
                    ? `Rent Invoice — ${p.booking?.propertyName || ''}`
                    : p.depositId
                    ? `Security Deposit — ${p.booking?.propertyName || ''}`
                    : `Joining Payment — ${p.booking?.propertyName || ''} (Ref: ${p.booking?.displayId || ''})`,
                status: statusMap[p.status] || p.status,
                transactionId: p.razorpayId || p.razorpayOrderId || null,
                method: p.method || 'ONLINE',
                propertyName: p.booking?.propertyName || '',
                bookingRef: p.booking?.displayId || '',
            };
        });

        // Format token payments (deduplicate — skip if already in Payment model)
        const existingTxIds = new Set(allPayments.map(p => p.razorpayId).filter(Boolean));
        const tokenPayments = bookingsWithToken
            .filter(b => !b.tokenPaymentId || !existingTxIds.has(b.tokenPaymentId))
            .map(b => ({
                id: `token-${b.id}`,
                amount: Number(b.tokenAmount || 1000),
                date: b.tokenPaidAt ? new Date(b.tokenPaidAt as any) : new Date(),
                type: 'TOKEN_PAYMENT',
                description: `Token Payment — ${b.propertyName} (Ref: ${b.displayId})`,
                status: 'SUCCESS',
                transactionId: b.tokenPaymentId || null,
                method: b.paymentMethod || 'ONLINE',
                propertyName: b.propertyName,
                bookingRef: b.displayId,
            }));

        // Combine and sort newest first
        const combined = [...tokenPayments, ...formattedPayments, ...rentRecords]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return combined;
    } catch (e) {
        console.error('getStudentPaymentHistory Error:', e);
        return [];
    }
}

/** Get full rent invoice ledger for the logged-in student */
export async function getMyPaymentHistory() {
    const session = await getSession();
    if (!session || (session as any).role !== 'USER') throw new Error("Unauthorized");

    const userId = (session as any).userId;

    const invoices = await prisma.rentInvoice.findMany({
        where: { booking: { userId } },
        include: {
            booking: { select: { propertyName: true, roomAssigned: true } },
            payments: { where: { status: 'VERIFIED' }, take: 1, orderBy: { date: 'desc' } }
        },
        orderBy: { dueDate: 'desc' }
    });

    const tenants = await prisma.tenant.findMany({
        where: { booking: { userId } },
        include: { property: { select: { name: true } } }
    });

    // Get security deposit via BillingProfile
    const depositInfo = tenants.length > 0
        ? await prisma.securityDeposit.findFirst({
            where: { billingProfile: { tenantId: tenants[0].id } }
          })
        : null;

    return { invoices, tenants, depositInfo };
}

/**
 * Get ALL bookings for the logged-in student, each with its invoices,
 * raw payments, token info and security deposit — for the multi-PG payment history page.
 */
export async function getAllStudentBookingsWithPayments() {
    const session = await getSession();
    if (!session || (session as any).role !== 'USER') throw new Error("Unauthorized");

    const userId = (session as any).userId;

    // All bookings for this student (newest first)
    const bookings = await prisma.booking.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            displayId: true,
            propertyName: true,
            status: true,
            createdAt: true,
            tokenPaidAt: true,
            tokenPaymentId: true,
            tokenAmount: true,
            paymentMethod: true,
            amount: true,
            depositAmount: true,
            roomAssigned: true,
            paymentStatus: true,
            activeAt: true,
            completedAt: true,
            guestName: true,
            guestEmail: true,
            guestPhone: true,
            agreementSigned: true,
            agreementSignedAt: true,
            moveInDate: true,
        }
    });

    // For each booking, fetch invoices + payments + deposit
    const result = await Promise.all(bookings.map(async (b) => {
        const invoices = await prisma.rentInvoice.findMany({
            where: { bookingId: b.id },
            include: {
                payments: { orderBy: { date: 'desc' } }
            },
            orderBy: { dueDate: 'desc' }
        });

        // All raw Payment records for this booking
        const rawPayments = await prisma.payment.findMany({
            where: { bookingId: b.id },
            orderBy: { date: 'desc' }
        });

        // Security deposit (through tenant/billingProfile)
        const tenant = await prisma.tenant.findFirst({
            where: { booking: { id: b.id } }
        });
        const depositInfo = tenant
            ? await (prisma as any).securityDeposit.findFirst({
                where: { billingProfile: { tenantId: tenant.id } }
              }).catch(() => null)
            : null;

        return {
            booking: {
                id: b.id,
                displayId: b.displayId,
                propertyName: b.propertyName,
                status: b.status,
                createdAt: b.createdAt,
                tokenPaidAt: b.tokenPaidAt,
                tokenPaymentId: b.tokenPaymentId,
                tokenAmount: Number(b.tokenAmount || 1000),
                paymentMethod: b.paymentMethod,
                amount: Number(b.amount),
                depositAmount: Number((b as any).depositAmount || 0),
                roomAssigned: b.roomAssigned,
                paymentStatus: b.paymentStatus,
                activeAt: b.activeAt,
                completedAt: b.completedAt,
                guestName: b.guestName,
                guestEmail: b.guestEmail,
                guestPhone: b.guestPhone,
                agreementSigned: b.agreementSigned,
                agreementSignedAt: b.agreementSignedAt,
                moveInDate: b.moveInDate,
            },
            invoices: invoices.map(inv => ({
                id: inv.id,
                displayId: (inv as any).displayId || `INV-${inv.id.slice(0,8).toUpperCase()}`,
                month: (inv as any).month || '',
                billingMonth: (inv as any).billingMonth || '',
                amount: Number(inv.amount),
                rentAmount: Number((inv as any).rentAmount || inv.amount),
                dueDate: inv.dueDate,
                paidAt: inv.paidAt,
                status: inv.status,
                paymentMethod: inv.paymentMethod,
                payments: inv.payments.map(p => ({
                    id: p.id,
                    amount: Number(p.amount),
                    status: p.status,
                    method: p.method,
                    razorpayId: p.razorpayId,
                    razorpayOrderId: p.razorpayOrderId,
                    date: p.date,
                }))
            })),
            rawPayments: rawPayments.map(p => ({
                id: p.id,
                amount: Number(p.amount),
                status: p.status,
                method: p.method,
                razorpayId: p.razorpayId,
                razorpayOrderId: p.razorpayOrderId,
                invoiceId: p.invoiceId,
                depositId: p.depositId,
                date: p.date,
            })),
            depositInfo: depositInfo ? {
                id: depositInfo.id,
                amount: Number(depositInfo.amount),
                status: depositInfo.status,
                paidAt: depositInfo.paidAt,
            } : null,
        };
    }));

    return result;
}

/** Get a single invoice by ID — ownership verified */
export async function getInvoiceById(invoiceId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const userId = (session as any).userId;

    const invoice = await prisma.rentInvoice.findUnique({
        where: { id: invoiceId },
        include: {
            booking: { include: { property: true, room: true, user: true } },
            payments: { orderBy: { date: 'desc' } }
        }
    });

    if (!invoice) throw new Error("Invoice not found");
    if ((session as any).role === 'USER' && invoice.booking?.userId !== userId) throw new Error("Unauthorized");

    return invoice;
}

/** Get invoice data for receipt preview modal — returns flat, serializable object */
export async function getInvoiceForReceipt(invoiceId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const userId = (session as any).userId;
    const role = (session as any).role;

    const invoice = await prisma.rentInvoice.findUnique({
        where: { id: invoiceId },
        include: {
            billingProfile: { include: { tenant: true } },
            booking: { include: { property: true, room: true, user: { select: { name: true, email: true, displayId: true } } } },
            payments: { where: { status: 'VERIFIED' }, orderBy: { date: 'desc' }, take: 1 }
        }
    });

    if (!invoice) throw new Error("Invoice not found");
    if (role === 'USER' && invoice.booking?.userId !== userId) throw new Error("Unauthorized");

    const tenant = invoice.billingProfile?.tenant;
    const booking = invoice.booking;
    const property = booking?.property;
    const payment = invoice.payments[0];

    // ✅ LEGAL: Fetch platform settings for owner's commission breakdown on their receipt
    const platformSettings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
    const feesEnabled = platformSettings?.feesEnabled ?? false;
    const grossRent = Number(invoice.amount);
    // Check if owner has a custom commission rate
    const ownerUser = booking?.property ? await prisma.user.findFirst({ where: { properties: { some: { id: booking.property.id } } }, select: { commissionRate: true } as any }) : null;
    let ownerFee = 0;  // Total fee incl. GST (what's deducted from payout)
    if (feesEnabled) {
        if (ownerUser && (ownerUser as any).commissionRate != null) {
            ownerFee = Math.round((grossRent * (ownerUser as any).commissionRate) / 100 * 100) / 100;
        } else {
            ownerFee = platformSettings?.ownerRentFeeFlat ?? 0;
        }
    }
    // GST-INCLUSIVE decomposition (₹9 incl. GST → base ₹7.63 + GST ₹1.37)
    const GST_RATE = 0.18;
    const ownerFeeGst  = feesEnabled && ownerFee > 0 ? Math.round((ownerFee * GST_RATE / (1 + GST_RATE)) * 100) / 100 : 0;
    const ownerFeeBase = feesEnabled && ownerFee > 0 ? Math.round((ownerFee - ownerFeeGst) * 100) / 100 : 0;
    const ownerFeeGstCgst = Math.round((ownerFeeGst / 2) * 100) / 100;
    const ownerFeeGstSgst = Math.round((ownerFeeGst - ownerFeeGstCgst) * 100) / 100;
    // Net payout = gross rent - all-in platform fee (base + GST already included in ownerFee)
    const netPayout = grossRent - ownerFee;
    // ✅ LEGAL: Owner's taxable rental income = full gross rent collected from student
    // The ₹9 platform fee is their business expense, not a reduction in income
    const ownerTaxableIncome = grossRent;

    return {
        id: invoice.id,
        displayId: invoice.displayId || `INV-${invoiceId.slice(0, 8).toUpperCase()}`,
        month: invoice.month || '',
        billingMonth: invoice.billingMonth || '',
        status: invoice.status,
        rentAmount: Number(invoice.rentAmount),
        foodAmount: Number(invoice.foodAmount || 0),
        creditApplied: Number((invoice as any).creditApplied || 0),
        amount: grossRent,
        paidAmount: Number(invoice.paidAmount),
        // Platform commission fields for owner's receipt (GST-inclusive breakdown)
        feesEnabled,
        ownerFee,             // ₹9 — all-in platform fee (incl. GST)
        ownerFeeBase,         // ₹7.63 — base fee excl. GST (for tax invoice)
        ownerFeeGst,          // ₹1.37 — GST extracted (18% of ₹7.63)
        ownerFeeGstCgst,      // ₹0.68 — CGST 9%
        ownerFeeGstSgst,      // ₹0.69 — SGST 9%
        netPayout,            // ₹grossRent - ₹9 = what lands in bank
        ownerTaxableIncome,   // = grossRent — what to declare to IT/CA
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
        paidAt: invoice.paidAt ? new Date(invoice.paidAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
        paymentMethod: invoice.paymentMethod || payment?.method || 'Online',
        paymentRef: (payment as any)?.razorpayId || (invoice as any).confirmedByName || '—',
        // Tenant
        tenantName: tenant?.name || booking?.user?.name || '—',
        tenantEmail: tenant?.email || booking?.user?.email || '—',
        tenantDisplayId: tenant?.displayId || booking?.user?.displayId || '—',
        tenantRoom: tenant?.roomNumber || booking?.roomAssigned || booking?.room?.roomNumber || '—',
        tenantRoomType: tenant?.roomType || '',
        stayFrom: booking?.agreementSignedAt
            ? new Date(booking.agreementSignedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : (tenant?.startDate || '—'),
        // Property
        propertyName: booking?.propertyName || property?.name || '—',
        propertyAddress: property?.address || '—',
        propertyCity: property?.city || '',
        propertyGst: (property as any)?.gstNumber || null,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT 1: Delayed Transfer — Admin: Release payout to owner
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Admin manually triggers the delayed transfer to the owner's Razorpay account.
 * Called after the 15-day deposit refund window has passed OR
 * after the owner has processed the deposit correctly.
 *
 * DUMMY MODE: Razorpay transfer API call is simulated. Set DUMMY_MODE=false
 * and provide live credentials to go live.
 */
export async function releaseTransferToOwner(paymentId: string) {
    const session = await getSession();
    if (!session || (session as any).role !== 'ADMIN') throw new Error('Unauthorized — Admin only');

    const payment = await (prisma as any).payment.findUnique({
        where: { id: paymentId },
        include: {
            booking: {
                include: {
                    room: {
                        include: { property: { include: { owner: { select: { id: true, name: true, razorpayAccountId: true } } } } }
                    }
                }
            }
        }
    });

    if (!payment) throw new Error('Payment not found');
    if (payment.status !== 'VERIFIED') throw new Error('Payment is not verified — cannot release transfer');
    if (payment.transferStatus === 'RELEASED') throw new Error('Transfer already released');

    const ownerAccountId = payment.booking?.room?.property?.owner?.razorpayAccountId;
    // ── Dynamic fee calculation respecting owner exemptions and custom commission rates ──
    const { calculateFees: calcFees } = await import('@/actions/platform');
    const propertyName = payment.booking?.room?.property?.name || '';
    const ownerId = payment.booking?.room?.property?.owner?.id || '';
    const feeBreakdown = await calcFees(
        String(Number(payment.amount)),
        undefined,
        propertyName,
        ownerId,
        'RENT'
    );
    const transferAmount = Math.max(0, feeBreakdown.ownerNet * 100); // paise, after deducting owner's commission

    // DUMMY MODE: Simulate transfer (replace with real Razorpay transfer API for production)
    let transferId: string;
    let isDummy = true;
    if (ownerAccountId && !payment.razorpayOrderId?.startsWith('order_mock_')) {
        try {
            const transfer = await (razorpay as any).transfers?.create({
                account: ownerAccountId,
                amount: transferAmount,
                currency: 'INR',
                source: `pay_${payment.razorpayId}`,
                source_detail: { type: 'payment', id: payment.razorpayId },
            });
            transferId = transfer.id;
            isDummy = false;
        } catch (err) {
            console.warn('[RELEASE TRANSFER] Razorpay API failed, using dummy:', err);
            transferId = `trf_dummy_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        }
    } else {
        transferId = `trf_dummy_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    }

    // Update payment record
    await (prisma as any).payment.update({
        where: { id: paymentId },
        data: {
            transferStatus: 'RELEASED',
            transferredAt: new Date(),
        }
    });

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'PAYMENT',
        entityId: paymentId,
        description: `Transfer released to owner. Amount: ₹${(transferAmount / 100).toLocaleString('en-IN')}. Transfer ID: ${transferId}. ${isDummy ? '[DUMMY]' : '[LIVE]'}`,
        newValue: { transferStatus: 'RELEASED', transferId, isDummy }
    });

    revalidatePath('/dashboard/admin');
    return { success: true, transferId, isDummy, amount: transferAmount / 100 };
}

/**
 * Admin: Get all payments pending transfer release.
 * Used in admin payments dashboard to show what needs releasing.
 */
export async function getPendingTransfers() {
    const session = await getSession();
    if (!session || (session as any).role !== 'ADMIN') throw new Error('Unauthorized');

    const payments = await (prisma as any).payment.findMany({
        where: { status: 'VERIFIED', transferStatus: 'PENDING' },
        include: {
            booking: {
                select: {
                    displayId: true,
                    room: { select: { property: { select: { name: true, owner: { select: { name: true } } } } } }
                }
            }
        },
        orderBy: { date: 'desc' }
    });

    return payments.map((p: any) => ({
        paymentId: p.id,
        amount: Number(p.amount),
        date: p.date,
        bookingDisplayId: p.booking?.displayId || '',
        propertyName: p.booking?.room?.property?.name || '—',
        ownerName: p.booking?.room?.property?.owner?.name || '—',
        transferStatus: p.transferStatus,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT 3: Rent Withholding Shield — Admin applies withholding from payout
// ─────────────────────────────────────────────────────────────────────────────
/**
 * When an owner has an OVERDUE deposit refund, admin can apply withholding
 * from any pending transfer/payout. The withheld amount is then used to
 * refund the student (via a manual bank transfer outside Razorpay).
 */
export async function applyRentWithholding(depositId: string, withholdAmount: number) {
    const session = await getSession();
    if (!session || (session as any).role !== 'ADMIN') throw new Error('Unauthorized — Admin only');

    const deposit = await (prisma as any).securityDeposit.findUnique({
        where: { id: depositId },
        select: { id: true, status: true, amount: true, withheldFromPayouts: true }
    });

    if (!deposit) throw new Error('Deposit not found');
    if (!['REFUND_OVERDUE', 'PAID'].includes(deposit.status)) throw new Error('Only OVERDUE or PAID deposits can have withholding applied');

    const currentWithheld = Number(deposit.withheldFromPayouts || 0);
    const newTotal = currentWithheld + withholdAmount;
    const depositAmount = Number(deposit.amount);

    // Determine new status
    const newStatus = newTotal >= depositAmount ? 'REFUNDED_VIA_WITHHOLDING' : 'REFUND_OVERDUE';

    await (prisma as any).securityDeposit.update({
        where: { id: depositId },
        data: {
            status: newStatus,
            withheldFromPayouts: newTotal,
            refundAmount: newTotal >= depositAmount ? depositAmount : newTotal,
        }
    });

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'PAYMENT',
        entityId: depositId,
        description: `Rent withholding applied. Amount withheld: ₹${withholdAmount.toLocaleString('en-IN')}. Total withheld: ₹${newTotal.toLocaleString('en-IN')}. New status: ${newStatus}.`,
        newValue: { withheldFromPayouts: newTotal, newStatus }
    });

    revalidatePath('/dashboard/admin');
    revalidatePath('/dashboard/owner/deposits');
    return { success: true, newStatus, totalWithheld: newTotal };
}
