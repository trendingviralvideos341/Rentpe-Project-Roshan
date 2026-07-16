'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { withSafeAction } from "@/lib/safe-action";
import { z } from "zod";

const exportSchema = z.object({
    year: z.string(),
    month: z.string(),
});

const toIST = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
};

async function getOwnerSession() {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const userId = (session as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const ownerId = user?.parentOwnerId || userId;
    const properties = await prisma.property.findMany({
        where: { ownerId, deletedAt: null },
        select: { id: true, name: true }
    });
    return { session, userId, ownerId, properties, user };
}

export const getExportRentInflows = withSafeAction(async ({ year, month }: z.infer<typeof exportSchema>) => {
    const { properties } = await getOwnerSession();
    const propertyIds = properties.map((p: any) => p.id);

    const isAllMonths = month === 'ALL';
    const y = parseInt(year, 10);
    let dateFilter: any = {};
    if (isAllMonths) {
        dateFilter = {
            gte: new Date(Date.UTC(y, 2, 31, 18, 30, 0, 0)),
            lt: new Date(Date.UTC(y + 1, 2, 31, 18, 30, 0, 0))
        };
    } else {
        const m = parseInt(month, 10);
        const queryYear = m < 4 ? y + 1 : y;
        const lastDay = new Date(queryYear, m, 0).getDate();
        dateFilter = {
            gte: new Date(`${queryYear}-${String(m).padStart(2, '0')}-01T00:00:00+05:30`),
            lt: new Date(`${queryYear}-${String(m).padStart(2, '0')}-${lastDay}T23:59:59.999+05:30`)
        };
    }
    
    const invoices = await prisma.rentInvoice.findMany({
        where: {
            propertyId: { in: propertyIds },
            paidAt: dateFilter,
            status: 'PAID'
        },
        include: {
            booking: {
                include: {
                    tenant: true,
                    property: true
                }
            }
        },
        orderBy: { paidAt: 'desc' }
    });

    return invoices.map(inv => ({
        "Receipt Voucher No. / Invoice No.": inv.displayId,
        "Date Paid": inv.paidAt ? toIST(inv.paidAt) : 'N/A',
        "Month": inv.billingMonth,
        "Property": inv.booking?.property?.name || '-',
        "Tenant": inv.booking?.tenant?.name || '-',
        "Room": inv.booking?.roomAssigned || '-',
        "Rent Amount": inv.rentAmount || 0,
        "Food & Catering Charges": inv.foodAmount || 0,
        "Credit Applied": inv.creditApplied || 0,
        "Gross Value Realised": inv.paidAmount || 0,
        "Payment Method": inv.paymentMethod || '-',
        "Reference": '-',
        "Status": inv.status
    }));
});

export const getExportPayouts = withSafeAction(async ({ year, month }: z.infer<typeof exportSchema>) => {
    const { ownerId } = await getOwnerSession();
    let whereClause: any = { ownerId };
    
    if (month === 'ALL') {
        const y = parseInt(year, 10);
        whereClause.createdAt = { gte: new Date(Date.UTC(y, 2, 31, 18, 30, 0, 0)), lt: new Date(Date.UTC(y + 1, 2, 31, 18, 30, 0, 0)) };
    } else {
        const nextMonth = parseInt(month, 10) === 12 ? 1 : parseInt(month, 10) + 1;
        const nextYear = parseInt(month, 10) === 12 ? parseInt(year, 10) + 1 : parseInt(year, 10);
        whereClause.createdAt = { gte: new Date(`${year}-${month}-01T00:00:00+05:30`), lt: new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+05:30`) };
    }

    const payouts = await prisma.ownerPayout.findMany({ where: whereClause, orderBy: { createdAt: 'desc' } });
    return payouts.map(p => ({
        "Payout ID": p.displayId,
        "Date": p.paidAt ? toIST(p.paidAt) : toIST(p.createdAt),
        "Period": p.period || '-',
        "Gross Rent Collected": p.grossAmount || 0,
        "Taxable Value of Supply (Commission)": p.commissionAmount || 0,
        "CGST Amount": 0,
        "SGST Amount": 0,
        "IGST Amount": 0,
        "Total Commission (incl. GST)": p.commissionAmount || 0,
        "TDS Deducted (u/s 194-O)": 0,
        "Net Payout": p.netAmount || 0,
        "UTR / Reference": p.txnReference || '-',
        "Status": p.status
    }));
});

export const getExportRefunds = withSafeAction(async ({ year, month }: z.infer<typeof exportSchema>) => {
    let whereClause: any = {};
    if (month === 'ALL') {
        const y = parseInt(year, 10);
        whereClause.initiatedAt = { gte: new Date(Date.UTC(y, 2, 31, 18, 30, 0, 0)), lt: new Date(Date.UTC(y + 1, 2, 31, 18, 30, 0, 0)) };
    } else {
        const nextMonth = parseInt(month, 10) === 12 ? 1 : parseInt(month, 10) + 1;
        const nextYear = parseInt(month, 10) === 12 ? parseInt(year, 10) + 1 : parseInt(year, 10);
        whereClause.initiatedAt = { gte: new Date(`${year}-${month}-01T00:00:00+05:30`), lt: new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+05:30`) };
    }

    const refunds = await prisma.refundRecord.findMany({ where: whereClause, orderBy: { initiatedAt: 'desc' } });
    return refunds.map((r: any) => ({
        "Refund ID": r.displayId || r.id,
        "Original Invoice Ref": "-",
        "Date Initiated": r.initiatedAt ? toIST(r.initiatedAt) : 'N/A',
        "Type": r.refundType || '-',
        "Reason": r.reason || '-',
        "Amount": r.amount || 0,
        "Deductions": 0,
        "GST Reversal Amount": r.gstRefunded || 0,
        "Net Refund": r.amount || 0,
        "Reference": r.txnReference || '-',
        "Status": r.status
    }));
});
