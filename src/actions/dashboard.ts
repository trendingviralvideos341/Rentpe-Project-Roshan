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

        const [propertyCount, tenantCount, paidRecordSums] = await Promise.all([
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
                    tenant: {
                        property: { ownerId: userId }
                    }
                },
                _sum: {
                    amount: true
                }
            })
        ]);

        const totalRevenue = paidRecordSums._sum.amount || 0;

        const revenueHistory = [
            { month: "Oct", revenue: Math.floor(totalRevenue * 0.15) },
            { month: "Nov", revenue: Math.floor(totalRevenue * 0.1) },
            { month: "Dec", revenue: Math.floor(totalRevenue * 0.2) },
            { month: "Jan", revenue: Math.floor(totalRevenue * 0.15) },
            { month: "Feb", revenue: Math.floor(totalRevenue * 0.25) },
            { month: "Mar", revenue: Math.floor(totalRevenue * 0.15) },
        ];

        const occupancyStats = [
            { name: "Occupied Beds", value: tenantCount },
            { name: "Vacant Beds", value: Math.max(0, (propertyCount * 20) - tenantCount) }, 
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
                                    select: { id: true, name: true, displayId: true }
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
