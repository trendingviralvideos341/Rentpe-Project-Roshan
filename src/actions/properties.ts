'use server';

/*
 * ──────────────────────────────────────────────────────────────────────────────
 * PHASE 1 — NATIVE FUZZY SEARCH (pg_trgm)
 * ──────────────────────────────────────────────────────────────────────────────
 * To enable full trigram fuzzy search on Supabase:
 *   1. Go to Supabase Dashboard → SQL Editor
 *   2. Run: CREATE EXTENSION IF NOT EXISTS pg_trgm;
 *   3. Optionally add a GIN index for performance:
 *      CREATE INDEX IF NOT EXISTS idx_property_name_trgm ON "Property" USING GIN (name gin_trgm_ops);
 *      CREATE INDEX IF NOT EXISTS idx_property_city_trgm ON "Property" USING GIN (city gin_trgm_ops);
 *      CREATE INDEX IF NOT EXISTS idx_property_addr_trgm ON "Property" USING GIN (address gin_trgm_ops);
 *
 * The searchPropertiesFuzzy function below attempts trigram similarity first
 * and automatically falls back to ILIKE if pg_trgm is not installed.
 * ILIKE alone works on any PostgreSQL/SQLite database without migrations.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/actions/rbac";
import { uploadToCloudinary, batchUploadToCloudinary } from "@/lib/upload";
import { encryptIfPresent, decryptIfPresent, maskBankAccount, maskBeneficiaryName, maskIfscCode } from '@/lib/crypto';
import { logAuditEvent } from "@/lib/audit";
import { revalidateGlobalProperty, revalidateGlobalVerifications, revalidateAdminDataManagement, revalidateGlobalPayments } from "@/lib/cache";
import { randomUUID } from "crypto";
import { withSafeAction } from "@/lib/safe-action";
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
            include: { staffProfile: true }
        });
        
        if (user?.staffProfile) {
            const assignedIds = await prisma.staffPropertyAssignment.findMany({
                where: { staffMemberId: user.staffProfile.id },
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
                select: { name: true, email: true, phone: true }
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

    if (session?.role === 'ADMIN') {
        const propertyToReturn = { ...property } as any;
        const decryptedAcc = decryptIfPresent(propertyToReturn.bankAccountNoEncrypted);
        propertyToReturn.bankAccountNo = decryptedAcc ? maskBankAccount(decryptedAcc) : null;
        const decryptedIfsc = decryptIfPresent(propertyToReturn.bankIfscEncrypted);
        propertyToReturn.bankIfsc = decryptedIfsc ? maskIfscCode(decryptedIfsc) : null;
        if (propertyToReturn.bankName) propertyToReturn.bankName = maskBeneficiaryName(propertyToReturn.bankName);
        
        delete propertyToReturn.bankAccountNoEncrypted;
        delete propertyToReturn.bankIfscEncrypted;
        
        return propertyToReturn;
    }

    if (session?.role === 'OWNER' || session?.role === 'STAFF') {
        const user = await prisma.user.findUnique({ 
            where: { id: session.userId },
            include: { staffProfile: true }
        });
        
        if (user?.staffProfile) {
            const isAssigned = await prisma.staffPropertyAssignment.findUnique({
                where: { staffMemberId_propertyId: { staffMemberId: user.staffProfile.id, propertyId: id } }
            });
            if (!isAssigned) throw new Error("Access denied");
        } else if (property.ownerId !== (user?.parentOwnerId || session.userId)) {
             throw new Error("Access denied");
        }

        const propertyToReturn = { ...property } as any;
        const decryptedAccOwner = decryptIfPresent(propertyToReturn.bankAccountNoEncrypted);
        propertyToReturn.bankAccountNo = decryptedAccOwner ? maskBankAccount(decryptedAccOwner) : null;
        const decryptedIfscOwner = decryptIfPresent(propertyToReturn.bankIfscEncrypted);
        propertyToReturn.bankIfsc = decryptedIfscOwner ? maskIfscCode(decryptedIfscOwner) : null;
        if (propertyToReturn.bankName) propertyToReturn.bankName = maskBeneficiaryName(propertyToReturn.bankName);
        
        delete propertyToReturn.bankAccountNoEncrypted;
        delete propertyToReturn.bankIfscEncrypted;
        
        return propertyToReturn;
    }

    if (!['LIVE', 'APPROVED'].includes(property.status)) return null;

    // For public view, filter only verified photos
    let verifiedDocs: string[] = [];
    try { verifiedDocs = JSON.parse(property.verifiedDocs || '[]'); } catch { verifiedDocs = []; }
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
        aadhaarProof: null, // Security: Never leak in public view
        panProof: null,
        pgLicenceUrl: null,
        bankName: null,
        bankAccountNoEncrypted: undefined,
        bankIfscEncrypted: undefined,
        cancelChequeUrl: null,
    };
}

async function _createProperty(data: FormData | any) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF')) throw new Error("Unauthorized");

    const isFormData = data instanceof FormData;
    const getVal = (key: string) => isFormData ? (data.get(key) as string) : (data[key] as string);
    const getAllVal = (key: string) => isFormData ? data.getAll(key) : (data[key] || []);
    const userId = session.userId;

    // Ã¢â€â‚¬Ã¢â€â‚¬ PHASE 1: PARALLEL PRE-FLIGHT Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    // Fire all independent DB reads CONCURRENTLY. Eliminates one full
    // round-trip from the cold path (~200-400ms on remote DBs).
    const [user, settings] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, role: true, parentOwnerId: true, staffPermissions: true }
        }),
        prisma.platformSettings.findUnique({ where: { id: "singleton" } })
    ]) as any[];

    if (user?.role === 'STAFF') {
        let perms: string[] = [];
        try { perms = JSON.parse(user.staffPermissions || "[]"); } catch { perms = []; }
        if (!perms.includes('register_property')) throw new Error("You do not have permission to register properties");
    }

    // ──────────────── PHASE 2: DATA EXTRACTION ────────────────────────────────
    const name = getVal("name");
    const address = getVal("address");
    const city = getVal("city");
    const description = getVal("description");
    const amenities = getVal("amenities");
    const ownerName = getVal("ownerName");
    const roomsSource = getVal("rooms");
    const propertyType = getVal("propertyType");
    const genderType = getVal("genderType");
    const licenseNumber = getVal("licenseNumber");
    const reraId = getVal("reraId");
    const gstNumber = getVal("gstNumber");
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

    const onboardingFee = (settings?.onboardingFeesEnabled ?? true) ? settings.ownerOnboardingFeeFlat : 0;
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

    let parsedRooms: any[] = [];
    try { parsedRooms = typeof roomsSource === 'string' ? JSON.parse(roomsSource) : (roomsSource || []); } catch { parsedRooms = []; }

    // ──────────────── SECURITY: Hard-caps to prevent abuse & DB overload ────────────────
    const MAX_ROOMS = 50;
    const MAX_BEDS = 500;
    if (parsedRooms.length > MAX_ROOMS) throw new Error(`Maximum ${MAX_ROOMS} rooms allowed per registration.`);
    const totalBedsNeeded = parsedRooms.reduce((sum: number, r: any) => sum + (parseInt(r.availability) || 0), 0);
    if (totalBedsNeeded > MAX_BEDS) throw new Error(`Maximum ${MAX_BEDS} total beds allowed per registration.`);

    // ──────────────── PHASE 3: PARALLEL ID GENERATION ────────────────────────────────
    // All 3 ID-sequence DB reads now run simultaneously and atomically.
    const [displayId, roomIdsList, bedIdsList] = await Promise.all([
        generateSequentialId('PROPERTY'),
        parsedRooms.length > 0 ? Promise.all(parsedRooms.map(() => generateSequentialId('ROOM'))) : Promise.resolve([] as string[]),
        totalBedsNeeded > 0 ? Promise.all(Array(totalBedsNeeded).fill(0).map(() => generateSequentialId('BED'))) : Promise.resolve([] as string[]),
    ]);

    // ──────────────── PHASE 4: BUILD ALL ROWS IN MEMORY (zero DB round-trips) ─────────
    // randomUUID() pre-links rooms—beds without sequential DB reads.
    const roomsToCreate: any[] = [];
    const bedsToCreate: any[] = [];
    let bedIdx = 0;

    for (let i = 0; i < parsedRooms.length; i++) {
        const r = parsedRooms[i];
        const roomId = randomUUID();
        const availability = parseInt(r.availability) || 0;
        // securityDeposit from UI is '1' or '2' (months). Clamp to max 2 as per platform rule.
        const depositMonths = Math.min(parseInt(r.securityDeposit) || 1, 2);

        if (!r.roomNumber || !r.type || !r.price) {
            throw new Error(`Room Number, Bed Type, and Rent Price are required for all rooms.`);
        }
        const safeRoomNumber = r.roomNumber.toString().replace(/[^a-zA-Z0-9\-_]/g, '');
        if (!safeRoomNumber.trim()) throw new Error(`Valid Room Number is required for all rooms.`);
        if (parseFloat(r.price) <= 0) throw new Error(`Valid monthly rent is required for all rooms.`);

        roomsToCreate.push({
            id: roomId,
            displayId: (roomIdsList as string[])[i],
            propertyId: '',
            roomNumber: safeRoomNumber,
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

    // ──────────────── PHASE 5: ATOMIC TRANSACTION — 4 writes total, regardless of scale ───
    // Before: O(N×M) sequential writes. After: always exactly 4 bulk writes.
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
                genderType: (genderType as any) || "COED",
                licenseNumber,
                reraId,
                gstNumber,
                businessName,
                adminNotes: onboardingFee > 0 ? `[SYSTEM: Fee Acknowledged - Ã¢â€šÂ¹${onboardingFee}]` : null,
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

    // Send Property Submission Email
    try {
        const { sendEmail } = await import('@/lib/email');
        const { OwnerNotificationTemplate } = await import('@/lib/email-templates');
        if (user?.email) {
            sendEmail({
                to: user.email,
                subject: `Property Submission Confirmed - ${name}`,
                html: OwnerNotificationTemplate(
                    user.name || "Owner",
                    "Property Submission Received",
                    `Thank you for listing <strong>${name}</strong> on RentPe. Your application is currently under review by our verification team. We will notify you once it is approved.`,
                    "/dashboard/owner/properties",
                    "View Property Status"
                )
            }).catch(e => console.error("Failed to send property submission email:", e));
        }
    } catch (e) {
        console.error("Email module load error:", e);
    }

    revalidateGlobalProperty(result?.id || '');
    return result;
}

export const createProperty = withSafeAction(_createProperty);

export async function updateProperty(propertyId: string, data: any) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) {
        throw new Error("Unauthorized");
    }

    const existing = await verifyPropertyAccess(session, propertyId);

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
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) {
        throw new Error("Unauthorized");
    }

    const property = await verifyPropertyAccess(session, propertyId);

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
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) {
        throw new Error("Unauthorized");
    }

    const property = await verifyPropertyAccess(session, propertyId);

    if (!roomData.roomNumber || !roomData.type || !roomData.price) {
        throw new Error("Room Number, Bed Type, and Rent Price are required.");
    }
    roomData.roomNumber = roomData.roomNumber.toString().replace(/[^a-zA-Z0-9\-_]/g, '');
    if (!roomData.roomNumber.trim()) throw new Error("Valid Room Number is required.");
    if (parseFloat(roomData.price) <= 0) throw new Error("Valid monthly rent is required.");

    const roomDisplayId = await generateSequentialId('ROOM');
    const bedIdsList = await Promise.all(Array(roomData.availability).fill(0).map(() => generateSequentialId('BED')));
    
    const transactionResult = await prisma.$transaction(async (tx) => {
        const room = await tx.room.create({
            data: { ...roomData, displayId: roomDisplayId, propertyId, totalBeds: roomData.availability, status: 'AVAILABLE' }
        });

        if (room.availability > 0) {
            const bedsData = Array(room.availability).fill(0).map((_, i) => ({
                displayId: bedIdsList[i],
                roomId: room.id,
                bedNumber: `${room.roomNumber}-${String.fromCharCode(64 + i + 1)}`,
                status: 'AVAILABLE'
            }));
            await (tx as any).bed.createMany({ data: bedsData });
        }
        
        // Return room with beds for UI sync
        return await tx.room.findUnique({
            where: { id: room.id },
            include: { beds: { orderBy: { bedNumber: 'asc' } } }
        });
    });

    revalidateGlobalProperty(propertyId);

    return transactionResult;
}

export async function editRoom(roomId: string, roomData: any) {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF', 'ADMIN'].includes(session.role)) {
        throw new Error("Unauthorized");
    }

    const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { property: { select: { id: true, ownerId: true } } }
    });

    if (!room) throw new Error("Room not found");

    await verifyPropertyAccess(session, room.property.id);

    if (roomData.roomNumber) {
        roomData.roomNumber = roomData.roomNumber.toString().replace(/[^a-zA-Z0-9\-_]/g, '');
        if (!roomData.roomNumber.trim()) throw new Error("Valid Room Number is required.");
    }
    if (roomData.price && parseFloat(roomData.price) <= 0) {
        throw new Error("Valid monthly rent is required.");
    }
    if (roomData.type && !roomData.type.trim()) {
        throw new Error("Bed Type cannot be empty.");
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
            
            const bedsData = Array(bedsToAdd).fill(0).map((_, i) => ({
                displayId: bedIdsList[i],
                roomId: roomId,
                bedNumber: `${updated.roomNumber}-${String.fromCharCode(64 + oldAvailability + i + 1)}`,
                status: 'AVAILABLE'
            }));
            await tx.bed.createMany({ data: bedsData });
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
    let verifiedDocs = [];
    try { verifiedDocs = JSON.parse((property as any).verifiedDocs || "[]"); } catch { verifiedDocs = []; }

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
    await requirePermission('VERIFY_KYC');

    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { verifiedDocs: true } });
    if (!property) throw new Error("Not found");

    let verifiedDocs = [];
    try { verifiedDocs = JSON.parse(property.verifiedDocs || "[]"); } catch { verifiedDocs = []; }
    if (verified) { if (!verifiedDocs.includes(docKey)) verifiedDocs.push(docKey); }
    else { verifiedDocs = verifiedDocs.filter((key: string) => key !== docKey); }

    try {
        await prisma.property.update({ where: { id: propertyId }, data: { verifiedDocs: JSON.stringify(verifiedDocs) } });
        revalidateGlobalProperty(propertyId);
        revalidateGlobalVerifications();
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}



export async function requestDocumentReupload(propertyId: string, docType: string, note: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('VERIFY_KYC');

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
    await requirePermission('APPROVE_PROPERTY');

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
        // FeeExemption, FoodMenu, Assignment Ã¢â‚¬â€ we added status to some.
        
        await (tx as any).foodMenu?.updateMany?.({ where: { propertyId }, data: { status: 'CANCELLED' } });
        await (tx as any).StaffPropertyAssignment?.updateMany?.({ where: { propertyId }, data: { status: 'CANCELLED' } });

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

// Ã¢â€â‚¬Ã¢â€â‚¬ Property Deactivation Flow (OYO / Zolo / Stanza standard) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

/**
 * OWNER: Request to deactivate an approved property.
 * Sets status Ã¢â€ â€™ DEACTIVATION_REQUESTED for admin review.
 */
export async function requestPropertyDeactivation(propertyId: string, reason: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF')) throw new Error("Unauthorized");

    if (session.role === 'STAFF') {
        const perms = session.permissions || [];
        if (!perms.includes('request_deactivation')) {
            throw new Error("Permission Denied: Missing request_deactivation permission.");
        }

        // Ã¢Å“â€¦ Scope check: staff can only request deactivation for properties they're assigned to
        const staffUser = await prisma.user.findUnique({
            where: { id: session.userId },
            include: { staffProfile: true }
        });
        if (staffUser?.staffProfile) {
            const assignment = await prisma.staffPropertyAssignment.findFirst({
                where: { staffMemberId: staffUser.staffProfile.id, propertyId }
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
                    message: `Deactivation Request: "${property.name}" (${property.displayId}) Ã¢â‚¬â€ Requested by ${session.role === 'STAFF' ? 'Staff (' + session.name + ')' : 'Owner'}. Reason: ${reason}`,
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

        // Ã¢Å“â€¦ Audit Log Ã¢â‚¬â€ correctly captures whether Owner or Staff submitted the request
        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: session.role,  // 'OWNER' or 'STAFF' Ã¢â‚¬â€ accurate
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

    revalidateGlobalProperty(propertyId);
    return { success: true };
}

/**
 * ADMIN: Approve a deactivation request.
 * Blocks if active tenants or pending bookings still exist.
 * Sets status Ã¢â€ â€™ DEACTIVATED.
 */
export async function approvePropertyDeactivation(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('APPROVE_PROPERTY');

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

    // ÃƒÂ°Ã…Â¸Ã…Â¡Ã‚Â« Business Rule: Cannot deactivate if active tenants exist
    if (property.tenants.length > 0) {
        throw new Error(`Cannot deactivate: ${property.tenants.length} active tenant(s) must be moved out first.`);
    }

    // ÃƒÂ°Ã…Â¸Ã…Â¡Ã‚Â« Business Rule: Cannot deactivate if active/pending bookings exist
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

        // Ã¢Å“â€¦ Audit Log
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

    revalidateAdminDataManagement();
    return { success: true };
}

/**
 * ADMIN: Reject a deactivation request.
 * Reverts property to APPROVED and notifies owner with the rejection reason.
 */
export async function rejectPropertyDeactivation(propertyId: string, rejectionReason: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('APPROVE_PROPERTY');

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

        // Ã¢Å“â€¦ Audit Log
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

    revalidateAdminDataManagement();
    return { success: true };
}
// Ã¢â€â‚¬Ã¢â€â‚¬ RentPe Property Lifecycle (Deactivation & Reactivation) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
        if (admin) await tx.notification.create({ data: { userId: admin.id, type: "PROPERTY_PENDING", message: `Re-list Request: "${property.name}" (${property.displayId}) Ã¢â‚¬â€ Owner wants to re-list. Reason: ${reason}`, targetRole: "ADMIN" } });
        await tx.auditLog.create({ data: { actorId: session.userId, actorRole: session.role, actorName: session.name || 'Owner', actionType: 'UPDATE', entityType: 'PROPERTY', entityId: propertyId, entityName: property.name, description: `Owner requested reactivation for "${property.name}" (${property.displayId}). Reason: ${reason}.`, previousValue: { status: 'DEACTIVATED' }, newValue: { status: 'REACTIVATION_REQUESTED' }, ipAddress: 'internal', userAgent: 'server-action' } });
    });
    revalidateGlobalProperty(propertyId);
    return { success: true };
}

export async function approvePropertyReactivation(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('APPROVE_PROPERTY');
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error("Property not found.");
    if (property.status !== 'REACTIVATION_REQUESTED') throw new Error("No pending reactivation request for this property.");
    await prisma.$transaction(async (tx) => {
        await (tx.property as any).update({ where: { id: propertyId }, data: { status: 'APPROVED', deactivationRequestedAt: null, deactivationRejectedAt: null, deactivationRejectedBy: null, deactivationRejectedReason: null } });
        await tx.notification.create({ data: { userId: property.ownerId, type: "PROPERTY_APPROVED", message: `Great news! Your property "${property.name}" has been re-listed and is now LIVE on RentPe. Students can search and book again!`, targetRole: "OWNER" } });
        await tx.auditLog.create({ data: { actorId: session.userId, actorRole: 'ADMIN', actorName: session.name || 'Admin', actionType: 'APPROVE', entityType: 'PROPERTY', entityId: propertyId, entityName: property.name, description: `Admin approved reactivation (re-listing) of "${property.name}" (${property.displayId}). Property is now LIVE.`, previousValue: { status: 'REACTIVATION_REQUESTED' }, newValue: { status: 'APPROVED' }, ipAddress: 'internal', userAgent: 'server-action' } });
    });
    revalidateAdminDataManagement();
    revalidateGlobalProperty(propertyId);
    return { success: true };
}

export async function rejectPropertyReactivation(propertyId: string, rejectionReason: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");
    await requirePermission('APPROVE_PROPERTY');
    if (!rejectionReason?.trim()) throw new Error("A rejection reason is required.");
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error("Property not found.");
    if (property.status !== 'REACTIVATION_REQUESTED') throw new Error("No pending reactivation request for this property.");
    await prisma.$transaction(async (tx) => {
        await (tx.property as any).update({ where: { id: propertyId }, data: { status: 'DEACTIVATED', deactivationRejectedAt: new Date(), deactivationRejectedBy: session.userId, deactivationRejectedReason: rejectionReason.trim() } });
        await tx.notification.create({ data: { userId: property.ownerId, type: "PROPERTY_REJECTED", message: `Re-listing request for "${property.name}" was not approved. Reason: ${rejectionReason}. Property remains deactivated.`, targetRole: "OWNER" } });
        await tx.auditLog.create({ data: { actorId: session.userId, actorRole: 'ADMIN', actorName: session.name || 'Admin', actionType: 'REJECT', entityType: 'PROPERTY', entityId: propertyId, entityName: property.name, description: `Admin rejected reactivation for "${property.name}" (${property.displayId}). Property stays DEACTIVATED. Reason: ${rejectionReason}.`, previousValue: { status: 'REACTIVATION_REQUESTED' }, newValue: { status: 'DEACTIVATED', rejectionReason }, ipAddress: 'internal', userAgent: 'server-action' } });
    });
    revalidateAdminDataManagement();
    return { success: true };
}

export async function updatePropertyRules(propertyId: string, rules: string[]) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF' && session.role !== 'ADMIN')) throw new Error('Unauthorized');

    const property = await verifyPropertyAccess(session, propertyId);

    const cleanedRules = Array.isArray(rules)
        ? Array.from(new Set(rules.map(r => String(r).trim()).filter(Boolean)))
        : [];
    
    if (cleanedRules.length > 50) throw new Error('Maximum 50 rules allowed per property');

    await (prisma.property as any).update({
        where: { id: propertyId },
        data: { rules: JSON.stringify(cleanedRules) }
    });

    await prisma.auditLog.create({
        data: {
            actorId: session.userId,
            actorRole: session.role,
            actorName: session.name || 'User',
            actionType: 'UPDATE',
            entityType: 'PROPERTY',
            entityId: propertyId,
            entityName: property.name,
            description: `Updated property rules for "${property.name}"`,
            previousValue: { rules: property.rules },
            newValue: { rules: JSON.stringify(cleanedRules) },
            ipAddress: 'internal',
            userAgent: 'server-action'
        }
    });

    revalidateGlobalProperty(propertyId);
    
    return { success: true };
}

export async function verifyPropertyAccess(session: any, propertyId: string) {
    const effectiveOwnerId = await getEffectiveOwnerId(session).catch(() => session.userId);
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error('Property not found');

    if (session.role !== 'ADMIN' && property.ownerId !== effectiveOwnerId) {
        throw new Error('Unauthorized: You do not own this property');
    }

    if (session.role === 'STAFF') {
        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            include: { staffProfile: true }
        });
        if (!user?.staffProfile) throw new Error('Staff profile not found');
        
        if (user.staffProfile.status !== 'ACTIVE') {
            throw new Error('Unauthorized: Your staff account is currently inactive');
        }

        const role = user.staffProfile.role?.toLowerCase() || '';
        const isManager = role === 'manager' || role === 'property manager';
        
        if (!isManager) {
            const assignment = await prisma.staffPropertyAssignment.findFirst({
                where: { 
                    staffMemberId: user.staffProfile.id, 
                    propertyId: propertyId, 
                    status: 'ACTIVE' 
                }
            });
            if (!assignment) {
                throw new Error('Unauthorized: You have not been assigned access to manage this specific property');
            }
        }
    }
    return property;
}

export async function updatePropertyDescription(propertyId: string, description: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF' && session.role !== 'ADMIN')) throw new Error('Unauthorized');
    
    const property = await verifyPropertyAccess(session, propertyId);

    const trimmed = description?.trim() || '';
    if (trimmed.length > 5000) throw new Error('Description cannot exceed 5000 characters');

    await (prisma.property as any).update({
        where: { id: propertyId },
        data: { description: trimmed || null }
    });

    await prisma.auditLog.create({
        data: {
            actorId: session.userId,
            actorRole: session.role,
            actorName: session.name || 'User',
            actionType: 'UPDATE',
            entityType: 'PROPERTY',
            entityId: propertyId,
            entityName: property.name,
            description: `Updated property description for "${property.name}"`,
            previousValue: { description: property.description },
            newValue: { description: trimmed },
            ipAddress: 'internal',
            userAgent: 'server-action'
        }
    });

    revalidateGlobalProperty(propertyId);
    return { success: true };
}

export async function updatePropertyAmenities(propertyId: string, amenities: string[]) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF' && session.role !== 'ADMIN')) throw new Error('Unauthorized');

    const property = await verifyPropertyAccess(session, propertyId);

    const cleanedAmenities = Array.isArray(amenities)
        ? Array.from(new Set(amenities.map(a => String(a).trim()).filter(Boolean)))
        : [];
    
    if (cleanedAmenities.length > 50) throw new Error('Maximum 50 amenities allowed per property');

    await (prisma.property as any).update({
        where: { id: propertyId },
        data: { amenities: JSON.stringify(cleanedAmenities) }
    });

    await prisma.auditLog.create({
        data: {
            actorId: session.userId,
            actorRole: session.role,
            actorName: session.name || 'User',
            actionType: 'UPDATE',
            entityType: 'PROPERTY',
            entityId: propertyId,
            entityName: property.name,
            description: `Updated property amenities for "${property.name}"`,
            previousValue: { amenities: property.amenities },
            newValue: { amenities: JSON.stringify(cleanedAmenities) },
            ipAddress: 'internal',
            userAgent: 'server-action'
        }
    });

    revalidateGlobalProperty(propertyId);
    return { success: true };
}

export async function updatePropertyLocation(propertyId: string, locationData: { address: string; city: string }) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'STAFF' && session.role !== 'ADMIN')) throw new Error('Unauthorized');

    const property = await verifyPropertyAccess(session, propertyId);

    const cleanStreet = locationData.address?.trim() || '';
    const cleanCity = locationData.city?.trim() || '';

    if (!cleanStreet) throw new Error('Address is required');
    if (!cleanCity) throw new Error('City is required');
    if (cleanStreet.length > 500) throw new Error('Address cannot exceed 500 characters');
    if (cleanCity.length > 100) throw new Error('City cannot exceed 100 characters');

    await (prisma.property as any).update({
        where: { id: propertyId },
        data: {
            address: cleanStreet,
            city: cleanCity,
        }
    });

    await prisma.auditLog.create({
        data: {
            actorId: session.userId,
            actorRole: session.role,
            actorName: session.name || 'User',
            actionType: 'UPDATE',
            entityType: 'PROPERTY',
            entityId: propertyId,
            entityName: property.name,
            description: `Updated property location for "${property.name}"`,
            previousValue: { address: property.address, city: property.city },
            newValue: { address: cleanStreet, city: cleanCity },
            ipAddress: 'internal',
            userAgent: 'server-action'
        }
    });

    revalidateGlobalProperty(propertyId);
    return { success: true };
}





// --- OWNER ONBOARDING FEE PAYMENT ---------------------------------------------

export async function createOnboardingFeeOrder(propertyId: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');
    const userId = (session as any).userId;

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error('Property not found');

    const effectiveOwnerId = await getEffectiveOwnerId(session).catch(() => userId);
    if (property.ownerId !== effectiveOwnerId && property.ownerId !== userId) {
        throw new Error('Unauthorized — this property does not belong to you');
    }

    if ((property as any).onboardingPaidAt) {
        throw new Error('Onboarding fee has already been paid for this property');
    }

    const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
    if (!settings || !(settings as any).onboardingFeesEnabled) throw new Error('Property onboarding fees are currently disabled');
    const feeAmount = settings.ownerOnboardingFeeFlat || 99;
    const amountInPaise = Math.round(feeAmount * 100);

    const { razorpay } = await import('@/lib/razorpay');
    let order: { id: string; amount: number; currency: string };
    try {
        const rzpOrder = await (razorpay.orders as any).create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `obdfee_${propertyId.slice(0, 8)}`,
        });
        order = { id: rzpOrder.id, amount: rzpOrder.amount as number, currency: rzpOrder.currency };
    } catch (apiError: any) {
        console.warn('[ONBOARDING FEE] Razorpay API Error, using mock:', apiError);
        order = { id: `order_mock_${Math.random().toString(36).substring(2, 9)}`, amount: amountInPaise, currency: 'INR' };
    }

    await (prisma.property as any).update({
        where: { id: propertyId },
        data: { onboardingRazorpayOrderId: order.id },
    });

    return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
        isMock: order.id.startsWith('order_mock_'),
        propertyName: property.name,
        propertyDisplayId: property.displayId,
        feeAmount,
    };
}

export async function verifyOnboardingFeePayment(data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    propertyId: string;
}) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');
    const userId = (session as any).userId;

    const property = await prisma.property.findUnique({ where: { id: data.propertyId } });
    if (!property) throw new Error('Property not found');

    const effectiveOwnerId = await getEffectiveOwnerId(session).catch(() => userId);
    if (property.ownerId !== effectiveOwnerId && property.ownerId !== userId) throw new Error('Unauthorized');

    if ((property as any).onboardingPaidAt) {
        return { success: true, alreadyPaid: true, propertyId: data.propertyId };
    }

    if (!data.razorpay_order_id.startsWith('order_mock_')) {
        const crypto = await import('crypto');
        const secret = process.env.RAZORPAY_KEY_SECRET;
        if (!secret) throw new Error('Razorpay secret not configured');
        const generated_signature = crypto.createHmac('sha256', secret)
            .update(data.razorpay_order_id + '|' + data.razorpay_payment_id).digest('hex');
        if (generated_signature !== data.razorpay_signature) throw new Error('Invalid payment signature. Potential fraud detected.');
    }

    const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
    const feeAmount = settings?.ownerOnboardingFeeFlat || 99;
    const GST_RATE = 0.18;
    const baseAmount = Math.round((feeAmount / (1 + GST_RATE)) * 100) / 100;
    const gstAmount  = Math.round((feeAmount - baseAmount) * 100) / 100;
    const cgst       = Math.round((gstAmount / 2) * 100) / 100;
    const sgst       = Math.round((gstAmount - cgst) * 100) / 100;

    await (prisma.property as any).update({
        where: { id: data.propertyId },
        data: {
            onboardingPaidAt: new Date(),
            onboardingPaymentMethod: 'ONLINE',
            onboardingRazorpayId: data.razorpay_payment_id,
            onboardingRazorpayOrderId: data.razorpay_order_id,
            status: 'APPROVED_PAYMENT_VERIFIED',
        },
    });

    await logAuditEvent({
        actorId: userId,
        actorRole: (session as any).role || 'OWNER',
        actorName: (await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name || 'Unknown',
        actionType: 'UPDATE',
        entityType: 'PROPERTY',
        entityId: data.propertyId,
        entityName: property.name,
        description: `Owner paid onboarding fee Rs.${feeAmount} for property ${property.displayId}. Razorpay ID: ${data.razorpay_payment_id}`,
        newValue: { razorpayId: data.razorpay_payment_id, amount: feeAmount, cgst, sgst, baseAmount },
    }).catch(err => console.error('[ONBOARDING FEE AUDIT] Failed:', err));


    try {
        const owner = await prisma.user.findUnique({ where: { id: property.ownerId }, select: { email: true, name: true } });
        if (owner?.email) {
            const { sendEmail } = await import('@/lib/email');
            sendEmail({
                to: owner.email,
                subject: `Property Onboarding Fee Paid — ${property.name} ?`,
                html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #e2e8f0;border-radius:12px;"><div style="background:linear-gradient(135deg,#3730a3,#7c3aed);padding:20px;border-radius:8px;margin-bottom:20px;"><h1 style="color:white;margin:0;">RentPe</h1><p style="color:#c7d2fe;margin:4px 0 0 0;font-size:13px;">Property Onboarding Confirmed</p></div><p>Dear ${owner.name},</p><p>Onboarding fee of <strong>Rs. ${feeAmount}</strong> for <strong>${property.name}</strong> (${property.displayId}) has been paid.</p><p style="color:#94a3b8;font-size:12px;">Razorpay ID: ${data.razorpay_payment_id}</p></div>`,
            }).catch(err => console.error('[ONBOARDING FEE EMAIL] Failed:', err));
        }
    } catch {}

    revalidateGlobalPayments();
    return { success: true, propertyId: data.propertyId, receiptUrl: `/api/receipts/onboarding/${data.propertyId}?download=1` };
}

export async function getOwnerOnboardingFeeStatus() {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');
    const effectiveOwnerId = await getEffectiveOwnerId(session);

    const properties = await (prisma.property as any).findMany({
        where: { ownerId: effectiveOwnerId },
        select: {
            id: true, displayId: true, name: true, city: true, status: true,
            onboardingPaidAt: true, onboardingPaymentMethod: true,
            onboardingRazorpayId: true, onboardingRazorpayOrderId: true, createdAt: true,
            owner: { select: { name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
    const feeAmount = settings?.ownerOnboardingFeeFlat || 99;
    const feesEnabled = settings?.feesEnabled || false;

    return {
        properties: properties.map((p: any) => ({ ...p, feeAmount, feesEnabled, isPaid: !!p.onboardingPaidAt })),
        feeAmount,
        feesEnabled,
    };
}

export async function adminGetAllOnboardingFees() {
    const session = await getSession();
    if (!session || (session as any).role !== 'ADMIN') throw new Error('Unauthorized - Admin only');
    await requirePermission('VIEW_REPORTS');

    const properties = await (prisma.property as any).findMany({
        select: {
            id: true, displayId: true, name: true, city: true, status: true,
            onboardingPaidAt: true, onboardingPaymentMethod: true,
            onboardingRazorpayId: true, onboardingRazorpayOrderId: true, createdAt: true,
            owner: { select: { id: true, name: true, email: true, phone: true, displayId: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
    const feeAmount = settings?.ownerOnboardingFeeFlat || 99;

    return {
        properties: properties.map((p: any) => ({ ...p, feeAmount, isPaid: !!p.onboardingPaidAt })),
        feeAmount,
        totalCollected: properties.filter((p: any) => !!p.onboardingPaidAt).length * feeAmount,
        paidCount: properties.filter((p: any) => !!p.onboardingPaidAt).length,
        pendingCount: properties.filter((p: any) => !p.onboardingPaidAt).length,
    };
}

// --- BANK DETAILS COLLECTION WORKFLOW (OPTION B) -------------------------------

export async function requestBankDetails(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error('Unauthorized');
    await requirePermission('VERIFY_KYC');

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error('Property not found');

    return prisma.$transaction(async (tx) => {
        await tx.property.update({
            where: { id: propertyId },
            data: { status: 'AWAITING_BANK_DETAILS' }
        });

        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: 'ADMIN',
                actorName: session.name || 'Admin',
                actionType: 'UPDATE',
                entityType: 'PROPERTY',
                entityId: propertyId,
                description: `Admin verified property and requested Bank Details. Status changed to AWAITING_BANK_DETAILS.`,
                newValue: { status: 'AWAITING_BANK_DETAILS' },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        await tx.notification.create({
            data: {
                userId: property.ownerId,
                type: 'SYSTEM_ALERT',
                message: `Action Required: Your property "${property.name}" has been verified! Please submit your bank details to proceed.`,
                targetRole: 'OWNER'
            }
        });

        return { success: true };
    });
}

async function _submitBankDetails(propertyId: string, bankData: { bankAccountNo: string, bankIfsc: string, bankName: string, cancelChequeUrl?: string }) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error('Unauthorized');

    const effectiveOwnerId = await getEffectiveOwnerId(session);
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    
    if (!property) throw new Error('Property not found');
    if (property.ownerId !== effectiveOwnerId) throw new Error('Unauthorized');
    
    // ── PATH A: Initial bank details submission (not yet live) ──
    // Property is in the normal onboarding pipeline — just awaiting bank details.
    // Save directly and change status to BANK_DETAILS_SUBMITTED.
    if (property.status === 'AWAITING_BANK_DETAILS') {
        return prisma.$transaction(async (tx) => {
            await tx.property.update({
                where: { id: propertyId },
                data: {
                    bankAccountNoEncrypted: encryptIfPresent(bankData.bankAccountNo),
                    bankIfscEncrypted: encryptIfPresent(bankData.bankIfsc),
                    bankName: bankData.bankName,
                    cancelChequeUrl: bankData.cancelChequeUrl,
                    status: 'BANK_DETAILS_SUBMITTED'
                }
            });

            await tx.auditLog.create({
                data: {
                    actorId: session.userId,
                    actorRole: 'OWNER',
                    actorName: session.name || 'Owner',
                    actionType: 'UPDATE',
                    entityType: 'PROPERTY',
                    entityId: propertyId,
                    description: `Owner submitted bank details for property "${property.name}".`,
                    newValue: { status: 'BANK_DETAILS_SUBMITTED', bankIfsc: bankData.bankIfsc },
                    ipAddress: 'internal',
                    userAgent: 'server-action'
                }
            });

            const admin = await tx.user.findFirst({ where: { role: 'ADMIN' } });
            if (admin) {
                await tx.notification.create({
                    data: {
                        userId: admin.id,
                        type: 'PROPERTY_PENDING',
                        message: `Bank Details Submitted: Owner has submitted bank details for "${property.name}". Please review and make property live.`,
                        targetRole: 'ADMIN'
                    }
                });
            }

            return { success: true, flow: 'initial' };
        });
    }

    // ── PATH B: Bank details UPDATE for an already LIVE/APPROVED property ──
    // ✅ CRITICAL: Do NOT change property status. Save new details to pending_ fields.
    // Admin will review and approve — only then are the live fields updated.
    const allowedUpdateStatuses = ['LIVE', 'APPROVED', 'BANK_DETAILS_VERIFIED', 'APPROVED_PENDING_PAYMENT', 'APPROVED_PAYMENT_VERIFIED'];
    if (allowedUpdateStatuses.includes(property.status)) {
        return prisma.$transaction(async (tx) => {
            await tx.property.update({
                where: { id: propertyId },
                data: {
                    // Save to PENDING fields — NOT the live fields
                    pendingBankAccountNoEncrypted: encryptIfPresent(bankData.bankAccountNo),
                    pendingBankIfscEncrypted: encryptIfPresent(bankData.bankIfsc),
                    pendingBankName: bankData.bankName,
                    pendingCancelChequeUrl: bankData.cancelChequeUrl,
                    bankUpdateRequestedAt: new Date(),
                    // ✅ Status is NOT changed — property stays LIVE
                }
            });

            await tx.auditLog.create({
                data: {
                    actorId: session.userId,
                    actorRole: 'OWNER',
                    actorName: session.name || 'Owner',
                    actionType: 'UPDATE',
                    entityType: 'PROPERTY',
                    entityId: propertyId,
                    description: `Owner submitted updated bank details for LIVE property "${property.name}". Pending admin review — property status unchanged.`,
                    newValue: { pendingBankIfsc: bankData.bankIfsc, pendingBankName: bankData.bankName },
                    ipAddress: 'internal',
                    userAgent: 'server-action'
                }
            });

            // Notify ALL admin users about the pending bank update
            const admins = await tx.user.findMany({ where: { role: 'ADMIN' } });
            for (const admin of admins) {
                await tx.notification.create({
                    data: {
                        userId: admin.id,
                        type: 'BANK_UPDATE_PENDING',
                        message: `🏦 Bank Details Update: Owner of "${property.name}" has submitted updated bank details. Please review and verify in the Bank Details tab.`,
                        targetRole: 'ADMIN',
                        metadata: JSON.stringify({ propertyId, propertyName: property.name })
                    }
                });
            }

            return { success: true, flow: 'update_pending_review' };
        });
    }

    throw new Error(`Cannot update bank details while property is in status: ${property.status}`);
}

export const submitBankDetails = withSafeAction(_submitBankDetails);

export async function manualMakePropertyLive(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error('Unauthorized');
    await requirePermission('APPROVE_PROPERTY');

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error('Property not found');
    if (property.status !== 'BANK_DETAILS_SUBMITTED' && property.status !== 'APPROVED_PAYMENT_VERIFIED') {
        throw new Error('Property must have bank details submitted to go live manually.');
    }

    return prisma.$transaction(async (tx) => {
        await tx.property.update({
            where: { id: propertyId },
            data: { status: 'LIVE', isVerified: true }
        });

        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: 'ADMIN',
                actorName: session.name || 'Admin',
                actionType: 'APPROVE',
                entityType: 'PROPERTY',
                entityId: propertyId,
                description: `Admin verified bank details and manually made property "${property.name}" LIVE.`,
                newValue: { status: 'LIVE' },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        await tx.notification.create({
            data: {
                userId: property.ownerId,
                type: 'PROPERTY_LIVE',
                message: `Congratulations! Your bank details have been verified and your property "${property.name}" is now LIVE on RentPe.`,
                targetRole: 'OWNER'
            }
        });

        return { success: true };
    });
}

export async function requestBankDetailsCorrection(propertyId: string, note: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error('Unauthorized');
    await requirePermission('VERIFY_KYC');

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error('Property not found');
    if (property.status !== 'BANK_DETAILS_SUBMITTED') {
        throw new Error('Property must have bank details submitted to request corrections.');
    }

    return prisma.$transaction(async (tx) => {
        const newNotes = property.adminNotes 
            ? `${property.adminNotes}\n[REUPLOAD:BANK_DETAILS] ${note}`
            : `[REUPLOAD:BANK_DETAILS] ${note}`;

        await tx.property.update({
            where: { id: propertyId },
            data: { status: 'AWAITING_BANK_DETAILS', adminNotes: newNotes }
        });

        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: 'ADMIN',
                actorName: session.name || 'Admin',
                actionType: 'UPDATE',
                entityType: 'PROPERTY',
                entityId: propertyId,
                description: `Admin requested bank details correction for property "${property.name}". Reason: ${note}`,
                newValue: { status: 'AWAITING_BANK_DETAILS' },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        await tx.notification.create({
            data: {
                userId: property.ownerId,
                type: 'PROPERTY_PENDING',
                message: `Action Required: We found an issue with your bank details for "${property.name}". Please review and update. Reason: ${note}`,
                targetRole: 'OWNER'
            }
        });

        return { success: true };
    });
}

export async function approveBankDetails(propertyId: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error('Unauthorized');
    await requirePermission('VERIFY_KYC');

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error('Property not found');
    if (property.status !== 'BANK_DETAILS_SUBMITTED') {
        throw new Error('Property must have bank details submitted to approve.');
    }

    return prisma.$transaction(async (tx) => {
        // Clear bank details reupload note if exists
        let newNotes = property.adminNotes;
        if (newNotes) {
            newNotes = newNotes.split('\n').filter(line => !line.startsWith('[REUPLOAD:BANK_DETAILS]')).join('\n');
            if (newNotes.trim() === '') newNotes = null;
        }

        // According to the flow, after bank details are approved, the status goes to APPROVED_PENDING_PAYMENT (or LIVE if no fee)
        // We'll set it to APPROVED_PENDING_PAYMENT, the fee system will handle the rest
        await tx.property.update({
            where: { id: propertyId },
            data: { status: 'APPROVED_PENDING_PAYMENT', adminNotes: newNotes }
        });

        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: 'ADMIN',
                actorName: session.name || 'Admin',
                actionType: 'APPROVE',
                entityType: 'PROPERTY',
                entityId: propertyId,
                description: `Admin approved bank details for property "${property.name}". Status changed to APPROVED_PENDING_PAYMENT.`,
                newValue: { status: 'APPROVED_PENDING_PAYMENT' },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        await tx.notification.create({
            data: {
                userId: property.ownerId,
                type: 'PROPERTY_LIVE',
                message: `Success! Bank details for "${property.name}" have been approved. Please pay the onboarding fee to go LIVE.`,
                targetRole: 'OWNER'
            }
        });

        return { success: true };
    });
}

export async function getPlatformVerifiers() {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'VERIFIER' && session.role !== 'ONBOARDER')) {
        throw new Error("Unauthorized");
    }

    return prisma.user.findMany({
        where: {
            role: { in: ['ONBOARDER', 'VERIFIER', 'ADMIN'] },
            status: 'ACTIVE'
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, email: true, role: true, displayId: true }
    });
}

export async function assignPropertyToVerifier(propertyId: string, verifierId: string | null) {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'VERIFIER' && session.role !== 'ONBOARDER')) {
        throw new Error("Unauthorized");
    }

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error("Property not found");

    return prisma.$transaction(async (tx) => {
        const updated = await tx.property.update({
            where: { id: propertyId },
            data: { assignedAdminId: verifierId }
        });

        let assigneeName = "Unassigned";
        if (verifierId) {
            const assignee = await tx.user.findUnique({ where: { id: verifierId } });
            assigneeName = assignee?.name || assignee?.email || "Unknown";

            await tx.notification.create({
                data: {
                    userId: verifierId,
                    type: 'SYSTEM_ALERT',
                    message: `New Assignment: Property "${property.name}" has been assigned to you for verification.`,
                    targetRole: 'ADMIN'
                }
            });
        }

        await tx.auditLog.create({
            data: {
                actorId: session.userId,
                actorRole: session.role as string,
                actorName: session.name || 'Admin',
                actionType: 'UPDATE',
                entityType: 'PROPERTY',
                entityId: propertyId,
                description: `Admin property assignment updated. Assigned to: ${assigneeName}`,
                newValue: { assignedAdminId: verifierId },
                ipAddress: 'internal',
                userAgent: 'server-action'
            }
        });

        return { success: true };
    });
}


// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — NATIVE FUZZY SEARCH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fuzzy property search result shape returned by searchPropertiesFuzzy.
 */
export interface FuzzyPropertyResult {
    id: string;
    name: string;
    address: string;
    city: string;
    price: number | null;
    status: string;
    similarity?: number;
}

/**
 * searchPropertiesFuzzy — Phase 1 Native Fuzzy Search
 *
 * Primary strategy: PostgreSQL pg_trgm similarity() function.
 * Fallback strategy: ILIKE pattern matching (works without any extension).
 *
 * @param query - The search term entered by the student.
 * @returns An array of up to 20 live properties matching the query.
 */
export async function searchPropertiesFuzzy(
    query: string
): Promise<FuzzyPropertyResult[]> {
    if (!query?.trim()) return [];

    const pattern = `%${query.trim()}%`;

    // ── Strategy 1: pg_trgm similarity search ─────────────────────────────────
    // Uses similarity() which requires the pg_trgm extension.
    // Threshold 0.1 is intentionally low to support partial / short queries.
    try {
        const results = await prisma.$queryRaw<FuzzyPropertyResult[]>`
            SELECT
                id,
                name,
                address,
                city,
                NULL::numeric           AS price,
                status,
                GREATEST(
                    similarity(name,    ${query}),
                    similarity(address, ${query}),
                    similarity(city,    ${query})
                ) AS similarity
            FROM "Property"
            WHERE status = 'LIVE'
              AND (
                    similarity(name,    ${query}) > 0.1
                 OR similarity(address, ${query}) > 0.1
                 OR similarity(city,    ${query}) > 0.1
                 OR name    ILIKE ${pattern}
                 OR address ILIKE ${pattern}
                 OR city    ILIKE ${pattern}
              )
            ORDER BY similarity DESC
            LIMIT 20;
        `;

        console.log(
            `[FUZZY_SEARCH] pg_trgm strategy returned ${results.length} results for "${query}"`
        );
        return results;
    } catch (trgmError: any) {
        // pg_trgm not available — fall through to ILIKE fallback.
        const isTrgmMissing =
            trgmError?.message?.includes('function similarity') ||
            trgmError?.message?.includes('pg_trgm') ||
            trgmError?.code === '42883'; // undefined_function in PostgreSQL

        if (!isTrgmMissing) {
            // Unexpected error — rethrow so it isn't silently swallowed.
            console.error('[FUZZY_SEARCH] Unexpected error in pg_trgm path:', trgmError);
            throw trgmError;
        }

        console.warn(
            '[FUZZY_SEARCH] pg_trgm not available — falling back to ILIKE. ' +
            'Enable the extension in Supabase SQL Editor: CREATE EXTENSION IF NOT EXISTS pg_trgm;'
        );
    }

    // ── Strategy 2: ILIKE fallback ────────────────────────────────────────────
    // Safe on every PostgreSQL / SQLite version with zero configuration.
    const results = await prisma.$queryRaw<FuzzyPropertyResult[]>`
        SELECT
            id,
            name,
            address,
            city,
            NULL::numeric AS price,
            status
        FROM "Property"
        WHERE status = 'LIVE'
          AND (
                name    ILIKE ${pattern}
             OR address ILIKE ${pattern}
             OR city    ILIKE ${pattern}
          )
        LIMIT 20;
    `;

    console.log(
        `[FUZZY_SEARCH] ILIKE fallback returned ${results.length} results for "${query}"`
    );
    return results;
}
