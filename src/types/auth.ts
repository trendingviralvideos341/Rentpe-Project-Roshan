export type UserRole = 'USER' | 'OWNER' | 'ADMIN' | 'ONBOARDER' | 'VERIFIER';

export interface Session {
    userId: string;
    email: string;
    role: string;
    roles: string; // Comma separated string
    name: string | null;
    permissions?: string[];
    adminRole?: string | null;
    displayId?: string | null;
    phone?: string | null;
    expiresAt: Date;
    impersonatorId?: string | null; // For admin impersonation
}

export type JWTPayload = Session & {
    iat?: number;
    exp?: number;
};
