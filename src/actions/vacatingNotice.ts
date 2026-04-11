'use server';

import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAuditEvent } from '@/lib/audit';
import { generateSequentialId } from '@/lib/ids';

// ─── fileVacatingNotice ───────────────────────────────────────────────────────
export async function fileVacatingNotice(data: {
    bookingId: string;
    plannedMoveOut: string;
    reason: string;
}) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');

    const userId = (session as any).userId;

    const booking = await prisma.booking.findUnique({
        where: { id: data.bookingId },
        include: { property: { select: { id: true, ownerId: true, minimumNoticeDays: true } } }
    });

    if (!booking) throw new Error('Booking not found');
    if (booking.userId !== userId && session.role !== 'ADMIN') throw new Error('Unauthorized');

    const moveOut = new Date(data.plannedMoveOut);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysDiff = Math.ceil((moveOut.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const minimumNotice = (booking.property as any)?.minimumNoticeDays ?? 30;

    if (daysDiff < minimumNotice) {
        throw new Error(
            `Minimum notice period is ${minimumNotice} days. To vacate earlier, contact your PG/Hostel Management Incharge.`
        );
    }

    const displayId = await generateSequentialId('VN');

    const notice = await prisma.vacatingNotice.create({
        data: {
            displayId,
            bookingId: data.bookingId,
            userId,
            propertyId: booking.propertyId!,
            ownerId: booking.property!.ownerId,
            plannedMoveOut: moveOut,
            reason: data.reason,
            status: 'SUBMITTED',
            submittedAt: new Date(),
        } as any
    });

    // Notify owner
    try {
        await prisma.notification.create({
            data: {
                userId: booking.property!.ownerId,
                type: 'VACATING_NOTICE',
                category: 'NOTICE',
                message: `Tenant has submitted a vacating notice for move-out on ${moveOut.toLocaleDateString('en-IN')}. Reason: ${data.reason}`,
                isPersistent: true,
            }
        });
    } catch (e) { console.error('Notify error', e); }

    logAuditEvent({
        actorId: userId,
        actorRole: session.role as string,
        actorName: (session as any).name || 'Tenant',
        actionType: 'CREATE',
        entityType: 'BOOKING',
        entityId: data.bookingId,
        description: `Vacating notice filed. Planned move-out: ${data.plannedMoveOut}. Days notice: ${daysDiff}.`,
    });

    revalidatePath('/dashboard/student');
    revalidatePath('/dashboard/owner/tenants');
    return notice;
}

// ─── acknowledgeVacatingNotice (Owner action) ─────────────────────────────────
export async function acknowledgeVacatingNotice(noticeId: string, approvedMoveOutDate?: string, ownerNote?: string) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) throw new Error('Unauthorized');

    const notice = await (prisma.vacatingNotice as any).update({
        where: { id: noticeId },
        data: {
            status: 'ACKNOWLEDGED',
            ownerNote: ownerNote || null,
            acknowledgedAt: new Date(),
            ...(approvedMoveOutDate ? { plannedMoveOut: new Date(approvedMoveOutDate) } : {}),
        }
    });

    // Notify tenant
    try {
        await prisma.notification.create({
            data: {
                userId: notice.userId,
                type: 'VACATING_NOTICE',
                category: 'NOTICE',
                message: approvedMoveOutDate
                    ? `✅ Your vacating notice has been acknowledged. Approved move-out: ${new Date(approvedMoveOutDate).toLocaleDateString('en-IN')}.`
                    : `✅ Your vacating notice has been acknowledged.`,
                isPersistent: true,
            }
        });
    } catch (e) { console.error('Notify error', e); }

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: session.role as string,
        actorName: (session as any).name || 'Owner',
        actionType: 'UPDATE',
        entityType: 'BOOKING',
        entityId: notice.bookingId,
        description: `Vacating notice acknowledged. ${approvedMoveOutDate ? `Approved date: ${approvedMoveOutDate}` : ''}`,
    });

    revalidatePath('/dashboard/owner/tenants');
    revalidatePath('/dashboard/student');
    return notice;
}

// ─── setPropertyNoticePeriod (Owner action) ───────────────────────────────────
export async function setPropertyNoticePeriod(propertyId: string, noticeDays: number) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) throw new Error('Unauthorized');
    if (noticeDays < 1 || noticeDays > 30) throw new Error('Notice period must be between 1 and 30 days.');

    const updated = await prisma.property.update({
        where: { id: propertyId },
        data: { minimumNoticeDays: noticeDays } as any
    });

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: session.role as string,
        actorName: (session as any).name || 'Owner',
        actionType: 'UPDATE',
        entityType: 'PROPERTY',
        entityId: propertyId,
        description: `Minimum notice period changed to ${noticeDays} days.`,
    });

    revalidatePath('/dashboard/owner/settings');
    return updated;
}

// ─── getVacatingNotices (Owner view) ─────────────────────────────────────────
export async function getVacatingNotices(propertyId?: string) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) throw new Error('Unauthorized');

    return (prisma.vacatingNotice as any).findMany({
        where: propertyId ? { propertyId } : undefined,
        orderBy: { submittedAt: 'desc' },
        take: 50,
    });
}
