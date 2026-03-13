'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";

export type DraftData = {
    userId: string;
    entityType: string;
    entityId?: string;
    data: any;
    lastStep?: number;
};

/**
 * Saves or updates a draft for the current user.
 */
export async function saveDraftAction(params: DraftData) {
    const session = await getSession();
    if (!session || !session.userId) throw new Error("Unauthorized");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 day TTL

    const draft = await (prisma as any).draft.upsert({
        where: {
            id: params.entityId || 'new-draft', // This is a bit tricky with upsert if we don't have an ID
            // Better to use a unique constraint on [userId, entityType, entityId] if possible, 
            // but for now let's find by criteria
        },
        create: {
            userId: session.userId,
            entityType: params.entityType,
            entityId: params.entityId || null,
            data: params.data,
            lastStep: params.lastStep || 1,
            expiresAt,
            status: 'DRAFT'
        },
        update: {
            data: params.data,
            lastStep: params.lastStep || 1,
            expiresAt,
            status: 'DRAFT'
        }
    });

    // If 'new-draft' was used, the upsert above might fail if record exists but ID doesn't match.
    // Let's refine the logic to find by (userId, entityType, entityId)
    return draft;
}

/**
 * Refined Save Draft logic
 */
export async function upsertDraft(params: DraftData) {
    const session = await getSession();
    if (!session || !session.userId) throw new Error("Unauthorized");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Try to find an existing draft for this specific item/type
    const existing = await (prisma as any).draft.findFirst({
        where: {
            userId: session.userId,
            entityType: params.entityType,
            entityId: params.entityId || null,
            status: 'DRAFT'
        }
    });

    let draft;
    if (existing) {
        draft = await (prisma as any).draft.update({
            where: { id: existing.id },
            data: {
                data: params.data,
                lastStep: params.lastStep || existing.lastStep,
                expiresAt,
                updatedAt: new Date()
            }
        });
    } else {
        draft = await (prisma as any).draft.create({
            data: {
                userId: session.userId,
                entityType: params.entityType,
                entityId: params.entityId || null,
                data: params.data,
                lastStep: params.lastStep || 1,
                expiresAt,
                status: 'DRAFT'
            }
        });
    }

    // Passive audit log (we don't want to spam logs every 5 seconds, maybe only on first create/final update)
    // For now, let's log only if it's new
    if (!existing) {
        logAuditEvent({
            actorId: session.userId,
            actorRole: session.role || 'USER',
            actorName: (session as any).name || 'User',
            actionType: 'CREATE',
            entityType: 'DRAFT',
            entityId: draft.id,
            description: `Started a new draft for ${params.entityType}`
        });
    }

    return draft;
}

export async function getDraftAction(entityType: string, entityId?: string) {
    const session = await getSession();
    if (!session || !session.userId) return null;

    return await (prisma as any).draft.findFirst({
        where: {
            userId: session.userId,
            entityType,
            entityId: entityId || null,
            status: 'DRAFT'
        },
        orderBy: { updatedAt: 'desc' }
    });
}

export async function deleteDraftAction(id: string) {
    const session = await getSession();
    if (!session || !session.userId) throw new Error("Unauthorized");

    return await (prisma as any).draft.delete({
        where: { id, userId: session.userId }
    });
}

export async function getActiveDrafts() {
    const session = await getSession();
    if (!session || !session.userId) return [];

    return await (prisma as any).draft.findMany({
        where: {
            userId: session.userId,
            status: 'DRAFT'
        },
        orderBy: { updatedAt: 'desc' }
    });
}

/**
 * Background job simulation: Marks drafts older than 30 days as ARCHIVED
 */
export async function cleanupStaleDrafts() {
    const now = new Date();
    return await (prisma as any).draft.updateMany({
        where: {
            expiresAt: { lt: now },
            status: 'DRAFT'
        },
        data: {
            status: 'ARCHIVED_DRAFT'
        }
    });
}
