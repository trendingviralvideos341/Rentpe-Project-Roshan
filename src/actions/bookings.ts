'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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
}) {
    const session = await getSession();
    if (!session) throw new Error("You must be logged in to book.");

    const booking = await prisma.booking.create({
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

    revalidatePath('/dashboard/student');
    revalidatePath('/dashboard/owner/bookings');
    return booking;
}

export async function getBookings() {
    try {
        const session = await getSession();
        if (!session) throw new Error("Unauthorized");

        const role = (session as any).role;
        const userId = (session as any).userId;

        if (role === 'ADMIN') {
            return await prisma.booking.findMany({
                include: { user: { select: { name: true, email: true } } },
                orderBy: { createdAt: 'desc' }
            });
        } else if (role === 'OWNER') {
            const properties = await prisma.property.findMany({
                where: { ownerId: userId },
                select: { name: true }
            });
            const propertyNames = properties.map(p => p.name);
            return await prisma.booking.findMany({
                where: { propertyName: { in: propertyNames } },
                include: { user: { select: { name: true, email: true } } },
                orderBy: { createdAt: 'desc' }
            });
        } else {
            // Student: fetch bookings and also look up owner info from the property
            const bookings = await prisma.booking.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' }
            });
            // Enrich with owner details by matching propertyName
            const propertyNames = [...new Set(bookings.map(b => b.propertyName))];
            const properties = await prisma.property.findMany({
                where: { name: { in: propertyNames } },
                include: { owner: { select: { name: true, email: true, phone: true } } }
            });
            const propMap = new Map(properties.map(p => [p.name, p]));
            return bookings.map(b => ({
                ...b,
                ownerName: propMap.get(b.propertyName)?.owner?.name || propMap.get(b.propertyName)?.ownerName || null,
                ownerEmail: propMap.get(b.propertyName)?.owner?.email || null,
                ownerPhone: (propMap.get(b.propertyName)?.owner as any)?.phone || null,
                propertyAddress: propMap.get(b.propertyName)?.address || null,
                propertyCity: propMap.get(b.propertyName)?.city || null,
            }));
        }
    } catch (e) {
        console.error("getBookings Error:", e);
        return [];
    }
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
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

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

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/owner/properties');
    revalidatePath('/dashboard/student');
    return booking;
}

export async function rejectBooking(id: string, reason?: string) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

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

    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/owner/properties');
    revalidatePath('/dashboard/student');
    return booking;
}

export async function updateBookingStatus(id: string, status: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

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
    if (!session) throw new Error("Unauthorized");

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

        const userId = (session as any).userId;
        const properties = await prisma.property.findMany({
            where: { ownerId: userId },
            select: { name: true }
        });
        const propertyNames = properties.map(p => p.name);

        return await prisma.booking.count({
            where: {
                propertyName: { in: propertyNames },
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
    if (booking.userId !== (session as any).userId) throw new Error("Unauthorized");
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
