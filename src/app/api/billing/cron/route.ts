import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { internalGenerateInvoice } from "@/actions/billing";
import { sendEmail } from "@/lib/email";
import { InvoiceGeneratedTemplate } from "@/lib/email-templates";

/**
 * Monthly Invoice Cron
 * Trigger: Once per day (e.g., at 00:01 AM)
 * Logic: Generate invoices for all active tenants whose billingDay is today.
 */
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // SECURITY FIX [M-4]: Always require CRON_SECRET — don't bypass auth in development.
    // Unauthenticated cron execution can generate fake invoices, spam tenants with emails,
    // and corrupt financial records even in non-production environments.
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const today = new Date();
        const currentDay = today.getDate();
        const currentMonth = today.toLocaleString('default', { month: 'long' });
        const currentYear = today.getFullYear();
        const monthLabel = `${currentMonth} ${currentYear}`;

        // 1. Find all active billing profiles where billingDay matches today
        const activeProfiles = await prisma.billingProfile.findMany({
            where: {
                status: 'ACTIVE',
                billingDay: currentDay
            },
            include: {
                tenant: true
            }
        });

        const results = {
            processed: 0,
            generated: 0,
            skipped: 0,
            errors: 0,
            details: [] as any[]
        };

        for (const profile of activeProfiles) {
            results.processed++;
            try {
                // 2. Generate Invoice
                const invoiceResult = await internalGenerateInvoice(profile.tenantId, monthLabel, 'SYSTEM_CRON');

                if ('skipped' in invoiceResult) {
                    results.skipped++;
                    continue;
                }

                results.generated++;

                // 3. Send Email Notification
                if (profile.tenant.email) {
                    await sendEmail({
                        to: profile.tenant.email,
                        subject: `Rent Invoice Generated - ${monthLabel}`,
                        html: InvoiceGeneratedTemplate(
                            profile.tenant.name,
                            monthLabel,
                            profile.monthlyRent,
                            invoiceResult.dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                        )
                    });
                }

                results.details.push({ tenant: profile.tenant.name, invoice: invoiceResult.displayId });

            } catch (err: any) {
                results.errors++;
                console.error(`Cron failed for tenant ${profile.tenantId}:`, err);
            }
        }

        // 4. Log system event
        await prisma.systemEvent.create({
            data: {
                type: 'BILLING_CRON_COMPLETED',
                severity: results.errors > 0 ? 'WARNING' : 'INFO',
                message: `Monthly billing cron finished. Generated ${results.generated} invoices.`,
                metadata: JSON.stringify(results)
            }
        });

        return NextResponse.json({ success: true, ...results });

    } catch (error: any) {
        console.error('Fatal Cron Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
