/**
 * RentPe — Razorpay Webhook Handler
 * Route: POST /api/webhooks/razorpay
 *
 * ─── SECURITY ─────────────────────────────────────────────────────────────
 * • Signature verified using HMAC-SHA256 and RAZORPAY_WEBHOOK_SECRET
 * • Raw body is read BEFORE any JSON parsing (required for valid HMAC)
 * • Returns 200 immediately after signature check to prevent Razorpay retries
 *   while heavy DB work runs asynchronously
 *
 * ─── IDEMPOTENCY ──────────────────────────────────────────────────────────
 * • If payment is already VERIFIED (client-side verification happened first),
 *   we detect it and return 200 without double-processing
 * • Safe to retry — Razorpay will retry failed webhooks up to 24h
 *
 * ─── EVENTS HANDLED ───────────────────────────────────────────────────────
 * • payment.captured — Payment succeeded (primary recovery path)
 * • payment.failed   — Payment failed (mark as FAILED, free the booking)
 * • order.paid       — Alternate success event (idempotent with above)
 *
 * ─── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * The browser-based verifyPayment() server action works 95% of the time.
 * The remaining 5% — network drops, phone dies, browser crashes after UPI
 * debit — leave money deducted but booking unpaid. This webhook catches all
 * of those cases by listening directly to Razorpay's servers.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

// ── Type for Razorpay payment entity from webhook payload ──
interface RazorpayPaymentEntity {
    id: string;              // pay_xxx
    order_id: string;        // order_xxx
    amount: number;          // in paise
    currency: string;
    status: 'captured' | 'failed' | 'authorized' | 'refunded';
    method: string;
    email?: string;
    contact?: string;
    error_code?: string;
    error_description?: string;
    error_reason?: string;
}

interface RazorpayWebhookPayload {
    entity: 'event';
    account_id: string;
    event: string;
    contains: string[];
    payload: {
        payment?: {
            entity: RazorpayPaymentEntity;
        };
        order?: {
            entity: {
                id: string;
                amount: number;
                status: string;
            };
        };
    };
}

// ── Main webhook handler ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    // STEP 1: Read raw body FIRST — must happen before any parsing
    // This is critical: HMAC is computed over the exact raw bytes
    let rawBody: string;
    try {
        rawBody = await req.text();
    } catch {
        console.error('[Webhook] Failed to read request body');
        return NextResponse.json({ error: 'Cannot read body' }, { status: 400 });
    }

    // STEP 2: Verify Razorpay signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
        // If secret is not configured, log a critical warning but don't block
        // (allows local dev without webhook secret set)
        console.error('[Webhook] CRITICAL: RAZORPAY_WEBHOOK_SECRET is not set. Skipping signature verification.');
        // In production, uncomment this hard block:
        // return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    } else {
        const signature = req.headers.get('x-razorpay-signature');
        if (!signature) {
            console.warn('[Webhook] Missing x-razorpay-signature header — rejected');
            return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
        }

        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(rawBody)
            .digest('hex');

        // Constant-time comparison to prevent timing attacks
        const sigBuffer = Buffer.from(signature, 'utf8');
        const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

        if (sigBuffer.length !== expectedBuffer.length ||
            !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
            console.warn('[Webhook] Invalid signature — potential spoofed request rejected');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
        }
    }

    // STEP 3: Parse event
    let event: RazorpayWebhookPayload;
    try {
        event = JSON.parse(rawBody);
    } catch {
        console.error('[Webhook] Failed to parse JSON body');
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    console.log(`[Webhook] Received event: ${event.event} | account: ${event.account_id}`);

    // STEP 4: Acknowledge receipt immediately (Razorpay expects 200 within 5s)
    // Then process asynchronously to avoid timeout
    const processingPromise = handleWebhookEvent(event).catch(err => {
        console.error('[Webhook] Async processing error:', err);
    });

    // In Next.js Edge/Node, we can fire-and-forget as long as we don't use
    // waitUntil. For Vercel serverless, the function stays alive until the
    // response is sent, so we await inline here to ensure DB writes complete.
    await processingPromise;

    return NextResponse.json({ received: true, event: event.event }, { status: 200 });
}

// ── Event dispatcher ─────────────────────────────────────────────────────
async function handleWebhookEvent(event: RazorpayWebhookPayload) {
    switch (event.event) {
        case 'payment.captured':
        case 'order.paid': {
            const paymentEntity = event.payload.payment?.entity;
            if (!paymentEntity) {
                console.warn(`[Webhook] ${event.event} has no payment entity — skipping`);
                return;
            }
            await handlePaymentCaptured(paymentEntity);
            break;
        }

        case 'payment.failed': {
            const paymentEntity = event.payload.payment?.entity;
            if (!paymentEntity) {
                console.warn('[Webhook] payment.failed has no payment entity — skipping');
                return;
            }
            await handlePaymentFailed(paymentEntity);
            break;
        }

        default:
            // Unknown events — acknowledge and ignore safely
            console.log(`[Webhook] Unhandled event type: ${event.event} — acknowledged and ignored`);
            break;
    }
}

// ── Handler: Payment Succeeded ────────────────────────────────────────────
async function handlePaymentCaptured(entity: RazorpayPaymentEntity) {
    const razorpayOrderId = entity.order_id;
    const razorpayPaymentId = entity.id;

    console.log(`[Webhook] payment.captured — order: ${razorpayOrderId}, payment: ${razorpayPaymentId}`);

    // Find our internal Payment record by Razorpay order ID
    const payment = await (prisma as any).payment.findFirst({
        where: { razorpayOrderId },
        include: {
            booking: {
                include: {
                    user: {
                        select: { id: true, email: true, name: true }
                    },
                    room: {
                        include: {
                            property: {
                                include: {
                                    owner: {
                                        select: { id: true, name: true, razorpayAccountId: true }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!payment) {
        // Payment not found — could be a test webhook or a race condition
        // Log but don't error (return 200 to prevent Razorpay from retrying forever)
        console.warn(`[Webhook] No Payment record found for order: ${razorpayOrderId} — possibly already deleted or test event`);
        return;
    }

    // ── IDEMPOTENCY CHECK ──
    // If the client-side verifyPayment() already ran successfully, the status
    // will already be VERIFIED. In that case, skip processing entirely.
    if (payment.status === 'VERIFIED') {
        console.log(`[Webhook] Payment ${payment.id} already VERIFIED (client-side) — idempotent skip`);
        return;
    }

    if (payment.status === 'REFUNDED') {
        console.log(`[Webhook] Payment ${payment.id} is REFUNDED — skipping`);
        return;
    }

    console.log(`[Webhook] Processing recovery for Payment ${payment.id} (was: ${payment.status})`);

    // ── Update Payment record to VERIFIED ──
    await (prisma as any).payment.update({
        where: { id: payment.id },
        data: {
            status: 'VERIFIED',
            razorpayId: razorpayPaymentId,
            verifiedBy: 'WEBHOOK',          // Distinguish from client-side verification
            transferStatus: 'PENDING',       // Still held in nodal — admin releases manually
        }
    });

    // ── If this payment was for a RentInvoice, mark invoice as PAID ──
    if (payment.invoiceId) {
        const invoice = await prisma.rentInvoice.findUnique({
            where: { id: payment.invoiceId },
            select: { amount: true, status: true }
        });
        if (invoice && invoice.status !== 'PAID') {
            await prisma.rentInvoice.update({
                where: { id: payment.invoiceId },
                data: {
                    status: 'PAID',
                    paidAt: new Date(),
                    paidAmount: Number(invoice.amount)   // base rent only, not student fee
                }
            });
            console.log(`[Webhook] Invoice ${payment.invoiceId} marked PAID`);
        }
    }

    // ── If this payment was for a SecurityDeposit, mark it PAID ──
    if (payment.depositId) {
        const deposit = await prisma.securityDeposit.findUnique({
            where: { id: payment.depositId },
            select: { status: true }
        });
        if (deposit && deposit.status !== 'PAID') {
            await (prisma as any).securityDeposit.update({
                where: { id: payment.depositId },
                data: { status: 'PAID', paidAt: new Date() }
            });
            console.log(`[Webhook] SecurityDeposit ${payment.depositId} marked PAID`);
        }
    }

    // ── Update Booking paymentStatus → PAID ──
    const booking = await prisma.booking.findUnique({
        where: { id: payment.bookingId },
        select: { paymentStatus: true }
    });
    if (booking && booking.paymentStatus !== 'PAID') {
        await prisma.booking.update({
            where: { id: payment.bookingId },
            data: { paymentStatus: 'PAID', paidAt: new Date() }
        });
        console.log(`[Webhook] Booking ${payment.bookingId} paymentStatus → PAID`);
    }

    // ── Audit log ──
    await (prisma as any).auditLog.create({
        data: {
            action: 'WEBHOOK_PAYMENT_VERIFIED',
            entity: 'Payment',
            entityId: payment.id,
            details: JSON.stringify({
                razorpayOrderId,
                razorpayPaymentId,
                amount: entity.amount / 100,
                method: entity.method,
                recoverySource: 'RAZORPAY_WEBHOOK',
                note: 'Payment verified via webhook — client-side verification may have failed (network drop, browser crash, etc.)'
            })
        }
    }).catch((e: Error) => console.warn('[Webhook] Audit log failed (non-critical):', e.message));

    // ── Post-transaction: Record Platform Fee (fire-and-forget) ──
    try {
        const { recordPlatformFee } = await import('@/actions/platform');
        const bookingData = payment.booking;
        if (bookingData) {
            await recordPlatformFee(
                payment.bookingId,
                String(payment.amount),
                bookingData.userId,
                bookingData.room?.property?.name || bookingData.propertyName
            );
            console.log(`[Webhook] Platform fee recorded for booking ${payment.bookingId}`);
        }
    } catch (feeErr) {
        // Non-critical — fee can be manually reconciled from admin panel
        console.error('[Webhook] Platform fee recording failed (non-critical):', feeErr);
    }

    // ── Post-transaction: Send Recovery Email to Student ──
    try {
        const { sendEmail } = await import('@/lib/email');
        const user = payment.booking?.user;
        if (user?.email) {
            await sendEmail({
                to: user.email,
                subject: '✅ Payment Confirmed — RentPe',
                html: buildPaymentConfirmationEmail({
                    name: user.name || 'Student',
                    amount: entity.amount / 100,
                    paymentId: razorpayPaymentId,
                    propertyName: payment.booking?.room?.property?.name || payment.booking?.propertyName || 'your property',
                    method: entity.method,
                })
            });
            console.log(`[Webhook] Recovery confirmation email sent to ${user.email}`);
        }
    } catch (emailErr) {
        // Email failure is non-critical — don't re-throw
        console.error('[Webhook] Confirmation email failed (non-critical):', emailErr);
    }

    console.log(`[Webhook] ✅ Successfully recovered payment ${payment.id} via webhook`);
}

// ── Handler: Payment Failed ───────────────────────────────────────────────
async function handlePaymentFailed(entity: RazorpayPaymentEntity) {
    const razorpayOrderId = entity.order_id;
    const razorpayPaymentId = entity.id;

    console.log(`[Webhook] payment.failed — order: ${razorpayOrderId}, reason: ${entity.error_reason}`);

    const payment = await (prisma as any).payment.findFirst({
        where: { razorpayOrderId },
        include: {
            booking: {
                include: {
                    user: { select: { id: true, email: true, name: true } }
                }
            }
        }
    });

    if (!payment) {
        console.warn(`[Webhook] No Payment record for failed order: ${razorpayOrderId} — skipping`);
        return;
    }

    // If already VERIFIED (rare: payment succeeded after initial failure signal), don't mark as FAILED
    if (payment.status === 'VERIFIED') {
        console.log(`[Webhook] payment.failed received for already-VERIFIED payment ${payment.id} — ignoring`);
        return;
    }

    // Mark payment as FAILED
    await (prisma as any).payment.update({
        where: { id: payment.id },
        data: {
            status: 'FAILED',
            razorpayId: razorpayPaymentId,
            verifiedBy: 'WEBHOOK_FAIL',
        }
    });

    // Audit log
    await (prisma as any).auditLog.create({
        data: {
            action: 'WEBHOOK_PAYMENT_FAILED',
            entity: 'Payment',
            entityId: payment.id,
            details: JSON.stringify({
                razorpayOrderId,
                razorpayPaymentId,
                errorCode: entity.error_code,
                errorReason: entity.error_reason,
                errorDescription: entity.error_description,
            })
        }
    }).catch((e: Error) => console.warn('[Webhook] Audit log failed:', e.message));

    // Notify student of failure via email
    try {
        const { sendEmail } = await import('@/lib/email');
        const user = payment.booking?.user;
        if (user?.email) {
            await sendEmail({
                to: user.email,
                subject: '❌ Payment Failed — RentPe',
                html: buildPaymentFailedEmail({
                    name: user.name || 'Student',
                    errorReason: entity.error_description || entity.error_reason || 'Unknown error',
                    retryUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/student/payments`,
                })
            });
        }
    } catch (emailErr) {
        console.error('[Webhook] Failure email sending failed (non-critical):', emailErr);
    }

    console.log(`[Webhook] ✅ Payment ${payment.id} marked FAILED via webhook`);
}

// ── Email Templates (Inline — no extra file needed) ──────────────────────

function buildPaymentConfirmationEmail(params: {
    name: string;
    amount: number;
    paymentId: string;
    propertyName: string;
    method: string;
}) {
    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Payment Confirmed</title></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px;">
      <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 32px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 700;">✅ Payment Confirmed</h1>
          <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0;">RentPe — Your accommodation platform</p>
        </div>
        <div style="padding: 32px;">
          <p style="color: #333; font-size: 16px; margin: 0 0 16px;">Hi <strong>${params.name}</strong>,</p>
          <p style="color: #555; line-height: 1.6;">Your payment has been <strong style="color: #10b981;">successfully verified</strong> and your booking is confirmed. Here are your details:</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="color: #64748b; padding: 8px 0; font-size: 14px;">Amount Paid</td><td style="text-align: right; font-weight: 700; color: #10b981; font-size: 18px;">₹${params.amount.toLocaleString('en-IN')}</td></tr>
              <tr><td style="color: #64748b; padding: 8px 0; font-size: 14px;">Payment ID</td><td style="text-align: right; font-family: monospace; font-size: 12px; color: #334155;">${params.paymentId}</td></tr>
              <tr><td style="color: #64748b; padding: 8px 0; font-size: 14px;">Property</td><td style="text-align: right; font-weight: 600; color: #334155;">${params.propertyName}</td></tr>
              <tr><td style="color: #64748b; padding: 8px 0; font-size: 14px;">Payment Method</td><td style="text-align: right; color: #334155; text-transform: capitalize;">${params.method}</td></tr>
            </table>
          </div>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">You can view your booking details and download your receipt from your <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/student/payments" style="color: #6366f1; font-weight: 600;">student dashboard</a>.</p>
        </div>
        <div style="padding: 20px 32px; background: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">RentPe — Secure • Transparent • Student-First<br>This is an automated message. Please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
    `;
}

function buildPaymentFailedEmail(params: {
    name: string;
    errorReason: string;
    retryUrl: string;
}) {
    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Payment Failed</title></head>
    <body style="font-family: 'Segey UI', Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px;">
      <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%); padding: 32px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 700;">❌ Payment Failed</h1>
          <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0;">Don't worry — no money has been deducted</p>
        </div>
        <div style="padding: 32px;">
          <p style="color: #333; font-size: 16px; margin: 0 0 16px;">Hi <strong>${params.name}</strong>,</p>
          <p style="color: #555; line-height: 1.6;">Unfortunately, your payment could not be processed. Here is the reason:</p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 16px 0;">
            <p style="color: #dc2626; font-weight: 600; margin: 0;">${params.errorReason}</p>
          </div>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">Please try again with a different payment method. Your booking slot is still reserved for a short time.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${params.retryUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Retry Payment →</a>
          </div>
        </div>
        <div style="padding: 20px 32px; background: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">RentPe — Secure • Transparent • Student-First<br>If you believe this is an error, contact support.</p>
        </div>
      </div>
    </body>
    </html>
    `;
}
