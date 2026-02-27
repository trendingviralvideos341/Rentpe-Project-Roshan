'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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

        return {
            totalUsers,
            totalBookings,
            openTickets,
            totalProperties,
            systemHealth: "98%"
        };
    } catch (e) {
        console.error("getAdminStats Error:", e);
        return {
            totalUsers: 0,
            totalBookings: 0,
            openTickets: 0,
            totalProperties: 0,
            systemHealth: "N/A"
        };
    }
}

export async function getAuditLogs() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

        return await prisma.auditLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: 100
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

    await prisma.auditLog.create({
        data: {
            action: status === 'BANNED' ? 'USER_BANNED' : 'USER_UNBANNED',
            targetId: userId,
            targetType: 'USER',
            details: reason,
            performedBy: (session as any).userId as string
        }
    });

    revalidatePath('/dashboard/admin/users');
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

// ─── Admin Data Deletion ──────────────────────────────

export async function adminDeleteUser(userId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    // Soft delete — set deletedAt timestamp
    await prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date() }
    });

    await prisma.auditLog.create({
        data: {
            action: 'ADMIN_ARCHIVE_USER',
            targetId: userId,
            targetType: 'USER',
            details: `User ${userId} archived (soft-deleted) by admin`,
            performedBy: (session as any).userId
        }
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

    await prisma.auditLog.create({
        data: {
            action: 'ADMIN_RESTORE_USER',
            targetId: userId,
            targetType: 'USER',
            details: `User ${userId} restored from archive by admin`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/admin/data-management');
}

export async function adminPurgeUser(userId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    // Permanent delete — cascade related data
    await prisma.booking.deleteMany({ where: { userId } });
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.ticket.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

    await prisma.auditLog.create({
        data: {
            action: 'ADMIN_PURGE_USER',
            targetId: userId,
            targetType: 'USER',
            details: `User ${userId} PERMANENTLY PURGED by admin`,
            performedBy: (session as any).userId
        }
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

    await prisma.auditLog.create({
        data: {
            action: 'ADMIN_ARCHIVE_BOOKING',
            targetId: bookingId,
            targetType: 'BOOKING',
            details: `Booking ${bookingId} archived (soft-deleted) by admin`,
            performedBy: (session as any).userId
        }
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

    await prisma.auditLog.create({
        data: {
            action: 'ADMIN_RESTORE_BOOKING',
            targetId: bookingId,
            targetType: 'BOOKING',
            details: `Booking ${bookingId} restored from archive by admin`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/admin/data-management');
}

export async function adminPurgeBooking(bookingId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    await prisma.payment.deleteMany({ where: { bookingId } });
    await prisma.tenantDocument.deleteMany({ where: { bookingId } });
    await prisma.booking.delete({ where: { id: bookingId } });

    await prisma.auditLog.create({
        data: {
            action: 'ADMIN_PURGE_BOOKING',
            targetId: bookingId,
            targetType: 'BOOKING',
            details: `Booking ${bookingId} PERMANENTLY PURGED by admin`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/admin/data-management');
}

export async function adminDeleteTenant(tenantId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    await prisma.rentRecord.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });

    await prisma.auditLog.create({
        data: {
            action: 'ADMIN_DELETE_TENANT',
            targetId: tenantId,
            targetType: 'TENANT',
            details: `Tenant ${tenantId} permanently deleted by admin`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/admin');
}

export async function adminDeleteProperty(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    await prisma.room.deleteMany({ where: { propertyId } });
    await prisma.booking.deleteMany({ where: { propertyName: { contains: propertyId } } });
    await prisma.tenant.deleteMany({ where: { propertyId } });
    await prisma.property.delete({ where: { id: propertyId } });

    await prisma.auditLog.create({
        data: {
            action: 'ADMIN_DELETE_PROPERTY',
            targetId: propertyId,
            targetType: 'PROPERTY',
            details: `Property ${propertyId} permanently deleted by admin`,
            performedBy: (session as any).userId
        }
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
    if (!displayId || !displayId.startsWith(prefixMap[newRole])) {
        const count = await prisma.user.count({ where: { role: newRole } });
        displayId = `${prefixMap[newRole]}-${String(count + 1).padStart(6, '0')}`;
    }

    const updated = await prisma.user.update({
        where: { id: targetUserId },
        data: { role: newRole, displayId },
    });

    await prisma.auditLog.create({
        data: {
            action: 'ADMIN_ASSIGN_ROLE',
            targetId: targetUserId,
            targetType: 'USER',
            details: `Role assigned: ${newRole} (${displayId})`,
            performedBy: (session as any).userId,
        },
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

    await prisma.auditLog.create({
        data: {
            action: 'ADMIN_REVOKE_ROLE',
            targetId: targetUserId,
            targetType: 'USER',
            details: `Role revoked from ${target.role} → USER`,
            performedBy: (session as any).userId,
        },
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
