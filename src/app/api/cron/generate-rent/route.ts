/**
 * CRON: /api/cron/generate-rent
 * Schedule: 0 6 1 * *  (6 AM IST on the 1st of every month)
 *
 * UNIFIED CALENDAR-MONTH BILLING — RentRecord layer
 * ─────────────────────────────────────────────────────────────────────────────
 * This companion cron generates RentRecord rows (legacy rent-tracking table)
 * in sync with the RentInvoice layer above.
 *
 * RentRecord is the simpler record used by:
 *   - Owner dashboard rent collection table
 *   - Tenant history / payment tracking
 *
 * Skip conditions (fully idempotent):
 *   - Tenant not 'Active' → skip
 *   - RentRecord for this month already exists → skip
 *
 * Security: CRON_SECRET bearer or query-param secret
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    // ── Security ──────────────────────────────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    const authHeader = request.headers.get("Authorization");

    if (
        secret !== process.env.CRON_SECRET &&
        authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    // Human-readable month label e.g. "June 2026"
    const monthLabel = now.toLocaleString("en-IN", { month: "long", year: "numeric" });

    // ── All active tenants ────────────────────────────────────────────────────
    const activeTenants = await prisma.tenant.findMany({
        where: { status: "Active" },
        include: {
            booking: { select: { id: true, userId: true } },
        },
    });

    const results = {
        month: monthLabel,
        total: activeTenants.length,
        created: 0,
        skipped: 0,
        failed: 0,
    };

    for (const tenant of activeTenants) {
        try {
            // Idempotent: skip if already created for this month
            const existing = await prisma.rentRecord.findFirst({
                where: { tenantId: tenant.id, month: monthLabel },
            });

            if (existing) {
                results.skipped++;
                continue;
            }

            // Full-month rent record (first month proration handled at move-in)
            await prisma.rentRecord.create({
                data: {
                    tenantId: tenant.id,
                    month: monthLabel,
                    amount: tenant.rent,
                    paid: false,
                },
            });

            // ── In-app notification ──────────────────────────────────────────
            if (tenant.booking?.userId) {
                await prisma.notification.create({
                    data: {
                        userId: tenant.booking.userId,
                        type: "RENT_DUE",
                        category: "RENT_REMINDER",
                        message: `🏠 Rent for ${monthLabel} (₹${Number(tenant.rent).toLocaleString("en-IN")}) is due. Please pay by the 5th to avoid late fees.`,
                        isPersistent: false,
                        targetRole: "USER",
                    },
                }).catch(() => {}); // non-fatal: notification failure must never block billing
            }

            results.created++;
        } catch (err: any) {
            console.error(`[CRON generate-rent] Failed for tenant ${tenant.id}:`, err?.message);
            results.failed++;
        }
    }

    console.log(`[CRON generate-rent] ${monthLabel}:`, results);

    return NextResponse.json({ success: true, ...results });
}
