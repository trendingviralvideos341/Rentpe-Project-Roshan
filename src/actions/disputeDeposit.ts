'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { generateMasterId } from "@/lib/ids";

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT 4: Student Deposit Dispute Escalation
//
// Philosophy (Aggregator Model):
//   - RentPe is NOT a court or arbitrator.
//   - The lease and settlement are strictly between owner and student.
//   - RentPe assists ONLY when a student escalates a dispute after 15 days.
//   - The primary enforcement lever is Rent Withholding (Component 3).
//   - No photo uploads — RentPe does not store evidence files.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Student raises a deposit dispute.
 * Can only be raised if:
 *   1. Student is Checked Out
 *   2. Deposit status is PAID (unprocessed) or REFUND_OVERDUE
 *   3. No other open dispute for same deposit
 */
export async function raiseDepositDispute(depositId: string, reason: string, details?: string) {
    const session = await getSession();
    if (!session || (session as any).role !== 'USER') throw new Error('Unauthorized');

    const userId = (session as any).userId;

    // Rate limiting: max 3 disputes per day per user (anti-spam)
    const recentDisputes = await (prisma as any).dispute.count({
        where: {
            raisedById: userId,
            type: 'DEPOSIT_DISPUTE',
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
    });
    if (recentDisputes >= 3) {
        throw new Error('Rate limit: You can raise a maximum of 3 disputes per day. Please contact support@rentpe.in if this is urgent.');
    }

    // Fetch the deposit with ownership verification
    const deposit = await (prisma as any).securityDeposit.findUnique({
        where: { id: depositId },
        include: {
            billingProfile: {
                include: {
                    tenant: {
                        select: {
                            id: true, name: true, email: true, status: true,
                            booking: { select: { userId: true, id: true, propertyId: true } }
                        }
                    }
                }
            }
        }
    });

    if (!deposit) throw new Error('Deposit record not found');

    // Ownership check: Only the student who owns this deposit can raise a dispute
    const tenantBookingUserId = deposit.billingProfile?.tenant?.booking?.userId;
    if (tenantBookingUserId !== userId) {
        throw new Error('Unauthorized: This is not your deposit');
    }

    // Status check: Only raise dispute for unresolved deposits
    const allowedStatuses = ['PAID', 'REFUND_OVERDUE'];
    if (!allowedStatuses.includes(deposit.status)) {
        throw new Error(`Cannot raise dispute. Deposit status is "${deposit.status}". Disputes can only be raised for active or overdue deposits.`);
    }

    // Tenant must be Checked Out to raise a post-move-out dispute
    const tenantStatus = deposit.billingProfile?.tenant?.status;
    if (tenantStatus !== 'Checked Out') {
        throw new Error('You must have completed your move-out before raising a deposit dispute.');
    }

    // Check for existing open dispute
    const existingDispute = await (prisma as any).dispute.findFirst({
        where: {
            raisedById: userId,
            type: 'DEPOSIT_DISPUTE',
            status: { in: ['OPEN', 'IN_REVIEW', 'ESCALATED'] }
        }
    });
    if (existingDispute) {
        throw new Error(`You already have an open dispute (Ref: ${existingDispute.displayId}). Please wait for it to be resolved before raising a new one.`);
    }

    const tenant = deposit.billingProfile?.tenant;
    const displayId = await generateMasterId('DSP');

    // Create the dispute record
    const dispute = await (prisma as any).dispute.create({
        data: {
            displayId,
            tenantId: tenant?.id,
            bookingId: deposit.billingProfile?.tenant?.booking?.id || null,
            propertyId: deposit.billingProfile?.tenant?.booking?.propertyId || null,
            raisedById: userId,
            raisedByRole: 'USER',
            type: 'DEPOSIT_DISPUTE',
            subject: 'Security Deposit Refund Dispute',
            title: `Deposit Refund Not Processed`,
            description: reason + (details ? `\n\nAdditional Details:\n${details}` : ''),
            status: 'OPEN',
            priority: deposit.status === 'REFUND_OVERDUE' ? 'HIGH' : 'MEDIUM',
        }
    });

    // Security: Log for fraud analysis — pattern detection
    logAuditEvent({
        actorId: userId,
        actorRole: 'USER',
        actorName: tenant?.name || 'Student',
        actionType: 'CREATE',
        entityType: 'DISPUTE',
        entityId: dispute.id,
        description: `Student raised deposit dispute. Deposit ID: ${depositId}. Status: ${deposit.status}. Reason: ${reason}`,
        newValue: { disputeId: dispute.id, displayId, depositId, status: deposit.status }
    });

    // Notify admin
    await prisma.notification.create({
        data: {
            userId: userId,
            type: 'SUPPORT',
            category: 'DISPUTE_RAISED',
            message: `🆕 New deposit dispute raised by ${tenant?.name || 'Student'}. Ref: ${displayId}. Deposit: ₹${deposit.amount.toLocaleString('en-IN')}.`,
            isPersistent: true,
        }
    }).catch(() => {});

    // Send confirmation email to student
    if (tenant?.email) {
        sendEmail({
            to: tenant.email,
            subject: `Dispute Registered — Ref: ${displayId} | RentPe`,
            html: `
            <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:28px 24px;text-align:center;">
                <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">🏠 RentPe</h1>
                <p style="color:rgba(255,255,255,0.9);margin:6px 0 0;font-size:13px;">Deposit Dispute Registered</p>
              </div>
              <div style="padding:28px 24px;">
                <p style="color:#374151;font-size:15px;margin:0 0 8px;">Hi <strong>${tenant.name || 'there'}</strong>,</p>
                <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Your deposit dispute has been registered. Our team will review and respond within 3–5 business days.</p>
                <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
                  <p style="color:#92400e;font-size:13px;margin:0 0 6px;"><strong>Dispute Reference:</strong> ${displayId}</p>
                  <p style="color:#92400e;font-size:13px;margin:0 0 6px;"><strong>Deposit Amount:</strong> ₹${Number(deposit.amount).toLocaleString('en-IN')}</p>
                  <p style="color:#92400e;font-size:13px;margin:0;"><strong>Status:</strong> Under Review</p>
                </div>
                <p style="color:#6b7280;font-size:13px;margin:0;">We may contact you via email for any clarifications. In the meantime, please do not raise duplicate disputes.</p>
                <a href="https://rentpe.in/dashboard/student" style="display:inline-block;background:#f59e0b;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">Track Dispute Status →</a>
              </div>
              <div style="border-top:1px solid #f1f5f9;padding:16px 24px;text-align:center;">
                <p style="color:#d1d5db;font-size:11px;margin:0;">© 2025 RentPe · support@rentpe.in</p>
              </div>
            </div>`
        }).catch(err => console.error('[DISPUTE EMAIL] Failed:', err));
    }

    revalidatePath('/dashboard/student');
    revalidatePath('/dashboard/admin');

    return { success: true, disputeId: dispute.id, displayId };
}

/**
 * Admin resolves a deposit dispute.
 * Optionally triggers a rent-withheld refund.
 */
export async function resolveDepositDispute(
    disputeId: string,
    resolution: string,
    action: 'FAVOR_STUDENT' | 'FAVOR_OWNER' | 'PARTIAL' | 'DISMISSED'
) {
    const session = await getSession();
    if (!session || (session as any).role !== 'ADMIN') throw new Error('Unauthorized — Admin only');

    const dispute = await (prisma as any).dispute.findUnique({
        where: { id: disputeId },
        include: {
            tenant: {
                include: {
                    billingProfile: {
                        include: { deposit: { select: { id: true, amount: true, status: true } } }
                    }
                }
            }
        }
    });
    if (!dispute) throw new Error('Dispute not found');

    await (prisma as any).dispute.update({
        where: { id: disputeId },
        data: {
            status: 'RESOLVED',
            resolution,
            resolvedById: (session as any).userId,
            resolvedAt: new Date(),
            adminNotes: `Resolution: ${action}. ${resolution}`,
        }
    });

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'DISPUTE',
        entityId: disputeId,
        description: `Deposit dispute resolved. Action: ${action}. Resolution: ${resolution}`,
        newValue: { status: 'RESOLVED', action, resolution }
    });

    revalidatePath('/dashboard/admin');
    revalidatePath('/dashboard/student');
    return { success: true };
}

/**
 * Get all deposit disputes — Admin only.
 * Used in admin dispute management panel.
 */
export async function getAllDepositDisputes(status?: string) {
    const session = await getSession();
    if (!session || (session as any).role !== 'ADMIN') throw new Error('Unauthorized');

    const where: any = { type: 'DEPOSIT_DISPUTE' };
    if (status) where.status = status;

    const disputes = await (prisma as any).dispute.findMany({
        where,
        include: {
            tenant: { select: { name: true, email: true, roomNumber: true } },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }]
    });

    return disputes.map((d: any) => ({
        id: d.id,
        displayId: d.displayId,
        status: d.status,
        priority: d.priority,
        tenantName: d.tenant?.name || 'Unknown',
        tenantEmail: d.tenant?.email || '',
        roomNumber: d.tenant?.roomNumber || '',
        description: d.description,
        resolution: d.resolution,
        createdAt: d.createdAt,
        resolvedAt: d.resolvedAt,
    }));
}
