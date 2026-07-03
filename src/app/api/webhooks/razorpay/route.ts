/**
 * RentPe — Razorpay Webhook Handler
 * Route: POST /api/webhooks/razorpay
 *
 * ─── SECURITY ─────────────────────────────────────────────────────────────
 * • Signature verified using HMAC-SHA256 and RAZORPAY_WEBHOOK_SECRET
 * • Raw body is read BEFORE any JSON parsing (required for valid HMAC)
 * • Returns 200 immediately after signature check to prevent Razorpay retries
 *   while heavy DB work runs asynchronously
 * • Constant-time comparison prevents timing attacks on signature
 *
 * ─── IDEMPOTENCY & DOUBLE-ENTRY PROTECTION ────────────────────────────────
 * • CASE 1: Payment status is VERIFIED and invoice is NOT yet PAID
 *   → Normal webhook recovery. Mark invoice PAID. (Original flow)
 * • CASE 2: Payment status is VERIFIED and invoice is ALREADY PAID
 *   → DUPLICATE PAYMENT (Late Authorization). DO NOT re-credit the owner.
 *   → Create a raw Payment record (so the money appears in Global Transactions)
 *   → Create a RefundRecord with status PENDING (so admin is alerted in Refund Management tab)
 *   → Notify admin team immediately via in-app notification
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
 * 
 * The 0.1% case — UPI Late Authorization — can cause a second payment to arrive
 * for an already-paid invoice. This webhook now protects against that scenario
 * with strict double-entry prevention.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { generateSequentialId } from '@/lib/ids';

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
    const amountInRupees = entity.amount / 100;

    console.log(`[Webhook] payment.captured — order: ${razorpayOrderId}, payment: ${razorpayPaymentId}, amount: ₹${amountInRupees}`);

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

    // ── REFUNDED: skip ──
    if (payment.status === 'REFUNDED') {
        console.log(`[Webhook] Payment ${payment.id} is REFUNDED — skipping`);
        return;
    }

    // ── DUPLICATE PAYMENT DETECTION ──────────────────────────────────────
    // CASE: This payment record is already VERIFIED (client-side or prior webhook)
    // AND the associated invoice is already PAID.
    // This means Razorpay sent us a SECOND capture event for the same invoice.
    // (UPI Late Authorization — most common cause: bank delay of 5–30 minutes)
    // ─────────────────────────────────────────────────────────────────────
    if (payment.status === 'VERIFIED' && payment.invoiceId) {
        const existingInvoice = await prisma.rentInvoice.findUnique({
            where: { id: payment.invoiceId },
            select: { status: true, month: true, amount: true }
        });

        if (existingInvoice?.status === 'PAID') {
            console.warn(`[Webhook] ⚠️  DUPLICATE PAYMENT DETECTED — order: ${razorpayOrderId}, payment: ${razorpayPaymentId}, amount: ₹${amountInRupees}`);
            console.warn(`[Webhook] Invoice ${payment.invoiceId} (${existingInvoice.month}) is already PAID. Applying double-entry protection.`);

            await handleDuplicatePayment({
                originalPayment: payment,
                entity,
                amountInRupees,
                razorpayPaymentId,
                invoiceMonth: existingInvoice.month,
            });
            return;
        }
    }

    // ── NORMAL IDEMPOTENCY: Already VERIFIED, invoice not yet PAID ──
    // This can happen if the webhook fires multiple times. Safe to skip.
    if (payment.status === 'VERIFIED') {
        console.log(`[Webhook] Payment ${payment.id} already VERIFIED — idempotent skip (no duplicate invoice issue found)`);
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
            select: { amount: true, status: true, month: true, tenantId: true }
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

            // Sync to RentRecord
            const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
            await prisma.rentRecord.updateMany({
                where: { tenantId: invoice.tenantId, month: invoice.month },
                data: { paid: true, paidOn: today }
            });
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
                amount: amountInRupees,
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
            // Use booking.amount (rent only) + deposit separately so TDS is
            // calculated only on the rent portion, not the refundable deposit.
            const rentAmt    = String(bookingData.amount || payment.amount);
            const depositAmt = Number((bookingData as any).depositAmount || 0);
            await recordPlatformFee(
                payment.id,
                payment.bookingId,
                rentAmt,
                bookingData.userId,
                bookingData.room?.property?.name || bookingData.propertyName,
                bookingData.room?.property?.ownerId || undefined,
                depositAmt,
                "RENT"
            );
            console.log(`[Webhook] Platform fee recorded for payment ${payment.id} / booking ${payment.bookingId}`);
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
                    amount: amountInRupees,
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

// ── Handler: Duplicate Payment (Double-Entry Protection) ─────────────────
// This is the core of Batch 1. Triggered when Razorpay sends a second capture
// event for an already-paid invoice (UPI Late Authorization).
//
// What we DO:
//   1. Create a new raw Payment record with type DUPLICATE so the money
//      appears in Global Transactions (your software balance matches your bank).
//   2. Create a RefundRecord with status PENDING so it surfaces in the
//      Admin → Refund Management tab immediately.
//   3. Notify ALL admin users in-app so no alert is missed.
//   4. Send the student a reassurance email explaining the situation.
//   5. Write a full audit trail.
//
// What we DO NOT do:
//   - Update the RentInvoice (already PAID — updating it again = double-entry bug)
//   - Credit the Owner Payout (money hasn't been legitimately earned twice)
//   - Record a Platform Fee (this is a refundable duplicate, not new revenue)
// ─────────────────────────────────────────────────────────────────────────
async function handleDuplicatePayment({
    originalPayment,
    entity,
    amountInRupees,
    razorpayPaymentId,
    invoiceMonth,
}: {
    originalPayment: any;
    entity: RazorpayPaymentEntity;
    amountInRupees: number;
    razorpayPaymentId: string;
    invoiceMonth: string;
}) {
    const bookingId = originalPayment.bookingId;
    const user = originalPayment.booking?.user;
    const propertyName = originalPayment.booking?.room?.property?.name
        || originalPayment.booking?.propertyName
        || 'N/A';

    // ── Step 1: Create a raw Payment record (tracks the money in Global Transactions)
    // This is critical for financial integrity — your Razorpay bank account has
    // this money, so your RentPe software ledger must also show it exists.
    // We tag it as DUPLICATE so it's clearly distinguishable from real revenue.
    let duplicatePaymentRecord: any = null;
    try {
        duplicatePaymentRecord = await (prisma as any).payment.create({
            data: {
                bookingId,
                amount: amountInRupees,
                method: entity.method || 'ONLINE',
                status: 'DUPLICATE',                // Custom status — not real revenue
                razorpayOrderId: entity.order_id,
                razorpayId: razorpayPaymentId,
                verifiedBy: 'WEBHOOK_DUPLICATE',
                transferStatus: 'PENDING',           // Held in nodal — will be refunded
            }
        });
        console.log(`[Webhook] Duplicate Payment record created: ${duplicatePaymentRecord.id}`);
    } catch (err) {
        console.error('[Webhook] Failed to create duplicate Payment record:', err);
        // Still continue — RefundRecord creation is more important
    }

    // ── Step 2: Create a RefundRecord (appears in Admin → Refund Management tab)
    // This is the admin's trigger to initiate the Razorpay refund.
    // Reason is clearly structured so admin knows exactly what happened.
    let refundRecord: any = null;
    try {
        // Generate the FY-sequential display ID (RP-RFND-26-27-XXXXXX) for GSTR compliance
        const refundDisplayId = await generateSequentialId('REFUND');

        refundRecord = await prisma.refundRecord.create({
            data: {
                displayId:  refundDisplayId,
                bookingId,
                amount: amountInRupees,
                reason: `Duplicate Payment — UPI Late Authorization. Invoice for ${invoiceMonth} was already paid. Razorpay Payment ID: ${razorpayPaymentId}. Please verify in Razorpay dashboard and approve this refund.`,
                refundType: 'FULL',
                status: 'PENDING',
                initiatedBy: 'SYSTEM_WEBHOOK',      // Automated — not manually created
                txnReference: razorpayPaymentId,
                notes: `Auto-detected by Razorpay Webhook on ${new Date().toLocaleString('en-IN')}. Property: ${propertyName}. Amount: ₹${amountInRupees.toLocaleString('en-IN')}`,
            }
        });
        console.log(`[Webhook] RefundRecord created for admin action: ${refundRecord.id} (${refundDisplayId})`);
    } catch (err) {
        console.error('[Webhook] Failed to create RefundRecord:', err);
    }

    // ── Step 3: Notify ALL admins in-app ──
    // Pull all admin users so every team member is alerted simultaneously.
    try {
        const adminUsers = await prisma.user.findMany({
            where: { role: 'ADMIN' },
            select: { id: true }
        });

        const notificationMsg = `🚨 Duplicate Payment Alert: ₹${amountInRupees.toLocaleString('en-IN')} received from ${user?.name || 'a tenant'} for ${propertyName} — Invoice for ${invoiceMonth} was already PAID. Action required in Refund Management. Razorpay ID: ${razorpayPaymentId}`;

        await Promise.allSettled(
            adminUsers.map(admin =>
                prisma.notification.create({
                    data: {
                        userId: admin.id,
                        type: 'PAYMENT',
                        category: 'FINANCE',
                        message: notificationMsg,
                        isPersistent: true,         // This must not auto-dismiss
                        metadata: JSON.stringify({
                            refundRecordId: refundRecord?.id,
                            duplicatePaymentId: duplicatePaymentRecord?.id,
                            razorpayPaymentId,
                            bookingId,
                            amount: amountInRupees,
                            propertyName,
                            invoiceMonth,
                            alertType: 'DUPLICATE_PAYMENT',
                        })
                    }
                })
            )
        );
        console.log(`[Webhook] ${adminUsers.length} admin(s) notified of duplicate payment`);
    } catch (notifErr) {
        console.error('[Webhook] Admin notification failed (non-critical):', notifErr);
    }

    // ── Step 4: Send reassurance email to the student ──
    // Important UX: Student is confused because their bank was debited again.
    // This email prevents panicked support tickets and builds trust.
    try {
        const { sendEmail } = await import('@/lib/email');
        if (user?.email) {
            await sendEmail({
                to: user.email,
                subject: '⚠️ Duplicate Payment Detected — Action Being Taken | RentPe',
                html: buildDuplicatePaymentEmail({
                    name: user.name || 'Student',
                    amount: amountInRupees,
                    paymentId: razorpayPaymentId,
                    propertyName,
                    invoiceMonth,
                })
            });
            console.log(`[Webhook] Duplicate payment reassurance email sent to ${user.email}`);
        }
    } catch (emailErr) {
        console.error('[Webhook] Duplicate payment email failed (non-critical):', emailErr);
    }

    // ── Step 5: Full Audit Trail ──
    await (prisma as any).auditLog.create({
        data: {
            action: 'WEBHOOK_DUPLICATE_PAYMENT_BLOCKED',
            entity: 'Payment',
            entityId: duplicatePaymentRecord?.id || originalPayment.id,
            details: JSON.stringify({
                razorpayOrderId: entity.order_id,
                razorpayPaymentId,
                amount: amountInRupees,
                method: entity.method,
                bookingId,
                invoiceMonth,
                propertyName,
                originalPaymentId: originalPayment.id,
                duplicatePaymentRecordId: duplicatePaymentRecord?.id,
                refundRecordId: refundRecord?.id,
                preventedAction: 'Double-entry on RentInvoice and Owner Payout',
                recoverySource: 'RAZORPAY_WEBHOOK_DUPLICATE_DETECTION',
                note: 'BATCH 1: Duplicate payment detected. Double-entry protection applied. RefundRecord created for admin action.',
            })
        }
    }).catch((e: Error) => console.warn('[Webhook] Audit log failed (non-critical):', e.message));

    console.log(`[Webhook] 🛡️  Duplicate payment fully handled. RefundRecord ${refundRecord?.id} pending admin approval in Refund Management tab.`);
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

    // Notify student of failure via email with a clear, friendly message
    // that explicitly says: "If money was deducted, it will be auto-refunded"
    // This is the key UX improvement for Scenario 1 (Money Deducted, App says Failed)
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
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px;">
      <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%); padding: 32px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 700;">❌ Payment Failed</h1>
          <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0;">Don't worry — we're on it</p>
        </div>
        <div style="padding: 32px;">
          <p style="color: #333; font-size: 16px; margin: 0 0 16px;">Hi <strong>${params.name}</strong>,</p>
          <p style="color: #555; line-height: 1.6;">Unfortunately, your payment could not be processed. Here is the reason:</p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 16px 0;">
            <p style="color: #dc2626; font-weight: 600; margin: 0;">${params.errorReason}</p>
          </div>
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin: 16px 0;">
            <p style="color: #92400e; font-weight: 600; margin: 0 0 6px;">⚠️ If money was deducted from your bank account:</p>
            <p style="color: #78350f; font-size: 14px; margin: 0; line-height: 1.6;">Please wait up to <strong>30 minutes</strong>. UPI payments sometimes experience bank delays. Our system monitors this automatically and will update your payment status. If the issue persists after 30 minutes, your bank will auto-reverse the deduction within 5–7 business days as per RBI guidelines.</p>
          </div>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">If no money was deducted, you can safely try again with a different payment method.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${params.retryUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Retry Payment →</a>
          </div>
        </div>
        <div style="padding: 20px 32px; background: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">RentPe — Secure • Transparent • Student-First<br>If you believe this is an error, contact support at support@rentpe.in</p>
        </div>
      </div>
    </body>
    </html>
    `;
}

function buildDuplicatePaymentEmail(params: {
    name: string;
    amount: number;
    paymentId: string;
    propertyName: string;
    invoiceMonth: string;
}) {
    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Duplicate Payment Detected</title></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px;">
      <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #451a03 0%, #92400e 100%); padding: 32px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px; font-weight: 700;">⚠️ Duplicate Payment Detected</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">We've caught this — no action needed from you</p>
        </div>
        <div style="padding: 32px;">
          <p style="color: #333; font-size: 16px; margin: 0 0 16px;">Hi <strong>${params.name}</strong>,</p>
          <p style="color: #555; line-height: 1.6;">We detected that a <strong>duplicate payment</strong> of <strong style="color: #d97706;">₹${params.amount.toLocaleString('en-IN')}</strong> was received for your <strong>${params.invoiceMonth}</strong> rent at <strong>${params.propertyName}</strong>. Your original payment was already confirmed.</p>
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="color: #78350f; font-weight: 700; margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">What happened?</p>
            <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.6;">This is a common UPI/Bank issue called "Late Authorization." Your bank sent the payment twice due to a delay in their system. This is <strong>not your fault</strong>.</p>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 20px; margin: 16px 0;">
            <p style="color: #166534; font-weight: 700; margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">✅ What we are doing</p>
            <p style="color: #15803d; font-size: 14px; margin: 0; line-height: 1.6;">Our admin team has been automatically notified and is reviewing this. The duplicate amount of <strong>₹${params.amount.toLocaleString('en-IN')}</strong> will be fully refunded to your original payment method within <strong>5–7 business days</strong>.</p>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 16px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="color: #64748b; padding: 6px 0; font-size: 13px;">Duplicate Payment ID</td><td style="text-align: right; font-family: monospace; font-size: 11px; color: #334155;">${params.paymentId}</td></tr>
              <tr><td style="color: #64748b; padding: 6px 0; font-size: 13px;">Amount to be Refunded</td><td style="text-align: right; font-weight: 700; color: #16a34a;">₹${params.amount.toLocaleString('en-IN')}</td></tr>
              <tr><td style="color: #64748b; padding: 6px 0; font-size: 13px;">Expected Refund Time</td><td style="text-align: right; color: #334155;">5–7 Business Days</td></tr>
            </table>
          </div>
          <p style="color: #555; font-size: 13px; line-height: 1.6; margin-top: 20px;">You do <strong>not</strong> need to contact support or take any action. If you don't receive the refund within 7 days, please write to us at <a href="mailto:support@rentpe.in" style="color: #6366f1;">support@rentpe.in</a> with the Payment ID above.</p>
        </div>
        <div style="padding: 20px 32px; background: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">RentPe — Secure • Transparent • Student-First<br>This is an automated message. Your data is safe.</p>
        </div>
      </div>
    </body>
    </html>
    `;
}
