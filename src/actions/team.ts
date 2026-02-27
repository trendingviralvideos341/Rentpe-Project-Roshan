'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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
    await prisma.auditLog.create({
        data: {
            action: 'TEAM_MEMBER_ADDED',
            targetId: member.id,
            targetType: 'TEAM_MEMBER',
            details: `${member.name} (${member.role})`,
            performedBy: (session as any).userId
        }
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
    await prisma.auditLog.create({
        data: {
            action: status === 'REVOKED' ? 'TEAM_ACCESS_REVOKED' : 'TEAM_ACCESS_RESTORED',
            targetId: id,
            targetType: 'TEAM_MEMBER',
            details: reason,
            performedBy: (session as any).userId
        }
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
    await prisma.auditLog.create({
        data: {
            action: 'TEAM_PERMISSIONS_UPDATED',
            targetId: id,
            targetType: 'TEAM_MEMBER',
            details: `Updated ${member.name}: role=${role}, permissions=${permissions.join(', ')}`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/admin/team');
    return member;
}
