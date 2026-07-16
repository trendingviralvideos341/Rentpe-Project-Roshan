'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { runOnDemandExpiry } from "@/actions/expiry";

export async function getOwnerDashboardStats() {
    // Opportunistically expire stale bookings on every dashboard load.
    // Wrapped in its own try/catch inside runOnDemandExpiry — never throws.
    await runOnDemandExpiry();

    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            throw new Error("Unauthorized");
        }

        const userId = session.userId;

        // ── Get all property IDs for this owner (needed for SecurityDeposit query) ──
        const ownerProperties = await prisma.property.findMany({
            where: { ownerId: userId },
            select: { id: true }
        });
        const ownerPropertyIds = ownerProperties.map((p: any) => p.id);

        const [
            propertyCount,
            tenantCount,
            totalBeds,
            occupiedBeds,
            pendingBookingCount,
            confirmedBookings,
            roomTotalBeds,
            depositsHeldRecords,
        ] = await Promise.all([
            prisma.property.count({ where: { ownerId: userId, status: { in: ['LIVE', 'APPROVED'] } } }),
            prisma.tenant.count({
                where: {
                    property: { ownerId: userId },
                    status: 'ACTIVE'
                }
            }),
            // Real total bed count from Bed records
            prisma.bed.count({
                where: { room: { property: { ownerId: userId, status: { in: ['LIVE', 'APPROVED'] } } }, deletedAt: null }
            }),
            // Real occupied bed count
            prisma.bed.count({
                where: { status: 'OCCUPIED', room: { property: { ownerId: userId, status: { in: ['LIVE', 'APPROVED'] } } }, deletedAt: null }
            }),
            // Pending booking requests
            prisma.booking.count({
                where: {
                    property: { ownerId: userId },
                    status: 'PENDING_APPROVAL'
                }
            }),
            // Revenue from confirmed bookings — rent ONLY (excludes deposits) — current Financial Year (April to March)
            // Note: booking.amount = monthly rent; booking.depositAmount = security deposit (separate field)
            // Per CA/GST standards, security deposits are liabilities — NOT revenue
            prisma.booking.findMany({
                where: {
                    property: { ownerId: userId },
                    status: { in: ['BOOKING_CONFIRMED', 'CHECKED_IN', 'PAID', 'CASH_PAID', 'COMPLETED'] },
                    createdAt: { 
                        gte: (() => {
                            // Indian Financial Year exactly from April 1st 00:00:00 IST
                            const now = new Date();
                            const currentMonth = now.getMonth(); // 0-indexed (3 = April)
                            const startYear = currentMonth >= 3 ? now.getFullYear() : now.getFullYear() - 1;
                            // April 1st 00:00:00 IST is March 31st 18:30:00 UTC
                            return new Date(Date.UTC(startYear, 2, 31, 18, 30, 0, 0));
                        })()
                    }
                },
                select: { createdAt: true, amount: true, depositAmount: true }
            }),
            // Fallback bed count from room configuration
            prisma.room.aggregate({
                where: { property: { ownerId: userId, status: { in: ['LIVE', 'APPROVED'] } } },
                _sum: { totalBeds: true }
            }),
            // Security Deposits Held — refundable liability, NOT revenue
            // Fetch ALL paid deposits; subtract any refundAmount already returned to tenant.
            // Net held = amount - (refundAmount already processed). This is the true liability.
            // Per Indian CA / GST standards: deposits are Balance Sheet liabilities, never P&L.
            ownerPropertyIds.length > 0
                ? (prisma as any).securityDeposit.findMany({
                    where: {
                        billingProfile: { propertyId: { in: ownerPropertyIds } },
                        status: 'PAID',           // collected from tenant
                        // Include all — full/partial refunds handled in JS below
                    },
                    select: { amount: true, refundAmount: true, refundStatus: true }
                  })
                : Promise.resolve([]),
        ]);

        // ── Revenue: group bookings by month ─────────────────────────────
        // CA Rule: booking.amount = rent only. depositAmount is a liability.
        // Revenue = sum of rent amounts from confirmed bookings.
        const monthMap: Record<string, number> = {};
        for (const booking of confirmedBookings) {
            const d = new Date(booking.createdAt);
            const key = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
            // Use rent amount only (booking.amount is rent, depositAmount is stored separately)
            const rentAmount = Number(booking.amount || 0);
            monthMap[key] = (monthMap[key] || 0) + rentAmount;
        }

        // Last 6 months in order
        const revenueHistory = Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - (5 - i));
            const key = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
            return { month: d.toLocaleString('en-IN', { month: 'short' }), revenue: monthMap[key] || 0 };
        });

        // Total rent revenue (Financial Year window)
        const totalRevenue = confirmedBookings.reduce((s: number, b: any) => s + Number(b.amount || 0), 0);

        // ── Security Deposits Held (Liability — not revenue) ─────────────
        // Net held = amount collected − amount already refunded back to tenant.
        // Example: ₹40,000 deposit collected, ₹5,000 partially refunded → Net held = ₹35,000
        // A fully refunded deposit (refundStatus=FULL_REFUND, refundAmount=amount) → nets to 0.
        const totalDepositsHeld = (depositsHeldRecords as any[]).reduce(
            (sum: number, dep: any) => {
                const collected = Number(dep.amount || 0);
                const alreadyRefunded = Number(dep.refundAmount || 0);
                const netHeld = Math.max(0, collected - alreadyRefunded); // never go negative
                return sum + netHeld;
            },
            0
        );

        // ── Occupancy: prefer real bed records; fallback to room config ────
        const effectiveTotalBeds = totalBeds > 0 ? totalBeds : (roomTotalBeds._sum?.totalBeds ?? 0);
        const effectiveOccupied = Math.min(occupiedBeds, effectiveTotalBeds);
        const vacantBeds = Math.max(0, effectiveTotalBeds - effectiveOccupied);

        // If NO beds at all, show a placeholder so chart isn't blank
        const occupancyStats = effectiveTotalBeds > 0
            ? [
                { name: "Occupied Beds", value: effectiveOccupied },
                { name: "Vacant Beds", value: vacantBeds },
            ]
            : [
                { name: "No Beds Added", value: 1 },
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
                displayId: true
            }
        });

        return {
            propertyCount,
            tenantCount,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalDepositsHeld: Math.round(totalDepositsHeld * 100) / 100,
            totalBeds: effectiveTotalBeds,
            availableBeds: vacantBeds,
            occupiedBeds: effectiveOccupied,
            pendingBookingCount,
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
            totalDepositsHeld: 0,
            totalBeds: 0,
            availableBeds: 0,
            occupiedBeds: 0,
            pendingBookingCount: 0,
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

        // Terminal booking statuses — bed MUST be AVAILABLE when booking is in any of these
        const TERMINAL = new Set(['CANCELLED', 'REJECTED', 'COMPLETED', 'CHECKED_OUT', 'VACATED']);
        const STALE_STATUSES = ['RESERVED', 'LOCKED', 'TEMP_LOCKED', 'OCCUPIED'];

        // Detect stale beds: booking is terminal but bed is still locked/reserved/occupied
        const staleBedIds: string[] = [];
        for (const prop of properties) {
            for (const room of prop.rooms) {
                for (const bed of room.beds) {
                    if (!STALE_STATUSES.includes(bed.status)) continue;
                    const bookingId = bed.currentBookingId || bed.lockedByBookingId;
                    const booking = bookingId ? bookingsMap.get(bookingId) : undefined;
                    const isTerminalBooking = booking && TERMINAL.has(booking.status);
                    // OCCUPIED with no tenant linked = ghost bed, also heal it
                    const isGhostOccupied = bed.status === 'OCCUPIED' && !bed.tenantId;
                    if (isTerminalBooking || isGhostOccupied) {
                        staleBedIds.push(bed.id);
                    }
                }
            }
        }

        // Auto-heal stale beds in DB — fire-and-forget, doesn't block UI response
        if (staleBedIds.length > 0) {
            prisma.bed.updateMany({
                where: { id: { in: staleBedIds } },
                data: {
                    status: 'AVAILABLE',
                    lockedByBookingId: null,
                    lockedAt: null,
                    lockExpiresAt: null,
                    currentBookingId: null,
                    tenantId: null,
                }
            }).catch((e: any) => console.error('Auto-heal stale beds failed:', e));
        }

        const staleBedSet = new Set(staleBedIds);

        // Attach booking data to each bed — healed beds return as green AVAILABLE immediately
        const enrichedProperties = properties.map(prop => ({
            ...prop,
            rooms: prop.rooms.map(room => ({
                ...room,
                beds: room.beds.map(bed => {
                    // Stale/ghost bed → force green in UI right now
                    if (staleBedSet.has(bed.id)) {
                        return { ...bed, status: 'AVAILABLE', currentBookingId: null, lockedByBookingId: null, tenantId: null, tenant: null, booking: null };
                    }
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

export async function getRevenueTrends(yearStr?: string, monthStr?: string) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");
        const userId = session.userId;

        const now = new Date();
        let startDate: Date;
        let endDate: Date;
        let isWeekly = false;

        const parsedYear = parseInt(yearStr || "");
        const year = isNaN(parsedYear) ? (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1) : parsedYear;

        if (monthStr && monthStr !== 'all') {
            const parsedMonth = parseInt(monthStr);
            if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
                throw new Error("Invalid month parameter");
            }
            const queryYear = parsedMonth < 4 ? year + 1 : year; // Jan-Mar belong to the next calendar year
            // Specific month -> Weekly breakdown (Exact IST boundaries)
            // Start of month IST (UTC: prev month last day 18:30)
            startDate = new Date(Date.UTC(queryYear, parsedMonth - 2, new Date(queryYear, parsedMonth - 1, 0).getDate(), 18, 30, 0, 0));
            // End of month IST (UTC: last day 18:29:59.999)
            endDate = new Date(Date.UTC(queryYear, parsedMonth - 1, new Date(queryYear, parsedMonth, 0).getDate(), 18, 29, 59, 999));
            isWeekly = true;
        } else {
            // All months -> Monthly breakdown for the selected Financial Year (Exact IST boundaries)
            // If year passed is 2026, it means FY 2026-27 (April 2026 to March 2027)
            startDate = new Date(Date.UTC(year, 2, 31, 18, 30, 0, 0)); // Apr 1st 00:00 IST
            endDate = new Date(Date.UTC(year + 1, 2, 31, 18, 29, 59, 999)); // Mar 31st 23:59 IST
        }

        const bookings = await prisma.booking.findMany({
            where: {
                property: { ownerId: userId },
                status: { in: ['BOOKING_CONFIRMED', 'CHECKED_IN', 'PAID', 'CASH_PAID', 'COMPLETED'] },
                createdAt: { gte: startDate, lte: endDate }
            },
            select: { createdAt: true, amount: true }
        });

        if (isWeekly) {
            // group by week (Week 1: 1-7, Week 2: 8-14, Week 3: 15-21, Week 4: 22+)
            let w1 = 0, w2 = 0, w3 = 0, w4 = 0;
            for (const b of bookings) {
                const day = new Date(b.createdAt).getDate();
                const amt = Number(b.amount || 0);
                if (day <= 7) w1 += amt;
                else if (day <= 14) w2 += amt;
                else if (day <= 21) w3 += amt;
                else w4 += amt;
            }
            return [
                { month: 'Week 1 (1-7)', revenue: w1 },
                { month: 'Week 2 (8-14)', revenue: w2 },
                { month: 'Week 3 (15-21)', revenue: w3 },
                { month: 'Week 4 (22+)', revenue: w4 },
            ];
        } else {
            // group by month
            const monthMap: Record<string, number> = {};
            for(let i = 0; i < 12; i++) {
                const d = new Date(year, 3 + i, 1); // April = 3
                const mName = d.toLocaleString('en-IN', { month: 'short' });
                monthMap[mName] = 0;
            }
            for (const b of bookings) {
                const d = new Date(b.createdAt);
                const mName = d.toLocaleString('en-IN', { month: 'short' });
                monthMap[mName] += Number(b.amount || 0);
            }
            // Return in chronological order
            return Object.keys(monthMap).map(k => ({ month: k, revenue: monthMap[k] }));
        }
    } catch (e) {
        console.error("getRevenueTrends Error:", e);
        return [];
    }
}
