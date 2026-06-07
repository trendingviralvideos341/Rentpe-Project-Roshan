'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * Returns the current month's pending (unpaid) RentInvoice for the logged-in
 * active tenant. Returns null if tenant is not Active or no pending invoice.
 *
 * Used by the student dashboard to render the blinking red rent-due banner.
 */
export async function getPendingRentInvoice() {
    try {
        const session = await getSession();
        if (!session || (session as any).role !== 'USER') return null;

        const userId = (session as any).userId;

        // 1. Find the active booking for this user
        const booking = await prisma.booking.findFirst({
            where: {
                userId,
                status: { in: ['ACTIVE', 'CHECKED_IN', 'CHECKIN_CONFIRMED'] },
            },
            select: {
                id: true,
                displayId: true,
                propertyName: true,
                tenant: {
                    select: {
                        id: true,
                        displayId: true,
                        status: true,
                        rent: true,
                        billingProfile: {
                            select: {
                                id: true,
                                invoices: {
                                    where: { status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
                                    orderBy: { dueDate: 'desc' },
                                    take: 1,
                                    select: {
                                        id: true,
                                        displayId: true,
                                        month: true,
                                        billingMonth: true,
                                        amount: true,
                                        rentAmount: true,
                                        foodAmount: true,
                                        dueDate: true,
                                        status: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!booking || !booking.tenant) return null;
        const tenant = booking.tenant;

        // Only show banner for Active tenants
        if (tenant.status !== 'Active') return null;

        const pendingInvoice = tenant.billingProfile?.invoices?.[0] ?? null;
        if (!pendingInvoice) return null;

        return {
            bookingId: booking.id,
            bookingDisplayId: booking.displayId,
            propertyName: booking.propertyName,
            tenantId: tenant.id,
            tenantDisplayId: tenant.displayId,
            invoice: {
                id: pendingInvoice.id,
                displayId: pendingInvoice.displayId,
                month: pendingInvoice.month,
                billingMonth: pendingInvoice.billingMonth,
                amount: Number(pendingInvoice.amount),
                rentAmount: Number(pendingInvoice.rentAmount),
                foodAmount: Number(pendingInvoice.foodAmount),
                dueDate: pendingInvoice.dueDate,
                status: pendingInvoice.status,
            },
        };
    } catch (err) {
        console.error('[getPendingRentInvoice] Error:', err);
        return null;
    }
}
