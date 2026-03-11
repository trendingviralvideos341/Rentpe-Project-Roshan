'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function getOwnerActivityLog() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

        const userId = (session as any).userId;

        // Fetch staff User IDs to include their actions in the owner's log
        const staff = await (prisma.user as any).findMany({
            where: { parentOwnerId: userId },
            select: { id: true }
        });
        const staffIds = staff.map((s: any) => s.id);

        return await prisma.auditLog.findMany({
            where: {
                actorId: { in: [userId, ...staffIds] }
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
            include: {
                actor: {
                    select: { name: true, role: true, displayId: true }
                }
            }
        });
    } catch (e) {
        console.error("getOwnerActivityLog Error:", e);
        return [];
    }
}
