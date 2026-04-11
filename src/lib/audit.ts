'use server';

import prisma from "@/lib/prisma";
import { headers } from "next/headers";

export type AuditLogParams = {
    actorId: string;
    actorRole: string;
    actorName: string;
    actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'LOGIN' | 'LOGOUT' | 'BLOCK' | 'SUSPEND' | 'EXPORT' | 'OVERRIDE' | 'ESCALATE' | 'VIEW' | string;
    entityType: 'USER' | 'OWNER' | 'PROPERTY' | 'ROOM' | 'BED' | 'BOOKING' | 'PAYMENT' | 'KYC' | 'TENANT' | 'ADMIN' | string;
    entityId: string;
    entityName?: string;
    description: string;
    previousValue?: any;
    newValue?: any;
};

/**
 * Reusable server-side utility for logging audit events.
 * Captures IP address and User Agent automatically from headers.
 * Logs are written asynchronously to avoid blocking the main request.
 */
export async function logAuditEvent(params: AuditLogParams) {
    try {
        const headersList = await headers();
        const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
        const userAgent = headersList.get('user-agent') || 'unknown';

        // We don't await this to keep the application responsive
        prisma.auditLog.create({
            data: {
                actorId: params.actorId,
                actorRole: params.actorRole,
                actorName: params.actorName,
                actionType: params.actionType,
                entityType: params.entityType,
                entityId: params.entityId,
                entityName: params.entityName || null,
                description: params.description,
                previousValue: params.previousValue ? JSON.parse(JSON.stringify(params.previousValue)) : null,
                newValue: params.newValue ? JSON.parse(JSON.stringify(params.newValue)) : null,
                ipAddress,
                userAgent,
            }
        }).catch(err => {
            console.error("Failed to write audit log:", err);
        });

    } catch (error) {
        console.error("Audit log captured data error:", error);
    }
}
