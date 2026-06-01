'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { generateMasterId } from "@/lib/ids";
import { sendEmail } from "@/lib/email";

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
        select: { tenantId: true, month: true, billingMonth: true, amount: true, paidAmount: true, status: true, paidAt: true, paymentMethod: true },
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

    return [...rentRows, ...tokenRows];
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
            room: { select: { roomNumber: true, type: true } }
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
        const moveInDate = new Date(t.startDate);
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
                select: { name: true, phone: true, email: true, roomNumber: true, roomType: true, rent: true }
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
            return {
                id: dep.id,
                tenantId: p.tenantId,
                tenantName: p.tenant?.name || 'Unknown',
                tenantPhone: p.tenant?.phone || '',
                tenantEmail: p.tenant?.email || '',
                propertyId: p.propertyId,
                roomNumber: p.tenant?.roomNumber || '',
                roomType: p.tenant?.roomType || '',
                monthlyRent: p.monthlyRent,
                amount: dep.amount,
                collectedOn: dep.paidAt,
                createdAt: dep.createdAt,
                status: dep.status || 'PENDING',
                refundAmount: dep.refundAmount,
                deductionAmount: dep.deductionAmount,
                deductionReason: dep.deductionReason,
                paymentMethod: lastPayment?.method || null,
                razorpayId: lastPayment?.razorpayId || null,
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

export async function updateDepositStatus(
    depositId: string,
    action: 'REFUNDED' | 'FORFEITED' | 'PARTIALLY_REFUNDED',
    data: { refundAmount?: number; reason?: string }
) {
    const { userId, user: actorUser } = await getOwnerSession();

    await prisma.securityDeposit.update({
        where: { id: depositId },
        data: {
            status: action,
            refundAmount: data.refundAmount,
            deductionReason: data.reason,
            deductionAmount: action === 'FORFEITED' ? undefined : undefined,
        }
    });

    logAuditEvent({
        actorId: userId,
        actorRole: actorUser?.parentOwnerId ? 'STAFF' : 'OWNER',
        actorName: actorUser?.name || 'Owner',
        actionType: 'UPDATE',
        entityType: 'PAYMENT',
        entityId: depositId,
        description: `Security deposit ${action}. Refund: ₹${data.refundAmount || 0}. Reason: ${data.reason || 'None'}`,
    });

    revalidatePath('/dashboard/owner/deposits');
    return { success: true };
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
        .filter((p: any) => p.tenant && ['ACTIVE_TENANT', 'UPCOMING_MOVE_IN'].includes(p.tenant.status))
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
        select: { propertyId: true, amount: true, paidAmount: true, status: true, billingMonth: true, rentAmount: true }
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

    return { perProperty, monthly, properties };
}
