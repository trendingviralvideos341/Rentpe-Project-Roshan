'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function getAuditLogs(params: {
    actorRole?: string;
    actionType?: string;
    entityType?: string;
    search?: string;
    page?: number;
    limit?: number;
}) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const { actorRole, actionType, entityType, search, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (actorRole && actorRole !== 'ALL') where.actorRole = actorRole;
    if (actionType && actionType !== 'ALL') {
        if (actionType === 'IMPERSONATION') {
            where.actionType = { in: ['IMPERSONATION_START', 'IMPERSONATION_STOP'] };
        } else {
            where.actionType = actionType;
        }
    }
    if (entityType && entityType !== 'ALL') where.entityType = entityType;
    if (search) {
        where.OR = [
            { actorName: { contains: search, mode: 'insensitive' } },
            { entityName: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { entityId: { contains: search, mode: 'insensitive' } },
        ];
    }

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            include: {
                actor: {
                    select: {
                        email: true,
                        displayId: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.auditLog.count({ where })
    ]);

    return { logs, total, pages: Math.ceil(total / limit) };
}
