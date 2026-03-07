import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get("secret");

        // Simple security check via query param or header
        if (secret !== process.env.CRON_SECRET && request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Current Month (e.g. "March 2026")
        const now = new Date();
        const monthYear = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

        // Get all active tenants
        const activeTenants = await prisma.tenant.findMany({
            where: { status: "ACTIVE" }
        });

        const results = {
            total: activeTenants.length,
            created: 0,
            skipped: 0,
            failed: 0
        };

        for (const tenant of activeTenants) {
            try {
                // Check if rent already exists for this month
                const existing = await prisma.rentRecord.findFirst({
                    where: {
                        tenantId: tenant.id,
                        month: monthYear
                    }
                });

                if (existing) {
                    results.skipped++;
                    continue;
                }

                // Create UNPAID rent record
                await prisma.rentRecord.create({
                    data: {
                        tenantId: tenant.id,
                        month: monthYear,
                        amount: tenant.rent,
                        paid: false
                    }
                });

                // Notify tenant
                await prisma.notification.create({
                    data: {
                        userId: (await prisma.booking.findUnique({ where: { tenantId: tenant.id } }))?.userId || "",
                        type: "RENT_DUE",
                        message: `Rent for ${monthYear} (₹${tenant.rent}) has been generated. Please pay by the 5th to avoid late fees.`
                    }
                });

                results.created++;
            } catch (err) {
                console.error(`Failed to generate rent for tenant ${tenant.id}:`, err);
                results.failed++;
            }
        }

        return NextResponse.json({
            success: true,
            month: monthYear,
            results
        });

    } catch (error) {
        console.error("Cron Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
