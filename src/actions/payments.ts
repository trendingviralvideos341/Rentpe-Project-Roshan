'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { razorpay } from "@/lib/razorpay";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email";
import { logAuditEvent } from "@/lib/audit";


export async function createRazorpayOrder(bookingId: string, extras?: { invoiceId?: string, depositId?: string }) {
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
        const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
        const studentFee = (settings?.feesEnabled && settings?.studentRentFeeFlat) || 0;

        // Determine amount from invoice, deposit, or booking (initial: rent + security deposit)
        let baseAmount: number;
        if (extras?.invoiceId) {
            const invoice = await prisma.rentInvoice.findUnique({ where: { id: extras.invoiceId } });
            baseAmount = invoice ? Number(invoice.amount) : Number(booking.amount);
        } else if (extras?.depositId) {
            const deposit = await prisma.securityDeposit.findUnique({ where: { id: extras.depositId } });
            baseAmount = deposit ? Number(deposit.amount) : Number(booking.amount);
        } else {
            // Initial booking payment: rent + security deposit
            baseAmount = Number(booking.amount) + Number((booking as any).depositAmount || 0);
        }

        const finalCharge = (baseAmount + studentFee) * 100; // in paise

        // ... (Transfers logic remains same, but using baseAmount)
        const room = await prisma.room.findUnique({
            where: { id: booking.roomId! },
            include: { property: { include: { owner: true } } }
        });
        const ownerAccountId = room?.property.owner.razorpayAccountId;
        const ownerFee = (settings?.feesEnabled && settings?.ownerRentFeeFlat) || 0;

        const options = {
            amount: finalCharge,
            currency: "INR",
            receipt: `receipt_${booking.id.slice(0, 5)}`,
        };

        let order: { id: string; amount: number; currency: string };
        try {
            const rzpOrder = await (razorpay.orders as any).create(ownerAccountId ? {
                ...options,
                transfers: [
                    {
                        account: ownerAccountId,
                        amount: (baseAmount - ownerFee) * 100,
                        currency: "INR",
                        on_linked_account_payout: "immediately"
                    }
                ]
            } : options);
            order = { id: rzpOrder.id, amount: rzpOrder.amount as number, currency: rzpOrder.currency };
        } catch (apiError: any) {
            console.warn("Razorpay API Error, using mock:", apiError);
            order = {
                id: `order_mock_${Math.random().toString(36).substring(2, 9)}`,
                amount: finalCharge,
                currency: "INR"
            };
        }

        await prisma.payment.create({
            data: {
                bookingId: booking.id,
                invoiceId: extras?.invoiceId,
                depositId: extras?.depositId,
                amount: baseAmount + studentFee,
                method: "ONLINE",
                status: "PENDING",
                razorpayOrderId: order.id,
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
        // 1. Update Payment
        await tx.payment.update({
            where: { id: payment.id },
            data: {
                status: "VERIFIED",
                razorpayId: data.razorpay_payment_id,
                verifiedBy: "SYSTEM"
            }
        });

        // 2. Clear related records
        if (payment.invoiceId) {
            await tx.rentInvoice.update({
                where: { id: payment.invoiceId },
                data: { status: 'PAID', paidAt: new Date(), paidAmount: payment.amount }
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

        // 4. Send Payment Receipt Email (Async)
        const user = await tx.user.findUnique({ where: { id: (session as any).userId }, select: { email: true, name: true } });
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

        revalidatePath("/dashboard/student");
        revalidatePath("/dashboard/owner/bookings");
        revalidatePath("/dashboard/owner/financials");

        // ✅ Audit Log — Payment Verified (appears in Admin Audit + Owner Activity Logs)
        logAuditEvent({
            actorId: (session as any).userId,
            actorRole: (session as any).role || 'USER',
            actorName: user?.name || 'Tenant',
            actionType: 'UPDATE',
            entityType: 'PAYMENT',
            entityId: payment.id,
            description: `Payment of ₹${payment.amount} verified. Razorpay ID: ${data.razorpay_payment_id}. Booking ID: ${payment.bookingId}.`,
            newValue: { status: 'VERIFIED', razorpayId: data.razorpay_payment_id, amount: payment.amount },
        });

        return { success: true };
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

    return {
        id: invoice.id,
        displayId: invoice.displayId || `INV-${invoiceId.slice(0, 8).toUpperCase()}`,
        month: invoice.month || '',
        billingMonth: invoice.billingMonth || '',
        status: invoice.status,
        rentAmount: Number(invoice.rentAmount),
        foodAmount: Number(invoice.foodAmount || 0),
        creditApplied: Number((invoice as any).creditApplied || 0),
        amount: Number(invoice.amount),
        paidAmount: Number(invoice.paidAmount),
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
        stayFrom: tenant?.startDate || '—',
        // Property
        propertyName: booking?.propertyName || property?.name || '—',
        propertyAddress: property?.address || '—',
        propertyCity: property?.city || '',
        propertyGst: (property as any)?.gstNumber || null,
    };
}
