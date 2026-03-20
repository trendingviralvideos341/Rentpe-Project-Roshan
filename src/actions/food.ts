'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * SECTION 6 & 7 — Post-Booking Food Preference Change
 * 
 * Rules:
 * - Only works for foodType = 'OPTIONAL'
 * - Changes apply from the FIRST day of the NEXT month (Section 8 — Billing Logic)
 * - Tracked in food_preferences table for full audit trail (Section 10)
 * - Can be triggered by USER, OWNER, or ADMIN (Section 6 — A, B, C)
 */
export async function changeFoodPreference(
    bookingId: string,
    foodSelected: boolean,
    notes?: string
): Promise<{ success: boolean; effectiveFrom?: string; error?: string }> {
    const session = await getSession();
    if (!session) return { success: false, error: "Unauthorized" };

    // Fetch booking and property details separately for type safety
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return { success: false, error: "Booking not found" };

    const property = booking.propertyId
        ? await prisma.property.findUnique({
            where: { id: booking.propertyId },
            select: { id: true, foodType: true, foodPricePerMonth: true, ownerId: true } as any
          }) as { id: string; foodType: string; foodPricePerMonth: number | null; ownerId: string } | null
        : null;

    // SECTION 12 — Validations
    if (property?.foodType !== 'OPTIONAL') {
        const reason = property?.foodType === 'INCLUDED'
            ? "Food is included in rent and cannot be changed."
            : "This property does not offer a food service.";
        return { success: false, error: reason };
    }

    // Guard: No change if already same status
    if ((booking as any).foodSelected === foodSelected) {
        return { success: false, error: foodSelected ? "Food is already enabled." : "Food is already disabled." };
    }

    // Guard: Owner/Staff can only manage bookings of their own properties
    if (session.role === 'OWNER' || session.role === 'STAFF') {
        const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { parentOwnerId: true } });
        const effectiveOwnerId = user?.parentOwnerId || session.userId;
        if (property?.ownerId !== effectiveOwnerId) return { success: false, error: "Unauthorized" };
    }

    // Guard: Student can only change their own booking
    if (session.role === ('STUDENT' as any) || session.role === 'USER') {
        if (booking.userId !== session.userId) return { success: false, error: "Unauthorized" };
    }

    // SECTION 8 — Billing Logic: effectiveFrom = 1st day of NEXT month
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    nextMonth.setHours(0, 0, 0, 0);

    const changedBy = session.role === 'ADMIN' ? 'ADMIN'
        : (session.role === 'OWNER' || session.role === 'STAFF') ? 'OWNER'
        : 'USER';

    const foodPriceApplied = foodSelected ? (property?.foodPricePerMonth ?? 0) : 0;

    await prisma.$transaction(async (tx) => {
        // 1. Create FoodPreference history record (SECTION 9)
        await (tx as any).foodPreference.create({
            data: {
                bookingId,
                propertyId: property!.id,
                userId: booking.userId,
                foodSelected,
                changedBy,
                changedById: session.userId,
                effectiveFrom: nextMonth,
                notes: notes || null,
            }
        });

        // 2. Update booking to reflect new preference immediately (billing reads on next invoice)
        await tx.booking.update({
            where: { id: bookingId },
            data: {
                foodSelected,
                foodPriceApplied,
            } as any
        });

        // 3. SECTION 10 — Audit Log
        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: session.role,
                actorName: session.name || session.role,
                actionType: foodSelected ? 'FOOD_OPT_IN' : 'FOOD_OPT_OUT',
                entityType: 'BOOKING',
                entityId: bookingId,
                entityName: booking.propertyName,
                description: `${changedBy} ${foodSelected ? 'opted IN to' : 'opted OUT of'} food service for booking ${booking.displayId}. Effective from: ${nextMonth.toLocaleDateString('en-IN')}. ${notes ? `Notes: ${notes}` : ''}`,
                previousValue: { foodSelected: (booking as any).foodSelected, foodPriceApplied: (booking as any).foodPriceApplied },
                newValue: { foodSelected, foodPriceApplied, effectiveFrom: nextMonth },
                ipAddress: 'server-action',
                userAgent: 'server-action'
            }
        });
    });

    revalidatePath('/dashboard/student');
    revalidatePath('/dashboard/owner/bookings');
    revalidatePath('/dashboard/admin');

    return {
        success: true,
        effectiveFrom: nextMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', day: 'numeric' })
    };
}

/**
 * SECTION 10 — Get full food preference change history for a booking.
 */
export async function getFoodPreferenceHistory(bookingId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    return (prisma as any).foodPreference.findMany({
        where: { bookingId },
        orderBy: { createdAt: 'desc' },
    });
}

/**
 * SECTION 3 — Get the food service configuration for a property (public + owner).
 */
export async function getPropertyFoodConfig(propertyId: string) {
    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { foodType: true, foodPricePerMonth: true } as any
    });
    return property as { foodType: string; foodPricePerMonth: number | null } | null;
}
