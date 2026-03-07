'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/actions/notifications";

export async function getTenants() {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");
    const userId = (session as any).userId;

    const whereClause = session.role === 'ADMIN' ? {} : { property: { ownerId: userId } };

    const tenants = await (prisma.tenant as any).findMany({
        where: whereClause,
        include: {
            property: { select: { name: true } },
            rentRecords: { orderBy: { createdAt: 'desc' } }
        },
        orderBy: { name: 'asc' }
    });

    // Attach action notes for each tenant
    const withNotes = await Promise.all(tenants.map(async (t: any) => {
        const notes = await prisma.actionNote.findMany({
            where: { targetId: t.id, targetType: 'TENANT' },
            orderBy: { timestamp: 'desc' }
        });
        return { ...t, actionNotes: notes };
    }));

    return withNotes;
}

/**
 * Tenant Lifecycle Management
 * State Machine: UPCOMING_MOVE_IN -> ACTIVE_TENANT -> MOVE_OUT_SCHEDULED -> MOVE_OUT_COMPLETED
 */

export async function createTenantFromBooking(bookingId: string) {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { room: true }
    });

    if (!booking || booking.status !== 'BOOKING_CONFIRMED') {
        throw new Error("Only confirmed bookings can be converted to tenants.");
    }

    // Find a bed to assign (if not already assigned)
    let bedId = null;
    if (booking.roomId) {
        const availableBed = await (prisma.bed as any).findFirst({
            where: { roomId: booking.roomId, status: 'AVAILABLE' }
        });
        if (availableBed) {
            bedId = availableBed.id;
        }
    }

    return await prisma.$transaction(async (tx) => {
        // 1. Create Tenant record
        const tenant = await (tx.tenant as any).create({
            data: {
                displayId: `TNT-${Math.floor(Math.random() * 900000) + 100000}`,
                studentId: booking.userId,
                bookingId: booking.id,
                propertyId: booking.propertyId!,
                roomId: booking.roomId!,
                bedId: bedId,
                name: booking.guestName,
                phone: booking.guestPhone || "",
                email: booking.guestEmail,
                roomNumber: booking.roomAssigned || "TBD",
                roomType: booking.occupancy,
                rent: booking.amount,
                startDate: booking.moveInDate,
                status: 'UPCOMING_MOVE_IN'
            }
        });

        // 2. Update Bed status to RESERVED
        if (bedId) {
            await (tx.bed as any).update({
                where: { id: bedId },
                data: { status: 'RESERVED', tenantId: tenant.id }
            });
        }

        // 3. Log event
        await tx.auditLog.create({
            data: {
                action: 'TENANT_CREATED',
                targetId: tenant.id,
                targetType: 'TENANT',
                details: `Tenant record created for booking ${booking.displayId}. Status: UPCOMING_MOVE_IN.`,
                performedBy: 'SYSTEM'
            }
        });

        return tenant;
    });
}

export async function confirmMoveIn(tenantId: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const tenant = await (prisma.tenant as any).findUnique({
        where: { id: tenantId },
        include: { bed: true }
    });

    if (!tenant || tenant.status !== 'UPCOMING_MOVE_IN') {
        throw new Error("Invalid tenant status for move-in.");
    }

    return await prisma.$transaction(async (tx) => {
        // 1. Update Tenant
        await (tx.tenant as any).update({
            where: { id: tenantId },
            data: { status: 'ACTIVE_TENANT' }
        });

        // 2. Update Bed to OCCUPIED
        if (tenant.bedId) {
            await (tx.bed as any).update({
                where: { id: tenant.bedId },
                data: { status: 'OCCUPIED' }
            });
        }

        // 3. Update Booking status
        if (tenant.bookingId) {
            await tx.booking.update({
                where: { id: tenant.bookingId },
                data: { status: 'CHECKED_IN' }
            });
        }

        // 4. Financial Integration: Create Billing Profile & Generate Initial Deposit Invoice
        const rentAmount = parseFloat(tenant.rent.replace(/[^0-9.]/g, ''));
        const profile = await (tx.billingProfile as any).create({
            data: {
                tenantId,
                propertyId: tenant.propertyId,
                roomId: tenant.roomId,
                bedId: tenant.bedId,
                monthlyRent: rentAmount,
                securityDeposit: rentAmount, // Default to 1 month
                billingDay: new Date(tenant.startDate).getDate() || 1
            }
        });

        await (tx.securityDeposit as any).create({
            data: {
                billingProfileId: profile.id,
                tenantId,
                amount: rentAmount,
                status: 'PENDING'
            }
        });

        await tx.auditLog.create({
            data: {
                action: 'TENANT_MOVE_IN',
                targetId: tenantId,
                targetType: 'TENANT',
                details: `Tenant ${tenant.name} moved in. Financial profile initialized.`,
                performedBy: (session as any).userId
            }
        });

        revalidatePath('/dashboard/owner/tenants');
        revalidatePath('/dashboard/owner/financials');
        return { success: true };
    });
}

export async function markRentAsPaid(recordId: string, note?: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const record = await prisma.rentRecord.update({
        where: { id: recordId },
        data: { paid: true, paidOn: today }
    });

    // Write action note if provided
    if (note?.trim()) {
        await prisma.actionNote.create({
            data: {
                targetId: record.tenantId,
                targetType: 'TENANT',
                action: 'PAYMENT_MARKED_PAID',
                reason: note.trim(),
                performedBy: (session as any).userId
            }
        });
    }

    await prisma.auditLog.create({
        data: {
            action: 'RENT_PAID',
            targetId: record.tenantId,
            targetType: 'TENANT',
            details: `Rent for ${record.month} marked as paid${note ? `. Note: ${note}` : ''}`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/owner/tenants');
    revalidatePath('/dashboard/owner/payments');
    return record;
}

export async function markRentAsUnpaid(recordId: string, note?: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const record = await prisma.rentRecord.update({
        where: { id: recordId },
        data: { paid: false, paidOn: null }
    });

    if (note?.trim()) {
        await prisma.actionNote.create({
            data: {
                targetId: record.tenantId,
                targetType: 'TENANT',
                action: 'PAYMENT_MARKED_UNPAID',
                reason: note.trim(),
                performedBy: (session as any).userId
            }
        });
    }

    await prisma.auditLog.create({
        data: {
            action: 'RENT_UNPAID',
            targetId: record.tenantId,
            targetType: 'TENANT',
            details: `Rent for ${record.month} reversed to Unpaid${note ? `. Note: ${note}` : ''}`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/owner/tenants');
    revalidatePath('/dashboard/owner/payments');
    return record;
}

export async function blockTenant(tenantId: string, note: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const timestamp = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    const tenant = await (prisma.tenant as any).update({
        where: { id: tenantId },
        data: { status: 'VACATED', vacatedOn: timestamp }
    });

    await prisma.actionNote.create({
        data: {
            targetId: tenantId,
            targetType: 'TENANT',
            action: 'BLOCKED',
            reason: note,
            performedBy: (session as any).userId
        }
    });

    await prisma.auditLog.create({
        data: {
            action: 'TENANT_BLOCKED',
            targetId: tenantId,
            targetType: 'TENANT',
            details: `Blocked on ${timestamp}. Reason: ${note}`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/owner/tenants');
    return tenant;
}

export async function unblockTenant(tenantId: string, note: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const tenant = await (prisma.tenant as any).update({
        where: { id: tenantId },
        data: { status: 'ACTIVE_TENANT', vacatedOn: null }
    });

    await prisma.actionNote.create({
        data: {
            targetId: tenantId,
            targetType: 'TENANT',
            action: 'UNBLOCKED',
            reason: note,
            performedBy: (session as any).userId
        }
    });

    await prisma.auditLog.create({
        data: {
            action: 'TENANT_UNBLOCKED',
            targetId: tenantId,
            targetType: 'TENANT',
            details: `Unblocked. Reason: ${note}`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/owner/tenants');
    return tenant;
}

// Keep old names as aliases for backward compat
export const vacateTenant = blockTenant;
export async function unvacateTenant(tenantId: string) {
    return unblockTenant(tenantId, "Restored by owner");
}

export async function generateNextRentRecord(tenantId: string, month: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error("Tenant not found");

    const existing = await prisma.rentRecord.findFirst({
        where: { tenantId, month }
    });

    if (existing) {
        throw new Error(`Rent invoice for ${month} already exists.`);
    }

    const record = await prisma.rentRecord.create({
        data: {
            tenantId,
            month,
            amount: tenant.rent,
            paid: false,
        }
    });

    await prisma.auditLog.create({
        data: {
            action: 'RENT_GENERATED',
            targetId: tenantId,
            targetType: 'TENANT',
            details: `Generated rent invoice for ${month} (₹${tenant.rent})`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/owner/tenants');
    revalidatePath('/dashboard/owner/payments');
    revalidatePath('/dashboard/student');
    return record;
}

export async function requestMoveOut(tenantId: string, data: { date: string, reason: string }) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const tenant = await (prisma.tenant as any).findUnique({ where: { id: tenantId } });
    if (!tenant || (tenant.studentId !== (session as any).userId && session.role !== 'OWNER' && session.role !== 'ADMIN')) {
        throw new Error("Unauthorized or tenant not found");
    }

    return await prisma.$transaction(async (tx) => {
        // 1. Create Move-Out Request
        const request = await (tx.moveOutRequest as any).create({
            data: {
                tenantId,
                requestedBy: (session as any).userId,
                requestedDate: data.date,
                reason: data.reason,
                status: 'PENDING'
            }
        });

        // 2. Update Tenant Status
        await (tx.tenant as any).update({
            where: { id: tenantId },
            data: { status: 'MOVE_OUT_SCHEDULED', expectedMoveOutDate: data.date }
        });

        await tx.auditLog.create({
            data: {
                action: 'MOVE_OUT_REQUESTED',
                targetId: tenantId,
                targetType: 'TENANT',
                details: `Move-out requested for ${data.date}. Reason: ${data.reason}`,
                performedBy: (session as any).userId
            }
        });

        revalidatePath('/dashboard/owner/tenants');
        return request;
    });
}

export async function approveMoveOutRequest(requestId: string, approved: boolean) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const request = await (prisma.moveOutRequest as any).findUnique({
        where: { id: requestId },
        include: { tenant: true }
    });

    if (!request) throw new Error("Request not found");

    return await prisma.$transaction(async (tx) => {
        const status = approved ? 'APPROVED' : 'REJECTED';
        
        await (tx.moveOutRequest as any).update({
            where: { id: requestId },
            data: {
                status,
                approvedBy: (session as any).userId,
                approvedAt: new Date()
            }
        });

        if (approved) {
            await (tx.tenant as any).update({
                where: { id: request.tenantId },
                data: { status: 'MOVE_OUT_SCHEDULED' }
            });
        }

        await tx.auditLog.create({
            data: {
                action: approved ? 'MOVE_OUT_APPROVED' : 'MOVE_OUT_REJECTED',
                targetId: request.tenantId,
                targetType: 'TENANT',
                details: `Move-out request ${status} by ${(session as any).role}.`,
                performedBy: (session as any).userId
            }
        });

        revalidatePath('/dashboard/owner/tenants');
        return { success: true };
    });
}

export async function confirmMoveOut(tenantId: string, deductions: number, note: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const tenant = await (prisma.tenant as any).findUnique({
        where: { id: tenantId },
        include: {
            property: true,
            bed: true,
            rentRecords: { where: { paid: false } }
        }
    });

    if (!tenant) throw new Error("Tenant not found");
    if (tenant.status === 'MOVE_OUT_COMPLETED') throw new Error("Tenant already moved out");

    return await prisma.$transaction(async (tx) => {
        const moveOutDate = new Date();
        const moveInDate = new Date(tenant.startDate);
        const duration = Math.ceil((moveOutDate.getTime() - moveInDate.getTime()) / (1000 * 60 * 60 * 24));

        // 1. Financial Settlement logic
        const unpaidRent = tenant.rentRecords.reduce((acc: number, r: any) => acc + parseFloat(r.amount), 0);
        // We use the rent as deposit here for migration support, but real flow should use deposit table
        const depositAmount = parseFloat(tenant.rent); 
        const finalRefund = depositAmount - unpaidRent - deductions;

        const settlementSummary = `
Settlement Summary:
- Security Deposit: ₹${depositAmount.toLocaleString('en-IN')}
- Unpaid Rent: ₹${unpaidRent.toLocaleString('en-IN')}
- Deductions: ₹${deductions.toLocaleString('en-IN')}
-------------------
Final Refund: ₹${finalRefund.toLocaleString('en-IN')}
-------------------
Note: ${note}
`.trim();

        // 2. Create formal Settlement Record
        await (tx.settlementRecord as any).create({
            data: {
                tenantId,
                finalRentPending: unpaidRent,
                damageDeductions: deductions,
                depositRefunded: finalRefund > 0 ? finalRefund : 0,
                notes: note,
                settlementDate: moveOutDate
            }
        });

        // 3. Create History Record
        await (tx.tenantHistory as any).create({
            data: {
                tenantId: tenant.id,
                studentId: tenant.studentId,
                propertyName: tenant.property.name,
                roomNumber: tenant.roomNumber,
                bedNumber: tenant.bed?.bedNumber || "N/A",
                moveInDate: moveInDate,
                moveOutDate: moveOutDate,
                stayDurationDays: duration,
                totalPaid: parseFloat(tenant.totalPaid || "0") + (depositAmount - (finalRefund > 0 ? finalRefund : 0))
            }
        });

        // 4. Clear Bed & Close Booking
        if (tenant.bedId) {
            await (tx.bed as any).update({
                where: { id: tenant.bedId },
                data: { status: 'AVAILABLE', tenantId: null }
            });
        }

        if (tenant.bookingId) {
            await tx.booking.update({
                where: { id: tenant.bookingId },
                data: { status: 'BOOKING_CLOSED' }
            });
        }

        // 5. Update Tenant
        await (tx.tenant as any).update({
            where: { id: tenantId },
            data: { 
                status: 'MOVE_OUT_COMPLETED', 
                actualMoveOutDate: moveOutDate.toISOString(), 
                vacateNote: settlementSummary 
            }
        });

        // 6. Log event
        await tx.auditLog.create({
            data: {
                action: 'TENANT_MOVE_OUT',
                targetId: tenantId,
                targetType: 'TENANT',
                details: `Move-out finalized. Settlement: Refund ₹${finalRefund}.`,
                performedBy: (session as any).userId
            }
        });

        revalidatePath('/dashboard/owner/tenants');
        revalidatePath('/dashboard/admin/tenants');
        return { success: true };
    });
}

export async function getTenantsByCategory(ownerId: string, category: 'UPCOMING' | 'ACTIVE' | 'MOVE_OUT' | 'PAST') {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    let statusFilter: string[] = [];
    switch (category) {
        case 'UPCOMING': statusFilter = ['UPCOMING_MOVE_IN']; break;
        case 'ACTIVE': statusFilter = ['ACTIVE_TENANT']; break;
        case 'MOVE_OUT': statusFilter = ['MOVE_OUT_SCHEDULED']; break;
        case 'PAST': statusFilter = ['MOVE_OUT_COMPLETED']; break;
    }

    // If owner, get properties first
    const properties = await prisma.property.findMany({ where: { ownerId }, select: { id: true } });
    const pIds = properties.map(p => p.id);

    return await (prisma.tenant as any).findMany({
        where: { propertyId: { in: pIds }, status: { in: statusFilter } },
        include: { property: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
    });
}

// Aliases for compatibility
export const initiateMoveOut = confirmMoveOut;
