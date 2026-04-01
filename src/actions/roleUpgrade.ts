'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// ─── 1. Student requests Owner role upgrade ───────────────────────────────────
export async function requestOwnerUpgrade(
    reason: string,
    propertyType: string = 'PG',
    estimatedRooms: number = 1
) {
    const session = await getSession();
    if (!session?.userId) throw new Error("Unauthorized");

    const userId = session.userId as string;

    // Check user doesn't already have OWNER role
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { roles: true, name: true, email: true, displayId: true }
    });

    if (!user) throw new Error("User not found");

    if (user.roles.includes('OWNER')) {
        return { error: "You already have Owner access." };
    }

    // Check for existing PENDING request
    const existingRequest = await (prisma as any).roleUpgradeRequest.findFirst({
        where: { userId, status: 'PENDING' }
    });

    if (existingRequest) {
        return { error: "You already have a pending upgrade request. Please wait for Admin review." };
    }

    // Create upgrade request
    const upgradeRequest = await (prisma as any).roleUpgradeRequest.create({
        data: {
            userId,
            requestedRole: 'OWNER',
            status: 'PENDING',
            reason: reason.trim(),
            propertyType,
            estimatedRooms,
        }
    });

    // Notify all ADMIN users
    const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', status: 'ACTIVE' },
        select: { id: true }
    });

    await Promise.all(admins.map(admin =>
        prisma.notification.create({
            data: {
                userId: admin.id,
                type: 'ROLE_UPGRADE_REQUEST',
                category: 'ADMIN',
                message: `🏠 New Owner Upgrade Request from ${user.name || user.email} (${user.displayId || 'N/A'}). Review and approve to let them list properties on RentPe.`,
                targetRole: 'ADMIN',
                isPersistent: true,
            }
        })
    ));

    // Audit log
    await logAuditEvent({
        actorId: userId,
        actorRole: 'USER',
        actorName: user.name || 'User',
        actionType: 'CREATE',
        entityType: 'ROLE_UPGRADE_REQUEST',
        entityId: upgradeRequest.id,
        description: `User requested Owner role upgrade. Property Type: ${propertyType}, Estimated Rooms: ${estimatedRooms}.`,
    });

    revalidatePath('/dashboard/student');
    return { success: true, requestId: upgradeRequest.id };
}

// ─── 2. Admin approves or rejects upgrade ─────────────────────────────────────
export async function processRoleUpgradeRequest(
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    adminNote?: string
) {
    const session = await getSession();
    if (!session?.userId) throw new Error("Unauthorized");

    const adminId = session.userId as string;

    // Verify Admin role
    const adminUser = await prisma.user.findUnique({
        where: { id: adminId },
        select: { roles: true, role: true, name: true }
    });

    const isAdmin = adminUser?.roles.includes('ADMIN') || adminUser?.role === 'ADMIN';
    if (!isAdmin) throw new Error("Unauthorized: Admin access required");

    // Fetch the request
    const request = await (prisma as any).roleUpgradeRequest.findUnique({
        where: { id: requestId },
        include: { user: { select: { id: true, name: true, email: true, roles: true, isOwner: true } } }
    });

    if (!request) throw new Error("Request not found");
    if (request.status !== 'PENDING') return { error: "Request has already been processed." };

    const targetUser = request.user;
    const now = new Date();

    if (decision === 'APPROVED') {
        // Add OWNER to user.roles array and update flags
        const updatedRoles = Array.from(new Set([...targetUser.roles, 'OWNER']));
        await prisma.user.update({
            where: { id: targetUser.id },
            data: {
                roles: updatedRoles,
                isOwner: true,
                // Keep primaryRole/role as USER until they explicitly switch
            }
        });

        // Update request status
        await (prisma as any).roleUpgradeRequest.update({
            where: { id: requestId },
            data: {
                status: 'APPROVED',
                adminNote: adminNote || 'Approved by Admin.',
                reviewedBy: adminId,
                reviewedAt: now,
            }
        });

        // Notify the user
        await prisma.notification.create({
            data: {
                userId: targetUser.id,
                type: 'ROLE_UPGRADE_APPROVED',
                category: 'ACCOUNT',
                message: `🎉 Congratulations! You can now list your PG on RentPe. Switch to Owner Dashboard to get started. Use the role switcher in the top navigation.`,
                targetRole: 'USER',
                isPersistent: true,
            }
        });

        // Audit log
        await logAuditEvent({
            actorId: adminId,
            actorRole: 'ADMIN',
            actorName: adminUser?.name || 'Admin',
            actionType: 'UPDATE',
            entityType: 'USER',
            entityId: targetUser.id,
            description: `Admin approved Owner role upgrade for user ${targetUser.name || targetUser.email}. Roles updated to: ${updatedRoles.join(', ')}.`,
        });
    } else {
        // REJECTED
        await (prisma as any).roleUpgradeRequest.update({
            where: { id: requestId },
            data: {
                status: 'REJECTED',
                adminNote: adminNote || 'Not approved at this time.',
                reviewedBy: adminId,
                reviewedAt: now,
            }
        });

        // Notify the user
        await prisma.notification.create({
            data: {
                userId: targetUser.id,
                type: 'ROLE_UPGRADE_REJECTED',
                category: 'ACCOUNT',
                message: `Your Owner upgrade request was not approved. Reason: ${adminNote || 'Not specified'}. You may reapply after 7 days.`,
                targetRole: 'USER',
                isPersistent: true,
            }
        });

        // Audit log
        await logAuditEvent({
            actorId: adminId,
            actorRole: 'ADMIN',
            actorName: adminUser?.name || 'Admin',
            actionType: 'UPDATE',
            entityType: 'ROLE_UPGRADE_REQUEST',
            entityId: requestId,
            description: `Admin rejected Owner role upgrade for user ${targetUser.name || targetUser.email}. Reason: ${adminNote || 'Not specified'}.`,
        });
    }

    revalidatePath('/dashboard/admin/role-upgrades');
    revalidatePath('/dashboard/student');
    return { success: true, decision };
}

// ─── 3. Switch active dashboard context ───────────────────────────────────────
export async function getUserRoles() {
    const session = await getSession();
    if (!session?.userId) throw new Error("Unauthorized");

    const user = await prisma.user.findUnique({
        where: { id: session.userId as string },
        select: { roles: true, primaryRole: true, role: true }
    });

    if (!user) throw new Error("User not found");

    return {
        roles: user.roles,
        primaryRole: user.primaryRole || user.role,
    };
}

// ─── 4. Get role upgrade status for current user ──────────────────────────────
export async function getMyUpgradeRequest() {
    const session = await getSession();
    if (!session?.userId) return null;

    const request = await (prisma as any).roleUpgradeRequest.findFirst({
        where: { userId: session.userId as string },
        orderBy: { createdAt: 'desc' }
    });

    return request;
}

// ─── 5. Admin: Get all upgrade requests ───────────────────────────────────────
export async function getAllUpgradeRequests() {
    const session = await getSession();
    if (!session?.userId) throw new Error("Unauthorized");

    const adminUser = await prisma.user.findUnique({
        where: { id: session.userId as string },
        select: { roles: true, role: true }
    });

    const isAdmin = adminUser?.roles.includes('ADMIN') || adminUser?.role === 'ADMIN';
    if (!isAdmin) throw new Error("Unauthorized");

    return (prisma as any).roleUpgradeRequest.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    displayId: true,
                    status: true,
                }
            }
        }
    });
}

// ─── 6. Admin: Get pending requests count ─────────────────────────────────────
export async function getPendingUpgradeCount(): Promise<number> {
    const session = await getSession();
    if (!session?.userId) return 0;

    const adminUser = await prisma.user.findUnique({
        where: { id: session.userId as string },
        select: { roles: true, role: true }
    });

    const isAdmin = adminUser?.roles.includes('ADMIN') || adminUser?.role === 'ADMIN';
    if (!isAdmin) return 0;

    return (prisma as any).roleUpgradeRequest.count({
        where: { status: 'PENDING' }
    });
}
