'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { createNotification } from "@/actions/notifications";
import { sendEmail } from "@/lib/email";
import { getSLAStatus } from "@/lib/sla";
import { KycRejectedTemplate } from "@/lib/email-templates";
import { generateSignedDocUrl } from "@/lib/upload";
import { razorpay } from "@/lib/razorpay";
import { generateSequentialId } from "@/lib/ids";

const n = (val: any) => Number(val || 0);

// ─────────────────────────────────────────────────────────
// KYC VERIFICATION QUEUE
// ─────────────────────────────────────────────────────────

export async function getKYCQueue(filter?: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    // Doc types that can be verified
    const docFields = [
        'aadhaarProof', 'panProof', 'pgLicenceUrl', 'livePhotoUrl',
    ];

    const properties = await prisma.property.findMany({
        where: { deletedAt: null, ownerId: { not: undefined } },
        include: {
            owner: { select: { id: true, name: true, email: true, phone: true, displayId: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    // Build queue items — one per doc per property
    const queue: any[] = [];

    for (const prop of properties) {
        const verifiedDocs: string[] = (() => {
            try { return JSON.parse(prop.verifiedDocs || '[]'); } catch { return []; }
        })();

        const docMap: Record<string, { url: string; label: string; field: string }> = {
            AADHAAR: { url: prop.aadhaarProof || '', label: 'Aadhaar Proof', field: 'aadhaarProof' },
            PAN: { url: prop.panProof || '', label: 'PAN Card', field: 'panProof' },
            PG_LICENCE: { url: prop.pgLicenceUrl || '', label: 'PG Licence', field: 'pgLicenceUrl' },
            LIVE_PHOTO: { url: prop.livePhotoUrl || '', label: 'Live Photo', field: 'livePhotoUrl' },
        };

        for (const [docType, info] of Object.entries(docMap)) {
            if (!info.url) continue; // Skip if not uploaded

            const isVerified = verifiedDocs.includes(docType);

            // Apply filter
            if (filter && filter !== 'ALL') {
                if (filter === 'PENDING' && isVerified) continue;
                if (filter === 'VERIFIED' && !isVerified) continue;
                if (!['PENDING', 'VERIFIED', 'ALL'].includes(filter) && docType !== filter) continue;
            }

            // 🔒 SECURITY: Generate a 10-minute signed URL for private KYC documents.
            // Raw Cloudinary URLs are NEVER exposed to the client.
            // Compliant with DPDP Act 2023 & RBI KYC access-control requirements.
            const signedDocUrl = generateSignedDocUrl(info.url);

            queue.push({
                id: `${prop.id}__${docType}`,
                propertyId: prop.id,
                propertyName: prop.name,
                propertyDisplayId: prop.displayId,
                city: prop.city,
                docType,
                docLabel: info.label,
                docUrl: signedDocUrl,   // ✅ signed, expires in 10 min
                isVerified,
                owner: prop.owner,
                submittedAt: prop.createdAt,
            });
        }
    }

    // Stats
    const pending = queue.filter(q => !q.isVerified).length;
    const verified = queue.filter(q => q.isVerified).length;

    return { queue, stats: { pending, verified, total: queue.length } };
}

export async function verifyDocument(propertyId: string, docType: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error("Property not found");

    let verifiedDocs: string[] = [];
    try { verifiedDocs = JSON.parse(property.verifiedDocs || '[]'); } catch { verifiedDocs = []; }

    if (!verifiedDocs.includes(docType)) {
        verifiedDocs.push(docType);
    }

    await prisma.property.update({
        where: { id: propertyId },
        data: { verifiedDocs: JSON.stringify(verifiedDocs) }
    });

    await createNotification(
        property.ownerId,
        'KYC_VERIFIED',
        `✅ Your ${docType.replace('_', ' ')} document for "${property.name}" has been verified by admin.`
    );

    await logAuditEvent({
        actorId: (session as any).userId,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'PROPERTY',
        entityId: propertyId,
        description: `Admin verified ${docType} for property "${property.name}"`,
        newValue: { verifiedDocs } as any
    });

    revalidatePath('/dashboard/admin/kyc');
    revalidatePath('/dashboard/admin/properties');
    revalidatePath(`/dashboard/admin/properties/${propertyId}`);
    revalidatePath('/dashboard/owner/properties');
    revalidatePath(`/dashboard/owner/properties/${propertyId}`);
    revalidatePath('/dashboard/owner/verifications');
    return { success: true };
}

export async function rejectDocument(propertyId: string, docType: string, reason: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        include: { owner: { select: { email: true, name: true } } }
    });
    if (!property) throw new Error("Property not found");

    // Remove from verifiedDocs if it was there
    let verifiedDocs: string[] = [];
    try { verifiedDocs = JSON.parse(property.verifiedDocs || '[]'); } catch { verifiedDocs = []; }
    verifiedDocs = verifiedDocs.filter(d => d !== docType);

    await prisma.property.update({
        where: { id: propertyId },
        data: {
            verifiedDocs: JSON.stringify(verifiedDocs),
            adminNotes: `${docType} rejected: ${reason}`
        }
    });

    await createNotification(
        property.ownerId,
        'KYC_REJECTED',
        `❌ Your ${docType.replace('_', ' ')} document for "${property.name}" was rejected. Reason: ${reason}. Please re-upload.`
    );

    if (property.owner?.email) {
        sendEmail({
            to: property.owner.email,
            subject: `Action Required: Document Rejected — ${property.name}`,
            html: KycRejectedTemplate(
                property.owner.name || 'Owner',
                docType.replace('_', ' '),
                property.name,
                reason
            )
        }).catch(err => console.error('Failed to email doc rejection:', err));
    }

    await logAuditEvent({
        actorId: (session as any).userId,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'REJECT',
        entityType: 'PROPERTY',
        entityId: propertyId,
        description: `Admin rejected ${docType} for property "${property.name}". Reason: ${reason}`
    });

    revalidatePath('/dashboard/admin/kyc');
    revalidatePath('/dashboard/admin/properties');
    revalidatePath(`/dashboard/admin/properties/${propertyId}`);
    revalidatePath('/dashboard/owner/properties');
    revalidatePath(`/dashboard/owner/properties/${propertyId}`);
    revalidatePath('/dashboard/owner/verifications');
    return { success: true };
}

// ─────────────────────────────────────────────────────────
// REFUND MANAGEMENT
// ─────────────────────────────────────────────────────────

export async function getRefundRequests(status?: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const refunds = await prisma.refundRecord.findMany({
        where: status && status !== 'ALL' ? { status } : {},
        orderBy: { createdAt: 'desc' },
        take: 200
    });

    const enriched = await Promise.all(refunds.map(async (r: any) => {
        const booking = r.bookingId
            ? await prisma.booking.findUnique({
                where: { id: r.bookingId },
                include: { user: { select: { id: true, name: true, email: true, phone: true } } }
            })
            : null;
        return { 
            ...r, 
            booking,
            amount: n(r.amount),
            platformFeeRefunded: n(r.platformFeeRefunded),
            gstRefunded: n(r.gstRefunded),
            ownerPenaltyApplied: n(r.ownerPenaltyApplied)
        };
    }));

    // Summary stats
    const pendingCount = refunds.filter((r: any) => r.status === 'PENDING').length;
    const processedAmount = refunds
        .filter((r: any) => r.status === 'PROCESSED')
        .reduce((s: number, r: any) => s + Number(r.amount), 0);
    const rejectedCount = refunds.filter((r: any) => r.status === 'REJECTED').length;
    const totalAmount = refunds
        .filter((r: any) => r.status === 'PROCESSED')
        .reduce((s: number, r: any) => s + Number(r.amount), 0);

    const rawOverdue = await (prisma as any).securityDeposit.findMany({
        where: { status: 'REFUND_OVERDUE' },
        orderBy: { refundDueBy: 'asc' },
        include: {
            billingProfile: {
                select: {
                    propertyId: true,
                    tenant: { select: { name: true, roomNumber: true } },
                }
            }
        }
    });

    // Fetch property names for overdue deposits
    const overduePropertyIds = [...new Set(rawOverdue.map((od: any) => od.billingProfile?.propertyId).filter(Boolean))];
    const overdueProperties = overduePropertyIds.length > 0
        ? await prisma.property.findMany({ where: { id: { in: overduePropertyIds as string[] } }, select: { id: true, name: true } })
        : [];
    const overduePropertyMap: Record<string, string> = {};
    for (const p of overdueProperties) overduePropertyMap[p.id] = p.name;

    const overdueDeposits = rawOverdue.map((od: any) => ({
        id: od.id,
        amount: Number(od.amount || 0),
        refundAmount: Number(od.refundAmount || od.amount || 0),
        refundDueBy: od.refundDueBy,
        status: od.status,
        tenantName: od.billingProfile?.tenant?.name || 'Unknown Tenant',
        propertyName: overduePropertyMap[od.billingProfile?.propertyId] || 'Unknown Property',
        roomNumber: od.billingProfile?.tenant?.roomNumber || '—',
    }));

    return {
        refunds: enriched,
        stats: { pendingCount, processedAmount, rejectedCount, totalAmount },
        overdueDeposits
    };
}

// ─── CREATE REFUND FROM SUPPORT TICKET (Manual Admin Trigger) ───────────────
// Admins press the "Create Refund Request" button inside a Support Ticket detail
// view. This creates a PENDING RefundRecord linked to both the ticket and the
// underlying booking. The actual Razorpay refund is only triggered later, when
// the admin presses "Approve" in the Refund Management tab.
export async function createRefundFromTicket(input: {
    ticketId:          string;   // Support Ticket DB id (e.g. uuid)
    bookingId:         string;   // Booking the refund is against
    amount:            number;   // Refund amount in ₹ (e.g. 5000)
    reason:            string;   // Admin-entered reason / description
    refundType?:       string;   // "PARTIAL" | "FULL" (default: "PARTIAL")
    refundPlatformFee?:boolean;  // Toggle: also refund convenience fee?
    platformFeeAmount?:number;   // Convenience fee to refund in ₹
    gstAmount?:        number;   // GST (CGST+SGST) to reverse in ₹
    ownerPenalty?:     number;   // 2% Razorpay MDR loss to debit owner (₹)
    ownerPenaltyOwnerId?: string;// Owner who caused the dispute (for MDR debit)
}) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    // Validate the ticket exists
    const ticket = await (prisma as any).ticket.findUnique({
        where: { id: input.ticketId },
        select: { id: true, displayId: true, status: true }
    });
    if (!ticket) throw new Error(`Support ticket not found: ${input.ticketId}`);

    // Validate the booking exists and belongs to the same context
    const booking = await prisma.booking.findUnique({
        where: { id: input.bookingId },
        select: { id: true, userId: true, displayId: true, amount: true }
    });
    if (!booking) throw new Error(`Booking not found: ${input.bookingId}`);

    // SECURITY FIX: Strict Refund Amount Validation
    const existingRefunds = await prisma.refundRecord.findMany({
        where: { bookingId: input.bookingId, status: { in: ['PENDING', 'PROCESSED', 'PROCESSING'] } }
    });
    const totalRefunded = existingRefunds.reduce((sum: number, r: any) => sum + r.amount, 0);
    const bookingAmountNum = Number(booking.amount || 0);

    if (input.amount > (bookingAmountNum - totalRefunded)) {
        throw new Error(`Refund amount exceeds the maximum allowed. Max allowed: ₹${bookingAmountNum - totalRefunded}. Existing refunds: ₹${totalRefunded}.`);
    }

    // Generate the RP-RFND-26-27-XXXXXX display ID (FY-sequential, GST-compliant)
    const displayId = await generateSequentialId('REFUND');

    const refund = await prisma.refundRecord.create({
        data: {
            displayId,
            bookingId:           input.bookingId,
            amount:              input.amount,
            reason:              input.reason,
            refundType:          input.refundType ?? 'PARTIAL',
            status:              'PENDING',
            initiatedBy:         (session as any).userId,
            ticketId:            input.ticketId,
            refundPlatformFee:   input.refundPlatformFee ?? false,
            platformFeeRefunded: input.platformFeeAmount  ?? 0,
            gstRefunded:         input.gstAmount          ?? 0,
            ownerPenaltyApplied: input.ownerPenalty       ?? 0,
            ownerPenaltyOwnerId: input.ownerPenaltyOwnerId ?? null,
        }
    });

    // Notify the student that their refund is being reviewed
    await createNotification(
        booking.userId,
        'PAYMENT',
        `🔄 A refund request of ₹${input.amount} has been raised by RentPe support (Ref: ${displayId}). You will be notified once it is processed.`
    );

    await logAuditEvent({
        actorId:     (session as any).userId,
        actorRole:   'ADMIN',
        actorName:   (session as any).name || 'Admin',
        actionType:  'CREATE',
        entityType:  'REFUND',
        entityId:    refund.id,
        description: `Refund request ${displayId} created from Support Ticket ${ticket.displayId}. Amount: ₹${input.amount}. Platform fee refund: ${input.refundPlatformFee ? 'YES' : 'NO'}. Owner penalty: ₹${input.ownerPenalty ?? 0}.`,
        newValue:    { displayId, ticketId: input.ticketId, bookingId: input.bookingId } as any,
    });

    revalidatePath('/dashboard/admin/refunds');
    revalidatePath('/dashboard/admin/tickets');
    return { success: true, refund };
}


export async function approveRefund(refundId: string, note?: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    // Fetch the refund request
    const refund = await prisma.refundRecord.findUnique({
        where: { id: refundId }
    });

    if (!refund) throw new Error("Refund request not found");
    if (refund.status !== 'PENDING') throw new Error("Refund is already processed or rejected");

    // SECURITY FIX: Race Condition Prevention via Atomic Update (Optimistic Locking)
    const lockedRefund = await prisma.refundRecord.updateMany({
        where: { id: refundId, status: 'PENDING' },
        data: { status: 'PROCESSING' }
    });
    if (lockedRefund.count === 0) {
        throw new Error("Refund is currently being processed by another request. Aborting to prevent duplicate refund.");
    }

    let finalTxnRef = refund.txnReference;
    let paymentId = refund.txnReference;

    // If there is no transaction reference on the RefundRecord, try to find a verified/duplicate payment
    if (!paymentId) {
        const payment = await (prisma as any).payment.findFirst({
            where: {
                bookingId: refund.bookingId,
                status: { in: ['VERIFIED', 'DUPLICATE'] }
            },
            orderBy: { date: 'desc' }
        });
        if (payment && payment.razorpayId) {
            paymentId = payment.razorpayId;
        }
    }

    if (!paymentId) {
        throw new Error("Cannot process refund: No valid Razorpay payment ID found for this booking.");
    }

    console.log(`[Admin] Initiating refund for RefundRecord: ${refundId}, Payment ID: ${paymentId}, Amount: ₹${refund.amount}`);

    // Check if we are in mock mode
    const isMockKey = !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_placeholder');
    const isMockPayment = paymentId.startsWith('pay_mock_') || paymentId.startsWith('rfnd_');

    if (isMockKey || isMockPayment) {
        console.log(`[Admin] Mock mode detected. Simulating successful refund for payment: ${paymentId}`);
        finalTxnRef = `rfnd_mock_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    } else {
        try {
            // Live Razorpay API Refund Call
            const rzpRefund = await razorpay.payments.refund(paymentId, {
                amount: Math.round(refund.amount * 100), // Convert to paise
                notes: {
                    refundRecordId: refund.id,
                    bookingId: refund.bookingId,
                    reason: refund.reason,
                    approvedBy: (session as any).userId
                }
            });
            finalTxnRef = rzpRefund.id;
            console.log(`[Admin] Live Razorpay refund successful. Refund ID: ${finalTxnRef}`);
        } catch (apiError: any) {
            console.error('[Admin] Razorpay refund API failed:', apiError);
            
            // Check if it's a test environment fallback case
            if (process.env.NODE_ENV !== 'production' || apiError?.message?.includes('placeholder')) {
                console.log('[Admin] API failed in non-prod. Falling back to mock simulation.');
                finalTxnRef = `rfnd_fallback_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
            } else {
                throw new Error(`Razorpay Refund failed: ${apiError?.message || 'Unknown API Error'}`);
            }
        }
    }

    // Update RefundRecord state — including platform fee, GST, MDR penalty amounts
    const updatedRefund = await prisma.refundRecord.update({
        where: { id: refundId },
        data: {
            status:      'PROCESSED',
            processedBy: (session as any).userId,
            processedAt: new Date(),
            txnReference: finalTxnRef,
            notes: [note, refund.notes].filter(Boolean).join(' | ')
        }
    });

    // ── Platform Fee Refund: Deduct from RentPe's platform wallet ───────────
    // SECURITY FIX: Do not decrement wallet if it was a mock refund
    if ((refund as any).refundPlatformFee && (refund as any).platformFeeRefunded > 0 && !isMockKey && !isMockPayment) {
        try {
            await (prisma as any).platformSettings.update({
                where: { id: 'singleton' },
                data: {
                    platformWalletBalance: { decrement: (refund as any).platformFeeRefunded }
                }
            });
            console.log(`[Admin] Platform wallet debited ₹${(refund as any).platformFeeRefunded} for refund ${refundId}`);
        } catch (walletErr: any) {
            console.warn('[Admin] Non-critical: Failed to update platform wallet balance:', walletErr.message);
        }

        // ── Issue GST Credit Note (CN/26-27/XXXX) for CGST/SGST reversal ──
        if ((refund as any).gstRefunded > 0) {
            try {
                const cnDisplayId = await generateSequentialId('CREDIT_NOTE');
                const cgst = parseFloat(((refund as any).gstRefunded / 2).toFixed(2));
                const sgst = cgst;

                await (prisma as any).creditNote.create({
                    data: {
                        displayId:    cnDisplayId,   // CN/26-27/0001
                        bookingId:    refund.bookingId,
                        amount:       (refund as any).gstRefunded,
                        reason:       `GST reversal for convenience fee refund — Refund ID: ${ (refund as any).displayId }`,
                        type:         'GST_REVERSAL',
                        createdById:  (session as any).userId,
                    }
                });

                // Link the credit note back to the refund record for audit trail
                await prisma.refundRecord.update({
                    where: { id: refundId },
                    data:  { creditNoteId: cnDisplayId }
                });

                console.log(`[Admin] GST Credit Note ${cnDisplayId} issued. CGST: ₹${cgst}, SGST: ₹${sgst}`);

                await logAuditEvent({
                    actorId:     (session as any).userId,
                    actorRole:   'ADMIN',
                    actorName:   (session as any).name || 'Admin',
                    actionType:  'CREATE',
                    entityType:  'CREDIT_NOTE',
                    entityId:    cnDisplayId,
                    description: `GST Credit Note ${cnDisplayId} issued for ₹${(refund as any).gstRefunded} (CGST ₹${cgst} + SGST ₹${sgst}) — linked to Refund ${ (refund as any).displayId }`,
                });
            } catch (cnErr: any) {
                console.warn('[Admin] Non-critical: GST Credit Note creation failed:', cnErr.message);
            }
        }
    }

    // ── Owner 2% Razorpay MDR Penalty: Debit from owner's next payout ───────
    if ((refund as any).ownerPenaltyApplied > 0 && (refund as any).ownerPenaltyOwnerId) {
        try {
            // displayId is REQUIRED + UNIQUE on OwnerPayout — generate a deterministic MDR ID
            const mdrDisplayId = `MDR-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.floor(Math.random() * 900000) + 100000}`;
            // Record the MDR loss as a negative payout adjustment against the owner
            await (prisma as any).ownerPayout.create({
                data: {
                    displayId:        mdrDisplayId,
                    ownerId:          (refund as any).ownerPenaltyOwnerId,
                    period:           new Date().toISOString().slice(0, 7), // "2026-07"
                    grossAmount:      0,
                    commissionAmount: 0,
                    netAmount:        -Math.abs((refund as any).ownerPenaltyApplied), // Negative = deduction
                    status:           'PENDING',
                    notes:            `2% Razorpay MDR gateway fee penalty — Owner caused dispute. Refund ID: ${ (refund as any).displayId }`,
                }
            });
            console.log(`[Admin] Owner MDR penalty of ₹${(refund as any).ownerPenaltyApplied} recorded against owner ${(refund as any).ownerPenaltyOwnerId}`);

            await logAuditEvent({
                actorId:     (session as any).userId,
                actorRole:   'ADMIN',
                actorName:   (session as any).name || 'Admin',
                actionType:  'UPDATE',
                entityType:  'PAYOUT',
                entityId:    (refund as any).ownerPenaltyOwnerId,
                description: `Owner MDR penalty of ₹${(refund as any).ownerPenaltyApplied} debited (2% Razorpay gateway fee loss) — Refund ${ (refund as any).displayId }`,
            });
        } catch (mdrErr: any) {
            console.warn('[Admin] Non-critical: Owner MDR penalty recording failed:', mdrErr.message);
        }
    }


    // Update associated Payment records' status to REFUNDED to sync ledger
    try {
        await (prisma as any).payment.updateMany({
            where: {
                OR: [
                    { razorpayId: paymentId },
                    { razorpayOrderId: paymentId }
                ]
            },
            data: {
                status: 'REFUNDED'
            }
        });
        console.log(`[Admin] Synced associated payments to REFUNDED for Payment ID: ${paymentId}`);
    } catch (dbErr: any) {
        console.warn('[Admin] Non-critical: Failed to update payment status to REFUNDED:', dbErr.message);
    }

    // Notify user
    const booking = refund.bookingId
        ? await prisma.booking.findUnique({
            where: { id: refund.bookingId },
            include: { user: { select: { id: true, email: true, name: true } } }
        })
        : null;

    if (booking?.user) {
        await createNotification(
            booking.user.id,
            'PAYMENT',
            `✅ Your refund of ₹${refund.amount} has been approved and processed. Transaction Reference: ${finalTxnRef}`
        );
    }

    await logAuditEvent({
        actorId: (session as any).userId,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'APPROVE',
        entityType: 'REFUND',
        entityId: refundId,
        description: `Refund of ₹${refund.amount} approved and processed via Razorpay. Note: ${note || 'N/A'}. Refund Ref: ${finalTxnRef}`,
    });

    revalidatePath('/dashboard/admin/refunds');
    revalidatePath('/dashboard/admin/transactions');
    return { success: true };
}

export async function rejectRefund(refundId: string, reason: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    // SECURITY FIX: Guard against rejecting a refund that was already processed or is mid-flight.
    // Without this, a race condition could mark a PROCESSED refund as REJECTED, corrupting ledger.
    const existingRefund = await prisma.refundRecord.findUnique({ where: { id: refundId }, select: { status: true, amount: true } });
    if (!existingRefund) throw new Error("Refund not found");
    if (existingRefund.status === 'PROCESSED') throw new Error("Cannot reject a refund that has already been processed and paid out.");
    if (existingRefund.status === 'PROCESSING') throw new Error("Refund is currently being processed by Razorpay. Cannot reject mid-flight.");
    if (existingRefund.status === 'REJECTED') throw new Error("This refund has already been rejected.");

    const refund = await prisma.refundRecord.update({
        where: { id: refundId },
        data: {
            status: 'REJECTED',
            processedBy: (session as any).userId,
            processedAt: new Date(),
            notes: reason
        }
    });

    const booking = refund.bookingId
        ? await prisma.booking.findUnique({
            where: { id: refund.bookingId },
            include: { user: { select: { id: true, email: true, name: true } } }
        })
        : null;

    if (booking?.user) {
        await createNotification(
            booking.user.id,
            'PAYMENT',
            `❌ Your refund request of ₹${refund.amount} has been rejected. Reason: ${reason}`
        );
    }

    await logAuditEvent({
        actorId: (session as any).userId,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'REJECT',
        entityType: 'REFUND',
        entityId: refundId,
        description: `Refund of ₹${refund.amount} rejected. Reason: ${reason}`,
    });

    revalidatePath('/dashboard/admin/refunds');
    return { success: true };
}

// ─────────────────────────────────────────────────────────
// CITY / AREA MANAGEMENT
// ─────────────────────────────────────────────────────────

export async function applyOwnerRefundPenalty(depositId: string, note: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const deposit = await prisma.securityDeposit.findUnique({
        where: { id: depositId },
        include: {
            billingProfile: {
                select: { 
                    propertyId: true, 
                    tenantId: true,
                    tenant: { select: { bookingId: true } }
                }
            }
        }
    });

    if (!deposit) throw new Error("Deposit not found");
    if (deposit.status === 'REFUNDED_VIA_WITHHOLDING') throw new Error("Penalty already applied to this deposit. Cannot apply twice.");
    if (deposit.status !== 'REFUND_OVERDUE') throw new Error("Deposit is not overdue. Current status: " + deposit.status);

    const propertyId = deposit.billingProfile?.propertyId;
    if (!propertyId) throw new Error("Property not linked to deposit");

    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { ownerId: true } });
    const ownerId = property?.ownerId;
    if (!ownerId) throw new Error("Property owner not found");

    const penaltyAmount = Number(deposit.amount);

    // Create a negative payout to dock the owner's balance
    await prisma.ownerPayout.create({
        data: {
            displayId: `PEN-${Math.floor(Math.random() * 900000) + 100000}`,
            ownerId,
            period: new Date().toISOString().substring(0, 7), // YYYY-MM
            grossAmount: 0,
            commissionAmount: 0,
            netAmount: -penaltyAmount,
            status: 'PENDING',
            notes: `[PENALTY] Withheld security deposit for overdue refund. Deposit ID: ${depositId}. Note: ${note}`,
        }
    });

    // Update deposit to reflect that the admin has seized the funds for refund
    await (prisma as any).securityDeposit.update({
        where: { id: depositId },
        data: {
            status: 'REFUNDED_VIA_WITHHOLDING',
            settlementNotes: `Admin withheld ₹${penaltyAmount} from owner payout on ${new Date().toLocaleDateString()}. Note: ${note}`,
            updatedAt: new Date()
        }
    });

    // CRITICAL FIX: The owner was docked, but the tenant needs to actually receive the money.
    // We create a PENDING RefundRecord here. The Admin Finance team will see this in their
    // Refund Management dashboard and click "Approve" to send the money via Razorpay to the tenant.
    const bookingId = deposit.billingProfile?.tenant?.bookingId;
    if (bookingId) {
        // Use generateSequentialId for collision-safe, GST-compliant displayId (RP-RFND-26-27-XXXXXX)
        const refundDisplayId = await generateSequentialId('REFUND');
        await prisma.refundRecord.create({
            data: {
                displayId: refundDisplayId,
                bookingId,
                amount: penaltyAmount,
                reason: `Overdue Deposit Refund (Withheld from Owner Payout). Admin Note: ${note}`,
                refundType: 'FULL',
                status: 'PENDING',
                initiatedBy: (session as any).userId,
                notes: `System Auto-Generated via Penalty Enforcement on Deposit ${depositId}`
            }
        });
    }

    await logAuditEvent({
        actorId: (session as any).userId,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'PAYOUT',
        entityId: ownerId,
        description: `Applied ₹${penaltyAmount} penalty to owner for overdue deposit ${depositId}. Queued tenant refund.`,
    });

    // Notify the owner of the penalty
    try {
        const { createNotification } = await import('@/actions/notifications');
        await createNotification(
            ownerId,
            'SYSTEM',
            `⚠️ ALERT: A penalty of ₹${penaltyAmount} has been deducted from your next payout due to an overdue security deposit refund (ID: ${depositId}). Admin Note: ${note}`
        );
    } catch (e: any) {
        console.warn('Failed to send penalty notification to owner', e.message);
    }

    revalidatePath('/dashboard/admin/refunds');
    return { success: true };
}

export async function getServiceCities() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const cities = await prisma.serviceCity.findMany({
        orderBy: [{ priority: 'desc' }, { name: 'asc' }]
    });

    // Enrich with property counts
    const enriched = await Promise.all(cities.map(async (city: any) => {
        const propCount = await prisma.property.count({
            where: { city: { contains: city.name, mode: 'insensitive' } }
        });
        return { ...city, propertyCount: propCount };
    }));

    return enriched;
}

export async function addServiceCity(data: {
    name: string;
    slug: string;
    state: string;
    pinCodes?: string[];
    priority?: number;
    metaTitle?: string;
    metaDesc?: string;
}) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const city = await prisma.serviceCity.create({
        data: {
            name: data.name,
            slug: data.slug.toLowerCase().replace(/\s+/g, '-'),
            state: data.state,
            pinCodes: JSON.stringify(data.pinCodes || []),
            priority: data.priority || 0,
            metaTitle: data.metaTitle,
            metaDesc: data.metaDesc,
            isActive: true,
        }
    });

    await logAuditEvent({
        actorId: (session as any).userId,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'CREATE',
        entityType: 'ADMIN',
        entityId: city.id,
        description: `Admin added service city: ${data.name}, ${data.state}`,
    });

    revalidatePath('/dashboard/admin/cities');
    revalidatePath('/search');
    return city;
}

export async function updateServiceCity(id: string, data: {
    name?: string;
    state?: string;
    pinCodes?: string[];
    priority?: number;
    metaTitle?: string;
    metaDesc?: string;
}) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const updated = await prisma.serviceCity.update({
        where: { id },
        data: {
            ...data,
            pinCodes: data.pinCodes ? JSON.stringify(data.pinCodes) : undefined,
        }
    });

    revalidatePath('/dashboard/admin/cities');
    return updated;
}

export async function toggleCityStatus(id: string, isActive: boolean) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const updated = await prisma.serviceCity.update({
        where: { id },
        data: { isActive }
    });

    await logAuditEvent({
        actorId: (session as any).userId,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'ADMIN',
        entityId: id,
        description: `Service city ${updated.name} ${isActive ? 'activated' : 'deactivated'}`,
    });

    revalidatePath('/dashboard/admin/cities');
    revalidatePath('/search');
    return updated;
}

// ─────────────────────────────────────────────────────────
// COMMISSION CONFIGURATION
// ─────────────────────────────────────────────────────────

export async function getCommissionConfigs() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    return prisma.commissionConfig.findMany({
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
    });
}

export async function updateCommissionConfig(data: {
    propertyType: string;
    feePercent: number;
    flatFee?: number;
    effectiveFrom?: Date;
    notes?: string;
}) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    // Deactivate old config for this property type
    await prisma.commissionConfig.updateMany({
        where: { propertyType: data.propertyType, isActive: true },
        data: { isActive: false }
    });

    const config = await prisma.commissionConfig.create({
        data: {
            propertyType: data.propertyType,
            feePercent: data.feePercent,
            flatFee: data.flatFee,
            effectiveFrom: data.effectiveFrom || new Date(),
            createdBy: (session as any).userId,
            isActive: true,
            notes: data.notes,
        }
    });

    await logAuditEvent({
        actorId: (session as any).userId,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'ADMIN',
        entityId: config.id,
        description: `Commission config updated: ${data.propertyType} → ${data.feePercent}%${data.flatFee ? ` / ₹${data.flatFee} flat` : ''}`,
    });

    revalidatePath('/dashboard/admin/settings/commission');
    return config;
}

// ─────────────────────────────────────────────────────────
// BULK NOTIFICATION SENDER
// ─────────────────────────────────────────────────────────

export async function getNotificationRecipientCount(
    audience: 'ALL' | 'STUDENTS' | 'OWNERS' | 'CITY',
    cityFilter?: string | null
): Promise<number> {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const where: any = { deletedAt: null, status: { not: 'BANNED' } };

    if (audience === 'STUDENTS') where.roles = { has: 'USER' };
    else if (audience === 'OWNERS') where.roles = { has: 'OWNER' };
    else if (audience === 'CITY' && cityFilter) where.city = cityFilter;
    // ALL = no filter

    return prisma.user.count({ where });
}

export async function sendBulkNotification(
    audience: 'ALL' | 'STUDENTS' | 'OWNERS' | 'CITY',
    cityFilter: string | null,
    title: string,
    message: string,
    type: string,
    channel: 'INAPP' | 'EMAIL' | 'BOTH'
) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const where: any = { deletedAt: null, status: { not: 'BANNED' } };
    if (audience === 'STUDENTS') where.roles = { has: 'USER' };
    else if (audience === 'OWNERS') where.roles = { has: 'OWNER' };
    else if (audience === 'CITY' && cityFilter) where.city = cityFilter;

    const users = await prisma.user.findMany({
        where,
        select: { id: true, email: true, name: true }
    });

    let sent = 0;

    // Batch notifications
    if (channel === 'INAPP' || channel === 'BOTH') {
        const notifData = users.map(u => ({
            userId: u.id,
            type: type || 'INFO',
            category: 'PLATFORM',
            message: `${title}: ${message}`,
            isPersistent: true,
            targetRole: 'USER',
        }));

        // Insert in batches of 100
        for (let i = 0; i < notifData.length; i += 100) {
            await prisma.notification.createMany({ data: notifData.slice(i, i + 100) });
        }
        sent = notifData.length;
    }

    if (channel === 'EMAIL' || channel === 'BOTH') {
        // Send emails (fire-and-forget, batch)
        for (const user of users) {
            if (user.email) {
                sendEmail({
                    to: user.email,
                    subject: title,
                    html: `<h2>${title}</h2><p>Hi ${user.name || 'there'},</p><p>${message}</p><p style="color:#888;font-size:12px">This is a platform-wide notification from RentPe.</p>`
                }).catch(() => {});
            }
        }
    }

    await logAuditEvent({
        actorId: (session as any).userId,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'CREATE',
        entityType: 'ADMIN',
        entityId: 'bulk-notification',
        description: `Bulk notification sent to ${sent} users. Audience: ${audience}. Title: "${title}". Channel: ${channel}`,
    });

    revalidatePath('/dashboard/admin');
    return { success: true, recipientCount: sent };
}

// ─────────────────────────────────────────────────────────
// DISPUTE MESSAGES
// ─────────────────────────────────────────────────────────

export async function getDisputeById(id: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const dispute = await prisma.dispute.findUnique({
        where: { id },
        include: {
            messages: { orderBy: { createdAt: 'asc' } },
            tenant: { select: { id: true, name: true, email: true } }
        }
    });

    if (!dispute) return null;

    // Enrich with user data
    const raisedBy = await prisma.user.findUnique({
        where: { id: dispute.raisedById },
        select: { id: true, name: true, email: true, phone: true }
    });

    return { ...dispute, raisedByUser: raisedBy };
}

export async function getDisputesForAdmin(status?: string, priority?: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const where: any = {};
    if (status && status !== 'ALL') where.status = status;
    if (priority && priority !== 'ALL') where.priority = priority;

    const disputes = await prisma.dispute.findMany({
        where,
        include: {
            messages: { select: { id: true } }
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 200
    });

    const enriched = await Promise.all(disputes.map(async (d: any) => {
        const raisedBy = await prisma.user.findUnique({
            where: { id: d.raisedById },
            select: { id: true, name: true, email: true }
        });
        return { ...d, raisedByUser: raisedBy, messageCount: d.messages.length };
    }));

    const open = disputes.filter((d: any) => d.status === 'OPEN').length;
    const underReview = disputes.filter((d: any) => d.status === 'UNDER_REVIEW').length;
    const resolved = disputes.filter((d: any) => d.status === 'RESOLVED').length;
    const urgent = disputes.filter((d: any) => d.priority === 'URGENT').length;

    return { disputes: enriched, stats: { open, underReview, resolved, urgent } };
}

export async function sendDisputeMessage(disputeId: string, message: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const msg = await prisma.disputeMessage.create({
        data: {
            disputeId,
            senderId: (session as any).userId,
            senderRole: 'ADMIN',
            message,
        }
    });

    revalidatePath(`/dashboard/admin/disputes/${disputeId}`);
    return msg;
}

export async function updateDisputePriority(disputeId: string, priority: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const dispute = await prisma.dispute.update({
        where: { id: disputeId },
        data: { priority }
    });

    revalidatePath(`/dashboard/admin/disputes/${disputeId}`);
    revalidatePath('/dashboard/admin/disputes');
    return dispute;
}

// ─────────────────────────────────────────────────────────
// PAYOUT MANAGEMENT (extends existing payouts.ts)
// ─────────────────────────────────────────────────────────

export async function getOwnerPayouts(period?: string, status?: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const where: any = {};
    if (period) where.period = period;
    if (status && status !== 'ALL') where.status = status;

    const payouts = await prisma.ownerPayout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200
    });

    // Enrich with owner data
    const enriched = await Promise.all(payouts.map(async (p) => {
        const owner = await prisma.user.findUnique({
            where: { id: p.ownerId },
            select: { id: true, name: true, email: true, phone: true }
        });
        return { 
            ...p, 
            owner,
            netAmount: n(p.netAmount),
            grossAmount: n(p.grossAmount),
            commissionAmount: n(p.commissionAmount),
            gstOnCommission: n((p as any).gstOnCommission),
            tds: n((p as any).tds)
        };
    }));

    const totalThisMonth = payouts.reduce((s, p) => s + Number(p.netAmount), 0);
    const pending = payouts.filter(p => p.status === 'PENDING').reduce((s, p) => s + Number(p.netAmount), 0);
    const paid = payouts.filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.netAmount), 0);
    const commission = payouts.reduce((s, p) => s + Number(p.commissionAmount), 0);

    return {
        payouts: enriched,
        stats: { totalThisMonth, pending, paid, commission }
    };
}

export async function processOwnerPayout(payoutId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const payout = await prisma.ownerPayout.update({
        where: { id: payoutId },
        data: {
            status: 'PAID',
            paidAt: new Date(),
            approvedBy: (session as any).userId
        }
    });

    const owner = await prisma.user.findUnique({
        where: { id: payout.ownerId },
        select: { id: true, name: true, email: true }
    });

    if (owner) {
        await createNotification(
            owner.id,
            'PAYMENT',
            `💰 Your payout of ₹${payout.netAmount} for ${payout.period} has been processed!`
        );
    }

    await logAuditEvent({
        actorId: (session as any).userId,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'APPROVE',
        entityType: 'PAYOUT',
        entityId: payoutId,
        description: `Payout ${payout.displayId} processed. Net: ₹${payout.netAmount} for period ${payout.period}`,
    });

    if (owner?.email) {
        try {
            const { sendEmail } = await import('@/lib/email');
            const { OwnerNotificationTemplate } = await import('@/lib/email-templates');
            sendEmail({
                to: owner.email,
                subject: `Payout Processed: Rs. ${Number(payout.netAmount).toFixed(2)} settled for ${payout.period} | RentPe`,
                html: OwnerNotificationTemplate(
                    owner.name || "Owner",
                    "Payout Settlement Successful",
                    `Dear ${owner.name || "Owner"}, your payout of <strong>Rs. ${Number(payout.netAmount).toFixed(2)}</strong> for the period <strong>${payout.period}</strong> has been successfully processed and settled to your registered bank account.`,
                    "/dashboard/owner/payouts",
                    "View Payout Details"
                )
            }).catch(e => console.error("Email failed:", e));
        } catch (e) {
            console.error("Email module error:", e);
        }
    }

    revalidatePath('/dashboard/admin/payouts');
    return payout;
}

export async function processBulkPayouts(payoutIds: string[]) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const results = await Promise.allSettled(
        payoutIds.map(id => processOwnerPayout(id))
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    revalidatePath('/dashboard/admin/payouts');
    return { succeeded, failed, total: payoutIds.length };
}

export async function getPayoutDetails(payoutId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const payout = await prisma.ownerPayout.findUnique({
        where: { id: payoutId }
    });
    if (!payout) throw new Error("Payout not found");

    let bIds: string[] = [];
    try {
        bIds = JSON.parse(payout.bookingIds || '[]');
    } catch {
        bIds = [];
    }

    const platformFees = await prisma.platformFee.findMany({
        where: { bookingId: { in: bIds } },
        include: {
            booking: {
                select: {
                    id: true,
                    displayId: true,
                    guestName: true,
                    guestPhone: true,
                    roomAssigned: true,
                    occupancy: true,
                    propertyName: true,
                    tenant: {
                        select: {
                            id: true,
                            displayId: true,
                            phone: true,
                        }
                    }
                }
            }
        }
    });

    return platformFees.map(fee => ({
        id: fee.id,
        bookingId: fee.bookingId,
        bookingDisplayId: fee.booking.displayId,
        studentName: fee.booking.guestName,
        phone: fee.booking.tenant?.phone || fee.booking.guestPhone || "N/A",
        tenantDisplayId: fee.booking.tenant?.displayId || "N/A",
        roomBed: `${fee.booking.roomAssigned || "TBD"} (${fee.booking.occupancy})`,
        propertyName: fee.booking.propertyName,
        grossAmount: n(fee.grossAmount),
        tdsAmount: n(fee.tdsAmount),
        gstAmount: n(fee.gstOnStudentFee) + n(fee.gstOnOwnerFee),
        ownerFee: n(fee.ownerFee),
        customerFee: n(fee.customerFee),
        netAmount: n(fee.ownerNet)
    }));
}

// ─────────────────────────────────────────────────────────
// ADMIN ANALYTICS
// ─────────────────────────────────────────────────────────

export async function getAdminAnalytics(days: number = 30) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const [
        newUsers, newBookings, newProperties,
        resolvedTickets, newDisputes,
        totalUsers, totalProperties, liveProperties,
        openTickets, openDisputes,
    ] = await Promise.all([
        prisma.user.findMany({
            where: { createdAt: { gte: cutoff } },
            select: { createdAt: true, roles: true }
        }),
        prisma.booking.findMany({
            where: { createdAt: { gte: cutoff } },
            select: { createdAt: true, status: true, amount: true }
        }),
        prisma.property.findMany({
            where: { createdAt: { gte: cutoff } },
            select: { createdAt: true, status: true, city: true }
        }),
        prisma.ticket.count({ where: { status: 'RESOLVED', updatedAt: { gte: cutoff } } }),
        prisma.dispute.count({ where: { createdAt: { gte: cutoff } } }),
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.property.count(),
        prisma.property.count({ where: { status: 'LIVE' } }),
        prisma.ticket.count({ where: { status: 'OPEN' } }),
        prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
    ]);

    // Build daily chart data
    const dailyMap: Record<string, any> = {};
    const getDayKey = (d: Date) => d.toISOString().split('T')[0];

    // Fill all days in range
    for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const k = getDayKey(d);
        dailyMap[k] = { date: k, newStudents: 0, newOwners: 0, bookings: 0, revenue: 0, properties: 0 };
    }

    for (const u of newUsers) {
        const k = getDayKey(new Date(u.createdAt));
        if (dailyMap[k]) {
            if (u.roles.includes('OWNER')) dailyMap[k].newOwners++;
            else dailyMap[k].newStudents++;
        }
    }
    for (const b of newBookings) {
        const k = getDayKey(new Date(b.createdAt));
        if (dailyMap[k]) {
            dailyMap[k].bookings++;
            dailyMap[k].revenue += Number(b.amount);
        }
    }
    for (const p of newProperties) {
        const k = getDayKey(new Date(p.createdAt));
        if (dailyMap[k]) dailyMap[k].properties++;
    }

    const daily = Object.values(dailyMap).sort((a: any, b: any) => a.date.localeCompare(b.date));

    // City breakdown
    const cityMap: Record<string, number> = {};
    for (const p of newProperties) {
        cityMap[p.city] = (cityMap[p.city] || 0) + 1;
    }
    const topCities = Object.entries(cityMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 7)
        .map(([city, count]) => ({ city, count }));

    return {
        daily,
        topCities,
        summary: {
            totalUsers,
            totalProperties,
            liveProperties,
            openTickets,
            openDisputes,
            newUsersThisPeriod: newUsers.length,
            newBookingsThisPeriod: newBookings.length,
            resolvedTickets,
            newDisputes,
        }
    };
}

// getSLAStatus imported from @/lib/sla



export async function getAdminTicketsWithSLA(status?: string, priority?: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const where: any = {};
    if (status && status !== 'ALL') where.status = status;
    if (priority && priority !== 'ALL') where.priority = priority;

    const tickets = await prisma.ticket.findMany({
        where,
        include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            property: { select: { id: true, name: true, city: true } }
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: 200
    });

    const enriched = tickets.map(t => ({
        ...t,
        slaStatus: getSLAStatus({ priority: t.priority || 'MEDIUM', createdAt: t.createdAt, status: t.status })
    }));

    const overdue = enriched.filter(t => t.slaStatus === 'BREACHED').length;
    const warning = enriched.filter(t => t.slaStatus === 'WARNING').length;
    const open = enriched.filter(t => t.status === 'OPEN').length;
    const closedToday = enriched.filter(t => {
        const today = new Date().toDateString();
        return t.status === 'RESOLVED' && new Date(t.updatedAt).toDateString() === today;
    }).length;

    return {
        tickets: enriched,
        stats: { overdue, warning, open, closedToday }
    };
}


