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

    let { actorRole, actionType, entityType, search, page = 1, limit = 50 } = params;
    
    // Security: Prevent Pagination Exploits & DB Locking
    page = Math.max(1, Number(page) || 1);
    limit = Math.min(100, Math.max(1, Number(limit) || 50));
    if (search && search.length > 100) search = search.slice(0, 100);

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

export async function getSupportAuditLogs(params: { search: string; page?: number; limit?: number }) {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && (session.role as string) !== 'EMPLOYEE')) {
        throw new Error("Unauthorized");
    }

    let { search, page = 1, limit = 50 } = params;
    
    // Security: Prevent Pagination Exploits & DB Locking
    page = Math.max(1, Number(page) || 1);
    limit = Math.min(100, Math.max(1, Number(limit) || 50));
    if (search && search.length > 100) search = search.slice(0, 100);

    if (!search || search.length < 3) {
        return { logs: [], total: 0, pages: 0 };
    }

    const skip = (page - 1) * limit;

    const where: any = {
        OR: [
            { actorName: { contains: search, mode: 'insensitive' } },
            { entityName: { contains: search, mode: 'insensitive' } },
            { entityId: { contains: search, mode: 'insensitive' } },
            { actor: { email: { contains: search, mode: 'insensitive' } } }
        ],
        // Hide sensitive system actions
        actionType: { notIn: ['IMPERSONATION_START', 'IMPERSONATION_STOP', 'SYSTEM_SETTINGS_UPDATE', 'VIEW_AUDIT_DETAILS'] }
    };

    const [rawLogs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            include: {
                actor: {
                    select: { email: true, displayId: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.auditLog.count({ where })
    ]);

    // Strip sensitive fields
    const logs = rawLogs.map(log => ({
        id: log.id,
        createdAt: log.createdAt,
        actorName: log.actorName,
        actorRole: log.actorRole,
        actionType: log.actionType,
        entityType: log.entityType,
        entityName: log.entityName,
        description: log.description,
        previousValue: log.previousValue,
        newValue: log.newValue,
        actor: log.actor
        // Omitting ipAddress, userAgent, entityId
    }));

    return { logs, total, pages: Math.ceil(total / limit) };
}

export async function logAuditView(targetEntityId: string) {
    const session = await getSession();
    if (!session || !session.userId) return;
    
    // Security: Prevent Storage Exhaustion / Payload Size Attacks
    if (!targetEntityId || typeof targetEntityId !== 'string') return;
    const safeEntityId = targetEntityId.slice(0, 50); 
    
    await prisma.auditLog.create({
        data: {
            actorId: session.userId,
            actorName: session.name || 'Unknown',
            actorRole: session.role || 'USER',
            actionType: 'VIEW_AUDIT_DETAILS',
            entityType: 'AUDIT_LOG',
            entityId: safeEntityId,
            description: `Viewed detailed data diffs for audit log entry ${safeEntityId}`,
            ipAddress: 'Internal',
            userAgent: 'Internal System'
        }
    });
}
