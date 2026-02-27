'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function getOwnerActivityLog() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

        const userId = (session as any).userId;

        return await prisma.auditLog.findMany({
            where: { performedBy: userId },
            orderBy: { timestamp: 'desc' },
            take: 200
        });
    } catch (e) {
        console.error("getOwnerActivityLog Error:", e);
        return [];
    }
}
