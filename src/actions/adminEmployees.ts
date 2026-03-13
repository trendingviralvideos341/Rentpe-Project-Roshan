'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { generateSequentialId } from "@/lib/ids";
import bcrypt from "bcryptjs";

/**
 * Super Admin check helper
 */
async function ensureSuperAdmin() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
         // Even if role is ADMIN, check if they are actually a Super Admin or have permission
         const user = await prisma.user.findUnique({
             where: { id: session?.userId },
             select: { adminRole: true }
         });
         
         if (user?.adminRole !== 'SUPER_ADMIN') {
             throw new Error("Unauthorized: Only Super Admin can manage admin employees");
         }
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

export async function createAdminEmployee(data: {
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
            const passwordHash = await bcrypt.hash("RentPe@123", 10); // Default pass for new staff
            user = await tx.user.create({
                data: {
                    email: data.email,
                    name: data.name,
                    phone: data.phone,
                    role: 'ADMIN',
                    roles: 'USER,ADMIN',
                    isAdmin: true,
                    passwordHash,
                    status: 'ACTIVE'
                }
            });
        } else {
            // Update role to ADMIN if it was something else
            await tx.user.update({
                where: { id: user.id },
                data: { 
                    isAdmin: true,
                    role: 'ADMIN',
                    roles: user.roles.includes('ADMIN') ? user.roles : user.roles + ',ADMIN'
                }
            });
        }

        // 2. Generate ID
        const displayId = await generateSequentialId('ADMIN_EMPLOYEE');

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

        return employee;
    });
}

export async function updateAdminEmployee(id: string, data: {
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

    logAuditEvent({
        actorId: session.userId,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Super Admin',
        actionType: 'UPDATE',
        entityType: 'USER',
        entityId: id,
        description: `Updated admin employee ${employee.name}. New status: ${employee.status}`
    });

    revalidatePath('/dashboard/admin/staff');
    return employee;
}

export async function deleteAdminEmployee(id: string) {
    const session = await ensureSuperAdmin();
    
    // We don't delete, we deactivate/suspend for audit integrity
    return await updateAdminEmployee(id, { status: 'SUSPENDED' });
}
