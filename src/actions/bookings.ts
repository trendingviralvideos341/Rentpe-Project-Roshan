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

            // Fetch tenant records for the user to match with bookings
            const userEmail = (session as any).email;
            const tenants = userEmail ? await prisma.tenant.findMany({
                where: { email: userEmail }
            }) : [];

            return bookings.map((b: any) => {
                // Link tenant record by propertyId and roomId if possible
                const matchingTenant = tenants.find(t =>
                    t.propertyId === b.propertyId &&
                    t.roomId === b.roomId
                );

                return {
                    ...b,
                    tenantId: matchingTenant?.id || null, // Pass real tenantId for reviews
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
            status: 'APPROVED_PAYMENT_PENDING',
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

    // 2. ── CRITICAL: Create Tenant record from booking data ──────────────
    // Only create if not already exists (idempotent)
    const existingTenant = await prisma.tenant.findFirst({
        where: {
            roomId: booking.roomId || '',
            name: booking.guestName,
        }
    });

    if (!existingTenant && booking.roomId) {
        // Re-fetch booking with all fields (including new ones)
        const fullBooking = await (prisma as any).booking.findUnique({ where: { id } }) as any;
        // Get room + property info
        const room = await prisma.room.findUnique({
            where: { id: booking.roomId },
            include: { property: true }
        });

        if (room && fullBooking) {
            const currentMonth = new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });
            const tenantDisplayId = `TNT-${Math.floor(Math.random() * 900000) + 100000}`;

            const tenant = await (prisma as any).tenant.create({
                data: {
                    displayId: tenantDisplayId,
                    name: fullBooking.guestName,
                    phone: fullBooking.guestPhone || '',
                    email: fullBooking.guestEmail || null,
                    address: fullBooking.guestAddress || null,
                    city: fullBooking.guestCity || null,
                    pincode: fullBooking.guestPincode || null,
                    country: fullBooking.guestCountry || 'India',
                    occupationType: fullBooking.occupationType || null,
                    occupationDetail: fullBooking.occupationDetail || null,
                    propertyId: room.propertyId,
                    roomId: booking.roomId,
                    roomNumber: room.roomNumber,
                    roomType: room.type,
                    rent: fullBooking.amount,
                    startDate: fullBooking.onboardingDate || fullBooking.moveInDate,
                    status: 'ACTIVE',
                }
            });

            // Create initial rent record for current month
            await prisma.rentRecord.create({
                data: {
                    tenantId: tenant.id,
                    month: currentMonth,
                    amount: booking.amount,
                    paid: true,
                    paidOn: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                }
            });

            // Log tenant creation
            await prisma.auditLog.create({
                data: {
                    action: 'TENANT_CREATED',
                    targetId: tenant.id,
                    targetType: 'TENANT',
                    details: `Tenant ${booking.guestName} (${tenantDisplayId}) created from booking ${booking.displayId} after ${method} payment`,
                    performedBy: (session as any).userId
                }
            });
        }
    }

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/owner/tenants');
    revalidatePath('/dashboard/owner/properties');
    revalidatePath('/dashboard/admin');
    revalidatePath('/dashboard/student');
    return booking;
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
