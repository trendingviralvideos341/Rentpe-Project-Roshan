'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { generateSequentialId } from "@/lib/ids";
import { stripImmutableFields } from "@/lib/sanitize";

export async function getAdminStats() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

        const [totalUsers, totalBookings, openTickets, totalProperties] = await Promise.all([
            prisma.user.count(),
            prisma.booking.count(),
            prisma.ticket.count({ where: { status: 'OPEN' } }),
            prisma.property.count()
        ]);

        // Generate realistic mock data for charts
        const monthlyGrowth = [
            { name: "Oct", users: Math.floor(totalUsers * 0.4), bookings: Math.floor(totalBookings * 0.3) },
            { name: "Nov", users: Math.floor(totalUsers * 0.5), bookings: Math.floor(totalBookings * 0.5) },
            { name: "Dec", users: Math.floor(totalUsers * 0.65), bookings: Math.floor(totalBookings * 0.6) },
            { name: "Jan", users: Math.floor(totalUsers * 0.8), bookings: Math.floor(totalBookings * 0.75) },
            { name: "Feb", users: Math.floor(totalUsers * 0.9), bookings: Math.floor(totalBookings * 0.9) },
            { name: "Mar", users: totalUsers, bookings: totalBookings },
        ];

        const propertyDistribution = [
            { name: "PGs / Hostels", value: Math.floor(totalProperties * 0.6) },
            { name: "Flats", value: Math.floor(totalProperties * 0.3) },
            { name: "Co-living", value: Math.floor(totalProperties * 0.1) },
        ];

        // Always fetch fresh user data from DB — never trust stale JWT
        const adminUser = await prisma.user.findUnique({
            where: { id: (session as any).userId as string },
            select: { id: true, name: true, email: true, role: true, adminRole: true, phone: true, createdAt: true, displayId: true }
        });

        return {
            totalUsers,
            totalBookings,
            openTickets,
            totalProperties,
            systemHealth: "98%",
            monthlyGrowth,
            propertyDistribution,
            user: {
                id: adminUser?.id || (session as any).userId,
                name: adminUser?.name || (session as any).name || 'Admin',
                email: adminUser?.email || (session as any).email || 'admin@rentpe.in',
                role: adminUser?.role || (session as any).role || 'ADMIN',
                adminRole: adminUser?.adminRole || (session as any).adminRole,
                phone: adminUser?.phone || (session as any).phone || '+91 9876543210',
                createdAt: adminUser?.createdAt || (session as any).createdAt || new Date().toISOString(),
                displayId: adminUser?.displayId || (session as any).displayId || 'ADM-000',
            }
        };
    } catch (e) {
        console.error("getAdminStats Error:", e);
        return {
            totalUsers: 0,
            totalBookings: 0,
            openTickets: 0,
            totalProperties: 0,
            systemHealth: "N/A",
            monthlyGrowth: [],
            propertyDistribution: []
        };
    }
}

export async function getAuditLogs() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

        return await prisma.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 200,
            include: {
                actor: {
                    select: {
                        name: true,
                        role: true,
                        displayId: true
                    }
                }
            }
        });
    } catch (e) {
        console.error("getAuditLogs Error:", e);
        return [];
    }
}

export async function getUsers() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

        return await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                actionNotes: {
                    orderBy: { timestamp: 'desc' }
                },
                properties: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        city: true,
                        rooms: {
                            select: { id: true, roomNumber: true, type: true, price: true }
                        }
                    }
                },
                bookings: {
                    select: {
                        id: true,
                        propertyName: true,
                        status: true,
                        amount: true,
                        createdAt: true
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 3
                }
            }
        });
    } catch (e) {
        console.error("getUsers Error:", e);
        return [];
    }
}


export async function updateUserStatus(userId: string, status: string, reason: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const user = await prisma.user.update({
        where: { id: userId },
        data: { status }
    });

    await prisma.actionNote.create({
        data: {
            targetId: userId,
            targetType: 'USER',
            action: status === 'BANNED' ? 'BANNED' : 'UNBANNED',
            reason,
            performedBy: (session as any).userId as string
        }
    });

    logAuditEvent({
        actorId: (session as any).userId as string,
        actorRole: session.role as string,
        actorName: (session as any).name || 'Admin',
        actionType: status === 'BANNED' ? 'DELETE' : 'UPDATE', // Ban is effectively a soft-delete of access
        entityType: 'USER',
        entityId: userId,
        description: `User status updated to ${status}. Reason: ${reason}`,
        newValue: { status, reason }
    });

    revalidatePath('/dashboard/admin/users');
    revalidatePath('/dashboard/admin/property-approval');
    return user;
}

export async function adminUpdateUserProfile(userId: string, data: { name?: string; email?: string; phone?: string; role?: string }) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const oldUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!oldUser) throw new Error("User not found");

    const user = await prisma.user.update({
        where: { id: userId },
        data: {
            ...data,
            // If phone is provided, ensure it has +91 if it's a 10 digit number
            phone: data.phone ? (data.phone.length === 10 ? `+91${data.phone}` : data.phone) : undefined
        }
    });

    logAuditEvent({
        actorId: (session as any).userId as string,
        actorRole: session.role as string,
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'USER',
        entityId: userId,
        description: `User profile updated by admin: ${Object.keys(data).join(', ')}`,
        previousValue: { name: oldUser.name, email: oldUser.email, phone: oldUser.phone, role: oldUser.role } as any,
        newValue: data as any
    });

    revalidatePath('/dashboard/admin/users');
    revalidatePath(`/dashboard/admin/users/${userId}`);
    return user;
}

export async function updateUserPoints(userId: string, points: number, reason: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const user = await prisma.user.update({
        where: { id: userId },
        data: { loyaltyPoints: points }
    });

    logAuditEvent({
        actorId: (session as any).userId as string,
        actorRole: session.role as string,
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'USER',
        entityId: userId,
        description: `Points set to ${points}. Reason: ${reason}`,
    });

    revalidatePath('/dashboard/admin/users');
    revalidatePath('/dashboard/student');
    revalidatePath('/dashboard/owner');
    return user;
}

export async function getTransactions() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

        return await prisma.payment.findMany({
            orderBy: { date: 'desc' },
            include: {
                booking: {
                    include: {
                        user: true
                    }
                }
            },
            take: 100
        });
    } catch (e) {
        console.error("getTransactions Error:", e);
        return [];
    }
}

export async function getUserById(userId: string) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

        return await prisma.user.findUnique({
            where: { id: userId },
            include: {
                actionNotes: {
                    orderBy: { timestamp: 'desc' }
                },
                properties: {
                    include: {
                        rooms: true
                    }
                },
                bookings: {
                    include: {
                        documents: true,
                        property: {
                            select: { name: true }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                },
                auditLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 50
                }
            }
        });
    } catch (e) {
        console.error("getUserById Error:", e);
        return null;
    }
}

// ─── Admin Data Deletion ──────────────────────────────

export async function adminDeleteUser(userId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    // Soft delete — set deletedAt timestamp
    await prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date() }
    });

    logAuditEvent({
        actorId: (session as any).userId as string,
        actorRole: session.role as string,
        actorName: (session as any).name || 'Admin',
        actionType: 'DELETE',
        entityType: 'USER',
        entityId: userId,
        description: `User ${userId} archived (soft-deleted) by admin`,
    });

    revalidatePath('/dashboard/admin/data-management');
}

export async function adminRestoreUser(userId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    await prisma.user.update({
        where: { id: userId },
        data: { deletedAt: null }
    });

    logAuditEvent({
        actorId: (session as any).userId as string,
        actorRole: session.role as string,
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'USER',
        entityId: userId,
        description: `User ${userId} restored from archive by admin`,
    });

    revalidatePath('/dashboard/admin/data-management');
}

export async function adminPurgeUser(userId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    // Permanent delete is now a "Hard Soft Delete"
    await prisma.$transaction(async (tx) => {
        await tx.booking.updateMany({ where: { userId }, data: { status: 'PURGED' } });
        await tx.notification.updateMany({ where: { userId }, data: { isPersistent: false, message: '[PURGED]' } });
        await tx.ticket.updateMany({ where: { userId }, data: { status: 'PURGED' } });
        await tx.user.update({ where: { id: userId }, data: { status: 'PURGED', deletedAt: new Date() } });
    });

    logAuditEvent({
        actorId: (session as any).userId as string,
        actorRole: session.role as string,
        actorName: (session as any).name || 'Admin',
        actionType: 'DELETE',
        entityType: 'USER',
        entityId: userId,
        description: `User ${userId} PERMANENTLY PURGED by admin`,
    });

    revalidatePath('/dashboard/admin/data-management');
}

export async function adminDeleteBooking(bookingId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    // Soft delete
    await prisma.booking.update({
        where: { id: bookingId },
        data: { deletedAt: new Date() }
    });

    logAuditEvent({
        actorId: (session as any).userId as string,
        actorRole: session.role as string,
        actorName: (session as any).name || 'Admin',
        actionType: 'DELETE',
        entityType: 'BOOKING',
        entityId: bookingId,
        description: `Booking ${bookingId} archived (soft-deleted) by admin`,
    });

    revalidatePath('/dashboard/admin/data-management');
}

export async function adminRestoreBooking(bookingId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    await prisma.booking.update({
        where: { id: bookingId },
        data: { deletedAt: null }
    });

    logAuditEvent({
        actorId: (session as any).userId as string,
        actorRole: session.role as string,
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'BOOKING',
        entityId: bookingId,
        description: `Booking ${bookingId} restored from archive by admin`,
    });

    revalidatePath('/dashboard/admin/data-management');
}

export async function adminPurgeBooking(bookingId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    await prisma.$transaction(async (tx) => {
        await tx.payment.updateMany({ where: { bookingId }, data: { status: 'PURGED' } });
        await tx.tenantDocument.updateMany({ where: { bookingId }, data: { status: 'PURGED' } });
        await tx.booking.update({ where: { id: bookingId }, data: { status: 'PURGED', deletedAt: new Date() } });
    });

    logAuditEvent({
        actorId: (session as any).userId as string,
        actorRole: session.role as string,
        actorName: (session as any).name || 'Admin',
        actionType: 'DELETE',
        entityType: 'BOOKING',
        entityId: bookingId,
        description: `Booking ${bookingId} PERMANENTLY PURGED by admin`,
    });

    revalidatePath('/dashboard/admin/data-management');
}

export async function adminDeleteTenant(tenantId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    await prisma.$transaction(async (tx) => {
        await tx.rentRecord.updateMany({ where: { tenantId }, data: { amount: 0, month: 'PURGED' } });
        await tx.tenant.update({ where: { id: tenantId }, data: { status: 'CANCELLED' } });
    });

    logAuditEvent({
        actorId: (session as any).userId as string,
        actorRole: session.role as string,
        actorName: (session as any).name || 'Admin',
        actionType: 'DELETE',
        entityType: 'TENANT',
        entityId: tenantId,
        description: `Tenant ${tenantId} permanently deleted by admin`,
    });

    revalidatePath('/dashboard/admin');
}

export async function adminDeleteProperty(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    await prisma.$transaction(async (tx) => {
        await tx.room.updateMany({ where: { propertyId }, data: { status: 'CANCELLED' } });
        await tx.booking.updateMany({ where: { propertyName: { contains: propertyId } }, data: { status: 'CANCELLED' } });
        await tx.tenant.updateMany({ where: { propertyId }, data: { status: 'CANCELLED' } });
        await tx.property.update({ where: { id: propertyId }, data: { status: 'CANCELLED' } });
    });

    logAuditEvent({
        actorId: (session as any).userId as string,
        actorRole: session.role as string,
        actorName: (session as any).name || 'Admin',
        actionType: 'DELETE',
        entityType: 'PROPERTY',
        entityId: propertyId,
        description: `Property ${propertyId} permanently deleted by admin`,
    });

    revalidatePath('/dashboard/admin');
}

// ── Role Assignment ───────────────────────────────────
export async function getTeamMembers() {
    const session = await getSession();
    if (!session || (session as any).role !== 'ADMIN') throw new Error("Unauthorized");

    const members = await prisma.user.findMany({
        where: { role: { in: ['ONBOARDER', 'VERIFIER', 'ADMIN'] } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, email: true, role: true, displayId: true, createdAt: true, status: true },
    });

    // Count onboardings per onboarder
    const onboardingCounts = await prisma.ownerOnboarding.groupBy({
        by: ['onboardedById'],
        _count: { id: true },
        where: { onboardedById: { not: null } },
    });
    const countMap: Record<string, number> = {};
    onboardingCounts.forEach((c) => { if (c.onboardedById) countMap[c.onboardedById] = c._count.id; });

    return members.map((m) => ({ ...m, onboardingCount: countMap[m.id] || 0 }));
}

export async function assignRole(targetUserId: string, newRole: "ONBOARDER" | "VERIFIER" | "ADMIN") {
    const session = await getSession();
    if (!session || (session as any).role !== 'ADMIN') throw new Error("Unauthorized");

    const prefixMap: Record<string, string> = { ONBOARDER: 'ONB', VERIFIER: 'VER', ADMIN: 'ADM' };
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new Error("User not found");

    let displayId = target.displayId;
    // Generate new display ID only if they didn't already have one for this role type
    if (!displayId || !displayId.startsWith(prefixMap[newRole] || 'ADM')) {
        displayId = await generateSequentialId('EMPLOYEE');
    }

    const updated = await prisma.user.update({
        where: { id: targetUserId },
        data: { role: newRole, displayId },
    });

    logAuditEvent({
        actorId: (session as any).userId as string,
        actorRole: session.role as string,
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'USER',
        entityId: targetUserId,
        description: `Role assigned: ${newRole} (${displayId})`,
    });

    revalidatePath('/dashboard/admin/team');
    return updated;
}

export async function revokeRole(targetUserId: string) {
    const session = await getSession();
    if (!session || (session as any).role !== 'ADMIN') throw new Error("Unauthorized");

    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new Error("User not found");

    const updated = await prisma.user.update({
        where: { id: targetUserId },
        data: { role: 'USER', displayId: `TNT-${target.displayId?.split('-')[1] || '000001'}` },
    });

    logAuditEvent({
        actorId: (session as any).userId as string,
        actorRole: session.role as string,
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'USER',
        entityId: targetUserId,
        description: `Role revoked from ${target.role} → USER`,
    });

    revalidatePath('/dashboard/admin/team');
    return updated;
}

export async function searchUserByEmail(email: string) {
    const session = await getSession();
    if (!session || (session as any).role !== 'ADMIN') throw new Error("Unauthorized");

    return prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, email: true, role: true, displayId: true, createdAt: true },
    });
}

// ── Admin: Manually Upgrade User to Owner ─────────────────────────────
export async function upgradeUserToOwner(userId: string) {
    const session = await getSession();
    if (!session || (session as any).role !== 'ADMIN') throw new Error("Unauthorized");

    const adminId = (session as any).userId as string;

    const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, roles: true, role: true, isOwner: true }
    });

    if (!targetUser) throw new Error("User not found");
    if (targetUser.roles.includes('OWNER') || targetUser.isOwner) {
        return { error: "This user already has Owner access." };
    }

    // Grant dual-role (USER + OWNER) so they can switch between dashboards
    const updatedRoles = Array.from(new Set([...targetUser.roles, 'OWNER']));

    await prisma.user.update({
        where: { id: userId },
        data: {
            roles: updatedRoles,
            isOwner: true,
            primaryRole: 'OWNER', // Land on owner dashboard on next login
        }
    });

    // Notify the user
    await prisma.notification.create({
        data: {
            userId,
            type: 'ROLE_UPGRADE_APPROVED',
            category: 'ACCOUNT',
            message: '🏠 Your account has been upgraded to Property Owner. You can now list your PG on RentPe! Use the role switcher to access your Owner Dashboard.',
            targetRole: 'USER',
            isPersistent: true,
        }
    });

    // Full audit trail
    await logAuditEvent({
        actorId: adminId,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'USER',
        entityId: userId,
        description: `Admin manually upgraded user to OWNER role. Roles updated to: ${updatedRoles.join(', ')}. User: ${targetUser.name || targetUser.email}.`,
        newValue: { roles: updatedRoles, primaryRole: 'OWNER', isOwner: true } as any,
    });

    revalidatePath('/dashboard/admin/users');
    revalidatePath(`/dashboard/admin/users/${userId}`);
    return { success: true };
}
// ── Property Approval ────────────────────────────────
export async function getAllPropertiesForAdmin(statusFilter?: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const where: any = {};
    if (statusFilter && statusFilter !== 'ALL') {
        where.status = statusFilter;
    }

    return prisma.property.findMany({
        where,
        include: {
            owner: {
                select: { id: true, name: true, email: true, phone: true }
            },
            rooms: {
                include: {
                    beds: { select: { id: true, status: true } }
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
}

export async function getPropertyByIdForAdmin(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    return prisma.property.findUnique({
        where: { id: propertyId },
        include: {
            owner: {
                select: { id: true, name: true, email: true, phone: true, displayId: true, roles: true, isOwner: true, createdAt: true }
            },
            rooms: {
                include: {
                    beds: { select: { id: true, bedNumber: true, status: true } }
                },
                orderBy: { roomNumber: 'asc' }
            }
        }
    });
}

export async function getAdminPropertyAnalytics() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

        const [pending, approved, rejected] = await Promise.all([
            prisma.property.count({ where: { status: { in: ['PENDING_VERIFICATION', 'VERIFYING_DOCUMENTS', 'UNDER_REVIEW', 'NEEDS_CORRECTION', 'CORRECTED', 'APPROVED_PAYMENT_VERIFIED'] } } }),
            prisma.property.count({ where: { status: { in: ['APPROVED', 'APPROVED_PENDING_PAYMENT'] } } }),
            prisma.property.count({ where: { status: { in: ['REJECTED', 'SUSPENDED'] } } })
        ]);

        return { pending, approved, rejected };
    } catch (e) {
        return { pending: 0, approved: 0, rejected: 0 };
    }
}

export async function getAdminPropertyStatusCounts() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

        const counts = await prisma.property.groupBy({
            by: ['status'],
            _count: {
                status: true
            }
        });

        const statusCounts: Record<string, number> = {};
        counts.forEach(count => {
            statusCounts[count.status] = count._count.status;
        });

        return statusCounts;
    } catch (e) {
        console.error("getAdminPropertyStatusCounts Error:", e);
        return {};
    }
}

export async function getPendingPropertiesCount() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') return 0;
        return await prisma.property.count({ where: { status: 'PENDING_VERIFICATION' } });
    } catch (e) {
        return 0;
    }
}

export async function getDeactivationRequestCount() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') return 0;
        return await prisma.property.count({ where: { status: { in: ['DEACTIVATION_REQUESTED', 'REACTIVATION_REQUESTED'] } } });
    } catch (e) {
        return 0;
    }
}

export async function getDeactivationRequests() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error('Unauthorized');

    return (prisma.property as any).findMany({
        where: { status: { in: ['DEACTIVATION_REQUESTED', 'REACTIVATION_REQUESTED'] } },
        include: {
            owner: { select: { id: true, name: true, email: true, phone: true, displayId: true } },
            tenants: { where: { status: { notIn: ['MOVED_OUT'] } }, select: { id: true, status: true } },
            bookings: { where: { status: { notIn: ['CANCELLED', 'REJECTED', 'COMPLETED'] } }, select: { id: true, status: true } },
        },
        orderBy: { deactivationRequestedAt: 'asc' },
    });
}


export async function startPropertyVerification(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const result = await prisma.$transaction(async (tx) => {
        // Admin can start or resume verification from PENDING, UNDER_REVIEW, or CORRECTED states
        const property = await tx.property.update({
            where: { id: propertyId },
            data: { status: 'VERIFYING_DOCUMENTS' }
        });

        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: session.role as string,
                actorName: session.name || 'Admin',
                actionType: 'UPDATE',
                entityType: 'PROPERTY',
                entityId: propertyId,
                description: `Admin started verification for ${property.name}`,
                newValue: { status: 'VERIFYING_DOCUMENTS' },
                ipAddress: 'internal', // Placeholder or fetch if possible
                userAgent: 'server-action'
            }
        });

        return property;
    });

    revalidatePath('/dashboard/admin/property-approval');
    return result;
}

export async function verifyPropertyDocuments(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const result = await prisma.$transaction(async (tx) => {
        const property = await tx.property.update({
            where: { id: propertyId },
            data: { status: 'VERIFIED_SUCCESSFULLY' }
        });

        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: session.role as string,
                actorName: session.name || 'Admin',
                actionType: 'UPDATE',
                entityType: 'PROPERTY',
                entityId: propertyId,
                description: `Admin successfully verified documents for ${property.name}`,
                newValue: { status: 'VERIFIED_SUCCESSFULLY' },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        return property;
    });

    revalidatePath('/dashboard/admin/property-approval');
    return result;
}

export async function requirePropertyPayment(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const result = await prisma.$transaction(async (tx) => {
        const property = await tx.property.update({
            where: { id: propertyId },
            data: { status: 'APPROVED_PENDING_PAYMENT' }
        });

        await tx.notification.create({
            data: {
                userId: property.ownerId,
                type: "PROPERTY_APPROVED",
                message: `Your property "${property.name}" was verified! Please pay the onboarding fee to push it LIVE.`
            }
        });

        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: session.role as string,
                actorName: session.name || 'Admin',
                actionType: 'UPDATE',
                entityType: 'PROPERTY',
                entityId: propertyId,
                description: `Admin marked property ${property.name} as APPROVED_PENDING_PAYMENT.`,
                newValue: { status: 'APPROVED_PENDING_PAYMENT' },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        return property;
    });

    revalidatePath('/dashboard/admin/property-approval');
    revalidatePath('/dashboard/owner/properties');
    revalidatePath('/search');
    return result;
}

export async function exemptPropertyFee(propertyId: string, reason: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    if (!reason) throw new Error("Exemption reason is required");

    const result = await prisma.$transaction(async (tx) => {
        const property = await tx.property.findUnique({ 
            where: { id: propertyId } ,
            include: { owner: true }
        });
        if (!property) throw new Error("Property not found");

        const newPropertyDisplayId = property.displayId?.replace('APP-RP-', 'RP-REG-') || property.displayId;

        const updated = await tx.property.update({
            where: { id: propertyId },
            data: { 
                status: 'APPROVED', 
                isVerified: true,
                displayId: newPropertyDisplayId 
            }
        });

        // Create Exemption Record
        await tx.feeExemption.create({
            data: {
                userId: property.ownerId,
                propertyName: property.name,
                exemptOwner: true,
                reason: reason
            }
        });

        // Upgrade Owner ID if they are still an application
        const owner = property.owner;
        let newOwnerDisplayId = owner?.displayId;
        if (owner?.displayId?.startsWith('APP-OWN-')) {
            newOwnerDisplayId = owner.displayId.replace('APP-OWN-', 'REG-OWN-');
            await tx.user.update({
                where: { id: owner.id },
                data: { displayId: newOwnerDisplayId }
            });
        }

        await tx.notification.create({
            data: {
                userId: property.ownerId,
                type: "PROPERTY_APPROVED",
                message: `Your property "${property.name}" is now LIVE! Onboarding fee was waived. Reason: ${reason}`
            }
        });

        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: session.role as string,
                actorName: session.name || 'Admin',
                actionType: 'APPROVE',
                entityType: 'PROPERTY',
                entityId: propertyId,
                description: `Admin exempted fee and set property ${property.name} LIVE. Reason: ${reason}. Upgraded ID: ${property.displayId} -> ${newPropertyDisplayId}`,
                newValue: { status: 'APPROVED', displayId: newPropertyDisplayId, ownerDisplayId: newOwnerDisplayId, exemptionReason: reason },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        return updated;
    });

    revalidatePath('/dashboard/admin/property-approval');
    revalidatePath('/dashboard/owner/properties');
    revalidatePath('/search');
    return result;
}

export async function rejectProperty(propertyId: string, notes: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const result = await prisma.$transaction(async (tx) => {
        const property = await tx.property.update({
            where: { id: propertyId },
            data: { status: 'REJECTED', adminNotes: notes || null }
        });

        await tx.notification.create({
            data: {
                userId: property.ownerId,
                type: "PROPERTY_REJECTED",
                message: `Action Required: Your property "${property.name}" was rejected. Admin Note: ${notes}`
            }
        });

        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: session.role as string,
                actorName: session.name || 'Admin',
                actionType: 'REJECT',
                entityType: 'PROPERTY',
                entityId: propertyId,
                description: `Admin rejected ${property.name}. Reason: ${notes}`,
                newValue: { status: 'REJECTED', notes },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        return property;
    });

    revalidatePath('/dashboard/admin/property-approval');
    revalidatePath('/dashboard/owner/properties');
    return result;
}

export async function requestPropertyCorrections(propertyId: string, notes: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const result = await prisma.$transaction(async (tx) => {
        const property = await tx.property.update({
            where: { id: propertyId },
            data: { status: 'NEEDS_CORRECTION', adminNotes: notes || null }
        });

        await tx.notification.create({
            data: {
                userId: property.ownerId,
                type: "PROPERTY_PENDING",
                message: `Action Required: Your property "${property.name}" needs corrections. Admin Note: ${notes}`
            }
        });

        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: session.role as string,
                actorName: session.name || 'Admin',
                actionType: 'UPDATE',
                entityType: 'PROPERTY',
                entityId: propertyId,
                description: `Admin requested corrections for ${property.name}. Notes: ${notes}`,
                newValue: { status: 'NEEDS_CORRECTION', notes },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        return property;
    });

    revalidatePath('/dashboard/admin/property-approval');
    revalidatePath('/dashboard/owner/properties');
    return result;
}

export async function moveToReview(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const result = await prisma.property.update({
        where: { id: propertyId },
        data: { status: 'VERIFYING_DOCUMENTS' }
    });

    await prisma.auditLog.create({
        data: {
            actorId: session.userId,
            actorRole: 'ADMIN',
            actorName: session.name || 'Admin',
            actionType: 'UPDATE',
            entityType: 'PROPERTY',
            entityId: propertyId,
            description: `Admin moved property "${result.name}" to VERIFYING_DOCUMENTS (In Review) stage.`,
            newValue: { status: 'VERIFYING_DOCUMENTS' },
            ipAddress: 'internal',
            userAgent: 'server-action'
        }
    });

    revalidatePath('/dashboard/admin/property-approval');
    return result;
}

export async function suspendProperty(propertyId: string, notes: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const result = await prisma.$transaction(async (tx) => {
        const property = await tx.property.update({
            where: { id: propertyId },
            data: { status: 'SUSPENDED', adminNotes: notes || null }
        });

        await tx.notification.create({
            data: {
                userId: property.ownerId,
                type: "PROPERTY_REJECTED",
                message: `Your property "${property.name}" has been SUSPENDED. Reason: ${notes}`
            }
        });

        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: session.role as string,
                actorName: session.name || 'Admin',
                actionType: 'SUSPEND',
                entityType: 'PROPERTY',
                entityId: propertyId,
                description: `Property ${property.name} suspended by admin. Reason: ${notes}`,
                newValue: { status: 'SUSPENDED', notes },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        return property;
    });

    revalidatePath('/dashboard/admin/property-approval');
    revalidatePath('/dashboard/owner/properties');
    revalidatePath('/search');
    return result;
}

export async function activateProperty(propertyId: string, notes?: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error("Property not found");
    
    // Allow activation if payment is verified OR if it was previously suspended
    if (property.status !== 'APPROVED_PAYMENT_VERIFIED' && property.status !== 'SUSPENDED') {
        throw new Error(`Cannot activate property from status: ${property.status}`);
    }

    const result = await prisma.$transaction(async (tx) => {
        // Upgrade Property ID if it's an application
        const newPropertyDisplayId = property.displayId?.replace('APP-RP-', 'RP-REG-') || property.displayId;

        const updated = await tx.property.update({ 
            where: { id: propertyId }, 
            data: { 
                status: 'APPROVED', 
                isVerified: true,
                displayId: newPropertyDisplayId // Save the upgraded ID
            } 
        });

        // Upgrade Owner ID if they are still an application
        const owner = await tx.user.findUnique({ where: { id: property.ownerId }});
        let newOwnerDisplayId = owner?.displayId;
        if (owner?.displayId?.startsWith('APP-OWN-')) {
            newOwnerDisplayId = owner.displayId.replace('APP-OWN-', 'REG-OWN-');
            await tx.user.update({
                where: { id: owner.id },
                data: { displayId: newOwnerDisplayId }
            });
        }

        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: 'ADMIN',
                actorName: session.name || 'Admin',
                actionType: 'APPROVE',
                entityType: 'PROPERTY',
                entityId: propertyId,
                description: property.status === 'SUSPENDED' 
                    ? `Admin REACTIVATED property "${property.name}". Internal Note: ${notes || 'No note provided'}`
                    : `Admin activated property "${property.name}". Upgraded ID: ${property.displayId} -> ${newPropertyDisplayId}. Status: APPROVED (Live).`,
                newValue: { status: 'APPROVED', internalNote: notes, displayId: newPropertyDisplayId, ownerDisplayId: newOwnerDisplayId },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        // Notify Owner
        await tx.notification.create({
            data: {
                userId: property.ownerId,
                type: "PROPERTY_LIVE",
                message: property.status === 'SUSPENDED'
                    ? `Your property "${property.name}" has been unsuspended and is now LIVE.`
                    : `Congratulations! Your property "${property.name}" is now LIVE on RentPe.`,
            }
        });

        return updated;
    });

    revalidatePath('/dashboard/admin/property-approval');
    revalidatePath('/dashboard/owner/properties');
    revalidatePath('/search');
    return result;
}

export async function unsuspendProperty(propertyId: string, notes?: string) {
    return activateProperty(propertyId, notes);
}

export async function rollbackPropertyStatus(propertyId: string, notes: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error("Property not found");

    // Industry Standard Reverse State Map
    const reverseMap: Record<string, string> = {
        'VERIFYING_DOCUMENTS': 'PENDING_VERIFICATION',
        'VERIFIED_SUCCESSFULLY': 'VERIFYING_DOCUMENTS',
        'APPROVED_PENDING_PAYMENT': 'VERIFIED_SUCCESSFULLY',
        'APPROVED_PAYMENT_VERIFIED': 'VERIFIED_SUCCESSFULLY',
        'APPROVED': 'APPROVED_PENDING_PAYMENT',
        'NEEDS_CORRECTION': 'VERIFYING_DOCUMENTS'
    };

    const previousStatus = reverseMap[property.status];
    if (!previousStatus) {
        throw new Error(`Cannot rollback from status: ${property.status}`);
    }

    const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.property.update({
            where: { id: propertyId },
            data: { status: previousStatus as any, adminNotes: notes || null }
        });

        // Notify Owner about the rollback
        await tx.notification.create({
            data: {
                userId: property.ownerId,
                type: "PROPERTY_PENDING",
                message: `Update: Your property "${property.name}" status has been adjusted back to ${previousStatus}. Admin Note: ${notes}`
            }
        });

        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: session.role as string,
                actorName: session.name || 'Admin',
                actionType: 'UPDATE', // Categorize as update but describe as rollback
                entityType: 'PROPERTY',
                entityId: propertyId,
                description: `Admin ROLLED BACK property "${property.name}" from ${property.status} → ${previousStatus}. Internal Note: ${notes}`,
                newValue: { status: previousStatus, rollbackReason: notes },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        return updated;
    });

    revalidatePath('/dashboard/admin/property-approval');
    revalidatePath('/dashboard/owner/properties');
    return result;
}
export async function adminUpdateProperty(propertyId: string, data: any) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const oldProperty = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!oldProperty) throw new Error("Property not found");

    const updated = await prisma.property.update({
        where: { id: propertyId },
        data: {
            ...data,
            // Ensure amenities is stored correctly if passed as string
            amenities: typeof data.amenities === 'string' ? data.amenities : data.amenities
        }
    });

    logAuditEvent({
        actorId: (session as any).userId as string,
        actorRole: session.role as string,
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'PROPERTY',
        entityId: propertyId,
        description: `Property "${updated.name}" updated by admin. Fields: ${Object.keys(data).join(', ')}`,
        previousValue: oldProperty as any,
        newValue: data as any
    });

    revalidatePath('/dashboard/admin/property-approval');
    revalidatePath(`/search`);
    return updated;
}
export async function adminUpdateRoom(roomId: string, data: any) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const oldRoom = await prisma.room.findUnique({ 
        where: { id: roomId },
        include: { property: true }
    });
    if (!oldRoom) throw new Error("Room not found");

    const oldAvailability = oldRoom.availability;
    const newAvailability = parseInt(data.availability);
    const safeData = stripImmutableFields(data);

    const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.room.update({
            where: { id: roomId },
            data: {
                ...safeData,
                price: parseFloat(data.price),
                availability: newAvailability,
                totalBeds: newAvailability
            }
        });

        // If availability increased, add more beds
        if (newAvailability > oldAvailability) {
            const bedsToAdd = newAvailability - oldAvailability;
            const bedIdsList = await Promise.all(Array(bedsToAdd).fill(0).map(() => generateSequentialId('BED')));
            
            for (let i = 0; i < bedsToAdd; i++) {
                const bedDisplayId = bedIdsList[i];
                await tx.bed.create({
                    data: {
                        displayId: bedDisplayId,
                        roomId: roomId,
                        bedNumber: `${updated.roomNumber}-${String.fromCharCode(64 + oldAvailability + i + 1)}`,
                        status: 'AVAILABLE'
                    }
                });
            }
        } else if (newAvailability < oldAvailability) {
            // Optional: Handle decreasing availability? 
            // Usually we shouldn't delete beds if they are booked, but for admin correction we might.
            // For now, let's keep it consistent with owner edit logic.
        }

        await tx.auditLog.create({
            data: {
                actorId: session!.userId,
                actorRole: 'ADMIN',
                actorName: session!.name || 'Admin',
                actionType: 'UPDATE',
                entityType: 'ROOM',
                entityId: roomId,
                description: `Room ${updated.roomNumber} in property "${oldRoom.property.name}" updated by admin.`,
                newValue: data as any,
                previousValue: oldRoom as any,
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        return updated;
    });

    revalidatePath('/dashboard/admin/property-approval');
    return result;
}

export async function adminAddRoom(propertyId: string, data: any) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error("Property not found");

    const availability = parseInt(data.availability);

    const result = await prisma.$transaction(async (tx) => {
        const room = await tx.room.create({
            data: {
                propertyId,
                roomNumber: data.roomNumber,
                type: data.type,
                price: parseFloat(data.price),
                availability: availability,
                totalBeds: availability
            }
        });

        // Generate beds
        const bedIdsList = await Promise.all(Array(availability).fill(0).map(() => generateSequentialId('BED')));
        for (let i = 0; i < availability; i++) {
            await tx.bed.create({
                data: {
                    displayId: bedIdsList[i],
                    roomId: room.id,
                    bedNumber: `${room.roomNumber}-${String.fromCharCode(65 + i)}`,
                    status: 'AVAILABLE'
                }
            });
        }

        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: 'ADMIN',
                actorName: session.name || 'Admin',
                actionType: 'CREATE',
                entityType: 'ROOM',
                entityId: room.id,
                description: `Admin added room ${room.roomNumber} to property "${property.name}"`,
                newValue: data as any,
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        return room;
    });

    revalidatePath('/dashboard/admin/property-approval');
    return result;
}

export async function adminDeleteRoom(roomId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { property: true, beds: true }
    });
    if (!room) throw new Error("Room not found");

    // Check if any beds are occupied
    const occupiedBeds = room.beds.some(bed => bed.status === 'OCCUPIED');
    if (occupiedBeds) throw new Error("Cannot delete room with occupied beds");

    const result = await prisma.$transaction(async (tx) => {
        // Cascade soft-delete beds
        await tx.bed.updateMany({ where: { roomId: roomId }, data: { status: 'CANCELLED' } });
        const deleted = await tx.room.update({ where: { id: roomId }, data: { status: 'CANCELLED' } });

        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: 'ADMIN',
                actorName: session.name || 'Admin',
                actionType: 'DELETE',
                entityType: 'ROOM',
                entityId: roomId,
                description: `Admin deleted room ${room.roomNumber} from property "${room.property.name}"`,
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        return deleted;
    });

    revalidatePath('/dashboard/admin/property-approval');
    return result;
}

export async function logCorrectionView(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error('Unauthorized');

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error('Property not found');

    await prisma.auditLog.create({
        data: {
            actorId: session.userId,
            actorRole: session.role as string,
            actorName: session.name || 'Admin',
            actionType: 'READ',
            entityType: 'PROPERTY',
            entityId: propertyId,
            description: `Admin viewed correction details for property "${property.name}"`,
            newValue: { viewedAt: new Date().toISOString() },
            ipAddress: 'internal',
            userAgent: 'server-action'
        }
    });

    return { success: true };
}
