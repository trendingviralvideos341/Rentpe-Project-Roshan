'use server';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  RENTPE — V2 OWNER KYC ACTIONS  (src/actions/kyc.ts)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Purpose: Handles DECOUPLED owner identity document management.
 *           This is independent of the OwnerOnboarding (field-sales)
 *           and the monolithic Property submission flow.
 *
 *  Legal Basis:
 *    - DPDP Act 2023: Documents can be purged without touching financials.
 *    - IT Act 2000 S.10A: OTP + IP + timestamp = legally valid digital acceptance.
 *    - UIDAI: Aadhaar must only store masked form (first 8 digits as XXXX XXXX).
 *    - RBI KYC: PAN must be verified via NSDL API (future — manual review for MVP).
 *
 *  Document Versioning:
 *    - Re-uploading a document NEVER overwrites the old one.
 *    - Version number increments per (ownerId, docType) combination.
 *    - Old versions are marked isLatest=false, retained for audit trail.
 *
 *  Security:
 *    - File size enforced <= 5MB
 *    - Magic number validation (PDF: 25504446, Images: ffd8ff, 89504e47, etc.)
 *    - Files stored in private Cloudinary folders — never public
 *    - Signed URLs generated on-demand with 15 min expiry
 * ═══════════════════════════════════════════════════════════════════
 */

import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { uploadToCloudinary } from '@/lib/upload';
import { generateSequentialId } from '@/lib/ids';
import { logAuditEvent } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

// ─── Constants ───────────────────────────────────────────────────────────────

const ALLOWED_DOC_TYPES = [
  'PAN',
  'AADHAAR',
  'CANCELLED_CHEQUE',
  'ADDRESS_PROOF',   // Electricity / Water / Property Tax / Rent Agreement / Sale Deed / Society Letter
  'GST_CERT',
  'PG_LICENSE',
  'FIRE_SAFETY',
  'OTHER',
] as const;

type DocType = typeof ALLOWED_DOC_TYPES[number];

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Magic number signatures for allowed file types
// These are checked BEFORE uploading to Cloudinary
const MAGIC_NUMBERS: Record<string, string[]> = {
  'application/pdf': ['25504446'],               // %PDF
  'image/jpeg':      ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2', 'ffd8ffdb', 'ffd8ffee'],
  'image/png':       ['89504e47'],               // ‰PNG
  'image/webp':      ['52494646'],               // RIFF (WebP)
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Validates base64 file string for:
 * 1. Size (<= 5MB)
 * 2. Magic number (file header matches declared MIME type)
 */
function validateBase64File(
  base64: string,
  declaredMimeType: string
): { valid: boolean; error?: string } {
  // Strip data URI prefix to get raw base64
  const raw = base64.replace(/^data:[^;]+;base64,/, '');
  const bytes = Buffer.from(raw, 'base64');

  // Size check
  if (bytes.length > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File too large. Maximum allowed size is 5MB (received ${(bytes.length / 1024 / 1024).toFixed(2)}MB).` };
  }

  // Magic number check
  const allowedMagics = MAGIC_NUMBERS[declaredMimeType];
  if (!allowedMagics) {
    return { valid: false, error: `File type "${declaredMimeType}" is not allowed. Upload PDF or image files only.` };
  }

  const headerHex = bytes.slice(0, 4).toString('hex').toLowerCase();
  const matches = allowedMagics.some(magic => headerHex.startsWith(magic));
  if (!matches) {
    return {
      valid: false,
      error: `File content does not match the declared type "${declaredMimeType}". Potential malicious upload blocked.`,
    };
  }

  return { valid: true };
}

// ─── Action 1: Upload Owner KYC Document ─────────────────────────────────────

export async function uploadOwnerKycDocument(data: {
  docType: DocType;
  fileBase64: string;  // Full data URI including prefix
  fileName: string;
  mimeType: string;
  propertyId?: string; // Optional: link to a specific property
}) {
  const session = await getSession();
  if (!session?.userId) return { error: 'Unauthorized. Please log in.' };

  // Validate doc type
  if (!ALLOWED_DOC_TYPES.includes(data.docType)) {
    return { error: `Invalid document type: "${data.docType}".` };
  }

  // Security: validate file
  const validation = validateBase64File(data.fileBase64, data.mimeType);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const ownerId = session.userId as string;

  // Mark all existing versions of this docType as not latest
  await prisma.ownerKycDocument.updateMany({
    where: { ownerId, docType: data.docType, isLatest: true },
    data: { isLatest: false },
  });

  // Get the next version number for this (ownerId, docType)
  const existingCount = await prisma.ownerKycDocument.count({
    where: { ownerId, docType: data.docType },
  });
  const nextVersion = existingCount + 1;

  // Generate unique display ID: RP-K-XXXXXXXX
  const displayId = await generateSequentialId('KYC');

  // Upload to Cloudinary in a PRIVATE, owner-specific folder
  const folder = `owner-kyc/${ownerId}/${data.docType.toLowerCase()}`;
  let fileUrl: string;
  try {
    fileUrl = await uploadToCloudinary(data.fileBase64, folder, true); // true = private
  } catch (err) {
    console.error('[KYC Upload] Cloudinary error:', err);
    return { error: 'Document upload failed. Please try again.' };
  }

  // Create the KYC document record
  const kycDoc = await prisma.ownerKycDocument.create({
    data: {
      displayId,
      ownerId,
      propertyId: data.propertyId ?? null,
      docType: data.docType,
      fileUrl,
      fileName: data.fileName,
      fileSize: Buffer.from(data.fileBase64.replace(/^data:[^;]+;base64,/, ''), 'base64').length,
      mimeType: data.mimeType,
      version: nextVersion,
      isLatest: true,
      status: 'PENDING',
    },
  });

  // Update property's KYC verification status to PENDING
  if (data.propertyId) {
    await prisma.property.update({
      where: { id: data.propertyId },
      data: { kycVerificationStatus: 'PENDING' },
    });
  }

  // Recalculate completeness score
  await recalculateCompletenessScore(ownerId, data.propertyId);

  // Audit log
  await logAuditEvent({
    actorId: ownerId,
    actorRole: 'OWNER',
    actorName: session.name || 'Owner',
    actionType: 'CREATE',
    entityType: 'OWNER_KYC_DOCUMENT',
    entityId: kycDoc.id,
    description: `Owner uploaded ${data.docType} document (v${nextVersion}). ID: ${displayId}.`,
    newValue: { displayId, docType: data.docType, version: nextVersion, status: 'PENDING' },
  });

  revalidatePath('/dashboard/owner/kyc');
  revalidatePath('/dashboard/admin/owner-kyc');

  return { success: true, document: kycDoc };
}

// ─── Action 2: Get My KYC Documents (Owner) ──────────────────────────────────

export async function getMyKycDocuments(propertyId?: string) {
  const session = await getSession();
  if (!session?.userId) return { error: 'Unauthorized.' };

  const ownerId = session.userId as string;

  const docs = await prisma.ownerKycDocument.findMany({
    where: {
      ownerId,
      isLatest: true,       // Only show latest version of each doc type
      purgedAt: null,        // Don't show purged docs
      ...(propertyId ? { propertyId } : {}),
    },
    orderBy: { uploadedAt: 'desc' },
  });

  return { success: true, documents: docs };
}

// ─── Action 3: Get KYC Documents for Admin Review ────────────────────────────

export async function getOwnerKycDocumentsForAdmin(ownerId: string) {
  const session = await getSession();
  if (!session?.userId) throw new Error('Unauthorized');

  const admin = await prisma.user.findUnique({
    where: { id: session.userId as string },
    select: { roles: true, role: true },
  });

  const isAdmin =
    admin?.roles.includes('ADMIN') ||
    admin?.roles.includes('VERIFIER') ||
    admin?.role === 'ADMIN';

  if (!isAdmin) throw new Error('Unauthorized: Admin or Verifier access required.');

  // Return ALL versions (not just latest) so admin sees the full history
  const docs = await prisma.ownerKycDocument.findMany({
    where: { ownerId, purgedAt: null },
    orderBy: [{ docType: 'asc' }, { version: 'desc' }],
  });

  return docs;
}

// ─── Action 4: Admin Verify/Reject a KYC Document ────────────────────────────

export async function adminReviewKycDocument(
  kycDocId: string,
  decision: 'VERIFIED' | 'REJECTED' | 'NEEDS_RESUBMISSION',
  {
    notes,
    propertyId,
    reviewCategory,
  }: {
    notes?: string;
    propertyId?: string;
    reviewCategory?: 'KYC' | 'BANK' | 'DOCUMENTS';
  }
) {
  const session = await getSession();
  if (!session?.userId) throw new Error('Unauthorized');

  const admin = await prisma.user.findUnique({
    where: { id: session.userId as string },
    select: { roles: true, role: true, name: true },
  });

  const isAdmin =
    admin?.roles.includes('ADMIN') ||
    admin?.roles.includes('VERIFIER') ||
    admin?.role === 'ADMIN';

  if (!isAdmin) throw new Error('Unauthorized: Admin or Verifier access required.');

  const doc = await prisma.ownerKycDocument.findUnique({ where: { id: kycDocId } });
  if (!doc) return { error: 'Document not found.' };

  if (decision === 'REJECTED' && !notes) {
    return { error: 'Rejection reason is required.' };
  }

  const updated = await prisma.ownerKycDocument.update({
    where: { id: kycDocId },
    data: {
      status: decision,
      rejectedReason: decision === 'REJECTED' ? notes : null,
      verifiedBy: session.userId as string,
      verifiedAt: new Date(),
    },
  });

  // Update the granular verification status on the Property model
  if (propertyId) {
    const statusField = reviewCategory === 'BANK'
      ? 'bankVerificationStatus'
      : reviewCategory === 'DOCUMENTS'
      ? 'docVerificationStatus'
      : 'kycVerificationStatus';

    const newStatus =
      decision === 'VERIFIED' ? 'APPROVED' :
      decision === 'REJECTED' ? 'REJECTED' :
      'NEEDS_RESUBMISSION';

    const previousProperty = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { kycVerificationStatus: true, bankVerificationStatus: true, docVerificationStatus: true },
    });

    await prisma.property.update({
      where: { id: propertyId },
      data: { [statusField]: newStatus },
    });

    // Write to PropertyReview audit trail
    await (prisma as any).propertyReview.create({
      data: {
        propertyId,
        adminId: session.userId as string,
        adminName: admin?.name || 'Admin',
        reviewCategory: reviewCategory || 'KYC',
        actionType: decision === 'VERIFIED' ? 'APPROVE' : decision === 'REJECTED' ? 'REJECT' : 'REQUEST_CHANGES',
        notes: notes || null,
        previousStatus: (previousProperty as any)?.[statusField] ?? 'NOT_SUBMITTED',
        newStatus,
      },
    });

    // Recalculate completeness
    await recalculateCompletenessScore(doc.ownerId, propertyId);
  }

  // Audit log
  await logAuditEvent({
    actorId: session.userId as string,
    actorRole: 'ADMIN',
    actorName: admin?.name || 'Admin',
    actionType: 'UPDATE',
    entityType: 'OWNER_KYC_DOCUMENT',
    entityId: kycDocId,
    description: `Admin ${decision} KYC document ${doc.displayId} (${doc.docType}). ${notes ? `Reason: ${notes}` : ''}`,
    newValue: { status: decision, notes },
  });

  revalidatePath('/dashboard/admin/owner-kyc');
  revalidatePath('/dashboard/owner/kyc');

  return { success: true, document: updated };
}

// ─── Action 5: Recalculate Property Completeness Score ───────────────────────
// Called after every document upload, verification, payment, or agreement acceptance.
// Score breakdown (100 points total):
//   Property Name + Address + City        = 10 pts
//   Description                           =  5 pts
//   Amenities (at least 1)                =  5 pts
//   Property Photos (at least 3)          = 10 pts
//   Room(s) Added                         = 10 pts
//   KYC — PAN uploaded                    = 10 pts
//   KYC — Address Proof uploaded          = 10 pts
//   Bank Details (Cancelled Cheque)       = 10 pts
//   Terms Accepted                        = 10 pts
//   Onboarding Fee Paid                   = 10 pts
// ─────────────────────────────────────────────────────────────────────────────

export async function recalculateCompletenessScore(
  ownerId: string,
  propertyId?: string
): Promise<number> {
  if (!propertyId) return 0;

  const [property, rooms, kycDocs] = await Promise.all([
    prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        name: true,
        address: true,
        city: true,
        description: true,
        amenities: true,
        images: true,
        termsAccepted: true,
        onboardingPaidAt: true,
      },
    }),
    prisma.room.count({ where: { propertyId } }),
    prisma.ownerKycDocument.findMany({
      where: { ownerId, isLatest: true, purgedAt: null },
      select: { docType: true },
    }),
  ]);

  if (!property) return 0;

  let score = 0;

  // Property basics (10 pts)
  if (property.name && property.address && property.city) score += 10;

  // Description (5 pts)
  if (property.description && property.description.length > 20) score += 5;

  // Amenities (5 pts)
  try {
    const amenities = JSON.parse(property.amenities || '[]');
    if (Array.isArray(amenities) && amenities.length > 0) score += 5;
  } catch {}

  // Photos (10 pts — at least 3)
  try {
    const images = JSON.parse(property.images || '[]');
    if (Array.isArray(images) && images.length >= 3) score += 10;
    else if (Array.isArray(images) && images.length > 0) score += 5;
  } catch {}

  // Rooms added (10 pts)
  if (rooms > 0) score += 10;

  // KYC docs (10 pts each)
  const docTypes = kycDocs.map(d => d.docType);
  if (docTypes.includes('PAN')) score += 10;
  if (docTypes.includes('ADDRESS_PROOF') || docTypes.includes('CANCELLED_CHEQUE')) score += 10;
  if (docTypes.includes('CANCELLED_CHEQUE')) score += 10;

  // Terms accepted (10 pts)
  if (property.termsAccepted) score += 10;

  // Payment done (10 pts)
  if (property.onboardingPaidAt) score += 10;

  // Cap at 100
  score = Math.min(score, 100);

  // Write score to DB
  await prisma.property.update({
    where: { id: propertyId },
    data: { completenessScore: score },
  });

  return score;
}

// ─── Action 6: DPDP Purge Request (Right to Erasure) ─────────────────────────
// Under DPDP Act 2023, owners can request deletion of their KYC documents.
// We SOFT DELETE — nullifying fileUrl but keeping the record for audit.
// Financial records (invoices, payments) are retained for 7 years (IT Act).

export async function requestKycPurge(kycDocId: string) {
  const session = await getSession();
  if (!session?.userId) return { error: 'Unauthorized.' };

  const ownerId = session.userId as string;

  const doc = await prisma.ownerKycDocument.findFirst({
    where: { id: kycDocId, ownerId },
  });

  if (!doc) return { error: 'Document not found or you do not have permission.' };

  await prisma.ownerKycDocument.update({
    where: { id: kycDocId },
    data: {
      fileUrl: '[PURGED_DPDP_REQUEST]',
      purgedAt: new Date(),
      purgedBy: ownerId,
      status: 'REJECTED', // Marks as inactive
    },
  });

  await logAuditEvent({
    actorId: ownerId,
    actorRole: 'OWNER',
    actorName: session.name || 'Owner',
    actionType: 'DELETE',
    entityType: 'OWNER_KYC_DOCUMENT',
    entityId: kycDocId,
    description: `Owner invoked DPDP erasure right for KYC document ${doc.displayId} (${doc.docType}).`,
  });

  revalidatePath('/dashboard/owner/kyc');
  return { success: true };
}
