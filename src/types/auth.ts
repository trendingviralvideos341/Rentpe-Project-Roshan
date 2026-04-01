import { UserRole } from "./models";
export type { UserRole };

export interface Session {
    userId: string;
    email: string;
    role: UserRole;        // Active role — used for routing and JWT
    roles: string[];       // All roles this user holds e.g. ['USER', 'OWNER']
    primaryRole: string;   // Last selected dashboard context
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
