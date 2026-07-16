'use server';

import prisma from "@/lib/prisma";
import { getOwnerSession } from "./auth";
import { action } from "@/lib/safe-action";
import { z } from "zod";

const exportSchema = z.object({
    year: z.string(),
    month: z.string(), // "ALL" or "01", "02", etc.
});

// Helper for IST dates
const toIST = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
};

export const getExportRentInflows = action(exportSchema, async ({ year, month }) => {
    const { ownerId, properties } = await getOwnerSession();
    const propertyIds = properties.map((p: any) => p.id);

    const isAllMonths = month === 'ALL';
    
    // Invoices
    const invoices = await prisma.rentInvoice.findMany({
        where: {
            propertyId: { in: propertyIds },
            billingMonth: isAllMonths ? { startsWith: `${year}-` } : `${year}-${month}`,
            status: 'PAID'
        },
        include: {
            tenant: true,
            property: true
        },
        orderBy: { paidAt: 'desc' }
    });

    // Format data for Excel (Compliant with GST & CA terminology)
    const data = invoices.map(inv => ({
        "Receipt Voucher No. / Invoice No.": inv.displayId,
        "Date Paid": inv.paidAt ? toIST(inv.paidAt) : 'N/A',
        "Month": inv.billingMonth,
        "Property": inv.property?.name || '-',
        "Tenant": inv.tenant?.name || '-',
        "Room": inv.tenant?.roomNumber || '-',
        "Rent Amount": inv.amount || 0,
        "Food & Catering Charges": inv.foodAmount || 0,
        "Credit Applied": inv.creditApplied || 0,
        "Gross Value Realised": inv.paidAmount || 0,
        "Payment Method": inv.paymentMethod || '-',
        "Reference": inv.paymentRef || '-',
        "Status": inv.status
    }));

    return data;
});

export const getExportPayouts = action(exportSchema, async ({ year, month }) => {
    const { ownerId } = await getOwnerSession();

    let whereClause: any = { ownerId };
    
    if (month === 'ALL') {
        const startDate = new Date(`${year}-01-01T00:00:00+05:30`);
        const endDate = new Date(`${parseInt(year, 10) + 1}-01-01T00:00:00+05:30`);
        whereClause.createdAt = { gte: startDate, lt: endDate };
    } else {
        const nextMonth = parseInt(month, 10) === 12 ? 1 : parseInt(month, 10) + 1;
        const nextYear = parseInt(month, 10) === 12 ? parseInt(year, 10) + 1 : parseInt(year, 10);
        const startDate = new Date(`${year}-${month}-01T00:00:00+05:30`);
        const endDate = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+05:30`);
        whereClause.createdAt = { gte: startDate, lt: endDate };
    }

    const payouts = await prisma.payout.findMany({
        where: whereClause,
        include: {
            property: true
        },
        orderBy: { createdAt: 'desc' }
    });

    // Format data for Excel (Compliant with GST & CA terminology)
    const data = payouts.map(p => ({
        "Payout ID": p.displayId,
        "Date": p.paidAt ? toIST(p.paidAt) : toIST(p.createdAt),
        "Property": p.property?.name || '-',
        "Period": p.period || '-',
        "Gross Rent Collected": p.grossAmount || 0,
        "Taxable Value of Supply (Commission)": p.commissionBase || 0,
        "CGST Amount": p.cgst || 0,
        "SGST Amount": p.sgst || 0,
        "IGST Amount": 0, // Placeholder for future interstate transactions
        "Total Commission (incl. GST)": p.commissionAmount || 0,
        "TDS Deducted (u/s 194-O)": p.tdsAmount || 0,
        "Net Payout": p.netAmount || 0,
        "UTR / Reference": p.txnReference || '-',
        "Status": p.status
    }));

    return data;
});

export const getExportRefunds = action(exportSchema, async ({ year, month }) => {
    const { ownerId } = await getOwnerSession();

    let whereClause: any = { ownerId };
    
    if (month === 'ALL') {
        const startDate = new Date(`${year}-01-01T00:00:00+05:30`);
        const endDate = new Date(`${parseInt(year, 10) + 1}-01-01T00:00:00+05:30`);
        whereClause.initiatedAt = { gte: startDate, lt: endDate };
    } else {
        const nextMonth = parseInt(month, 10) === 12 ? 1 : parseInt(month, 10) + 1;
        const nextYear = parseInt(month, 10) === 12 ? parseInt(year, 10) + 1 : parseInt(year, 10);
        const startDate = new Date(`${year}-${month}-01T00:00:00+05:30`);
        const endDate = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+05:30`);
        whereClause.initiatedAt = { gte: startDate, lt: endDate };
    }

    const refunds = await prisma.refund.findMany({
        where: whereClause,
        include: {
            tenant: true
        },
        orderBy: { initiatedAt: 'desc' }
    });

    // Format data for Excel (Compliant with GST & CA terminology)
    const data = refunds.map(r => ({
        "Refund ID": r.displayId || r.id,
        "Original Invoice Ref": "-", // Required by Section 34 CGST Act (Credit Notes)
        "Date Initiated": r.initiatedAt ? toIST(r.initiatedAt) : 'N/A',
        "Tenant": r.tenant?.name || '-',
        "Type": r.type || '-',
        "Reason": r.reason || '-',
        "Amount": r.amount || 0,
        "Deductions": r.deductions || 0,
        "GST Reversal Amount": 0, // GST reversal requirement
        "Net Refund": r.netRefund || 0,
        "Reference": r.txnReference || '-',
        "Status": r.status
    }));

    return data;
});
