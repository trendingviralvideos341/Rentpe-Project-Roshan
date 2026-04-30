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

        // Fetch properties with rooms and beds (no booking relation on Bed in schema)
        const properties = await prisma.property.findMany({
            where: { ownerId: userId },
            include: {
                rooms: {
                    include: {
                        beds: {
                            include: {
                                tenant: {
                                    select: { id: true, name: true, displayId: true, phone: true, status: true }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        // Collect booking IDs from BOTH currentBookingId AND lockedByBookingId
        // (TEMP_LOCKED/LOCKED beds use lockedByBookingId; RESERVED beds use currentBookingId)
        const bookingIds = new Set<string>();
        for (const prop of properties) {
            for (const room of prop.rooms) {
                for (const bed of room.beds) {
                    if (bed.currentBookingId) bookingIds.add(bed.currentBookingId);
                    if (bed.lockedByBookingId) bookingIds.add(bed.lockedByBookingId);
                }
            }
        }

        // Batch-fetch bookings — including full guest info for the popup display
        const bookingsMap = new Map<string, {
            id: string; status: string; displayId: string;
            guestName: string; guestPhone: string | null; guestEmail: string | null;
            moveInDate: string; cancelReason: string | null; rejectionReason: string | null;
        }>();
        if (bookingIds.size > 0) {
            const bookings = await prisma.booking.findMany({
                where: { id: { in: Array.from(bookingIds) } },
                select: {
                    id: true,
                    status: true,
                    displayId: true,
                    guestName: true,
                    guestPhone: true,
                    guestEmail: true,
                    moveInDate: true,
                    cancelReason: true,
                    rejectionReason: true,
                }
            });
            for (const b of bookings) bookingsMap.set(b.id, b);
        }

        // Attach booking data to each bed — prefer currentBookingId, fall back to lockedByBookingId
        const enrichedProperties = properties.map(prop => ({
            ...prop,
            rooms: prop.rooms.map(room => ({
                ...room,
                beds: room.beds.map(bed => {
                    const bookingId = bed.currentBookingId || bed.lockedByBookingId;
                    return {
                        ...bed,
                        booking: bookingId ? (bookingsMap.get(bookingId) ?? null) : null
                    };
                })
            }))
        }));

        return enrichedProperties;
    } catch (e) {
        console.error("getOwnerInventory Error:", e);
        return [];
    }
}
