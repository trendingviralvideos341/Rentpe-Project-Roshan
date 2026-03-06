'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/actions/notifications";

export async function createBooking(data: {
    roomId?: string,
    propertyName: string,
    occupancy: string,
    guestName: string,
    moveInDate: string,
    amount: string,
    guestEmail?: string,
    guestPhone?: string,
    occupationType?: string,
    occupationDetail?: string,
    propertyId?: string,
}) {
    const session = await getSession();
    if (!session) throw new Error("You must be logged in to book.");

    // Server-side date validation: Move-in cannot be in the past
    const selectedDate = new Date(data.moveInDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
        throw new Error("Move-in date cannot be in the past.");
    }

    const booking = await (prisma.booking as any).create({
        data: {
            displayId: `REQ-${Math.floor(Math.random() * 90000000) + 10000000}`,
            userId: (session as any).userId,
            roomId: data.roomId,
            propertyName: data.propertyName,
            occupancy: data.occupancy,
            guestName: data.guestName,
            moveInDate: data.moveInDate,
            amount: data.amount,
            status: 'PENDING_APPROVAL',
            paymentStatus: 'UNPAID',
            guestEmail: data.guestEmail,
            guestPhone: data.guestPhone,
            occupationType: data.occupationType,
            occupationDetail: data.occupationDetail,
            propertyId: data.propertyId,
        }
    });

    await prisma.auditLog.create({
        data: {
            action: 'BOOKING_REQUESTED',
            targetId: booking.id,
            targetType: 'BOOKING',
            details: `Booking for ${data.propertyName} by ${data.guestName}`,
            performedBy: (session as any).userId
        }
    });

    // Notify owner about new booking
    try {
        const property = await prisma.property.findFirst({ where: { name: data.propertyName } });
        if (property) {
            await createNotification(property.ownerId, 'BOOKING', `New booking request for ${data.propertyName} by ${data.guestName}`);
        }
    } catch (e) { }

    revalidatePath('/dashboard/student');
    revalidatePath('/dashboard/owner/bookings');
    return booking;
}

export async function getBookings() {
    try {
        const session = await getSession();
        if (!session) return [];

        const userId = (session as any).userId;
        const role = session.role;

        // Security Patch: If the JWT is malformed or lacks a userId, reject the query.
        // Prisma natively interprets `undefined` as a query bypass, causing accidental data leaks.
        if (!userId) return [];

        if (role === 'OWNER') {
            const ownerProperties = await prisma.property.findMany({
                where: { ownerId: userId },
                select: { id: true }
            });
            const propertyIds = ownerProperties.map(p => p.id);
            return await (prisma.booking as any).findMany({
                where: { propertyId: { in: propertyIds } },
                orderBy: { createdAt: 'desc' },
                include: { user: { select: { name: true, email: true } } }
            });
        } else {
            const bookings: any[] = await (prisma.booking as any).findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                include: {
                    property: {
                        include: {
                            owner: { select: { name: true, email: true, phone: true } }
                        }
                    }
                }
            });

            return bookings.map((b: any) => {
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
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' }
    });
}

export async function approveBooking(id: string, data: {
    roomId?: string,
    amount?: string,
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
    pendingAmount?: string,
}) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const existingBooking = await prisma.booking.findUnique({ where: { id } });

    const booking = await (prisma as any).booking.update({
        where: { id },
        data: {
            status: 'APPROVED_KYC_PENDING',
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
        }
    });

    // Handle bed availability changes if the room assignment has changed
    if (existingBooking && data.roomId !== existingBooking.roomId) {
        // Increment (return) bed to the old room if the booking was already assigned to one
        if (existingBooking.roomId) {
            const oldRoom = await prisma.room.findUnique({ where: { id: existingBooking.roomId } });
            if (oldRoom) {
                await prisma.room.update({
                    where: { id: oldRoom.id },
                    data: { availability: oldRoom.availability + 1 }
                });
            }
        }
        // Decrement (take) bed from the newly assigned room
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



    await prisma.auditLog.create({
        data: {
            action: 'BOOKING_APPROVED',
            targetId: id,
            targetType: 'BOOKING',
            details: `Allocated Room ${data.roomAssigned}. Onboarding: ${data.onboardingDate || 'TBD'}`,
            performedBy: (session as any).userId
        }
    });

    // Notify student about approval
    try {
        if (booking.userId) {
            await createNotification(booking.userId, 'BOOKING', `Your booking for ${booking.propertyName} has been approved! Room: ${data.roomAssigned || 'TBD'}`);
        }
    } catch (e) { }

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/owner/properties');
    revalidatePath('/dashboard/student');
    return booking;
}

export async function rejectBooking(id: string, reason?: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const existingBooking = await prisma.booking.findUnique({ where: { id } });

    const booking = await prisma.booking.update({
        where: { id },
        data: { status: 'REJECTED' }
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

    await prisma.auditLog.create({
        data: {
            action: 'BOOKING_REJECTED',
            targetId: id,
            targetType: 'BOOKING',
            details: reason || 'No reason provided',
            performedBy: (session as any).userId
        }
    });

    // Notify student about rejection
    try {
        if (booking.userId) {
            await createNotification(booking.userId, 'BOOKING', `Your booking for ${booking.propertyName} was rejected. ${reason || ''}`);
        }
    } catch (e) { }

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/owner/properties');
    revalidatePath('/dashboard/student');
    return booking;
}

export async function updateBookingStatus(id: string, status: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const booking = await prisma.booking.update({
        where: { id },
        data: { status }
    });

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/student');
    return booking;
}

export async function markBookingPaid(id: string, method: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    // 1. Mark booking as PAID
    const booking = await prisma.booking.update({
        where: { id },
        data: {
            status: 'PAID',
            paymentStatus: 'PAID',
            paymentMethod: method,
            paidAt: new Date(),
        }
    });

    await prisma.auditLog.create({
        data: {
            action: 'BOOKING_PAID',
            targetId: id,
            targetType: 'BOOKING',
            details: `Payment received via ${method} at ${new Date().toLocaleString('en-IN')}`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/student');
    return booking;
}

export async function checkInBooking(id: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    // 1. Fetch booking
    const booking = await prisma.booking.findUnique({
        where: { id },
        include: { documents: true }
    });

    if (!booking) throw new Error("Booking not found");
    if (booking.status !== 'PAID' && booking.status !== 'CASH_PAID') {
        throw new Error("Booking must be paid before check-in.");
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
    const updatedBooking = await (prisma as any).booking.update({
        where: { id },
        data: {
            status: 'CHECKED_IN',
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
        const tenantDisplayId = `TNT-${Math.floor(Math.random() * 900000) + 100000}`;

        const tenant = await (prisma as any).tenant.create({
            data: {
                displayId: tenantDisplayId,
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
                roomNumber: room.roomNumber,
                roomType: room.type,
                rent: booking.amount,
                startDate: updatedBooking.onboardingDate,
                status: 'ACTIVE',
            }
        });

        // 5. Link Tenant back to Booking for robust review system
        await (prisma as any).booking.update({
            where: { id: booking.id },
            data: { tenantId: tenant.id }
        });

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
        await prisma.auditLog.create({
            data: {
                action: 'TENANT_CHECKED_IN',
                targetId: tenant.id,
                targetType: 'TENANT',
                details: `Tenant ${booking.guestName} formally checked-in from booking ${booking.displayId}`,
                performedBy: (session as any).userId
            }
        });
    }

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/owner/tenants');
    revalidatePath('/dashboard/student');
    return updatedBooking;
}

export async function getBookingById(id: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
            room: {
                include: { property: true }
            }
        }
    });

    if (!booking) throw new Error("Booking not found");
    if (booking.userId !== (session as any).userId && session.role !== 'OWNER' && session.role !== 'ADMIN') {
        throw new Error("Unauthorized");
    }

    return booking;
}

export async function getPendingBookingsCount() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') return 0;

        const userId = (session as any).userId as string;

        const ownerProperties = await prisma.property.findMany({
            where: { ownerId: userId },
            select: { id: true }
        });
        const propertyIds = ownerProperties.map(p => p.id);

        return await (prisma.booking as any).count({
            where: {
                propertyId: { in: propertyIds },
                status: 'PENDING_APPROVAL'
            }
        });
    } catch (e) {
        console.error("getPendingBookingsCount Error:", e);
        return 0;
    }
}

export async function cancelBooking(id: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new Error("Booking not found");
    // Admins can cancel any booking, otherwise only the booking creator can cancel
    if (session.role !== 'ADMIN' && booking.userId !== (session as any).userId) throw new Error("Unauthorized");
    if (booking.status !== 'PENDING_APPROVAL') throw new Error("Only pending bookings can be cancelled.");

    const updated = await prisma.booking.update({
        where: { id },
        data: { status: 'CANCELLED' }
    });

    // Return bed if room was assigned
    if (booking.roomId) {
        const room = await prisma.room.findUnique({ where: { id: booking.roomId } });
        if (room) {
            await prisma.room.update({
                where: { id: room.id },
                data: { availability: room.availability + 1 }
            });
        }
    }

    await prisma.auditLog.create({
        data: {
            action: 'BOOKING_CANCELLED',
            targetId: id,
            targetType: 'BOOKING',
            details: `Booking ${booking.displayId} cancelled by student`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/student');
    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/owner/properties');
    return updated;
}

export async function signAgreement(id: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const booking = await prisma.booking.findUnique({
        where: { id },
        include: { user: true }
    });
    if (!booking) throw new Error("Booking not found");
    if (booking.userId !== (session as any).userId) throw new Error("Unauthorized to sign this agreement");

    if (booking.status !== 'PAID' && booking.status !== 'CASH_PAID') {
        throw new Error("Agreement can only be signed after payment/reservation is confirmed.");
    }

    const updated = await prisma.booking.update({
        where: { id },
        data: { agreementSigned: true }
    });

    await prisma.auditLog.create({
        data: {
            action: 'AGREEEMENT_SIGNED',
            targetId: id,
            targetType: 'BOOKING',
            details: `Digital Agreement signed by ${(booking as any).guestName}. IP tracked for legal compliance.`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/student');
    revalidatePath('/dashboard/owner/bookings');
    return updated;
}

export async function getStudentPendingActionsCount() {
    const session = await getSession();
    if (!session) return 0;

    const userId = (session as any).userId;
    const bookings = await prisma.booking.findMany({
        where: { userId },
        include: { documents: true }
    });

    let count = 0;
    for (const b of bookings) {
        // 1. KYC pending (no docs or rejected docs)
        if (b.status === 'APPROVED_KYC_PENDING') {
            const hasVerified = b.documents.filter(d => d.status === 'VERIFIED').length >= 2;
            if (!hasVerified) count++;
        }
        // 2. Payment pending
        if (b.status === 'APPROVED_PAYMENT_PENDING') count++;
        // 3. Agreement pending
        if ((b.status === 'PAID' || b.status === 'CASH_PAID') && !b.agreementSigned) count++;
    }

    return count;
}

export async function getAdminAlertCounts() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return { bookings: 0, verifications: 0 };

    const [pendingBookings, pendingDocs] = await Promise.all([
        prisma.booking.count({ where: { status: 'PENDING_APPROVAL' } }),
        prisma.tenantDocument.count({ where: { status: 'PENDING' } })
    ]);

    return { bookings: pendingBookings, verifications: pendingDocs };
}
