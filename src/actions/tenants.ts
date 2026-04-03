'use server';

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/actions/notifications";
import { logAuditEvent } from "@/lib/audit";
import { generateSequentialId } from "@/lib/ids";

export async function getTenants() {
    const session = await getSession();
    const isAuthorized = session && ['OWNER', 'STAFF', 'ADMIN'].includes(session.role);
    if (!isAuthorized) throw new Error("Unauthorized");
    const userId = session.userId;

    const whereClause: Prisma.TenantWhereInput = {};

    if (session.role === 'OWNER' || session.role === 'STAFF') {
        const user = await prisma.user.findUnique({ 
            where: { id: userId },
            include: { employeeProfile: true }
        });
        
        if (user?.employeeProfile) {
            // For staff, restrict to assigned properties
            const assignments = await prisma.employeePropertyAssignment.findMany({
                where: { employeeId: user.employeeProfile.id },
                select: { propertyId: true }
            });
            whereClause.propertyId = { in: assignments.map(a => a.propertyId) };
        } else {
            whereClause.property = { ownerId: user?.parentOwnerId || userId };
        }
    }

    const tenants = await prisma.tenant.findMany({
        where: whereClause,
        include: {
            property: { select: { name: true } },
            rentRecords: { orderBy: { createdAt: 'desc' } }
        },
        orderBy: { name: 'asc' }
    });

    // Attach action notes for each tenant
    const withNotes = await Promise.all(tenants.map(async (t) => {
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
        const availableBed = await prisma.bed.findFirst({
            where: { roomId: booking.roomId, status: 'AVAILABLE' }
        });
        if (availableBed) {
            bedId = availableBed.id;
        }
    }

    return await prisma.$transaction(async (tx) => {
        // 1. Create Tenant record
        // === UNIFIED IDENTITY: Reuse the student's existing REN-USER-XXXX ID ===
        // We never generate a new sequential ID for a tenant. The person's
        // identity is their User.displayId — forever.
        const studentUser = await prisma.user.findUnique({
            where: { id: booking.userId },
            select: { displayId: true }
        });
        const displayId = studentUser?.displayId || `REN-USER-${booking.userId.slice(0, 8).toUpperCase()}`;

        const tenant = await tx.tenant.create({
            data: {
                displayId,
                applicationId: displayId,
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
                startDate: booking.moveInDate || new Date().toLocaleDateString('en-IN'),
                status: 'Upcoming'
            }
        });

        // 2. Update Bed status to RESERVED
        if (bedId) {
            await tx.bed.update({
                where: { id: bedId },
                data: { status: 'RESERVED', tenantId: tenant.id }
            });
        }

        // 3. Log event
        logAuditEvent({
            actorId: 'SYSTEM',
            actorRole: 'SYSTEM',
            actorName: 'System',
            actionType: 'CREATE',
            entityType: 'TENANT',
            entityId: tenant.id,
            description: `Tenant record created for booking ${booking.displayId}. Status: Upcoming.`,
        });

        return tenant;
    });
}

export async function confirmMoveIn(tenantId: string) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) throw new Error("Unauthorized");

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { bed: true }
    });

    if (!tenant || tenant.status !== 'Upcoming') {
        throw new Error("Invalid tenant status for move-in.");
    }

    return await prisma.$transaction(async (tx) => {
        // === UNIFIED IDENTITY: No ID upgrade needed ===
        // The displayId is already REN-USER-XXXX (set at check-in).
        // We simply flip the status to Active.

        // 1. Update Tenant
        await tx.tenant.update({
            where: { id: tenantId },
            data: { status: 'Active' }
        });

        // 2. Update Bed to OCCUPIED
        if (tenant.bedId) {
            await tx.bed.update({
                where: { id: tenant.bedId },
                data: { status: 'OCCUPIED' }
            });
        }

        // 3. Update Booking status
        if (tenant.bookingId) {
            await tx.booking.update({
                where: { id: tenant.bookingId },
                data: { status: 'CHECKIN_CONFIRMED' }
            });
        }

        // 4. Financial Integration: Create Billing Profile & Generate Initial Deposit Invoice
        const rentAmount = typeof tenant.rent === 'string' ? parseFloat((tenant.rent as string).replace(/[^0-9.]/g, '')) : Number(tenant.rent);
        const profile = await tx.billingProfile.create({
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

        await tx.securityDeposit.create({
            data: {
                billingProfileId: profile.id,
                tenantId,
                amount: rentAmount,
                status: 'PENDING'
            }
        });

        logAuditEvent({
            actorId: session.userId,
            actorRole: session.role || 'OWNER',
            actorName: session.name || 'Owner',
            actionType: 'UPDATE',
            entityType: 'TENANT',
            entityId: tenantId,
            description: `Tenant ${tenant.name} moved in. Unified ID: ${tenant.displayId}. Financials now active.`,
        });

        revalidatePath('/dashboard/owner/tenants');
        revalidatePath('/dashboard/owner/financials');
        return { success: true };
    });
}

export async function markRentAsPaid(recordId: string, note?: string) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) throw new Error("Unauthorized");

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
                performedBy: session.userId
            }
        });
    }

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'OWNER',
        actorName: session.name || 'Owner',
        actionType: 'UPDATE',
        entityType: 'TENANT',
        entityId: record.tenantId,
        description: `Rent for ${record.month} marked as paid${note ? `. Note: ${note}` : ''}`,
    });

    revalidatePath('/dashboard/owner/tenants');
    revalidatePath('/dashboard/owner/payments');
    return record;
}

export async function markRentAsUnpaid(recordId: string, note?: string) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) throw new Error("Unauthorized");

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
                performedBy: session.userId
            }
        });
    }

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'OWNER',
        actorName: session.name || 'Owner',
        actionType: 'UPDATE',
        entityType: 'TENANT',
        entityId: record.tenantId,
        description: `Rent for ${record.month} reversed to Unpaid${note ? `. Note: ${note}` : ''}`,
    });

    revalidatePath('/dashboard/owner/tenants');
    revalidatePath('/dashboard/owner/payments');
    return record;
}

export async function blockTenant(tenantId: string, note: string) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) throw new Error("Unauthorized");

    const timestamp = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    const tenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'Blocked', actualMoveOutDate: timestamp }
    });

    await prisma.actionNote.create({
        data: {
            targetId: tenantId,
            targetType: 'TENANT',
            action: 'BLOCKED',
            reason: note,
            performedBy: session.userId
        }
    });

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'OWNER',
        actorName: session.name || 'Owner',
        actionType: 'DELETE',
        entityType: 'TENANT',
        entityId: tenantId,
        description: `Blocked on ${timestamp}. Reason: ${note}`,
    });

    revalidatePath('/dashboard/owner/tenants');
    return tenant;
}

export async function unblockTenant(tenantId: string, note: string) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) throw new Error("Unauthorized");

    const tenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'Active', actualMoveOutDate: null }
    });

    await prisma.actionNote.create({
        data: {
            targetId: tenantId,
            targetType: 'TENANT',
            action: 'UNBLOCKED',
            reason: note,
            performedBy: session.userId
        }
    });

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'OWNER',
        actorName: session.name || 'Owner',
        actionType: 'UPDATE',
        entityType: 'TENANT',
        entityId: tenantId,
        description: `Unblocked. Reason: ${note}`,
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
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) throw new Error("Unauthorized");

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

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'OWNER',
        actorName: session.name || 'Owner',
        actionType: 'CREATE',
        entityType: 'TENANT',
        entityId: tenantId,
        description: `Generated rent invoice for ${month} (₹${tenant.rent})`,
    });

    revalidatePath('/dashboard/owner/tenants');
    revalidatePath('/dashboard/owner/payments');
    revalidatePath('/dashboard/student');
    return record;
}

export async function requestMoveOut(tenantId: string, data: { date: string, reason: string }) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || (tenant.studentId !== session.userId && session.role !== 'OWNER' && session.role !== 'ADMIN')) {
        throw new Error("Unauthorized or tenant not found");
    }

    return await prisma.$transaction(async (tx) => {
        // 1. Create Move-Out Request
        const request = await tx.moveOutRequest.create({
            data: {
                tenantId,
                requestedBy: session.userId,
                requestedDate: data.date,
                reason: data.reason,
                status: 'PENDING'
            }
        });

        // 2. Update Tenant Status (No internal status change yet, just date)
        await tx.tenant.update({
            where: { id: tenantId },
            data: { expectedMoveOutDate: data.date }
        });

        logAuditEvent({
            actorId: session.userId,
            actorRole: session.role as string,
            actorName: session.name || 'User',
            actionType: 'UPDATE',
            entityType: 'TENANT',
            entityId: tenantId,
            description: `Move-out requested for ${data.date}. Reason: ${data.reason}`,
        });

        revalidatePath('/dashboard/owner/tenants');
        return request;
    });
}

export async function approveMoveOutRequest(requestId: string, approved: boolean) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) throw new Error("Unauthorized");

    const request = await prisma.moveOutRequest.findUnique({
        where: { id: requestId },
        include: { tenant: true }
    });

    if (!request) throw new Error("Request not found");

    return await prisma.$transaction(async (tx) => {
        const status = approved ? 'APPROVED' : 'REJECTED';
        
        await tx.moveOutRequest.update({
            where: { id: requestId },
            data: {
                status,
                approvedBy: session.userId,
                approvedAt: new Date()
            }
        });

        if (approved) {
            // No status change needed yet, just keep as Active
        }

        logAuditEvent({
            actorId: session.userId,
            actorRole: session.role as string,
            actorName: session.name || 'Owner',
            actionType: approved ? 'APPROVE' : 'REJECT',
            entityType: 'TENANT',
            entityId: request.tenantId,
            description: `Move-out request ${status} by ${session.role}.`,
        });

        revalidatePath('/dashboard/owner/tenants');
        return { success: true };
    });
}

export async function confirmMoveOut(tenantId: string, deductions: number, note: string) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) throw new Error("Unauthorized");

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
            property: true,
            bed: true,
            rentRecords: true
        }
    });

    if (!tenant) throw new Error("Tenant not found");
    if (tenant.status === 'Checked Out') throw new Error("Tenant already moved out");

    return await prisma.$transaction(async (tx) => {
        const moveOutDate = new Date();
        const moveInDate = new Date(tenant.startDate);
        const duration = Math.ceil((moveOutDate.getTime() - moveInDate.getTime()) / (1000 * 60 * 60 * 24));

        // 1. Financial Settlement logic
        const unpaidRent = tenant.rentRecords.filter(r => !r.paid).reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
        const totalPaidRent = tenant.rentRecords.filter(r => r.paid).reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
        // We use the rent as deposit here for migration support, but real flow should use deposit table
        const depositAmount = tenant.rent; 
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
        await tx.settlementRecord.create({
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
        await tx.tenantHistory.create({
            data: {
                tenantId: tenant.id,
                studentId: tenant.studentId,
                propertyName: tenant.property.name,
                roomNumber: tenant.roomNumber,
                bedNumber: tenant.bed?.bedNumber || "N/A",
                moveInDate: moveInDate,
                moveOutDate: moveOutDate,
                stayDurationDays: duration,
                totalPaid: totalPaidRent + (depositAmount - (finalRefund > 0 ? finalRefund : 0))
            }
        });

        // 4. Clear Bed & Close Booking
        if (tenant.bedId) {
            await tx.bed.update({
                where: { id: tenant.bedId },
                data: { status: 'AVAILABLE', tenantId: null }
            });
        }

        if (tenant.bookingId) {
            await tx.booking.update({
                where: { id: tenant.bookingId },
                data: { status: 'CHECKED_OUT' }
            });
        }

        // 5. Update Tenant
        await tx.tenant.update({
            where: { id: tenantId },
            data: { 
                status: 'Checked Out', 
                actualMoveOutDate: moveOutDate.toISOString(), 
                vacateNote: settlementSummary 
            }
        });

        // 6. Log event
        logAuditEvent({
            actorId: session.userId,
            actorRole: session.role || 'OWNER',
            actorName: session.name || 'Owner',
            actionType: 'DELETE',
            entityType: 'TENANT',
            entityId: tenantId,
            description: `Move-out finalized. Settlement: Refund ₹${finalRefund}.`,
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
        case 'UPCOMING': statusFilter = ['Upcoming']; break;
        case 'ACTIVE': statusFilter = ['Active']; break;
        case 'MOVE_OUT': statusFilter = ['Active']; break; 
        case 'PAST': statusFilter = ['Checked Out']; break;
    }

    // If owner/staff, get allowed properties
    const user = await prisma.user.findUnique({ 
        where: { id: session.userId },
        include: { employeeProfile: true }
    });
    
    let pIds: string[] = [];
    
    if (user?.employeeProfile) {
        const assignments = await prisma.employeePropertyAssignment.findMany({
            where: { employeeId: user.employeeProfile.id },
            select: { propertyId: true }
        });
        pIds = assignments.map(a => a.propertyId);
    } else {
        const properties = await prisma.property.findMany({ 
            where: { ownerId: user?.parentOwnerId || session.userId }, 
            select: { id: true } 
        });
        pIds = properties.map(p => p.id);
    }

    return await prisma.tenant.findMany({
        where: { propertyId: { in: pIds }, status: { in: statusFilter } },
        include: { property: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
    });
}

// Aliases for compatibility
export const initiateMoveOut = confirmMoveOut;
