'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { NotificationService } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { logAuditEvent } from "@/lib/audit";
import { generateSequentialId } from "@/lib/ids";
import { validateBooking, recordFingerprint } from "@/lib/fraud";



export async function createBooking(data: {
    roomId?: string,
    propertyName: string,
    occupancy: string,
    guestName: string,
    moveInDate: string,
    amount: number,
    guestEmail?: string,
    guestPhone?: string,
    occupationType?: string,
    occupationDetail?: string,
    propertyId?: string,
    stayDuration?: number,
    occupants?: number,
    message?: string,
    _deviceHash?: string,
    _ipAddress?: string,
    _userAgent?: string,
}) {
    const session = await getSession();
    if (!session) throw new Error("You must be logged in to book.");

    const userId = session.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // ─── SECURITY GUARD 1: Owner cannot book their own property ───────────────
    if (data.propertyId) {
        const ownedProperty = await prisma.property.findUnique({
            where: { id: data.propertyId },
            select: { ownerId: true, name: true, status: true }
        });

        if (!ownedProperty) throw new Error("Property not found.");

        if (ownedProperty.ownerId === userId) {
            // Log this suspicious/accidental attempt
            await logAuditEvent({
                actorId: userId,
                actorRole: session.role as string,
                actorName: session.name || 'User',
                actionType: 'CREATE',
                entityType: 'BOOKING',
                entityId: data.propertyId,
                description: `BLOCKED: Owner attempted to book their own property: ${ownedProperty.name}`,
            });
            throw new Error("You cannot book your own property.");
        }

        // ─── SECURITY GUARD 2: Property must be LIVE ────────────────────────
        if (ownedProperty.status !== 'LIVE') {
            throw new Error("This property is not currently available for booking.");
        }

        // ─── SECURITY GUARD 3: No duplicate active booking for same room ────
        if (data.roomId) {
            const existingBooking = await prisma.booking.findFirst({
                where: {
                    userId,
                    roomId: data.roomId,
                    status: { in: ['PENDING_APPROVAL', 'REQUESTED', 'APPROVED', 'APPROVED_PENDING_TOKEN', 'ROOM_RESERVED', 'KYC_PENDING', 'APPROVED_KYC_PENDING'] }
                }
            });
            if (existingBooking) {
                throw new Error("You already have an active booking for this room.");
            }
        }

        // ─── SECURITY GUARD 4: Previously Evicted/Blocked from this PG ──────
        const pastEviction = await prisma.tenant.findFirst({
            where: {
                studentId: userId,
                propertyId: data.propertyId,
                status: 'Blocked'
            }
        });

        if (pastEviction) {
            throw new Error("You are not eligible to book this property.");
        }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ─── FRAUD GATE (must run BEFORE writing anything to DB) ──────────────────
    if (data.propertyId) {
        // Record this fingerprint for future tracking
        await recordFingerprint(userId, {
            deviceHash: data._deviceHash,
            ipAddress: data._ipAddress || '0.0.0.0',
            userAgent: data._userAgent || 'unknown',
        });

        const fraudCheck = await validateBooking(
            userId,
            data.propertyId,
            { deviceHash: data._deviceHash },
            data._ipAddress,
            data._userAgent
        );

        if (!fraudCheck.allowed) {
            throw new Error(fraudCheck.reason || 'Booking blocked by security check.');
        }

        // Attach risk score to booking data for admin visibility
        (data as any)._fraudRiskScore = fraudCheck.riskScore;
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Auto-fill from profile if not provided
    const guestName = data.guestName || user?.name || "Anonymous";
    const guestEmail = data.guestEmail || user?.email;
    const guestPhone = data.guestPhone || user?.phone;

    // Server-side date validation: Move-in cannot be in the past
    const selectedDate = new Date(data.moveInDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
        throw new Error("Move-in date cannot be in the past.");
    }

    const displayId = await generateSequentialId('BOOKING');
    const booking = await prisma.booking.create({
        data: {
            displayId,
            userId: session.userId,
            roomId: data.roomId,
            propertyName: data.propertyName,
            occupancy: data.occupancy,
            guestName,
            moveInDate: data.moveInDate,
            amount: data.amount,
            status: 'APPLIED',
            appliedAt: new Date(),
            paymentStatus: 'UNPAID',
            guestEmail,
            guestPhone,
            occupationType: data.occupationType,
            occupationDetail: data.occupationDetail,
            propertyId: data.propertyId,
            stayDuration: data.stayDuration,
            occupants: data.occupants,
            message: data.message,
            fraudRiskScore: (data as any)._fraudRiskScore || 0,
        } as any
    });

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'USER',
        actorName: session.name || 'Student',
        actionType: 'CREATE',
        entityType: 'BOOKING',
        entityId: booking.id,
        entityName: data.propertyName,
        description: `Booking for ${data.propertyName} requested by ${data.guestName}. FraudScore: ${(data as any)._fraudRiskScore || 0}`,
        newValue: booking
    });
    try {
        const property = await prisma.property.findFirst({ 
            where: { name: data.propertyName },
            include: { owner: { select: { id: true, email: true } } }
        });
        
        if (property) {
            await NotificationService.onBookingRequest(booking, property.ownerId);
        }
    } catch (e) { 
        console.error("Booking Notification Error:", e);
    }

    revalidatePath('/dashboard/student');
    revalidatePath('/dashboard/owner/bookings');
    return booking;
}

export async function getBookings() {
    try {
        const session = await getSession();
        if (!session) return [];

        const userId = session.userId;
        const role = session.role;

        // Security Patch: If the JWT is malformed or lacks a userId, reject the query.
        // Prisma natively interprets `undefined` as a query bypass, causing accidental data leaks.
        if (!userId) return [];

        if (role === 'OWNER' || role === 'STAFF') {
            const user = await prisma.user.findUnique({ 
                where: { id: userId },
                include: { employeeProfile: true }
            });
            
            let propertyIds: string[] = [];
            
            if (user?.employeeProfile) {
                // For staff, get assigned properties
                const assignments = await prisma.employeePropertyAssignment.findMany({
                    where: { employeeId: user.employeeProfile.id },
                    select: { propertyId: true }
                });
                propertyIds = assignments.map(a => a.propertyId);
            } else {
                // Primary owner sees all their properties
                const ownerProperties = await prisma.property.findMany({
                    where: { ownerId: user?.parentOwnerId || userId },
                    select: { id: true }
                });
                propertyIds = ownerProperties.map(p => p.id);
            }

            return await prisma.booking.findMany({
                where: { propertyId: { in: propertyIds } },
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { name: true, email: true } },
                    property: { select: { foodType: true, foodPricePerMonth: true, displayId: true } as any },
                    tenant: { select: { id: true, displayId: true } },
                }
            }).then(bookings => bookings.map(b => ({
                ...b,
                tenantDisplayId: (b as any).tenant?.displayId || null,
                userDisplayId: null,
                propertyDisplayId: (b as any).property?.displayId || null,
            })));
        } else {
            const bookings = await prisma.booking.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                include: {
                    room: {
                        select: {
                            id: true,
                            roomNumber: true,
                            type: true,
                            price: true,
                            depositMonths: true
                        }
                    },
                    property: {
                        include: {
                            owner: { select: { name: true, email: true, phone: true } }
                        }
                    },
                    user: { select: { name: true, email: true, displayId: true } },
                    tenant: { select: { id: true, displayId: true } },
                }
            });

            return bookings.map((b) => {
                return {
                    ...b,
                    tenantId: b.tenantId || null,
                    tenantDisplayId: (b as any).tenant?.displayId || null,
                    userDisplayId: (b as any).user?.displayId || null,
                    propertyDisplayId: b.property?.displayId || null,
                    ownerName: b.property?.owner?.name || null,
                    ownerEmail: b.property?.owner?.email || null,
                    ownerPhone: b.property?.owner?.phone || null,
                    propertyAddress: b.property?.address || null,
                    propertyCity: b.property?.city || null,
                    tokenPaidAt: (b as any).tokenPaidAt || null,
                    tokenPaymentId: (b as any).tokenPaymentId || null,
                    tokenAmount: (b as any).tokenAmount || 1000,
                };
            });
        }
    } catch (e) {
        console.error("getBookings Error:", e);
        return [];
    }
}

export async function getAdminBookings() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    const bookings = await prisma.booking.findMany({
        where: { deletedAt: null },
        include: { 
            user: { select: { name: true, email: true, displayId: true } },
            property: { select: { foodType: true, foodPricePerMonth: true, displayId: true } as any },
            tenant: { select: { id: true, displayId: true } },
        },
        orderBy: { createdAt: 'desc' }
    });
    return bookings.map(b => ({
        ...b,
        userDisplayId: (b as any).user?.displayId || null,
        tenantDisplayId: (b as any).tenant?.displayId || null,
        propertyDisplayId: (b as any).property?.displayId || null,
    }));
}

export async function approveBooking(id: string, data: {
    roomId?: string,
    bedId?: string,
    amount?: number,
    occupancy?: string,
    roomAssigned?: string,
    guestName?: string,
    guestEmail?: string,
    guestPhone?: string,
    guestAddress?: string,
    guestCity?: string,
    guestPincode?: string,
    guestCountry?: string,
    occupationType?: string,
    occupationDetail?: string,
    onboardingDate?: string,
    pendingAmount?: number,
    depositAmount?: number,
    depositMonths?: number,
    platformFeeAmount?: number,
    foodSelected?: boolean,
    foodPriceApplied?: number,
}) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const existingBooking = await prisma.booking.findUnique({ where: { id } });

    // When a bed is allocated (bedId present) → advance to APPROVED_PENDING_TOKEN
    // so student knows to pay ₹1,000 token. Otherwise just APPROVED (room not yet set).
    const newStatus = data.bedId ? 'APPROVED_PENDING_TOKEN' : 'APPROVED';

    const booking = await prisma.booking.update({
        where: { id },
        data: {
            status: newStatus,
            approvedAt: new Date(),
            roomId: data.roomId,
            amount: data.amount,
            occupancy: data.occupancy,
            roomAssigned: data.roomAssigned,
            guestName: data.guestName,
            guestEmail: data.guestEmail,
            guestPhone: data.guestPhone,
            guestAddress: data.guestAddress,
            guestCity: data.guestCity,
            guestPincode: data.guestPincode,
            guestCountry: data.guestCountry || 'India',
            occupationType: data.occupationType,
            occupationDetail: data.occupationDetail,
            onboardingDate: data.onboardingDate,
            pendingAmount: data.pendingAmount || null,
            depositAmount: data.depositAmount || null,
            depositMonths: data.depositMonths || null,
            platformFeeAmount: data.platformFeeAmount ?? null,
            // Section 5 — Lock food price at approval time (SECTION 8 — Billing: price immutable post-approval)
            foodSelected: data.foodSelected ?? false,
            foodPriceApplied: data.foodPriceApplied ?? 0,
        } as any
    });

    // Handle bed availability changes if the room assignment has changed
    if (existingBooking && data.roomId !== existingBooking.roomId) {
        if (existingBooking.roomId) {
            const oldRoom = await prisma.room.findUnique({ 
                where: { id: existingBooking.roomId },
                include: { beds: { select: { status: true } } }
            });
            if (oldRoom) {
                const realAvail = oldRoom.beds.filter(b => b.status === 'AVAILABLE').length;
                await prisma.room.update({
                    where: { id: oldRoom.id },
                    data: { availability: realAvail }
                });
            }
        }
        if (data.roomId) {
            const newRoom = await prisma.room.findUnique({ 
                where: { id: data.roomId },
                include: { beds: { select: { status: true } } }
            });
            if (newRoom) {
                const realAvail = newRoom.beds.filter(b => b.status === 'AVAILABLE').length;
                await prisma.room.update({
                    where: { id: newRoom.id },
                    data: { availability: realAvail }
                });
            }
        }
    }

    // Free old bed — find by lockedByBookingId (Booking has no bedId field)
    const oldBed = await prisma.bed.findFirst({ where: { lockedByBookingId: id } }).catch(() => null);
    if (oldBed && oldBed.id !== data.bedId) {
        await prisma.bed.update({
            where: { id: oldBed.id },
            data: { status: 'AVAILABLE', lockedByBookingId: null, lockedAt: null, tenantId: null }
        }).catch(() => {});
    }

    // Lock the new bed to this booking
    if (data.bedId) {
        await prisma.bed.update({
            where: { id: data.bedId },
            data: { status: 'LOCKED', lockedByBookingId: id, lockedAt: new Date() }
        }).catch(() => {});
    }

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role as string,
        actorName: session.name || 'Owner',
        actionType: 'APPROVE',
        entityType: 'BOOKING',
        entityId: id,
        description: `Booking approved. Allocated Room ${data.roomAssigned}. Onboarding: ${data.onboardingDate || 'TBD'}`,
        newValue: { roomAssigned: data.roomAssigned, onboardingDate: data.onboardingDate }
    });

    // Notify student — if bed allocated, prompt token payment; else just room allocation notice
    try {
        if (booking.userId && data.roomAssigned) {
            await NotificationService.onRoomAllocated(
                booking,
                data.roomAssigned,
                existingBooking?.occupancy || undefined,
                data.occupancy,
            );
        }
        // Extra: token payment prompt notification when bed is allocated
        if (booking.userId && data.bedId) {
            await NotificationService.trigger({
                bookingId: booking.id,
                userId: booking.userId,
                type: 'BOOKING',
                category: 'TOKEN_PAYMENT_REQUIRED',
                message: `Your bed at ${booking.propertyName} has been reserved! Pay ₹1,000 token now to lock it. This amount is NON-REFUNDABLE.`,
                targetRole: 'USER',
                isPersistent: true,
            } as any);
        }
    } catch (e) {
        console.error("Approval Notification Error:", e);
    }

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/owner/properties');
    revalidatePath('/dashboard/student');
    return booking;
}

export async function rejectBooking(id: string, reason?: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const existingBooking = await prisma.booking.findUnique({ where: { id } });

    const booking = await prisma.booking.update({
        where: { id },
        data: { 
            status: 'REJECTED',
            rejectedAt: new Date(),
            rejectionReason: reason || 'Rejected by owner'
        }
    });

    // Return bed if room was assigned
    if (existingBooking && existingBooking.roomId) {
        const room = await prisma.room.findUnique({ 
            where: { id: existingBooking.roomId },
            include: { beds: { select: { status: true } } }
        });
        if (room) {
            const realAvail = room.beds.filter(b => b.status === 'AVAILABLE').length;
            await prisma.room.update({
                where: { id: room.id },
                data: { availability: realAvail }
            });
        }
    }

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role as string,
        actorName: session.name || 'Owner',
        actionType: 'REJECT',
        entityType: 'BOOKING',
        entityId: id,
        description: `Booking rejected. Reason: ${reason || 'No reason provided'}`,
        newValue: { reason }
    });
    // Notify student about rejection
    try {
        if (booking.userId) {
            await NotificationService.trigger({
                bookingId: booking.id,
                userId: booking.userId,
                type: 'BOOKING',
                category: 'BOOKING_REJECTED',
                message: `Your booking for ${booking.propertyName} was rejected. ${reason || ''}`,
                targetRole: 'USER'
            });
            
            const student = await prisma.user.findUnique({ where: { id: booking.userId }, select: { email: true, name: true } });
            if (student?.email) {
                sendEmail({
                    to: student.email,
                    subject: `Booking Update: ${booking.propertyName}`,
                    html: `<p>Hi ${student.name || 'there'},</p><p>We regret to inform you that your booking for <strong>${booking.propertyName}</strong> was not approved by the owner.</p>${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}<p>Please feel free to browse other verified properties on RentPe.</p>`
                }).catch(err => console.error('Failed to email booking rejection:', err));
            }
        }
    } catch (e) {
        console.error("Booking Rejection Notification Error:", e);
    }

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/owner/properties');
    revalidatePath('/dashboard/student');
    return booking;
}

export async function updateBookingStatus(id: string, status: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const data: any = { status };
    if (status === 'APPLIED') data.appliedAt = new Date();
    if (status === 'APPROVED') data.approvedAt = new Date();
    if (status === 'MOVE_IN_SCHEDULED') data.moveInScheduled = new Date();
    if (status === 'ACTIVE') data.activeAt = new Date();
    if (status === 'COMPLETED') data.completedAt = new Date();
    if (status === 'REJECTED') data.rejectedAt = new Date();

    const booking = await prisma.booking.update({
        where: { id },
        data
    });

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/student');
    return booking;
}

// ─── Student registers cash payment intent (does NOT advance status) ──────────
// The booking stays in APPROVED state. The owner must separately click
// "Mark Cash Paid" to confirm physical cash receipt, which then sets
// status → MOVE_IN_SCHEDULED and unlocks the Agreement step for the student.
export async function registerCashIntent(id: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const b = await prisma.booking.findUnique({ where: { id }, select: { userId: true, status: true } });
    if (!b || b.userId !== (session as any).userId) throw new Error("Unauthorized");
    if (!['APPROVED', 'ROOM_RESERVED'].includes(b.status)) {
        throw new Error("Booking is not in a payable state.");
    }

    // Only record intent — do NOT change booking status to MOVE_IN_SCHEDULED
    const booking = await prisma.booking.update({
        where: { id },
        data: {
            paymentMethod: 'CASH',
            paymentStatus: 'CASH_PENDING',
        }
    });

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role as string,
        actorName: session.name || 'Student',
        actionType: 'UPDATE',
        entityType: 'BOOKING',
        entityId: id,
        description: `Student registered cash payment intent. Status stays APPROVED — owner must confirm cash receipt.`,
        newValue: { paymentStatus: 'CASH_PENDING', paymentMethod: 'CASH' }
    });

    revalidatePath('/dashboard/student');
    revalidatePath('/dashboard/owner/bookings');
    return booking;
}

export async function markBookingPaid(id: string, method: string, paymentId?: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const isStaff = session.role === 'OWNER' || session.role === 'STAFF' || session.role === 'ADMIN';
    if (!isStaff) {
        const b = await prisma.booking.findUnique({ where: { id }, select: { userId: true } });
        if (!b || b.userId !== (session as any).userId) throw new Error("Unauthorized");
    }

    // Fetch booking before update (need roomId, bedId for activation)
    const existingB = await prisma.booking.findUnique({
        where: { id },
        include: { documents: true, tenant: true }
    });
    if (!existingB) throw new Error('Booking not found');

    // Determine if this is final joining payment (MOVE_IN_SCHEDULED or BOOKING_CONFIRMED) → auto-activate
    const isFinalPayment = existingB.status === 'MOVE_IN_SCHEDULED' || existingB.status === 'BOOKING_CONFIRMED';

    const booking = await prisma.booking.update({
        where: { id },
        data: {
            status: isFinalPayment ? 'ACTIVE' : 'MOVE_IN_SCHEDULED',
            moveInScheduled: new Date(),
            paymentStatus: 'PAID',
            paymentMethod: method,
            paidAt: new Date(),
            ...(paymentId ? { paymentId } : {}),
            ...(isFinalPayment ? { activeAt: new Date() } : {}),
        } as any
    });

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role as string,
        actorName: session.name || 'Owner/Admin',
        actionType: 'UPDATE',
        entityType: 'BOOKING',
        entityId: id,
        description: `Final payment received via ${method}. ${isFinalPayment ? 'Tenant auto-activated.' : 'Status moved to MOVE_IN_SCHEDULED.'}`,
        newValue: { status: booking.status, paymentMethod: method }
    });

    // Auto-activate tenant when final joining payment is received
    if (isFinalPayment && existingB.roomId) {
        try {
            const room = await prisma.room.findUnique({
                where: { id: existingB.roomId },
                include: { property: true }
            });
            if (room) {
                const currentMonth = new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });
                const studentUser = await prisma.user.findUnique({
                    where: { id: existingB.userId },
                    select: { id: true, displayId: true }
                });
                if (studentUser) {
                    const tenancy = await prisma.$transaction(async (tx) => {
                        const tenancyCount = await tx.tenancy.count({ where: { userId: studentUser.id } });
                        const tenancyNumber = tenancyCount + 1;
                        const displayId = await generateSequentialId('TENANT');
                        return await tx.tenancy.create({ data: { userId: studentUser.id, propertyId: room.propertyId, tenancyNumber, displayId } });
                    }, { isolationLevel: 'Serializable' });

                    let tenantId = existingB.tenantId;

                    if (!tenantId) {
                        const tenant = await prisma.tenant.create({
                            data: {
                                displayId: tenancy.displayId,
                                studentId: existingB.userId,
                                name: existingB.guestName,
                                phone: existingB.guestPhone || '',
                                email: existingB.guestEmail || null,
                                address: existingB.guestAddress || null,
                                city: existingB.guestCity || null,
                                pincode: existingB.guestPincode || null,
                                country: existingB.guestCountry || 'India',
                                occupationType: existingB.occupationType || null,
                                occupationDetail: existingB.occupationDetail || null,
                                propertyId: room.propertyId,
                                roomId: existingB.roomId!,
                                bedId: (existingB as any).bedId || null,
                                roomNumber: room.roomNumber,
                                roomType: room.type,
                                rent: existingB.amount,
                                startDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                                status: 'ACTIVE',
                            }
                        });
                        tenantId = tenant.id;
                        await prisma.booking.update({ where: { id }, data: { tenantId: tenant.id } });
                    } else {
                        // NEW FLOW path: Tenant already exists (created during physical KYC)
                        await prisma.tenant.update({
                            where: { id: tenantId },
                            data: { status: 'ACTIVE' }
                        });
                    }

                    const bookingBedId = (existingB as any).bedId;
                    if (bookingBedId) {
                        await prisma.bed.update({
                            where: { id: bookingBedId },
                            data: { status: 'OCCUPIED', tenantId: tenantId, lockedByBookingId: null, lockedAt: null }
                        }).catch(() => {});
                    }
                    await prisma.rentRecord.create({
                        data: { tenantId: tenantId!, month: currentMonth, amount: existingB.amount, paid: true,
                            paidOn: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
                    });

                    // ── AUTO-SETUP: BillingProfile + SecurityDeposit + First-Month Prorated Invoice ──
                    // UNIFIED CALENDAR BILLING:
                    //   • BillingAnchor = 1st of every month (all tenants share same billing day)
                    //   • First invoice = prorated from actual move-in date → last day of that month
                    //   • From next month on: full-month invoice generated by cron on the 1st
                    try {
                        const depositAmt = Number((existingB as any).depositAmount || existingB.amount);
                        const rentAmt = Number(existingB.amount);
                        const BILLING_ANCHOR = 1; // always the 1st of the month
                        const now = new Date();
                        const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

                        // Move-in date = today (actual check-in date, not the opted date)
                        const moveInDate = now;
                        const { firstMonthRent, proratedNote } = await import('@/utils/billingUtils');
                        const proratedRent = firstMonthRent(rentAmt, moveInDate);
                        const proratedNoteStr = proratedNote(moveInDate);
                        const monthLabel = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

                        // 1. BillingProfile (idempotent, anchor=1)
                        let profile = await (prisma as any).billingProfile.findUnique({ where: { tenantId: tenantId! } }).catch(() => null);
                        if (!profile) {
                            profile = await (prisma as any).billingProfile.create({
                                data: {
                                    tenantId: tenantId!,
                                    propertyId: room.propertyId,
                                    roomId: existingB.roomId!,
                                    bedId: (existingB as any).bedId || null,
                                    monthlyRent: rentAmt,
                                    securityDeposit: depositAmt,
                                    billingDay: BILLING_ANCHOR,
                                    billingAnchorDay: BILLING_ANCHOR,
                                    status: 'ACTIVE',
                                }
                            });
                        }

                        // 2. SecurityDeposit marked PAID
                        const existingDeposit = await (prisma as any).securityDeposit.findUnique({ where: { billingProfileId: profile.id } }).catch(() => null);
                        if (!existingDeposit) {
                            await (prisma as any).securityDeposit.create({
                                data: { billingProfileId: profile.id, tenantId: tenantId!, amount: depositAmt, status: 'PAID', paidAt: new Date() }
                            });
                        } else if (existingDeposit.status !== 'PAID') {
                            await (prisma as any).securityDeposit.update({ where: { id: existingDeposit.id }, data: { status: 'PAID', paidAt: new Date() } });
                        }

                        // 3. First-month RentInvoice = PRORATED amount (marked PAID, since collected in joining)
                        //    Amount = daily_rate × (move-in day → last day of month)
                        const existingInvoice = await (prisma as any).rentInvoice.findFirst({ where: { tenantId: tenantId!, billingMonth } }).catch(() => null);
                        if (!existingInvoice) {
                            const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 5);
                            const invDisplayId = `INV-${Math.floor(Math.random() * 900000) + 100000}`;
                            await (prisma as any).rentInvoice.create({
                                data: {
                                    displayId: invDisplayId,
                                    billingProfileId: profile.id,
                                    tenantId: tenantId!,
                                    propertyId: room.propertyId,
                                    bookingId: id,
                                    month: monthLabel,
                                    billingMonth,
                                    rentAmount: proratedRent,
                                    foodAmount: 0,
                                    amount: proratedRent,
                                    dueDate,
                                    status: 'PAID',
                                    paidAmount: proratedRent,
                                    paidRentAmount: proratedRent,
                                    paidAt: new Date(),
                                    paymentMethod: method,
                                    confirmedBy: 'SYSTEM',
                                    confirmedByName: `Auto — Joining Payment (${proratedNoteStr})`,
                                    lockedAt: new Date(),
                                }
                            });
                        }
                    } catch (billingErr) { console.error('Auto-billing setup error (non-fatal):', billingErr); }
                }
            }
        } catch (e) { console.error('Auto-activate tenant error:', e); }
    }

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/owner/tenants');
    revalidatePath('/dashboard/student');

    try {
        const property = await prisma.property.findUnique({ where: { id: booking.propertyId || '' } });
        if (property) {
            await NotificationService.onPaymentCompleted(booking, booking.amount, property.ownerId);
        }
    } catch (e) { console.error('Payment Notification Error:', e); }

    return booking;
}

/**
 * ─── Physical Check-in (Industry Standard: Zolo/Stanza/NestAway pattern) ────
 *
 * NEW FLOW (v2):  ROOM_RESERVED → [Physical KYC] → PHYSICAL_VERIFIED → Agreement → ACTIVE
 * LEGACY FLOW:    BOOKING_CONFIRMED → MOVE_IN_SCHEDULED → ACTIVE (backward compat)
 *
 * At physical check-in:
 *  1. Owner physically verifies original Aadhaar/passport/company ID in-person.
 *  2. A permanent TENANT-ID (REN-USER-XXXX) is atomically generated and stored.
 *  3. Booking transitions to PHYSICAL_VERIFIED.
 *  4. Student is prompted to sign the agreement — which now shows their Tenant ID.
 *
 * Security: Serializable transaction prevents duplicate Tenant records even under
 * concurrent requests (bounty-hunter level race-condition protection).
 */
export async function checkInBooking(id: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const booking = await prisma.booking.findUnique({ where: { id }, include: { documents: true } });
    if (!booking) throw new Error("Booking not found");

    // ── Determine flow path ────────────────────────────────────────────────────
    const isNewFlow     = booking.status === 'ROOM_RESERVED';   // Physical KYC BEFORE agreement
    const isLegacyFinal = ['MOVE_IN_SCHEDULED', 'PAID', 'CASH_PAID'].includes(booking.status);
    const isLegacyPost  = booking.status === 'BOOKING_CONFIRMED'; // Physical KYC AFTER agreement (old flow)

    if (!isNewFlow && !isLegacyFinal && !isLegacyPost) {
        throw new Error(`Invalid booking status for physical check-in: ${booking.status}. Expected ROOM_RESERVED (new flow) or BOOKING_CONFIRMED/MOVE_IN_SCHEDULED (legacy).`);
    }

    // In legacy flow, agreement must already be signed
    if ((isLegacyPost || isLegacyFinal) && !booking.agreementSigned) {
        throw new Error("Agreement must be signed by the student before physical check-in.");
    }

    // ── Determine next status ──────────────────────────────────────────────────
    // NEW:    ROOM_RESERVED  → PHYSICAL_VERIFIED  (then student signs agreement)
    // LEGACY: BOOKING_CONFIRMED → MOVE_IN_SCHEDULED (then student pays final)
    // LEGACY: MOVE_IN_SCHEDULED/PAID → ACTIVE
    const newStatus = isNewFlow ? 'PHYSICAL_VERIFIED' : isLegacyFinal ? 'ACTIVE' : 'MOVE_IN_SCHEDULED';

    const updatedBooking = await prisma.booking.update({
        where: { id },
        data: {
            status: newStatus,
            ...(newStatus === 'ACTIVE' ? { activeAt: new Date() } : {}),
            onboardingDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        } as any
    });

    // ── Notifications ──────────────────────────────────────────────────────────
    if (isNewFlow && booking.userId) {
        // NEW FLOW: Notify student that physical KYC done → sign agreement now
        try {
            await NotificationService.trigger({
                bookingId: booking.id,
                userId: booking.userId,
                type: 'BOOKING',
                category: 'CHECKIN_CONFIRMED',
                message: `✅ Your identity has been physically verified at ${booking.propertyName}! Your Tenant ID is now assigned. Please sign your digital rental agreement to proceed.`,
                targetRole: 'USER',
                isPersistent: true,
            } as any);
        } catch (e) { console.error('Physical KYC notification error:', e); }
    } else if (isLegacyPost && booking.userId) {
        // LEGACY FLOW: Notify student to pay final amount
        const tokenAmt = (booking as any).tokenAmount || 1000;
        const rent = Number(booking.amount || 0);
        const deposit = Number((booking as any).depositAmount || 0);
        const finalAmt = rent + deposit - tokenAmt;
        try {
            await NotificationService.trigger({
                bookingId: booking.id,
                userId: booking.userId,
                type: 'BOOKING',
                category: 'FINAL_PAYMENT_REQUIRED',
                message: `Your ID has been physically verified at ${booking.propertyName}! Pay the joining amount of ₹${finalAmt.toLocaleString('en-IN')} (₹${tokenAmt.toLocaleString('en-IN')} token already deducted) to complete check-in.`,
                targetRole: 'USER',
                isPersistent: true,
            } as any);
        } catch (e) { console.error('Physical check-in notification error:', e); }
    }

    // ── Tenant Record Creation ─────────────────────────────────────────────────
    // NEW FLOW:    Create Tenant NOW (at physical check-in, before agreement).
    //             Status = 'Upcoming' (not yet fully onboarded).
    // LEGACY FLOW: Create Tenant if not already created (BOOKING_CONFIRMED path).
    // Skip if tenant already linked to this booking.
    const alreadyHasTenant = !!(booking as any).tenantId;

    const room = booking.roomId ? await prisma.room.findUnique({
        where: { id: booking.roomId },
        include: { property: true }
    }) : null;

    if (room && !alreadyHasTenant) {
        const studentUser = await prisma.user.findUnique({
            where: { id: booking.userId },
            select: { id: true, displayId: true }
        });
        const user = studentUser!;

        // ── Atomic Tenancy + Tenant creation (Serializable — race-condition proof) ──
        const tenancy = await prisma.$transaction(async (tx) => {
            const tenancyCount = await tx.tenancy.count({ where: { userId: user.id } });
            const tenancyNumber = tenancyCount + 1;
            const displayId = await generateSequentialId('TENANT');
            return await tx.tenancy.create({
                data: { userId: user.id, propertyId: room.propertyId, tenancyNumber, displayId }
            });
        }, { isolationLevel: 'Serializable' });

        const tenantDisplayId = tenancy.displayId;

        // Tenant status: 'Upcoming' for new flow (agreement not yet signed), 'ACTIVE' for legacy
        const tenantStatus = isNewFlow ? 'Upcoming' : 'ACTIVE';

        const tenant = await prisma.tenant.create({
            data: {
                displayId: tenantDisplayId,
                applicationId: tenantDisplayId,
                bookingId: booking.id,
                studentId: booking.userId,
                name: booking.guestName,
                phone: booking.guestPhone || '',
                email: booking.guestEmail || null,
                address: (booking as any).guestAddress || null,
                city: (booking as any).guestCity || null,
                pincode: (booking as any).guestPincode || null,
                country: (booking as any).guestCountry || 'India',
                occupationType: (booking as any).occupationType || null,
                occupationDetail: (booking as any).occupationDetail || null,
                propertyId: room.propertyId,
                roomId: booking.roomId!,
                bedId: (booking as any).bedId || null,
                roomNumber: room.roomNumber,
                roomType: room.type,
                rent: booking.amount,
                startDate: updatedBooking.onboardingDate || new Date().toLocaleDateString('en-IN'),
                status: tenantStatus,
            }
        });

        // Link Tenant back to Booking (critical: this is how agreement modal finds the Tenant ID)
        await prisma.booking.update({
            where: { id: booking.id },
            data: { tenantId: tenant.id }
        });

        // Mark bed as RESERVED (not OCCUPIED yet — tenant hasn't moved in for new flow)
        const bookingBedId = (booking as any).bedId;
        if (bookingBedId) {
            await prisma.bed.update({
                where: { id: bookingBedId },
                data: {
                    status: isNewFlow ? 'RESERVED' : 'OCCUPIED',
                    tenantId: tenant.id,
                    lockedByBookingId: null,
                    lockedAt: null
                }
            }).catch(() => {});
        }

        // For legacy flow only: create initial rent record immediately
        if (!isNewFlow) {
            const currentMonth = new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });
            await prisma.rentRecord.create({
                data: {
                    tenantId: tenant.id,
                    month: currentMonth,
                    amount: booking.amount,
                    paid: true,
                    paidOn: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                }
            });
        }

        logAuditEvent({
            actorId: session.userId,
            actorRole: session.role as string,
            actorName: session.name || 'Owner/Admin',
            actionType: 'CREATE',
            entityType: 'TENANT',
            entityId: tenant.id,
            description: `[PHYSICAL-KYC] Tenant ID ${tenantDisplayId} assigned to ${booking.guestName} (Booking: ${booking.displayId}). Flow: ${isNewFlow ? 'NEW (KYC-before-agreement)' : 'LEGACY'}. Status: ${tenantStatus}.`,
            newValue: { tenantDisplayId, bookingDisplayId: booking.displayId, flow: isNewFlow ? 'NEW' : 'LEGACY' }
        });
    }

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/owner/tenants');
    revalidatePath('/dashboard/student');

    // Notify about check-in
    try {
        const property = await prisma.property.findUnique({ where: { id: booking.propertyId || '' } });
        if (property) {
            await NotificationService.onCheckinConfirmed(updatedBooking, property.ownerId);
        }
    } catch (e) {
        console.error("Check-in Notification Error:", e);
    }

    return updatedBooking;
}

export async function getBookingById(id: string) {
    try {
        const session = await getSession();
        if (!session) throw new Error("Unauthorized");

        const booking = await prisma.booking.findUnique({
            where: { id },
            include: {
                property: true,
                room: true,
                documents: true,
            }
        });

        if (!booking) throw new Error("Booking not found");
        if (booking.userId !== session.userId && session.role !== 'OWNER' && session.role !== 'STAFF' && session.role !== 'ADMIN') {
            throw new Error("Unauthorized");
        }

        return booking;
    } catch (e: any) {
        console.error("getBookingById error:", e.message);
        throw new Error(e.message || "Failed to load booking");
    }
}

export async function getPendingBookingsCount() {
    try {
        const session = await getSession();
        if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF')) return 0;

        const userId = session.userId as string;

        const user = await prisma.user.findUnique({ 
            where: { id: userId },
            include: { employeeProfile: true }
        });
        
        let propertyIds: string[] = [];
        
        if (user?.employeeProfile) {
            // For staff, get assigned properties
            const assignments = await prisma.employeePropertyAssignment.findMany({
                where: { employeeId: user.employeeProfile.id },
                select: { propertyId: true }
            });
            propertyIds = assignments.map(a => a.propertyId);
        } else {
            // Primary owner sees all their properties
            const ownerProperties = await prisma.property.findMany({
                where: { ownerId: user?.parentOwnerId || userId },
                select: { id: true }
            });
            propertyIds = ownerProperties.map(p => p.id);
        }

        return await prisma.booking.count({
            where: {
                propertyId: { in: propertyIds },
                status: { in: ['APPLIED', 'PENDING_APPROVAL'] }
            }
        });
    } catch (e) {
        console.error("getPendingBookingsCount Error:", e);
        return 0;
    }
}

export async function cancelBooking(id: string, reason?: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new Error("Booking not found");
    if (session.role !== 'ADMIN' && session.role !== 'OWNER' && booking.userId !== session.userId) throw new Error("Unauthorized");

    const updated = await prisma.booking.update({
        where: { id },
        data: { 
            status: 'CANCELLED', 
            rejectedAt: new Date(),
            rejectionReason: reason || 'Cancelled',
            cancelReason: reason || 'Cancelled' 
        }
    });

    // ✅ AUTO-RELEASE BED: Free any bed locked/reserved/occupied for this booking
    const bedsToFree = await prisma.bed.findMany({
        where: {
            OR: [
                { lockedByBookingId: id },
                { currentBookingId: id },
            ],
            status: { in: ['TEMP_LOCKED', 'RESERVED', 'LOCKED', 'OCCUPIED'] }
        }
    });
    for (const bed of bedsToFree) {
        await prisma.bed.update({
            where: { id: bed.id },
            data: { status: 'AVAILABLE', lockedByBookingId: null, lockedAt: null, lockExpiresAt: null, currentBookingId: null, tenantId: null }
        }).catch(() => {});
    }

    // Also free bed via bookingId field on bed (the bedId stored in booking)
    const bookingWithBed = await prisma.booking.findUnique({ where: { id }, select: { bedId: true } as any }).catch(() => null);
    if (bookingWithBed && (bookingWithBed as any).bedId) {
        await prisma.bed.update({
            where: { id: (bookingWithBed as any).bedId },
            data: { status: 'AVAILABLE', lockedByBookingId: null, lockedAt: null, lockExpiresAt: null, currentBookingId: null, tenantId: null }
        }).catch(() => {});
    }

    if (booking.roomId) {
        const room = await prisma.room.findUnique({ where: { id: booking.roomId } });
        if (room) await prisma.room.update({ where: { id: room.id }, data: { availability: room.availability + 1 } });
    }

    // Notify waitlisted students when room opens up
    if (booking.propertyId) {
        const waitlisted = await prisma.waitlist.findMany({ where: { propertyId: booking.propertyId, status: 'WAITING' } }).catch(() => []);
        for (const w of waitlisted) {
            await NotificationService.trigger({
                bookingId: booking.id,
                userId: w.userId,
                type: 'BOOKING',
                category: 'WAITLIST_OPEN',
                message: `A room is now available at your waitlisted property! Log in to book now.`,
                targetRole: 'USER'
            });
            await prisma.waitlist.update({ where: { id: w.id }, data: { status: 'NOTIFIED', notifiedAt: new Date() } }).catch(() => {});
        }
    }

    if (booking.userId && session.role !== 'USER') {
        await NotificationService.trigger({
            bookingId: booking.id,
            userId: booking.userId,
            type: 'BOOKING',
            category: 'BOOKING_CANCELLED',
            message: `Your booking for ${booking.propertyName} was cancelled. Reason: ${reason || 'Cancelled'}`,
            targetRole: 'USER'
        });
    }

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'USER',
        actorName: session.name || 'User',
        actionType: 'DELETE',
        entityType: 'BOOKING',
        entityId: id,
        description: `Booking ${booking.displayId} cancelled. Reason: ${reason || 'N/A'}`,
    });

    revalidatePath('/dashboard/student');
    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/owner/properties');
    revalidatePath('/dashboard/owner');
    revalidatePath('/dashboard/owner/availability');
    return updated;
}

export async function signAgreement(id: string, agreementMeta?: {
    agreementText?: string;
    agreementId?: string;
    agreementPdfUrl?: string;
    signedIp?: string;
    signedDevice?: string;
}) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
            user: { select: { name: true, email: true, displayId: true } },
            tenant: { select: { id: true, displayId: true } },
            property: { select: { id: true, displayId: true, name: true } },
        }
    });
    if (!booking) throw new Error("Booking not found");
    if (booking.userId !== session.userId) throw new Error("Unauthorized to sign this agreement");
    if (booking.agreementSigned) throw new Error("Agreement has already been signed.");

    // ── New flow guard: agreement must come AFTER physical check-in ───────────
    // PHYSICAL_VERIFIED = KYC done, Tenant ID assigned, ready to sign.
    // ROOM_RESERVED = token paid but KYC not done yet (should not be able to sign).
    const newFlowStatuses = ['PHYSICAL_VERIFIED'];
    const legacyFlowStatuses = ['ROOM_RESERVED', 'KYC_PENDING', 'AGREEMENT_PENDING', 'BOOKING_CONFIRMED', 'MOVE_IN_SCHEDULED', 'PAID', 'CASH_PAID'];
    if (![...newFlowStatuses, ...legacyFlowStatuses].includes(booking.status)) {
        throw new Error(`Cannot sign agreement at this stage (status: ${booking.status}).`);
    }
    if (booking.status === 'ROOM_RESERVED') {
        // Soft check: if status is ROOM_RESERVED but no tenantId, physical KYC hasn't happened yet
        if (!(booking as any).tenantId) {
            throw new Error("Physical verification required before signing the agreement. Please contact the property manager.");
        }
    }


    // ─── Capture IP from Next.js request headers (real business practice) ────
    let realIp = agreementMeta?.signedIp || 'unknown';
    try {
        const { headers } = await import('next/headers');
        const headersList = await headers();
        realIp = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
            || headersList.get('x-real-ip')
            || agreementMeta?.signedIp
            || 'unknown';
    } catch { /* headers() only available in App Router context */ }

    const agreementId = agreementMeta?.agreementId || `AGT-${booking.displayId}-${Date.now()}`;
    const signedAt = new Date();
    const AGREEMENT_VERSION = 'v1.0-2026'; // Bump when agreement terms change

    // ─── Store full audit trail in DB ────────────────────────────────────────
    // This is what holds up in court: WHO signed, WHAT they signed, WHEN, WHERE, on WHAT device.
    const updated = await prisma.booking.update({
        where: { id },
        data: {
            status: 'AGREEMENT_PENDING',
            agreementSigned: true,
            agreementSignedAt: signedAt,
            agreementId,
            agreementVersion: AGREEMENT_VERSION,
            agreementSignedIp: realIp,
            agreementSignedDevice: agreementMeta?.signedDevice || 'unknown',
            ...(agreementMeta?.agreementText ? { agreementText: agreementMeta.agreementText } : {}),
            ...(agreementMeta?.agreementPdfUrl ? { agreementPdfUrl: agreementMeta.agreementPdfUrl } : {}),
        } as any
    });

    // ─── Notify owner to countersign ─────────────────────────────────────────
    if (booking.propertyId) {
        const property = await prisma.property.findUnique({ where: { id: booking.propertyId } });
        if (property) {
            await NotificationService.onAgreementSigned(booking, property.ownerId);
        }
    }

    // ─── Send legal confirmation email to student ─────────────────────────────
    // Real businesses send this immediately — it is the tenant's copy of the signed agreement.
    try {
        const tenantEmail = booking.user?.email || booking.guestEmail;
        if (tenantEmail) {
            const { sendEmail } = await import('@/lib/email');
            await sendEmail({
                to: tenantEmail,
                subject: `✍️ Agreement Signed — ${booking.propertyName} [${agreementId}]`,
                html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f8fafc;margin:0;padding:32px 16px;">
  <div style="max-width:580px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:900;letter-spacing:-0.5px;">RentPe</h1>
      <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:13px;">Digital Agreement — Official Copy</p>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:32px;">
      <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:10px;padding:14px 16px;margin-bottom:24px;text-align:center;">
        <span style="font-size:20px;">✅</span>
        <p style="color:#065f46;font-weight:800;font-size:15px;margin:4px 0 0;">Agreement Successfully Signed</p>
        <p style="color:#047857;font-size:12px;margin:2px 0 0;">Your digital signature is legally binding under the Information Technology Act, 2000</p>
      </div>

      <p style="color:#334155;font-size:15px;margin:0 0 6px;">Hi <strong>${booking.guestName}</strong>,</p>
      <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Your rental agreement for <strong>${booking.propertyName}</strong> has been signed. 
        The owner will now countersign. You will be notified once both parties have signed.
      </p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:24px;">
        <div style="background:#1e1b4b;padding:10px 16px;">
          <span style="color:#a5b4fc;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;">Agreement Record</span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 16px;color:#94a3b8;font-weight:700;width:40%;">Agreement ID</td>
            <td style="padding:12px 16px;color:#1e293b;font-weight:900;font-family:monospace;">${agreementId}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;background:#f0f4ff;">
            <td style="padding:12px 16px;color:#4338ca;font-weight:700;">Booking ID</td>
            <td style="padding:12px 16px;color:#1e1b4b;font-weight:900;font-family:monospace;">${booking.displayId}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 16px;color:#4338ca;font-weight:700;">Tenant ID</td>
            <td style="padding:12px 16px;color:#1e1b4b;font-weight:900;font-family:monospace;">${(booking as any).tenant?.displayId || 'Assigned post-verification'}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 16px;color:#94a3b8;font-weight:700;">PG / Property ID</td>
            <td style="padding:12px 16px;color:#1e293b;font-weight:900;font-family:monospace;">${(booking as any).property?.displayId || booking.propertyId || 'N/A'}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;background:#f8fafc;">
            <td style="padding:12px 16px;color:#94a3b8;font-weight:700;">Property</td>
            <td style="padding:12px 16px;color:#1e293b;font-weight:700;">${booking.propertyName}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 16px;color:#94a3b8;font-weight:700;">Room Allocated</td>
            <td style="padding:12px 16px;color:#1e293b;font-weight:700;">${booking.roomAssigned || 'Pending'}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;background:#f8fafc;">
            <td style="padding:12px 16px;color:#94a3b8;font-weight:700;">Signed By</td>
            <td style="padding:12px 16px;color:#1e293b;font-weight:700;">${booking.guestName}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 16px;color:#94a3b8;font-weight:700;">Signed At</td>
            <td style="padding:12px 16px;color:#1e293b;font-weight:700;">${signedAt.toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'medium', timeZone: 'Asia/Kolkata' })} IST</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;background:#f8fafc;">
            <td style="padding:12px 16px;color:#94a3b8;font-weight:700;">IP Address</td>
            <td style="padding:12px 16px;color:#1e293b;font-weight:700;font-family:monospace;">${realIp}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:#94a3b8;font-weight:700;">Agreement Version</td>
            <td style="padding:12px 16px;color:#1e293b;font-weight:700;">${AGREEMENT_VERSION}</td>
          </tr>
        </table>
      </div>

      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
        <p style="color:#92400e;font-size:13px;font-weight:700;margin:0 0 4px;">⏳ Next Step — Owner Countersignature</p>
        <p style="color:#b45309;font-size:12px;margin:0;line-height:1.5;">
          Your agreement is under review. The property owner must countersign to make it fully active. 
          You will receive another email and an in-app notification when this is done.
        </p>
      </div>

      <p style="color:#94a3b8;font-size:11px;line-height:1.6;margin:0;">
        Keep this email as your official record. If you did not perform this action, contact us immediately at 
        <a href="mailto:support@rentpe.in" style="color:#6366f1;">support@rentpe.in</a> with reference: <strong>${agreementId}</strong>
      </p>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:16px;">
      © ${new Date().getFullYear()} RentPe Technologies Pvt. Ltd. · Bangalore, Karnataka, India
    </p>
  </div>
</body>
</html>`
            });
        }
    } catch (e) {
        console.error('Agreement confirmation email failed:', e);
    }

    // ─── Immutable audit log — legally admissible record ─────────────────────
    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'USER',
        actorName: session.name || 'User',
        actionType: 'UPDATE',
        entityType: 'BOOKING',
        entityId: id,
        description: `DIGITAL AGREEMENT SIGNED. Tenant: ${booking.guestName} | AgreementId: ${agreementId} | Version: ${AGREEMENT_VERSION} | IP: ${realIp} | Device: ${agreementMeta?.signedDevice || 'unknown'} | SignedAt: ${signedAt.toISOString()}`,
        newValue: { agreementId, version: AGREEMENT_VERSION, ip: realIp, signedAt: signedAt.toISOString() }
    });

    revalidatePath('/dashboard/student');
    revalidatePath('/dashboard/owner/bookings');
    return updated;
}

// ─── COUNTERSIGN AGREEMENT (Owner / Staff Manager) ───────────────────────────
export async function countersignAgreement(bookingId: string) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) {
        throw new Error("Unauthorized — only Owner or Staff Manager can countersign.");
    }

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            user: { select: { name: true, email: true, displayId: true } },
            tenant: { select: { id: true, displayId: true } },
            property: { select: { id: true, displayId: true, name: true } },
        }
    });
    if (!booking) throw new Error("Booking not found.");
    if (!booking.agreementSigned) throw new Error("Tenant has not signed the agreement yet.");
    if ((booking as any).ownerCountersigned) throw new Error("Already countersigned.");

    const roleLabel = session.role === 'STAFF' ? 'Staff Manager' : 'Property Owner';
    const countersignerName = session.name || roleLabel;
    const countersignedAt = new Date();

    // ── NEW FLOW: If physical KYC happened before agreement (PHYSICAL_VERIFIED path),
    //    countersigning moves to BOOKING_CONFIRMED (student pays final joining amount).
    // ── LEGACY FLOW: Was AGREEMENT_PENDING → MOVE_IN_SCHEDULED → ACTIVE.
    //    Keep backward compat: if already AGREEMENT_PENDING, use BOOKING_CONFIRMED.
    const newStatus = 'BOOKING_CONFIRMED';

    await prisma.booking.update({
        where: { id: bookingId },
        data: {
            status: newStatus,
            ownerCountersigned: true,
            ownerCountersignedAt: countersignedAt,
            ownerCountersignedBy: `${countersignerName} (${roleLabel})`,
        } as any
    });

    // Tenant remains in 'Upcoming' status until final payment is received (auto-activated in markBookingPaid)
    // or manually activated via confirmMoveIn.

    // Notify tenant in-app
    try {
        await NotificationService.trigger({
            bookingId: booking.id,
            userId: booking.userId,
            type: 'BOOKING',
            category: 'AGREEMENT_COUNTERSIGNED',
            message: `🎉 Your agreement for ${booking.propertyName} has been countersigned by ${countersignerName} (${roleLabel}). Pay the joining balance to activate your stay!`,
            targetRole: 'USER',
            isPersistent: true,
        });
    } catch (e) { console.error('Notification failed:', e); }

    // Send email to tenant
    try {
        const tenantEmail = booking.user?.email || booking.guestEmail;
        if (tenantEmail) {
            await sendEmail({
                to: tenantEmail,
                subject: `✅ Agreement Fully Executed — ${booking.propertyName} [${booking.agreementId}]`,
                html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);border-radius:16px 16px 0 0;padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:900;">RentPe</h1>
      <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:12px;">Rental Agreement — Fully Executed</p>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:28px;">
      <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:10px;padding:14px;margin-bottom:20px;text-align:center;">
        <p style="color:#065f46;font-weight:800;font-size:15px;margin:0;">✅ Both Parties Have Signed</p>
        <p style="color:#047857;font-size:12px;margin:4px 0 0;">This agreement is legally binding under IT Act 2000</p>
      </div>
      <p style="color:#334155;font-size:14px;">Hi <strong>${booking.guestName}</strong>,</p>
      <p style="color:#64748b;font-size:14px;line-height:1.6;">Your rental agreement for <strong>${booking.propertyName}</strong> has been countersigned by <strong>${countersignerName} (${roleLabel})</strong>. Your stay is confirmed.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <tr style="background:#1e1b4b;"><td colspan="2" style="padding:10px 16px;color:#a5b4fc;font-size:10px;font-weight:900;letter-spacing:.1em;">AUDIT TRAIL & PERMANENT IDs</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px 16px;color:#94a3b8;font-weight:700;">Agreement ID</td><td style="padding:10px 16px;font-weight:900;font-family:monospace;">${booking.agreementId}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;background:#f0f4ff;"><td style="padding:10px 16px;color:#4338ca;font-weight:700;">Booking ID</td><td style="padding:10px 16px;font-weight:900;font-family:monospace;color:#1e1b4b;">${booking.displayId}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px 16px;color:#4338ca;font-weight:700;">Tenant ID</td><td style="padding:10px 16px;font-weight:900;font-family:monospace;color:#1e1b4b;">${(booking as any).tenant?.displayId || 'N/A'}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px 16px;color:#94a3b8;font-weight:700;">PG / Property ID</td><td style="padding:10px 16px;font-weight:900;font-family:monospace;">${(booking as any).property?.displayId || booking.propertyId || 'N/A'}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;background:#f8fafc;"><td style="padding:10px 16px;color:#94a3b8;font-weight:700;">Tenant Signed</td><td style="padding:10px 16px;font-weight:700;">${booking.guestName}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px 16px;color:#94a3b8;font-weight:700;">Countersigned By</td><td style="padding:10px 16px;font-weight:700;">${countersignerName} (${roleLabel})</td></tr>
        <tr><td style="padding:10px 16px;color:#94a3b8;font-weight:700;">Countersigned At</td><td style="padding:10px 16px;font-weight:700;">${countersignedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td></tr>
      </table>
      <p style="color:#94a3b8;font-size:11px;margin-top:16px;">Ref: <strong>${booking.agreementId}</strong> · Keep this for your records.</p>
    </div>
  </div>
</body></html>`
            });
        }
    } catch (e) { console.error('Countersign email failed:', e); }

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'OWNER',
        actorName: countersignerName,
        actionType: 'UPDATE',
        entityType: 'BOOKING',
        entityId: bookingId,
        description: `AGREEMENT COUNTERSIGNED by ${countersignerName} (${roleLabel}). Booking: ${booking.displayId} | AgreementId: ${booking.agreementId} | At: ${countersignedAt.toISOString()}`,
        newValue: { countersignedBy: countersignerName, role: roleLabel, countersignedAt: countersignedAt.toISOString() }
    });

    revalidatePath('/dashboard/owner');
    revalidatePath('/dashboard/staff');
    revalidatePath('/dashboard/student');
    return { success: true, countersignedBy: `${countersignerName} (${roleLabel})` };
}

// ─── Get bookings awaiting Owner/Staff countersignature ──────────────────────
export async function getPendingCountersignBookings() {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) {
        throw new Error("Unauthorized");
    }

    // Resolve which properties this owner/staff has access to
    const user = await prisma.user.findUnique({
        where: { id: session.userId },
        include: { employeeProfile: true }
    });

    let propertyIds: string[] = [];
    if (user?.employeeProfile) {
        const assignments = await prisma.employeePropertyAssignment.findMany({
            where: { employeeId: user.employeeProfile.id },
            select: { propertyId: true }
        });
        propertyIds = assignments.map(a => a.propertyId);
    } else {
        const properties = await prisma.property.findMany({
            where: { ownerId: user?.parentOwnerId || session.userId },
            select: { id: true }
        });
        propertyIds = properties.map(p => p.id);
    }

    return await prisma.booking.findMany({
        where: {
            propertyId: { in: propertyIds },
            agreementSigned: true,
            ownerCountersigned: false,
        },
        orderBy: { agreementSignedAt: 'asc' },
        select: {
            id: true, displayId: true, guestName: true, guestEmail: true,
            propertyName: true, roomAssigned: true, occupancy: true,
            amount: true, depositAmount: true, agreementId: true,
            agreementSignedAt: true, agreementSignedIp: true,
            agreementSignedDevice: true, agreementVersion: true,
            onboardingDate: true, status: true,
        }
    });
}

export async function getStudentPendingActionsCount() {
    const session = await getSession();
    if (!session) return 0;

    const userId = session.userId;
    const bookings = await prisma.booking.findMany({
        where: { userId },
        include: { documents: true }
    });

    let count = 0;
    for (const b of bookings) {
        if (b.status === 'APPROVED_PENDING_TOKEN') count++;
        if (b.status === 'KYC_PENDING' || b.status === 'APPROVED_KYC_PENDING' || b.status === 'KYC_FAILED') count++;
        if (b.status === 'AGREEMENT_PENDING') count++;
        if (b.status === 'ROOM_RESERVED') {
            const hasVerified = b.documents.filter(d => d.status === 'VERIFIED').length >= 2;
            if (!hasVerified) count++;
        }
    }
    return count;
}

export async function getAdminAlertCounts() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return { bookings: 0, verifications: 0 };

    const [pendingBookings, pendingDocs] = await Promise.all([
        prisma.booking.count({ where: { status: { in: ['APPLIED', 'PENDING_APPROVAL'] } } }),
        prisma.tenantDocument.count({ where: { status: 'PENDING' } })
    ]);

    return { bookings: pendingBookings, verifications: pendingDocs };
}

// ─────────────────────────────────────────────
// NEW: PROFESSIONAL BOOKING LIFECYCLE ACTIONS
// ─────────────────────────────────────────────

/** Student pays token to lock the room */
export async function payTokenAmount(bookingId: string, paymentMethod: 'ONLINE' | 'CASH' = 'ONLINE', paymentId?: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== 'APPROVED_PENDING_TOKEN') throw new Error("Booking is not in token payment stage");

    const reservationExpiry = new Date();
    reservationExpiry.setDate(reservationExpiry.getDate() + 7); // 7-day reservation window

    const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: {
            status: 'ROOM_RESERVED',
            tokenPaidAt: new Date(),
            tokenPaymentId: paymentId,
            paymentMethod,
            reservationExpiresAt: reservationExpiry,
        }
    });

    try {
        if (booking.propertyId) {
            const property = await prisma.property.findUnique({ where: { id: booking.propertyId } });
            if (property) {
                await NotificationService.onPaymentCompleted(booking, booking.tokenAmount || 1000, property.ownerId);
            }
        }
    } catch (e) { 
        console.error("Token Payment Notification Error:", e);
    }

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'USER',
        actorName: session.name || 'User',
        actionType: 'UPDATE',
        entityType: 'BOOKING',
        entityId: bookingId,
        description: `Token paid via ${paymentMethod}. Reservation expires ${reservationExpiry.toDateString()}.`,
    });

    revalidatePath('/dashboard/student');
    revalidatePath('/dashboard/owner/bookings');
    return updated;
}

/** Owner marks token as cash paid */
export async function markTokenCashPaid(bookingId: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const reservationExpiry = new Date();
    reservationExpiry.setDate(reservationExpiry.getDate() + 7);

    const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'KYC_PENDING', tokenPaidAt: new Date(), paymentMethod: 'CASH', reservationExpiresAt: reservationExpiry }
    });

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (booking?.userId) {
        await NotificationService.trigger({
            bookingId: booking.id,
            userId: booking.userId,
            type: 'BOOKING',
            category: 'TOKEN_CASH_CONFIRMED',
            message: `Cash token confirmed for ${booking.propertyName}. Please upload your KYC documents now.`,
            targetRole: 'USER',
            isPersistent: true
        });
    }

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'OWNER',
        actorName: session.name || 'Owner',
        actionType: 'UPDATE',
        entityType: 'BOOKING',
        entityId: bookingId,
        description: `Cash token marked by owner. Room reserved.`,
    });

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/student');
    return updated;
}

/** Owner/Admin verifies all KYC → moves to AGREEMENT_PENDING */
export async function verifyKycAndProceed(bookingId: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'AGREEMENT_PENDING', kycVerifiedAt: new Date() }
    });

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (booking?.userId) {
        await NotificationService.onKycVerified(booking, session.userId);
    }

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'ADMIN',
        actorName: session.name || 'Admin',
        actionType: 'APPROVE',
        entityType: 'BOOKING',
        entityId: bookingId,
        description: `All KYC documents verified. Moved to AGREEMENT_PENDING.`,
    });

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/student');
    return updated;
}

/** Owner/Admin marks KYC as failed */
export async function markKycFailed(bookingId: string, reason: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'KYC_FAILED', kycNotes: reason, kycRejectedAt: new Date() }
    });

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (booking?.userId) {
        await NotificationService.trigger({
            bookingId: booking.id,
            userId: booking.userId,
            type: 'KYC',
            category: 'KYC_FAILED',
            message: `KYC failed for ${booking.propertyName}. Reason: ${reason}. Please re-upload documents.`,
            targetRole: 'USER',
            isPersistent: true
        });
    }

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'ADMIN',
        actorName: session.name || 'Admin',
        actionType: 'REJECT',
        entityType: 'BOOKING',
        entityId: bookingId,
        description: `KYC rejected. Reason: ${reason}`,
    });

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/student');
    return updated;
}

/** 
 * Owner/Admin countersigns the rental agreement.
 * Per Indian rental law, BOTH parties must sign for the agreement to be legally valid.
 * Student signs first (→ AGREEMENT_PENDING), then owner countersigns (→ BOOKING_CONFIRMED).
 */
export async function ownerCounterSignAgreement(bookingId: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF' && session.role !== 'ADMIN')) throw new Error('Unauthorized');

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new Error('Booking not found');
    if (booking.status !== 'AGREEMENT_PENDING') throw new Error('Booking is not awaiting owner countersignature');

    const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: {
            status: 'BOOKING_CONFIRMED',
            ownerCountersigned: true,
            ownerCountersignedAt: new Date(),
            ownerCountersignedBy: `${session.name || 'Property Owner'} (Property Owner)`,
        }
    });

    // Notify student that agreement is fully executed
    if (booking.userId) {
        await NotificationService.trigger({
            bookingId: booking.id,
            userId: booking.userId,
            type: 'BOOKING',
            category: 'AGREEMENT_COUNTERSIGNED',
            message: `Great news! Your rental agreement for ${booking.propertyName} has been signed by both parties. Your move-in date is confirmed. The owner will schedule your physical ID check shortly.`,
            targetRole: 'USER',
            isPersistent: true,
        } as any).catch(() => {});
    }

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'OWNER',
        actorName: session.name || 'Owner',
        actionType: 'APPROVE',
        entityType: 'BOOKING',
        entityId: bookingId,
        description: `Owner/Admin countersigned rental agreement. Agreement now fully executed by both parties.`,
    });

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/admin/bookings');
    revalidatePath('/dashboard/student');
    return updated;
}

/**
 * Either the student or owner/admin can update the move-in date.
 * Notifies the other party about the change.
 */
export async function updateMoveInDate(bookingId: string, newDate: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new Error('Booking not found');

    const isStudent = booking.userId === session.userId;
    const isOwnerOrAdmin = session.role === 'OWNER' || session.role === 'STAFF' || session.role === 'ADMIN';
    if (!isStudent && !isOwnerOrAdmin) throw new Error('Unauthorized');

    const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: { onboardingDate: newDate } as any
    });

    // Notify the other party about date change
    try {
        if (isStudent && booking.propertyId) {
            const property = await prisma.property.findUnique({ where: { id: booking.propertyId }, select: { ownerId: true, name: true } });
            if (property) {
                await NotificationService.trigger({
                    bookingId: booking.id,
                    userId: property.ownerId,
                    type: 'BOOKING',
                    category: 'MOVE_IN_DATE_CHANGED',
                    message: `Tenant ${booking.guestName} changed their move-in date to ${newDate} for ${property.name}.`,
                    targetRole: 'OWNER',
                } as any);
            }
        } else if (isOwnerOrAdmin && booking.userId) {
            await NotificationService.trigger({
                bookingId: booking.id,
                userId: booking.userId,
                type: 'BOOKING',
                category: 'MOVE_IN_DATE_CHANGED',
                message: `Your move-in date for ${booking.propertyName} has been updated to ${newDate} by the owner.`,
                targetRole: 'USER',
                isPersistent: true,
            } as any);
        }
    } catch (e) { console.error('Move-in date notification error:', e); }

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/admin/bookings');
    revalidatePath('/dashboard/student');
    return updated;
}

/** Add student to waitlist */
export async function addToWaitlist(data: { propertyId: string; roomType?: string; guestName: string; guestPhone?: string; guestEmail?: string; moveInDate?: string; }) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const entry = await prisma.waitlist.create({
        data: { userId: session.userId, ...data, status: 'WAITING' }
    });

    const property = await prisma.property.findUnique({ where: { id: data.propertyId } });
    if (property) {
        await NotificationService.trigger({
            bookingId: entry.id, // technically not a booking, but using id for reference
            userId: property.ownerId,
            type: 'BOOKING',
            category: 'WAITLIST_JOINED',
            message: `${data.guestName} joined the waitlist for ${property.name}.`,
            targetRole: 'OWNER'
        });
    }

    revalidatePath('/dashboard/student');
    return entry;
}

/** Get owner analytics */
export async function getOwnerAnalytics() {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");
    const ownerId = session.userId;

    const propertyIds = (await prisma.property.findMany({ where: { ownerId }, select: { id: true } })).map(p => p.id);

    const [activeTenants, pendingBookings, kycPending, totalBeds, occupiedBeds] = await Promise.all([
        prisma.tenant.count({ where: { propertyId: { in: propertyIds }, status: 'ACTIVE' } }),
        prisma.booking.count({ where: { propertyId: { in: propertyIds }, status: { in: ['APPLIED', 'PENDING_APPROVAL'] } } }),
        prisma.booking.count({ where: { propertyId: { in: propertyIds }, status: { in: ['KYC_PENDING', 'APPROVED_KYC_PENDING', 'ROOM_RESERVED'] } } }),
        prisma.room.aggregate({ _sum: { availability: true }, where: { propertyId: { in: propertyIds } } }),
        prisma.tenant.count({ where: { propertyId: { in: propertyIds }, status: 'ACTIVE' } }),
    ]);

    const totalBedsCount = (totalBeds._sum?.availability || 0) + occupiedBeds;
    const occupancyRate = totalBedsCount > 0 ? Math.round((occupiedBeds / totalBedsCount) * 100) : 0;

    return { totalProperties: propertyIds.length, activeTenants, pendingBookings, kycPending, occupancyRate, totalBeds: totalBedsCount };
}

/** Get platform analytics for admin */
export async function getPlatformAnalytics() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const [totalProperties, liveProperties, totalBookings, kycPending, activeTenants, pendingDocuments] = await Promise.all([
        prisma.property.count(),
        prisma.property.count({ where: { status: 'LIVE' } }),
        prisma.booking.count(),
        prisma.booking.count({ where: { status: { in: ['KYC_PENDING', 'APPROVED_KYC_PENDING', 'ROOM_RESERVED'] } } }),
        prisma.tenant.count({ where: { status: 'ACTIVE' } }),
        prisma.tenantDocument.count({ where: { status: 'PENDING' } }),
    ]);

    return { totalProperties, liveProperties, totalBookings, kycPending, activeTenants, pendingDocuments };
}

/** Student/Owner: Complete the vacating process (only if all dues paid) */
export async function completeVacate(bookingId: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            property: { select: { id: true, name: true, address: true, city: true, ownerId: true } },
            room: { select: { roomNumber: true, type: true, price: true } },
            user: { select: { name: true, email: true } },
        }
    });

    if (!booking) throw new Error('Booking not found');
    // Allow student who owns the booking or owner/admin
    const isStudent = booking.userId === session.userId;
    const isOwnerOrAdmin = session.role === 'OWNER' || session.role === 'ADMIN';
    if (!isStudent && !isOwnerOrAdmin) throw new Error('Unauthorized');

    // Check for pending tenant dues
    const tenant = await prisma.tenant.findFirst({ 
        where: { bookingId },
        include: { rentRecords: true }
    });

    if (tenant) {
        const unpaidDues = tenant.rentRecords.filter(r => !r.paid);
        if (unpaidDues.length > 0) {
            const totalUnpaid = unpaidDues.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
            throw new Error(`Cannot complete vacate. You have ₹${totalUnpaid.toLocaleString('en-IN')} in unpaid dues. Please pay all pending rent first.`);
        }
    }

    // Mark booking COMPLETED
    const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'COMPLETED' } as any
    });

    // Mark tenant as Checked Out
    if (tenant) {
        await prisma.tenant.update({
            where: { id: tenant.id },
            data: { status: 'Checked Out', actualMoveOutDate: new Date().toISOString() }
        });
        // Free the bed
        if (tenant.bedId) {
            await prisma.bed.update({
                where: { id: tenant.bedId },
                data: { status: 'AVAILABLE', tenantId: null }
            }).catch(() => {});
        }
    }

    // Notify owner
    try {
        await prisma.notification.create({
            data: {
                userId: booking.property?.ownerId ?? session.userId,
                type: 'BOOKING',
                category: 'BOOKING_COMPLETED',
                message: `${booking.guestName} has completed their stay at ${booking.propertyName}. Bed is now available.`,
                isPersistent: true,
            }
        });
    } catch (e) { console.error('Notify error', e); }

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'USER',
        actorName: session.name || 'User',
        actionType: 'UPDATE',
        entityType: 'BOOKING',
        entityId: bookingId,
        description: `Tenant ${booking.guestName} completed vacate. Booking marked COMPLETED.`,
    });

    revalidatePath('/dashboard/student');
    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/owner/tenants');
    revalidatePath('/dashboard/owner');
    revalidatePath('/dashboard/owner/availability');

    // Return settlement data for PDF
    const rentRecords = tenant?.rentRecords || [];
    const paidTotal = rentRecords.filter(r => r.paid).reduce((acc, r) => acc + Number(r.amount), 0);

    return {
        booking: updated,
        settlementData: {
            tenantName: booking.guestName,
            propertyName: booking.propertyName || booking.property?.name,
            roomNumber: booking.roomAssigned || booking.room?.roomNumber,
            roomType: booking.occupancy,
            moveInDate: booking.moveInDate,
            moveOutDate: new Date().toLocaleDateString('en-IN'),
            totalPaidRent: paidTotal,
            depositAmount: booking.depositAmount || 0,
            platformFee: (booking as any).platformFee || (booking as any).platformFeeAmount || 0,
            rentRecords,
        }
    };
}

/**
 * Owner/Admin: Update the sharing type of an existing booking.
 * Saves the original occupancy for change detection, updates amount from room,
 * and notifies the student.
 */
export async function updateSharingType(bookingId: string, data: {
    newOccupancy: string;
    roomId?: string;
    bedId?: string;
    roomAssigned?: string;
    newAmount?: number;
    depositAmount?: number;
    depositMonths?: number;
}) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF' && session.role !== 'ADMIN')) {
        throw new Error("Unauthorized");
    }

    // Get existing booking to save original occupancy
    const existingBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!existingBooking) throw new Error("Booking not found");

    const originalOccupancy = (existingBooking as any).originalOccupancy || existingBooking.occupancy;

    // ── Atomic transaction: free old bed, lock new bed, update booking ──
    const updated = await prisma.$transaction(async (tx) => {
        // Free the old bed inside transaction
        const oldBed = await tx.bed.findFirst({ where: { lockedByBookingId: bookingId } });
        if (oldBed && oldBed.id !== data.bedId) {
            await tx.bed.update({
                where: { id: oldBed.id },
                data: { status: 'AVAILABLE', lockedByBookingId: null, tenantId: null }
            });
        }

        // Lock the new bed inside transaction
        if (data.bedId) {
            await tx.bed.update({
                where: { id: data.bedId },
                data: { status: 'LOCKED', lockedByBookingId: bookingId }
            });
        }

        // Update booking — NOTE: Booking has NO bedId column, do NOT include it
        return tx.booking.update({
            where: { id: bookingId },
            data: {
                occupancy: data.newOccupancy,
                originalOccupancy: originalOccupancy,
                ...(data.roomId ? { roomId: data.roomId } : {}),
                ...(data.roomAssigned ? { roomAssigned: data.roomAssigned } : {}),
                ...(data.newAmount !== undefined ? { amount: data.newAmount } : {}),
                ...(data.depositAmount !== undefined ? { depositAmount: data.depositAmount } : {}),
                ...(data.depositMonths !== undefined ? { depositMonths: data.depositMonths } : {}),
            } as any
        });
    });

    // Notify student about sharing type change
    if (existingBooking.userId) {
        try {
            await NotificationService.trigger({
                bookingId,
                userId: existingBooking.userId,
                type: 'BOOKING',
                category: 'ROOM_ALLOCATED',
                message: `Your sharing type has been updated to ${data.newOccupancy} for ${existingBooking.propertyName}. If you want another sharing type, kindly contact the Building Management Team.`,
                targetRole: 'USER',
                isPersistent: true
            });
        } catch (e) {
            console.error("Sharing type notification error:", e);
        }
    }

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role as string,
        actorName: session.name || 'Owner/Admin',
        actionType: 'UPDATE',
        entityType: 'BOOKING',
        entityId: bookingId,
        description: `Sharing type updated from ${originalOccupancy} to ${data.newOccupancy}. New amount: ₹${data.newAmount || existingBooking.amount}.`,
        newValue: { occupancy: data.newOccupancy, amount: data.newAmount }
    });

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/admin/onboarding');
    revalidatePath('/dashboard/student');
    return updated;
}
