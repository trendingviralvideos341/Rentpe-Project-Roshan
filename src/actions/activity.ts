'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function getOwnerActivityLog() {
    try {
        const session = await getSession();
        if (!session) throw new Error("Unauthorized");

        const userId = (session as any).userId;
        const role = session.role;

        if (role === 'OWNER') {
            // Fetch staff User IDs to include their actions in the owner's log
            const staff = await prisma.user.findMany({
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
        } else if (role === 'STAFF') {
            // Staff sees only their own actions
            return await prisma.auditLog.findMany({
                where: { actorId: userId },
                orderBy: { createdAt: 'desc' },
                take: 200,
                include: {
                    actor: {
                        select: { name: true, role: true, displayId: true }
                    }
                }
            });
        }

        return [];
    } catch (e) {
        console.error("getOwnerActivityLog Error:", e);
        return [];
    }
}
