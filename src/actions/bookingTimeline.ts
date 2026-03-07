'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * Add an event to a booking's immutable timeline
 * Called by all booking lifecycle actions automatically
 */
export async function addBookingEvent(
    bookingId: string,
    eventType: string,
    title: string,
    description?: string,
    performedBy?: string,
    performedByRole?: string,
    metadata?: Record<string, any>
) {
    return (prisma as any).bookingEvent.create({
        data: {
            bookingId,
            eventType,
            title,
            description,
            performedBy: performedBy || null,
            performedByRole: performedByRole || 'SYSTEM',
            metadata: JSON.stringify(metadata || {}),
        }
    });
}

/**
 * Get full chronological timeline for a booking
 * Available to student (own booking), owner, and admin
 */
export async function getBookingTimeline(bookingId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    // Verify access: student can only see their own bookings
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new Error("Booking not found");

    if (session.role === 'USER' && booking.userId !== (session as any).userId) {
        throw new Error("Access denied");
    }

    const events = await (prisma as any).bookingEvent.findMany({
        where: { bookingId },
        orderBy: { createdAt: 'asc' }
    });

    return events.map((e: any) => ({
        ...e,
        metadata: (() => { try { return JSON.parse(e.metadata); } catch { return {}; } })()
    }));
}

// ── Auto-add timeline events for key booking lifecycle actions ──
// These are utility wrappers used by bookings.ts actions

export const BOOKING_EVENTS = {
    REQUEST_SUBMITTED:   (userId: string) => ({ type: 'REQUEST_SUBMITTED', title: 'Booking Request Submitted', role: 'USER', by: userId }),
    OWNER_ACCEPTED:      (ownerId: string) => ({ type: 'OWNER_ACCEPTED', title: 'Owner Accepted Request', role: 'OWNER', by: ownerId }),
    OWNER_REJECTED:      (ownerId: string) => ({ type: 'OWNER_REJECTED', title: 'Owner Rejected Request', role: 'OWNER', by: ownerId }),
    BED_ALLOCATED:       (adminId: string, bedNo: string) => ({ type: 'BED_ALLOCATED', title: `Bed ${bedNo} Allocated`, role: 'SYSTEM', by: adminId, meta: { bedNumber: bedNo } }),
    TOKEN_PAID:          (userId: string, amount: number) => ({ type: 'TOKEN_PAID', title: `Token ₹${amount} Paid`, role: 'USER', by: userId, meta: { amount } }),
    ROOM_RESERVED:       () => ({ type: 'ROOM_RESERVED', title: 'Room Reserved — KYC Required', role: 'SYSTEM', by: null }),
    KYC_UPLOADED:        (userId: string) => ({ type: 'KYC_UPLOADED', title: 'KYC Documents Uploaded', role: 'USER', by: userId }),
    KYC_VERIFIED:        (adminId: string) => ({ type: 'KYC_VERIFIED', title: 'KYC Verified by Admin', role: 'ADMIN', by: adminId }),
    KYC_FAILED:          (adminId: string, reason: string) => ({ type: 'KYC_FAILED', title: 'KYC Failed', role: 'ADMIN', by: adminId, meta: { reason } }),
    AGREEMENT_SIGNED:    (userId: string) => ({ type: 'AGREEMENT_SIGNED', title: 'Agreement Digitally Signed', role: 'USER', by: userId }),
    BOOKING_CONFIRMED:   () => ({ type: 'BOOKING_CONFIRMED', title: 'Booking Confirmed', role: 'SYSTEM', by: null }),
    CHECKED_IN:          (ownerId: string) => ({ type: 'CHECKED_IN', title: 'Student Checked In', role: 'OWNER', by: ownerId }),
    CANCELLED_BY_STUDENT:(userId: string, reason: string) => ({ type: 'CANCELLED', title: 'Cancelled by Student', role: 'USER', by: userId, meta: { reason } }),
    CANCELLED_BY_OWNER:  (ownerId: string, reason: string) => ({ type: 'CANCELLED', title: 'Cancelled by Owner', role: 'OWNER', by: ownerId, meta: { reason } }),
    ADMIN_OVERRIDE:      (adminId: string, action: string) => ({ type: 'ADMIN_OVERRIDE', title: `Admin Override: ${action}`, role: 'ADMIN', by: adminId }),
    WAITLISTED:          () => ({ type: 'WAITLISTED', title: 'Added to Waitlist (Property Full)', role: 'SYSTEM', by: null }),
    DISPUTE_RAISED:      (userId: string) => ({ type: 'DISPUTE_RAISED', title: 'Dispute Raised', role: 'USER', by: userId }),
};

/**
 * Helper to quickly log a predefined event
 */
export async function logBookingEvent(bookingId: string, event: { type: string; title: string; role?: string; by?: string | null; meta?: any; description?: string }) {
    return addBookingEvent(bookingId, event.type, event.title, event.description, event.by || undefined, event.role, event.meta);
}
