'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";

// NOTE: TeamMember model was DROPPED (July 2026 audit cleanup).
// Admin team management now uses the Employee model (admin_employees table).
// Field mapping: TeamMember.role → Employee.designation, TeamMember.permissions → Employee.permissions

export async function getTeamMembers() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
        throw new Error("Unauthorized");
    }

    return prisma.employee.findMany({
        orderBy: { joiningDate: 'desc' },
        select: {
            id: true,
            displayId: true,
            name: true,
            email: true,
            phone: true,
            designation: true,   // was "role" in TeamMember
            department: true,
            status: true,
            permissions: true,
            joiningDate: true,
        }
    });
}

export async function addTeamMember(data: { name: string, email: string, phone: string, role: string, permissions: string[] }) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
        throw new Error("Unauthorized");
    }

    const member = await prisma.employee.create({
        data: {
            displayId: `ADM-T${Math.floor(Math.random() * 9000) + 1000}`,
            name: data.name,
            email: data.email,
            phone: data.phone,
            designation: data.role,       // TeamMember.role → Employee.designation
            department: 'Administration', // default department for admin team members
            permissions: JSON.stringify(data.permissions),
            status: 'ACTIVE'
        }
    });

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'CREATE',
        entityType: 'TEAM_MEMBER',
        entityId: member.id,
        description: `${member.name} (${member.designation})`,
    });

    revalidatePath('/dashboard/admin/team');
    return member;
}

export async function updateTeamMemberStatus(id: string, status: 'ACTIVE' | 'REVOKED', reason: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
        throw new Error("Unauthorized");
    }

    const employeeStatus = status === 'REVOKED' ? 'INACTIVE' : 'ACTIVE';

    const member = await prisma.employee.update({
        where: { id },
        data: { status: employeeStatus }
    });

    await prisma.actionNote.create({
        data: {
            targetId: id,
            targetType: 'TEAM_MEMBER',
            action: status === 'REVOKED' ? 'REVOKED' : 'RESTORED',
            reason: reason,
            performedBy: (session as any).userId
        }
    });

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

    const member = await prisma.employee.update({
        where: { id },
        data: {
            designation: role,
            permissions: JSON.stringify(permissions)
        }
    });

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'TEAM_MEMBER',
        entityId: id,
        description: `Updated ${member.name}: designation=${role}, permissions=${permissions.join(', ')}`,
    });

    revalidatePath('/dashboard/admin/team');
    return member;
}
