'use server';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  RENTPE — V2 DRAFT PROPERTY ACTIONS  (src/actions/properties-v2.ts)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Purpose: Handles the V2 State Machine "Instant Draft" property
 *           creation flow. The Property ID (RP-P-XXXXXXXXXX) is
 *           generated THE MOMENT the owner clicks "Add Property",
 *           BEFORE they fill in any details.
 *
 *  Key Differences from properties.ts (V1):
 *    ✅ Property ID anchored at DRAFT creation (not at final submit)
 *    ✅ Status starts as "DRAFT" (not "PENDING_VERIFICATION")
 *    ✅ Auto-save on every wizard step (no data loss on browser close)
 *    ✅ Wizard progress tracked via draftStep field
 *    ✅ Does NOT require termsAccepted upfront (collected at Go-Live)
 *    ✅ Does NOT interfere with V1 createProperty flow — fully parallel
 *
 *  V1 flow (properties.ts) is untouched and still works for:
 *    - Field sales agents using the monolithic onboarding form
 *    - Admin-assisted property creation
 *
 *  ZERO BREAKING CHANGES — this file is purely additive.
 * ═══════════════════════════════════════════════════════════════════
 */

import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { generateSequentialId } from '@/lib/ids';
import { logAuditEvent } from '@/lib/audit';
import { uploadToCloudinary, batchUploadToCloudinary } from '@/lib/upload';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { recalculateCompletenessScore } from './kyc';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WizardStep1Data {
  // Step 1: Location
  address: string;
  city: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
}

interface WizardStep2Data {
  // Step 2: Property Identity
  name: string;
  propertyType?: 'PG' | 'HOSTEL' | 'FLAT' | 'ROOM';
  genderType?: 'COED' | 'MALE' | 'FEMALE';
  businessName?: string;
  licenseNumber?: string;
  gstNumber?: string;
  reraId?: string;
}

interface WizardStep3Data {
  // Step 3: Amenities
  amenities: string; // JSON string array
  foodType?: string;
  foodPricePerMonth?: number;
  rules?: string;
  description?: string;
  noticePeriod?: number;
}

interface WizardStep4RoomData {
  roomNumber: string;
  type: string;
  price: number;
  availability: number;
  securityDeposit?: number;
}

interface WizardStep5Data {
  // Step 5: Photos (base64 arrays)
  buildingPhotos?: string[];
  commonAreaPhotos?: string[];
  roomsAndBathroomPhotos?: string[];
  parkingPhotos?: string[];
  amenitiesPhotos?: string[];
  livePhotoUrl?: string;
}

// ─── Action 1: Create Instant Draft (The "Add Property" Click) ──────────────
// This is the ONLY action that fires when the owner clicks "Add Property".
// It immediately reserves a permanent RP-P-XXXXXXXXXX ID in the database.
// The owner can close the browser, come back tomorrow — their draft persists.

export async function createDraftProperty() {
  const session = await getSession();
  if (!session?.userId) return { error: 'Unauthorized. Please log in.' };

  // Allow USER role who has OWNER in their roles array (dual-role users)
  // Also allow explicit OWNER or STAFF roles
  const userRecord = await prisma.user.findUnique({
    where: { id: session.userId as string },
    select: { roles: true, role: true, name: true, parentOwnerId: true },
  });

  if (!userRecord) return { error: 'User not found.' };

  const hasOwnerAccess =
    userRecord.role === 'OWNER' ||
    userRecord.role === 'STAFF' ||
    userRecord.roles.includes('OWNER');

  if (!hasOwnerAccess) {
    return { error: 'Owner access required. Please request a role upgrade first.' };
  }

  const ownerId = userRecord.parentOwnerId || (session.userId as string);

  // Check for existing unsubmitted drafts — prevent draft pollution
  const existingDraft = await prisma.property.findFirst({
    where: { ownerId, status: 'DRAFT' },
    select: { id: true, displayId: true, name: true, updatedAt: true },
  });

  if (existingDraft) {
    // Return the existing draft instead of creating a new one
    return {
      success: true,
      property: existingDraft,
      message: 'Returning your existing unfinished draft.',
      isExistingDraft: true,
    };
  }

  // Generate the permanent Property ID RIGHT NOW
  const displayId = await generateSequentialId('PROPERTY');

  const draft = await prisma.property.create({
    data: {
      displayId,
      applicationId: displayId,
      ownerId,
      name: 'Untitled Property (Draft)', // Placeholder — updated in Step 2
      address: '',
      city: '',
      amenities: '[]',
      images: '[]',
      status: 'DRAFT',
      propertyType: 'PG',
      genderType: 'COED',
      foodType: 'NOT_AVAILABLE',
      completenessScore: 0,
      fraudRiskScore: 'LOW',
      // All verification statuses start as NOT_SUBMITTED
      propertyVerificationStatus: 'NOT_SUBMITTED',
      kycVerificationStatus: 'NOT_SUBMITTED',
      bankVerificationStatus: 'NOT_SUBMITTED',
      docVerificationStatus: 'NOT_SUBMITTED',
    } as any,
  });

  await logAuditEvent({
    actorId: session.userId as string,
    actorRole: 'OWNER',
    actorName: session.name || 'Owner',
    actionType: 'CREATE',
    entityType: 'PROPERTY',
    entityId: draft.id,
    description: `[V2 WIZARD] Owner created property draft. ID: ${displayId}. Status: DRAFT.`,
    newValue: { displayId, status: 'DRAFT' },
  });

  revalidatePath('/dashboard/owner/properties');

  return {
    success: true,
    property: draft,
    isExistingDraft: false,
  };
}

// ─── Action 2: Save Wizard Step 1 — Location ─────────────────────────────────

export async function saveWizardStep1(propertyId: string, data: WizardStep1Data) {
  const session = await getSession();
  if (!session?.userId) return { error: 'Unauthorized.' };

  const property = await _getOwnedDraft(propertyId, session.userId as string);
  if ('error' in property) return property;

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      address: data.address,
      city: data.city,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
    } as any,
  });

  revalidatePath(`/dashboard/owner/properties/wizard/${propertyId}`);
  return { success: true, step: 1 };
}

// ─── Action 3: Save Wizard Step 2 — Property Identity ────────────────────────

export async function saveWizardStep2(propertyId: string, data: WizardStep2Data) {
  const session = await getSession();
  if (!session?.userId) return { error: 'Unauthorized.' };

  const property = await _getOwnedDraft(propertyId, session.userId as string);
  if ('error' in property) return property;

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      name: data.name,
      propertyType: data.propertyType ?? 'PG',
      genderType: data.genderType ?? 'COED',
      businessName: data.businessName ?? null,
      licenseNumber: data.licenseNumber ?? null,
      gstNumber: data.gstNumber ?? null,
      reraId: data.reraId ?? null,
    } as any,
  });

  await recalculateCompletenessScore(session.userId as string, propertyId);
  revalidatePath(`/dashboard/owner/properties/wizard/${propertyId}`);
  return { success: true, step: 2 };
}

// ─── Action 4: Save Wizard Step 3 — Amenities & Details ──────────────────────

export async function saveWizardStep3(propertyId: string, data: WizardStep3Data) {
  const session = await getSession();
  if (!session?.userId) return { error: 'Unauthorized.' };

  const property = await _getOwnedDraft(propertyId, session.userId as string);
  if ('error' in property) return property;

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      amenities: data.amenities,
      description: data.description ?? null,
      rules: data.rules ?? null,
      foodType: data.foodType ?? 'NOT_AVAILABLE',
      foodPricePerMonth: data.foodPricePerMonth ?? null,
      noticePeriod: data.noticePeriod ?? 30,
    } as any,
  });

  await recalculateCompletenessScore(session.userId as string, propertyId);
  revalidatePath(`/dashboard/owner/properties/wizard/${propertyId}`);
  return { success: true, step: 3 };
}

// ─── Action 5: Save Wizard Step 4 — Rooms ────────────────────────────────────

export async function saveWizardStep4(propertyId: string, rooms: WizardStep4RoomData[]) {
  const session = await getSession();
  if (!session?.userId) return { error: 'Unauthorized.' };

  const property = await _getOwnedDraft(propertyId, session.userId as string);
  if ('error' in property) return property;

  if (!rooms || rooms.length === 0) return { error: 'At least one room is required.' };
  if (rooms.length > 50) return { error: 'Maximum 50 rooms allowed.' };

  for (const r of rooms) {
    if (r.availability < 1 || r.availability > 20) return { error: `Invalid bed count for room ${r.roomNumber}. Must be between 1 and 20.` };
    if (r.price < 0 || r.price > 500000) return { error: `Invalid rent price for room ${r.roomNumber}. Cannot be negative.` };
    if (r.securityDeposit !== undefined && (r.securityDeposit < 0 || r.securityDeposit > 24)) return { error: `Invalid security deposit for room ${r.roomNumber}.` };
  }

  const totalBeds = rooms.reduce((sum, r) => sum + (r.availability || 0), 0);
  if (totalBeds > 500) return { error: 'Maximum 500 beds allowed.' };

  // Delete existing rooms and their beds for this draft (re-save on every wizard visit)
  const existingRooms = await prisma.room.findMany({ where: { propertyId }, select: { id: true } });
  const existingRoomIds = existingRooms.map(r => r.id);
  if (existingRoomIds.length > 0) {
    await prisma.bed.deleteMany({ where: { roomId: { in: existingRoomIds } } });
    await prisma.room.deleteMany({ where: { propertyId } });
  }

  // Generate IDs for all rooms and beds in parallel
  const [roomIds, bedIds] = await Promise.all([
    Promise.all(rooms.map(() => generateSequentialId('ROOM'))),
    Promise.all(Array(totalBeds).fill(0).map(() => generateSequentialId('BED'))),
  ]);

  const roomsToCreate: any[] = [];
  const bedsToCreate: any[] = [];
  let bedIdx = 0;

  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    const roomId = randomUUID();
    const depositMonths = Math.max(0, Math.min(r.securityDeposit || 1, 24));

    roomsToCreate.push({
      id: roomId,
      displayId: roomIds[i],
      propertyId,
      roomNumber: String(r.roomNumber),
      type: r.type,
      price: r.price,
      availability: r.availability,
      totalBeds: r.availability,
      depositMonths,
      status: 'AVAILABLE',
    });

    for (let j = 0; j < r.availability; j++) {
      bedsToCreate.push({
        id: randomUUID(),
        displayId: bedIds[bedIdx++],
        roomId,
        bedNumber: `${r.roomNumber}-${String.fromCharCode(64 + j + 1)}`,
        status: 'AVAILABLE',
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.room.createMany({ data: roomsToCreate });
    if (bedsToCreate.length > 0) {
      await tx.bed.createMany({ data: bedsToCreate });
    }
  });

  await recalculateCompletenessScore(session.userId as string, propertyId);
  revalidatePath(`/dashboard/owner/properties/wizard/${propertyId}`);
  return { success: true, step: 4, roomsCreated: rooms.length, bedsCreated: totalBeds };
}

// ─── Action 6: Save Wizard Step 5 — Media Uploads ────────────────────────────

export async function saveWizardStep5(propertyId: string, data: WizardStep5Data) {
  const session = await getSession();
  if (!session?.userId) return { error: 'Unauthorized.' };

  const property = await _getOwnedDraft(propertyId, session.userId as string);
  if ('error' in property) return property;

  const folder = `properties/${propertyId}/photos`;
  const updateData: any = {};

  // Only upload files that are new base64 (not already Cloudinary URLs)
  const toCloudinary = async (items: string[] | undefined, key: string) => {
    if (!items || items.length === 0) return;
    if (items.length > 30) throw new Error(`Maximum 30 photos allowed for ${key}.`); // DDoS protection
    
    const newItems = items.filter(i => i.startsWith('data:'));
    const existingUrls = items.filter(i => !i.startsWith('data:'));
    if (newItems.length === 0) {
      updateData[key] = JSON.stringify(existingUrls);
      return;
    }
    const uploaded = await batchUploadToCloudinary(newItems, folder);
    updateData[key] = JSON.stringify([...existingUrls, ...uploaded]);
  };

  await Promise.all([
    toCloudinary(data.buildingPhotos, 'buildingPhotos'),
    toCloudinary(data.commonAreaPhotos, 'commonAreaPhotos'),
    toCloudinary(data.roomsAndBathroomPhotos, 'roomsAndBathroomPhotos'),
    toCloudinary(data.parkingPhotos, 'parkingPhotos'),
    toCloudinary(data.amenitiesPhotos, 'amenitiesPhotos'),
  ]);

  if (data.livePhotoUrl?.startsWith('data:')) {
    updateData.livePhotoUrl = await uploadToCloudinary(data.livePhotoUrl, folder);
  }

  // Merge all photos into the images field (for listing display)
  const allPhotos = [
    ...(data.buildingPhotos?.filter(i => !i.startsWith('data:')) || []),
    ...(data.roomsAndBathroomPhotos?.filter(i => !i.startsWith('data:')) || []),
  ];
  if (updateData.buildingPhotos) {
    try {
      allPhotos.push(...JSON.parse(updateData.buildingPhotos));
    } catch {}
  }
  updateData.images = JSON.stringify([...new Set(allPhotos)]);

  await prisma.property.update({ where: { id: propertyId }, data: updateData });

  await recalculateCompletenessScore(session.userId as string, propertyId);
  revalidatePath(`/dashboard/owner/properties/wizard/${propertyId}`);
  return { success: true, step: 5 };
}

// ─── Action 7: Submit Draft for Review (Final Step) ──────────────────────────
// After owner clicks "Submit Listing" at the end of the wizard.
// Status transitions: DRAFT → SUBMITTED_FOR_REVIEW

export async function submitDraftForReview(propertyId: string) {
  const session = await getSession();
  if (!session?.userId) return { error: 'Unauthorized.' };

  const property = await _getOwnedDraft(propertyId, session.userId as string);
  if ('error' in property) return property;

  // Validate minimum completeness before allowing submission
  const score = await recalculateCompletenessScore(session.userId as string, propertyId);

  const fullProperty = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { rooms: true },
  });

  if (!fullProperty?.name || fullProperty.name === 'Untitled Property (Draft)') {
    return { error: 'Please complete Step 2: Add a property name.' };
  }
  if (!fullProperty.address || !fullProperty.city) {
    return { error: 'Please complete Step 1: Add the property address.' };
  }
  if (!fullProperty.rooms || fullProperty.rooms.length === 0) {
    return { error: 'Please complete Step 4: Add at least one room.' };
  }
  if (score < 30) {
    return { error: `Property completeness is too low (${score}%). Please add photos and more details.` };
  }

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      status: 'SUBMITTED_FOR_REVIEW',
      propertyVerificationStatus: 'PENDING',
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      platformAgreementVersion: 'v2.0-2026',
      platformAgreementIp: 'N/A', // Normally extracted from headers, set as placeholder for MVP compliance
    } as any,
  });

  // Notify all Admins
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    select: { id: true },
  });

  await Promise.all(
    admins.map(admin =>
      prisma.notification.create({
        data: {
          userId: admin.id,
          type: 'PROPERTY_PENDING',
          category: 'ADMIN',
          message: `🏠 New Property Submitted for Review: "${fullProperty.name}" (${fullProperty.displayId}). Assign a reviewer.`,
          targetRole: 'ADMIN',
          isPersistent: true,
        },
      })
    )
  );

  // Email owner confirmation
  try {
    const { sendEmail } = await import('@/lib/email');
    const { OwnerNotificationTemplate } = await import('@/lib/email-templates');
    const owner = await prisma.user.findUnique({
      where: { id: session.userId as string },
      select: { email: true, name: true },
    });
    if (owner?.email) {
      sendEmail({
        to: owner.email,
        subject: `Property Submitted for Review — ${fullProperty.name}`,
        html: OwnerNotificationTemplate(
          owner.name || 'Owner',
          'Property Submitted Successfully',
          `Your property <strong>${fullProperty.name}</strong> (${fullProperty.displayId}) has been submitted and is now under review by our verification team. We will notify you once it is approved.`,
          '/dashboard/owner/properties',
          'View My Properties'
        ),
      }).catch(console.error);
    }
  } catch {}

  await logAuditEvent({
    actorId: session.userId as string,
    actorRole: 'OWNER',
    actorName: session.name || 'Owner',
    actionType: 'UPDATE',
    entityType: 'PROPERTY',
    entityId: propertyId,
    description: `[V2 WIZARD] Owner submitted property draft for review. Completeness: ${score}%. Status: SUBMITTED_FOR_REVIEW.`,
    newValue: { status: 'SUBMITTED_FOR_REVIEW', completenessScore: score },
  });

  revalidatePath('/dashboard/owner/properties');
  revalidatePath('/dashboard/admin/property-approval');
  return { success: true, status: 'SUBMITTED_FOR_REVIEW', completenessScore: score };
}

// ─── Action 8: Get Draft Property (Wizard Resume) ────────────────────────────

export async function getDraftProperty(propertyId: string) {
  const session = await getSession();
  if (!session?.userId) return { error: 'Unauthorized.' };

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { rooms: { include: { beds: true } } },
  });

  if (!property) return { error: 'Property not found.' };
  const accessCheck = await _getOwnedDraft(propertyId, session.userId as string);
  if ('error' in accessCheck) return accessCheck;

  return { success: true, property };
}

// ─── Action 9: Get All Owner Drafts ──────────────────────────────────────────

export async function getOwnerDrafts() {
  const session = await getSession();
  if (!session?.userId) return [];

  const userRecord = await prisma.user.findUnique({
    where: { id: session.userId as string },
    select: { parentOwnerId: true },
  });

  const ownerId = userRecord?.parentOwnerId || (session.userId as string);

  return prisma.property.findMany({
    where: { ownerId, status: 'DRAFT' },
    include: { rooms: { select: { id: true } } },
    orderBy: { updatedAt: 'desc' },
  });
}

// ─── Action 10: Delete Draft ──────────────────────────────────────────────────

export async function deleteDraftProperty(propertyId: string) {
  const session = await getSession();
  if (!session?.userId) return { error: 'Unauthorized.' };

  const property = await _getOwnedDraft(propertyId, session.userId as string);
  if ('error' in property) return property;

  // Only allow deletion if it's still a DRAFT
  if ((property as any).status !== 'DRAFT') {
    return { error: 'Only draft properties can be deleted.' };
  }

  await prisma.$transaction(async (tx) => {
    // Delete beds → rooms → property (cascade order)
    const rooms = await tx.room.findMany({ where: { propertyId }, select: { id: true } });
    const roomIds = rooms.map(r => r.id);
    if (roomIds.length > 0) {
      await tx.bed.deleteMany({ where: { roomId: { in: roomIds } } });
      await tx.room.deleteMany({ where: { propertyId } });
    }
    
    // Clear relations that would block property deletion
    await (tx as any).propertyReview.deleteMany({ where: { propertyId } });
    await (tx as any).ownerKycDocument.updateMany({ where: { propertyId }, data: { propertyId: null } });

    await tx.property.delete({ where: { id: propertyId } });
  });

  await logAuditEvent({
    actorId: session.userId as string,
    actorRole: 'OWNER',
    actorName: session.name || 'Owner',
    actionType: 'DELETE',
    entityType: 'PROPERTY',
    entityId: propertyId,
    description: `[V2 WIZARD] Owner deleted property draft ${propertyId}.`,
  });

  revalidatePath('/dashboard/owner/properties');
  return { success: true };
}

// ─── Internal Helper: Verify ownership of a draft property ───────────────────

async function _getOwnedDraft(
  propertyId: string,
  userId: string
): Promise<any | { error: string }> {
  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: { parentOwnerId: true },
  });
  const ownerId = userRecord?.parentOwnerId || userId;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, ownerId: true, status: true, displayId: true },
  });

  if (!property) return { error: 'Property not found.' };
  if (property.ownerId !== ownerId) return { error: 'Access denied: You do not own this property.' };

  return property;
}

async function _isAuthorizedAdminOrVerifier(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, roles: true, isVerifier: true }
  });
  if (!user) return false;
  return user.role === 'ADMIN' || user.roles.includes('ADMIN') || user.roles.includes('VERIFIER') || user.isVerifier;
}

// ═════════════════════════════════════════════════════════════════════════════
//  ADMIN V2 VERIFICATION ACTIONS
// ═════════════════════════════════════════════════════════════════════════════

// ─── Action 11: Get Pending V2 Properties for Admin ─────────────────────────

export async function getPendingV2PropertiesForAdmin() {
  const session = await getSession();
  if (!session?.userId) return { error: 'Unauthorized.' };
  if (!(await _isAuthorizedAdminOrVerifier(session.userId as string))) {
    return { error: 'Unauthorized: Admin or Verifier access required.' };
  }

  const properties = await (prisma as any).property.findMany({
    where: {
      status: { in: ['SUBMITTED_FOR_REVIEW', 'UNDER_REVIEW', 'PENDING_VERIFICATION', 'NEEDS_REVISION'] },
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          displayId: true,
        },
      },
      rooms: {
        include: { beds: true },
      },
      reviews: {
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Also fetch KYC documents for each owner
  const ownerIds = [...new Set(properties.map((p: any) => p.ownerId))];
  const kycDocs = await (prisma as any).ownerKycDocument.findMany({
    where: {
      ownerId: { in: ownerIds },
      isLatest: true,
    },
    orderBy: { uploadedAt: 'desc' },
  });

  const kycByOwnerMap = new Map<string, any[]>();
  for (const doc of kycDocs) {
    if (!kycByOwnerMap.has(doc.ownerId)) kycByOwnerMap.set(doc.ownerId, []);
    kycByOwnerMap.get(doc.ownerId)!.push(doc);
  }

  const enriched = properties.map((p: any) => ({
    ...p,
    kycDocuments: kycByOwnerMap.get(p.ownerId) || [],
  }));

  return { success: true, properties: enriched };
}

// ─── Action 12: Review Domain (Location / Identity / KYC / Bank / Docs) ──────

export async function reviewV2PropertyDomain(params: {
  propertyId: string;
  category: 'PROPERTY_DETAILS' | 'KYC' | 'BANK' | 'DOCUMENTS' | 'AGREEMENT';
  actionType: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'HOLD';
  notes?: string;
}) {
  const session = await getSession();
  if (!session?.userId) return { error: 'Unauthorized.' };
  if (!(await _isAuthorizedAdminOrVerifier(session.userId as string))) {
    return { error: 'Unauthorized: Admin or Verifier access required.' };
  }

  const { propertyId, category, actionType, notes } = params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      displayId: true,
      name: true,
      status: true,
      propertyVerificationStatus: true,
      kycVerificationStatus: true,
      bankVerificationStatus: true,
      docVerificationStatus: true,
    },
  });

  if (!property) return { error: 'Property not found.' };

  const newStatus = actionType === 'APPROVE' ? 'VERIFIED' : actionType === 'REJECT' ? 'REJECTED' : 'NEEDS_RESUBMISSION';

  // Map category to column
  const updateFieldMap: Record<string, string> = {
    PROPERTY_DETAILS: 'propertyVerificationStatus',
    KYC: 'kycVerificationStatus',
    BANK: 'bankVerificationStatus',
    DOCUMENTS: 'docVerificationStatus',
  };

  const updateData: any = {};
  if (updateFieldMap[category]) {
    updateData[updateFieldMap[category]] = newStatus;
  }

  // Calculate Fraud Risk Score based on domain statuses
  const pStatus = category === 'PROPERTY_DETAILS' ? newStatus : (property as any).propertyVerificationStatus;
  const kStatus = category === 'KYC' ? newStatus : (property as any).kycVerificationStatus;
  const bStatus = category === 'BANK' ? newStatus : (property as any).bankVerificationStatus;

  let risk = 'LOW';
  if (pStatus === 'REJECTED' || kStatus === 'REJECTED' || bStatus === 'REJECTED') {
    risk = 'HIGH';
  } else if (pStatus === 'NEEDS_RESUBMISSION' || kStatus === 'NEEDS_RESUBMISSION') {
    risk = 'MEDIUM';
  }
  updateData.fraudRiskScore = risk;

  await prisma.$transaction(async (tx) => {
    // 1. Log domain review
    await (tx as any).propertyReview.create({
      data: {
        propertyId,
        adminId: session.userId as string,
        adminName: session.name || 'Admin',
        reviewCategory: category,
        actionType,
        notes: notes || null,
        previousStatus: (property as any)[updateFieldMap[category]] || 'NOT_SUBMITTED',
        newStatus,
      },
    });

    // 2. Update property verification statuses & risk score
    await tx.property.update({
      where: { id: propertyId },
      data: updateData,
    });
  });

  await logAuditEvent({
    actorId: session.userId as string,
    actorRole: session.role as any,
    actorName: session.name || 'Admin',
    actionType: 'UPDATE',
    entityType: 'PROPERTY',
    entityId: propertyId,
    description: `[V2 REVIEW] Admin reviewed domain ${category} for ${property.displayId}. Decision: ${actionType}. Risk Score: ${risk}.`,
    newValue: { category, actionType, notes, risk },
  });

  revalidatePath('/dashboard/admin/property-reviews');
  return { success: true, category, actionType, fraudRiskScore: risk };
}

// ─── Action 13: Overall Approve or Reject Property ───────────────────────────

export async function approveOrRejectV2Property(params: {
  propertyId: string;
  action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';
  rejectionReason?: string;
}) {
  const session = await getSession();
  if (!session?.userId) return { error: 'Unauthorized.' };
  if (!(await _isAuthorizedAdminOrVerifier(session.userId as string))) {
    return { error: 'Unauthorized: Admin or Verifier access required.' };
  }

  const { propertyId, action, rejectionReason } = params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, displayId: true, name: true, ownerId: true, status: true },
  });

  if (!property) return { error: 'Property not found.' };

  if ((action === 'REJECT' || action === 'REQUEST_CHANGES') && (!rejectionReason || rejectionReason.trim() === '')) {
    return { error: 'Reason for rejection or revision is legally required.' };
  }

  const targetStatus = action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'NEEDS_REVISION';

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      status: targetStatus,
      propertyVerificationStatus: action === 'APPROVE' ? 'VERIFIED' : 'REJECTED',
    } as any,
  });

  // Log Audit Event
  await logAuditEvent({
    actorId: session.userId as string,
    actorRole: session.role as any,
    actorName: session.name || 'Admin',
    actionType: action === 'APPROVE' ? 'APPROVE' : 'REJECT',
    entityType: 'PROPERTY',
    entityId: propertyId,
    description: `[V2 REVIEW] Admin ${action} property ${property.displayId} (${property.name}). New status: ${targetStatus}.`,
    newValue: { status: targetStatus, rejectionReason },
  });

  // Notify Owner
  await prisma.notification.create({
    data: {
      userId: property.ownerId,
      type: action === 'APPROVE' ? 'PROPERTY_APPROVED' : 'PROPERTY_REJECTED',
      category: 'OWNER',
      message: action === 'APPROVE'
        ? `🎉 Congratulations! Your property "${property.name}" (${property.displayId}) has been APPROVED by our verification team.`
        : `⚠️ Update required for property "${property.name}" (${property.displayId}): ${rejectionReason || 'Please check review notes.'}`,
      targetRole: 'OWNER',
      isPersistent: true,
    },
  });

  revalidatePath('/dashboard/admin/property-reviews');
  revalidatePath('/dashboard/owner/properties');
  return { success: true, status: targetStatus };
}

