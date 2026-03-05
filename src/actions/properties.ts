'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function getProperties(ownerId?: string) {
    const session = await getSession();
    let where: any = {};

    if (ownerId) {
        where.ownerId = ownerId;
    } else if (session?.role === 'OWNER') {
        where.ownerId = (session as any).userId;
    }

    return prisma.property.findMany({
        where,
        include: {
            rooms: true,
            owner: {
                select: {
                    name: true,
                    email: true
                }
            }
        },
        orderBy: {
            updatedAt: 'desc'
        }
    });
}

export async function getPendingOwnerActionCount() {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') return 0;

    const properties = await prisma.property.findMany({
        where: { ownerId: (session as any).userId },
        select: { status: true, adminNotes: true }
    });

    return properties.filter(p => p.status === 'REJECTED' || (p.status === 'PENDING_APPROVAL' && p.adminNotes?.includes('[REUPLOAD'))).length;
}

export async function getPropertyById(id: string) {
    return prisma.property.findUnique({
        where: { id },
        include: {
            rooms: true,
            foodMenu: true,
            owner: {
                select: {
                    name: true,
                    email: true
                }
            }
        }
    });
}

export async function createProperty(formData: FormData) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') {
        throw new Error("Unauthorized");
    }

    const name = formData.get("name") as string;
    const address = formData.get("address") as string;
    const city = formData.get("city") as string;
    const description = formData.get("description") as string;
    const amenities = formData.get("amenities") as string; // JSON string
    const images = formData.get("images") as string; // JSON string
    const ownerName = formData.get("ownerName") as string;
    const pgLicence = formData.get("pgLicence") as string;
    const roomsJson = formData.get("rooms") as string;

    // Server-side validation
    if (!name?.trim()) throw new Error("Property name is required");
    if (!address?.trim()) throw new Error("Address is required");
    if (!city?.trim()) throw new Error("City is required");
    if (!description?.trim()) throw new Error("Description is required");
    if (!ownerName?.trim()) throw new Error("Building owner name is required");

    // Create property and rooms in a transaction
    const property = await prisma.$transaction(async (tx) => {
        const newProperty = await tx.property.create({
            data: {
                name,
                address,
                city,
                description,
                amenities: amenities || "[]",
                images: images || "[]",
                ownerName: ownerName || null,
                pgLicence: pgLicence || null,
                ownerId: (session as any).userId,
                status: "PENDING_APPROVAL",
            }
        });

        if (roomsJson) {
            const rooms = JSON.parse(roomsJson);
            if (Array.isArray(rooms) && rooms.length > 0) {
                await tx.room.createMany({
                    data: rooms.map((r: any) => ({
                        propertyId: newProperty.id,
                        roomNumber: r.roomNumber.toString(),
                        type: r.type,
                        price: parseFloat(r.price),
                        availability: parseInt(r.availability),
                    }))
                });
            }
        }

        return newProperty;
    });

    return property;
}

export async function savePropertyDocuments(propertyId: string, docs: {
    aadhaarProof?: string,
    panProof?: string,
    pgLicenceUrl?: string,
    pgPhotoUrl?: string,
    buildingPhotos?: string, // JSON array string
    commonAreaPhotos?: string,
    parkingPhoto?: string,
    bathroomPhoto?: string,
    livePhotoUrl?: string,
    adminNotes?: string | null,
}) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    await prisma.property.update({
        where: { id: propertyId, ownerId: (session as any).userId },
        data: docs
    });

    return { success: true };
}

export async function addRoomToProperty(propertyId: string, roomData: { roomNumber: string, type: string, price: number, availability: number, photoUrl?: string }) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    // Verify ownership
    const property = await prisma.property.findUnique({ where: { id: propertyId, ownerId: (session as any).userId } });
    if (!property) throw new Error("Property not found or unauthorized");

    const room = await prisma.room.create({
        data: {
            ...roomData,
            propertyId
        }
    });

    return room;
}

export async function editRoom(roomId: string, roomData: { roomNumber: string, type: string, price: number, availability: number, photoUrl?: string }) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { property: true }
    });

    if (!room || room.property.ownerId !== (session as any).userId) {
        throw new Error("Room not found or unauthorized");
    }

    return prisma.room.update({
        where: { id: roomId },
        data: roomData
    });
}

export async function deletePropertyDocument(propertyId: string, docType: string, index?: number) {
    try {
        const property = await prisma.property.findUnique({
            where: { id: propertyId },
            select: { [docType]: true, verifiedDocs: true } as any
        });

        if (!property) return { success: false, error: "Property not found" };

        let updateData: any = {};
        const currentValue = (property as any)[docType];
        let verifiedDocs = JSON.parse((property as any).verifiedDocs || "[]");

        if (index !== undefined && currentValue) {
            // Handle JSON array fields (buildingPhotos, commonAreaPhotos)
            try {
                const photos = JSON.parse(currentValue);
                if (Array.isArray(photos)) {
                    photos.splice(index, 1);
                    updateData[docType] = photos.length > 0 ? JSON.stringify(photos) : null;

                    // Remove verification for this specific slot
                    const docKey = `${docType}-${index}`;
                    verifiedDocs = verifiedDocs.filter((key: string) => key !== docKey);
                }
            } catch (e) {
                updateData[docType] = null;
            }
        } else {
            // Handle single string fields
            updateData[docType] = null;
            verifiedDocs = verifiedDocs.filter((key: string) => key !== docType);
        }

        updateData.verifiedDocs = JSON.stringify(verifiedDocs);

        await prisma.property.update({
            where: { id: propertyId },
            data: updateData
        });

        return { success: true };
    } catch (error) {
        console.error("Delete Doc Error:", error);
        return { success: false, error: "Failed to delete document" };
    }
}

export async function togglePropertyDocumentVerification(propertyId: string, docKey: string, verified: boolean) {
    try {
        const property = await prisma.property.findUnique({
            where: { id: propertyId },
            select: { verifiedDocs: true }
        });

        if (!property) return { success: false, error: "Property not found" };

        let verifiedDocs = [];
        try {
            verifiedDocs = JSON.parse(property.verifiedDocs || "[]");
        } catch (e) {
            verifiedDocs = [];
        }

        if (verified) {
            if (!verifiedDocs.includes(docKey)) {
                verifiedDocs.push(docKey);
            }
        } else {
            verifiedDocs = verifiedDocs.filter((key: string) => key !== docKey);
        }

        await prisma.property.update({
            where: { id: propertyId },
            data: { verifiedDocs: JSON.stringify(verifiedDocs) }
        });

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function requestDocumentReupload(propertyId: string, docType: string, note: string) {
    try {
        const property = await prisma.property.findUnique({
            where: { id: propertyId },
            select: { adminNotes: true }
        });

        if (!property) return { success: false, error: "Property not found" };

        // Append reupload request to admin notes using a structured tag
        const reuploadTag = `[REUPLOAD:${docType}] ${note}`;
        const newNotes = property.adminNotes
            ? `${property.adminNotes}\n${reuploadTag}`
            : reuploadTag;

        await prisma.property.update({
            where: { id: propertyId },
            data: {
                adminNotes: newNotes,
                status: 'PENDING_APPROVAL' // Set to pending to notify owner without rejecting the whole property
            }
        });

        return { success: true };
    } catch (error) {
        console.error("Request Reupload Error:", error);
        return { success: false, error: "Failed to request reupload" };
    }
}

// ── P8: Owner Onboarding Fee Payment Simulation ──
import { revalidatePath } from "next/cache";

export async function payOnboardingFee(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const property = await prisma.property.findUnique({
        where: { id: propertyId, ownerId: (session as any).userId },
        select: { status: true, name: true }
    });

    if (!property || property.status !== 'PAYMENT_PENDING') {
        throw new Error("Property is not awaiting payment.");
    }

    // 1. Mark as LIVE
    await prisma.property.update({
        where: { id: propertyId },
        data: { status: 'LIVE' }
    });

    // 2. Add to Audit Log
    await prisma.auditLog.create({
        data: {
            action: 'ONBOARDING_FEE_PAID',
            targetId: propertyId,
            targetType: 'PROPERTY',
            details: `Owner paid onboarding fee for property ${property.name}. Status is now LIVE.`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/owner/properties');
    revalidatePath('/search');

    return { success: true };
}
