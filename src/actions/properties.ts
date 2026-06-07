'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { uploadToCloudinary, batchUploadToCloudinary } from "@/lib/upload";
import { logAuditEvent } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { generateSequentialId } from "@/lib/ids";
import { stripImmutableFields } from "@/lib/sanitize";

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

    return properties.filter(p => 
        p.status === 'REJECTED' || 
        p.status === 'NEEDS_CORRECTION' || 
        (p.status === 'PENDING_VERIFICATION' && p.adminNotes?.includes('[REUPLOAD'))
    ).length;
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

    if (!['LIVE', 'APPROVED'].includes(property.status)) return null;

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
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF')) throw new Error("Unauthorized");

    const isFormData = data instanceof FormData;
    const getVal = (key: string) => isFormData ? (data.get(key) as string) : (data[key] as string);
    const getAllVal = (key: string) => isFormData ? data.getAll(key) : (data[key] || []);
    const userId = session.userId;

    // ── PHASE 1: PARALLEL PRE-FLIGHT ─────────────────────────────
    // Fire all independent DB reads CONCURRENTLY. Eliminates one full
    // round-trip from the cold path (~200-400ms on remote DBs).
    const [user, settings] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, role: true, parentOwnerId: true, staffPermissions: true }
        }),
        prisma.platformSettings.findUnique({ where: { id: "singleton" } })
    ]) as any[];

    if (user?.role === 'STAFF') {
        const perms = JSON.parse(user.staffPermissions || "[]");
        if (!perms.includes('register_property')) throw new Error("You do not have permission to register properties");
    }

    // ── PHASE 2: DATA EXTRACTION ────────────────────────────────────
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
    const foodType = getVal("foodType");
    const foodPricePerMonthRaw = getVal("foodPricePerMonth");
    const foodPricePerMonth = foodPricePerMonthRaw ? parseFloat(foodPricePerMonthRaw) : null;

    if (!name?.trim()) throw new Error("Property name is required");
    if (!termsAccepted) throw new Error("You must accept general terms to list your property.");
    if (!foodType) throw new Error("Food service selection is mandatory.");
    if (foodType === 'OPTIONAL' && (!foodPricePerMonth || foodPricePerMonth <= 0)) {
        throw new Error("Food price per month is required when food service is Optional.");
    }

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

    const parsedRooms: any[] = typeof roomsSource === 'string' ? JSON.parse(roomsSource) : (roomsSource || []);

    // ── SECURITY: Hard-caps to prevent abuse & DB overload ───────────────
    const MAX_ROOMS = 50;
    const MAX_BEDS = 500;
    if (parsedRooms.length > MAX_ROOMS) throw new Error(`Maximum ${MAX_ROOMS} rooms allowed per registration.`);
    const totalBedsNeeded = parsedRooms.reduce((sum: number, r: any) => sum + (parseInt(r.availability) || 0), 0);
    if (totalBedsNeeded > MAX_BEDS) throw new Error(`Maximum ${MAX_BEDS} total beds allowed per registration.`);

    // ── PHASE 3: PARALLEL ID GENERATION ────────────────────────────
    // All 3 ID-sequence DB reads now run simultaneously and atomically.
    const [displayId, roomIdsList, bedIdsList] = await Promise.all([
        generateSequentialId('PROPERTY'),
        parsedRooms.length > 0 ? Promise.all(parsedRooms.map(() => generateSequentialId('ROOM'))) : Promise.resolve([] as string[]),
        totalBedsNeeded > 0 ? Promise.all(Array(totalBedsNeeded).fill(0).map(() => generateSequentialId('BED'))) : Promise.resolve([] as string[]),
    ]);

    // ── PHASE 4: BUILD ALL ROWS IN MEMORY (zero DB round-trips) ───────────
    // randomUUID() pre-links rooms→beds without sequential DB reads.
    const roomsToCreate: any[] = [];
    const bedsToCreate: any[] = [];
    let bedIdx = 0;

    for (let i = 0; i < parsedRooms.length; i++) {
        const r = parsedRooms[i];
        const roomId = randomUUID();
        const availability = parseInt(r.availability) || 0;
        // securityDeposit from UI is '1' or '2' (months). Clamp to max 2 as per platform rule.
        const depositMonths = Math.min(parseInt(r.securityDeposit) || 1, 2);
        roomsToCreate.push({
            id: roomId,
            displayId: (roomIdsList as string[])[i],
            propertyId: '',
            roomNumber: r.roomNumber.toString(),
            type: r.type,
            price: parseFloat(r.price),
            availability,
            totalBeds: availability,
            depositMonths,
            status: 'AVAILABLE',
        });
        for (let j = 0; j < availability; j++) {
            bedsToCreate.push({
                id: randomUUID(),
                displayId: (bedIdsList as string[])[bedIdx++],
                roomId,
                bedNumber: `${r.roomNumber}-${String.fromCharCode(64 + j + 1)}`,
                status: 'AVAILABLE',
            });
        }
    }

    // ── PHASE 5: ATOMIC TRANSACTION — 4 writes total, regardless of scale ──────
    // Before: O(NÃ—M) sequential writes. After: always exactly 4 bulk writes.
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
                foodType,
                foodPricePerMonth: foodType === 'OPTIONAL' ? foodPricePerMonth : null,
            } as any
        });

        // ONE bulk write for all rooms (inject real propertyId)
        if (roomsToCreate.length > 0) {
            await tx.room.createMany({
                data: roomsToCreate.map(r => ({ ...r, propertyId: property.id }))
            });
        }

        // ONE bulk write for all beds (roomId already pre-linked)
        if (bedsToCreate.length > 0) {
            await tx.bed.createMany({ data: bedsToCreate });
        }

        await tx.auditLog.create({
            data: {
                actorId: userId,
                actorRole: 'OWNER',
                actorName: user?.name || 'Owner',
                actionType: 'CREATE',
                entityType: 'PROPERTY',
                entityId: property.id,
                description: `Owner created property ${property.name} with ${roomsToCreate.length} rooms, ${bedsToCreate.length} beds. Status: PENDING_VERIFICATION.`,
                newValue: { status: 'PENDING_VERIFICATION', termsAccepted: true, rooms: roomsToCreate.length, beds: bedsToCreate.length },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        return property;
    }, { timeout: 15000 });

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

    const safeData = stripImmutableFields(data);

    return prisma.$transaction(async (tx) => {
        const updated = await tx.property.update({
            where: { id: propertyId },
            data: { ...safeData, status: newStatus }
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

    if (property.status === 'NEEDS_CORRECTION') uploadData.status = 'VERIFYING_DOCUMENTS';

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
    const bedIdsList = await Promise.all(Array(roomData.availability).fill(0).map(() => generateSequentialId('BED')));
    
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

    const safeRoomData = stripImmutableFields(roomData);

    return prisma.$transaction(async (tx) => {
        const updated = await tx.room.update({
            where: { id: roomId },
            data: {
                ...safeRoomData,
                price: parseFloat(roomData.price),
                availability: newAvailability,
                totalBeds: newAvailability
            }
        });

        // If availability increased, add more beds
        if (newAvailability > oldAvailability) {
            const bedsToAdd = newAvailability - oldAvailability;
            const bedIdsList = await Promise.all(Array(bedsToAdd).fill(0).map(() => generateSequentialId('BED')));
            
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

    // Auto-wipe reupload notes if they exist for this doc
    const currentNotes = (property as any).adminNotes;
    if (currentNotes) {
        const lines = currentNotes.split('\n');
        const reuploadTag = index !== undefined ? `[REUPLOAD:${docType}-${index}]` : `[REUPLOAD:${docType}]`;
        const filteredLines = lines.filter((l: string) => !l.startsWith(reuploadTag));
        const newAdminNotes = filteredLines.join('\n');
        if (newAdminNotes !== currentNotes) {
            updateData.adminNotes = newAdminNotes || null;
        }
    }

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
        revalidatePath('/dashboard/owner/properties');
        revalidatePath(`/dashboard/owner/properties/${propertyId}`);
        revalidatePath('/dashboard/owner/verifications');
        revalidatePath('/dashboard/admin/properties');
        revalidatePath(`/dashboard/admin/properties/${propertyId}`);
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
        
        // 1. Soft-delete related records
        if (roomIds.length > 0) {
            await tx.bed.updateMany({ 
                where: { roomId: { in: roomIds } },
                data: { status: 'CANCELLED' }
            });
            await tx.room.updateMany({ 
                where: { propertyId },
                data: { status: 'CANCELLED' }
            });
        }
        // For other models, check if they have status; if not, they might need model updates or just stay for now.
        // But the policy says: "Do not delete: invoices, credit notes, food preferences".
        // FeeExemption, FoodMenu, Assignment — we added status to some.
        
        await (tx as any).foodMenu?.updateMany?.({ where: { propertyId }, data: { status: 'CANCELLED' } });
        await (tx as any).employeePropertyAssignment?.updateMany?.({ where: { propertyId }, data: { status: 'CANCELLED' } });

        // 2. Finally soft-delete the property
        await tx.property.update({ 
            where: { id: propertyId },
            data: { status: 'CANCELLED' } 
        });

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

// ── Property Deactivation Flow (OYO / Zolo / Stanza standard) ─────────────────

/**
 * OWNER: Request to deactivate an approved property.
 * Sets status → DEACTIVATION_REQUESTED for admin review.
 */
export async function requestPropertyDeactivation(propertyId: string, reason: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF')) throw new Error("Unauthorized");

    if (session.role === 'STAFF') {
        const perms = session.permissions || [];
        if (!perms.includes('request_deactivation')) {
            throw new Error("Permission Denied: Missing request_deactivation permission.");
        }

        // ✅ Scope check: staff can only request deactivation for properties they're assigned to
        const staffUser = await prisma.user.findUnique({
            where: { id: session.userId },
            include: { employeeProfile: true }
        });
        if (staffUser?.employeeProfile) {
            const assignment = await prisma.employeePropertyAssignment.findFirst({
                where: { employeeId: staffUser.employeeProfile.id, propertyId }
            });
            if (!assignment) {
                throw new Error("Permission Denied: You are not assigned to this property.");
            }
        }
    }

    if (!reason?.trim()) throw new Error("A reason for deactivation is required.");

    const effectiveOwnerId = await getEffectiveOwnerId(session);
    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        include: {
            tenants: { where: { status: { notIn: ['MOVED_OUT'] } } },
            bookings: { where: { status: { notIn: ['CANCELLED', 'REJECTED', 'COMPLETED'] } } },
        }
    });

    if (!property) throw new Error("Property not found.");
    if (property.ownerId !== effectiveOwnerId) throw new Error("You do not own this property.");
    if (property.status !== 'APPROVED') throw new Error("Only approved (live) properties can be deactivated. Current status: " + property.status);

    await prisma.$transaction(async (tx) => {
        await (tx.property as any).update({
            where: { id: propertyId },
            data: {
                status: 'DEACTIVATION_REQUESTED',
                deactivationRequestedAt: new Date(),
                deactivationReason: reason.trim(),
                deactivationRejectedAt: null,
                deactivationRejectedBy: null,
                deactivationRejectedReason: null,
            }
        });

        // Notify Admin
        const admin = await tx.user.findFirst({ where: { role: 'ADMIN' } });
        if (admin) {
            await tx.notification.create({
                data: {
                    userId: admin.id,
                    type: "PROPERTY_PENDING",
                    message: `Deactivation Request: "${property.name}" (${property.displayId}) — Requested by ${session.role === 'STAFF' ? 'Staff (' + session.name + ')' : 'Owner'}. Reason: ${reason}`,
                    targetRole: "ADMIN"
                }
            });
        }

        // Notify Owner if requested by Staff
        if (session.role === 'STAFF') {
            await tx.notification.create({
                data: {
                    userId: effectiveOwnerId,
                    type: "SYSTEM_ALERT",
                    message: `Your staff member ${session.name} has requested deactivation for property "${property.name}".`,
                    targetRole: "OWNER"
                }
            });
        }

        // ✅ Audit Log — correctly captures whether Owner or Staff submitted the request
        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: session.role,  // 'OWNER' or 'STAFF' — accurate
                actorName: session.name || session.role,
                actionType: 'UPDATE',
                entityType: 'PROPERTY',
                entityId: propertyId,
                entityName: property.name,
                description: `${
                    session.role === 'STAFF'
                        ? `Staff member "${session.name}" requested deactivation`
                        : `Owner requested property deactivation`
                } for "${property.name}" (${property.displayId}). Reason: ${reason}. Active tenants: ${property.tenants.length}, Active bookings: ${property.bookings.length}.`,
                previousValue: { status: 'APPROVED' },
                newValue: { status: 'DEACTIVATION_REQUESTED', reason, requestedBy: session.role },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });
    });

    revalidatePath('/dashboard/owner/properties');
    return { success: true };
}

/**
 * ADMIN: Approve a deactivation request.
 * Blocks if active tenants or pending bookings still exist.
 * Sets status → DEACTIVATED.
 */
export async function approvePropertyDeactivation(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        include: {
            tenants: { where: { status: { notIn: ['MOVED_OUT'] } } },
            bookings: { where: { status: { notIn: ['CANCELLED', 'REJECTED', 'COMPLETED'] } } },
        }
    });

    if (!property) throw new Error("Property not found.");
    if (property.status !== 'DEACTIVATION_REQUESTED') {
        throw new Error("No pending deactivation request for this property.");
    }

    // ðŸš« Business Rule: Cannot deactivate if active tenants exist
    if (property.tenants.length > 0) {
        throw new Error(`Cannot deactivate: ${property.tenants.length} active tenant(s) must be moved out first.`);
    }

    // ðŸš« Business Rule: Cannot deactivate if active/pending bookings exist
    if (property.bookings.length > 0) {
        throw new Error(`Cannot deactivate: ${property.bookings.length} active booking(s) must be cancelled or completed first.`);
    }

    await prisma.$transaction(async (tx) => {
        await (tx.property as any).update({
            where: { id: propertyId },
            data: { status: 'DEACTIVATED' }
        });

        // Notify Owner
        await tx.notification.create({
            data: {
                userId: property.ownerId,
                type: "PROPERTY_PENDING",
                message: `Your property "${property.name}" has been deactivated as requested. It is no longer visible to students. Contact us if you wish to re-list.`,
                targetRole: "OWNER"
            }
        });

        // ✅ Audit Log
        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: 'ADMIN',
                actorName: session.name || 'Admin',
                actionType: 'DELETE',
                entityType: 'PROPERTY',
                entityId: propertyId,
                entityName: property.name,
                description: `Admin approved deactivation of property "${property.name}" (${property.displayId}). Owner reason was: ${(property as any).deactivationReason}. Property is now DEACTIVATED and hidden from search.`,
                previousValue: { status: 'DEACTIVATION_REQUESTED' },
                newValue: { status: 'DEACTIVATED' },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });
    });

    revalidatePath('/dashboard/admin/deactivation-requests');
    revalidatePath('/dashboard/admin/property-approval');
    return { success: true };
}

/**
 * ADMIN: Reject a deactivation request.
 * Reverts property to APPROVED and notifies owner with the rejection reason.
 */
export async function rejectPropertyDeactivation(propertyId: string, rejectionReason: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    if (!rejectionReason?.trim()) throw new Error("A rejection reason is required.");

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error("Property not found.");
    if (property.status !== 'DEACTIVATION_REQUESTED') {
        throw new Error("No pending deactivation request for this property.");
    }

    await prisma.$transaction(async (tx) => {
        await (tx.property as any).update({
            where: { id: propertyId },
            data: {
                status: 'APPROVED',
                deactivationRejectedAt: new Date(),
                deactivationRejectedBy: session.userId,
                deactivationRejectedReason: rejectionReason.trim(),
            }
        });

        // Notify Owner
        await tx.notification.create({
            data: {
                userId: property.ownerId,
                type: "PROPERTY_PENDING",
                message: `Deactivation request for "${property.name}" was rejected. Reason: ${rejectionReason}. Your property remains LIVE.`,
                targetRole: "OWNER"
            }
        });

        // ✅ Audit Log
        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: 'ADMIN',
                actorName: session.name || 'Admin',
                actionType: 'UPDATE',
                entityType: 'PROPERTY',
                entityId: propertyId,
                entityName: property.name,
                description: `Admin rejected deactivation request for "${property.name}" (${property.displayId}). Property reverted to APPROVED (LIVE). Rejection reason: ${rejectionReason}.`,
                previousValue: { status: 'DEACTIVATION_REQUESTED' },
                newValue: { status: 'APPROVED', rejectionReason },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });
    });

    revalidatePath('/dashboard/admin/deactivation-requests');
    revalidatePath('/dashboard/admin/property-approval');
    return { success: true };
}
// ── RentPe Property Lifecycle (Deactivation & Reactivation) ──────────────────
export async function requestPropertyReactivation(propertyId: string, reason: string) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized: Only the property owner can request reactivation.");
    if (!reason?.trim()) throw new Error("A reason for reactivation is required.");
    const effectiveOwnerId = await getEffectiveOwnerId(session);
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error("Property not found.");
    if (property.ownerId !== effectiveOwnerId) throw new Error("You do not own this property.");
    if (property.status !== 'DEACTIVATED') throw new Error("Only DEACTIVATED properties can be re-listed.");
    await prisma.$transaction(async (tx) => {
        await (tx.property as any).update({ where: { id: propertyId }, data: { status: 'REACTIVATION_REQUESTED', deactivationReason: reason.trim() } });
        const admin = await tx.user.findFirst({ where: { role: 'ADMIN' } });
        if (admin) await tx.notification.create({ data: { userId: admin.id, type: "PROPERTY_PENDING", message: `Re-list Request: "${property.name}" (${property.displayId}) — Owner wants to re-list. Reason: ${reason}`, targetRole: "ADMIN" } });
        await tx.auditLog.create({ data: { actorId: session.userId, actorRole: session.role, actorName: session.name || 'Owner', actionType: 'UPDATE', entityType: 'PROPERTY', entityId: propertyId, entityName: property.name, description: `Owner requested reactivation for "${property.name}" (${property.displayId}). Reason: ${reason}.`, previousValue: { status: 'DEACTIVATED' }, newValue: { status: 'REACTIVATION_REQUESTED' }, ipAddress: 'internal', userAgent: 'server-action' } });
    });
    revalidatePath('/dashboard/owner/properties');
    return { success: true };
}

export async function approvePropertyReactivation(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error("Property not found.");
    if (property.status !== 'REACTIVATION_REQUESTED') throw new Error("No pending reactivation request for this property.");
    await prisma.$transaction(async (tx) => {
        await (tx.property as any).update({ where: { id: propertyId }, data: { status: 'APPROVED', deactivationRequestedAt: null, deactivationRejectedAt: null, deactivationRejectedBy: null, deactivationRejectedReason: null } });
        await tx.notification.create({ data: { userId: property.ownerId, type: "PROPERTY_APPROVED", message: `Great news! Your property "${property.name}" has been re-listed and is now LIVE on RentPe. Students can search and book again!`, targetRole: "OWNER" } });
        await tx.auditLog.create({ data: { actorId: session.userId, actorRole: 'ADMIN', actorName: session.name || 'Admin', actionType: 'APPROVE', entityType: 'PROPERTY', entityId: propertyId, entityName: property.name, description: `Admin approved reactivation (re-listing) of "${property.name}" (${property.displayId}). Property is now LIVE.`, previousValue: { status: 'REACTIVATION_REQUESTED' }, newValue: { status: 'APPROVED' }, ipAddress: 'internal', userAgent: 'server-action' } });
    });
    revalidatePath('/dashboard/admin/deactivation-requests');
    revalidatePath('/dashboard/owner/properties');
    revalidatePath('/search');
    return { success: true };
}

export async function rejectPropertyReactivation(propertyId: string, rejectionReason: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    if (!rejectionReason?.trim()) throw new Error("A rejection reason is required.");
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error("Property not found.");
    if (property.status !== 'REACTIVATION_REQUESTED') throw new Error("No pending reactivation request for this property.");
    await prisma.$transaction(async (tx) => {
        await (tx.property as any).update({ where: { id: propertyId }, data: { status: 'DEACTIVATED', deactivationRejectedAt: new Date(), deactivationRejectedBy: session.userId, deactivationRejectedReason: rejectionReason.trim() } });
        await tx.notification.create({ data: { userId: property.ownerId, type: "PROPERTY_REJECTED", message: `Re-listing request for "${property.name}" was not approved. Reason: ${rejectionReason}. Property remains deactivated.`, targetRole: "OWNER" } });
        await tx.auditLog.create({ data: { actorId: session.userId, actorRole: 'ADMIN', actorName: session.name || 'Admin', actionType: 'REJECT', entityType: 'PROPERTY', entityId: propertyId, entityName: property.name, description: `Admin rejected reactivation for "${property.name}" (${property.displayId}). Property stays DEACTIVATED. Reason: ${rejectionReason}.`, previousValue: { status: 'REACTIVATION_REQUESTED' }, newValue: { status: 'DEACTIVATED', rejectionReason }, ipAddress: 'internal', userAgent: 'server-action' } });
    });
    revalidatePath('/dashboard/admin/deactivation-requests');
    return { success: true };
}

export async function updatePropertyRules(propertyId: string, rules: string[]) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error('Property not found');
    await (prisma.property as any).update({
        where: { id: propertyId },
        data: { rules: JSON.stringify(rules) }
    });
    revalidatePath(`/dashboard/owner/properties/${propertyId}`);
    revalidatePath(`/property/${propertyId}`);
    return { success: true };
}
