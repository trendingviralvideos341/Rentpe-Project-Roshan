'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

/**
 * Admin sub-roles and their permissions
 * SUPER_ADMIN → all permissions
 * OPERATIONS  → bookings, properties, disputes, payouts
 * SUPPORT     → view-only bookings, user assistance
 * MODERATION  → review listings, flag fraud
 * COMPLIANCE  → KYC verification, documents
 */
export const ADMIN_ROLE_PERMISSIONS: Record<string, string[]> = {
    SUPER_ADMIN: [
        'MANAGE_ADMINS', 'MANAGE_SETTINGS',
        'CANCEL_BOOKING', 'OVERRIDE_BOOKING',
        'SUSPEND_PROPERTY', 'ARCHIVE_PROPERTY', 'APPROVE_PROPERTY',
        'VIEW_KYC', 'VERIFY_KYC', 'REJECT_KYC',
        'RESOLVE_DISPUTE', 'CLOSE_DISPUTE',
        'MANAGE_PAYOUTS', 'APPROVE_PAYOUT',
        'VIEW_FRAUD_ALERTS', 'RESOLVE_FRAUD',
        'VIEW_AUDIT_LOGS', 'VIEW_SYSTEM_EVENTS',
        'BAN_USER', 'SUSPEND_USER',
        'VIEW_REPORTS', 'MANAGE_COMMISSION',
        'REASSIGN_BED', 'APPROVE_OWNER', 'REJECT_OWNER',
        // Read-level permissions (SUPER_ADMIN has everything)
        'VIEW_PROPERTIES', 'VIEW_USERS', 'VIEW_BOOKINGS', 'VIEW_DISPUTES',
    ],
    OPERATIONS: [
        'CANCEL_BOOKING', 'OVERRIDE_BOOKING',
        'SUSPEND_PROPERTY', 'APPROVE_PROPERTY',
        'RESOLVE_DISPUTE',
        'MANAGE_PAYOUTS', 'APPROVE_PAYOUT',
        'VIEW_FRAUD_ALERTS',
        'VIEW_AUDIT_LOGS',
        'APPROVE_OWNER', 'REJECT_OWNER',
        'REASSIGN_BED',
        // Operations can read all data to do their job
        'VIEW_PROPERTIES', 'VIEW_USERS', 'VIEW_BOOKINGS', 'VIEW_REPORTS',
    ],
    SUPPORT: [
        'VIEW_BOOKINGS', 'VIEW_USERS', 'VIEW_PROPERTIES',
        'VIEW_DISPUTES', 'VIEW_FRAUD_ALERTS',
        'VIEW_AUDIT_LOGS',
    ],
    MODERATION: [
        'SUSPEND_PROPERTY', 'APPROVE_PROPERTY', 'ARCHIVE_PROPERTY',
        'VIEW_FRAUD_ALERTS', 'RESOLVE_FRAUD',
        'VIEW_AUDIT_LOGS',
        'BAN_USER',
        // Moderation needs to view content to moderate it
        'VIEW_PROPERTIES', 'VIEW_USERS', 'VIEW_REPORTS',
    ],
    COMPLIANCE: [
        'VIEW_KYC', 'VERIFY_KYC', 'REJECT_KYC',
        'APPROVE_OWNER', 'REJECT_OWNER',
        'VIEW_AUDIT_LOGS',
        'VIEW_USERS',
        // Compliance needs to see properties for KYC verification
        'VIEW_PROPERTIES', 'VIEW_BOOKINGS',
    ],
};

/**
 * Check if the current admin session has a specific permission
 * Also checks AdminPermission overrides in DB
 */
export async function hasPermission(permission: string): Promise<boolean> {
    const session = await getSession();
    if (!session) return false;
    if (session.role !== 'ADMIN') return false;

    const adminRole = (session as any).adminRole as string | undefined;
    if (!adminRole) return false;

    // Super admin always has all permissions
    if (adminRole === 'SUPER_ADMIN') return true;

    // Check role defaults
    const rolePerms = ADMIN_ROLE_PERMISSIONS[adminRole] || [];
    if (rolePerms.includes(permission)) return true;

    // Check DB overrides
    const override = await (prisma as any).adminPermission.findFirst({
        where: { adminId: (session as any).userId, permission }
    });
    return override?.granted === true;
}

/**
 * Enforce permission — throws if missing
 */
export async function requirePermission(permission: string) {
    const ok = await hasPermission(permission);
    if (!ok) {
        throw new Error(`Access denied. Your admin role does not have the '${permission}' permission.`);
    }
}

/**
 * Get all admins with their sub-roles (Super Admin only)
 */
export async function getAdminTeam() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_ADMINS');

    return prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: {
            id: true, name: true, email: true, displayId: true,
            adminRole: true, status: true, lastLoginAt: true, lastLoginIp: true, createdAt: true
        } as any
    });
}

/**
 * Assign admin sub-role (Super Admin only)
 */
export async function assignAdminRole(targetUserId: string, adminRole: string, reason?: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_ADMINS');

    const validRoles = ['SUPER_ADMIN', 'OPERATIONS', 'SUPPORT', 'MODERATION', 'COMPLIANCE'];
    if (!validRoles.includes(adminRole)) throw new Error("Invalid admin role");

    await (prisma as any).user.update({
        where: { id: targetUserId },
        data: { adminRole, role: 'ADMIN', isAdmin: true }
    });

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'USER',
        entityId: targetUserId,
        description: `Admin role '${adminRole}' assigned. Reason: ${reason || 'N/A'}`,
    });

    return { success: true };
}

/**
 * Grant or revoke specific permission override for an admin
 */
export async function setAdminPermissionOverride(adminId: string, permission: string, granted: boolean, reason: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('MANAGE_ADMINS');

    const existing = await (prisma as any).adminPermission.findFirst({ where: { adminId, permission } });

    if (existing) {
        await (prisma as any).adminPermission.update({ where: { id: existing.id }, data: { granted, reason } });
    } else {
        await (prisma as any).adminPermission.create({
            data: { adminId, permission, granted, grantedBy: (session as any).userId, reason }
        });
    }

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: granted ? 'APPROVE' : 'REJECT',
        entityType: 'USER',
        entityId: adminId,
        description: `Permission '${permission}' ${granted ? 'granted' : 'revoked'}. Reason: ${reason}`,
    });

    return { success: true };
}

/**
 * Get permission matrix for an admin user
 */
export async function getAdminPermissions(adminId: string) {
    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) throw new Error("Admin not found");

    const adminRole = (admin as any).adminRole as string;
    const rolePerms = ADMIN_ROLE_PERMISSIONS[adminRole] || [];
    const overrides = await (prisma as any).adminPermission.findMany({ where: { adminId } });

    return {
        adminRole,
        rolePermissions: rolePerms,
        overrides,
        effectivePermissions: [
            ...rolePerms.filter((p: string) => !overrides.find((o: any) => o.permission === p && !o.granted)),
            ...overrides.filter((o: any) => o.granted && !rolePerms.includes(o.permission)).map((o: any) => o.permission)
        ]
    };
}
