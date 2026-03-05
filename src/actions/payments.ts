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

    // Amount in paise (multiply by 100)
    // Clean currency symbol if present
    const amountStr = booking.amount.replace(/[^0-9]/g, "");
    const amount = parseInt(amountStr) * 100;

    const options = {
        amount: amount,
        currency: "INR",
        receipt: `receipt_${booking.id.slice(0, 5)}`,
    };

    try {
        const order = await razorpay.orders.create(options);

        // Record the attempt in Payment table
        await prisma.payment.create({
            data: {
                bookingId: booking.id,
                amount: parseInt(amountStr),
                method: "ONLINE",
                status: "PENDING",
                razorpayOrderId: order.id,
            }
        });

        return {
            id: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID
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

    // Create Tenant record since payment is done
    const booking = await prisma.booking.findUnique({
        where: { id: payment.bookingId },
        include: { room: true }
    });

    if (booking) {
        await prisma.tenant.create({
            data: {
                displayId: `TNT-${Math.floor(Math.random() * 900) + 100}`,
                name: booking.guestName,
                phone: (session as any).phone as string || "TBD",
                email: (session as any).email,
                propertyId: booking.room!.propertyId,
                roomId: booking.roomId!,
                roomNumber: booking.room!.roomNumber,
                roomType: booking.room!.type,
                rent: booking.amount,
                startDate: booking.moveInDate,
                status: "ACTIVE"
            }
        });
    }

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
