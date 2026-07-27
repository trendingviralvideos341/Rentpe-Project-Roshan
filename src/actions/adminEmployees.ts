'use server';
import { withSafeAction } from "@/lib/safe-action";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidateAdminDashboard } from "@/lib/cache";
import { logAuditEvent } from "@/lib/audit";
import { generateSequentialId } from "@/lib/ids";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/**
 * Super Admin check helper
 */
async function ensureSuperAdmin() {
    const session = await getSession();
    if (!session || !session.userId) {
        throw new Error("Unauthorized: No active session");
    }

    if (session.role !== 'ADMIN') {
        throw new Error("Unauthorized: Must be an ADMIN");
    }
    
    const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { adminRole: true }
    });
    
    if (user?.adminRole !== 'SUPER_ADMIN') {
        throw new Error("Unauthorized: Only Super Admin can manage admin employees");
    }
    
    return session;
}

export async function getAdminEmployees() {
    await ensureSuperAdmin();
    
    return await prisma.adminEmployee.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            user: {
                select: {
                    lastLoginAt: true,
                    status: true
                }
            }
        }
    });
}

async function _createAdminEmployee(data: {
    name: string;
    email: string;
    phone: string;
    department: string;
    role: string;
    permissions: string[];
}) {
    const session = await ensureSuperAdmin();

    return await prisma.$transaction(async (tx) => {
        // 1. Create User account if not exists
        let user = await tx.user.findUnique({ where: { email: data.email } });
        
        if (!user) {
            // SECURITY: Generate a cryptographically random one-time temporary password.
            // This must be changed on first login. Never use a hardcoded default password.
            const tempPassword = `RP-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
            const passwordHash = await bcrypt.hash(tempPassword, 12);
            user = await tx.user.create({
                data: {
                    email: data.email,
                    name: data.name,
                    phone: data.phone,
                    role: 'ADMIN',
                    roles: ['USER', 'ADMIN'],
                    isAdmin: true,
                    passwordHash,
                    status: 'ACTIVE',
                    mustChangePassword: true, // Forces password reset on first login
                    tempPasswordPlain: tempPassword, // Stored briefly so Super Admin can communicate it; cleared on first login
                } as any
            });
        } else {
            // Update role to ADMIN if it was something else
            const currentRoles = Array.isArray(user.roles) ? user.roles : (user.roles as any as string).split(',').map((r: string) => r.trim());
            const updatedRoles = Array.from(new Set([...currentRoles, 'ADMIN']));
            await tx.user.update({
                where: { id: user.id },
                data: { 
                    isAdmin: true,
                    role: 'ADMIN',
                    roles: updatedRoles
                }
            });
        }

        // 2. Generate ID
        const displayId = await generateSequentialId('EMPLOYEE');

        // Update User with the staff displayId for consistent logging
        await tx.user.update({
            where: { id: user.id },
            data: { displayId }
        });

        // 3. Create AdminEmployee record
        const employee = await tx.adminEmployee.create({
            data: {
                displayId,
                userId: user.id,
                name: data.name,
                email: data.email,
                phone: data.phone,
                department: data.department,
                role: data.role,
                permissions: JSON.stringify(data.permissions),
                status: 'ACTIVE'
            }
        });

        // 4. Audit Log
        if (session && session.userId) {
            await tx.auditLog.create({
                data: {
                    actorId: session.userId,
                    actorRole: 'ADMIN',
                    actorName: session.name || 'Super Admin',
                    actionType: 'CREATE',
                    entityType: 'USER',
                    entityId: employee.id,
                    description: `Created admin employee ${data.name} (${displayId}) in department ${data.department}`
                }
            });
        }

        return employee;
    });
}

async function _updateAdminEmployee(id: string, data: {
    department?: string;
    role?: string;
    permissions?: string[];
    status?: string;
}) {
    const session = await ensureSuperAdmin();

    const employee = await prisma.adminEmployee.update({
        where: { id },
        data: {
            ...data,
            permissions: data.permissions ? JSON.stringify(data.permissions) : undefined
        }
    });

    // If status changed to SUSPENDED, we should also track that in the user model
    if (data.status && employee.userId) {
        await prisma.user.update({
            where: { id: employee.userId },
            data: { status: data.status === 'ACTIVE' ? 'ACTIVE' : 'BANNED' }
        });
    }

    if (session && session.userId) {
        logAuditEvent({
            actorId: session.userId,
            actorRole: 'ADMIN',
            actorName: session.name || 'Super Admin',
            actionType: 'UPDATE',
            entityType: 'USER',
            entityId: id,
            description: `Updated admin employee ${employee.name}. New status: ${employee.status}`
        });
    }

     revalidateAdminDashboard();
    return employee;
}

async function _deleteAdminEmployee(id: string) {
    const session = await ensureSuperAdmin();
    
    // We don't delete, we deactivate/suspend for audit integrity
    return await updateAdminEmployee(id, { status: 'SUSPENDED' });
}


export const createAdminEmployee = withSafeAction(_createAdminEmployee);
export const updateAdminEmployee = withSafeAction(_updateAdminEmployee);
export const deleteAdminEmployee = withSafeAction(_deleteAdminEmployee);
