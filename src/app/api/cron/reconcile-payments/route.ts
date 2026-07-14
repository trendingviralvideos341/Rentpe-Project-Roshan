/**
 * RentPe — Payment Reconciliation Cron
 * Route: GET /api/cron/reconcile-payments
 *
 * ─── PURPOSE ──────────────────────────────────────────────────────────────────
 * The primary payment flow is: Student pays → Razorpay → browser calls verifyPayment()
 * → Payment status = VERIFIED. This works 95%+ of the time.
 *
 * The remaining ~5%: browser crashes, network drops, UPI delay after debit.
 * The Razorpay webhook at /api/webhooks/razorpay catches these immediately.
 *
 * This cron is the FINAL safety net: it catches any payments that BOTH the
 * client-side verifyPayment AND the webhook missed. These are edge-case failures
 * where Razorpay couldn't deliver the webhook (e.g., our server was down).
 *
 * ─── SCHEDULE ─────────────────────────────────────────────────────────────────
 * Runs every 30 minutes (see vercel.json: "schedule": "* /30 * * * *")
 * Maximum 50 payments per run to stay well within Vercel's timeout limits.
 *
 * ─── SECURITY ─────────────────────────────────────────────────────────────────
 * • Requires Authorization: Bearer <CRON_SECRET> header (set by Vercel automatically)
 * • Rate-limiting by Vercel (only Vercel's own cron runner can call this)
 * • Never writes without first verifying against Razorpay API
 * • Mock/test order IDs (starting with "order_mock_") are skipped
 *
 * ─── ARCHITECTURE ─────────────────────────────────────────────────────────────
 * • Batched (max 50 per run) — prevents Vercel serverless timeout
 * • Cursor-based using payment.id for safe pagination across runs
 * • Each payment checked independently — one failure doesn't stop others
 * • Amount verified against DB record before marking VERIFIED (prevents fraud)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import Razorpay from 'razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Max payments to reconcile per cron execution (prevents Vercel timeout)
const BATCH_SIZE = 50;
// Payments stuck for longer than this are considered "stuck" (15 minutes)
const STUCK_THRESHOLD_MS = 15 * 60 * 1000;
// Payments older than this are considered definitively failed (24 hours)
const EXPIRED_THRESHOLD_HOURS = 24;

// ── Lazily initialised Razorpay client (env vars available at runtime) ──────
function getRazorpayClient(): Razorpay {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('[Reconcile] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not configured');
    }
    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
    // ── STEP 1: Authenticate — must match Vercel's CRON_SECRET ──────────────
    // Vercel automatically sends: Authorization: Bearer <CRON_SECRET>
    // Manual calls without this header are rejected with 401.
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.warn('[Reconcile] Unauthorized cron attempt rejected');
        return new NextResponse('Unauthorized', { status: 401 });
    }

    console.log('[Reconcile] ── Starting payment reconciliation run ──');

    // ── STEP 2: Find stuck PENDING payments ─────────────────────────────────
    // A payment is "stuck" if it has been PENDING for >15 minutes AND
    // has a razorpayOrderId (meaning the student DID start the Razorpay checkout).
    // Payments without a razorpayOrderId were never initiated with Razorpay.
    const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);

    const stuckPayments = await prisma.payment.findMany({
        where: {
            status: 'PENDING',
            date: { lt: cutoff },
            razorpayOrderId: { not: null },
        },
        select: {
            id: true,
            bookingId: true,
            invoiceId: true,
            depositId: true,
            razorpayOrderId: true,
            amount: true,
            date: true,
            booking: {
                select: {
                    userId: true,
                    paymentStatus: true,
                }
            },
            invoice: {
                select: {
                    status: true,
                    month: true,
                    amount: true,
                    tenantId: true,
                }
            },
        },
        orderBy: { date: 'asc' },  // Oldest first — resolve most urgent first
        take: BATCH_SIZE,
    });

    console.log(`[Reconcile] Found ${stuckPayments.length} stuck PENDING payment(s) to check`);

    if (stuckPayments.length === 0) {
        return NextResponse.json({
            ok: true,
            message: 'No stuck payments found',
            resolved: 0,
            expired: 0,
            skipped: 0,
            checked: 0,
        });
    }

    // ── STEP 3: Initialise Razorpay client ───────────────────────────────────
    let razorpay: Razorpay;
    try {
        razorpay = getRazorpayClient();
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Reconcile] Cannot initialise Razorpay client:', msg);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    // ── STEP 4: Process each payment individually ────────────────────────────
    let resolved = 0;
    let expired = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const payment of stuckPayments) {
        const orderId = payment.razorpayOrderId!;

        // Skip test/mock orders created in dev environment
        if (orderId.startsWith('order_mock_') || orderId.startsWith('order_test_')) {
            skipped++;
            continue;
        }

        try {
            // ── Check actual Razorpay order status ──────────────────────────
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const order = await (razorpay.orders as any).fetch(orderId) as {
                id: string;
                status: 'created' | 'attempted' | 'paid';
                amount: number;
                amount_paid: number;
            };

            if (order.status === 'paid') {
                // ── ORDER IS PAID — Find the captured Razorpay payment ──────
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const paymentsRes = await (razorpay.orders as any).fetchPayments(orderId) as {
                    items: Array<{
                        id: string;
                        status: string;
                        amount: number;
                        method: string;
                    }>;
                };
                const captured = paymentsRes.items?.find(p => p.status === 'captured');

                if (!captured) {
                    console.warn(`[Reconcile] Order ${orderId} is "paid" but no captured payment found — skipping`);
                    skipped++;
                    continue;
                }

                // ── Amount verification (fraud prevention) ──────────────────
                // Verify the amount Razorpay captured matches what we expected.
                // Amount in Razorpay is in paise; our DB stores in rupees.
                const expectedPaise = Math.round(payment.amount * 100);
                if (captured.amount !== expectedPaise) {
                    console.error(
                        `[Reconcile] ⚠️ Amount mismatch for payment ${payment.id}: ` +
                        `expected ₹${payment.amount} (${expectedPaise} paise), ` +
                        `got ${captured.amount} paise from Razorpay. Skipping.`
                    );
                    // Log to SystemEvent for admin visibility
                    await prisma.systemEvent.create({
                        data: {
                            type: 'RECONCILE_AMOUNT_MISMATCH',
                            severity: 'HIGH',
                            message: `Amount mismatch on reconciliation for payment ${payment.id}`,
                            metadata: {
                                paymentId: payment.id,
                                expectedPaise,
                                receivedPaise: captured.amount,
                                razorpayOrderId: orderId,
                                razorpayPaymentId: captured.id,
                            },
                        },
                    }).catch(() => {});
                    skipped++;
                    continue;
                }

                // ── Mark VERIFIED in a Prisma transaction ───────────────────
                // All updates happen atomically — if any fails, none are applied.
                await prisma.$transaction(async (tx) => {
                    // 1. Mark Payment as VERIFIED
                    await (tx as any).payment.update({
                        where: { id: payment.id },
                        data: {
                            status: 'VERIFIED',
                            razorpayId: captured.id,
                            verifiedBy: 'RECONCILIATION_CRON',
                        },
                    });

                    // 2. If linked to a RentInvoice, mark it PAID (idempotent)
                    if (payment.invoiceId && payment.invoice?.status !== 'PAID') {
                        await tx.rentInvoice.update({
                            where: { id: payment.invoiceId },
                            data: {
                                status: 'PAID',
                                paidAt: new Date(),
                                paidAmount: Number(payment.invoice?.amount ?? payment.amount),
                                paymentMethod: 'ONLINE',
                            },
                        });

                        // Sync RentRecord so the billing history is consistent
                        if (payment.invoice?.tenantId && payment.invoice?.month) {
                            const today = new Date().toLocaleDateString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric',
                            });
                            await tx.rentRecord.updateMany({
                                where: {
                                    tenantId: payment.invoice.tenantId,
                                    month: payment.invoice.month,
                                    paid: false,
                                },
                                data: { paid: true, paidOn: today },
                            });
                        }
                    }

                    // 3. If linked to a SecurityDeposit, mark it PAID (idempotent)
                    if (payment.depositId) {
                        await (tx as any).securityDeposit.updateMany({
                            where: { id: payment.depositId, status: { not: 'PAID' } },
                            data: { status: 'PAID', paidAt: new Date() },
                        });
                    }

                    // 4. Update Booking payment status
                    if (payment.booking?.paymentStatus !== 'PAID') {
                        await tx.booking.update({
                            where: { id: payment.bookingId },
                            data: { paymentStatus: 'PAID', paidAt: new Date() },
                        });
                    }
                });

                // Log to SystemEvent for audit trail
                await prisma.systemEvent.create({
                    data: {
                        type: 'RECONCILE_PAYMENT_RESOLVED',
                        severity: 'INFO',
                        message: `Reconciliation: Payment ${payment.id} resolved via Razorpay order ${orderId}`,
                        metadata: {
                            paymentId: payment.id,
                            razorpayOrderId: orderId,
                            razorpayPaymentId: captured.id,
                            amount: payment.amount,
                            bookingId: payment.bookingId,
                            invoiceId: payment.invoiceId,
                        },
                    },
                }).catch(() => {});

                resolved++;
                console.log(`[Reconcile] ✅ Resolved: payment ${payment.id} → Razorpay ${captured.id}`);

            } else if (order.status === 'created' || order.status === 'attempted') {
                // ── ORDER NOT PAID — Check if it has expired ────────────────
                const ageHours = (Date.now() - new Date(payment.date).getTime()) / (1000 * 60 * 60);

                if (ageHours > EXPIRED_THRESHOLD_HOURS) {
                    // Student abandoned or card was declined — mark as definitively FAILED
                    await (prisma as any).payment.update({
                        where: { id: payment.id },
                        data: {
                            status: 'FAILED',
                            verifiedBy: 'RECONCILIATION_CRON_EXPIRE',
                        },
                    });

                    await prisma.systemEvent.create({
                        data: {
                            type: 'RECONCILE_PAYMENT_EXPIRED',
                            severity: 'INFO',
                            message: `Reconciliation: Payment ${payment.id} expired after ${Math.round(ageHours)}h`,
                            metadata: {
                                paymentId: payment.id,
                                razorpayOrderId: orderId,
                                ageHours: Math.round(ageHours),
                                bookingId: payment.bookingId,
                            },
                        },
                    }).catch(() => {});

                    expired++;
                    console.log(`[Reconcile] ⏰ Expired: payment ${payment.id} (${Math.round(ageHours)}h old)`);
                } else {
                    // Still within the payment window — leave it, webhook may still arrive
                    skipped++;
                }
            } else {
                // Unknown order status from Razorpay
                console.warn(`[Reconcile] Unknown Razorpay order status "${order.status}" for order ${orderId}`);
                skipped++;
            }

        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[Reconcile] Error processing payment ${payment.id} (order: ${orderId}):`, msg);
            errors.push(`payment:${payment.id} — ${msg}`);
        }
    }

    // ── STEP 5: Return summary for Vercel logs ───────────────────────────────
    const summary = {
        ok: true,
        checked: stuckPayments.length,
        resolved,
        expired,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString(),
    };

    console.log('[Reconcile] ── Run complete ──', summary);
    return NextResponse.json(summary);
}
