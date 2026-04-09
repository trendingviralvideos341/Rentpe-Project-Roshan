import { NextRequest, NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export const dynamic = 'force-dynamic';

// Vercel Cron: runs daily at 9:00 AM IST (3:30 AM UTC)
// vercel.json: { "crons": [{ "path": "/api/cron/rent-reminders", "schedule": "30 3 * * *" }] }

export async function GET(req: NextRequest) {
    // Authenticate cron request
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let processed = 0;
    const errors: string[] = [];

    // ── Upcoming payment reminders ──────────────────────────
    const sevenDaysOut = new Date(today);
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 8);

    const pendingInvoices = await prisma.rentInvoice.findMany({
        where: {
            status: 'PENDING',
            dueDate: { gte: today, lte: sevenDaysOut },
        },
        include: {
            booking: { include: { user: true, property: { select: { name: true } } } }
        }
    });

    for (const invoice of pendingInvoices) {
        try {
            const daysUntilDue = Math.ceil((invoice.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            let reminderType: string | null = null;
            if (daysUntilDue === 7) reminderType = '7_DAYS_BEFORE';
            else if (daysUntilDue === 3) reminderType = '3_DAYS_BEFORE';
            else if (daysUntilDue === 0) reminderType = 'DUE_TODAY';

            if (!reminderType) continue;

            // Idempotency: skip if already sent today
            const alreadySent = await prisma.rentReminder.findFirst({
                where: { invoiceId: invoice.id, type: reminderType }
            });
            if (alreadySent) continue;

            const user = invoice.booking?.user;
            if (!user) continue;

            const message = daysUntilDue === 0
                ? `🔔 Your rent of ₹${invoice.amount} for ${invoice.month || invoice.billingMonth} is DUE TODAY!`
                : `📅 Reminder: Rent of ₹${invoice.amount} for ${invoice.month || invoice.billingMonth} is due in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}.`;

            // In-app notification
            await prisma.notification.create({
                data: {
                    userId: user.id,
                    type: 'RENT_DUE_REMINDER',
                    category: 'PAYMENT',
                    message,
                    isPersistent: true,
                }
            });

            // Email reminder
            if (user.email) {
                await sendEmail({
                    to: user.email,
                    subject: daysUntilDue === 0
                        ? `🔔 Rent Due Today — ₹${invoice.amount} | RentPe`
                        : `📅 Rent Due in ${daysUntilDue} Day${daysUntilDue > 1 ? 's' : ''} — RentPe`,
                    html: `
                        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: auto; padding: 24px; background: #f8fafc; border-radius: 16px;">
                            <div style="background: linear-gradient(135deg, #3b5bdb, #7048e8); padding: 24px; border-radius: 12px; margin-bottom: 20px;">
                                <h1 style="color: white; margin: 0; font-size: 22px;">RentPe Rent Reminder</h1>
                            </div>
                            <p style="color: #374151;">Hi ${user.name || 'Tenant'},</p>
                            <p style="color: #374151;">${message}</p>
                            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 20px 0;">
                                <p style="margin: 0; color: #6b7280; font-size: 13px;">Month</p>
                                <p style="margin: 4px 0 12px; font-weight: 700; color: #111827;">${invoice.month || invoice.billingMonth}</p>
                                <p style="margin: 0; color: #6b7280; font-size: 13px;">Amount Due</p>
                                <p style="margin: 4px 0 12px; font-weight: 700; color: #111827; font-size: 20px;">₹${invoice.amount.toLocaleString('en-IN')}</p>
                                <p style="margin: 0; color: #6b7280; font-size: 13px;">Due Date</p>
                                <p style="margin: 4px 0; font-weight: 700; color: ${daysUntilDue === 0 ? '#dc2626' : '#111827'};">${invoice.dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            </div>
                            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/student/payments" style="display: inline-block; background: #3b5bdb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; margin-top: 8px;">Pay Now →</a>
                            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">RentPe — Smart PG Management Platform</p>
                        </div>
                    `
                }).catch(e => console.error('Email error:', e));
            }

            // Log the reminder
            await prisma.rentReminder.create({
                data: {
                    invoiceId: invoice.id,
                    userId: user.id,
                    type: reminderType,
                    channel: 'EMAIL_AND_NOTIFICATION',
                }
            });

            processed++;
        } catch (e: any) {
            errors.push(`Invoice ${invoice.id}: ${e.message}`);
        }
    }

    // ── Overdue reminders ────────────────────────────────────
    const overdueInvoices = await prisma.rentInvoice.findMany({
        where: {
            status: 'PENDING',
            dueDate: { lt: today },
        },
        include: {
            booking: { include: { user: true } }
        }
    });

    for (const invoice of overdueInvoices) {
        try {
            const daysOverdue = Math.ceil((today.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24));
            let reminderType: string | null = null;
            if (daysOverdue === 1) reminderType = 'OVERDUE_1_DAY';
            else if (daysOverdue === 3) reminderType = 'OVERDUE_3_DAYS';
            else if (daysOverdue === 7) reminderType = 'OVERDUE_7_DAYS';

            if (!reminderType) continue;

            const alreadySent = await prisma.rentReminder.findFirst({
                where: { invoiceId: invoice.id, type: reminderType }
            });
            if (alreadySent) continue;

            const userId = invoice.booking?.user?.id;
            if (!userId) continue;

            await prisma.notification.create({
                data: {
                    userId,
                    type: 'RENT_OVERDUE',
                    category: 'PAYMENT',
                    message: `⚠️ Your rent of ₹${invoice.amount} for ${invoice.month || invoice.billingMonth} is ${daysOverdue} day(s) OVERDUE. Please pay immediately to avoid penalties.`,
                    isPersistent: true,
                }
            });

            await prisma.rentReminder.create({
                data: {
                    invoiceId: invoice.id,
                    userId,
                    type: reminderType,
                    channel: 'NOTIFICATION',
                }
            });

            processed++;
        } catch (e: any) {
            errors.push(`Overdue ${invoice.id}: ${e.message}`);
        }
    }

    return NextResponse.json({
        success: true,
        processed,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString(),
    });
}
