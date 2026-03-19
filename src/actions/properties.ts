'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { uploadToCloudinary, batchUploadToCloudinary } from "@/lib/upload";
import { logAuditEvent } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { generateSequentialId } from "@/lib/ids";

async function getEffectiveOwnerId(session: any) {
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF')) throw new Error("Unauthorized");
    const user = await prisma.user.findUnique({ 
        where: { id: session.userId },
        select: { parentOwnerId: true }
    });
    return user?.parentOwnerId || session.userId;
}

export async function getProperties(ownerId?: string) {
    const session = await getSession();
    const where: any = {};

    if (ownerId) {
        where.ownerId = ownerId;
    } else if (session?.role === 'OWNER' || session?.role === 'STAFF') {
        const user = await prisma.user.findUnique({ 
            where: { id: session.userId },
            include: { employeeProfile: true }
        });
        
        if (user?.employeeProfile) {
            const assignedIds = await prisma.employeePropertyAssignment.findMany({
                where: { employeeId: user.employeeProfile.id },
                select: { propertyId: true }
            });
            where.id = { in: assignedIds.map((a: any) => a.propertyId) };
        } else {
            where.ownerId = user?.parentOwnerId || session.userId;
        }
    }

    return prisma.property.findMany({
        where,
        include: {
            rooms: {
                select: { id: true, roomNumber: true, status: true }
            },
            owner: {
                select: { name: true, email: true }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });
}

export async function getPendingOwnerActionCount() {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF')) return 0;

    const effectiveOwnerId = await getEffectiveOwnerId(session);
    const properties = await prisma.property.findMany({
        where: { ownerId: effectiveOwnerId },
        select: { status: true, adminNotes: true }
    });

    return properties.filter(p => p.status === 'REJECTED' || (p.status === 'PENDING_VERIFICATION' && p.adminNotes?.includes('[REUPLOAD'))).length;
}

export async function getPropertyById(id: string) {
    const session = await getSession();
    const property = await prisma.property.findUnique({
        where: { id },
        include: {
            rooms: true,
            foodMenu: true,
            owner: { select: { name: true, email: true } }
        }
    });

    if (!property) return null;

    if (session?.role === 'ADMIN') return property;

    if (session?.role === 'OWNER' || session?.role === 'STAFF') {
        const user = await prisma.user.findUnique({ 
            where: { id: session.userId },
            include: { employeeProfile: true }
        });
        
        if (user?.employeeProfile) {
            const isAssigned = await prisma.employeePropertyAssignment.findUnique({
                where: { employeeId_propertyId: { employeeId: user.employeeProfile.id, propertyId: id } }
            });
            if (!isAssigned) throw new Error("Access denied");
        } else if (property.ownerId !== (user?.parentOwnerId || session.userId)) {
             throw new Error("Access denied");
        }
        return property;
    }

    if (property.status !== 'APPROVED') return null;

    // For public view, filter only verified photos
    const verifiedDocs = JSON.parse(property.verifiedDocs || '[]');
    const filterPhotos = (dataString: string | null, keyPrefix: string) => {
        if (!dataString) return null;
        try {
            const photos = JSON.parse(dataString);
            if (!Array.isArray(photos)) return dataString; // Handle single values if any
            const filtered = photos.map((url: string, i: number) => {
                return verifiedDocs.includes(`${keyPrefix}-${i}`) ? url : null;
            }).filter(Boolean);
            return filtered.length > 0 ? JSON.stringify(filtered) : null;
        } catch (e) { return null; }
    };

    const isVerified = (key: string) => verifiedDocs.includes(key);

    return {
        ...property,
        buildingPhotos: filterPhotos(property.buildingPhotos, 'buildingPhotos'),
        commonAreaPhotos: filterPhotos(property.commonAreaPhotos, 'commonAreaPhotos'),
        roomsAndBathroomPhotos: filterPhotos(property.roomsAndBathroomPhotos, 'roomsAndBathroomPhotos'),
        parkingPhotos: filterPhotos(property.parkingPhotos, 'parkingPhotos'),
        amenitiesPhotos: filterPhotos(property.amenitiesPhotos, 'amenitiesPhotos'),
        aadhaarProof: null, // Security: Never leakage in public view
        panProof: null,
        pgLicenceUrl: null,
    };
}

export async function createProperty(data: FormData | any) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const isFormData = data instanceof FormData;
    const getVal = (key: string) => isFormData ? (data.get(key) as string) : (data[key] as string);
    const getAllVal = (key: string) => isFormData ? data.getAll(key) : (data[key] || []);

    const userId = session.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
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
    const termsAcceptedRaw = getVal("termsAccepted");
    const termsAccepted = termsAcceptedRaw === "true" || termsAcceptedRaw === "on" || (termsAcceptedRaw as any) === true;
    const feeTermsAcceptedRaw = getVal("feeTermsAccepted");
    const feeTermsAccepted = feeTermsAcceptedRaw === "true" || feeTermsAcceptedRaw === "on" || (feeTermsAcceptedRaw as any) === true;

    if (!name?.trim()) throw new Error("Property name is required");
    if (!termsAccepted) throw new Error("You must accept general terms to list your property.");

    // Industry Standard: Fetch platform settings server-side at the moment of creation to lock the fee
    const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    const onboardingFee = settings?.feesEnabled ? settings.ownerOnboardingFeeFlat : 0;

    if (onboardingFee > 0 && !feeTermsAccepted) {
        throw new Error(`Acknowledgment of the ₹${onboardingFee} platform onboarding fee is mandatory.`);
    }

    const buildingPhotos = getAllVal("buildingPhotos");
    const roomsAndBathroomPhotos = getAllVal("roomsAndBathroomPhotos");
    const commonAreaPhotos = getAllVal("commonAreaPhotos");
    const parkingPhotos = getAllVal("parkingPhotos");
    const amenitiesPhotos = getAllVal("amenitiesPhotos");
    const aadhaarProof = getAllVal("aadhaarProof");
    const panProof = getAllVal("panProof");
    const pgLicenceUrl = getAllVal("pgLicenceUrl");
    const livePhotoUrl = getVal("livePhotoUrl");

    const parsedRooms = typeof roomsSource === 'string' ? JSON.parse(roomsSource) : (roomsSource || []);
    const displayId = await generateSequentialId('PROPERTY');

    const result = await prisma.$transaction(async (tx) => {
        const property = await tx.property.create({
            data: {
                displayId,
                applicationId: displayId,
                name,
                address,
                city,
                description,
                propertyType: (propertyType as any) || "PG",
                licenseNumber,
                reraId,
                businessName,
                adminNotes: onboardingFee > 0 ? `[SYSTEM: Fee Acknowledged - ₹${onboardingFee}]` : null,
                ownerName: ownerName || user?.name || "Owner",
                ownerId: user?.parentOwnerId || userId,
                amenities: typeof amenities === 'string' ? amenities : JSON.stringify(amenities || []),
                images: JSON.stringify([...buildingPhotos, ...roomsAndBathroomPhotos]),
                status: 'PENDING_VERIFICATION',
                buildingPhotos: JSON.stringify(buildingPhotos),
                commonAreaPhotos: JSON.stringify(commonAreaPhotos),
                roomsAndBathroomPhotos: JSON.stringify(roomsAndBathroomPhotos),
                parkingPhotos: JSON.stringify(parkingPhotos),
                amenitiesPhotos: JSON.stringify(amenitiesPhotos),
                aadhaarProof: JSON.stringify(aadhaarProof),
                panProof: JSON.stringify(panProof),
                pgLicenceUrl: JSON.stringify(pgLicenceUrl),
                livePhotoUrl: livePhotoUrl || null,
                termsAccepted: true,
                termsAcceptedAt: new Date(),
                feeTermsAccepted: true,
                feeTermsAcceptedAt: new Date(),
            } as any
        });

        const roomIdsList = parsedRooms.length > 0 
            ? await generateSequentialId('ROOM', parsedRooms.length)
            : [];
            
        // Pre-calculate total beds to fetch Bed IDs in one batch
        const totalBedsNeeded = parsedRooms.reduce((sum: number, r: any) => sum + (parseInt(r.availability) || 0), 0);
        const bedIdsList = totalBedsNeeded > 0
            ? await generateSequentialId('BED', totalBedsNeeded)
            : [];

        let currentRoomIdx = 0;
        let currentBedIdx = 0;

        // Atomic Rooms & Beds
        if (parsedRooms.length > 0) {
            for (const r of parsedRooms) {
                const roomDisplayId = roomIdsList[currentRoomIdx++];
                const room = await tx.room.create({
                    data: {
                        displayId: roomDisplayId,
                        propertyId: property.id,
                        roomNumber: r.roomNumber.toString(),
                        type: r.type,
                        price: parseFloat(r.price),
                        availability: parseInt(r.availability),
                        totalBeds: parseInt(r.availability),
                        status: 'AVAILABLE'
                    }
                });

                for (let i = 0; i < room.availability; i++) {
                    const bedDisplayId = bedIdsList[currentBedIdx++];
                    await tx.bed.create({
                        data: {
                            displayId: bedDisplayId,
                            roomId: room.id,
                            bedNumber: `${r.roomNumber}-${String.fromCharCode(64 + i + 1)}`,
                            status: 'AVAILABLE'
                        }
                    });
                }
            }
        }

        await tx.auditLog.create({
            data: {
                actorId: userId,
                actorRole: 'OWNER',
                actorName: user?.name || 'Owner',
                actionType: 'CREATE',
                entityType: 'PROPERTY',
                entityId: property.id,
                description: `Owner created property ${property.name}. Status: PENDING_VERIFICATION.`,
                newValue: { status: 'PENDING_VERIFICATION', termsAccepted: true },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        return property;
    });

    revalidatePath('/dashboard/owner/properties');
    return result;
}

export async function updateProperty(propertyId: string, data: any) {
    const session = await getSession();
    const effectiveOwnerId = await getEffectiveOwnerId(session);

    const existing = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!existing || existing.ownerId !== effectiveOwnerId) throw new Error("Unauthorized");

    const needsReapproval = data.images || data.amenities || data.name;
    const newStatus = (existing.status === 'APPROVED' && needsReapproval) ? 'PENDING_VERIFICATION' : existing.status;

    return prisma.$transaction(async (tx) => {
        const updated = await tx.property.update({
            where: { id: propertyId },
            data: { ...data, status: newStatus }
        });

        await tx.auditLog.create({
            data: {
                actorId: session!.userId,
                actorRole: 'OWNER',
                actorName: session!.name || 'Owner',
                actionType: 'UPDATE',
                entityType: 'PROPERTY',
                entityId: propertyId,
                description: `Owner updated property. Status: ${newStatus}`,
                newValue: { status: newStatus },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        return updated;
    });
}

export async function savePropertyDocuments(propertyId: string, docs: any) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const effectiveOwnerId = await getEffectiveOwnerId(session);

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error("Property not found");
    
    if (session.role === 'OWNER' && property.ownerId !== effectiveOwnerId) {
        throw new Error("Unauthorized");
    }

    const folder = `properties/docs/${propertyId}`;
    const uploadData: any = { ...docs };

    if (docs.aadhaarProof?.startsWith('data:')) uploadData.aadhaarProof = await uploadToCloudinary(docs.aadhaarProof, folder, true);
    if (docs.panProof?.startsWith('data:')) uploadData.panProof = await uploadToCloudinary(docs.panProof, folder, true);
    if (docs.pgLicenceUrl?.startsWith('data:')) uploadData.pgLicenceUrl = await uploadToCloudinary(docs.pgLicenceUrl, folder, true);
    if (docs.pgPhotoUrl?.startsWith('data:')) uploadData.pgPhotoUrl = await uploadToCloudinary(docs.pgPhotoUrl, folder);
    if (docs.livePhotoUrl?.startsWith('data:')) uploadData.livePhotoUrl = await uploadToCloudinary(docs.livePhotoUrl, folder);

    if (property.status === 'NEEDS_CORRECTION') uploadData.status = 'CORRECTED';

    return prisma.$transaction(async (tx) => {
        const updated = await tx.property.update({
            where: { id: propertyId },
            data: uploadData
        });

        if (property.status === 'NEEDS_CORRECTION') {
            await tx.auditLog.create({
                data: {
                    actorId: session!.userId,
                    actorRole: 'OWNER',
                    actorName: session!.name || 'Owner',
                    actionType: 'UPDATE',
                    entityType: 'PROPERTY',
                    entityId: propertyId,
                    description: `Owner submitted corrections. Status marked as CORRECTED for admin review.`,
                    newValue: { status: 'CORRECTED' },
                    ipAddress: 'internal',
                    userAgent: 'server-action'
                }
            });
        }

        return updated;
    });
}

export async function addRoomToProperty(propertyId: string, roomData: any) {
    const session = await getSession();
    const effectiveOwnerId = await getEffectiveOwnerId(session);

    const property = await prisma.property.findUnique({ where: { id: propertyId, ownerId: effectiveOwnerId } });
    if (!property) throw new Error("Unauthorized or Property not found");

    const roomDisplayId = await generateSequentialId('ROOM');
    const bedIdsList = await generateSequentialId('BED', roomData.availability);
    
    return prisma.$transaction(async (tx) => {
        const room = await tx.room.create({
            data: { ...roomData, displayId: roomDisplayId, propertyId, totalBeds: roomData.availability, status: 'AVAILABLE' }
        });

        for (let i = 0; i < room.availability; i++) {
            const bedDisplayId = bedIdsList[i];
            await tx.bed.create({
                data: { displayId: bedDisplayId, roomId: room.id, bedNumber: `${room.roomNumber}-${String.fromCharCode(64 + i + 1)}`, status: 'AVAILABLE' }
            });
        }
        return room;
    });
}

export async function editRoom(roomId: string, roomData: any) {
    const session = await getSession();
    const effectiveOwnerId = await getEffectiveOwnerId(session);

    const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { property: true }
    });

    if (!room || room.property.ownerId !== effectiveOwnerId) {
        throw new Error("Room not found or unauthorized");
    }

    const oldAvailability = room.availability;
    const newAvailability = parseInt(roomData.availability);

    return prisma.$transaction(async (tx) => {
        const updated = await tx.room.update({
            where: { id: roomId },
            data: {
                ...roomData,
                price: parseFloat(roomData.price),
                availability: newAvailability,
                totalBeds: newAvailability
            }
        });

        // If availability increased, add more beds
        if (newAvailability > oldAvailability) {
            const bedsToAdd = newAvailability - oldAvailability;
            const bedIdsList = await generateSequentialId('BED', bedsToAdd);
            
            for (let i = 0; i < bedsToAdd; i++) {
                const bedDisplayId = bedIdsList[i];
                await tx.bed.create({
                    data: {
                        displayId: bedDisplayId,
                        roomId: roomId,
                        bedNumber: `${updated.roomNumber}-${String.fromCharCode(64 + oldAvailability + i + 1)}`,
                        status: 'AVAILABLE'
                    }
                });
            }
        }

        await tx.auditLog.create({
            data: {
                actorId: session!.userId,
                actorRole: 'OWNER',
                actorName: session!.name || 'Owner',
                actionType: 'UPDATE',
                entityType: 'ROOM',
                entityId: roomId,
                description: `Owner updated room ${updated.roomNumber}. New Price: ${updated.price}, New Availability: ${updated.availability}`,
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        return updated;
    });
}


export async function deletePropertyDocument(propertyId: string, docType: string, index?: number) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    let effectiveOwnerId = session.userId;
    if (session.role === 'OWNER') {
        effectiveOwnerId = await getEffectiveOwnerId(session);
    }

    const property = await prisma.property.findUnique({ 
        where: { id: propertyId }, 
        select: { [docType]: true, verifiedDocs: true, ownerId: true } as any 
    });

    if (!property || (session.role === 'OWNER' && (property as any).ownerId !== effectiveOwnerId)) throw new Error("Unauthorized");

    const updateData: any = {};
    const currentValue = (property as any)[docType] as string | null;
    let verifiedDocs = JSON.parse((property as any).verifiedDocs || "[]");

    if (index !== undefined && currentValue) {
        try {
            const photos = JSON.parse(currentValue);
            if (Array.isArray(photos)) {
                photos.splice(index, 1);
                updateData[docType] = photos.length > 0 ? JSON.stringify(photos) : null;
                const docKey = `${docType}-${index}`;
                verifiedDocs = verifiedDocs.filter((key: string) => key !== docKey);
            }
        } catch (e) { updateData[docType] = null; }
    } else {
        updateData[docType] = null;
        verifiedDocs = verifiedDocs.filter((key: string) => key !== docType);
    }

    updateData.verifiedDocs = JSON.stringify(verifiedDocs);
    try {
        await prisma.property.update({ where: { id: propertyId }, data: updateData });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}



export async function togglePropertyDocumentVerification(propertyId: string, docKey: string, verified: boolean) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { verifiedDocs: true } });
    if (!property) throw new Error("Not found");

    let verifiedDocs = JSON.parse(property.verifiedDocs || "[]");
    if (verified) { if (!verifiedDocs.includes(docKey)) verifiedDocs.push(docKey); }
    else { verifiedDocs = verifiedDocs.filter((key: string) => key !== docKey); }

    try {
        await prisma.property.update({ where: { id: propertyId }, data: { verifiedDocs: JSON.stringify(verifiedDocs) } });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}



export async function requestDocumentReupload(propertyId: string, docType: string, note: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { adminNotes: true, name: true, ownerId: true }
    });

    if (!property) throw new Error("Property not found");

    const reuploadTag = `[REUPLOAD:${docType}] ${note}`;
    const newNotes = property.adminNotes
        ? `${property.adminNotes}\n${reuploadTag}`
        : reuploadTag;

    return prisma.$transaction(async (tx) => {
        const result = await tx.property.update({
            where: { id: propertyId },
            data: {
                adminNotes: newNotes,
                status: 'NEEDS_CORRECTION'
            }
        });

        await tx.notification.create({
            data: {
                userId: property.ownerId,
                type: "PROPERTY_PENDING",
                message: `Action Required: Re-upload requested for ${docType} on property ${property.name}. Reason: ${note}`
            }
        });

        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: 'ADMIN',
                actorName: session.name || 'Admin',
                actionType: 'UPDATE',
                entityType: 'PROPERTY',
                entityId: propertyId,
                description: `Admin requested a document re-upload for ${docType}. Reason: ${note}`,
                newValue: { status: 'NEEDS_CORRECTION', docType, note },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        return result;
    });
    return { success: true };
}



export async function payOnboardingFee(propertyId: string, method: string) {
    const session = await getSession();
    const effectiveOwnerId = await getEffectiveOwnerId(session);

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error("Property not found");
    
    if (property.ownerId !== effectiveOwnerId) throw new Error("Unauthorized");

    if (property.status !== 'APPROVED_PENDING_PAYMENT' && property.status !== 'VERIFIED_SUCCESSFULLY') {
        throw new Error("Invalid state for payment");
    }

    return prisma.$transaction(async (tx) => {
        const updated = await (tx.property as any).update({ 
            where: { id: propertyId }, 
            data: { 
                status: 'APPROVED_PAYMENT_VERIFIED',
                onboardingPaymentMethod: method,
                onboardingPaidAt: new Date()
            } 
        });

        await tx.auditLog.create({
            data: {
                actorId: session!.userId,
                actorRole: 'OWNER',
                actorName: session!.name || 'Owner',
                actionType: 'UPDATE',
                entityType: 'PROPERTY',
                entityId: propertyId,
                description: `Owner paid onboarding fee via ${method}. Status: APPROVED_PAYMENT_VERIFIED.`,
                newValue: { status: 'APPROVED_PAYMENT_VERIFIED', method },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        // Notify Admin
        const admin = await tx.user.findFirst({ where: { role: 'ADMIN' } });
        if (admin) {
            await tx.notification.create({
                data: {
                    userId: admin.id,
                    type: "PROPERTY_PENDING",
                    message: `Payment Verified: Property "${property.name}" has paid via ${method}. Awaiting final activation.`,
                    targetRole: "ADMIN"
                }
            });
        }

        return { success: true, updated };
    });
}

export async function activateProperty(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error("Property not found");
    
    if (property.status !== 'APPROVED_PAYMENT_VERIFIED') throw new Error("Invalid state: Payment not verified yet");

    return prisma.$transaction(async (tx) => {
        await tx.property.update({ 
            where: { id: propertyId }, 
            data: { status: 'APPROVED', isVerified: true } 
        });

        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: 'ADMIN',
                actorName: session.name || 'Admin',
                actionType: 'APPROVE',
                entityType: 'PROPERTY',
                entityId: propertyId,
                description: `Admin activated property "${property.name}". Status: APPROVED (Live).`,
                newValue: { status: 'APPROVED' },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        // Notify Owner
        await tx.notification.create({
            data: {
                userId: property.ownerId,
                type: "PROPERTY_LIVE",
                message: `Congratulations! Your property "${property.name}" is now LIVE on RentPe.`,
                targetRole: "OWNER"
            }
        });

        return { success: true };
    });
}

export async function deleteProperty(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");
    const effectiveOwnerId = await getEffectiveOwnerId(session);

    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        include: { rooms: true }
    });

    if (!property) throw new Error("Property not found");
    if (property.ownerId !== effectiveOwnerId) throw new Error("Unauthorized");

    // Safety: Only allow deletion if property is NOT active/approved
    const deletableStatuses = ['PENDING_VERIFICATION', 'NEEDS_CORRECTION', 'REJECTED', 'APPROVED_PENDING_PAYMENT', 'VERIFIED_SUCCESSFULLY', 'CORRECTED', 'UNDER_REVIEW', 'VERIFYING', 'VERIFYING_DOCUMENTS'];
    if (!deletableStatuses.includes(property.status)) {
        throw new Error("This property application cannot be cancelled at this stage. Please contact support.");
    }

    return prisma.$transaction(async (tx) => {
        const roomIds = property.rooms.map(r => r.id);
        
        // 1. Delete related records
        if (roomIds.length > 0) {
            await tx.bed.deleteMany({ where: { roomId: { in: roomIds } } });
            await tx.room.deleteMany({ where: { propertyId } });
        }
        await tx.foodMenu.deleteMany({ where: { propertyId } });
        await tx.employeePropertyAssignment.deleteMany({ where: { propertyId } });
        await tx.savedProperty.deleteMany({ where: { propertyId } });
        await tx.review.deleteMany({ where: { propertyId } });

        // 2. Finally delete the property
        await tx.property.delete({ where: { id: propertyId } });

        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: 'OWNER',
                actorName: session.name || 'Owner',
                actionType: 'DELETE',
                entityType: 'PROPERTY',
                entityId: propertyId,
                description: `Owner cancelled property application for "${property.name}". Status was ${property.status}.`,
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        return { success: true };
    });
}
