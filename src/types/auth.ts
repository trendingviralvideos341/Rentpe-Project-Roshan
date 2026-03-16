import { UserRole } from "./models";
export type { UserRole };

export interface Session {
    userId: string;
    email: string;
    role: UserRole;
    roles: string | UserRole[]; // Accept both for transition
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
