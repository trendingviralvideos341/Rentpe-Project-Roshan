'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function uploadTenantDocument(data: {
    bookingId: string;
    type: string;
    fileData: string;
    fileName?: string;
}) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    // Upsert: if doc of this type already exists for this booking, replace it
    const existing = await prisma.tenantDocument.findFirst({
        where: { bookingId: data.bookingId, type: data.type }
    });

    if (existing) {
        return await prisma.tenantDocument.update({
            where: { id: existing.id },
            data: {
                fileData: data.fileData,
                fileName: data.fileName,
                status: 'PENDING',
                rejectedNote: null,
                verifiedAt: null,
                verifiedBy: null,
                uploadedAt: new Date(),
            }
        });
    }

    return await prisma.tenantDocument.create({
        data: {
            bookingId: data.bookingId,
            type: data.type,
            fileData: data.fileData,
            fileName: data.fileName,
            status: 'PENDING',
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

    const doc = await prisma.tenantDocument.update({
        where: { id: docId },
        data: {
            status,
            rejectedNote: status === 'REJECTED' ? (note || 'Document rejected') : null,
            verifiedAt: status === 'VERIFIED' ? new Date() : null,
            verifiedBy: (session as any).userId,
        }
    });

    await prisma.auditLog.create({
        data: {
            action: status === 'VERIFIED' ? 'DOCUMENT_VERIFIED' : 'DOCUMENT_REJECTED',
            targetId: docId,
            targetType: 'DOCUMENT',
            details: status === 'REJECTED' ? `Rejected: ${note}` : `Document ${doc.type} verified`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/owner/verifications');
    return doc;
}
