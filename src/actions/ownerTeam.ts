'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { createNotification } from "@/actions/notifications";
import { logAuditEvent } from "@/lib/audit";

/**
 * Owner Team Management
 * Allows owners to create sub-accounts (STAFF) with controlled permissions.
 * Staff actions are linked to the parent owner via parentOwnerId.
 */

export async function getOwnerTeam() {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const ownerId = (session as any).userId;

    return (prisma.user as any).findMany({
        where: { parentOwnerId: ownerId, deletedAt: null },
        select: {
            id: true,
            displayId: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            staffPermissions: true,
            createdAt: true,
            lastLoginAt: true
        }
    });
}

export async function createStaffMember(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    permissions: string[]; // ["BOOKING_APPROVAL", "INQUIRY_RESPONSE", "VIEW_FINANCE"]
}) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const ownerId = (session as any).userId;

    // Check if user already exists
    const existing = await (prisma.user as any).findUnique({ where: { email: data.email } });
    if (existing) throw new Error("A user with this email already exists.");

    const passwordHash = await bcrypt.hash(data.password, 10);

    const staff = await (prisma.user as any).create({
        data: {
            displayId: `STF-${Math.floor(Math.random() * 900000) + 100000}`,
            email: data.email,
            passwordHash,
            name: data.name,
            phone: data.phone,
            role: 'OWNER', // They act as owners but with restricted view
            roles: 'OWNER,STAFF', 
            status: 'ACTIVE',
            parentOwnerId: ownerId,
            staffPermissions: JSON.stringify(data.permissions),
            isOwner: true,
        }
    });

    logAuditEvent({
        actorId: ownerId,
        actorRole: 'OWNER',
        actorName: 'Owner',
        actionType: 'CREATE',
        entityType: 'USER',
        entityId: staff.id,
        description: `Staff ${data.name} created by owner ${ownerId} with permissions: ${data.permissions.join(', ')}`,
    });

    revalidatePath('/dashboard/owner/team');
    return { success: true, staffId: staff.id };
}

export async function updateStaffMemberPermissions(staffId: string, permissions: string[]) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const ownerId = (session as any).userId;

    // Verify ownership
    const staff = await (prisma.user as any).findUnique({ where: { id: staffId } });
    if (!staff || staff.parentOwnerId !== ownerId) throw new Error("Staff member not found or unauthorized.");

    await (prisma.user as any).update({
        where: { id: staffId },
        data: { staffPermissions: JSON.stringify(permissions) }
    });

    logAuditEvent({
        actorId: ownerId,
        actorRole: 'OWNER',
        actorName: 'Owner',
        actionType: 'UPDATE',
        entityType: 'USER',
        entityId: staffId,
        description: `New permissions: ${permissions.join(', ')}`,
    });

    revalidatePath('/dashboard/owner/team');
    return { success: true };
}

export async function deleteStaffMember(staffId: string) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const ownerId = (session as any).userId;

    // Verify ownership
    const staff = await (prisma.user as any).findUnique({ where: { id: staffId } });
    if (!staff || staff.parentOwnerId !== ownerId) throw new Error("Staff member not found or unauthorized.");

    await (prisma.user as any).update({
        where: { id: staffId },
        data: { deletedAt: new Date(), status: 'REMOVED' }
    });

    logAuditEvent({
        actorId: ownerId,
        actorRole: 'OWNER',
        actorName: 'Owner',
        actionType: 'DELETE',
        entityType: 'USER',
        entityId: staffId,
        description: `Staff member ${staff.name} removed by owner`,
    });

    revalidatePath('/dashboard/owner/team');
    return { success: true };
}

/**
 * Middleware-like check for staff permissions
 * Used in other owner actions to restrict sub-account access.
 */
export async function checkStaffPermission(permission: 'BOOKING_APPROVAL' | 'INQUIRY_RESPONSE' | 'VIEW_FINANCE' | 'MANAGE_PROPERTY' | 'REQUEST_DEACTIVATION') {
    const session = await getSession();
    if (!session) return false;

    const user = await (prisma.user as any).findUnique({ where: { id: (session as any).userId } });
    if (!user) return false;

    // If it's the main owner, they have all permissions
    if (!user.parentOwnerId && user.role === 'OWNER') return true;

    // If it's an admin, they usually have bypass (different logic, but for owner-team actions, admins shouldn't be here)
    if (user.role === 'ADMIN') return false; 

    // If it's a staff member, check their perms
    if (user.parentOwnerId) {
        try {
            const perms = JSON.parse(user.staffPermissions || '[]');
            return perms.includes(permission);
        } catch (e) {
            return false;
        }
    }

    return false;
}

export async function requireStaffPermission(permission: 'BOOKING_APPROVAL' | 'INQUIRY_RESPONSE' | 'VIEW_FINANCE' | 'MANAGE_PROPERTY' | 'REQUEST_DEACTIVATION') {
    const hasPerm = await checkStaffPermission(permission);
    if (!hasPerm) throw new Error(`Permission Denied: Missing ${permission}`);
}
