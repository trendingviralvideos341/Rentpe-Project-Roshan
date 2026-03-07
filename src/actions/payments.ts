'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { razorpay } from "@/lib/razorpay";
import { revalidatePath } from "next/cache";

export async function createRazorpayOrder(bookingId: string, extras?: { invoiceId?: string, depositId?: string }) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { user: true }
    });

    if (!booking) throw new Error("Booking not found");
    if (booking.userId !== (session as any).userId) throw new Error("Unauthorized");
    try {
        const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
        const studentFee = (settings?.feesEnabled && settings?.studentRentFeeFlat) || 0;

        // Determine amount from invoice, deposit, or booking
        let baseAmount = parseInt(booking.amount.replace(/[^0-9]/g, ""));
        
        if (extras?.invoiceId) {
            const invoice = await (prisma.rentInvoice as any).findUnique({ where: { id: extras.invoiceId } });
            if (invoice) baseAmount = invoice.amount;
        } else if (extras?.depositId) {
            const deposit = await (prisma.securityDeposit as any).findUnique({ where: { id: extras.depositId } });
            if (deposit) baseAmount = deposit.amount;
        }

        const finalCharge = (baseAmount + studentFee) * 100; // in paise

        // ... (Transfers logic remains same, but using baseAmount)
        const room = await prisma.room.findUnique({
            where: { id: booking.roomId! },
            include: { property: { include: { owner: true } } }
        });
        const ownerAccountId = room?.property.owner.razorpayAccountId;
        const ownerFee = (settings?.feesEnabled && settings?.ownerRentFeeFlat) || 0;

        const options: any = {
            amount: finalCharge,
            currency: "INR",
            receipt: `receipt_${booking.id.slice(0, 5)}`,
        };

        if (ownerAccountId) {
            options.transfers = [
                {
                    account: ownerAccountId,
                    amount: (baseAmount - ownerFee) * 100,
                    currency: "INR",
                    on_linked_account_payout: "immediately"
                }
            ];
        }

        let order: any;
        try {
            order = await razorpay.orders.create(options);
        } catch (apiError: any) {
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
            await (tx.rentInvoice as any).update({
                where: { id: payment.invoiceId },
                data: { status: 'PAID', paidAt: new Date(), paidAmount: payment.amount }
            });
        }
        
        if (payment.depositId) {
            await (tx.securityDeposit as any).update({
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

        revalidatePath("/dashboard/student");
        revalidatePath("/dashboard/owner/bookings");
        revalidatePath("/dashboard/owner/financials");
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

        // 1. Get initial booking payments
        const bookingPayments = await prisma.payment.findMany({
            where: {
                booking: { userId },
                status: 'VERIFIED'
            },
            include: {
                booking: { select: { propertyName: true } }
            },
            orderBy: { date: 'desc' }
        });

        // 2. Get monthly rent records
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
                    amount: parseFloat(r.amount.replace(/[^0-9.]/g, '')),
                    date: r.paidOn ? new Date(r.paidOn) : r.createdAt,
                    type: "MONTHLY_RENT",
                    description: `Rent for ${r.month} (${t.property.name})`,
                    status: "SUCCESS"
                }))
            );
        }

        // Format booking payments
        const formattedBookingPayments = bookingPayments.map(p => ({
            id: p.id,
            amount: p.amount,
            date: p.date,
            type: "INITIAL_BOOKING",
            description: `Booking advance for ${p.booking.propertyName}`,
            status: "SUCCESS" // Since we filtered by VERIFIED
        }));

        // Combine and sort
        const combined = [...formattedBookingPayments, ...rentRecords].sort((a, b) => b.date.getTime() - a.date.getTime());

        return combined;
    } catch (e) {
        console.error("getStudentPaymentHistory Error:", e);
        return [];
    }
}
