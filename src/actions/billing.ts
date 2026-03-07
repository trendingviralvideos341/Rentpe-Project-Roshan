'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Financial System: Core Billing & Deposit Actions
 */

export async function createBillingProfile(tenantId: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { property: true }
    });

    if (!tenant) throw new Error("Tenant not found");

    // Check if profile already exists
    const existing = await prisma.billingProfile.findUnique({ where: { tenantId } });
    if (existing) return existing;

    const rentAmount = parseFloat(tenant.rent.replace(/[^0-9.]/g, ''));
    const depositAmount = rentAmount; // Standard: 1 Month Rent as Deposit

    return await prisma.$transaction(async (tx) => {
        // 1. Create Billing Profile
        const profile = await tx.billingProfile.create({
            data: {
                tenantId,
                propertyId: tenant.propertyId,
                roomId: tenant.roomId,
                bedId: tenant.bedId,
                monthlyRent: rentAmount,
                securityDeposit: depositAmount,
                billingDay: new Date(tenant.startDate).getDate() || 1
            }
        });

        // 2. Initialize Security Deposit record
        await tx.securityDeposit.create({
            data: {
                billingProfileId: profile.id,
                tenantId,
                amount: depositAmount,
                status: 'PENDING'
            }
        });

        await tx.auditLog.create({
            data: {
                action: 'BILLING_PROFILE_CREATED',
                targetId: tenantId,
                targetType: 'TENANT',
                details: `Billing profile initialized. Monthly Rent: ₹${rentAmount}, Deposit: ₹${depositAmount}.`,
                performedBy: (session as any).userId
            }
        });

        return profile;
    });
}

export async function generateInvoice(tenantId: string, month: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const profile = await prisma.billingProfile.findUnique({
        where: { tenantId },
        include: { tenant: true }
    });

    if (!profile) throw new Error("Billing profile not found. Create one first.");

    // Check for duplicate invoice
    const existing = await prisma.rentInvoice.findFirst({
        where: { tenantId, month }
    });
    if (existing) throw new Error(`Invoice for ${month} already exists.`);

    const displayId = `INV-${Math.floor(Math.random() * 900000) + 100000}`;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5); // Due in 5 days

    const invoice = await prisma.rentInvoice.create({
        data: {
            displayId,
            billingProfileId: profile.id,
            tenantId,
            propertyId: profile.propertyId,
            month,
            amount: profile.monthlyRent,
            dueDate,
            status: 'PENDING'
        }
    });

    await prisma.auditLog.create({
        data: {
            action: 'INVOICE_GENERATED',
            targetId: tenantId,
            targetType: 'TENANT',
            details: `Invoice ${displayId} generated for ${month} (₹${profile.monthlyRent})`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/owner/tenants');
    return invoice;
}

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

    const unpaidRent = tenant.billingProfile.invoices.reduce((acc, inv) => acc + (inv.amount - inv.paidAmount), 0);
    const deposit = tenant.billingProfile.deposit?.amount || 0;
    const finalRefund = deposit - unpaidRent - options.deductions;

    return await prisma.$transaction(async (tx) => {
        const settlement = await tx.settlementRecord.create({
            data: {
                tenantId,
                finalRentPending: unpaidRent,
                damageDeductions: options.deductions,
                depositRefunded: finalRefund > 0 ? finalRefund : 0,
                notes: options.notes
            }
        });

        // Mark profile as closed
        await tx.billingProfile.update({
            where: { id: tenant.billingProfile!.id },
            data: { status: 'CLOSED' }
        });

        // Update deposit status
        if (tenant.billingProfile!.deposit) {
            await tx.securityDeposit.update({
                where: { id: tenant.billingProfile!.deposit!.id },
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
