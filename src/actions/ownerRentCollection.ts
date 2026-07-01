'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { generateMasterId } from "@/lib/ids";
import { sendEmail } from "@/lib/email";
import { internalGenerateInvoice } from "@/actions/billing";

// ────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────
// TASK 1 — RENT COLLECTION
// ────────────────────────────────────────────────────────

export async function getOwnerRentCollection(month?: string, propertyId?: string) {
    const { properties } = await getOwnerSession();
    const propertyIds = propertyId
        ? properties.filter((p: any) => p.id === propertyId).map((p: any) => p.id)
        : properties.map((p: any) => p.id);

    const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    // Ensure all active tenants in these properties have their invoices & rent records generated for targetMonth
    const currentBillingMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    if (targetMonth <= currentBillingMonth) {
        const activeTenants = await prisma.tenant.findMany({
            where: {
                propertyId: { in: propertyIds },
                // DB has mixed status values — include all active variants
                status: { in: ['Active', 'ACTIVE', 'ACTIVE_TENANT'] },
            },
            include: {
                billingProfile: true
            }
        });

        const [yr, mo] = targetMonth.split('-').map(Number);
        const monthLabel = new Date(yr, mo - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

        for (const tenant of activeTenants) {
            if (!tenant.billingProfile) continue;

            const existingInvoice = await prisma.rentInvoice.findFirst({
                where: { tenantId: tenant.id, billingMonth: targetMonth }
            });

            if (!existingInvoice) {
                try {
                    // CRITICAL: internalGenerateInvoice expects YYYY-MM format, NOT the human label
                    await internalGenerateInvoice(tenant.id, targetMonth, "SYSTEM");
                    console.log(`[getOwnerRentCollection] Auto-generated invoice for tenant ${tenant.id} for ${targetMonth}`);
                } catch (e) {
                    console.error(`[getOwnerRentCollection] Error generating invoice for tenant ${tenant.id}:`, e);
                }
            }

            const existingRecord = await prisma.rentRecord.findFirst({
                where: { tenantId: tenant.id, month: monthLabel }
            });

            if (!existingRecord) {
                try {
                    await prisma.rentRecord.create({
                        data: {
                            tenantId: tenant.id,
                            month: monthLabel,
                            amount: tenant.rent,
                            paid: false,
                        }
                    });
                } catch (e) {
                    console.error(`[getOwnerRentCollection] Error generating RentRecord for tenant ${tenant.id}:`, e);
                }
            }
        }
    }

    const invoices = await prisma.rentInvoice.findMany({
        where: {
            propertyId: { in: propertyIds },
            billingMonth: targetMonth,
        },
        include: {
            billingProfile: {
                include: {
                    tenant: {
                        select: { id: true, displayId: true, name: true, phone: true, email: true, roomNumber: true, roomType: true }
                    }
                }
            },
            booking: { select: { propertyName: true } }
        },
        orderBy: { dueDate: 'asc' }
    });

    // All invoices for history (all months) per tenant
    const tenantIds = [...new Set(invoices.map((inv: any) => inv.tenantId))];
    const allInvoices = tenantIds.length > 0 ? await prisma.rentInvoice.findMany({
        where: { tenantId: { in: tenantIds } },
        select: {
            id: true,
            tenantId: true,
            month: true,
            billingMonth: true,
            amount: true,
            paidAmount: true,
            status: true,
            paidAt: true,
            paymentMethod: true,
            confirmedByName: true,
            payments: {
                where: { status: 'VERIFIED' },
                select: {
                    id: true,
                    platformFee: {
                        select: {
                            ownerFee: true,
                            gstOnOwnerFee: true,
                        }
                    }
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    }) : [];

    const historyByTenant: Record<string, any[]> = {};
    for (const inv of allInvoices) {
        if (!historyByTenant[inv.tenantId]) historyByTenant[inv.tenantId] = [];
        historyByTenant[inv.tenantId].push(inv);
    }

    const today = new Date();

    const rentRows = invoices.map((inv: any) => {
        const daysOverdue = inv.status !== 'PAID' && inv.dueDate < today
            ? Math.ceil((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000)
            : 0;

        return {
            id: inv.id,
            displayId: inv.displayId,
            tenantId: inv.billingProfile?.tenant?.id,
            tenantDisplayId: inv.billingProfile?.tenant?.displayId || '',
            tenantName: inv.billingProfile?.tenant?.name || 'Unknown',
            tenantPhone: inv.billingProfile?.tenant?.phone || '',
            tenantEmail: inv.billingProfile?.tenant?.email || '',
            propertyName: inv.booking?.propertyName || '',
            roomNumber: inv.billingProfile?.tenant?.roomNumber || '',
            roomType: inv.billingProfile?.tenant?.roomType || '',
            month: inv.month,
            billingMonth: inv.billingMonth,
            amount: inv.amount,
            paidAmount: inv.paidAmount,
            dueDate: inv.dueDate,
            status: inv.status,
            paidAt: inv.paidAt,
            paymentMethod: inv.paymentMethod || null,
            confirmedBy: inv.confirmedBy || null,
            confirmedByName: inv.confirmedByName || null,
            daysOverdue,
            history: historyByTenant[inv.tenantId] || [],
            txnType: 'RENT',
        };
    });

    // ── TOKEN PAYMENTS: fetch bookings for this owner's properties that have tokenPaidAt set ──
    const [yr, mo] = targetMonth.split('-').map(Number);
    const monthStart = new Date(yr, mo - 1, 1);
    const monthEnd = new Date(yr, mo, 1);

    const tokenBookings = await prisma.booking.findMany({
        where: {
            propertyId: { in: propertyIds },
            tokenPaidAt: { gte: monthStart, lt: monthEnd },
        },
        select: {
            id: true,
            displayId: true,
            tokenAmount: true,
            tokenPaidAt: true,
            tokenPaymentId: true,
            paymentMethod: true,
            propertyName: true,
            guestName: true,
            guestPhone: true,
            guestEmail: true,
            roomAssigned: true,
            occupancy: true,
            status: true,
        },
        orderBy: { tokenPaidAt: 'desc' },
    });

    const tokenRows = tokenBookings.map((b: any) => ({
        id: `TOKEN-${b.id}`,
        displayId: `TKN-${b.displayId}`,
        tenantId: null,
        tenantDisplayId: b.displayId,
        tenantName: b.guestName || 'Unknown',
        tenantPhone: b.guestPhone || '',
        tenantEmail: b.guestEmail || '',
        propertyName: b.propertyName || '',
        roomNumber: b.roomAssigned || '—',
        roomType: b.occupancy || '',
        month: new Date(yr, mo - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
        billingMonth: targetMonth,
        amount: Number(b.tokenAmount || 1000),
        paidAmount: Number(b.tokenAmount || 1000),
        dueDate: b.tokenPaidAt,
        status: 'PAID',
        paidAt: b.tokenPaidAt,
        paymentMethod: b.paymentMethod === 'CASH' ? 'CASH' : 'RAZORPAY',
        confirmedBy: null,
        confirmedByName: b.paymentMethod === 'CASH' ? 'Owner (Cash)' : 'Razorpay Auto',
        daysOverdue: 0,
        history: [],
        txnType: 'TOKEN_PAYMENT',
        tokenPaymentId: b.tokenPaymentId || null,
        bookingStatus: b.status,
    }));

    const combined = [...rentRows, ...tokenRows];
    combined.sort((a, b) => {
        const dateA = new Date(a.paidAt || a.dueDate).getTime();
        const dateB = new Date(b.paidAt || b.dueDate).getTime();
        return dateB - dateA;
    });
    return combined;
}

export async function markInvoiceAsCashPaid(invoiceId: string, note?: string) {
    const { session, userId, user } = await getOwnerSession();
    const actorName = user?.name || 'Owner';
    const actorRole = user?.parentOwnerId ? 'STAFF' : 'OWNER';

    const invoice = await prisma.rentInvoice.findUnique({
        where: { id: invoiceId },
        include: {
            billingProfile: { include: { tenant: true } },
            booking: { select: { propertyName: true, userId: true } }
        }
    });
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status === 'PAID') throw new Error('Invoice already paid');

    const tenant = invoice.billingProfile?.tenant;

    await prisma.rentInvoice.update({
        where: { id: invoiceId },
        data: {
            status: 'PAID',
            paidAmount: invoice.amount,
            paidAt: new Date(),
            paymentMethod: 'CASH',
            confirmedBy: userId,
            confirmedByName: actorName,
        }
    });

    // Notify tenant
    try {
        if (invoice.booking?.userId) {
            await prisma.notification.create({
                data: {
                    userId: invoice.booking.userId,
                    type: 'PAYMENT',
                    category: 'CASH_PAYMENT_CONFIRMED',
                    message: `Cash payment of ₹${invoice.amount} for ${invoice.month} confirmed by ${actorName}.`,
                    isPersistent: true,
                }
            });
        }
    } catch (e) { console.error('Notify error:', e); }

    logAuditEvent({
        actorId: userId,
        actorRole,
        actorName,
        actionType: 'UPDATE',
        entityType: 'PAYMENT',
        entityId: invoiceId,
        description: `Cash payment of ₹${invoice.amount} confirmed for ${tenant?.name || 'tenant'} (${invoice.month}). Note: ${note || 'None'}`,
    });

    revalidatePath('/dashboard/owner/payments');
    return { tenantName: tenant?.name, amount: invoice.amount };
}


export async function sendRentReminder(invoiceId: string) {
    const { user: actorUser } = await getOwnerSession();

    const invoice = await prisma.rentInvoice.findUnique({
        where: { id: invoiceId },
        include: {
            billingProfile: {
                include: { tenant: true }
            },
            booking: { select: { propertyName: true } }
        }
    });

    if (!invoice) throw new Error("Invoice not found");
    const tenant = invoice.billingProfile?.tenant;
    if (!tenant) throw new Error("Tenant not found");

    const ownerName = actorUser?.businessName || actorUser?.name || 'Your PG Owner';
    const propertyName = (invoice as any).booking?.propertyName || 'your PG';
    const roomNumber = tenant.roomNumber;
    const amount = invoice.amount - invoice.paidAmount;
    const dueDate = new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    // In-app notification to tenant
    const tenantBooking = await prisma.booking.findFirst({
        where: { tenantId: tenant.id },
        select: { userId: true }
    });

    if (tenantBooking?.userId) {
        await prisma.notification.create({
            data: {
                userId: tenantBooking.userId,
                type: 'RENT_REMINDER',
                category: 'PAYMENT',
                message: `📋 Rent reminder from ${ownerName}. Amount due: ₹${amount.toLocaleString('en-IN')} for ${invoice.month}. Due date: ${dueDate}.`,
                isPersistent: true,
                metadata: JSON.stringify({ invoiceId, amount, dueDate }),
            }
        });
    }

    // Send Email reminder if tenant has email
    if (tenant.email) {
        sendEmail({
            to: tenant.email,
            subject: `Rent Reminder — ₹${amount.toLocaleString('en-IN')} due for ${invoice.month}`,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #e2e8f0;border-radius:12px;">
                <h2 style="color:#4f46e5;">Rent Payment Reminder</h2>
                <p>Dear ${tenant.name},</p>
                <p>This is a reminder from <strong>${ownerName}</strong> regarding your rent payment.</p>
                <div style="background:#f8fafc;padding:16px;border-radius:8px;margin:16px 0;">
                    <p style="margin:4px 0;"><strong>Property:</strong> ${propertyName}</p>
                    <p style="margin:4px 0;"><strong>Room:</strong> ${roomNumber}</p>
                    <p style="margin:4px 0;"><strong>Month:</strong> ${invoice.month}</p>
                    <p style="margin:4px 0;"><strong>Amount Due:</strong> ₹${amount.toLocaleString('en-IN')}</p>
                    <p style="margin:4px 0;"><strong>Due Date:</strong> ${dueDate}</p>
                </div>
                <p>Please make the payment at your earliest convenience.</p>
                <p>Thank you,<br/>RentPe Platform</p>
            </div>`
        }).catch((e: Error) => console.error('[RentReminder email]', e.message));
    }

    logAuditEvent({
        actorId: actorUser?.id || 'SYSTEM',
        actorRole: actorUser?.parentOwnerId ? 'STAFF' : 'OWNER',
        actorName: ownerName,
        actionType: 'CREATE',
        entityType: 'PAYMENT',
        entityId: invoiceId,
        description: `Rent reminder sent to ${tenant.name} for invoice ${invoice.displayId}. Amount: ₹${amount}`,
    });

    // Return WhatsApp message for frontend to open URL
    const whatsappMessage = encodeURIComponent(
        `Dear ${tenant.name},\n\nThis is a reminder from ${ownerName} regarding your rent payment.\n\n` +
        `Property: ${propertyName}\nRoom: ${roomNumber}\nMonth: ${invoice.month}\n` +
        `Amount Due: ₹${amount.toLocaleString('en-IN')}\nDue Date: ${dueDate}\n\n` +
        `Please make the payment at your earliest convenience.\n\nThank you,\nRentPe Platform`
    );

    return {
        success: true,
        whatsappUrl: tenant.phone ? `https://wa.me/91${tenant.phone.replace(/\D/g, '')}?text=${whatsappMessage}` : null,
        tenantName: tenant.name,
    };
}

// ────────────────────────────────────────────────────────
// TASK 2 — TENANT MOVEMENT LOG
// ────────────────────────────────────────────────────────

export async function getTenantMovementLog(propertyId?: string, month?: string) {
    const { properties } = await getOwnerSession();
    const propertyIds = propertyId
        ? properties.filter((p: any) => p.id === propertyId).map((p: any) => p.id)
        : properties.map((p: any) => p.id);

    const tenants = await prisma.tenant.findMany({
        where: { propertyId: { in: propertyIds } },
        include: {
            property: { select: { name: true } },
            room: { select: { roomNumber: true, type: true } },
            booking: { select: { agreementSignedAt: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    const now = new Date();
    const monthStart = month
        ? new Date(`${month}-01`)
        : new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    // Build timeline events
    const events: any[] = [];

    for (const t of tenants) {
        const moveInDate = t.booking?.agreementSignedAt ? new Date(t.booking.agreementSignedAt) : new Date(t.startDate);
        const moveOutDate = t.actualMoveOutDate ? new Date(t.actualMoveOutDate) : null;

        // Move-In event
        if (!month || (moveInDate >= monthStart && moveInDate < monthEnd)) {
            events.push({
                id: `in-${t.id}`,
                type: 'MOVE_IN',
                tenantId: t.id,
                tenantName: t.name,
                propertyName: (t as any).property?.name || '',
                roomNumber: t.roomNumber,
                date: moveInDate,
                status: t.status,
            });
        }

        // Move-Out event
        if (moveOutDate && (!month || (moveOutDate >= monthStart && moveOutDate < monthEnd))) {
            events.push({
                id: `out-${t.id}`,
                type: 'MOVE_OUT',
                tenantId: t.id,
                tenantName: t.name,
                propertyName: (t as any).property?.name || '',
                roomNumber: t.roomNumber,
                date: moveOutDate,
                status: t.status,
            });
        }
    }

    events.sort((a, b) => b.date.getTime() - a.date.getTime());

    const moveInsThisMonth = events.filter(e => e.type === 'MOVE_IN').length;
    const moveOutsThisMonth = events.filter(e => e.type === 'MOVE_OUT').length;

    return {
        events,
        summary: {
            moveIns: moveInsThisMonth,
            moveOuts: moveOutsThisMonth,
            netChange: moveInsThisMonth - moveOutsThisMonth,
        },
        properties,
    };
}

// ────────────────────────────────────────────────────────
// TASK 3 — SECURITY DEPOSIT TRACKER
// ────────────────────────────────────────────────────────

export async function getOwnerDeposits() {
    const { properties } = await getOwnerSession();
    const propertyIds = properties.map((p: any) => p.id);

    const profiles = await prisma.billingProfile.findMany({
        where: { propertyId: { in: propertyIds } },
        include: {
            deposit: {
                include: {
                    payments: { orderBy: { date: 'desc' }, take: 1 }
                }
            },
            tenant: {
                select: {
                    displayId: true, name: true, phone: true, email: true,
                    roomNumber: true, roomType: true, rent: true,
                    booking: {
                        select: {
                            displayId: true,
                            id: true,
                            paymentMethod: true,
                            roomAssigned: true,
                            payments: {
                                where: { status: 'VERIFIED' }
                            }
                        }
                    }
                }
            }
        }
    });

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const deposits = profiles
        .filter((p: any) => p.deposit)
        .map((p: any) => {
            const dep = p.deposit;
            const lastPayment = dep.payments?.[0];
            const bookingPayments = (p.tenant as any)?.booking?.payments || [];
            
            // Find deposit payment
            const depositPayment = lastPayment;
            // Fallback: joining payment (no invoiceId, no depositId)
            const joiningPayment = depositPayment || bookingPayments.find(
                (pay: any) => !pay.invoiceId && !pay.depositId && (pay.status === 'VERIFIED' || pay.status === 'SUCCESS')
            );
            // Fallback: any verified payment on the booking
            const anyVerifiedPayment = joiningPayment || bookingPayments.find(
                (pay: any) => pay.status === 'VERIFIED' || pay.status === 'SUCCESS'
            );

            const rawMethod = lastPayment?.method || anyVerifiedPayment?.method || (p.tenant as any)?.booking?.paymentMethod || null;
            const paymentMode = rawMethod === 'CASH' ? 'Cash'
                : rawMethod === 'ONLINE' ? 'Online (Razorpay)'
                : rawMethod ? rawMethod
                : null;

            return {
                id: dep.id,
                tenantId: p.tenantId,
                tenantDisplayId: p.tenant?.displayId || '',
                tenantName: p.tenant?.name || 'Unknown',
                tenantPhone: p.tenant?.phone || '',
                tenantEmail: p.tenant?.email || '',
                propertyId: p.propertyId,
                roomNumber: p.tenant?.roomNumber || '',
                roomType: p.tenant?.roomType || '',
                monthlyRent: p.monthlyRent,
                bookingDisplayId: (p.tenant as any)?.booking?.displayId || '',
                bookingId: (p.tenant as any)?.booking?.id || '',
                roomAssigned: (p.tenant as any)?.booking?.roomAssigned || '',
                amount: dep.amount,
                collectedOn: dep.paidAt,
                createdAt: dep.createdAt,
                status: dep.status || 'PENDING',
                refundAmount: dep.refundAmount,
                deductionAmount: dep.deductionAmount,
                deductionReason: dep.deductionReason,
                paymentMethod: paymentMode,
                razorpayId: anyVerifiedPayment?.razorpayId || anyVerifiedPayment?.razorpayOrderId || null,
            };
        })
        // ── Latest deposit first (by createdAt desc) ──
        .sort((a: any, b: any) => {
            const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return db - da;
        });

    const totalHeld = deposits.filter(d => d.status === 'PAID').reduce((s: number, d: any) => s + d.amount, 0);
    const refundedThisMonth = deposits.filter(d =>
        (d.status === 'REFUNDED' || d.status === 'PARTIALLY_REFUNDED') &&
        d.collectedOn >= monthStart
    ).reduce((s: number, d: any) => s + (d.refundAmount || 0), 0);

    return {
        deposits,
        summary: {
            totalHeld,
            refundPending: deposits.filter(d => d.status === 'REFUND_PENDING').length,
            refundedThisMonth,
        }
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT 2: Move-Out Settlement Wizard — Enhanced updateDepositStatus
// ─────────────────────────────────────────────────────────────────────────────

export interface SettlementDeductions {
    damages: number;        // Room damage deductions (walls, floor, furniture, etc.)
    utilities: number;      // Unpaid utility charges
    unpaidRent: number;     // Unpaid rent arrears (auto-calculated from invoices)
    noticePeriod: number;   // Notice period default penalty
    other: number;          // Any other deductions
    notes: string;          // Owner's notes
}

export async function processDepositSettlement(
    depositId: string,
    action: 'REFUNDED' | 'FORFEITED' | 'PARTIALLY_REFUNDED',
    deductions: SettlementDeductions
) {
    const { userId, user: actorUser } = await getOwnerSession();

    // Fetch the deposit with tenant info for email notification
    const deposit = await prisma.securityDeposit.findUnique({
        where: { id: depositId },
        include: {
            billingProfile: {
                include: {
                    tenant: {
                        select: { name: true, email: true, phone: true, roomNumber: true }
                    },
                    invoices: {
                        where: { status: { not: 'PAID' } },
                        select: { id: true, amount: true, paidAmount: true, month: true }
                    }
                }
            }
        }
    });

    if (!deposit) throw new Error('Deposit record not found');

    // Calculate total deductions
    const totalDeductions = (deductions.damages || 0)
        + (deductions.utilities || 0)
        + (deductions.unpaidRent || 0)
        + (deductions.noticePeriod || 0)
        + (deductions.other || 0);

    const depositAmount = Number(deposit.amount);
    const refundAmount = Math.max(0, depositAmount - totalDeductions);

    // Determine final status
    let finalStatus: string = action;
    if (action === 'REFUNDED' && totalDeductions > 0) {
        finalStatus = refundAmount > 0 ? 'PARTIALLY_REFUNDED' : 'FORFEITED';
    }

    const tenant = deposit.billingProfile?.tenant;
    const actorName = actorUser?.name || 'Owner';
    const actorRole = actorUser?.parentOwnerId ? 'STAFF' : 'OWNER';

    // Build deductionReason summary string
    const deductionLines: string[] = [];
    if (deductions.damages > 0) deductionLines.push(`Room Damages: ₹${deductions.damages.toLocaleString('en-IN')}`);
    if (deductions.utilities > 0) deductionLines.push(`Unpaid Utilities: ₹${deductions.utilities.toLocaleString('en-IN')}`);
    if (deductions.unpaidRent > 0) deductionLines.push(`Unpaid Rent: ₹${deductions.unpaidRent.toLocaleString('en-IN')}`);
    if (deductions.noticePeriod > 0) deductionLines.push(`Notice Period Default: ₹${deductions.noticePeriod.toLocaleString('en-IN')}`);
    if (deductions.other > 0) deductionLines.push(`Other: ₹${deductions.other.toLocaleString('en-IN')}`);
    const deductionSummary = deductionLines.join(', ') || 'None';

    // Update the deposit record with structured deductions
    await (prisma as any).securityDeposit.update({
        where: { id: depositId },
        data: {
            status: finalStatus,
            refundAmount,
            deductionAmount: totalDeductions,
            deductionReason: deductionSummary + (deductions.notes ? ` — Notes: ${deductions.notes}` : ''),
            deductionDamages: deductions.damages || 0,
            deductionUtilities: deductions.utilities || 0,
            deductionRent: deductions.unpaidRent || 0,
            deductionNotice: deductions.noticePeriod || 0,
            deductionOther: deductions.other || 0,
            settlementNotes: deductions.notes || null,
            settlementDate: new Date(),
            refundDueBy: null,
        }
    });

    // ── Send settlement email to tenant ──────────────────────────────────────
    if (tenant?.email) {
        const fmtAmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
        sendEmail({
            to: tenant.email,
            subject: `🏠 Security Deposit Settlement — RentPe`,
            html: `
            <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 24px;text-align:center;">
                <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">🏠 RentPe</h1>
                <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px;">Security Deposit Settlement Notice</p>
              </div>
              <div style="padding:28px 24px;">
                <p style="color:#374151;font-size:15px;margin:0 0 8px;">Hi <strong>${tenant.name || 'there'}</strong>,</p>
                <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Your security deposit has been settled. Here is the full breakdown:</p>
                <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:20px;">
                  <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <tr><td style="padding:6px 0;color:#6b7280;">Original Deposit</td><td style="text-align:right;font-weight:700;color:#1f2937;">${fmtAmt(depositAmount)}</td></tr>
                    ${deductions.damages > 0 ? `<tr><td style="padding:6px 0;color:#ef4444;">− Room Damage Deductions</td><td style="text-align:right;color:#ef4444;font-weight:600;">${fmtAmt(deductions.damages)}</td></tr>` : ''}
                    ${deductions.utilities > 0 ? `<tr><td style="padding:6px 0;color:#ef4444;">− Unpaid Utilities</td><td style="text-align:right;color:#ef4444;font-weight:600;">${fmtAmt(deductions.utilities)}</td></tr>` : ''}
                    ${deductions.unpaidRent > 0 ? `<tr><td style="padding:6px 0;color:#ef4444;">− Unpaid Rent Arrears</td><td style="text-align:right;color:#ef4444;font-weight:600;">${fmtAmt(deductions.unpaidRent)}</td></tr>` : ''}
                    ${deductions.noticePeriod > 0 ? `<tr><td style="padding:6px 0;color:#ef4444;">− Notice Period Default</td><td style="text-align:right;color:#ef4444;font-weight:600;">${fmtAmt(deductions.noticePeriod)}</td></tr>` : ''}
                    ${deductions.other > 0 ? `<tr><td style="padding:6px 0;color:#ef4444;">− Other Deductions</td><td style="text-align:right;color:#ef4444;font-weight:600;">${fmtAmt(deductions.other)}</td></tr>` : ''}
                    <tr style="border-top:2px solid #e2e8f0;">
                      <td style="padding:12px 0 0;font-weight:800;color:#059669;font-size:16px;">Refund Amount</td>
                      <td style="text-align:right;font-weight:800;color:#059669;font-size:16px;padding-top:12px;">${fmtAmt(refundAmount)}</td>
                    </tr>
                  </table>
                </div>
                ${deductions.notes ? `<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:16px;"><p style="color:#92400e;font-size:13px;margin:0;"><strong>Owner's Note:</strong> ${deductions.notes}</p></div>` : ''}
                <p style="color:#6b7280;font-size:13px;">If you believe there is an error, raise a dispute from your student dashboard within 15 days.</p>
                <a href="https://rentpe.in/dashboard/student" style="display:inline-block;background:#6366f1;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:12px;">View My Deposit Status →</a>
              </div>
              <div style="border-top:1px solid #f1f5f9;padding:16px 24px;text-align:center;">
                <p style="color:#d1d5db;font-size:11px;margin:0;">© 2025 RentPe · India's Trusted PG & Hostel Platform · support@rentpe.in</p>
              </div>
            </div>`
        }).catch(err => console.error('[SETTLEMENT EMAIL] Failed:', err));
    }

    logAuditEvent({
        actorId: userId,
        actorRole,
        actorName,
        actionType: 'UPDATE',
        entityType: 'PAYMENT',
        entityId: depositId,
        description: `Settlement processed: ${finalStatus}. Deposit: ₹${depositAmount}. Deductions: ${deductionSummary}. Refund: ₹${refundAmount}.`,
        newValue: { status: finalStatus, refundAmount, totalDeductions },
    });

    revalidatePath('/dashboard/owner/deposits');
    return { success: true, finalStatus, refundAmount, totalDeductions };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT 2 (Legacy): updateDepositStatus — wraps processDepositSettlement
// Kept for backward compat with old Refund/Forfeit button
// ─────────────────────────────────────────────────────────────────────────────
export async function updateDepositStatus(
    depositId: string,
    action: 'REFUNDED' | 'FORFEITED' | 'PARTIALLY_REFUNDED',
    data: { refundAmount?: number; reason?: string }
) {
    // For simple refund: treat the shortfall as "other" deduction
    const deposit = await (prisma as any).securityDeposit.findUnique({ where: { id: depositId }, select: { amount: true } });
    const depositAmount = Number(deposit?.amount || 0);
    const refundAmt = data.refundAmount !== undefined ? data.refundAmount : depositAmount;
    const otherDeduction = Math.max(0, depositAmount - refundAmt);

    return processDepositSettlement(depositId, action, {
        damages: 0, utilities: 0, unpaidRent: 0, noticePeriod: 0,
        other: otherDeduction,
        notes: data.reason || '',
    });
}



// ────────────────────────────────────────────────────────
// TASK 5 — BULK INVOICE GENERATION
// ────────────────────────────────────────────────────────

export async function getTenantsForBulkInvoice(month: string) {
    const { properties } = await getOwnerSession();
    const propertyIds = properties.map((p: any) => p.id);

    const profiles = await prisma.billingProfile.findMany({
        where: { propertyId: { in: propertyIds }, status: 'ACTIVE' },
        include: {
            tenant: {
                select: { id: true, name: true, phone: true, email: true, roomNumber: true, roomType: true, rent: true, status: true }
            },
            invoices: { where: { billingMonth: month }, select: { id: true, status: true } }
        }
    });

    return profiles
        .filter((p: any) => p.tenant && ['Active', 'ACTIVE_TENANT', 'UPCOMING_MOVE_IN'].includes(p.tenant.status))
        .map((p: any) => ({
            tenantId: p.tenantId,
            billingProfileId: p.id,
            tenantName: p.tenant.name,
            room: p.tenant.roomNumber,
            rent: p.monthlyRent,
            hasInvoice: p.invoices.length > 0,
            existingStatus: p.invoices[0]?.status || null,
        }));
}

export async function generateBulkInvoices(month: string, tenantIds: string[]) {
    const { userId, user: actorUser } = await getOwnerSession();

    const results: { tenantId: string; status: string; invoiceId?: string; reason?: string }[] = [];

    for (const tenantId of tenantIds) {
        try {
            const profile = await prisma.billingProfile.findUnique({
                where: { tenantId },
                include: { tenant: { include: { booking: true } } }
            });

            if (!profile) {
                results.push({ tenantId, status: 'ERROR', reason: 'No billing profile' });
                continue;
            }

            const billingMonth = month; // YYYY-MM
            const existing = await prisma.rentInvoice.findFirst({
                where: { tenantId, billingMonth }
            });

            if (existing) {
                results.push({ tenantId, status: 'SKIPPED', reason: 'Already exists', invoiceId: existing.id });
                continue;
            }

            const displayId = await generateMasterId('INV');
            const dueDate = new Date(`${month}-05`);

            const booking = (profile as any).tenant?.booking;
            const invoice = await prisma.rentInvoice.create({
                data: {
                    displayId,
                    billingProfileId: profile.id,
                    tenantId,
                    propertyId: profile.propertyId,
                    bookingId: booking?.id || undefined,
                    month: new Date(`${month}-01`).toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
                    billingMonth,
                    rentAmount: profile.monthlyRent,
                    foodAmount: 0,
                    amount: profile.monthlyRent,
                    dueDate,
                    status: 'PENDING',
                } as any
            });

            // Notify tenant
            if (booking?.userId) {
                await prisma.notification.create({
                    data: {
                        userId: booking.userId,
                        type: 'INVOICE_GENERATED',
                        category: 'PAYMENT',
                        message: `📄 Rent invoice for ${month} has been generated. Amount: ₹${profile.monthlyRent.toLocaleString('en-IN')}. Due: ${dueDate.toLocaleDateString('en-IN')}.`,
                        isPersistent: false,
                    }
                });
            }

            results.push({ tenantId, status: 'CREATED', invoiceId: invoice.id });
        } catch (e: any) {
            results.push({ tenantId, status: 'ERROR', reason: e.message });
        }
    }

    logAuditEvent({
        actorId: userId,
        actorRole: actorUser?.parentOwnerId ? 'STAFF' : 'OWNER',
        actorName: actorUser?.name || 'Owner',
        actionType: 'CREATE',
        entityType: 'PAYMENT',
        entityId: month,
        description: `Bulk invoices generated for ${month}. Created: ${results.filter(r => r.status === 'CREATED').length}, Skipped: ${results.filter(r => r.status === 'SKIPPED').length}, Errors: ${results.filter(r => r.status === 'ERROR').length}`,
    });

    revalidatePath('/dashboard/owner/payments');
    revalidatePath('/dashboard/owner/rent-collection');
    return results;
}

// ────────────────────────────────────────────────────────
// TASK 7 — ROOM AVAILABILITY CALENDAR
// ────────────────────────────────────────────────────────

export async function getRoomAvailabilityData(propertyId: string) {
    const { properties } = await getOwnerSession();
    const isOwned = properties.some((p: any) => p.id === propertyId);
    if (!isOwned) throw new Error("Unauthorized");

    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        include: {
            rooms: {
                where: { deletedAt: null },
                include: {
                    beds: {
                        where: { deletedAt: null },
                        include: { tenant: true }
                    }
                },
                orderBy: { roomNumber: 'asc' }
            }
        }
    });

    if (!property) throw new Error("Property not found");

    const rooms = (property as any).rooms.map((room: any) => {
        const beds = room.beds.map((bed: any) => ({
            id: bed.id,
            bedNumber: bed.bedNumber,
            status: bed.status,
            tenantName: bed.tenant?.name || null,
            tenantPhone: bed.tenant?.phone || null,
            lockExpiresAt: bed.lockExpiresAt,
        }));

        const occupied = beds.filter((b: any) => b.status === 'OCCUPIED').length;
        const available = beds.filter((b: any) => b.status === 'AVAILABLE').length;
        const reserved = beds.filter((b: any) => ['RESERVED', 'TEMP_LOCKED'].includes(b.status)).length;
        const maintenance = beds.filter((b: any) => b.status === 'MAINTENANCE').length;

        return {
            id: room.id,
            roomNumber: room.roomNumber,
            type: room.type,
            price: room.price,
            totalBeds: room.totalBeds,
            beds,
            occupied,
            available,
            reserved,
            maintenance,
            status: available > 0 ? 'AVAILABLE' : (reserved > 0 ? 'RESERVED' : 'OCCUPIED'),
        };
    });

    const totalBeds = rooms.reduce((s: number, r: any) => s + r.totalBeds, 0);
    const occupiedBeds = rooms.reduce((s: number, r: any) => s + r.occupied, 0);
    const availableBeds = rooms.reduce((s: number, r: any) => s + r.available, 0);

    return {
        property: { id: property.id, name: property.name, city: property.city },
        rooms,
        summary: {
            totalRooms: rooms.length,
            totalBeds,
            occupiedBeds,
            availableBeds,
            occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
        }
    };
}

// ────────────────────────────────────────────────────────
// TASK 8 — PROPERTY ANALYTICS (extended)
// ────────────────────────────────────────────────────────

export async function getOwnerAnalytics(fromDate?: string, toDate?: string) {
    const { properties } = await getOwnerSession();
    const propertyIds = properties.map((p: any) => p.id);

    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 86400000);
    const to = toDate ? new Date(toDate) : new Date();

    // Monthly revenue per property
    const invoices = await prisma.rentInvoice.findMany({
        where: {
            propertyId: { in: propertyIds },
            createdAt: { gte: from, lte: to },
        },
        select: { propertyId: true, amount: true, paidAmount: true, status: true, billingMonth: true, rentAmount: true, paymentMethod: true }
    });

    const perProperty = properties.map((prop: any) => {
        const propInvoices = invoices.filter((inv: any) => inv.propertyId === prop.id);
        const totalExpected = propInvoices.reduce((s: number, inv: any) => s + inv.amount, 0);
        const totalCollected = propInvoices.filter((inv: any) => inv.status === 'PAID').reduce((s: number, inv: any) => s + inv.paidAmount, 0);
        const unpaid = propInvoices.filter((inv: any) => inv.status !== 'PAID').length;
        return {
            propertyId: prop.id,
            propertyName: prop.name,
            totalExpected: Math.round(totalExpected),
            totalCollected: Math.round(totalCollected),
            invoiceCount: propInvoices.length,
            unpaidCount: unpaid,
            collectionRate: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0,
        };
    });

    // Monthly breakdown
    const monthlyMap: Record<string, { month: string; collected: number; expected: number }> = {};
    for (const inv of invoices) {
        const key = inv.billingMonth || '';
        if (!key) continue;
        if (!monthlyMap[key]) monthlyMap[key] = { month: key, collected: 0, expected: 0 };
        monthlyMap[key].expected += inv.amount;
        if (inv.status === 'PAID') monthlyMap[key].collected += inv.paidAmount;
    }

    const monthly = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => v);

    // Calculate Payment Method Split (Cash vs Online)
    const cashCollected = invoices
        .filter((inv: any) => inv.status === 'PAID' && inv.paymentMethod === 'CASH')
        .reduce((s: number, inv: any) => s + inv.paidAmount, 0);
    const onlineCollected = invoices
        .filter((inv: any) => inv.status === 'PAID' && inv.paymentMethod !== 'CASH')
        .reduce((s: number, inv: any) => s + inv.paidAmount, 0);

    const paymentMethodSplit = {
        cash: Math.round(cashCollected),
        online: Math.round(onlineCollected),
    };

    return { perProperty, monthly, properties, paymentMethodSplit };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT 3: Rent Withholding Shield — Compliance Checker & Overdue Counter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scans all deposits with status=PAID where refundDueBy < now.
 * Flags them as REFUND_OVERDUE and sends admin notification.
 * Called by: admin cron job or manual admin trigger.
 */
export async function checkDepositRefundCompliance() {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');
    if ((session as any).role !== 'ADMIN') throw new Error('Forbidden: Admin only');

    const now = new Date();
    const overdueDeposits = await (prisma as any).securityDeposit.findMany({
        where: { status: 'PAID', refundDueBy: { lt: now } },
        include: {
            billingProfile: {
                include: { tenant: { select: { name: true, email: true } } }
            }
        }
    });

    const results: { depositId: string; tenantName: string; status: string }[] = [];

    for (const dep of overdueDeposits) {
        try {
            await (prisma as any).securityDeposit.update({
                where: { id: dep.id },
                data: { status: 'REFUND_OVERDUE', escalatedAt: now }
            });
            await prisma.notification.create({
                data: {
                    userId: (session as any).userId,
                    type: 'PAYMENT',
                    category: 'SYSTEM_ALERT',
                    message: `⚠️ Deposit refund OVERDUE for ${dep.billingProfile?.tenant?.name || 'Tenant'}. ID: ${dep.id}. Rent withholding will activate on next payout.`,
                    isPersistent: true,
                }
            }).catch(() => {});
            logAuditEvent({
                actorId: (session as any).userId,
                actorRole: 'ADMIN',
                actorName: 'System Auto-Compliance',
                actionType: 'UPDATE',
                entityType: 'PAYMENT',
                entityId: dep.id,
                description: `Deposit OVERDUE — escalated. Tenant: ${dep.billingProfile?.tenant?.name}. Was due: ${dep.refundDueBy}`,
                newValue: { status: 'REFUND_OVERDUE', escalatedAt: now }
            });
            results.push({ depositId: dep.id, tenantName: dep.billingProfile?.tenant?.name || 'Unknown', status: 'ESCALATED' });
        } catch (err) {
            results.push({ depositId: dep.id, tenantName: dep.billingProfile?.tenant?.name || 'Unknown', status: 'ERROR' });
            console.error('[COMPLIANCE CHECK] Error for deposit:', dep.id, err);
        }
    }

    revalidatePath('/dashboard/owner/deposits');
    revalidatePath('/dashboard/admin');
    return { processed: overdueDeposits.length, results };
}

/**
 * Get count of REFUND_OVERDUE deposits for the current owner.
 * Used to show/hide the warning banner on owner dashboard.
 */
export async function getOwnerOverdueDepositCount() {
    try {
        const { properties } = await getOwnerSession();
        const propertyIds = properties.map((p: any) => p.id);

        const profiles = await prisma.billingProfile.findMany({
            where: { propertyId: { in: propertyIds } },
            select: {
                deposit: {
                    select: { id: true, status: true, amount: true, refundDueBy: true }
                },
                tenant: { select: { name: true, roomNumber: true } }
            }
        });

        const overdueDeposits = profiles
            .filter((p: any) => p.deposit?.status === 'REFUND_OVERDUE')
            .map((p: any) => ({
                depositId: p.deposit?.id,
                amount: Number(p.deposit?.amount || 0),
                refundDueBy: p.deposit?.refundDueBy,
                tenantName: p.tenant?.name || 'Unknown',
                roomNumber: p.tenant?.roomNumber || '',
            }));

        return {
            count: overdueDeposits.length,
            totalAmount: overdueDeposits.reduce((s: number, d: any) => s + d.amount, 0),
            deposits: overdueDeposits,
        };
    } catch {
        return { count: 0, totalAmount: 0, deposits: [] };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT 4 (Student Side): Get My Deposit Status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Student-facing: Returns their security deposit status, settlement breakdown,
 * refund timeline, days remaining, and any active disputes.
 */
export async function getMyDepositStatus() {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');
    const userId = (session as any).userId;

    // Find email from user
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) return null;

    // Find tenant by email
    const tenant = await prisma.tenant.findFirst({
        where: { email: user.email },
        include: {
            billingProfile: {
                include: {
                    deposit: {
                        select: {
                            id: true, amount: true, status: true,
                            paidAt: true, refundAmount: true,
                            deductionAmount: true, deductionReason: true,
                            deductionDamages: true as any, deductionUtilities: true as any,
                            deductionRent: true as any, deductionNotice: true as any,
                            deductionOther: true as any, settlementNotes: true as any,
                            settlementDate: true as any, refundDueBy: true as any,
                            escalatedAt: true as any,
                        }
                    }
                }
            },
            property: { select: { name: true } }
        }
    });

    if (!tenant || !tenant.billingProfile?.deposit) return null;

    const dep = tenant.billingProfile.deposit as any;
    const now = new Date();

    // Calculate days remaining until refundDueBy
    let daysRemaining: number | null = null;
    let isOverdue = false;
    if (dep.refundDueBy) {
        const due = new Date(dep.refundDueBy);
        const diff = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        daysRemaining = diff;
        isOverdue = diff < 0;
    }

    // Check for active dispute
    const activeDispute = await (prisma as any).dispute.findFirst({
        where: {
            tenantId: tenant.id,
            type: 'DEPOSIT_DISPUTE',
            status: { in: ['OPEN', 'IN_REVIEW', 'ESCALATED'] }
        },
        select: { id: true, displayId: true, status: true, createdAt: true, resolution: true }
    });

    // Determine if student can raise a dispute:
    // - Booking completed AND deposit not yet refunded AND status is PAID or REFUND_OVERDUE
    const canRaiseDispute = ['PAID', 'REFUND_OVERDUE'].includes(dep.status)
        && tenant.status === 'Checked Out'
        && !activeDispute;

    return {
        depositId: dep.id,
        depositAmount: Number(dep.amount),
        status: dep.status,
        paidAt: dep.paidAt,
        refundAmount: dep.refundAmount !== null ? Number(dep.refundAmount) : null,
        deductionAmount: dep.deductionAmount !== null ? Number(dep.deductionAmount) : null,
        deductionReason: dep.deductionReason,
        deductionBreakdown: {
            damages: Number(dep.deductionDamages || 0),
            utilities: Number(dep.deductionUtilities || 0),
            unpaidRent: Number(dep.deductionRent || 0),
            noticePeriod: Number(dep.deductionNotice || 0),
            other: Number(dep.deductionOther || 0),
        },
        settlementNotes: dep.settlementNotes,
        settlementDate: dep.settlementDate,
        refundDueBy: dep.refundDueBy,
        daysRemaining,
        isOverdue,
        propertyName: tenant.property?.name || '',
        roomNumber: tenant.roomNumber || '',
        tenantStatus: tenant.status,
        activeDispute,
        canRaiseDispute,
    };
}
