/**
 * CRON: /api/cron/generate-invoices
 * Schedule: 0 6 1 * *  (6 AM IST on the 1st of every month, vercel.json)
 *
 * UNIFIED CALENDAR-MONTH BILLING
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs on the 1st of every calendar month.
 * Generates ONE full-month RentInvoice for EVERY active tenant.
 *
 * Skip logic (idempotent):
 *   - Tenant not in 'Active' status → skip
 *   - Invoice already exists for this billingMonth → skip (safe to re-run)
 *   - BillingProfile missing → skip with error log
 *
 * Security:
 *   - Bearer token via CRON_SECRET env var (Vercel cron or external scheduler)
 *   - Returns 401 immediately if header missing/wrong
 *
 * Audit:
 *   - Returns full breakdown: total, created, skipped, failed, month
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { internalGenerateInvoice } from "@/actions/billing";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    // ── Security: CRON_SECRET bearer token ──────────────────────────────────
    const auth = req.headers.get("authorization");
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    if (
        auth !== `Bearer ${process.env.CRON_SECRET}` &&
        secret !== process.env.CRON_SECRET
    ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    // YYYY-MM  e.g. "2026-06"
    const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    // Human label e.g. "June 2026"
    const monthLabel = now.toLocaleString("en-IN", { month: "long", year: "numeric" });

    // ── Fetch all active tenants with a BillingProfile ──────────────────────
    const activeTenants = await prisma.tenant.findMany({
        where: { status: "Active" },
        include: {
            billingProfile: true,
            booking: { select: { id: true, userId: true } },
        },
    });

    const results = {
        month: billingMonth,
        monthLabel,
        total: activeTenants.length,
        created: 0,
        skipped: 0,
        failed: 0,
        errors: [] as string[],
    };

    const CHUNK_SIZE = 50;
    for (let i = 0; i < activeTenants.length; i += CHUNK_SIZE) {
        const chunk = activeTenants.slice(i, i + CHUNK_SIZE);
        await Promise.allSettled(chunk.map(async (tenant) => {
            try {
                if (!tenant.billingProfile) {
                    results.skipped++;
                    results.errors.push(`${tenant.displayId}: no billing profile`);
                    return;
                }

                // internalGenerateInvoice is idempotent — skips if already exists
                const result = await internalGenerateInvoice(tenant.id, billingMonth, "SYSTEM");

                if ((result as any).skipped) {
                    results.skipped++;
                    return;
                }

                // ── Notify tenant: rent invoice generated ──
                if (tenant.booking?.userId) {
                    await prisma.notification.create({
                        data: {
                            userId: tenant.booking.userId,
                            type: "RENT_DUE",
                            category: "INVOICE_GENERATED",
                            message: `📄 Your rent invoice for ${monthLabel} has been generated. Due by the 5th. Please pay on time to avoid late fees.`,
                            isPersistent: false,
                            targetRole: "USER",
                        },
                    }).catch(() => {}); // non-fatal
                }

                results.created++;
            } catch (err: any) {
                console.error(`[CRON] Invoice generation failed for tenant ${tenant.id}:`, err?.message);
                results.failed++;
                results.errors.push(`${tenant.displayId}: ${err?.message}`);
            }
        }));
    }

    console.log(`[CRON generate-invoices] ${billingMonth}:`, results);

    return NextResponse.json({ success: true, ...results });
}
