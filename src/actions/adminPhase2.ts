'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { createNotification } from "@/actions/notifications";
import { sendEmail } from "@/lib/email";
import { getSLAStatus } from "@/lib/sla";
import { KycRejectedTemplate } from "@/lib/email-templates";

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

            queue.push({
                id: `${prop.id}__${docType}`,
                propertyId: prop.id,
                propertyName: prop.name,
                propertyDisplayId: prop.displayId,
                city: prop.city,
                docType,
                docLabel: info.label,
                docUrl: info.url,
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

    // Enrich with booking + user data
    const enriched = await Promise.all(refunds.map(async (r: any) => {
        const booking = r.bookingId
            ? await prisma.booking.findUnique({
                where: { id: r.bookingId },
                include: { user: { select: { id: true, name: true, email: true, phone: true } } }
            })
            : null;
        return { ...r, booking };
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

    return {
        refunds: enriched,
        stats: { pendingCount, processedAmount, rejectedCount, totalAmount }
    };
}

export async function approveRefund(refundId: string, note?: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const refund = await prisma.refundRecord.update({
        where: { id: refundId },
        data: {
            status: 'PROCESSED',
            processedBy: (session as any).userId,
            processedAt: new Date(),
            notes: note
        }
    });

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
            `✅ Your refund of ₹${refund.amount} has been approved and will be processed within 5-7 business days.`
        );
    }

    await logAuditEvent({
        actorId: (session as any).userId,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'APPROVE',
        entityType: 'REFUND',
        entityId: refundId,
        description: `Refund of ₹${refund.amount} approved. Note: ${note || 'N/A'}`,
    });

    revalidatePath('/dashboard/admin/refunds');
    return { success: true };
}

export async function rejectRefund(refundId: string, reason: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

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
        return { ...p, owner };
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

