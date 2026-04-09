'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/actions/notifications";
import { sendEmail } from "@/lib/email";
import { logAuditEvent } from "@/lib/audit";

/**
 * Student or owner raises a dispute
 */
export async function raiseDispute(data: {
    bookingId?: string;
    type: 'REFUND' | 'DAMAGE' | 'FRAUD' | 'KYC' | 'OTHER';
    subject: string;
    description: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    evidenceData?: string;
    evidenceName?: string;
}) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    if (!data.subject?.trim() || !data.description?.trim()) throw new Error("Subject and description are required");

    const dispute = await prisma.dispute.create({
        data: {
            displayId: `DIS-${Math.floor(Math.random() * 900000) + 100000}`,
            bookingId: data.bookingId,
            raisedById: (session as any).userId,
            raisedByRole: session.role,
            type: data.type,
            subject: data.subject,
            description: data.description,
            priority: data.priority || 'MEDIUM',
            evidenceData: data.evidenceData,
            evidenceName: data.evidenceName,
            status: 'OPEN',
        }
    });

    // Notify admin team
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, email: true } });
    for (const admin of admins) {
        await createNotification(admin.id, 'TICKET', `New ${data.type} dispute raised: "${data.subject}" â€” Priority: ${data.priority || 'MEDIUM'}`);
        
        if (admin.email) {
            sendEmail({
                to: admin.email,
                subject: `[DISPUTE] ${data.priority || 'MEDIUM'}: ${data.subject}`,
                html: `<p>A new dispute has been raised by ${session.role}.</p><p><strong>Subject:</strong> ${data.subject}</p><p><strong>Type:</strong> ${data.type}</p><p><a href="https://rentpe.in/dashboard/admin/disputes">View in Admin Panel</a></p>`
            }).catch(err => console.error('Failed to email admin dispute:', err));
        }
    }

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: session.role as string,
        actorName: (session as any).name || 'User',
        actionType: 'CREATE',
        entityType: 'DISPUTE',
        entityId: dispute.id,
        description: `${data.type} dispute raised by ${session.role}: ${data.subject}`,
    });

    revalidatePath('/dashboard/student');
    revalidatePath('/dashboard/owner');
    revalidatePath('/dashboard/admin/disputes');
    return dispute;
}

/**
 * Admin marks dispute as under review
 */
export async function reviewDispute(disputeId: string, adminNotes?: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const dispute = await prisma.dispute.update({
        where: { id: disputeId },
        data: { status: 'UNDER_REVIEW', adminNotes }
    });

    await createNotification(dispute.raisedById, 'TICKET', `Your dispute "${dispute.subject}" is now under review by our team.`);

    revalidatePath('/dashboard/admin/disputes');
    return dispute;
}

/**
 * Admin resolves a dispute
 */
export async function resolveDispute(disputeId: string, resolution: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    if (!resolution?.trim()) throw new Error("Resolution is required");

    const dispute = await prisma.dispute.update({
        where: { id: disputeId },
        data: {
            status: 'RESOLVED',
            resolution,
            resolvedById: (session as any).userId,
            resolvedAt: new Date()
        }
    });

    await createNotification(dispute.raisedById, 'TICKET', `Your dispute "${dispute.subject}" has been resolved: ${resolution}`);

    const user = await prisma.user.findUnique({ where: { id: dispute.raisedById }, select: { email: true, name: true } });
    if (user?.email) {
        sendEmail({
            to: user.email,
            subject: `Dispute Resolved: ${dispute.subject} âœ…`,
            html: `<h2>Good news!</h2><p>Hi ${user.name || 'there'},</p><p>Your dispute "<strong>${dispute.subject}</strong>" has been resolved by our support team.</p><div style="background: #f0fdf4; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0;"><strong>Resolution:</strong><br/>${resolution}</div><p>Thank you for your patience.</p>`
        }).catch(err => console.error('Failed to email dispute resolution:', err));
    }

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: session.role as string,
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'DISPUTE',
        entityId: disputeId,
        description: `Dispute resolved. Resolution: ${resolution}`,
    });

    revalidatePath('/dashboard/admin/disputes');
    return dispute;
}

/**
 * Close a dispute (no further action needed)
 */
export async function closeDispute(disputeId: string, notes?: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const dispute = await prisma.dispute.update({
        where: { id: disputeId },
        data: { status: 'CLOSED', adminNotes: notes, resolvedAt: new Date(), resolvedById: (session as any).userId }
    });

    revalidatePath('/dashboard/admin/disputes');
    return dispute;
}

/**
 * Get all disputes (admin)
 */
export async function getAllDisputes(filters?: { status?: string; type?: string; priority?: string }) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.type) where.type = filters.type;
    if (filters?.priority) where.priority = filters.priority;

    return prisma.dispute.findMany({ where, orderBy: { createdAt: 'desc' } });
}


/**
 * Get my disputes (student or owner)
 */
export async function getMyDisputes() {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    return prisma.dispute.findMany({
        where: { raisedById: (session as any).userId },
        orderBy: { createdAt: 'desc' }
    });
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FOOD BILLING ADMIN OVERRIDE (All 5 Specs Â§6)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type FoodOverrideAction = 'CREDIT' | 'REFUND' | 'DISABLE_FOOD';

/**
 * Admin-only: override food billing for a booking.
 *
 * CREDIT      â€” Create CreditNote (PENDING) applied at next invoice generation
 * REFUND      â€” Create CreditNote (REFUND) + mark latest invoice foodNotes
 * DISABLE_FOOD â€” Force food off: FoodPreference CONFIRMED false + booking cache update
 *
 * Rules:
 *  - Admin only
 *  - Notes mandatory
 *  - Full before/after AuditLog with IP + UA + UTC timestamp
 *  - No hard deletes
 */
export async function overrideFoodBilling(
    bookingId: string,
    action: FoodOverrideAction,
    amount?: number,
    notes?: string
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return { success: false, error: 'Unauthorized â€” Admin only.' };

    // â”€â”€ Input Validation â”€â”€
    if (!bookingId?.trim()) return { success: false, error: 'bookingId is required.' };
    if (!notes?.trim()) return { success: false, error: 'Notes are mandatory for admin overrides.' };
    if (amount !== undefined && (typeof amount !== 'number' || amount <= 0 || !isFinite(amount))) {
        return { success: false, error: 'Amount must be a positive finite number.' };
    }

    const adminId = (session as any).userId;
    const adminName = (session as any).name || 'Admin';

    const booking = await (prisma as any).booking.findUnique({
        where: { id: bookingId },
        select: { id: true, tenantId: true, userId: true, foodSelected: true, foodPriceApplied: true }
    });
    if (!booking) return { success: false, error: 'Booking not found.' };

    const prevState = { foodSelected: booking.foodSelected, action };

    try {
        // â”€â”€ CREDIT: create a pending credit note for next invoice â”€â”€
        if (action === 'CREDIT') {
            if (!amount || amount <= 0) return { success: false, error: 'Credit amount must be greater than 0.' };

            await prisma.creditNote.create({
                data: {
                    displayId: `CN-${Date.now()}`,
                    bookingId,
                    tenantId: booking.tenantId,
                    amount,
                    carryForward: 0,
                    reason: notes,
                    type: 'ADMIN_OVERRIDE',
                    createdById: adminId,
                    createdByRole: 'ADMIN',
                    status: 'PENDING',
                }
            });

            logAuditEvent({
                actorId: adminId, actorRole: 'ADMIN', actorName: adminName,
                actionType: 'CREATE', entityType: 'BOOKING', entityId: bookingId,
                description: `Admin issued credit note of â‚¹${amount}. Reason: ${notes}`,
                previousValue: prevState,
                newValue: { creditNoteAmount: amount, type: 'ADMIN_OVERRIDE' },
            });

            revalidatePath('/dashboard/admin');
            return { success: true };
        }

        // â”€â”€ REFUND: credit note + mark invoice foodNotes â”€â”€
        if (action === 'REFUND') {
            if (!amount || amount <= 0) return { success: false, error: 'Refund amount must be greater than 0.' };

            // Find latest invoice for this booking (correct: keyed by bookingId, not tenantId)
            const latestInvoice = await prisma.rentInvoice.findFirst({
                where: { bookingId },
                orderBy: { createdAt: 'desc' }
            });

            await prisma.creditNote.create({
                data: {
                    displayId: `CN-REF-${Date.now()}`,
                    bookingId,
                    tenantId: booking.tenantId,
                    invoiceId: latestInvoice?.id,
                    amount,
                    carryForward: 0,
                    reason: notes,
                    type: 'REFUND',
                    createdById: adminId,
                    createdByRole: 'ADMIN',
                    appliedToMonth: latestInvoice?.billingMonth,
                    status: 'PENDING',
                }
            });

            // Mark invoice with refund note (no amount modification â€” invoice is immutable)
            if (latestInvoice) {
                await prisma.rentInvoice.update({
                    where: { id: latestInvoice.id },
                    data: { foodNotes: `Refund issued: â‚¹${amount}. ${notes}` } as any
                });
            }

            logAuditEvent({
                actorId: adminId, actorRole: 'ADMIN', actorName: adminName,
                actionType: 'UPDATE', entityType: 'BOOKING', entityId: bookingId,
                description: `Admin issued food refund of â‚¹${amount}. Invoice: ${latestInvoice?.displayId || 'N/A'}. Reason: ${notes}`,
                previousValue: prevState,
                newValue: { refundAmount: amount, invoiceId: latestInvoice?.id },
            });

            revalidatePath('/dashboard/admin');
            return { success: true };
        }

        // â”€â”€ DISABLE_FOOD: force food off â€” bypasses student confirmation â”€â”€
        if (action === 'DISABLE_FOOD') {
            const { nextBillingCycleStart, toUTC } = await import('@/utils/foodBillingUtils');
            const billingProfile = await prisma.billingProfile.findFirst({
                where: { tenantId: booking.tenantId },
                select: { billingAnchorDay: true }
            });
            const anchorDay = billingProfile?.billingAnchorDay || 1;
            const effectiveFrom = toUTC(nextBillingCycleStart(anchorDay, new Date()));

            await prisma.foodPreference.create({
                data: {
                    bookingId,
                    propertyId: (await (prisma as any).booking.findUnique({
                        where: { id: bookingId }, select: { propertyId: true }
                    }))?.propertyId,
                    userId: booking.userId,
                    foodSelected: false,
                    changedBy: 'ADMIN',
                    changedById: adminId,
                    effectiveFrom,
                    notes: `ADMIN OVERRIDE: ${notes}`,
                    status: 'CONFIRMED',
                    confirmedAt: new Date(),
                }
            });

            await (prisma as any).booking.update({
                where: { id: bookingId },
                data: { foodSelected: false } as any
            });

            logAuditEvent({
                actorId: adminId, actorRole: 'ADMIN', actorName: adminName,
                actionType: 'UPDATE', entityType: 'BOOKING', entityId: bookingId,
                description: `Admin force-disabled food service (DISABLE_FOOD override). Reason: ${notes}. Effective: ${effectiveFrom.toISOString()}`,
                previousValue: { foodSelected: prevState.foodSelected },
                newValue: { foodSelected: false, effectiveFrom: effectiveFrom.toISOString(), adminOverride: true },
            });

            revalidatePath('/dashboard/admin');
            revalidatePath('/dashboard/student');
            return { success: true };
        }

        return { success: false, error: 'Unknown action.' };

    } catch (err: any) {
        console.error('[overrideFoodBilling]', err);
        return { success: false, error: err.message || 'Unexpected error.' };
    }
}

