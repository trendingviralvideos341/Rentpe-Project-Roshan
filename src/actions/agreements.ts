'use server';

import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { logAuditEvent } from '@/lib/audit';
import { generateSequentialId } from '@/lib/ids';
import { NotificationService } from '@/lib/notifications';
import { jsPDF } from 'jspdf';
import cloudinary from '@/lib/cloudinary';

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED TYPES (consumed by page.tsx and other components)
// ─────────────────────────────────────────────────────────────────────────────

export type AgreementStatus =
  | 'PENDING_TENANT_VERIFICATION'
  | 'TENANT_VERIFIED'
  | 'PENDING_COUNTER_SIGN'
  | 'SIGNER_VERIFIED'
  | 'AGREEMENT_READY_FOR_DOWNLOAD'
  | 'PENDING_SIGNED_UPLOAD'
  | 'AGREEMENT_COMPLETED'
  | 'TERMINATED';

export interface AgreementRecord {
  id: string;
  displayId: string;
  bookingId: string;
  bookingDisplayId: string;
  propertyId: string;
  propertyName: string;
  roomId: string | null;
  roomNumber: string | null;
  bedId: string | null;
  tenantId: string;
  tenantName: string;
  tenantDisplayId: string;
  ownerId: string;
  ownerName: string;
  ownerDisplayId: string;
  signerUserId: string | null;
  status: AgreementStatus;
  tenantVerified: boolean;
  tenantVerifiedAt: Date | null;
  tenantVerifiedEmail: string | null;
  tenantVerifiedIp: string | null;
  tenantVerifiedDevice: string | null;
  tenantFinalAccepted: boolean;
  tenantFinalAcceptedAt: Date | null;
  signerType: string | null;
  signerName: string | null;
  signerDesignation: string | null;
  signerEmail: string | null;
  signerVerified: boolean;
  signerVerifiedAt: Date | null;
  signerVerifiedIp: string | null;
  signerVerifiedDevice: string | null;
  monthlyRent: number;
  securityDeposit: number;
  maintenanceCharges: number;
  electricityType: string | null;
  electricityFlat: number | null;
  foodCharges: number;
  wifiIncluded: boolean;
  lockInDays: number;
  noticePeriodDays: number;
  rentDueDay: number;
  lateFeePerDay: number;
  gracePeriodDays: number;
  overstayPenaltyMultiplier: number;
  agreementPdfUrl: string | null;
  agreementPdfGeneratedAt: Date | null;
  downloadedAt: Date | null;
  signedPdfUrl: string | null;
  signedPdfUploadedAt: Date | null;
  signedPdfUploadedBy: string | null;
  moveInNotes: string | null;
  inventorySnapshot: string | null;
  policeVerificationDone: boolean;
  policeVerificationNotes: string | null;
  terminatedAt: Date | null;
  terminatedBy: string | null;
  terminationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error('You must be logged in to perform this action.');
  return session;
}

async function getAgreementOrThrow(agreementId: string) {
  const agreement = await (prisma as any).agreement.findUnique({
    where: { id: agreementId },
  });
  if (!agreement) throw new Error('Agreement not found.');
  return agreement;
}

/**
 * Determine signer authorization.
 * Returns { authorized: boolean; signerType: 'OWNER' | 'MANAGER'; staffMember?: any }
 */
async function resolveSignerAuth(
  agreement: any,
  sessionUserId: string,
): Promise<{ authorized: boolean; signerType: 'OWNER' | 'MANAGER'; staffMember?: any }> {
  // Owner is always authorized
  if (sessionUserId === agreement.ownerId) {
    return { authorized: true, signerType: 'OWNER' };
  }
  // Manager: find OwnerStaffMember record
  const staffMember = await (prisma as any).ownerStaffMember.findFirst({
    where: {
      userId: sessionUserId,
      ownerId: agreement.ownerId,
      canExecuteAgreements: true,
    },
  });
  if (staffMember) {
    return { authorized: true, signerType: 'MANAGER', staffMember };
  }
  return { authorized: false, signerType: 'OWNER' };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CREATE AGREEMENT
// ─────────────────────────────────────────────────────────────────────────────

export async function createAgreement(bookingId: string) {
  const session = await requireSession();
  if (session.role !== 'OWNER' && session.role !== 'ADMIN') {
    throw new Error('Only owners or admins can create agreements.');
  }

  // Check no existing agreement for this booking
  const existing = await (prisma as any).agreement.findUnique({
    where: { bookingId },
  });
  if (existing) {
    throw new Error('An agreement already exists for this booking.');
  }

  // Fetch booking with all relations
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      property: {
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
      },
      room: { select: { id: true, roomNumber: true, type: true, displayId: true } },
      user: { select: { id: true, name: true, email: true, phone: true, displayId: true } },
    },
  });

  if (!booking) throw new Error('Booking not found.');
  if (!booking.property) throw new Error('Property not found for this booking.');

  const property = booking.property;

  // Parse amenities JSON for maintenance and wifi
  let amenitiesArr: string[] = [];
  try {
    const parsed = JSON.parse(property.amenities || '[]');
    amenitiesArr = Array.isArray(parsed) ? parsed.map((a: any) => (typeof a === 'string' ? a.toLowerCase() : '')) : [];
  } catch {
    amenitiesArr = [];
  }

  const maintenanceCharges = 0; // No dedicated field — default 0
  const wifiIncluded = amenitiesArr.some((a) => a.includes('wifi') || a.includes('wi-fi'));

  const displayId = await generateSequentialId('AGREEMENT');

  const agreement = await (prisma as any).agreement.create({
    data: {
      displayId,
      bookingId,
      propertyId: booking.propertyId || property.id,
      roomId: booking.roomId || null,
      bedId: null,
      tenantId: booking.userId,
      ownerId: property.ownerId,
      status: 'PENDING_TENANT_VERIFICATION',
      // Financial snapshot
      monthlyRent: booking.amount,
      securityDeposit: (booking as any).depositAmount || 0,
      maintenanceCharges,
      foodCharges: (booking as any).foodPriceApplied || 0,
      wifiIncluded,
      lockInDays: property.noticePeriod || 30,
      noticePeriodDays: property.noticePeriod || 30,
      rentDueDay: 7,
      lateFeePerDay: 0,
      gracePeriodDays: 5,
      overstayPenaltyMultiplier: 2,
    },
  });

  // Notify tenant
  await NotificationService.trigger({
    bookingId,
    userId: booking.userId,
    type: 'BOOKING',
    category: 'AGREEMENT_CREATED',
    message: 'Your Leave & License Agreement is ready. Please verify your identity to proceed.',
    targetRole: 'USER',
    actionUrl: '/dashboard/student',
    actionLabel: 'View Agreement',
    isPersistent: true,
  });

  logAuditEvent({
    actorId: session.userId,
    actorRole: session.role as string,
    actorName: session.name || 'Owner',
    actionType: 'CREATE',
    entityType: 'AGREEMENT',
    entityId: agreement.id,
    entityName: displayId,
    description: `Agreement ${displayId} created for booking ${booking.displayId} (Tenant: ${booking.user?.name || booking.userId})`,
    newValue: { displayId, bookingId, status: 'PENDING_TENANT_VERIFICATION' },
  });

  revalidatePath('/dashboard/student');
  revalidatePath('/dashboard/owner/agreements');

  return agreement;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SEND TENANT OTP (mock)
// ─────────────────────────────────────────────────────────────────────────────

export async function sendTenantAgreementOTP(
  agreementId: string,
): Promise<{ success: boolean; message: string; maskedEmail: string }> {
  const session = await requireSession();
  const agreement = await getAgreementOrThrow(agreementId);

  if (session.userId !== agreement.tenantId) {
    throw new Error('You are not authorized to request OTP for this agreement.');
  }

  // Fetch tenant email for masking
  const tenantUser = await prisma.user.findUnique({
    where: { id: agreement.tenantId },
    select: { email: true },
  });

  // Mask email: show first 2 chars + *** + @domain
  const email = tenantUser?.email || session.email || '';
  let maskedEmail = email;
  if (email.includes('@')) {
    const [localPart, domain] = email.split('@');
    const visible = localPart.substring(0, Math.min(2, localPart.length));
    maskedEmail = `${visible}***@${domain}`;
  }

  console.log(`[MOCK OTP] Tenant OTP for agreement ${agreementId} — use 123456`);

  logAuditEvent({
    actorId: session.userId,
    actorRole: session.role as string,
    actorName: session.name || 'Tenant',
    actionType: 'CREATE',
    entityType: 'AGREEMENT',
    entityId: agreementId,
    description: `Tenant OTP sent (mock) for agreement ${agreement.displayId}`,
  });

  return { success: true, message: 'OTP sent (mock: use 123456)', maskedEmail };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. VERIFY TENANT OTP
// ─────────────────────────────────────────────────────────────────────────────

export async function verifyTenantAgreementOTP(agreementId: string, otp: string) {
  const session = await requireSession();
  const agreement = await getAgreementOrThrow(agreementId);

  if (session.userId !== agreement.tenantId) {
    throw new Error('You are not authorized to verify this agreement.');
  }
  if (agreement.status !== 'PENDING_TENANT_VERIFICATION') {
    throw new Error('Agreement is not in the correct state for tenant verification.');
  }
  if (otp.trim() !== '123456') {
    throw new Error('Invalid OTP. Use 123456 in test mode.');
  }

  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
  const userAgent = headersList.get('user-agent') || 'unknown';

  // Fetch tenant email
  const tenant = await prisma.user.findUnique({
    where: { id: agreement.tenantId },
    select: { email: true },
  });

  await (prisma as any).agreement.update({
    where: { id: agreementId },
    data: {
      tenantVerified: true,
      tenantVerifiedAt: new Date(),
      tenantVerifiedEmail: tenant?.email || null,
      tenantVerifiedIp: ip,
      tenantVerifiedDevice: userAgent,
      status: 'TENANT_VERIFIED',
    },
  });

  // Notify property owner
  await NotificationService.trigger({
    bookingId: agreement.bookingId,
    userId: agreement.ownerId,
    type: 'BOOKING',
    category: 'AGREEMENT_TENANT_VERIFIED',
    message: 'Tenant has verified the agreement. Please counter-sign to proceed.',
    targetRole: 'OWNER',
    actionUrl: '/dashboard/owner/agreements',
    actionLabel: 'Counter-Sign Agreement',
    isPersistent: true,
  });

  logAuditEvent({
    actorId: session.userId,
    actorRole: session.role as string,
    actorName: session.name || 'Tenant',
    actionType: 'UPDATE',
    entityType: 'AGREEMENT',
    entityId: agreementId,
    description: `Tenant verified agreement ${agreement.displayId} via OTP. IP: ${ip}`,
    newValue: { status: 'TENANT_VERIFIED', tenantVerifiedAt: new Date() },
  });

  revalidatePath('/dashboard/student');
  revalidatePath('/dashboard/owner/agreements');

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SEND SIGNER OTP (mock)
// ─────────────────────────────────────────────────────────────────────────────

export async function sendSignerAgreementOTP(agreementId: string) {
  const session = await requireSession();
  const agreement = await getAgreementOrThrow(agreementId);

  if (agreement.status !== 'TENANT_VERIFIED') {
    throw new Error('Agreement must be tenant-verified before signer OTP can be sent.');
  }

  const { authorized, signerType, staffMember } = await resolveSignerAuth(agreement, session.userId);

  if (!authorized) {
    logAuditEvent({
      actorId: session.userId,
      actorRole: session.role as string,
      actorName: session.name || 'Unknown',
      actionType: 'OVERRIDE',
      entityType: 'AGREEMENT',
      entityId: agreementId,
      description: `UNAUTHORIZED signer OTP attempt on agreement ${agreement.displayId} by user ${session.userId}`,
    });
    throw new Error('Not authorized to execute agreements for this property.');
  }

  console.log(`[MOCK OTP] Signer OTP for agreement ${agreementId} — use 123456`);

  // Advance status to PENDING_COUNTER_SIGN
  await (prisma as any).agreement.update({
    where: { id: agreementId },
    data: { status: 'PENDING_COUNTER_SIGN' },
  });

  const actionType = signerType === 'OWNER' ? 'OWNER_OTP_SENT' : 'MANAGER_OTP_SENT';
  logAuditEvent({
    actorId: session.userId,
    actorRole: session.role as string,
    actorName: session.name || signerType,
    actionType: 'CREATE',
    entityType: 'AGREEMENT',
    entityId: agreementId,
    description: `${actionType}: Signer OTP sent (mock) for agreement ${agreement.displayId}. Signer type: ${signerType}`,
    newValue: { signerType, staffMemberId: staffMember?.id || null },
  });

  revalidatePath('/dashboard/owner/agreements');

  const email = session.email || 'your-email@example.com';
  let maskedEmail = email;
  if (email.includes('@')) {
    const [localPart, domain] = email.split('@');
    const visible = localPart.substring(0, Math.min(2, localPart.length));
    maskedEmail = `${visible}***@${domain}`;
  }

  return { success: true, message: 'OTP sent to authorized signer (mock: use 123456)', maskedEmail };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. VERIFY SIGNER OTP
// ─────────────────────────────────────────────────────────────────────────────

export async function verifySignerAgreementOTP(agreementId: string, otp: string) {
  const session = await requireSession();
  const agreement = await getAgreementOrThrow(agreementId);

  if (agreement.status !== 'PENDING_COUNTER_SIGN') {
    throw new Error('Agreement is not in the correct state for signer verification.');
  }
  if (otp.trim() !== '123456') {
    throw new Error('Invalid OTP. Use 123456 in test mode.');
  }

  const { authorized, signerType, staffMember } = await resolveSignerAuth(agreement, session.userId);

  if (!authorized) {
    logAuditEvent({
      actorId: session.userId,
      actorRole: session.role as string,
      actorName: session.name || 'Unknown',
      actionType: 'OVERRIDE',
      entityType: 'AGREEMENT',
      entityId: agreementId,
      description: `UNAUTHORIZED signer verification attempt on agreement ${agreement.displayId} by user ${session.userId}`,
    });
    throw new Error('Not authorized to execute agreements for this property.');
  }

  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
  const userAgent = headersList.get('user-agent') || 'unknown';

  // Resolve signer info
  let signerName: string;
  let signerDesignation: string;
  let signerEmail: string;

  if (signerType === 'OWNER') {
    const ownerUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });
    signerName = ownerUser?.name || session.name || 'Owner';
    signerDesignation = 'Licensor / Property Owner';
    signerEmail = ownerUser?.email || session.email || '';
  } else {
    signerName = staffMember?.name || session.name || 'Manager';
    signerDesignation = staffMember?.role || 'Authorized Manager';
    signerEmail = staffMember?.email || session.email || '';
  }

  await (prisma as any).agreement.update({
    where: { id: agreementId },
    data: {
      signerUserId: session.userId,
      signerType,
      signerName,
      signerDesignation,
      signerEmail,
      signerVerified: true,
      signerVerifiedAt: new Date(),
      signerVerifiedIp: ip,
      signerVerifiedDevice: userAgent,
      status: 'SIGNER_VERIFIED',
    },
  });

  const auditType = signerType === 'OWNER' ? 'OWNER_VERIFIED' : 'MANAGER_VERIFIED';
  logAuditEvent({
    actorId: session.userId,
    actorRole: session.role as string,
    actorName: signerName,
    actionType: 'UPDATE',
    entityType: 'AGREEMENT',
    entityId: agreementId,
    description: `${auditType}: Signer verified agreement ${agreement.displayId}. Signer: ${signerName} (${signerType}). IP: ${ip}`,
    newValue: { signerType, signerName, signerDesignation, status: 'SIGNER_VERIFIED' },
  });

  // Fire-and-forget PDF generation
  generateAgreementPDF(agreementId).catch((err) => {
    console.error(`[PDF_GEN] Failed to generate PDF for agreement ${agreementId}:`, err);
  });

  revalidatePath('/dashboard/student');
  revalidatePath('/dashboard/owner/agreements');

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. GENERATE AGREEMENT PDF
// ─────────────────────────────────────────────────────────────────────────────

// ── PDF Helper: section header ──────────────────────────────────────────────
function addSectionHeader(doc: jsPDF, title: string, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(243, 244, 246); // gray-100
  doc.rect(10, y, pageWidth - 20, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(59, 91, 219); // brand purple
  doc.text(title, 14, y + 5.5);
  doc.setTextColor(0, 0, 0);
  return y + 12;
}

// ── PDF Helper: label-value row ─────────────────────────────────────────────
function addText(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(107, 114, 128); // gray-500
  doc.text(label, 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(17, 24, 39); // gray-900
  doc.text(value, 75, y);
  return y + 5.5;
}

// ── PDF Helper: paragraph with wrapping ─────────────────────────────────────
function addParagraph(doc: jsPDF, text: string, y: number, maxWidth: number = 182): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 65, 81); // gray-700
  const lines = doc.splitTextToSize(text, maxWidth);
  const pageHeight = doc.internal.pageSize.getHeight();
  for (const line of lines) {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 14, y);
    y += 4.5;
  }
  return y + 2;
}

// ── PDF Helper: numbered clause ─────────────────────────────────────────────
function addClause(doc: jsPDF, num: number, text: string, y: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y > pageHeight - 25) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(17, 24, 39);
  doc.text(`${num}.`, 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  const lines = doc.splitTextToSize(text, 170);
  for (let i = 0; i < lines.length; i++) {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines[i], 22, y);
    y += 4.5;
  }
  return y + 2;
}

// ── PDF Helper: page footer ──────────────────────────────────────────────────
function addPageFooter(
  doc: jsPDF,
  pageNum: number,
  totalPages: number,
  agreement: any,
  booking: any,
  tenant: any,
  property: any,
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(209, 213, 219);
  doc.line(10, pageHeight - 14, pageWidth - 10, pageHeight - 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(156, 163, 175);
  const footerText =
    `Agreement ID: ${agreement.displayId} | Booking: ${booking?.displayId || '-'} | ` +
    `Tenant ID: ${tenant?.displayId || '-'} | Property: ${property?.displayId || '-'} | ` +
    `Page ${pageNum} of ${totalPages} | Generated by RentPe Platform | Valid under IT Act 2000 & Indian Evidence Act S.65B`;
  doc.text(footerText, pageWidth / 2, pageHeight - 9, { align: 'center' });
}

// ── Main PDF generator ───────────────────────────────────────────────────────
async function generateAgreementPDF(agreementId: string): Promise<void> {
  // Fetch agreement with all needed relations
  const agreement = await (prisma as any).agreement.findUnique({
    where: { id: agreementId },
    include: {
      booking: {
        include: {
          room: { select: { roomNumber: true, type: true, displayId: true } },
          property: {
            select: {
              id: true,
              displayId: true,
              name: true,
              address: true,
              city: true,
              amenities: true,
              rules: true,
              noticePeriod: true,
              gstNumber: true,
              pgLicence: true,
            },
          },
        },
      },
    },
  });

  if (!agreement) throw new Error('Agreement not found for PDF generation.');

  const booking = agreement.booking;
  const property = booking?.property || null;

  const tenant = await prisma.user.findUnique({
    where: { id: agreement.tenantId },
    select: { id: true, name: true, email: true, phone: true, displayId: true, currentAddress: true, city: true },
  });

  const owner = await prisma.user.findUnique({
    where: { id: agreement.ownerId },
    select: { id: true, name: true, email: true, phone: true, displayId: true },
  });

  let staffMember: any = null;
  if (agreement.signerType === 'MANAGER' && agreement.signerUserId) {
    staffMember = await (prisma as any).ownerStaffMember.findFirst({
      where: { userId: agreement.signerUserId, ownerId: agreement.ownerId },
    });
  }

  // Parse amenities
  let amenitiesArr: string[] = [];
  try {
    const parsed = JSON.parse(property?.amenities || '[]');
    amenitiesArr = Array.isArray(parsed)
      ? parsed.map((a: any) => (typeof a === 'string' ? a : String(a)))
      : [];
  } catch {
    amenitiesArr = [];
  }

  const executionDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const placeOfExecution = property?.city || 'India';

  // ── Build PDF ────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── HEADER ───────────────────────────────────────────────────────────────
  doc.setFillColor(59, 91, 219);
  doc.rect(0, 0, pageWidth, 42, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('LEAVE AND LICENSE AGREEMENT', pageWidth / 2, 13, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(220, 225, 255);
  doc.text('(For Paying Guest / PG Accommodation)', pageWidth / 2, 21, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(200, 210, 255);
  doc.text('Executed under the Indian Easements Act, 1882', pageWidth / 2, 28, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setTextColor(180, 195, 255);
  const headerMeta = [
    `Agreement ID: ${agreement.displayId}`,
    `Booking Ref: ${booking?.displayId || '-'}`,
    `Date of Execution: ${executionDate}`,
    `Place of Execution: ${placeOfExecution}`,
  ].join('   |   ');
  doc.text(headerMeta, pageWidth / 2, 37, { align: 'center' });

  let y = 50;

  // ── SECTION 1: PARTIES ───────────────────────────────────────────────────
  y = addSectionHeader(doc, 'SECTION 1: PARTIES TO THE AGREEMENT', y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(59, 91, 219);
  doc.text('A. LICENSOR (Property Owner)', 14, y);
  y += 5;

  y = addText(doc, 'Full Name:', owner?.name || 'N/A', y);
  y = addText(doc, 'Email:', owner?.email || 'N/A', y);
  y = addText(doc, 'Phone:', owner?.phone || 'N/A', y);
  y = addText(doc, 'User ID:', owner?.displayId || 'N/A', y);
  y += 3;

  if (agreement.signerType === 'MANAGER' && staffMember) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(59, 91, 219);
    doc.text('B. AUTHORIZED MANAGER (Executing on behalf of Licensor)', 14, y);
    y += 5;
    y = addText(doc, 'Manager Name:', staffMember.name || agreement.signerName || 'N/A', y);
    y = addText(doc, 'Designation:', staffMember.role || agreement.signerDesignation || 'Manager', y);
    y = addText(doc, 'Email:', staffMember.email || agreement.signerEmail || 'N/A', y);
    y = addText(doc, 'Authority:', 'Authorized under Power delegated by Licensor per Platform Records', y);
    y += 3;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(59, 91, 219);
  const licenseeLabel =
    agreement.signerType === 'MANAGER' ? 'C. LICENSEE (Tenant / Guest)' : 'B. LICENSEE (Tenant / Guest)';
  doc.text(licenseeLabel, 14, y);
  y += 5;

  y = addText(doc, 'Full Name:', tenant?.name || 'N/A', y);
  y = addText(doc, 'Email:', tenant?.email || 'N/A', y);
  y = addText(doc, 'Phone:', tenant?.phone || 'N/A', y);
  y = addText(doc, 'Address:', tenant?.currentAddress || tenant?.city || 'N/A', y);
  y = addText(doc, 'User ID:', tenant?.displayId || 'N/A', y);
  y += 4;

  // ── RECITALS ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text('RECITALS', 14, y);
  y += 5;

  y = addParagraph(
    doc,
    `WHEREAS the Licensor is the lawful owner / authorized representative of the property described hereunder and is desirous of granting a Leave and License in respect of the said premises to the Licensee for residential and paying-guest accommodation purposes only, and WHEREAS the Licensee is desirous of taking the said premises on Leave and License basis, NOW THEREFORE in consideration of the mutual covenants and conditions contained herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties agree as follows:`,
    y,
  );
  y += 2;

  // ── SECTION 2: LICENSED PREMISES ─────────────────────────────────────────
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y > pageHeight - 40) { doc.addPage(); y = 20; }
  y = addSectionHeader(doc, 'SECTION 2: LICENSED PREMISES', y);
  y = addText(doc, 'Property Name:', property?.name || 'N/A', y);
  y = addText(doc, 'Full Address:', property?.address || 'N/A', y);
  y = addText(doc, 'City:', property?.city || 'N/A', y);
  y = addText(doc, 'Property ID:', property?.displayId || 'N/A', y);
  if (property?.pgLicence) {
    y = addText(doc, 'PG Licence No.:', property.pgLicence, y);
  }
  if (property?.gstNumber) {
    y = addText(doc, 'GST No.:', property.gstNumber, y);
  }
  if (booking?.room) {
    y = addText(doc, 'Room No.:', booking.room.roomNumber || 'N/A', y);
    y = addText(doc, 'Room Type:', booking.room.type || 'N/A', y);
    y = addText(doc, 'Room ID:', booking.room.displayId || 'N/A', y);
  }
  if (agreement.bedId) {
    y = addText(doc, 'Bed ID:', agreement.bedId, y);
  }
  y += 4;

  // ── SECTION 3: DURATION ───────────────────────────────────────────────────
  if (y > pageHeight - 40) { doc.addPage(); y = 20; }
  y = addSectionHeader(doc, 'SECTION 3: DURATION & COMMENCEMENT', y);
  const moveInDate = booking?.moveInDate
    ? new Date(booking.moveInDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'As per booking records';
  y = addText(doc, 'Commencement Date:', moveInDate, y);
  y = addText(doc, 'Tenancy Type:', 'Month-to-Month (Rolling)', y);
  y = addText(doc, 'Lock-in Period:', `${agreement.lockInDays} days from commencement`, y);
  y = addText(doc, 'Notice Period:', `${agreement.noticePeriodDays} days written notice required`, y);
  y = addText(
    doc,
    'Registration Note:',
    'This agreement is for a period not exceeding 11 months and does not require mandatory registration under Section 17 of the Registration Act, 1908. However, this digital record is valid evidence under IT Act 2000 and Indian Evidence Act Section 65B.',
    y,
  );
  y += 4;

  // ── SECTION 4: FINANCIAL TERMS ────────────────────────────────────────────
  if (y > pageHeight - 40) { doc.addPage(); y = 20; }
  y = addSectionHeader(doc, 'SECTION 4: FINANCIAL TERMS', y);

  const rent = agreement.monthlyRent;
  const deposit = agreement.securityDeposit;
  const maintenance = agreement.maintenanceCharges;
  const food = agreement.foodCharges;
  const lateFee = agreement.lateFeePerDay;
  const grace = agreement.gracePeriodDays;
  const overstayMul = agreement.overstayPenaltyMultiplier;
  const rentDueDay = agreement.rentDueDay;

  const financialClauses: Array<{ n: number; text: string }> = [
    { n: 6, text: `Monthly License Fee: The Licensee shall pay Rs. ${rent.toFixed(2)} per month as the monthly license fee (hereinafter "Rent") to the Licensor.` },
    { n: 7, text: `Security Deposit: A refundable security deposit of Rs. ${deposit.toFixed(2)} has been collected from the Licensee prior to execution. This amount shall be returned within 15 days of the Licensee vacating the premises, after deduction of any dues, damages, or outstanding charges.` },
    { n: 8, text: `Maintenance Charges: Rs. ${maintenance.toFixed(2)} per month shall be charged as maintenance charges${maintenance === 0 ? ' (included in License Fee as applicable)' : ''}.` },
    { n: 9, text: `Food Charges: Rs. ${food.toFixed(2)} per month${food === 0 ? ' — No food plan selected' : ' for the agreed meal plan as communicated at time of booking'}.` },
    { n: 10, text: `Wi-Fi: ${agreement.wifiIncluded ? 'Wi-Fi internet connectivity is included in the License Fee at no additional charge.' : 'Wi-Fi is not included in this agreement. Separate charges may apply if the Licensee opts for Wi-Fi services.'}` },
    { n: 11, text: `Electricity: ${agreement.electricityType === 'FLAT_RATE' ? `Electricity is charged at a flat rate of Rs. ${(agreement.electricityFlat || 0).toFixed(2)} per month.` : 'Electricity charges shall be billed as per actual consumption based on the property electricity meter reading.'}` },
    { n: 12, text: `Rent Due Date: Monthly rent is due on the ${rentDueDay}${rentDueDay === 1 ? 'st' : rentDueDay === 2 ? 'nd' : rentDueDay === 3 ? 'rd' : 'th'} of every calendar month.` },
    { n: 13, text: `Grace Period: A grace period of ${grace} days shall be allowed beyond the rent due date before late fees are applied.` },
    { n: 14, text: `Late Payment Fee: In the event of delay beyond the grace period, a late fee of Rs. ${lateFee.toFixed(2)} per day shall be levied on the outstanding rent amount until the date of full payment.` },
    { n: 15, text: `Rent Revision: The monthly License Fee may be revised by the Licensor with a minimum of 30 days' prior written notice. No revision shall take effect during the lock-in period.` },
    { n: 16, text: `Mode of Payment: The Licensee shall pay rent via bank transfer, UPI, or through the RentPe platform. Cash payments must be documented with a signed receipt.` },
    { n: 17, text: `Non-Payment Consequences: Failure to pay rent for two consecutive months shall entitle the Licensor to initiate eviction proceedings after issuing a 7-day cure notice.` },
    { n: 18, text: `Advance Notice for Vacating: The Licensee must provide written notice of at least ${agreement.noticePeriodDays} days prior to vacating the premises. Failure to do so shall result in forfeiture of the equivalent notice period amount from the security deposit.` },
    { n: 19, text: `Overstay Penalty: In the event the Licensee continues to occupy the premises beyond the agreed termination date without written consent, an overstay penalty of ${overstayMul}x the daily rent shall be charged for each day of overstay.` },
    { n: 20, text: `Lock-In Clause: The Licensee agrees not to vacate the premises within ${agreement.lockInDays} days of commencement. Early vacating during the lock-in period shall result in forfeiture of the security deposit in full.` },
  ];

  for (const clause of financialClauses) {
    if (y > pageHeight - 20) { doc.addPage(); y = 20; }
    y = addClause(doc, clause.n, clause.text, y);
  }
  y += 2;

  // ── SECTION 5: SERVICES & AMENITIES ──────────────────────────────────────
  if (y > pageHeight - 40) { doc.addPage(); y = 20; }
  y = addSectionHeader(doc, 'SECTION 5: SERVICES & AMENITIES', y);

  if (amenitiesArr.length > 0) {
    y = addParagraph(
      doc,
      `The following amenities and services are provided at the licensed premises as represented by the Licensor on the RentPe platform: ${amenitiesArr.join(', ')}.`,
      y,
    );
  } else {
    y = addParagraph(doc, 'Amenities are as communicated by the Licensor and as listed on the RentPe property listing.', y);
  }
  y = addParagraph(
    doc,
    'The Licensor does not guarantee uninterrupted availability of amenities and services and shall not be held liable for temporary disruptions due to maintenance, utility failures, or force majeure events.',
    y,
  );
  y += 2;

  // ── SECTION 6: TERMS AND CONDITIONS ──────────────────────────────────────
  if (y > pageHeight - 40) { doc.addPage(); y = 20; }
  y = addSectionHeader(doc, 'SECTION 6: TERMS AND CONDITIONS', y);

  const termsClauses: Array<{ n: number; text: string }> = [
    { n: 21, text: 'Nature of Agreement: This agreement is a Leave and License agreement as governed by the Indian Easements Act, 1882 (Section 52). It does not create any tenancy, sub-tenancy, or proprietary rights in favour of the Licensee. The Licensee shall vacate the premises immediately upon revocation or expiry of this license.' },
    { n: 22, text: 'Permitted Use: The licensed premises shall be used exclusively for bona fide residential and paying-guest accommodation purposes by the Licensee and no other person without prior written consent of the Licensor.' },
    { n: 23, text: 'Subletting Prohibited: The Licensee shall not sublet, assign, or part with possession of the licensed premises or any part thereof to any person under any circumstances.' },
    { n: 24, text: 'Structural Alterations: The Licensee shall not make any structural alterations, additions, or modifications to the licensed premises without prior written consent of the Licensor.' },
    { n: 25, text: 'Damage and Repairs: The Licensee shall be responsible for any damage caused to the property, fixtures, furniture, or fittings during the license period beyond normal wear and tear. The cost of repairs shall be deducted from the security deposit or charged separately.' },
    { n: 26, text: 'Inspection Rights: The Licensor or their authorized representative shall have the right to inspect the licensed premises at any reasonable time after providing 24-hour advance notice to the Licensee, except in case of emergency.' },
    { n: 27, text: 'Utilities: The Licensee shall be responsible for payment of all applicable charges for utilities consumed during the license period unless specifically included in the license fee.' },
    { n: 28, text: 'Insurance: The Licensor is not responsible for loss, theft, or damage to the Licensee\'s personal belongings. The Licensee is advised to obtain personal property insurance at their own cost.' },
    { n: 29, text: 'Police Verification: The Licensee shall cooperate fully with police verification procedures as required under applicable state tenancy laws and Rules. Failure to do so shall be grounds for immediate termination of this license.' },
    { n: 30, text: 'Guest Policy: The Licensee shall not accommodate guests overnight without prior written consent of the Licensor. Day visitors are permitted between 8:00 AM and 10:00 PM only.' },
    { n: 31, text: 'Noise and Nuisance: The Licensee shall not cause any nuisance, disturbance, or harassment to neighbours, co-residents, or Licensor staff. Violation of this clause shall be grounds for immediate termination.' },
    { n: 32, text: 'Prohibited Items: Storage or use of illegal substances, weapons, flammable materials, or any item prohibited by law is strictly forbidden on the licensed premises.' },
    { n: 33, text: 'Common Area Usage: The Licensee shall maintain cleanliness in all common areas and shall comply with the property\'s common area usage norms.' },
    { n: 34, text: 'Dispute Resolution: Any dispute arising out of or in connection with this agreement shall first be attempted to be resolved through mutual negotiation within 15 days of written notice. If unresolved, the dispute shall be referred to arbitration under the Arbitration and Conciliation Act, 1996. The seat of arbitration shall be the city in which the licensed premises are located.' },
    { n: 35, text: 'Governing Law: This agreement shall be governed by and construed in accordance with the laws of India. The courts at the location of the licensed premises shall have exclusive jurisdiction over any legal proceedings.' },
    { n: 36, text: 'Digital Validity: This agreement, including all digital signatures and verification audit trails recorded herein, shall be valid and binding evidence under Section 65B of the Indian Evidence Act, 1872 and Section 4 of the Information Technology Act, 2000.' },
    { n: 37, text: 'Force Majeure: Neither party shall be liable for failure to perform obligations under this agreement due to circumstances beyond their reasonable control including but not limited to natural disasters, pandemics, government orders, or acts of God.' },
    { n: 38, text: 'Entire Agreement: This agreement constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior discussions, understandings, and agreements.' },
    { n: 39, text: 'Severability: If any provision of this agreement is found to be invalid, illegal, or unenforceable by a competent court, the remaining provisions shall continue in full force and effect.' },
  ];

  for (const clause of termsClauses) {
    if (y > pageHeight - 20) { doc.addPage(); y = 20; }
    y = addClause(doc, clause.n, clause.text, y);
  }
  y += 2;

  // ── SECTION 7: HOUSE RULES ────────────────────────────────────────────────
  if (y > pageHeight - 40) { doc.addPage(); y = 20; }
  y = addSectionHeader(doc, 'SECTION 7: HOUSE RULES', y);

  let rules: string[] = [];
  if (property?.rules && property.rules.trim().length > 0) {
    rules = property.rules
      .split('\n')
      .map((r: string) => r.trim())
      .filter((r: string) => r.length > 0);
  }

  if (rules.length === 0) {
    rules = [
      'No smoking inside the premises.',
      'No alcohol or narcotics on the property.',
      'Visitors are allowed only between 8:00 AM and 10:00 PM.',
      'Overnight guests are not permitted without prior written consent of management.',
      'Maintain cleanliness in your room and all common areas.',
      'Noise must be kept to a minimum after 10:00 PM.',
      'Waste must be disposed of in designated bins only.',
      'No cooking in rooms unless a kitchen is explicitly provided.',
      'Electrical appliances must be switched off when not in use.',
      'Common area furniture must not be moved to individual rooms.',
      'Parking is subject to availability and prior allocation by management.',
      'Any damage to property must be reported to management immediately.',
      'Gate curfew is as communicated by management and must be strictly observed.',
      'Tenants must carry their ID cards / RentPe digital ID at all times.',
      'Entry of persons of the opposite gender into rooms is prohibited.',
      'Playing loud music or instruments is not permitted inside the premises.',
      'Tenants are personally responsible for the conduct of their visitors.',
      'RentPe staff or management representatives may conduct room inspections with notice.',
      'Any violation of house rules may result in immediate termination of the license.',
    ];
  }

  for (let i = 0; i < rules.length; i++) {
    if (y > pageHeight - 20) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81);
    const ruleLines = doc.splitTextToSize(`${i + 1}. ${rules[i]}`, 180);
    for (const line of ruleLines) {
      if (y > pageHeight - 20) { doc.addPage(); y = 20; }
      doc.text(line, 14, y);
      y += 4.5;
    }
  }
  y += 4;

  // ── SECTION 8: DIGITAL VERIFICATION AUDIT TRAIL ───────────────────────────
  if (y > pageHeight - 60) { doc.addPage(); y = 20; }
  y = addSectionHeader(doc, 'SECTION 8: DIGITAL VERIFICATION AUDIT TRAIL', y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text('Tenant Verification Record:', 14, y);
  y += 5;

  y = addText(doc, 'Verified:', agreement.tenantVerified ? 'YES' : 'NO', y);
  if (agreement.tenantVerifiedAt) {
    y = addText(doc, 'Verified At:', new Date(agreement.tenantVerifiedAt).toLocaleString('en-IN'), y);
  }
  if (agreement.tenantVerifiedEmail) {
    y = addText(doc, 'Verified Email:', agreement.tenantVerifiedEmail, y);
  }
  if (agreement.tenantVerifiedIp) {
    y = addText(doc, 'IP Address:', agreement.tenantVerifiedIp, y);
  }
  if (agreement.tenantVerifiedDevice) {
    const deviceShort = agreement.tenantVerifiedDevice.substring(0, 80);
    y = addText(doc, 'Device/UA:', deviceShort, y);
  }
  y += 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text('Signer Verification Record:', 14, y);
  y += 5;

  y = addText(doc, 'Verified:', agreement.signerVerified ? 'YES' : 'NO', y);
  y = addText(doc, 'Signer Type:', agreement.signerType || 'N/A', y);
  y = addText(doc, 'Signer Name:', agreement.signerName || 'N/A', y);
  y = addText(doc, 'Designation:', agreement.signerDesignation || 'N/A', y);
  y = addText(doc, 'Signer Email:', agreement.signerEmail || 'N/A', y);
  if (agreement.signerVerifiedAt) {
    y = addText(doc, 'Verified At:', new Date(agreement.signerVerifiedAt).toLocaleString('en-IN'), y);
  }
  if (agreement.signerVerifiedIp) {
    y = addText(doc, 'IP Address:', agreement.signerVerifiedIp, y);
  }
  if (agreement.signerVerifiedDevice) {
    const deviceShort = agreement.signerVerifiedDevice.substring(0, 80);
    y = addText(doc, 'Device/UA:', deviceShort, y);
  }
  y += 2;

  y = addParagraph(
    doc,
    'This digital verification has been recorded on the RentPe platform with cryptographic certainty. Both parties have authenticated via a one-time password (OTP) sent to their registered contact. This record constitutes a valid electronic signature under Section 5 of the Information Technology Act, 2000 and is admissible as evidence under Section 65B of the Indian Evidence Act, 1872.',
    y,
  );
  y += 4;

  // ── ANNEXURE I: INVENTORY ─────────────────────────────────────────────────
  if (y > pageHeight - 60) { doc.addPage(); y = 20; }
  y = addSectionHeader(doc, 'ANNEXURE I: PROPERTY INVENTORY', y);

  y = addParagraph(
    doc,
    'The following items have been provided in the licensed premises at the time of move-in. The Licensee acknowledges receipt of these items in working condition:',
    y,
  );

  const inventoryItems = [
    { item: 'Bed / Mattress', qty: '1', condition: 'Good' },
    { item: 'Ceiling Fan', qty: '1', condition: 'Good' },
    { item: 'Air Conditioner', qty: agreement.wifiIncluded ? '1' : '0 (Not provided)', condition: '-' },
    { item: 'Wi-Fi Access', qty: agreement.wifiIncluded ? 'Yes (Included)' : 'No', condition: '-' },
    { item: 'Study Table', qty: '1', condition: 'Good' },
    { item: 'Chair', qty: '1', condition: 'Good' },
    { item: 'Cupboard / Wardrobe', qty: '1', condition: 'Good' },
    { item: 'Electrical Sockets', qty: 'As available', condition: 'Working' },
    { item: 'Door Lock & Key', qty: '1 set', condition: 'Functional' },
    { item: 'Window(s)', qty: 'As fitted', condition: 'Good' },
  ];

  // Table header
  doc.setFillColor(243, 244, 246);
  doc.rect(14, y, 182, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(59, 91, 219);
  doc.text('Item', 16, y + 5);
  doc.text('Qty / Status', 100, y + 5);
  doc.text('Condition', 155, y + 5);
  y += 8;

  for (const inv of inventoryItems) {
    if (y > pageHeight - 20) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81);
    doc.text(inv.item, 16, y);
    doc.text(inv.qty, 100, y);
    doc.text(inv.condition, 155, y);
    y += 5;
  }

  if (agreement.inventorySnapshot) {
    try {
      const snap = JSON.parse(agreement.inventorySnapshot);
      if (Array.isArray(snap)) {
        for (const item of snap) {
          if (y > pageHeight - 20) { doc.addPage(); y = 20; }
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(55, 65, 81);
          doc.text(String(item.name || item), 16, y);
          doc.text(String(item.qty || '1'), 100, y);
          doc.text(String(item.condition || 'Good'), 155, y);
          y += 5;
        }
      }
    } catch {
      /* ignore parse errors */
    }
  }
  y += 4;

  // ── SECTION 9: SIGNATURES ─────────────────────────────────────────────────
  if (y > pageHeight - 70) { doc.addPage(); y = 20; }
  y = addSectionHeader(doc, 'SECTION 9: SIGNATURES', y);

  y = addParagraph(
    doc,
    'IN WITNESS WHEREOF, the parties have executed this Leave and License Agreement on the date first written above, and confirm that they have read and understood all the terms and conditions contained herein.',
    y,
  );
  y += 6;

  // Signature blocks
  const sigBlockY = y;
  // Left column — Licensor
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text('LICENSOR (Owner / Authorized Signer)', 14, sigBlockY);
  doc.line(14, sigBlockY + 18, 90, sigBlockY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(`Name: ${agreement.signerName || owner?.name || '________________________'}`, 14, sigBlockY + 22);
  doc.text(`Designation: ${agreement.signerDesignation || 'Property Owner'}`, 14, sigBlockY + 26);
  doc.text(`Date: ${executionDate}`, 14, sigBlockY + 30);

  // Right column — Licensee
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text('LICENSEE (Tenant)', 115, sigBlockY);
  doc.line(115, sigBlockY + 18, 195, sigBlockY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(`Name: ${tenant?.name || '________________________'}`, 115, sigBlockY + 22);
  doc.text('Designation: Licensee / Paying Guest', 115, sigBlockY + 26);
  doc.text(`Date: ${executionDate}`, 115, sigBlockY + 30);

  y = sigBlockY + 40;

  // Witnesses
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text('WITNESS 1', 14, y);
  doc.line(14, y + 14, 90, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('Name: ________________________', 14, y + 18);
  doc.text('Date: ________________________', 14, y + 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text('WITNESS 2', 115, y);
  doc.line(115, y + 14, 195, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('Name: ________________________', 115, y + 18);
  doc.text('Date: ________________________', 115, y + 22);

  y += 30;

  // ── ADD FOOTERS TO ALL PAGES ──────────────────────────────────────────────
  const totalPages: number = (doc.internal as any).getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    addPageFooter(doc, pg, totalPages, agreement, booking, tenant, property);
  }

  // ── EXPORT & UPLOAD ───────────────────────────────────────────────────────
  const arrayBuffer = doc.output('arraybuffer');
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  const dataUri = `data:application/pdf;base64,${base64}`;

  let pdfUrl: string;

  const isPlaceholder = process.env.CLOUDINARY_API_KEY?.includes('your_api_key');
  if ((!process.env.CLOUDINARY_API_KEY || isPlaceholder) && process.env.NODE_ENV === 'development') {
    console.warn('[Cloudinary Mock] Skipping PDF upload — no valid API key.');
    pdfUrl = dataUri.substring(0, 100) + '...[mock]';
  } else {
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'rentpe/agreements',
      resource_type: 'raw',
      public_id: agreement.displayId,
    });
    pdfUrl = result.secure_url;
  }

  // Update agreement record
  await (prisma as any).agreement.update({
    where: { id: agreementId },
    data: {
      agreementPdfUrl: pdfUrl,
      agreementPdfGeneratedAt: new Date(),
      status: 'AGREEMENT_READY_FOR_DOWNLOAD',
    },
  });

  // Notify both parties
  await NotificationService.trigger({
    bookingId: agreement.bookingId,
    userId: agreement.tenantId,
    type: 'BOOKING',
    category: 'AGREEMENT_PDF_READY',
    message: 'Your Leave & License Agreement PDF has been generated and is ready for download.',
    targetRole: 'USER',
    actionUrl: '/dashboard/student',
    actionLabel: 'Download Agreement',
    isPersistent: true,
  });

  await NotificationService.trigger({
    bookingId: agreement.bookingId,
    userId: agreement.ownerId,
    type: 'BOOKING',
    category: 'AGREEMENT_PDF_READY',
    message: 'The Leave & License Agreement PDF has been generated and is ready for download.',
    targetRole: 'OWNER',
    actionUrl: '/dashboard/owner/agreements',
    actionLabel: 'View Agreement',
  });

  logAuditEvent({
    actorId: 'SYSTEM',
    actorRole: 'SYSTEM',
    actorName: 'PDF_ENGINE',
    actionType: 'CREATE',
    entityType: 'AGREEMENT',
    entityId: agreementId,
    description: `Agreement PDF generated for ${agreement.displayId}. URL: ${pdfUrl.substring(0, 80)}`,
    newValue: { status: 'AGREEMENT_READY_FOR_DOWNLOAD', agreementPdfGeneratedAt: new Date() },
  });

  revalidatePath('/dashboard/student');
  revalidatePath('/dashboard/owner/agreements');
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. GET AGREEMENT DOWNLOAD URL
// ─────────────────────────────────────────────────────────────────────────────

export async function getAgreementDownloadUrl(agreementId: string): Promise<string> {
  const session = await requireSession();
  const agreement = await getAgreementOrThrow(agreementId);

  const isAuthorized =
    session.userId === agreement.tenantId ||
    session.userId === agreement.ownerId ||
    (agreement.signerUserId && session.userId === agreement.signerUserId) ||
    session.role === 'ADMIN';

  if (!isAuthorized) {
    throw new Error('You are not authorized to download this agreement.');
  }

  if (!agreement.agreementPdfUrl) {
    throw new Error('Agreement PDF has not been generated yet. Please check back shortly.');
  }

  await (prisma as any).agreement.update({
    where: { id: agreementId },
    data: { downloadedAt: new Date() },
  });

  logAuditEvent({
    actorId: session.userId,
    actorRole: session.role as string,
    actorName: session.name || 'User',
    actionType: 'VIEW',
    entityType: 'AGREEMENT',
    entityId: agreementId,
    description: `Agreement PDF downloaded by ${session.name || session.userId} for agreement ${agreement.displayId}`,
  });

  return agreement.agreementPdfUrl as string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. UPLOAD SIGNED AGREEMENT
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadSignedAgreement(
  agreementId: string,
  fileBase64: string,
  fileName: string,
): Promise<{ success: boolean }> {
  const session = await requireSession();
  const agreement = await getAgreementOrThrow(agreementId);

  const isAuthorized =
    session.userId === agreement.ownerId ||
    (agreement.signerUserId && session.userId === agreement.signerUserId) ||
    session.role === 'ADMIN';

  if (!isAuthorized) {
    throw new Error('Only the property owner or authorized signer can upload the signed agreement.');
  }

  if (!fileBase64.startsWith('data:application/pdf')) {
    throw new Error('Invalid file type. Only PDF files are accepted for the signed agreement upload.');
  }

  // Calculate approximate file size from base64 string
  // Base64 string length * (3/4) gives the size in bytes
  const base64Data = fileBase64.split(',')[1] || fileBase64;
  const approximateSizeBytes = (base64Data.length * 3) / 4;
  const maxSizeBytes = 5 * 1024 * 1024; // 5 MB

  if (approximateSizeBytes > maxSizeBytes) {
    throw new Error('File size exceeds the 5MB limit. Please upload a smaller PDF file.');
  }

  let signedPdfUrl: string;

  const isPlaceholder = process.env.CLOUDINARY_API_KEY?.includes('your_api_key');
  if ((!process.env.CLOUDINARY_API_KEY || isPlaceholder) && process.env.NODE_ENV === 'development') {
    console.warn('[Cloudinary Mock] Skipping signed PDF upload — no valid API key.');
    signedPdfUrl = `mock://signed-pdf/${agreement.displayId}`;
  } else {
    const result = await cloudinary.uploader.upload(fileBase64, {
      folder: 'rentpe/agreements/signed',
      resource_type: 'raw',
      public_id: `${agreement.displayId}-SIGNED`,
    });
    signedPdfUrl = result.secure_url;
  }

  // Update agreement
  await (prisma as any).agreement.update({
    where: { id: agreementId },
    data: {
      signedPdfUrl,
      signedPdfUploadedAt: new Date(),
      signedPdfUploadedBy: session.userId,
      status: 'AGREEMENT_COMPLETED',
    },
  });

  // Notify tenant
  await NotificationService.trigger({
    bookingId: agreement.bookingId,
    userId: agreement.tenantId,
    type: 'BOOKING',
    category: 'AGREEMENT_COMPLETED',
    message: 'Your Leave & License Agreement has been fully executed. Welcome to RentPe!',
    targetRole: 'USER',
    actionUrl: '/dashboard/student',
    actionLabel: 'View Agreement',
    isPersistent: true,
  });

  logAuditEvent({
    actorId: session.userId,
    actorRole: session.role as string,
    actorName: session.name || 'Owner',
    actionType: 'CREATE',
    entityType: 'AGREEMENT',
    entityId: agreementId,
    description: `Signed PDF uploaded for agreement ${agreement.displayId} by ${session.name || session.userId}. File: ${fileName}`,
    newValue: { signedPdfUrl, signedPdfUploadedAt: new Date() },
  });

  logAuditEvent({
    actorId: session.userId,
    actorRole: session.role as string,
    actorName: session.name || 'Owner',
    actionType: 'UPDATE',
    entityType: 'AGREEMENT',
    entityId: agreementId,
    description: `Agreement ${agreement.displayId} marked COMPLETED after signed PDF upload.`,
    newValue: { status: 'AGREEMENT_COMPLETED' },
  });

  revalidatePath('/dashboard/student');
  revalidatePath('/dashboard/owner/agreements');
  revalidatePath('/dashboard/admin/agreements');

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8b. VERIFY UPLOADED AGREEMENT (TENANT ONLY)
// ─────────────────────────────────────────────────────────────────────────────

export async function verifyUploadedAgreement(agreementId: string): Promise<{ success: boolean }> {
  const session = await requireSession();
  const agreement = await getAgreementOrThrow(agreementId);

  if (session.userId !== agreement.tenantId) {
    throw new Error('Only the tenant can verify the uploaded agreement.');
  }

  if (agreement.status !== 'AGREEMENT_COMPLETED' || !agreement.signedPdfUrl) {
    throw new Error('Agreement is not in the correct state for verification.');
  }

  // Update agreement
  await (prisma as any).agreement.update({
    where: { id: agreementId },
    data: {
      tenantFinalAccepted: true,
      tenantFinalAcceptedAt: new Date(),
    },
  });

  // Update booking: mark agreement signed now that tenant verified it
  await prisma.booking.update({
    where: { id: agreement.bookingId },
    data: {
      agreementSigned: true,
      agreementSignedAt: new Date(),
    } as any,
  });

  logAuditEvent({
    actorId: session.userId,
    actorRole: session.role as string,
    actorName: session.name || 'Student',
    actionType: 'UPDATE',
    entityType: 'AGREEMENT',
    entityId: agreement.id,
    description: `Student verified the uploaded physical agreement for ${agreement.displayId}.`,
    newValue: { tenantFinalAccepted: true },
  });

  revalidatePath('/dashboard/student');
  revalidatePath('/dashboard/student/agreements');

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. GET MY AGREEMENTS (Student / Tenant view)
// ─────────────────────────────────────────────────────────────────────────────

export async function getMyAgreements() {
  const session = await requireSession();

  const agreements = await (prisma as any).agreement.findMany({
    where: {
      tenantId: session.userId,
      deletedAt: null,
    },
    include: {
      booking: {
        select: {
          displayId: true,
          moveInDate: true,
          propertyName: true,
          status: true,
        },
      },
      property: {
        select: {
          name: true,
          displayId: true,
          city: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return agreements;
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. GET OWNER AGREEMENTS
// ─────────────────────────────────────────────────────────────────────────────

export async function getOwnerAgreements(status?: string) {
  const session = await requireSession();

  if (session.role !== 'OWNER' && session.role !== 'STAFF' && session.role !== 'ADMIN') {
    throw new Error('Unauthorized. Only owners or staff can view owner agreements.');
  }

  let ownerId: string = session.userId;
  let propertyIdFilter: { propertyId?: { in: string[] } } = {};

  if (session.role === 'STAFF') {
    // Find the staff member record
    const staffMember = await (prisma as any).ownerStaffMember.findFirst({
      where: { userId: session.userId },
      include: { assignments: { select: { propertyId: true, status: true } } },
    });

    if (!staffMember) {
      return [];
    }

    const assignedPropertyIds = (staffMember.assignments || [])
      .filter((a: any) => a.status === 'ACTIVE')
      .map((a: any) => a.propertyId);

    ownerId = staffMember.ownerId;
    propertyIdFilter = assignedPropertyIds.length > 0 ? { propertyId: { in: assignedPropertyIds } } : {};
  }

  const where: any = {
    ownerId,
    deletedAt: null,
    ...propertyIdFilter,
    ...(status ? { status } : {}),
  };

  const agreements = await (prisma as any).agreement.findMany({
    where,
    include: {
      tenant: {
        select: {
          name: true,
          email: true,
          displayId: true,
          phone: true,
        },
      },
      property: {
        select: {
          name: true,
          displayId: true,
          city: true,
        },
      },
      booking: {
        select: {
          displayId: true,
          moveInDate: true,
        },
      },
      owner: {
        select: {
          name: true,
          displayId: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return agreements.map((a: any) => ({
    ...a,
    tenantName: a.tenant?.name || 'Unknown',
    tenantDisplayId: a.tenant?.displayId || 'Unknown',
    ownerName: a.owner?.name || 'Unknown',
    ownerDisplayId: a.owner?.displayId || 'Unknown',
    propertyName: a.property?.name || 'Unknown',
    bookingDisplayId: a.booking?.displayId || 'Unknown',
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. GET ADMIN AGREEMENTS
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminAgreements(filters?: {
  status?: string;
  propertyId?: string;
  ownerId?: string;
}) {
  const session = await requireSession();

  if (session.role !== 'ADMIN') {
    throw new Error('Unauthorized. Admin access required.');
  }

  const where: any = {
    deletedAt: null,
    ...(filters?.status ? { status: filters.status } : {}),
    ...(filters?.propertyId ? { propertyId: filters.propertyId } : {}),
    ...(filters?.ownerId ? { ownerId: filters.ownerId } : {}),
  };

  const agreements = await (prisma as any).agreement.findMany({
    where,
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          email: true,
          displayId: true,
          phone: true,
        },
      },
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          displayId: true,
        },
      },
      property: {
        select: {
          id: true,
          name: true,
          displayId: true,
          city: true,
          address: true,
        },
      },
      booking: {
        select: {
          id: true,
          displayId: true,
          moveInDate: true,
          status: true,
          amount: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return agreements.map((a: any) => ({
    ...a,
    tenantName: a.tenant?.name || 'Unknown',
    tenantDisplayId: a.tenant?.displayId || 'Unknown',
    ownerName: a.owner?.name || 'Unknown',
    ownerDisplayId: a.owner?.displayId || 'Unknown',
    propertyName: a.property?.name || 'Unknown',
    bookingDisplayId: a.booking?.displayId || 'Unknown',
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. TERMINATE AGREEMENT
// ─────────────────────────────────────────────────────────────────────────────

export async function terminateAgreement(agreementId: string, reason: string): Promise<{ success: boolean }> {
  const session = await requireSession();
  const agreement = await getAgreementOrThrow(agreementId);

  const isAuthorized =
    session.userId === agreement.tenantId ||
    session.userId === agreement.ownerId ||
    session.role === 'ADMIN';

  if (!isAuthorized) {
    throw new Error('You are not authorized to terminate this agreement.');
  }

  if (!reason || reason.trim().length < 5) {
    throw new Error('Please provide a valid reason for termination (at least 5 characters).');
  }

  await (prisma as any).agreement.update({
    where: { id: agreementId },
    data: {
      status: 'TERMINATED',
      terminatedAt: new Date(),
      terminatedBy: session.userId,
      terminationReason: reason.trim(),
    },
  });

  // Notify the other party
  const isTerminatedByTenant = session.userId === agreement.tenantId;
  const notifyUserId = isTerminatedByTenant ? agreement.ownerId : agreement.tenantId;
  const notifyRole: 'USER' | 'OWNER' = isTerminatedByTenant ? 'OWNER' : 'USER';

  await NotificationService.trigger({
    bookingId: agreement.bookingId,
    userId: notifyUserId,
    type: 'BOOKING',
    category: 'AGREEMENT_TERMINATED',
    message: `The Leave & License Agreement (${agreement.displayId}) has been terminated. Reason: ${reason.trim()}`,
    targetRole: notifyRole,
    actionUrl: isTerminatedByTenant ? '/dashboard/owner/agreements' : '/dashboard/student',
    actionLabel: 'View Details',
    isPersistent: true,
  });

  logAuditEvent({
    actorId: session.userId,
    actorRole: session.role as string,
    actorName: session.name || 'User',
    actionType: 'DELETE',
    entityType: 'AGREEMENT',
    entityId: agreementId,
    description: `Agreement ${agreement.displayId} TERMINATED by ${session.name || session.userId} (${session.role}). Reason: ${reason.trim()}`,
    newValue: { status: 'TERMINATED', terminationReason: reason.trim(), terminatedAt: new Date() },
  });

  revalidatePath('/dashboard/student');
  revalidatePath('/dashboard/owner/agreements');

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. GET PENDING AGREEMENT COUNT FOR OWNER (sidebar badge)
// ─────────────────────────────────────────────────────────────────────────────

export async function getPendingAgreementCountForOwner(): Promise<number> {
  const session = await requireSession();

  if (session.role !== 'OWNER' && session.role !== 'STAFF' && session.role !== 'ADMIN') {
    return 0;
  }

  let ownerId = session.userId;

  if (session.role === 'STAFF') {
    const staffMember = await (prisma as any).ownerStaffMember.findFirst({
      where: { userId: session.userId },
      select: { ownerId: true },
    });
    if (!staffMember) return 0;
    ownerId = staffMember.ownerId;
  }

  const count = await (prisma as any).agreement.count({
    where: {
      ownerId,
      deletedAt: null,
      status: {
        notIn: ['AGREEMENT_COMPLETED', 'TERMINATED'],
      },
    },
  });

  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. GET STUDENT PENDING AGREEMENT COUNT (sidebar badge)
// ─────────────────────────────────────────────────────────────────────────────

export async function getStudentPendingAgreementCount(): Promise<number> {
  const session = await requireSession();

  const count = await (prisma as any).agreement.count({
    where: {
      tenantId: session.userId,
      status: 'PENDING_TENANT_VERIFICATION',
      deletedAt: null,
    },
  });

  return count;
}
