export type UserRole = 'USER' | 'OWNER' | 'ADMIN' | 'ONBOARDER' | 'VERIFIER' | 'STAFF';

export interface User {
    id: string;
    email: string;
    role: UserRole;
    roles: string; // Comma-separated roles
    name?: string | null;
    phone?: string | null;
    status: string;
    profilePhoto?: string | null;
}

export interface Property {
    id: string;
    displayId?: string | null;
    ownerId: string;
    name: string;
    address: string;
    city: string;
    description?: string | null;
    amenities: string; // JSON string
    images: string; // JSON string
    status: string; // DRAFT | SUBMITTED_FOR_REVIEW | UNDER_REVIEW | VERIFIED | LIVE | REJECTED | PENDING_VERIFICATION | APPROVED
    propertyType: string;
    genderType: string;
    averageRating: number;
    reviewCount: number;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
    ownerName?: string | null;
    businessName?: string | null;
    // V2 State Machine fields
    completenessScore: number;           // 0-100 progress indicator
    fraudRiskScore: string;              // LOW | MEDIUM | HIGH
    propertyVerificationStatus: string;  // NOT_SUBMITTED | PENDING | APPROVED | REJECTED | NEEDS_RESUBMISSION
    kycVerificationStatus: string;       // NOT_SUBMITTED | PENDING | APPROVED | REJECTED | NEEDS_RESUBMISSION
    bankVerificationStatus: string;      // NOT_SUBMITTED | PENDING | APPROVED | REJECTED | NEEDS_RESUBMISSION
    docVerificationStatus: string;       // NOT_SUBMITTED | PENDING | APPROVED | REJECTED | NEEDS_RESUBMISSION
    platformAgreementVersion?: string | null; // e.g. "v1.2-2026"
    platformAgreementAcceptedAt?: Date | null;
}

export interface Room {
    id: string;
    displayId?: string | null;
    propertyId: string;
    roomNumber: string;
    type: string;
    price: number;
    availability: number;
    totalBeds: number;
    status: string;
    photoUrl?: string | null;
}

export type BookingStatus = 
    | 'PENDING_APPROVAL' 
    | 'APPROVED_PENDING_TOKEN' 
    | 'ROOM_RESERVED' 
    | 'PHYSICAL_VERIFIED'       // ← Tenant physically checked-in & ID verified; Tenant ID assigned
    | 'KYC_PENDING' 
    | 'KYC_REJECTED' 
    | 'AGREEMENT_PENDING'       // ← Student signed agreement with Tenant ID visible
    | 'BOOKING_CONFIRMED'       // ← Owner countersigned; both parties executed
    | 'ACTIVE'                  // ← Final payment done; resident is live
    | 'CHECKED_IN' 
    | 'PAID' 
    | 'CASH_PAID' 
    | 'CANCELLED' 
    | 'COMPLETED';

export interface Booking {
    id: string;
    displayId: string;          // REN-BOOK-2026-XXXX — permanent booking reference
    userId: string;
    propertyId?: string | null;
    roomId?: string | null;
    propertyName: string;
    occupancy: string;
    guestName: string;
    guestEmail?: string | null;
    guestPhone?: string | null;
    moveInDate: string;
    status: BookingStatus;
    paymentStatus: string;
    amount: number;
    roomAssigned?: string | null;
    agreementSigned: boolean;
    tenantId?: string | null;   // Links to Tenant record (set after physical check-in)
    createdAt: Date;
    updatedAt: Date;
}

export interface TenantDocument {
    id: string;
    bookingId: string;
    type: string;
    /** SECURITY FIX: Renamed from fileData. Stores a Cloudinary signed URL (not base64). */
    fileUrl: string;
    fileName?: string | null;
    status: 'PENDING' | 'VERIFIED' | 'REJECTED';
    rejectedNote?: string | null;
    uploadedAt: Date;
}

export interface FraudAlert {
    id: string;
    userId: string;
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    targetId: string;
    targetType: string;
    description: string;
    status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
    createdAt: Date;
}
