'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { NotificationService } from "@/lib/notifications";
import { uploadToCloudinary } from "@/lib/upload";
import { logAuditEvent } from "@/lib/audit";
import { randomUUID } from "crypto";

export async function uploadTenantDocument(data: {
    bookingId: string;
    type: string;
    fileData: string | File;
    fileName?: string;
}) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    // Security & Reliability Polish
    if (data.fileData instanceof File) {
        if (!data.fileData.type.startsWith('image/') && !data.fileData.type.includes('pdf')) {
             throw new Error("Only images and PDFs are allowed for KYC.");
        }
        if (data.fileData.size > 10 * 1024 * 1024) throw new Error("File size limit 10MB exceeded.");
    }

    const userId = (session as any).userId;
    const userRole = session.role || 'USER';

    const auditEvent = {
        action: 'UPLOADED',
        timestamp: new Date().toISOString(),
        performedBy: userId,
        role: userRole,
        details: `Document ${data.type} uploaded`
    };

    // 1. Upload to Cloudinary with private access
    // Randomized folder to prevent IDOR path guessing
    const folder = `kyc/${data.bookingId}_${randomUUID().slice(0, 8)}`;
    const cloudUrl = await uploadToCloudinary(data.fileData, folder, true);

    // Upsert: if doc of this type already exists for this booking, replace it
    const existing = await prisma.tenantDocument.findFirst({
        where: { bookingId: data.bookingId, type: data.type }
    });

    if (existing) {
        let currentTrail = [];
        try {
            currentTrail = JSON.parse(existing.auditTrail || '[]');
        } catch (e) { }

        auditEvent.action = 'REUPLOADED';
        auditEvent.details = `Document ${data.type} re-uploaded. URL: ${cloudUrl}`;
        currentTrail.push(auditEvent);

        return await prisma.tenantDocument.update({
            where: { id: existing.id },
            data: {
                fileData: cloudUrl,
                fileName: data.fileName,
                status: 'PENDING',
                rejectedNote: null,
                verifiedAt: null,
                verifiedBy: null,
                uploadedAt: new Date(),
                auditTrail: JSON.stringify(currentTrail)
            }
        });
    }

    const doc = await prisma.tenantDocument.create({
        data: {
            bookingId: data.bookingId,
            type: data.type,
            fileData: cloudUrl,
            fileName: data.fileName,
            status: 'PENDING',
            auditTrail: JSON.stringify([auditEvent])
        }
    });

    // Notify about KYC submission
    try {
        const booking = await prisma.booking.findUnique({
            where: { id: data.bookingId },
            include: { property: true }
        });
        if (booking && booking.property) {
            await NotificationService.onKycSubmitted(booking, booking.property.ownerId);
        }
    } catch (e) {
        console.error("KYC Submission Notification Error:", e);
    }

    return doc;
}

export async function getTenantDocuments(bookingId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    return await prisma.tenantDocument.findMany({
        where: { bookingId },
        orderBy: { uploadedAt: 'desc' }
    });
}

export async function getPendingDocuments() {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const userId = (session as any).userId;

    if (session.role === 'OWNER') {
        // Get bookings for this owner's properties
        const properties = await prisma.property.findMany({
            where: { ownerId: userId },
            select: { name: true }
        });
        const propertyNames = properties.map((p: any) => p.name);

        const bookings = await prisma.booking.findMany({
            where: { propertyName: { in: propertyNames } },
            select: { id: true, displayId: true, guestName: true, propertyName: true }
        });
        const bookingIds = bookings.map((b: any) => b.id);

        const docs = await prisma.tenantDocument.findMany({
            where: { bookingId: { in: bookingIds } },
            include: {
                booking: {
                    select: {
                        id: true,
                        displayId: true,
                        guestName: true,
                        propertyName: true,
                        guestPhone: true,
                        guestEmail: true,
                        roomAssigned: true,
                        occupancy: true,
                        amount: true,
                        paymentMethod: true,
                        paidAt: true
                    }
                }
            },
            orderBy: { uploadedAt: 'desc' }
        });
        return docs;
    }

    // Admin: all docs with full customer details
    return await prisma.tenantDocument.findMany({
        include: {
            booking: {
                select: {
                    id: true,
                    displayId: true,
                    guestName: true,
                    propertyName: true,
                    guestPhone: true,
                    guestEmail: true,
                    roomAssigned: true,
                    occupancy: true,
                    amount: true,
                    paymentMethod: true,
                    paidAt: true
                }
            }
        },
        orderBy: { uploadedAt: 'desc' }
    });
}

export async function getPendingDocumentsCount() {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) return 0;

    const userId = (session as any).userId;

    if (session.role === 'OWNER') {
        const properties = await prisma.property.findMany({
            where: { ownerId: userId },
            select: { name: true }
        });
        const propertyNames = properties.map((p: any) => p.name);

        const bookings = await prisma.booking.findMany({
            where: { propertyName: { in: propertyNames } },
            select: { id: true }
        });
        const bookingIds = bookings.map((b: any) => b.id);

        return await prisma.tenantDocument.count({
            where: { bookingId: { in: bookingIds }, status: 'PENDING' }
        });
    }

    return await prisma.tenantDocument.count({
        where: { status: 'PENDING' }
    });
}

export async function verifyDocument(docId: string, status: 'VERIFIED' | 'REJECTED', note?: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const userId = (session as any).userId;
    const userRole = session.role;

    const existingDoc = await prisma.tenantDocument.findUnique({ where: { id: docId } });
    if (!existingDoc) throw new Error("Document not found");

    let currentTrail = [];
    try {
        currentTrail = JSON.parse(existingDoc.auditTrail || '[]');
    } catch (e) { }

    currentTrail.push({
        actionType: status,
        createdAt: new Date().toISOString(),
        actorId: userId,
        actorRole: userRole,
        description: status === 'REJECTED' ? `Rejected: ${note}` : 'Document verified'
    });

    const doc = await prisma.tenantDocument.update({
        where: { id: docId },
        data: {
            status,
            rejectedNote: status === 'REJECTED' ? (note || 'Document rejected') : null,
            verifiedAt: status === 'VERIFIED' ? new Date() : null,
            verifiedBy: userId,
            auditTrail: JSON.stringify(currentTrail)
        }
    });

    // If verified, check if booking can move to PAYMENT_PENDING
    if (status === 'VERIFIED') {
        const allDocs = await prisma.tenantDocument.findMany({
            where: { bookingId: existingDoc.bookingId }
        });
        const verifiedCount = allDocs.filter(d => d.status === 'VERIFIED').length;

        // Industry Standard: If 2 or more docs (ID + Address/Student) are verified, move to Payment
        if (verifiedCount >= 2) {
            await prisma.booking.update({
                where: { id: existingDoc.bookingId },
                data: { status: 'APPROVED_PAYMENT_PENDING' }
            });
        }
    }

    logAuditEvent({
        actorId: userId,
        actorRole: userRole as string,
        actorName: (session as any).name || (userRole === 'ADMIN' ? 'Admin' : 'Owner'),
        actionType: status === 'VERIFIED' ? 'APPROVE' : 'REJECT',
        entityType: 'DOCUMENT',
        entityId: docId,
        description: status === 'REJECTED' ? `Rejected: ${note}` : `Document ${doc.type} verified`,
    });

    // Notify the student about doc verification result
    try {
        const booking = await prisma.booking.findUnique({ 
            where: { id: existingDoc.bookingId },
            include: { property: true }
        });
        if (booking) {
            if (status === 'VERIFIED') {
                if (session.role === 'OWNER') {
                    await NotificationService.onOwnerReviewed(booking);
                } else if (session.role === 'ADMIN' || session.role === 'VERIFIER') {
                    // Check if overall KYC is now verified (>= 2 docs)
                    const allDocs = await prisma.tenantDocument.findMany({
                        where: { bookingId: booking.id }
                    });
                    const verifiedCount = allDocs.filter(d => d.status === 'VERIFIED').length;
                    if (verifiedCount >= 2 && booking.property) {
                        await NotificationService.onKycVerified(booking, booking.property.ownerId);
                    }
                }
            } else if (status === 'REJECTED') {
                await NotificationService.trigger({
                    bookingId: booking.id,
                    userId: booking.userId,
                    type: 'KYC',
                    category: 'KYC_DOC_REJECTED',
                    message: `Your ${doc.type} document was rejected. Reason: ${note || 'Please re-upload.'}`,
                    targetRole: 'USER',
                    isPersistent: true
                });
            }
        }
    } catch (e) {
        console.error("Doc Verification Notification Error:", e);
    }

    revalidatePath('/dashboard/owner/verifications');
    revalidatePath('/dashboard/admin/doc-verification');
    return doc;
}
