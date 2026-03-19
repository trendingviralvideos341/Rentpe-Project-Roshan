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
    status: string;
    propertyType: string;
    genderType: string;
    averageRating: number;
    reviewCount: number;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
    ownerName?: string | null;
    businessName?: string | null;
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
    | 'KYC_PENDING' 
    | 'KYC_REJECTED' 
    | 'AGREEMENT_PENDING' 
    | 'BOOKING_CONFIRMED' 
    | 'CHECKED_IN' 
    | 'PAID' 
    | 'CASH_PAID' 
    | 'CANCELLED' 
    | 'COMPLETED';

export interface Booking {
    id: string;
    displayId: string;
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
    createdAt: Date;
    updatedAt: Date;
}

export interface TenantDocument {
    id: string;
    bookingId: string;
    type: string;
    fileData: string;
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
