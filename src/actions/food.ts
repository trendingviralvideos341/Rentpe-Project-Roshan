'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";
import { randomUUID } from "crypto";
import { toUTC, nextBillingCycleStart, isTokenValid } from "@/utils/foodBillingUtils";
import { createNotification } from "@/actions/notifications";
import { sendEmail } from "@/lib/email";

/**
 * Food Preference Actions — Production Hardened (All 5 Specs)
 *
 * Role Logic:
 *   STUDENT  → Direct CONFIRMED
 *   OWNER    enable  → PENDING_USER + confirm request to student
 *   OWNER    disable → Direct CONFIRMED (no student confirm needed)
 *   ADMIN    → Direct CONFIRMED + mandatory notes
 *
 * Security:
 *   - Zod input validation
 *   - Zero-price guard
 *   - Ownership chain check
 *   - Duplicate + single-PENDING guard
 *   - effectiveFrom from billing anchor (UTC)
 *   - No hard deletes — status only
 */

// ─────────────────────────────────────────────
// INPUT SCHEMA
// ─────────────────────────────────────────────

const ChangeFoodSchema = z.object({
    bookingId: z.string().uuid("Invalid booking ID"),
    foodSelected: z.boolean(),
    notes: z.string().max(500).optional(),
});

// ─────────────────────────────────────────────
// MAIN ACTION: changeFoodPreference
// ─────────────────────────────────────────────

export async function changeFoodPreference(
    bookingId: string,
    foodSelected: boolean,
    notes?: string,
): Promise<{ success: boolean; error?: string; pendingConfirmation?: boolean; effectiveFrom?: string }> {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    // ── Zod validation ──
    const parsed = ChangeFoodSchema.safeParse({ bookingId, foodSelected, notes });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || 'Validation error' };

    try {
        // ── Fetch booking with full ownership chain ──
        const booking = await (prisma as any).booking.findUnique({
            where: { id: bookingId },
            include: {
                property: { select: { ownerId: true, foodType: true } },
                user: { select: { id: true, name: true, email: true } },
            }
        });

        if (!booking) return { success: false, error: 'Booking not found' };

        // ── Security: only allowed on ACTIVE bookings ──
        if (booking.status && !['ACTIVE', 'APPROVED', 'CONFIRMED'].includes(booking.status)) {
            return { success: false, error: 'Food preferences can only be changed for active bookings.' };
        }

        const userId = (session as any).userId;
        const role = session.role as string;

        // ── Ownership chain check ──
        if (role === 'OWNER' || role === 'STAFF') {
            if (booking.property?.ownerId !== userId) {
                return { success: false, error: 'You do not own this property' };
            }
        } else if (role === 'USER' || role === 'STUDENT') {
            if (booking.userId !== userId) {
                return { success: false, error: 'This is not your booking' };
            }
        }
        // ADMIN passes all checks

        // ── Zero-price guard (only when enabling) ──
        if (foodSelected && (!booking.foodPriceApplied || booking.foodPriceApplied === 0)) {
            return { success: false, error: 'Food price was not set at booking approval. Contact admin to set it.' };
        }

        // ── NOT_AVAILABLE guard ──
        if (booking.property?.foodType === 'NOT_AVAILABLE') {
            return { success: false, error: 'Food service is not available at this property.' };
        }

        // ── Billing anchor for effectiveFrom ──
        const billingProfile = await (prisma as any).billingProfile.findFirst({
            where: { tenantId: booking.tenant?.id ?? undefined },
            select: { billingAnchorDay: true }
        });
        const anchorDay = billingProfile?.billingAnchorDay || 1;
        const effectiveFrom = nextBillingCycleStart(anchorDay, new Date());

        // ── Duplicate guard (same bookingId + effectiveFrom) ──
        const duplicate = await (prisma as any).foodPreference.findFirst({
            where: {
                bookingId,
                effectiveFrom,
                status: { in: ['CONFIRMED', 'PENDING_USER'] }
            }
        });
        if (duplicate) {
            return { success: false, error: 'A food preference change already exists for this billing cycle.' };
        }

        // ── Single PENDING guard ──
        const existingPending = await (prisma as any).foodPreference.findFirst({
            where: { bookingId, status: 'PENDING_USER' }
        });
        if (existingPending) {
            return { success: false, error: 'A pending food request is already awaiting student confirmation.' };
        }

        const prevFoodSelected = booking.foodSelected;

        // ─────────────────────────────────────────────
        // ROLE LOGIC
        // ─────────────────────────────────────────────

        // ── STUDENT: direct CONFIRMED ──
        if (role === 'USER' || role === 'STUDENT') {
            const today = new Date();
            const effectiveFromStudent = today; // starts immediately

            const pref = await (prisma as any).foodPreference.create({
                data: {
                    bookingId,
                    propertyId: booking.propertyId,
                    userId,
                    foodSelected,
                    changedBy: 'USER',
                    changedById: userId,
                    effectiveFrom: toUTC(effectiveFromStudent),
                    notes: notes || null,
                    status: 'CONFIRMED',
                    confirmedAt: new Date(),
                }
            });

            // Update booking cache
            await (prisma as any).booking.update({
                where: { id: bookingId },
                data: { foodSelected } as any
            });

            // ── Prorated food charge for current month (opt-in only) ──────────
            if (foodSelected && booking.foodPriceApplied > 0) {
                const { proratedFoodCharge } = await import('@/utils/billingUtils');
                const thisMonthCharge = proratedFoodCharge(booking.foodPriceApplied, today);
                const monthLabel = today.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                await (prisma as any).foodRecord.create({
                    data: {
                        bookingId,
                        propertyId: booking.propertyId,
                        userId,
                        month: monthLabel,
                        amount: thisMonthCharge,
                        paid: false,
                        note: `Prorated food — opted in ${today.getDate()} ${monthLabel}`,
                    }
                });
            }

            logAuditEvent({
                actorId: userId, actorRole: role, actorName: (session as any).name || 'Student',
                actionType: 'UPDATE', entityType: 'BOOKING', entityId: bookingId,
                description: `Student ${foodSelected ? 'enabled' : 'disabled'} food. Effective: today (${today.toISOString()})`,
                previousValue: { foodSelected: prevFoodSelected },
                newValue: { foodSelected, effectiveFrom: today.toISOString() },
            });

            revalidatePath('/dashboard/student');
            return { success: true, effectiveFrom: today.toISOString() };
        }


        // ── OWNER enable: PENDING_USER confirmation flow ──
        if ((role === 'OWNER' || role === 'STAFF') && foodSelected) {
            const token = randomUUID();
            const tokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

            await (prisma as any).foodPreference.create({
                data: {
                    bookingId,
                    propertyId: booking.propertyId,
                    userId: booking.userId,
                    foodSelected: true,
                    changedBy: 'OWNER',
                    changedById: userId,
                    effectiveFrom: toUTC(effectiveFrom),
                    notes: notes || `Owner requested food enablement. Awaiting student confirmation.`,
                    status: 'PENDING_USER',
                    confirmationToken: token,
                    tokenExpiry,
                    tokenUsed: false,
                }
            });

            // Notify student
            await createNotification(
                booking.userId,
                'FOOD_REQUEST',
                `Your PG owner has requested to enable food service (₹${booking.foodPriceApplied}/month) from ${effectiveFrom.toLocaleDateString()}. Please confirm or reject in your dashboard.`
            );

            if (booking.user?.email) {
                sendEmail({
                    to: booking.user.email,
                    subject: 'Food Service Request — Action Required',
                    html: `<h2>Food Service Request</h2><p>Your PG owner has requested to enable food service at <strong>₹${booking.foodPriceApplied}/month</strong>.</p><p>This will be effective from <strong>${effectiveFrom.toLocaleDateString('en-IN')}</strong>.</p><p>Please log in to your dashboard to <strong>confirm or reject</strong> this request within 48 hours.</p><p><a href="https://rentpe.in/dashboard/student">Go to Dashboard →</a></p>`
                }).catch((e: Error) => console.error('[FoodEmail] Failed:', e.message));
            }

            logAuditEvent({
                actorId: userId, actorRole: role, actorName: (session as any).name || 'Owner',
                actionType: 'CREATE', entityType: 'BOOKING', entityId: bookingId,
                description: `Owner sent food enable request to student. Awaiting confirmation. Effective: ${effectiveFrom.toISOString()}`,
                previousValue: { foodSelected: prevFoodSelected },
                newValue: { status: 'PENDING_USER', effectiveFrom: effectiveFrom.toISOString() },
            });

            revalidatePath('/dashboard/owner');
            return { success: true, pendingConfirmation: true, effectiveFrom: effectiveFrom.toISOString() };
        }

        // ── OWNER disable: direct CONFIRMED (no student confirm needed) ──
        if ((role === 'OWNER' || role === 'STAFF') && !foodSelected) {
            await (prisma as any).foodPreference.create({
                data: {
                    bookingId,
                    propertyId: booking.propertyId,
                    userId: booking.userId,
                    foodSelected: false,
                    changedBy: 'OWNER',
                    changedById: userId,
                    effectiveFrom: toUTC(effectiveFrom),
                    notes: notes || 'Owner disabled food service.',
                    status: 'CONFIRMED',
                    confirmedAt: new Date(),
                }
            });

            await (prisma as any).booking.update({
                where: { id: bookingId },
                data: { foodSelected: false } as any
            });

            logAuditEvent({
                actorId: userId, actorRole: role, actorName: (session as any).name || 'Owner',
                actionType: 'UPDATE', entityType: 'BOOKING', entityId: bookingId,
                description: `Owner disabled food service. Effective: ${effectiveFrom.toISOString()}`,
                previousValue: { foodSelected: prevFoodSelected },
                newValue: { foodSelected: false, effectiveFrom: effectiveFrom.toISOString() },
            });

            revalidatePath('/dashboard/owner');
            return { success: true, effectiveFrom: effectiveFrom.toISOString() };
        }

        // ── ADMIN: direct CONFIRMED + mandatory notes ──
        if (role === 'ADMIN') {
            if (!notes?.trim()) {
                return { success: false, error: 'Admin must provide notes when changing food preference.' };
            }

            await (prisma as any).foodPreference.create({
                data: {
                    bookingId,
                    propertyId: booking.propertyId,
                    userId: booking.userId,
                    foodSelected,
                    changedBy: 'ADMIN',
                    changedById: userId,
                    effectiveFrom: toUTC(effectiveFrom),
                    notes,
                    status: 'CONFIRMED',
                    confirmedAt: new Date(),
                }
            });

            await (prisma as any).booking.update({
                where: { id: bookingId },
                data: { foodSelected } as any
            });

            logAuditEvent({
                actorId: userId, actorRole: role, actorName: (session as any).name || 'Admin',
                actionType: 'UPDATE', entityType: 'BOOKING', entityId: bookingId,
                description: `Admin ${foodSelected ? 'enabled' : 'disabled'} food service. Notes: ${notes}. Effective: ${effectiveFrom.toISOString()}`,
                previousValue: { foodSelected: prevFoodSelected },
                newValue: { foodSelected, effectiveFrom: effectiveFrom.toISOString(), adminNotes: notes },
            });

            revalidatePath('/dashboard/admin');
            revalidatePath('/dashboard/student');
            return { success: true, effectiveFrom: effectiveFrom.toISOString() };
        }

        return { success: false, error: 'Unrecognized role.' };

    } catch (err: any) {
        console.error('[changeFoodPreference]', err);
        if (err.code === 'P2002') {
            return { success: false, error: 'A food preference for this cycle already exists (duplicate constraint).' };
        }
        return { success: false, error: err.message || 'Unexpected error.' };
    }
}

// ─────────────────────────────────────────────
// ACTION: confirmFoodRequest (student confirm/reject)
// ─────────────────────────────────────────────

/**
 * Student confirms or rejects an owner-initiated food request.
 * - Validates token (expiry + tokenUsed)
 * - Bulk-invalidates all other PENDING_USER tokens for the same booking
 * - On accept: CONFIRMED + booking.foodSelected cache updated
 * - On reject: REJECTED
 * - No hard deletes — status only
 */
export async function confirmFoodRequest(
    token: string,
    accept: boolean,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    // ── Security: validate token format BEFORE querying DB (prevents brute-force enumeration) ──
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(token)) {
        return { success: false, error: 'Invalid token format.' };
    }

    const userId = (session as any).userId;

    const pref = await (prisma as any).foodPreference.findUnique({
        where: { confirmationToken: token },
        include: { booking: { select: { userId: true, foodSelected: true } } }
    });

    if (!pref) return { success: false, error: 'Invalid token.' };

    // ── Token security ──
    if (!isTokenValid({ tokenExpiry: pref.tokenExpiry, tokenUsed: pref.tokenUsed })) {
        return { success: false, error: 'This token has expired or has already been used.' };
    }

    // ── Ownership: only the student who owns the booking can confirm ──
    if (pref.booking?.userId !== userId) {
        return { success: false, error: 'This request is not for your account.' };
    }

    const prevFoodSelected = pref.booking?.foodSelected;

    // ── Bulk-invalidate all other PENDING_USER tokens for this booking ──
    await (prisma as any).foodPreference.updateMany({
        where: {
            bookingId: pref.bookingId,
            status: 'PENDING_USER',
            id: { not: pref.id }
        },
        data: { status: 'REJECTED', tokenUsed: true }
    });

    if (accept) {
        // Accept: CONFIRMED
        await (prisma as any).foodPreference.update({
            where: { id: pref.id },
            data: { status: 'CONFIRMED', tokenUsed: true, confirmedAt: new Date() }
        });

        // Update booking.foodSelected cache
        await (prisma as any).booking.update({
            where: { id: pref.bookingId },
            data: { foodSelected: true } as any
        });

        logAuditEvent({
            actorId: userId, actorRole: session.role as string, actorName: (session as any).name || 'Student',
            actionType: 'UPDATE', entityType: 'BOOKING', entityId: pref.bookingId,
            description: `Student confirmed food enable request. Token used. Effective: ${pref.effectiveFrom.toISOString()}`,
            previousValue: { foodSelected: prevFoodSelected },
            newValue: { foodSelected: true, effectiveFrom: pref.effectiveFrom.toISOString() },
        });

        revalidatePath('/dashboard/student');
        return { success: true };
    } else {
        // Reject: REJECTED
        await (prisma as any).foodPreference.update({
            where: { id: pref.id },
            data: { status: 'REJECTED', tokenUsed: true }
        });

        logAuditEvent({
            actorId: userId, actorRole: session.role as string, actorName: (session as any).name || 'Student',
            actionType: 'UPDATE', entityType: 'BOOKING', entityId: pref.bookingId,
            description: `Student rejected food enable request. Token invalidated.`,
            previousValue: { foodSelected: prevFoodSelected },
            newValue: { foodSelected: prevFoodSelected, status: 'REJECTED' },
        });

        revalidatePath('/dashboard/student');
        return { success: true };
    }
}

// ─────────────────────────────────────────────
// ACTION: getPropertyFoodConfig
// ─────────────────────────────────────────────

export async function getPropertyFoodConfig(propertyId: string) {
    const property = await (prisma as any).property.findUnique({
        where: { id: propertyId },
        select: { foodType: true, foodPricePerMonth: true }
    });
    return property;
}

// ─────────────────────────────────────────────
// ACTION: getFoodPreferenceHistory (for student dashboard)
// ─────────────────────────────────────────────

export async function getFoodPreferenceHistory(bookingId: string) {
    const session = await getSession();
    if (!session) return [];

    return (prisma as any).foodPreference.findMany({
        where: { bookingId },
        orderBy: { createdAt: 'desc' },
        take: 20,
    });
}

// ─────────────────────────────────────────────
// ACTION: getStudentFoodStatus (for sidebar)
// ─────────────────────────────────────────────

/**
 * Fetches the food status for the logged-in student.
 * Used for dynamic sidebar labeling and linking.
 */
export async function getStudentFoodStatus(): Promise<{
    available: boolean;
    opted: boolean;
    label: string;
    href?: string;
    hasActiveBooking: boolean;
} | null> {
    const session = await getSession();
    // Use USER as per UserRole type
    if (!session || ((session.role as string) !== 'USER' && (session.role as string) !== 'STUDENT')) return null;

    const userId = (session as any).userId;

    try {
        // Find the latest "primary" booking (Active, Checked In, or Paid/Approved)
        const booking = await (prisma as any).booking.findFirst({
            where: {
                userId,
                status: {
                    in: ['CHECKED_IN', 'ACTIVE', 'PAID', 'APPROVED', 'ROOM_RESERVED', 'KYC_PENDING', 'APPROVED_KYC_PENDING', 'AGREEMENT_PENDING']
                }
            },
            include: {
                property: {
                    select: {
                        foodType: true,
                        name: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!booking) {
            return {
                available: false,
                opted: false,
                label: 'Food',
                hasActiveBooking: false
            };
        }

        const foodAvailable = booking.property?.foodType !== 'NOT_AVAILABLE';
        const foodOpted = booking.foodSelected === true;

        let label = 'Food Menu';
        if (!foodAvailable) {
            label = 'No food option available';
        } else if (!foodOpted) {
            label = 'Food - Not Opted';
        }

        return {
            available: foodAvailable,
            opted: foodOpted,
            label,
            href: foodAvailable ? '/dashboard/student/food-menu' : undefined,
            hasActiveBooking: true
        };

    } catch (err) {
        console.error('[getStudentFoodStatus]', err);
        return null;
    }
}

