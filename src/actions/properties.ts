'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { uploadToCloudinary, batchUploadToCloudinary } from "@/lib/upload";
import { logAuditEvent } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { generateSequentialId } from "@/lib/ids";

export async function getProperties(ownerId?: string) {
    const session = await getSession();
    const where: any = {};

    if (ownerId) {
        where.ownerId = ownerId;
    } else if (session?.role === 'OWNER') {
        const user = await prisma.user.findUnique({ 
            where: { id: session.userId },
            include: { employeeProfile: true }
        });
        
        if (user?.employeeProfile) {
            // For Owner Staff, restrict to assigned properties
            const assignedIds = await prisma.employeePropertyAssignment.findMany({
                where: { employeeId: user.employeeProfile.id },
                select: { propertyId: true }
            });
            where.id = { in: assignedIds.map((a: any) => a.propertyId) };
        } else {
            // Primary owner sees all their properties
            where.ownerId = user?.parentOwnerId || session.userId;
        }
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
        where: { ownerId: session.userId },
        select: { status: true, adminNotes: true }
    });

    return properties.filter(p => p.status === 'REJECTED' || (p.status === 'PENDING_APPROVAL' && p.adminNotes?.includes('[REUPLOAD'))).length;
}

export async function getPropertyById(id: string) {
    const session = await getSession();
    const property = await prisma.property.findUnique({
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

    if (!property) return null;

    // Access control for owners/staff
    if (session?.role === 'OWNER') {
        const user = await prisma.user.findUnique({ 
            where: { id: session.userId },
            include: { employeeProfile: true }
        });
        
        if (user?.employeeProfile) {
            const isAssigned = await prisma.employeePropertyAssignment.findUnique({
                where: {
                    employeeId_propertyId: {
                        employeeId: user.employeeProfile.id,
                        propertyId: id
                    }
                }
            });
            if (!isAssigned) throw new Error("Access denied: Not assigned to this property");
        } else if (property.ownerId !== (user?.parentOwnerId || session.userId)) {
             throw new Error("Access denied: Not your property");
        }
    }

    return property;
}

export async function createProperty(data: FormData | any) {
    try {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') {
        throw new Error("Unauthorized");
    }

    // 1. Unified Data Extraction (Supports both FormData and JSON)
    const isFormData = data instanceof FormData;
    const getVal = (key: string) => isFormData ? (data.get(key) as string) : (data[key] as string);
    const getAllVal = (key: string) => isFormData ? data.getAll(key) : (data[key] || []);

    const name = getVal("name");
    const address = getVal("address");
    const city = getVal("city");
    const description = getVal("description");
    const amenities = getVal("amenities"); 
    const ownerName = getVal("ownerName");
    const roomsSource = getVal("rooms");
    const propertyType = getVal("propertyType");
    const licenseNumber = getVal("licenseNumber");
    const reraId = getVal("reraId");
    const businessName = getVal("businessName");

    // Reject raw Files in legacy path
    if (isFormData) {
        for (const [key, value] of data.entries()) {
            if (value instanceof File && value.size > 0) {
                console.error(`🔴 Raw file detected in field "${key}". Submission rejected.`);
                throw new Error("Photos must be pre-uploaded. Please try again.");
            }
        }
    }

    const buildingPhotos = getAllVal("buildingPhotos");
    const commonAreaPhotos = getAllVal("commonAreaPhotos");
    const roomsAndBathroomPhotos = getAllVal("roomsAndBathroomPhotos");
    const parkingPhotos = getAllVal("parkingPhotos");
    const amenitiesPhotos = getAllVal("amenitiesPhotos");
    const aadhaarProof = getAllVal("aadhaarProof");
    const panProof = getAllVal("panProof");
    const pgLicenceUrl = getAllVal("pgLicenceUrl");
    const livePhotoUrl = getVal("livePhotoUrl");

    const userId = (session as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // Validation
    if (!name?.trim()) throw new Error("Property name is required");
    const finalOwnerName = ownerName?.trim() || user?.name || "Owner";

    // --- REFRESHABLE ID LOGIC ---
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
        try {
            // 2. HIGH-SPEED ID GENERATION (O(1) Indexed Lookup)
            // Refined: Sort by displayId to ensure we always get the actual maximum
            const [lastProp, lastRoom, lastBed] = await Promise.all([
                prisma.property.findFirst({ where: { displayId: { startsWith: 'REN-PROP-' } }, orderBy: { displayId: 'desc' }, select: { displayId: true } }),
                prisma.room.findFirst({ where: { displayId: { startsWith: 'REN-ROOM-' } }, orderBy: { displayId: 'desc' }, select: { displayId: true } }),
                prisma.bed.findFirst({ where: { displayId: { startsWith: 'REN-BED-' } }, orderBy: { displayId: 'desc' }, select: { displayId: true } })
            ]);

            const getNextId = (lastId: string | null | undefined, prefix: string) => {
                if (!lastId) return `${prefix}-0001`;
                const parts = lastId.split('-');
                const numStr = parts[parts.length - 1];
                const num = parseInt(numStr);
                return `${prefix}-${(num + 1).toString().padStart(4, '0')}`;
            };

            const displayId = getNextId(lastProp?.displayId, 'REN-PROP');
            let nextRoomNum = lastRoom?.displayId ? parseInt(lastRoom.displayId.split('-').pop()!) : 0;
            let nextBedNum = lastBed?.displayId ? parseInt(lastBed.displayId.split('-').pop()!) : 0;

            const parsedRooms = typeof roomsSource === 'string' ? JSON.parse(roomsSource) : (roomsSource || []);

            // 3. Create property and all related rooms/beds in a single high-speed transaction
            const property = await prisma.$transaction(async (tx) => {
                const newProperty = await tx.property.create({
                    data: {
                        displayId,
                        name,
                        address,
                        city,
                        description,
                        amenities: typeof amenities === 'string' ? amenities : JSON.stringify(amenities || []),
                        images: JSON.stringify([
                            ...(buildingPhotos || []),
                            ...(roomsAndBathroomPhotos || [])
                        ]),
                        ownerName: finalOwnerName,
                        ownerId: user?.parentOwnerId || session.userId,
                        status: "SUBMITTED",
                        propertyType: propertyType || "PG",
                        licenseNumber: licenseNumber || null,
                        reraId: reraId || null,
                        businessName: businessName || null,
                        buildingPhotos: buildingPhotos ? JSON.stringify(buildingPhotos) : null,
                        commonAreaPhotos: commonAreaPhotos ? JSON.stringify(commonAreaPhotos) : null,
                        roomsAndBathroomPhotos: roomsAndBathroomPhotos ? JSON.stringify(roomsAndBathroomPhotos) : null,
                        parkingPhotos: parkingPhotos ? JSON.stringify(parkingPhotos) : null,
                        amenitiesPhotos: amenitiesPhotos ? JSON.stringify(amenitiesPhotos) : null,
                        aadhaarProof: aadhaarProof ? JSON.stringify(aadhaarProof) : null,
                        panProof: panProof ? JSON.stringify(panProof) : null,
                        pgLicenceUrl: pgLicenceUrl ? JSON.stringify(pgLicenceUrl) : null,
                        livePhotoUrl: livePhotoUrl || null,
                    }
                });

                if (parsedRooms.length > 0) {
                    const roomsData: any[] = [];
                    const bedsData: any[] = [];

                    for (const r of parsedRooms) {
                        nextRoomNum++;
                        const roomId = randomUUID();
                        const roomDisplayId = `REN-ROOM-${nextRoomNum.toString().padStart(4, '0')}`;
                        
                        roomsData.push({
                            id: roomId,
                            displayId: roomDisplayId,
                            propertyId: newProperty.id,
                            roomNumber: r.roomNumber.toString(),
                            type: r.type,
                            price: parseFloat(r.price),
                            availability: parseInt(r.availability),
                            totalBeds: parseInt(r.availability),
                            status: 'AVAILABLE'
                        });

                        for (let i = 0; i < parseInt(r.availability); i++) {
                            nextBedNum++;
                            bedsData.push({
                                id: randomUUID(),
                                displayId: `REN-BED-${nextBedNum.toString().padStart(4, '0')}`,
                                roomId: roomId,
                                bedNumber: `${r.roomNumber}-${String.fromCharCode(64 + i + 1)}`,
                                status: 'AVAILABLE'
                            });
                        }
                    }

                    if (roomsData.length > 0) {
                        await tx.room.createMany({ data: roomsData });
                    }
                    if (bedsData.length > 0) {
                        await tx.bed.createMany({ data: bedsData });
                    }
                }

                return newProperty;
            }, { timeout: 30000 });

            // 4. Log Audit Event
            logAuditEvent({
                actorId: user?.id || session.userId,
                actorRole: session.role as string,
                actorName: user?.name || session.name || 'Owner',
                actionType: 'CREATE',
                entityType: 'PROPERTY',
                entityId: property.id,
                entityName: property.name,
                description: `Owner created a new property listing with ${parsedRooms.length} rooms: ${property.name}`,
                newValue: property
            });

            return property;
        } catch (error: any) {
            // Handle unique constraint conflict by retrying with fresh IDs
            if (error.code === 'P2002' && retryCount < maxRetries - 1) {
                console.warn(`[createProperty] Unique constraint conflict detected. Retrying ${retryCount + 1}/${maxRetries}...`);
                retryCount++;
                // Add a small jittered delay to prevent stampede
                await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));
                continue;
            }
            console.error("🔴 createProperty FAILED:", error);
            throw error;
        }
    }
    throw new Error("System is busy. Please try again in a few moments.");
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

    const userId = session.userId;
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

    logAuditEvent({
        actorId: userId,
        actorRole: 'OWNER',
        actorName: 'Owner',
        actionType: 'UPDATE',
        entityType: 'PROPERTY',
        entityId: propertyId,
        description: `Fields updated: ${Object.keys(data).join(', ')}. Status: ${newStatus}`,
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

    // Handle JSON array fields (robustly handle both strings and objects)
    const processPhotos = async (jsonStr: string | undefined) => {
        if (!jsonStr) return undefined;
        try {
            const photos = JSON.parse(jsonStr);
            if (!Array.isArray(photos)) return jsonStr;

            const toUpload: (string | File)[] = [];
            const resultPhotos = [...photos];

            for (let i = 0; i < photos.length; i++) {
                const p = photos[i];
                const url = typeof p === 'object' ? p.url : p;
                if (url && typeof url === 'string' && url.startsWith('data:')) {
                    toUpload.push(url);
                }
            }

            if (toUpload.length > 0) {
                const uploadedUrls = await batchUploadToCloudinary(toUpload, folder);
                let uploadIdx = 0;
                for (let i = 0; i < resultPhotos.length; i++) {
                    const p = resultPhotos[i];
                    const url = typeof p === 'object' ? p.url : p;
                    if (url && typeof url === 'string' && url.startsWith('data:')) {
                        if (typeof p === 'object') {
                            resultPhotos[i] = { ...p, url: uploadedUrls[uploadIdx++] };
                        } else {
                            resultPhotos[i] = uploadedUrls[uploadIdx++];
                        }
                    }
                }
            }
            return JSON.stringify(resultPhotos);
        } catch (e) {
            console.error(`[savePropertyDocuments] Error processing photos:`, e);
            return jsonStr; // Return original on partial failure
        }
    };

    if (docs.buildingPhotos) uploadData.buildingPhotos = await processPhotos(docs.buildingPhotos);
    if (docs.commonAreaPhotos) uploadData.commonAreaPhotos = await processPhotos(docs.commonAreaPhotos);

    await prisma.property.update({
        where: { id: propertyId, ownerId: session.userId },
        data: uploadData
    });

    return { success: true };
}

export async function addRoomToProperty(propertyId: string, roomData: { roomNumber: string, type: string, price: number, availability: number, photoUrl?: string }) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    // Verify ownership
    const property = await prisma.property.findUnique({ where: { id: propertyId, ownerId: session.userId } });
    if (!property) throw new Error("Property not found or unauthorized");

    const roomDisplayId = await generateSequentialId('ROOM');
    const room = await prisma.room.create({
        data: {
            ...roomData,
            displayId: roomDisplayId,
            propertyId,
            totalBeds: roomData.availability,
            status: 'AVAILABLE'
        }
    });

    // Auto-generate beds
    for (let i = 1; i <= room.availability; i++) {
        const bedDisplayId = await generateSequentialId('BED');
        await prisma.bed.create({
            data: {
                displayId: bedDisplayId,
                roomId: room.id,
                bedNumber: `${room.roomNumber}-${String.fromCharCode(64 + i)}`,
                status: 'AVAILABLE'
            }
        });
    }

    revalidatePath(`/dashboard/owner/properties/${propertyId}`);
    return room;
}

export async function editRoom(roomId: string, roomData: { roomNumber: string, type: string, price: number, availability: number, photoUrl?: string }) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { property: true }
    });

    if (!room || room.property.ownerId !== session.userId) {
        throw new Error("Room not found or unauthorized");
    }

    const oldAvailability = room.availability;
    const newAvailability = roomData.availability;

    const updated = await prisma.room.update({
        where: { id: roomId },
        data: roomData
    });

    // If availability increased, add more beds
    if (newAvailability > oldAvailability) {
        for (let i = oldAvailability + 1; i <= newAvailability; i++) {
            const bedDisplayId = await generateSequentialId('BED');
            await prisma.bed.create({
                data: {
                    displayId: bedDisplayId,
                    roomId: roomId,
                    bedNumber: `${updated.roomNumber}-${String.fromCharCode(64 + i)}`,
                    status: 'AVAILABLE'
                }
            });
        }
    }

    revalidatePath(`/dashboard/owner/properties/${room.propertyId}`);
    return updated;
}

export async function deletePropertyDocument(propertyId: string, docType: string, index?: number) {
    try {
        const property = await prisma.property.findUnique({
            where: { id: propertyId },
            select: { [docType]: true, verifiedDocs: true } as Record<string, any>
        });

        if (!property) return { success: false, error: "Property not found" };

        const updateData: any = {};
        const currentValue = (property as Record<string, any>)[docType];
        let verifiedDocs = JSON.parse((property as Record<string, any>).verifiedDocs || "[]");

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
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

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

        // Audit Logging
        logAuditEvent({
            actorId: session.userId,
            actorRole: session.role as string,
            actorName: session.name || 'Admin',
            actionType: verified ? 'APPROVE' : 'REJECT',
            entityType: 'PROPERTY',
            entityId: propertyId,
            description: `${verified ? 'Verified' : 'Unverified'} document: ${docKey}`,
        });

        return { success: true };
    } catch (e: any) {
        const error = e as Error;
        return { success: false, error: error.message };
    }
}

export async function requestDocumentReupload(propertyId: string, docType: string, note: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    try {
        const property = await prisma.property.findUnique({
            where: { id: propertyId },
            select: { adminNotes: true }
        });

        if (!property) return { success: false, error: "Property not found" };

        // Append reupload request to admin notes using a structured tag
        // If docType already includes an index (e.g. "buildingPhotos-0"), it works directly
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

        // Log Audit Event
        logAuditEvent({
            actorId: session.userId, // Admin ID from session
            actorRole: session.role as string,
            actorName: session.name || 'Admin',
            actionType: 'UPDATE',
            entityType: 'PROPERTY',
            entityId: propertyId,
            description: `Admin requested a reupload for ${docType}. Reason: ${note}`,
            newValue: { docType, note }
        });

        return { success: true };
    } catch (error) {
        console.error("Request Reupload Error:", error);
        return { success: false, error: "Failed to request reupload" };
    }
}

// ── P8: Owner Onboarding Fee Payment Simulation ──

export async function payOnboardingFee(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const property = await prisma.property.findUnique({
        where: { id: propertyId, ownerId: session.userId },
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
    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role as string,
        actorName: session.name || 'Owner',
        actionType: 'UPDATE',
        entityType: 'PROPERTY',
        entityId: propertyId,
        description: `Owner paid onboarding fee for property ${property.name}. Status is now LIVE.`,
    });

    revalidatePath('/dashboard/owner/properties');
    revalidatePath('/search');

    return { success: true };
}

export async function deleteProperty(propertyId: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error("Property not found");

    if (session.role === 'OWNER' && property.ownerId !== session.userId) throw new Error("Unauthorized");

    // Soft delete: Change status to INACTIVE
    await prisma.property.update({
        where: { id: propertyId },
        data: { status: 'INACTIVE' }
    });

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role as string,
        actorName: session.name || 'User',
        actionType: 'DELETE',
        entityType: 'PROPERTY',
        entityId: propertyId,
        entityName: property.name,
        description: `Property status set to INACTIVE (Soft Delete): ${property.name}`,
    });

    revalidatePath('/dashboard/owner/properties');
    revalidatePath('/dashboard/admin/properties');
    return { success: true };
}
