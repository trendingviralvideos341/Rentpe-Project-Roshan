'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/actions/notifications";
import { uploadToCloudinary } from "@/lib/upload";

export async function uploadTenantDocument(data: {
    bookingId: string;
    type: string;
    fileData: string;
    fileName?: string;
}) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const userId = (session as any).userId;
    const userRole = session.role || 'USER';

    const auditEvent = {
        action: 'UPLOADED',
        timestamp: new Date().toISOString(),
        performedBy: userId,
        role: userRole,
        details: `Document ${data.type} uploaded`
    };

    // 1. Upload to Cloudinary
    const cloudUrl = await uploadToCloudinary(data.fileData, `kyc/${data.bookingId}`);

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

    return await prisma.tenantDocument.create({
        data: {
            bookingId: data.bookingId,
            type: data.type,
            fileData: cloudUrl,
            fileName: data.fileName,
            status: 'PENDING',
            auditTrail: JSON.stringify([auditEvent])
        }
    });
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
        action: status,
        timestamp: new Date().toISOString(),
        performedBy: userId,
        role: userRole,
        details: status === 'REJECTED' ? `Rejected: ${note}` : 'Document verified'
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

    await prisma.auditLog.create({
        data: {
            action: status === 'VERIFIED' ? 'DOCUMENT_VERIFIED' : 'DOCUMENT_REJECTED',
            targetId: docId,
            targetType: 'DOCUMENT',
            details: status === 'REJECTED' ? `Rejected: ${note}` : `Document ${doc.type} verified`,
            performedBy: userId
        }
    });

    // Notify the student about doc verification result
    try {
        const booking = await prisma.booking.findUnique({ where: { id: existingDoc.bookingId } });
        if (booking) {
            const msg = status === 'VERIFIED'
                ? `Your ${doc.type} document has been verified!`
                : `Your ${doc.type} document was rejected. ${note || 'Please re-upload.'}`;
            await createNotification(booking.userId, 'DOCUMENT', msg);
        }
    } catch (e) { }

    revalidatePath('/dashboard/owner/verifications');
    revalidatePath('/dashboard/admin/doc-verification');
    return doc;
}
