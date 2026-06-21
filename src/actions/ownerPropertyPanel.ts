'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * Returns all properties visible to the current user (OWNER or STAFF),
 * enriched with real bed counts, tenant counts, revenue, ratings,
 * pending bookings, and upcoming move-outs.
 *
 * - OWNER  â†’ all properties where ownerId === userId
 * - STAFF  â†’ only properties assigned via StaffPropertyAssignment
 */
export async function getOwnerPropertyPanel() {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF')) {
        throw new Error("Unauthorized");
    }

    const userId = (session as any).userId;

    // â”€â”€ 1. Resolve which properties this user can see â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let propertyWhere: any = {};

    if (session.role === 'STAFF') {
        // Staff: only assigned properties
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { staffProfile: true }
        });
        if (!user?.staffProfile) return [];

        const assignments = await prisma.staffPropertyAssignment.findMany({
            where: { staffMemberId: user.staffProfile.id },
            select: { propertyId: true }
        });
        const assignedIds = assignments.map((a: any) => a.propertyId);
        if (assignedIds.length === 0) return [];
        propertyWhere = { id: { in: assignedIds } };
    } else {
        // Owner: all their properties
        propertyWhere = { ownerId: userId };
    }

    // â”€â”€ 2. Fetch properties with rooms + beds â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const properties = await prisma.property.findMany({
        where: propertyWhere,
        include: {
            rooms: {
                include: { beds: { select: { id: true, status: true } } }
            },
            _count: { select: { bookings: true, reviews: true } }
        },
        orderBy: { updatedAt: 'desc' }
    });

    if (properties.length === 0) return [];

    const propIds = properties.map((p: any) => p.id);

    // â”€â”€ 3. Bulk queries (one per metric, not per property) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [tenantCounts, pendingBookings, upcomingMoveOuts, revenues, ratings, staffAssignments] = await Promise.all([
        // Active tenants per property
        (prisma.tenant as any).groupBy({
            by: ['propertyId'],
            where: { propertyId: { in: propIds }, status: 'ACTIVE_TENANT' },
            _count: { id: true }
        }),
        // Pending booking requests per property
        prisma.booking.groupBy({
            by: ['propertyId'],
            where: { propertyId: { in: propIds }, status: 'PENDING_APPROVAL' },
            _count: { id: true }
        }),
        // Upcoming move-outs per property
        (prisma.tenant as any).groupBy({
            by: ['propertyId'],
            where: { propertyId: { in: propIds }, status: 'MOVE_OUT_SCHEDULED' },
            _count: { id: true }
        }),
        // Revenue per property (confirmed bookings)
        prisma.booking.groupBy({
            by: ['propertyId'],
            where: {
                propertyId: { in: propIds },
                status: { in: ['BOOKING_CONFIRMED', 'CHECKED_IN', 'PAID', 'CASH_PAID'] }
            },
            _sum: { amount: true }
        }),
        // Avg rating per property
        (prisma.review as any).groupBy({
            by: ['propertyId'],
            where: { propertyId: { in: propIds } },
            _avg: { rating: true },
            _count: { id: true }
        }),
        // Staff assignments for this owner's properties (to show assigned staff per property)
        session.role === 'OWNER'
            ? prisma.staffPropertyAssignment.findMany({
                where: { propertyId: { in: propIds } },
                include: {
                    staffMember: {
                        select: { id: true, name: true, role: true, status: true, userId: true }
                    }
                }
            })
            : Promise.resolve([]),
    ]);

    // Build lookup maps
    const tenantMap = new Map(tenantCounts.map((t: any) => [t.propertyId, t._count.id]));
    const pendingMap = new Map(pendingBookings.map((b: any) => [b.propertyId, b._count.id]));
    const moveOutMap = new Map(upcomingMoveOuts.map((t: any) => [t.propertyId, t._count.id]));
    const revenueMap = new Map(revenues.map((r: any) => [r.propertyId, r._sum?.amount ?? 0]));
    const ratingMap = new Map<string, { avg: number; count: number }>(
        ratings.map((r: any) => [r.propertyId, { avg: r._avg?.rating ?? 0, count: r._count?.id ?? 0 }])
    );


    // Staff assignments: map propertyId â†’ list of staff
    const staffMap = new Map<string, any[]>();
    for (const assign of (staffAssignments as any[])) {
        if (!staffMap.has(assign.propertyId)) staffMap.set(assign.propertyId, []);
        staffMap.get(assign.propertyId)!.push(assign.staffMember);
    }

    // â”€â”€ 4. Enrich each property â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    return properties.map((prop: any) => {
        // Accurate bed counts from actual bed records
        const allBeds = prop.rooms.flatMap((r: any) => r.beds);
        const totalBeds = allBeds.length > 0
            ? allBeds.length
            : prop.rooms.reduce((s: number, r: any) => s + (r.totalBeds || r.availability || 0), 0);
        const availableBeds = allBeds.filter((b: any) => b.status === 'AVAILABLE').length;
        const occupiedBeds = allBeds.filter((b: any) => b.status === 'OCCUPIED').length;
        const reservedBeds = allBeds.filter((b: any) => ['RESERVED', 'TEMP_LOCKED'].includes(b.status)).length;
        const maintenanceBeds = allBeds.filter((b: any) => b.status === 'MAINTENANCE').length;
        const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

        const ratingInfo: { avg: number; count: number } = ratingMap.get(prop.id) || { avg: 0, count: 0 };

        return {
            id: prop.id,
            displayId: prop.displayId,
            name: prop.name,
            propertyType: prop.propertyType || 'PG',
            address: prop.address,
            city: prop.city,
            status: prop.status,
            genderType: prop.genderType,
            isVerified: prop.isVerified,
            foodType: prop.foodType,
            description: prop.description,
            amenities: prop.amenities,
            createdAt: prop.createdAt,
            // Bed/Room metrics
            totalRooms: prop.rooms.length,
            totalBeds,
            availableBeds: Math.min(availableBeds, totalBeds),
            occupiedBeds,
            reservedBeds,
            maintenanceBeds,
            occupancyRate,
            // Business metrics
            activeTenants: tenantMap.get(prop.id) ?? 0,
            pendingBookingRequests: pendingMap.get(prop.id) ?? 0,
            upcomingMoveOuts: moveOutMap.get(prop.id) ?? 0,
            totalBookings: prop._count.bookings,
            totalRevenue: Math.round((revenueMap.get(prop.id) ?? 0) * 100) / 100,
            avgRating: Math.round((ratingInfo.avg) * 10) / 10,
            reviewCount: ratingInfo.count,
            // Staff assigned to this property
            assignedStaff: staffMap.get(prop.id) || [],
            // Room details for detail view
            rooms: prop.rooms.map((r: any) => ({
                id: r.id,
                roomNumber: r.roomNumber,
                type: r.type,
                price: r.price,
                totalBeds: r.totalBeds || r.availability || 0,
                availableBeds: r.beds.filter((b: any) => b.status === 'AVAILABLE').length,
                occupiedBeds: r.beds.filter((b: any) => b.status === 'OCCUPIED').length,
                status: r.status,
            })),
        };
    });
}

