'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function getOwnerDashboardStats() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            throw new Error("Unauthorized");
        }

        const userId = session.userId;

        const [propertyCount, tenantCount, paidRecordSums, totalBeds, occupiedBeds, paidRecords] = await Promise.all([
            prisma.property.count({ where: { ownerId: userId } }),
            prisma.tenant.count({
                where: {
                    property: { ownerId: userId },
                    status: 'ACTIVE'
                }
            }),
            prisma.rentRecord.aggregate({
                where: {
                    paid: true,
                    tenant: { property: { ownerId: userId } }
                },
                _sum: { amount: true }
            }),
            // Real total bed count from DB
            prisma.bed.count({
                where: { room: { property: { ownerId: userId } }, deletedAt: null }
            }),
            // Real occupied bed count from DB
            prisma.bed.count({
                where: { status: 'OCCUPIED', room: { property: { ownerId: userId } }, deletedAt: null }
            }),
            // Real payments for revenue chart - last 6 months
            prisma.rentRecord.findMany({
                where: {
                    paid: true,
                    tenant: { property: { ownerId: userId } },
                    paidOn: { not: null }
                },
                select: { paidOn: true, amount: true },
            }),
        ]);

        const totalRevenue = paidRecordSums._sum.amount || 0;

        // Group paid records by month (real data)
        const monthMap: Record<string, number> = {};
        for (const record of paidRecords) {
            if (!record.paidOn) continue;
            // paidOn is stored as string e.g. "02 Jan 2025"
            try {
                const date = new Date(record.paidOn);
                if (isNaN(date.getTime())) continue;
                const key = date.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
                monthMap[key] = (monthMap[key] || 0) + (record.amount || 0);
            } catch { continue; }
        }

        // Last 6 months in order
        const revenueHistory = Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - (5 - i));
            const key = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
            return { month: d.toLocaleString('en-IN', { month: 'short' }), revenue: monthMap[key] || 0 };
        });

        // Real occupancy from actual bed counts
        const vacantBeds = Math.max(0, totalBeds - occupiedBeds);
        const occupancyStats = [
            { name: "Occupied Beds", value: occupiedBeds },
            { name: "Vacant Beds", value: vacantBeds },
        ];

        const ownerUser = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                phone: true,
                createdAt: true,
                displayId: true,
                loyaltyPoints: true
            }
        });

        return {
            propertyCount,
            tenantCount,
            totalRevenue,
            revenueHistory,
            occupancyStats,
            user: {
                id: ownerUser?.id || userId,
                name: ownerUser?.name || session.name || 'Owner',
                email: ownerUser?.email || session.email,
                role: ownerUser?.role || session.role,
                phone: ownerUser?.phone || null,
                createdAt: ownerUser?.createdAt || new Date(),
                displayId: ownerUser?.displayId || null,
                loyaltyPoints: ownerUser?.loyaltyPoints ?? 0,
            }
        };
    } catch (e: any) {
        console.error("getOwnerDashboardStats Error:", e);
        if (e.message === "Unauthorized") {
            return { error: "Unauthorized" };
        }
        return {
            propertyCount: 0,
            tenantCount: 0,
            totalRevenue: 0,
            revenueHistory: [],
            occupancyStats: []
        };
    }
}


export async function getOwnerInventory() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

        const userId = session.userId;

        const properties = await prisma.property.findMany({
            where: { ownerId: userId },
            include: {
                rooms: {
                    include: {
                        beds: {
                            include: {
                                tenant: {
                                    select: { id: true, name: true, displayId: true, phone: true, status: true }
                                },
                                booking: {
                                    select: { id: true, status: true, displayId: true }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        return properties;
    } catch (e) {
        console.error("getOwnerInventory Error:", e);
        return [];
    }
}
