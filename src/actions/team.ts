'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";

export async function getTeamMembers() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
        throw new Error("Unauthorized");
    }

    return prisma.teamMember.findMany({
        orderBy: { addedOn: 'desc' }
    });
}

export async function addTeamMember(data: { name: string, email: string, phone: string, role: string, permissions: string[] }) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
        throw new Error("Unauthorized");
    }

    const member = await prisma.teamMember.create({
        data: {
            displayId: `ADM-T${Math.floor(Math.random() * 9000) + 1000}`,
            name: data.name,
            email: data.email,
            phone: data.phone,
            role: data.role,
            permissions: JSON.stringify(data.permissions),
            status: 'ACTIVE'
        }
    });

    // Logging
    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'CREATE',
        entityType: 'TEAM_MEMBER',
        entityId: member.id,
        description: `${member.name} (${member.role})`,
    });

    revalidatePath('/dashboard/admin/team');
    return member;
}

export async function updateTeamMemberStatus(id: string, status: 'ACTIVE' | 'REVOKED', reason: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
        throw new Error("Unauthorized");
    }

    const member = await prisma.teamMember.update({
        where: { id },
        data: { status }
    });

    // Persistent Action Note
    await prisma.actionNote.create({
        data: {
            targetId: id,
            targetType: 'TEAM_MEMBER',
            action: status === 'REVOKED' ? 'REVOKED' : 'RESTORED',
            reason: reason,
            performedBy: (session as any).userId
        }
    });

    // Audit Log
    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: status === 'REVOKED' ? 'REJECT' : 'APPROVE',
        entityType: 'TEAM_MEMBER',
        entityId: id,
        description: reason,
    });

    revalidatePath('/dashboard/admin/team');
    return member;
}

export async function updateTeamMemberPermissions(id: string, permissions: string[], role: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
        throw new Error("Unauthorized");
    }

    const member = await prisma.teamMember.update({
        where: { id },
        data: {
            permissions: JSON.stringify(permissions),
            role: role
        }
    });

    // Audit Log
    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'TEAM_MEMBER',
        entityId: id,
        description: `Updated ${member.name}: role=${role}, permissions=${permissions.join(', ')}`,
    });

    revalidatePath('/dashboard/admin/team');
    return member;
}
