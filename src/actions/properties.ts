'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { uploadToCloudinary, batchUploadToCloudinary } from "@/lib/upload";

export async function getProperties(ownerId?: string) {
    const session = await getSession();
    let where: any = {};

    if (ownerId) {
        where.ownerId = ownerId;
    } else if (session?.role === 'OWNER') {
        const user = await prisma.user.findUnique({ where: { id: (session as any).userId } });
        // If staff, show parent's properties
        where.ownerId = user?.parentOwnerId || (session as any).userId;
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

    const buildingPhotos = formData.get("buildingPhotos") as string;
    const commonAreaPhotos = formData.get("commonAreaPhotos") as string;
    const roomsAndBathroomPhotos = formData.get("roomsAndBathroomPhotos") as string;
    const parkingPhotos = formData.get("parkingPhotos") as string;
    const amenitiesPhotos = formData.get("amenitiesPhotos") as string;

    const aadhaarProof = formData.get("aadhaarProof") as string;
    const panProof = formData.get("panProof") as string;
    const pgLicenceUrl = formData.get("pgLicenceUrl") as string;
    const livePhotoUrl = formData.get("livePhotoUrl") as string;

    const user = await prisma.user.findUnique({ where: { id: (session as any).userId } });

    // Server-side validation
    if (!name?.trim()) throw new Error("Property name is required");
    if (!address?.trim()) throw new Error("Address is required");
    if (!city?.trim()) throw new Error("City is required");

    // Auto-fill owner info from profile if not in form
    const finalOwnerName = ownerName?.trim() || user?.name || "Owner";

    // 1. Process Structured Documents & Photos
    const folder = `properties/${name.replace(/\s+/g, '_')}_${Date.now()}`;
    
    const uploadTasks = async () => {
        const results: any = {};
        
        // Helper for batch uploads
        const processBatch = async (field: string, data: string) => {
            if (data) {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    results[field] = await batchUploadToCloudinary(parsed, `${folder}/${field}`);
                }
            }
        };

        // Helper for single uploads (base64)
        const processSingle = async (field: string, data: string) => {
            if (data && data.startsWith('data:')) {
                results[field] = await uploadToCloudinary(data, folder);
            }
        };

        // Batch uploads for all categories
        await Promise.all([
            processBatch("buildingPhotos", buildingPhotos),
            processBatch("commonAreaPhotos", commonAreaPhotos),
            processBatch("roomsAndBathroomPhotos", roomsAndBathroomPhotos),
            processBatch("parkingPhotos", parkingPhotos),
            processBatch("amenitiesPhotos", amenitiesPhotos),
            processBatch("aadhaarProof", aadhaarProof),
            processBatch("panProof", panProof),
            processBatch("pgLicenceUrl", pgLicenceUrl),
        ]);

        // Single uploads
        await processSingle("livePhotoUrl", livePhotoUrl);

        return results;
    };

    const uploaded = await uploadTasks();

    // 2. Create property and rooms in a transaction
    const property = await (prisma as any).$transaction(async (tx: any) => {
        const newProperty = await tx.property.create({
            data: {
                name,
                address,
                city,
                description,
                amenities: amenities || "[]",
                images: images || JSON.stringify([
                    ...(uploaded.buildingPhotos || []),
                    ...(uploaded.roomsAndBathroomPhotos || [])
                ]),
                ownerName: finalOwnerName,
                pgLicence: pgLicence || null,
                ownerId: user?.parentOwnerId || (session as any).userId,
                status: "PENDING_APPROVAL",
                // Structured Category Mapping
                buildingPhotos: uploaded.buildingPhotos ? JSON.stringify(uploaded.buildingPhotos) : null,
                commonAreaPhotos: uploaded.commonAreaPhotos ? JSON.stringify(uploaded.commonAreaPhotos) : null,
                roomsAndBathroomPhotos: uploaded.roomsAndBathroomPhotos ? JSON.stringify(uploaded.roomsAndBathroomPhotos) : null,
                parkingPhotos: uploaded.parkingPhotos ? JSON.stringify(uploaded.parkingPhotos) : null,
                amenitiesPhotos: uploaded.amenitiesPhotos ? JSON.stringify(uploaded.amenitiesPhotos) : null,
                
                aadhaarProof: uploaded.aadhaarProof ? JSON.stringify(uploaded.aadhaarProof) : null,
                panProof: uploaded.panProof ? JSON.stringify(uploaded.panProof) : null,
                pgLicenceUrl: uploaded.pgLicenceUrl ? JSON.stringify(uploaded.pgLicenceUrl) : null,
                livePhotoUrl: uploaded.livePhotoUrl || null,
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

/**
 * Update Property Information
 * Critical changes (Rent, Amenities, Images) trigger internal re-verification status
 */
export async function updateProperty(propertyId: string, data: {
    name?: string;
    address?: string;
    description?: string;
    amenities?: string;
    images?: string;
    propertyType?: string;
    genderType?: string;
}) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const userId = (session as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const ownerId = user?.parentOwnerId || userId;

    const existing = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!existing || existing.ownerId !== ownerId) throw new Error("Property not found or unauthorized");

    // Logic: if price or images or amenities changed, we might want to flag for re-approval
    // For now, any update sets status back to PENDING_APPROVAL if it was LIVE
    const needsReapproval = data.images || data.amenities || data.name;
    const newStatus = (existing.status === 'LIVE' && needsReapproval) ? 'PENDING_APPROVAL' : existing.status;

    const updated = await prisma.property.update({
        where: { id: propertyId },
        data: {
            ...data,
            status: newStatus as any
        }
    });

    await prisma.auditLog.create({
        data: {
            action: 'PROPERTY_UPDATED',
            targetId: propertyId,
            targetType: 'PROPERTY',
            details: `Fields updated: ${Object.keys(data).join(', ')}. Status: ${newStatus}`,
            performedBy: userId
        }
    });

    revalidatePath(`/dashboard/owner/properties/${propertyId}`);
    revalidatePath('/dashboard/owner/properties');
    revalidatePath('/search');

    return updated;
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

    const folder = `properties/docs/${propertyId}`;
    const uploadData: any = { ...docs };

    // Handle single fields
    if (docs.aadhaarProof?.startsWith('data:')) uploadData.aadhaarProof = await uploadToCloudinary(docs.aadhaarProof, folder, true);
    if (docs.panProof?.startsWith('data:')) uploadData.panProof = await uploadToCloudinary(docs.panProof, folder, true);
    if (docs.pgLicenceUrl?.startsWith('data:')) uploadData.pgLicenceUrl = await uploadToCloudinary(docs.pgLicenceUrl, folder, true);
    if (docs.pgPhotoUrl?.startsWith('data:')) uploadData.pgPhotoUrl = await uploadToCloudinary(docs.pgPhotoUrl, folder);
    if (docs.parkingPhoto?.startsWith('data:')) uploadData.parkingPhoto = await uploadToCloudinary(docs.parkingPhoto, folder);
    if (docs.bathroomPhoto?.startsWith('data:')) uploadData.bathroomPhoto = await uploadToCloudinary(docs.bathroomPhoto, folder);
    if (docs.livePhotoUrl?.startsWith('data:')) uploadData.livePhotoUrl = await uploadToCloudinary(docs.livePhotoUrl, folder);

    // Handle JSON array fields
    if (docs.buildingPhotos) {
        try {
            const photos = JSON.parse(docs.buildingPhotos);
            // Only upload photos that are base64 (start with data:)
            const toUpload = photos.filter((p: string) => p.startsWith('data:'));
            const uploadedUrls = await batchUploadToCloudinary(toUpload, folder);
            
            // Reconstruct array with new URLs and existing non-base64 URLs
            const finalPhotos = photos.map((p: string) => p.startsWith('data:') ? uploadedUrls.shift() : p);
            uploadData.buildingPhotos = JSON.stringify(finalPhotos);
        } catch (e) {}
    }

    if (docs.commonAreaPhotos) {
        try {
            const photos = JSON.parse(docs.commonAreaPhotos);
            const toUpload = photos.filter((p: string) => p.startsWith('data:'));
            const uploadedUrls = await batchUploadToCloudinary(toUpload, folder);
            const finalPhotos = photos.map((p: string) => p.startsWith('data:') ? uploadedUrls.shift() : p);
            uploadData.commonAreaPhotos = JSON.stringify(finalPhotos);
        } catch (e) {}
    }

    await prisma.property.update({
        where: { id: propertyId, ownerId: (session as any).userId },
        data: uploadData
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
