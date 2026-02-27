'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function getOwnerDashboardStats() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            throw new Error("Unauthorized");
        }

        const userId = (session as any).userId;

        const [propertyCount, tenantCount, paidRecords, recentActivity] = await Promise.all([
            prisma.property.count({ where: { ownerId: userId } }),
            prisma.tenant.count({
                where: {
                    property: { ownerId: userId },
                    status: 'ACTIVE'
                }
            }),
            prisma.rentRecord.findMany({
                where: {
                    paid: true,
                    tenant: {
                        property: { ownerId: userId }
                    }
                },
                select: { amount: true }
            }),
            prisma.auditLog.findMany({
                where: { performedBy: userId },
                orderBy: { timestamp: 'desc' },
                take: 5
            })
        ]);

        const totalRevenue = paidRecords.reduce((sum, record) => {
            const value = parseFloat(record.amount.replace(/[^0-9.]/g, '')) || 0;
            return sum + value;
        }, 0);

        return {
            propertyCount,
            tenantCount,
            totalRevenue,
            recentActivity
        };
    } catch (e) {
        console.error("getOwnerDashboardStats Error:", e);
        return {
            propertyCount: 0,
            tenantCount: 0,
            totalRevenue: 0,
            recentActivity: []
        };
    }
}
