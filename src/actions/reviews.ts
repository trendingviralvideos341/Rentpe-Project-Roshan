"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidateGlobalProperty } from "@/lib/cache";
import { logAuditEvent } from "@/lib/audit";

export async function submitReview(
    propertyId: string,
    tenantId: string,
    rating: number,
    comment?: string
) {
    const user: any = await getSession();
    if (!user) {
        throw new Error("You must be logged in to submit a review.");
    }

    if (rating < 1 || rating > 5) {
        throw new Error("Rating must be between 1 and 5 stars.");
    }

    // 1. Verify this user actually owns this specific Tenant record
    const tenantRecord = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { room: { include: { bookings: { where: { userId: user.id } } } } }
    });

    if (!tenantRecord) {
        throw new Error("Invalid tenant record.");
    }

    // Security check: We ensure this tenant record belongs to a room the user actually booked.
    // (In a perfect schema Tenant would have a direct userId, but we trace it through the room/bookings)
    const hasValidBooking = tenantRecord.room.bookings.length > 0;
    if (!hasValidBooking && user.role !== "ADMIN") {
        throw new Error("You are not authorized to leave a review for this tenancy.");
    }

    if (tenantRecord.propertyId !== propertyId) {
        throw new Error("Tenant record does not match this property.");
    }

    // 2. Wrap the Review creation and Property Avg Cache update in a Transaction
    return await prisma.$transaction(async (tx: any) => {
        // Create the review
        const review = await tx.review.create({
            data: {
                propertyId,
                tenantId,
                rating,
                comment,
                status: "PUBLISHED"
            }
        });

        // Recalculate Average
        const allReviews = await tx.review.findMany({
            where: { propertyId, status: "PUBLISHED" },
            select: { rating: true }
        });

        const reviewCount = allReviews.length;
        const totalScore = allReviews.reduce((sum: number, r: any) => sum + r.rating, 0);
        const averageRating = reviewCount > 0 ? (totalScore / reviewCount) : 0;

        // Update Property
        await tx.property.update({
            where: { id: propertyId },
            data: {
                averageRating: Number(averageRating.toFixed(1)),
                reviewCount
            }
        });

        // Audit Logging
        logAuditEvent({
            actorId: user.id,
            actorRole: user.role || 'USER',
            actorName: user.name || 'Student',
            actionType: 'CREATE',
            entityType: 'REVIEW' as any,
            entityId: review.id,
            description: `Tenant ${tenantId} left a ${rating}-star review for Property ${propertyId}`,
        });

        revalidateGlobalProperty(propertyId);
        return review;
    });
}

export async function getReviewsForProperty(propertyId: string) {
    return await prisma.review.findMany({
        where: { propertyId, status: "PUBLISHED" },
        include: {
            tenant: {
                select: { name: true, roomType: true } // Only expose safe public data
            }
        },
        orderBy: { createdAt: "desc" }
    });
}

export async function flagReview(reviewId: string, reason: string) {
    const user: any = await getSession();
    if (!user) throw new Error("Unauthorized");

    const review = await prisma.review.findUnique({
        where: { id: reviewId },
        include: { property: true }
    });

    if (!review) throw new Error("Review not found.");

    // Only property owner or admin can flag
    if (review.property.ownerId !== user.id && user.role !== "ADMIN") {
        throw new Error("You are not authorized to flag this review.");
    }

    const updated = await prisma.review.update({
        where: { id: reviewId },
        data: {
            status: "FLAGGED",
            adminNotes: `Flagged by ${user.role} (ID: ${user.id}). Reason: ${reason}`
        }
    });

    // Create a Ticket for the Admin team to review the flag
    await prisma.ticket.create({
        data: {
            displayId: `TKT-FLG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            userId: user.id,
            propertyId: review.propertyId,
            category: "OTHER",
            priority: "HIGH",
            targetTeam: "ADMIN",
            raisedByRole: user.role,
            description: `Review ID ${reviewId} was flagged for moderation. Reason: ${reason}`,
        }
    });

    revalidateGlobalProperty(review.propertyId);
    return updated;
}

export async function updateReviewStatus(reviewId: string, status: "PUBLISHED" | "HIDDEN") {
    const user: any = await getSession();
    if (user?.role !== "ADMIN") throw new Error("Reserved for Admins.");

    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new Error("Not found");

    return await prisma.$transaction(async (tx: any) => {
        const updated = await tx.review.update({
            where: { id: reviewId },
            data: { status, adminNotes: `Status forced to ${status} by Admin ${user.id}` }
        });

        // Recalculate Averages based on new Visibility
        const allPublished = await tx.review.findMany({
            where: { propertyId: review.propertyId, status: "PUBLISHED" },
            select: { rating: true }
        });

        const reviewCount = allPublished.length;
        const totalScore = allPublished.reduce((sum: number, r: any) => sum + r.rating, 0);
        const averageRating = reviewCount > 0 ? (totalScore / reviewCount) : 0;

        await tx.property.update({
            where: { id: review.propertyId },
            data: {
                averageRating: Number(averageRating.toFixed(1)),
                reviewCount
            }
        });

        revalidateGlobalProperty(review.propertyId); // If we build a distinct review tab
        return updated;
    });
}

// ADMIN ONLY
export async function getFlaggedReviews() {
    const user: any = await getSession();
    if (user?.role !== "ADMIN") throw new Error("Unauthorized");

    return prisma.review.findMany({
        where: {
            status: "FLAGGED" // Check the 'status' enum not a boolean
        },
        include: {
            property: { select: { name: true, city: true } },
            tenant: { select: { name: true, email: true } }
        },
        orderBy: { createdAt: "desc" }
    });
}
