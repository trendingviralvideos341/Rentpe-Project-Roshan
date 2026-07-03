'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Fetches the complete student profile including recent activity and document status.
 */
export async function getStudentProfile() {
    try {
        const session = await getSession();
        if (!session) throw new Error("Unauthorized");

        const userId = (session as any).userId as string;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                displayId: true,
                createdAt: true,
                status: true,
                occupationType: true,
                occupationDetail: true,
            } as any,
        });

        // Get KYC summary (last booking's documents)
        const lastBooking = await prisma.booking.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                documents: true
            }
        });

        // Calculate Real Verification Logic
        const docs = (lastBooking?.documents || []) as any[];
        const isKycVerified = docs.some(d => d.type === 'ID_PROOF' && d.status === 'VERIFIED') || 
                             lastBooking?.status === 'KYC_VERIFIED' || 
                             lastBooking?.status === 'BOOKING_CONFIRMED' || 
                             lastBooking?.status === 'CHECKED_IN';
        
        const isKycPending = docs.some(d => d.status === 'PENDING') || 
                            lastBooking?.status === 'KYC_PENDING';
        
        const isKycRejected = docs.some(d => d.status === 'REJECTED') || 
                             lastBooking?.status === 'KYC_FAILED';

        let realKycStatus = 'NOT_STARTED';
        if (isKycVerified) realKycStatus = 'VERIFIED';
        else if (isKycRejected) realKycStatus = 'REJECTED';
        else if (isKycPending) realKycStatus = 'UNDER_REVIEW';
        else if (docs.length > 0) realKycStatus = 'PENDING';

        let accountHealth = 'ACTION_REQUIRED';
        if (isKycVerified && lastBooking?.status === 'CHECKED_IN') accountHealth = 'EXCELLENT';
        else if (isKycVerified || realKycStatus === 'UNDER_REVIEW') accountHealth = 'GOOD';

        let occupancyStatus = 'GUEST';
        if (lastBooking?.status === 'CHECKED_IN' || lastBooking?.status === 'BOOKING_CONFIRMED') occupancyStatus = 'RESIDENT';
        else if (lastBooking?.status && ['APPROVED', 'PAID', 'TOKEN_PAID', 'ROOM_RESERVED'].includes(lastBooking.status)) occupancyStatus = 'BOOKED';

        // Stable Pseudo-Hash for ID (UserId + CreatedAt)
        const hashSeed = `${userId}-${user?.createdAt}`;
        const realAuthenticityHash = Buffer.from(hashSeed).toString('hex').substring(0, 10).toUpperCase();

        return {
            ...(user as any),
            name: user?.name || (session as any).name || "Resident",
            email: user?.email || (session as any).email || null,
            kycStatus: realKycStatus,
            accountHealth,
            occupationType: occupancyStatus,
            realAuthenticityHash,
            documents: docs,
            lastBookingId: lastBooking?.id || null,

        };
    } catch (e) {
        console.error("getStudentProfile Error:", e);
        return null;
    }
}

/**
 * Updates student profile details. Used for 'User Data Auto-fill' consistency.
 */
export async function updateStudentProfile(data: { occupationType?: string; occupationDetail?: string }) {
    try {
        const session = await getSession();
        if (!session) throw new Error("Unauthorized");

        const userId = (session as any).userId as string;

        const updated = await prisma.user.update({
            where: { id: userId },
            data: {
                occupationType: data.occupationType,
                occupationDetail: data.occupationDetail,
            }
        });

        revalidatePath('/dashboard/student');
        return { success: true, user: updated };
    } catch (e) {
        console.error("updateStudentProfile Error:", e);
        return { success: false, error: "Failed to update profile" };
    }
}
