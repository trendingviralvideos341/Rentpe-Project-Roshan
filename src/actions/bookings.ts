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
                    property: { select: { foodType: true, foodPricePerMonth: true } as any }
                }
            });
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
                    user: { select: { name: true, email: true } }
                }
            });

            return bookings.map((b) => {
                return {
                    ...b,
                    tenantId: b.tenantId || null, // Direct link from schema
                    ownerName: b.property?.owner?.name || null,
                    ownerEmail: b.property?.owner?.email || null,
                    ownerPhone: b.property?.owner?.phone || null,
                    propertyAddress: b.property?.address || null,
                    propertyCity: b.property?.city || null,
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
    return await prisma.booking.findMany({
        where: { deletedAt: null },
        include: { 
            user: { select: { name: true, email: true } },
            property: { select: { foodType: true, foodPricePerMonth: true } as any }
        },
        orderBy: { createdAt: 'desc' }
    });
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

    const booking = await prisma.booking.update({
        where: { id },
        data: {
            status: 'APPROVED',
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
            const oldRoom = await prisma.room.findUnique({ where: { id: existingBooking.roomId } });
            if (oldRoom) {
                await prisma.room.update({
                    where: { id: oldRoom.id },
                    data: { availability: oldRoom.availability + 1 }
                });
            }
        }
        if (data.roomId) {
            const newRoom = await prisma.room.findUnique({ where: { id: data.roomId } });
            if (newRoom && newRoom.availability > 0) {
                await prisma.room.update({
                    where: { id: newRoom.id },
                    data: { availability: newRoom.availability - 1 }
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

    // Notify student about room assignment only (no token notification)
    try {
        if (booking.userId && data.roomAssigned) {
            await NotificationService.onRoomAllocated(
                booking,
                data.roomAssigned,
                existingBooking?.occupancy || undefined,
                data.occupancy,
            );
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
        const room = await prisma.room.findUnique({ where: { id: existingBooking.roomId } });
        if (room) {
            await prisma.room.update({
                where: { id: room.id },
                data: { availability: room.availability + 1 }
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

export async function markBookingPaid(id: string, method: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const isStaff = session.role === 'OWNER' || session.role === 'STAFF' || session.role === 'ADMIN';
    if (!isStaff) {
        // Students can only mark their own booking
        const b = await prisma.booking.findUnique({ where: { id }, select: { userId: true } });
        if (!b || b.userId !== (session as any).userId) throw new Error("Unauthorized");
    }

    // 1. Mark booking as MOVE_IN_SCHEDULED (Legacy: PAID)
    const booking = await prisma.booking.update({
        where: { id },
        data: {
            status: 'MOVE_IN_SCHEDULED',
            moveInScheduled: new Date(),
            paymentStatus: 'PAID',
            paymentMethod: method,
            paidAt: new Date(),
        }
    });

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role as string,
        actorName: session.name || 'Owner/Admin',
        actionType: 'UPDATE',
        entityType: 'BOOKING',
        entityId: id,
        description: `Payment received via ${method}. Status moved to MOVE_IN_SCHEDULED.`,
        newValue: { status: 'MOVE_IN_SCHEDULED', paymentMethod: method }
    });

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/student');

    // Notify about payment
    try {
        const property = await prisma.property.findUnique({ where: { id: booking.propertyId || '' } });
        if (property) {
            await NotificationService.onPaymentCompleted(booking, booking.amount, property.ownerId);
        }
    } catch (e) {
        console.error("Manual Payment Notification Error:", e);
    }

    return booking;
}

export async function checkInBooking(id: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    // 1. Fetch booking
    const booking = await prisma.booking.findUnique({
        where: { id },
        include: { documents: true }
    });

    if (!booking) throw new Error("Booking not found");
    if (booking.status !== 'MOVE_IN_SCHEDULED' && booking.status !== 'PAID' && booking.status !== 'CASH_PAID') {
        throw new Error("Booking must be paid and move-in scheduled before check-in.");
    }

    // 2. Check documents (Industry Standard: All mandatory docs MUST be verified)
    const verifiedDocs = booking.documents.filter(d => d.status === 'VERIFIED');
    if (verifiedDocs.length < 2) {
        throw new Error("KYC Incomplete: At least ID and Address Proof must be verified before check-in.");
    }

    // 3. Check Agreement
    if (!booking.agreementSigned) {
        throw new Error("Agreement Pending: Digital agreement must be signed by the student before check-in.");
    }

    // 4. Update booking status to CHECKED_IN
    const updatedBooking = await prisma.booking.update({
        where: { id },
        data: {
            status: 'ACTIVE',
            activeAt: new Date(),
            onboardingDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        }
    });

    // 5. Create Tenant record
    const room = await prisma.room.findUnique({
        where: { id: booking.roomId! },
        include: { property: true }
    });

    if (room) {
        const currentMonth = new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });

        // === UNIFIED IDENTITY: One Passport for Life ===
        // Inherit the student's REN-USER-XXXX display ID.
        // Tenancy is created atomically with Serializable isolation —
        // tenancyNumber is the DB-level guard against race conditions.
        const studentUser = await prisma.user.findUnique({
            where: { id: booking.userId },
            select: { id: true, displayId: true }
        });

        const user = studentUser!;

        // ─── Atomic Tenancy Creation ───────────────────────────────────────
        const tenancy = await prisma.$transaction(async (tx) => {
            // Count inside transaction — atomic, no race condition
            const tenancyCount = await tx.tenancy.count({
                where: { userId: user.id }
            });

            const tenancyNumber = tenancyCount + 1;

            const displayId = tenancyNumber === 1
                ? (user.displayId ?? `REN-USER-${user.id.slice(0, 8).toUpperCase()}`)
                : `${user.displayId ?? `REN-USER-${user.id.slice(0, 8).toUpperCase()}`}-T${tenancyNumber}`;

            return await tx.tenancy.create({
                data: {
                    userId: user.id,
                    propertyId: room.propertyId,
                    tenancyNumber,   // @@unique([userId, tenancyNumber]) is the final DB guard
                    displayId,
                }
            });
        }, {
            isolationLevel: 'Serializable',
        });

        // Derive tenantDisplayId from the created Tenancy record
        const tenantDisplayId = tenancy.displayId;

        const tenant = await prisma.tenant.create({
            data: {
                displayId: tenantDisplayId,
                studentId: booking.userId,
                name: booking.guestName,
                phone: booking.guestPhone || '',
                email: booking.guestEmail || null,
                address: booking.guestAddress || null,
                city: booking.guestCity || null,
                pincode: booking.guestPincode || null,
                country: booking.guestCountry || 'India',
                occupationType: booking.occupationType || null,
                occupationDetail: booking.occupationDetail || null,
                propertyId: room.propertyId,
                roomId: booking.roomId!,
                bedId: (booking as any).bedId || null,
                roomNumber: room.roomNumber,
                roomType: room.type,
                rent: booking.amount,
                startDate: updatedBooking.onboardingDate || new Date().toLocaleDateString('en-IN'),
                status: 'ACTIVE',
            }
        });

        // Link Tenant back to Booking
        await prisma.booking.update({
            where: { id: booking.id },
            data: { tenantId: tenant.id }
        });

        // Mark the assigned bed as OCCUPIED and link to tenant
        const bookingBedId = (booking as any).bedId;
        if (bookingBedId) {
            await prisma.bed.update({
                where: { id: bookingBedId },
                data: { status: 'OCCUPIED', tenantId: tenant.id, lockedByBookingId: null, lockedAt: null }
            }).catch(() => {});
        }

        // 6. Create initial rent record
        await prisma.rentRecord.create({
            data: {
                tenantId: tenant.id,
                month: currentMonth,
                amount: booking.amount,
                paid: true,
                paidOn: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            }
        });

        // 7. Log check-in
        logAuditEvent({
            actorId: session.userId,
            actorRole: session.role as string,
            actorName: session.name || 'Owner/Admin',
            actionType: 'UPDATE',
            entityType: 'USER', // Tenant/User level
            entityId: tenant.id,
            description: `Tenant ${booking.guestName} formally checked-in from booking ${booking.displayId}`,
            newValue: tenant
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
    return updated;
}

export async function signAgreement(id: string, agreementMeta?: { agreementText?: string; agreementId?: string; agreementPdfUrl?: string }) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const booking = await prisma.booking.findUnique({ where: { id }, include: { user: true } });
    if (!booking) throw new Error("Booking not found");
    if (booking.userId !== session.userId) throw new Error("Unauthorized to sign this agreement");

    const updated = await prisma.booking.update({
        where: { id },
        data: {
            status: 'BOOKING_CONFIRMED',
            agreementSigned: true,
            agreementSignedAt: new Date(),
            ...(agreementMeta?.agreementText ? { agreementText: agreementMeta.agreementText } as any : {}),
            ...(agreementMeta?.agreementId ? { agreementId: agreementMeta.agreementId } as any : {}),
            ...(agreementMeta?.agreementPdfUrl ? { agreementPdfUrl: agreementMeta.agreementPdfUrl } as any : {}),
        }
    });

    if (booking.propertyId) {
        const property = await prisma.property.findUnique({ where: { id: booking.propertyId } });
        if (property) {
            await NotificationService.onAgreementSigned(booking, property.ownerId);
        }
    }

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'USER',
        actorName: session.name || 'User',
        actionType: 'UPDATE',
        entityType: 'BOOKING',
        entityId: id,
        description: `Digital agreement signed by ${booking.guestName}. AgreementId: ${agreementMeta?.agreementId || 'N/A'}.`,
    });

    revalidatePath('/dashboard/student');
    revalidatePath('/dashboard/owner/bookings');
    return updated;
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
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

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
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

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
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

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
