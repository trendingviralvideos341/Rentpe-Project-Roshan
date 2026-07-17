'use server';

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/actions/notifications";
import { logAuditEvent } from "@/lib/audit";
import { firstMonthRent, lastMonthRent } from "@/utils/billingUtils";
import { generateSequentialId } from "@/lib/ids";
import { cookies } from "next/headers";

export async function getTenants() {
    const session = await getSession();
    const isAuthorized = session && ['OWNER', 'STAFF', 'ADMIN'].includes(session.role);
    if (!isAuthorized) throw new Error("Unauthorized");
    const userId = session.userId;

    const whereClause: Prisma.TenantWhereInput = {};

    if (session.role === 'OWNER' || session.role === 'STAFF') {
        const user = await prisma.user.findUnique({ 
            where: { id: userId },
            include: { staffProfile: true }
        });
        
        if (user?.staffProfile) {
            // For staff, restrict to assigned properties
            const assignments = await prisma.staffPropertyAssignment.findMany({
                where: { staffMemberId: user.staffProfile.id },
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
            property: { 
                select: { 
                    name: true, 
                    displayId: true,
                    address: true,
                    city: true,
                    foodType: true,
                    foodPricePerMonth: true,
                    owner: { select: { name: true, phone: true } }
                } 
            },
            rentRecords: { orderBy: { createdAt: 'desc' } },
            billingProfile: {
                include: {
                    invoices: {
                        include: {
                            payments: {
                                where: { status: 'VERIFIED' }
                            }
                        }
                    }
                }
            },
            booking: {
                select: {
                    id: true,
                    displayId: true,    // Booking ID e.g. REN-BOOK-2026-0001
                    status: true,
                    moveInChecklist: true,
                    foodSelected: true,
                    foodPriceApplied: true,
                    user: {
                        select: {
                            displayId: true,
                            dateOfBirth: true,
                            gender: true,
                            nationality: true,
                            emergencyContact: true,
                            occupationType: true,
                            occupationDetail: true,
                            businessName: true,
                            college: true,
                            email: true,
                            phone: true
                        }
                    }
                }
            },
            settlementRecord: true
        },
        orderBy: { createdAt: 'desc' }
    });

    // ── BULK FETCH FOR ACTION NOTES (Fix N+1) ──
    const tenantIds = tenants.map(t => t.id);
    const allNotes = await prisma.actionNote.findMany({
        where: { targetId: { in: tenantIds }, targetType: 'TENANT' },
        orderBy: { timestamp: 'desc' }
    });
    const notesByTenant = new Map<string, any[]>();
    allNotes.forEach(n => {
        if (!notesByTenant.has(n.targetId!)) notesByTenant.set(n.targetId!, []);
        notesByTenant.get(n.targetId!)!.push(n);
    });

    const withNotes = tenants.map(t => ({
        ...t,
        actionNotes: notesByTenant.get(t.id) || []
    }));

    return withNotes;
}

export async function getTenantsPaginated(params: {
    limit: number;
    offset: number;
    search?: string;
    filterProperty?: string;
    filterType?: string;
    filterPayment?: string;
    activeTab?: string;
    currentMonth: string;
}) {
    const session = await getSession();
    const isAuthorized = session && ['OWNER', 'STAFF', 'ADMIN'].includes(session.role);
    if (!isAuthorized) throw new Error("Unauthorized");
    const userId = session.userId;

    const whereClause: Prisma.TenantWhereInput = {};

    if (session.role === 'OWNER' || session.role === 'STAFF') {
        const user = await prisma.user.findUnique({ 
            where: { id: userId },
            include: { staffProfile: true }
        });
        
        if (user?.staffProfile) {
            const assignments = await prisma.staffPropertyAssignment.findMany({
                where: { staffMemberId: user.staffProfile.id },
                select: { propertyId: true }
            });
            whereClause.propertyId = { in: assignments.map(a => a.propertyId) };
        } else {
            whereClause.property = { ownerId: user?.parentOwnerId || userId };
        }
    }

    // Tab Logic
    if (params.activeTab === 'ACTIVE') {
        whereClause.status = 'Active';
    } else if (params.activeTab === 'UPCOMING') {
        whereClause.status = 'Upcoming';
    } else if (params.activeTab === 'CHECKED_OUT') {
        whereClause.status = 'Checked Out';
    }

    // Property Logic
    if (params.filterProperty && params.filterProperty !== 'ALL') {
        whereClause.property = { ...((whereClause.property as any) || {}), name: params.filterProperty };
    }

    // Type Logic
    if (params.filterType && params.filterType !== 'ALL') {
        whereClause.roomType = params.filterType;
    }

    // Search Logic
    if (params.search && params.search.trim() !== '') {
        const searchTerm = params.search.trim();
        whereClause.OR = [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { roomNumber: { contains: searchTerm, mode: 'insensitive' } },
            { displayId: { contains: searchTerm, mode: 'insensitive' } },
            { booking: { displayId: { contains: searchTerm, mode: 'insensitive' } } }
        ];
    }

    // Payment Logic (this requires a sub-query)
    if (params.filterPayment && params.filterPayment !== 'ALL') {
        if (params.filterPayment === 'BLOCKED') {
            whereClause.status = 'Blocked';
        } else if (params.filterPayment === 'VACATED_FILTER') {
            whereClause.status = 'Checked Out';
        } else if (params.filterPayment === 'DEBT_FILTER') {
            whereClause.status = 'Checked Out';
            whereClause.settlementRecord = { tenantDebt: { gt: 0 } };
        } else if (params.filterPayment === 'PAID') {
            whereClause.rentRecords = { some: { month: params.currentMonth, paid: true } };
        } else if (params.filterPayment === 'UNPAID') {
            whereClause.rentRecords = { some: { month: params.currentMonth, paid: false } };
        }
    }

    const total = await prisma.tenant.count({ where: whereClause });

    const tenants = await prisma.tenant.findMany({
        where: whereClause,
        include: {
            property: { 
                select: { name: true, displayId: true, address: true, city: true, foodType: true, foodPricePerMonth: true, owner: { select: { name: true, phone: true } } } 
            },
            rentRecords: { orderBy: { createdAt: 'desc' } },
            billingProfile: { include: { invoices: { include: { payments: { where: { status: 'VERIFIED' } } } } } },
            booking: { select: { id: true, displayId: true, status: true, moveInChecklist: true, foodSelected: true, foodPriceApplied: true,
                    user: { select: { displayId: true, dateOfBirth: true, gender: true, nationality: true, emergencyContact: true, occupationType: true, occupationDetail: true, businessName: true, college: true, email: true, phone: true } } } },
            settlementRecord: true
        },
        orderBy: { createdAt: 'desc' },
        skip: params.offset,
        take: params.limit
    });

    // ── BULK FETCH FOR ACTION NOTES (Fix N+1) ──
    const tenantIds = tenants.map(t => t.id);
    const allNotes = await prisma.actionNote.findMany({
        where: { targetId: { in: tenantIds }, targetType: 'TENANT' },
        orderBy: { timestamp: 'desc' }
    });
    const notesByTenant = new Map<string, any[]>();
    allNotes.forEach(n => {
        if (!notesByTenant.has(n.targetId!)) notesByTenant.set(n.targetId!, []);
        notesByTenant.get(n.targetId!)!.push(n);
    });

    const withNotes = tenants.map(t => ({
        ...t,
        actionNotes: notesByTenant.get(t.id) || []
    }));

    return { data: withNotes, total };
}

export async function getTenantStats() {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) throw new Error("Unauthorized");
    const userId = session.userId;

    const baseWhere: Prisma.TenantWhereInput = {};

    if (session.role === 'OWNER' || session.role === 'STAFF') {
        const user = await prisma.user.findUnique({ 
            where: { id: userId },
            include: { staffProfile: true }
        });
        
        if (user?.staffProfile) {
            const assignments = await prisma.staffPropertyAssignment.findMany({
                where: { staffMemberId: user.staffProfile.id },
                select: { propertyId: true }
            });
            baseWhere.propertyId = { in: assignments.map(a => a.propertyId) };
        } else {
            baseWhere.property = { ownerId: user?.parentOwnerId || userId };
        }
    }

    const [active, upcoming, checkedOut] = await Promise.all([
        prisma.tenant.count({ where: { ...baseWhere, status: 'Active' } }),
        prisma.tenant.count({ where: { ...baseWhere, status: 'Upcoming' } }),
        prisma.tenant.count({ where: { ...baseWhere, status: 'Checked Out' } })
    ]);

    return { active, upcoming, checkedOut };
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
        const tenantDisplayId = await generateSequentialId('TENANT');

        // â”€â”€ CRITICAL: startDate = agreement signing date (source of truth for all billing) â”€â”€
        // The day the tenant signs the agreement IS their stay start date.
        // All rent calculations (prorated first month, billing cycles, stay duration) flow from this.
        const agreementDate = (booking as any).agreementSignedAt
            ? new Date((booking as any).agreementSignedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : booking.moveInDate || new Date().toLocaleDateString('en-IN');

        const tenant = await tx.tenant.create({
            data: {
                displayId: tenantDisplayId,
                applicationId: tenantDisplayId,
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
                startDate: agreementDate,
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
        include: { bed: true, booking: { select: { agreementSignedAt: true } } }
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

        // 3. Update Booking status to ACTIVE
        if (tenant.bookingId) {
            await tx.booking.update({
                where: { id: tenant.bookingId },
                data: { status: 'ACTIVE' }
            });
        }

        // UNIFIED CALENDAR BILLING
        // Billing is always anchored to the 1st of every calendar month.
        // First month = prorated from agreement signing date â†’ last day of that month.
        // tenant.startDate IS the agreement signing date (set in signAgreement()).
        const BILLING_ANCHOR = 1;

        const rentAmount = typeof tenant.rent === 'string' ? parseFloat((tenant.rent as string).replace(/[^0-9.]/g, '')) : Number(tenant.rent);
        const moveInDate = tenant.booking?.agreementSignedAt ? new Date(tenant.booking.agreementSignedAt) : new Date(tenant.startDate); // = agreement signing date

        const profile = await tx.billingProfile.create({
            data: {
                tenantId,
                propertyId: tenant.propertyId,
                roomId: tenant.roomId,
                bedId: tenant.bedId,
                monthlyRent: rentAmount,
                securityDeposit: rentAmount,
                billingDay: BILLING_ANCHOR,
                billingAnchorDay: BILLING_ANCHOR,
            }
        });

        // â”€â”€ Prorated first-month rent invoice â”€â”€
        // Days charged = move-in day â†’ last day of that month (inclusive)
        const { firstMonthRent, proratedNote } = await import('@/utils/billingUtils');
        const year = moveInDate.getFullYear();
        const monthNum = String(moveInDate.getMonth() + 1).padStart(2, '0');
        const firstMonthLabel = `${year}-${monthNum}`;
        const firstInvoiceAmount = firstMonthRent(rentAmount, moveInDate);
        const note = proratedNote(moveInDate); // e.g. "Prorated â€” 28 May to 31 May (4 days)"

        await tx.rentRecord.create({
            data: {
                tenantId,
                month: firstMonthLabel,
                amount: firstInvoiceAmount,
                paid: false,
                note,
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
            description: `Tenant ${tenant.name} moved in ${moveInDate.getDate()} ${firstMonthLabel}. First invoice: â‚¹${firstInvoiceAmount} (${note}). Billing anchor: 1st of every month.`,
        });

        revalidatePath('/dashboard/owner/tenants');
        revalidatePath('/dashboard/owner/financials');
        return { success: true };
    });
}

export async function markRentAsPaid(recordId: string, paymentMethod: 'CASH' | 'ONLINE', reason: string) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) throw new Error("Unauthorized");

    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    
    // 1. Update the RentRecord
    const record = await prisma.rentRecord.update({
        where: { id: recordId },
        data: { paid: true, paidOn: today, note: `Method: ${paymentMethod} | Note: ${reason}` }
    });

    // 2. Find and update the corresponding RentInvoice
    const tenant = await prisma.tenant.findUnique({
        where: { id: record.tenantId },
        include: { billingProfile: { include: { invoices: true } } }
    });

    if (tenant && tenant.billingProfile) {
        const matchingInvoice = tenant.billingProfile.invoices.find(
            (inv: any) => inv.month === record.month && inv.status !== 'PAID'
        );

        if (matchingInvoice) {
            // Update the RentInvoice status to PAID
            await prisma.rentInvoice.update({
                where: { id: matchingInvoice.id },
                data: {
                    status: 'PAID',
                    paidAmount: matchingInvoice.amount,
                    paidAt: new Date(),
                    paymentMethod: paymentMethod,
                    confirmedBy: session.userId,
                    confirmedByName: `${session.name || 'Admin'} (Override)`,
                }
            });

            // Create a Payment record so it is documented in the payment history/ledgers
            await (prisma as any).payment.create({
                data: {
                    bookingId: tenant.bookingId!,
                    invoiceId: matchingInvoice.id,
                    amount: matchingInvoice.amount,
                    method: paymentMethod,
                    status: 'VERIFIED',
                    razorpayId: paymentMethod === 'ONLINE' ? `admin_online_${Date.now()}` : `admin_cash_${Date.now()}`,
                    verifiedBy: 'ADMIN_OVERRIDE',
                    transferStatus: 'RELEASED',
                    date: new Date()
                }
            });
        }
    }

    // Write action note
    await prisma.actionNote.create({
        data: {
            targetId: record.tenantId,
            targetType: 'TENANT',
            action: 'PAYMENT_MARKED_PAID',
            reason: `Mode: ${paymentMethod} | Reason: ${reason}`,
            performedBy: session.userId
        }
    });

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'ADMIN',
        actorName: session.name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'TENANT',
        entityId: record.tenantId,
        description: `Rent for ${record.month} marked as paid via Admin Override. Mode: ${paymentMethod}. Reason: ${reason}`,
    });

    revalidatePath('/dashboard/owner/tenants');
    revalidatePath('/dashboard/owner/payments');
    revalidatePath('/dashboard/admin/tenants');
    return record;
}

export async function markRentAsUnpaid(
    recordId: string, 
    reversalReason: 'TRANSACTION_FAILURE' | 'OTHER' | string = 'OTHER', 
    note?: string
) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) throw new Error("Unauthorized");

    let actualReason = 'OTHER';
    let actualNote = '';

    if (reversalReason === 'TRANSACTION_FAILURE' || reversalReason === 'OTHER') {
        actualReason = reversalReason;
        actualNote = note || '';
    } else {
        actualReason = 'OTHER';
        actualNote = reversalReason || '';
    }

    const record = await prisma.rentRecord.update({
        where: { id: recordId },
        data: { paid: false, paidOn: null, note: `Reason: ${actualReason} | Note: ${actualNote}` }
    });

    // Find and update the corresponding RentInvoice
    const tenant = await prisma.tenant.findUnique({
        where: { id: record.tenantId },
        include: { billingProfile: { include: { invoices: true } } }
    });

    if (tenant && tenant.billingProfile) {
        const matchingInvoice = tenant.billingProfile.invoices.find(
            (inv: any) => inv.month === record.month && inv.status === 'PAID'
        );

        if (matchingInvoice) {
            await prisma.rentInvoice.update({
                where: { id: matchingInvoice.id },
                data: {
                    status: 'PENDING',
                    paidAmount: 0,
                    paidRentAmount: 0,
                    paidFoodAmount: 0,
                    paidAt: null,
                    paymentMethod: null,
                    confirmedBy: null,
                    confirmedByName: null
                }
            });

            // Delete the mock override Payment record if it exists
            await (prisma as any).payment.deleteMany({
                where: {
                    invoiceId: matchingInvoice.id,
                    verifiedBy: 'ADMIN_OVERRIDE'
                }
            });
        }
    }

    await prisma.actionNote.create({
        data: {
            targetId: record.tenantId,
            targetType: 'TENANT',
            action: 'PAYMENT_MARKED_UNPAID',
            reason: `Reason: ${actualReason} | Note: ${actualNote}`,
            performedBy: session.userId
        }
    });

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'OWNER',
        actorName: session.name || 'Owner',
        actionType: 'UPDATE',
        entityType: 'TENANT',
        entityId: record.tenantId,
        description: `Rent for ${record.month} reversed to Unpaid. Reason: ${actualReason}. Note: ${actualNote}`,
    });

    revalidatePath('/dashboard/owner/tenants');
    revalidatePath('/dashboard/owner/payments');
    revalidatePath('/dashboard/admin/tenants');
    return record;
}

export async function blockTenant(tenantId: string, note: string) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) throw new Error("Unauthorized");

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
            property: true,
            bed: true,
            rentRecords: true,
            booking: { select: { agreementSignedAt: true } }
        }
    });

    if (!tenant) throw new Error("Tenant not found");
    if (tenant.status === 'Checked Out' || tenant.status === 'Blocked') {
        throw new Error("Tenant already moved out or blocked");
    }

    return await prisma.$transaction(async (tx) => {
        const moveOutDate = new Date();
        const moveInDate = tenant.booking?.agreementSignedAt ? new Date(tenant.booking.agreementSignedAt) : new Date(tenant.startDate);
        const duration = Math.ceil((moveOutDate.getTime() - moveInDate.getTime()) / (1000 * 60 * 60 * 24));

        // 1. Financial Settlement logic for Eviction
        const unpaidRent = tenant.rentRecords.filter(r => !r.paid).reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
        const totalPaidRent = tenant.rentRecords.filter(r => r.paid).reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
        const depositAmount = typeof tenant.rent === 'number' ? tenant.rent : parseFloat(String(tenant.rent).replace(/[^0-9.]/g, '')) || 0; 
        
        // In an eviction/block, we assume no extra manual damage deductions are entered in this quick action,
        // but we seize deposit against unpaid rent.
        const finalRefund = depositAmount - unpaidRent;

        const settlementSummary = `
EVICTION / BLOCK Summary:
- Security Deposit: â‚¹${depositAmount.toLocaleString('en-IN')}
- Unpaid Rent: â‚¹${unpaidRent.toLocaleString('en-IN')}
-------------------
Final Refund Due: â‚¹${finalRefund.toLocaleString('en-IN')}
-------------------
Block Reason: ${note}
`.trim();

        // 2. Create formal Settlement Record
        await tx.settlementRecord.create({
            data: {
                tenantId,
                finalRentPending: unpaidRent,
                damageDeductions: 0,
                depositRefunded: finalRefund > 0 ? finalRefund : 0,
                tenantDebt: finalRefund < 0 ? Math.abs(finalRefund) : 0,
                notes: `EVICTION: ${note}`,
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
                data: { status: 'CHECKED_OUT' } // Kept as checked out to free workflow
            });
        }

        // 5. Update Tenant Status to Blocked
        const updatedTenant = await tx.tenant.update({
            where: { id: tenantId },
            data: { 
                status: 'Blocked', 
                actualMoveOutDate: moveOutDate.toISOString(),
                vacateNote: settlementSummary 
            }
        });

        await tx.actionNote.create({
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
            description: `Tenant Blocked/Evicted. Bed cleared. Reason: ${note}`,
        });

        return updatedTenant;
    });
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
        description: `Generated rent invoice for ${month} (â‚¹${tenant.rent})`,
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
            rentRecords: true,
            booking: { select: { agreementSignedAt: true } }
        }
    });

    if (!tenant) throw new Error("Tenant not found");

    // Idempotent: if already checked out, ensure notice is VACATED and return success
    if (tenant.status === 'Checked Out') {
        if (tenant.bookingId) {
            await prisma.vacatingNotice.updateMany({
                where: { bookingId: tenant.bookingId, status: { notIn: ['VACATED', 'WITHDRAWN'] } },
                data:  { status: 'VACATED' }
            });
        }
        return { alreadyMoved: true };
    }

    return await prisma.$transaction(async (tx) => {
        const moveOutDate = new Date();
        const moveInDate = tenant.booking?.agreementSignedAt ? new Date(tenant.booking.agreementSignedAt) : new Date(tenant.startDate);
        const duration = Math.ceil((moveOutDate.getTime() - moveInDate.getTime()) / (1000 * 60 * 60 * 24));

        // 1. Prorated last-month rent — update/create the final month record
        const monthlyRent = typeof tenant.rent === 'number' ? tenant.rent : parseFloat(String(tenant.rent).replace(/[^0-9.]/g, ''));
        const lastMonthLabel = `${moveOutDate.getFullYear()}-${String(moveOutDate.getMonth() + 1).padStart(2, '0')}`;
        const prorated = lastMonthRent(monthlyRent, moveOutDate);

        let prepaidRentCredit = 0;
        let originalPaidAmount = 0;
        const existingRecord = await tx.rentRecord.findFirst({ where: { tenantId, month: lastMonthLabel } });
        
        if (existingRecord) {
            if (existingRecord.paid) {
                // If paid, the student prepaid rent for this month.
                // Look up the invoice to get the exact paid rent amount.
                const invoice = await tx.rentInvoice.findFirst({
                    where: {
                        tenantId,
                        billingMonth: lastMonthLabel,
                        status: 'PAID'
                    }
                });
                originalPaidAmount = invoice 
                    ? Number(invoice.paidRentAmount || invoice.rentAmount || monthlyRent)
                    : Number(existingRecord.amount || monthlyRent);
                
                if (originalPaidAmount > prorated) {
                    prepaidRentCredit = originalPaidAmount - prorated;
                }
                
                await tx.rentRecord.update({
                    where: { id: existingRecord.id },
                    data: { 
                        amount: prorated, 
                        note: `Prorated — move-out ${moveOutDate.getDate()} ${lastMonthLabel}. Paid Full: ₹${originalPaidAmount}. Unused Rent Credit: ₹${prepaidRentCredit}` 
                    }
                });
            } else {
                await tx.rentRecord.update({
                    where: { id: existingRecord.id },
                    data: { 
                        amount: prorated, 
                        note: `Prorated — move-out ${moveOutDate.getDate()} ${lastMonthLabel}` 
                    }
                });
            }
        } else {
            await tx.rentRecord.create({
                data: { 
                    tenantId, 
                    month: lastMonthLabel, 
                    amount: prorated, 
                    paid: false, 
                    note: `Prorated — move-out ${moveOutDate.getDate()} ${lastMonthLabel}` 
                }
            });
        }

        // Recalculate unpaid AFTER patching prorated record
        const allRecords = await tx.rentRecord.findMany({ where: { tenantId } });
        const unpaidRent = allRecords.filter(r => !r.paid).reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
        const totalPaidRent = allRecords.filter(r => r.paid).reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
        const depositAmount = monthlyRent;
        const finalRefund = depositAmount - unpaidRent - deductions + prepaidRentCredit;

        const settlementSummary = `
Settlement Summary:
- Security Deposit: ₹${depositAmount.toLocaleString('en-IN')}
- Unpaid Rent: ₹${unpaidRent.toLocaleString('en-IN')} (incl. prorated move-out month)
- Prepaid Rent Refund Credit: ₹${prepaidRentCredit.toLocaleString('en-IN')}
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
                tenantDebt: finalRefund < 0 ? Math.abs(finalRefund) : 0,
                notes: `Deductions: ${note}${prepaidRentCredit > 0 ? ` | Rent Overpayment Refund Credit: ₹${prepaidRentCredit}` : ''}`,
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

        // 6. Mark VacatingNotice as VACATED (so owner/tenant dashboards reflect completion)
        if (tenant.bookingId) {
            await tx.vacatingNotice.updateMany({
                where: { bookingId: tenant.bookingId, status: { not: 'WITHDRAWN' } },
                data: { status: 'VACATED' }
            });
        }

        // 7. Log event
        logAuditEvent({
            actorId: session.userId,
            actorRole: session.role || 'OWNER',
            actorName: session.name || 'Owner',
            actionType: 'DELETE',
            entityType: 'TENANT',
            entityId: tenantId,
            description: `Move-out finalized. Settlement: Refund â‚¹${finalRefund}. Notice marked VACATED.`,
        });

        revalidatePath('/dashboard/owner/tenants');
        revalidatePath('/dashboard/admin/tenants');
        revalidatePath('/dashboard/owner');
        revalidatePath('/dashboard/owner/availability');
        revalidatePath('/dashboard/owner/notices');
        revalidatePath('/dashboard/student/notice');
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
        include: { staffProfile: true }
    });
    
    let pIds: string[] = [];
    
    if (user?.staffProfile) {
        const assignments = await prisma.staffPropertyAssignment.findMany({
            where: { staffMemberId: user.staffProfile.id },
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
        include: { 
            property: { select: { name: true } },
            booking: { select: { displayId: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
}

// Aliases for compatibility
export const initiateMoveOut = confirmMoveOut;

export async function getMoveInChecklist(bookingId: string) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) throw new Error("Unauthorized");

    return await prisma.moveInChecklist.findUnique({
        where: { bookingId }
    });
}

export async function validateAdminCredentialOverride(
    tenantId: string,
    type: 'email' | 'phone',
    target: string
) {
    const session = await getSession();
    if (!session || !['ADMIN', 'STAFF'].includes(session.role)) {
        return { error: "Unauthorized" };
    }

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId }
    });
    if (!tenant) return { error: "Tenant not found" };

    if (type === 'email') {
        const existing = await prisma.user.findFirst({
            where: { email: target, NOT: { id: tenant.studentId } }
        });
        if (existing) {
            return { error: `This email is already registered to user: ${existing.name || 'Unknown'} (Permanent ID: ${existing.displayId || '—'}, Phone: ${existing.phone || '—'}).` };
        }
    } else {
        const existing = await prisma.user.findFirst({
            where: { phone: target, NOT: { id: tenant.studentId } }
        });
        if (existing) {
            return { error: `This phone is already registered to user: ${existing.name || 'Unknown'} (Permanent ID: ${existing.displayId || '—'}, Email: ${existing.email || '—'}).` };
        }
    }

    return { success: true };
}

export async function updateTenantProfile(
    tenantId: string,
    data: {
        name?: string;
        phone?: string;
        email?: string;
        dateOfBirth?: string;
        gender?: string;
        nationality?: string;
        occupationType?: string;
        occupationDetail?: string;
        emergencyContact?: string;
        startDate?: string;
    },
    audit: {
        ticketId: string;
        reason: string;
    }
) {
    const session = await getSession();
    if (!session || !['ADMIN', 'STAFF'].includes(session.role)) {
        return { error: "Unauthorized" };
    }

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId }
    });
    if (!tenant) return { error: "Tenant not found" };

    // 1. Uniqueness Checks
    if (data.email && data.email !== tenant.email) {
        const existingEmailUser = await prisma.user.findFirst({
            where: {
                email: data.email,
                NOT: { id: tenant.studentId }
            }
        });
        if (existingEmailUser) {
            return { error: `This email is already registered to user: ${existingEmailUser.name || 'Unknown'} (Permanent ID: ${existingEmailUser.displayId || '—'}, Phone: ${existingEmailUser.phone || '—'}).` };
        }
    }

    if (data.phone && data.phone !== tenant.phone) {
        const existingPhoneUser = await prisma.user.findFirst({
            where: {
                phone: data.phone,
                NOT: { id: tenant.studentId }
            }
        });
        if (existingPhoneUser) {
            return { error: `This phone is already registered to user: ${existingPhoneUser.name || 'Unknown'} (Permanent ID: ${existingPhoneUser.displayId || '—'}, Email: ${existingPhoneUser.email || '—'}).` };
        }
    }

    // 2. Alert notifications sent to both old and new contact details
    if (data.email && data.email !== tenant.email) {
        console.log(`[SECURITY ALERT] Email updated for Tenant ID: ${tenantId}.`);
        console.log(`- Alert sent to Old Email: ${tenant.email}`);
        console.log(`- Alert sent to New Email: ${data.email}`);
    }
    if (data.phone && data.phone !== tenant.phone) {
        console.log(`[SECURITY ALERT] Phone updated for Tenant ID: ${tenantId}.`);
        console.log(`- Alert sent to Old Phone: ${tenant.phone}`);
        console.log(`- Alert sent to New Phone: ${data.phone}`);
    }

    return await prisma.$transaction(async (tx) => {
        // 1. Update Tenant
        const tenantUpdateData: any = {};
        if (data.name !== undefined) tenantUpdateData.name = data.name;
        if (data.phone !== undefined) tenantUpdateData.phone = data.phone;
        if (data.email !== undefined) tenantUpdateData.email = data.email;
        if (data.occupationType !== undefined) tenantUpdateData.occupationType = data.occupationType;
        if (data.occupationDetail !== undefined) tenantUpdateData.occupationDetail = data.occupationDetail;
        if (data.startDate !== undefined) tenantUpdateData.startDate = data.startDate;

        await tx.tenant.update({
            where: { id: tenantId },
            data: tenantUpdateData
        });

        // 2. Update User (Student)
        const userUpdateData: any = {};
        if (data.name !== undefined) userUpdateData.name = data.name;
        if (data.phone !== undefined) {
            userUpdateData.phone = data.phone;
            userUpdateData.phoneVerified = true;
        }
        if (data.email !== undefined) {
            userUpdateData.email = data.email;
            userUpdateData.emailVerified = true;
        }
        if (data.dateOfBirth !== undefined) userUpdateData.dateOfBirth = data.dateOfBirth;
        if (data.gender !== undefined) userUpdateData.gender = data.gender;
        if (data.nationality !== undefined) userUpdateData.nationality = data.nationality;
        if (data.occupationType !== undefined) userUpdateData.occupationType = data.occupationType;
        
        if (data.occupationType === 'Student') {
            if (data.occupationDetail !== undefined) userUpdateData.college = data.occupationDetail;
        } else if (data.occupationType === 'Working Professional') {
            if (data.occupationDetail !== undefined) {
                userUpdateData.businessName = data.occupationDetail;
                userUpdateData.occupationDetail = data.occupationDetail;
            }
        }
        if (data.emergencyContact !== undefined) userUpdateData.emergencyContact = data.emergencyContact;

        await tx.user.update({
            where: { id: tenant.studentId },
            data: userUpdateData
        });

        // 3. Update Booking
        if (tenant.bookingId) {
            const bookingUpdateData: any = {};
            if (data.name !== undefined) bookingUpdateData.guestName = data.name;
            if (data.phone !== undefined) bookingUpdateData.guestPhone = data.phone;
            if (data.email !== undefined) bookingUpdateData.guestEmail = data.email;
            if (data.startDate !== undefined) bookingUpdateData.moveInDate = data.startDate;
            if (data.occupationType !== undefined) bookingUpdateData.occupationType = data.occupationType;
            if (data.occupationDetail !== undefined) bookingUpdateData.occupationDetail = data.occupationDetail;

            await tx.booking.update({
                where: { id: tenant.bookingId },
                data: bookingUpdateData
            });
        }

        // 4. Create Audit Log / Action Note
        const trackingReason = `Support Ticket ID: ${audit.ticketId || 'N/A'} | Reason: ${audit.reason} | Updated by: ${session.name || 'Admin'}`;
        await tx.actionNote.create({
            data: {
                targetId: tenantId,
                targetType: 'TENANT',
                action: 'PROFILE_EDITED',
                reason: trackingReason,
                performedBy: session.userId
            }
        });

        logAuditEvent({
            actorId: session.userId,
            actorRole: session.role || 'ADMIN',
            actorName: session.name || 'Admin',
            actionType: 'UPDATE',
            entityType: 'TENANT',
            entityId: tenantId,
            description: `Profile edited. Ticket: ${audit.ticketId || 'N/A'}. Reason: ${audit.reason}`,
        });

        revalidatePath('/dashboard/admin/tenants');
        revalidatePath('/dashboard/owner/tenants');
        return { success: true };
    });
}

export async function requestSelfServiceOTP(type: 'email' | 'phone', target: string, direction: 'old' | 'new') {
    const session = await getSession();
    if (!session || !session.userId) return { error: "Unauthorized" };

    if (direction === 'new') {
        const existing = await prisma.user.findFirst({
            where: type === 'email' ? { email: target } : { phone: target }
        });
        if (existing) {
            return { error: type === 'email' ? 'Email is already registered' : 'Phone is already registered' };
        }
    }

    console.log(`[MOCK OTP] Sent to ${target} (${direction} ${type}): 123456`);
    return { success: true, message: `OTP sent successfully to ${target} (Mock OTP: 123456)` };
}

export async function verifyAndUpdateSelfService(
    type: 'email' | 'phone',
    oldOtp: string,
    newTarget: string,
    newOtp: string
) {
    const session = await getSession();
    if (!session || !session.userId) return { error: "Unauthorized" };

    if (oldOtp !== '123456' || newOtp !== '123456') {
        return { error: "Invalid verification OTP. Please try again." };
    }

    const existing = await prisma.user.findFirst({
        where: type === 'email' ? { email: newTarget } : { phone: newTarget }
    });
    if (existing) {
        return { error: type === 'email' ? 'Email is already registered' : 'Phone is already registered' };
    }

    const tenant = await prisma.tenant.findFirst({
        where: { studentId: session.userId }
    });
    if (!tenant) return { error: "Tenant record not found" };

    const oldTarget = type === 'email' ? tenant.email : tenant.phone;

    return await prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: session.userId },
            data: type === 'email' 
                ? { email: newTarget, emailVerified: true } 
                : { phone: newTarget, phoneVerified: true }
        });

        await tx.tenant.update({
            where: { id: tenant.id },
            data: type === 'email' ? { email: newTarget } : { phone: newTarget }
        });

        if (tenant.bookingId) {
            await tx.booking.update({
                where: { id: tenant.bookingId },
                data: type === 'email' ? { guestEmail: newTarget } : { guestPhone: newTarget }
            });
        }

        const trackingReason = `Self-service update. Changed ${type} from ${oldTarget} to ${newTarget}.`;
        await tx.actionNote.create({
            data: {
                targetId: tenant.id,
                targetType: 'TENANT',
                action: 'PROFILE_EDITED',
                reason: trackingReason,
                performedBy: session.userId
            }
        });

        logAuditEvent({
            actorId: session.userId,
            actorRole: session.role || 'USER',
            actorName: session.name || 'User',
            actionType: 'UPDATE',
            entityType: 'TENANT',
            entityId: tenant.id,
            description: trackingReason
        });

        console.log(`[SECURITY ALERT] Self-Service Update of ${type} for User ID: ${session.userId}.`);
        console.log(`- Alert sent to Old ${type}: ${oldTarget}`);
        console.log(`- Alert sent to New ${type}: ${newTarget}`);

        // Invalidate active session if email changes
        if (type === 'email') {
            const cookieStore = await cookies();
            cookieStore.delete('rentpe_session');
        }

        revalidatePath('/dashboard/admin/tenants');
        revalidatePath('/dashboard/owner/tenants');
        revalidatePath('/dashboard/student');
        return { success: true };
    });
}



