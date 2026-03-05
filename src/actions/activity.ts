'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function getOwnerActivityLog() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

        const userId = (session as any).userId;

        // Fetch staff display IDs to include their actions in the owner's log
        const staff = await prisma.ownerStaff.findMany({
            where: { ownerId: userId },
            select: { displayId: true }
        });
        const staffIds = staff.map(s => s.displayId);

        return await prisma.auditLog.findMany({
            where: {
                performedBy: { in: [userId, ...staffIds] }
            },
            orderBy: { timestamp: 'desc' },
            take: 200,
            include: {
                performer: {
                    select: { name: true, role: true, displayId: true }
                }
            }
        });
    } catch (e) {
        console.error("getOwnerActivityLog Error:", e);
        return [];
    }
}
