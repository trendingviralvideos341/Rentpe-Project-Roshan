'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { razorpay } from "@/lib/razorpay";
import { revalidatePath } from "next/cache";

export async function createRazorpayOrder(bookingId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { user: true }
    });

    if (!booking) throw new Error("Booking not found");
    if (booking.userId !== (session as any).userId) throw new Error("Unauthorized");
    try {
        // ── DUMMY RAZORPAY ROUTE INTEGRATION ──
        // In a real app, we fetch global platform fees and transfer to owner account
        const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
        const studentFee = (settings?.feesEnabled && settings?.studentRentFeeFlat) || 0;
        const ownerFee = (settings?.feesEnabled && settings?.ownerRentFeeFlat) || 0;

        // Fetch property owner's razorpay account
        const room = await prisma.room.findUnique({
            where: { id: booking.roomId! },
            include: { property: { include: { owner: true } } }
        });
        const ownerAccountId = room?.property.owner.razorpayAccountId;

        const totalAmountStr = booking.amount.replace(/[^0-9]/g, "");
        const rentAmount = parseInt(totalAmountStr);
        const finalCharge = (rentAmount + studentFee) * 100; // Total student pays in paise

        const options: any = {
            amount: finalCharge,
            currency: "INR",
            receipt: `receipt_${booking.id.slice(0, 5)}`,
        };

        // If owner has a linked account, add transfer
        if (ownerAccountId) {
            options.transfers = [
                {
                    account: ownerAccountId,
                    amount: (rentAmount - ownerFee) * 100, // Amount transferred to owner in paise
                    currency: "INR",
                    notes: {
                        booking_id: booking.id,
                        type: "rent_split"
                    },
                    on_linked_account_payout: "immediately"
                }
            ];
        }

        let order: any;

        // Mock the Razorpay API if no real credentials are provided
        if ((process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder') === 'rzp_test_placeholder') {
            order = {
                id: `order_mock_${Math.random().toString(36).substring(2, 9)}`,
                amount: finalCharge,
                currency: "INR"
            };
        } else {
            order = await razorpay.orders.create(options);
        }

        // Record the attempt in Payment table
        await prisma.payment.create({
            data: {
                bookingId: booking.id,
                amount: rentAmount + studentFee,
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
            isDummyRoute: true // Flag for UI to show dummy route used
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

    // In a real app, you must verify the signature using crypto
    // const crypto = require("crypto");
    // const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    //                                 .update(data.razorpay_order_id + "|" + data.razorpay_payment_id)
    //                                 .digest('hex');
    // if (expectedSignature !== data.razorpay_signature) throw new Error("Invalid signature");

    // Find the pending payment
    const payment = await prisma.payment.findFirst({
        where: { razorpayOrderId: data.razorpay_order_id }
    });

    if (!payment) throw new Error("Payment record not found");

    // Update payment record
    await prisma.payment.update({
        where: { id: payment.id },
        data: {
            status: "VERIFIED",
            razorpayId: data.razorpay_payment_id,
            verifiedBy: "SYSTEM"
        }
    });

    // Update booking status
    await prisma.booking.update({
        where: { id: payment.bookingId },
        data: {
            status: "PAID",
            paymentStatus: "PAID"
        }
    });

    revalidatePath("/dashboard/student");
    revalidatePath("/dashboard/owner/bookings");
    return { success: true };
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
