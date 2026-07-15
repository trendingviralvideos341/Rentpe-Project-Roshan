'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function getOwnerActivityLog(cursor?: string) {
    try {
        const session = await getSession();
        if (!session) throw new Error('Unauthorized');

        const userId = (session as any).userId;
        const role = session.role;
        const PAGE_SIZE = 50;

        const cursorCondition = cursor ? { id: { lt: cursor } } : {};

        if (role === 'OWNER') {
            const staff = await prisma.user.findMany({
                where: { parentOwnerId: userId },
                select: { id: true }
            });
            const staffIds = staff.map((s: any) => s.id);

            const logs = await prisma.auditLog.findMany({
                where: {
                    actorId: { in: [userId, ...staffIds] },
                    ...cursorCondition
                },
                orderBy: { createdAt: 'desc' },
                take: PAGE_SIZE,
                include: {
                    actor: { select: { name: true, role: true, displayId: true, email: true } }
                }
            });
            return { data: logs, nextCursor: logs.length === PAGE_SIZE ? logs[logs.length - 1].id : null };
        } else if (role === 'STAFF') {
            const logs = await prisma.auditLog.findMany({
                where: { actorId: userId, ...cursorCondition },
                orderBy: { createdAt: 'desc' },
                take: PAGE_SIZE,
                include: {
                    actor: { select: { name: true, role: true, displayId: true, email: true } }
                }
            });
            return { data: logs, nextCursor: logs.length === PAGE_SIZE ? logs[logs.length - 1].id : null };
        }

        return { data: [], nextCursor: null };
    } catch (e) {
        console.error('getOwnerActivityLog Error:', e);
        return { data: [], nextCursor: null };
    }
}
