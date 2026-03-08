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
            }
        });

        // Get KYC summary (last booking's documents)
        const lastBooking = await prisma.booking.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                documents: true
            }
        });

        return {
            ...user,
            name: user?.name || (session as any).name || "Verified Resident",
            email: user?.email || (session as any).email || null,
            kycStatus: lastBooking?.status.startsWith('KYC') ? lastBooking.status : (lastBooking?.agreementSigned ? 'VERIFIED' : 'PENDING'),
            documents: lastBooking?.documents || [],
            lastBookingId: lastBooking?.id || null
        };
    } catch (e) {
        console.error("getStudentProfile Error:", e);
        return null;
    }
}

/**
 * Updates student profile details. Used for 'User Data Auto-fill' consistency.
 */
export async function updateStudentProfile(data: { name?: string; phone?: string; occupationType?: string; occupationDetail?: string }) {
    try {
        const session = await getSession();
        if (!session) throw new Error("Unauthorized");

        const userId = (session as any).userId as string;

        const updated = await prisma.user.update({
            where: { id: userId },
            data: {
                name: data.name,
                phone: data.phone,
                occupationType: data.occupationType,
                occupationDetail: data.occupationDetail,
            }
        });

        // If user changed their name/phone, update their most recent PENDING/APPROVED booking too
        // to ensure the 'Auto-fill' requirement is met even if they change it mid-onboarding.
        await prisma.booking.updateMany({
            where: { 
                userId,
                status: { in: ['PENDING_APPROVAL', 'APPROVED_PENDING_TOKEN', 'KYC_PENDING', 'APPROVED_KYC_PENDING'] }
            },
            data: {
                guestName: data.name,
                guestPhone: data.phone
            }
        });

        revalidatePath('/dashboard/student');
        return { success: true, user: updated };
    } catch (e) {
        console.error("updateStudentProfile Error:", e);
        return { success: false, error: "Failed to update profile" };
    }
}
