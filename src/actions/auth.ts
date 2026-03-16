"use server";

import { z } from 'zod';
import prisma from "@/lib/prisma";
import { sendEmail } from '@/lib/email';
import { WelcomeTemplate } from '@/lib/email-templates';
import { verify2FAToken } from "@/lib/2fa";
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { encryptPassword, comparePassword, signJWT, getSession } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { generateSequentialId } from "@/lib/ids";
import { NotificationService } from "@/lib/notifications";
import { Session, UserRole } from '@/types/auth';

const SignupSchema = z.object({
    name: z.string().min(3),
    email: z.string().email(),
    password: z.string()
        .min(8, "Password must be at least 8 characters long")
        .regex(/[A-Z]/, "Must contain one uppercase letter")
        .regex(/[a-z]/, "Must contain one lowercase letter")
        .regex(/[0-9]/, "Must contain one number"),
    phone: z.string().startsWith("+91").length(13),
    role: z.enum(["USER", "OWNER"]),
    otp: z.string().length(6, "OTP must be 6 digits"),
    agreed: z.boolean().refine(v => v === true, "You must agree to the Terms of Service"),
    marketingAgreed: z.boolean().optional(),
    dataSharingAgreed: z.boolean().optional(),
    hp: z.string().max(0, "Bot detected").optional(), // Honeypot
});

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

export async function signup(formData: FormData) {
    const data = Object.fromEntries(formData.entries());

    const validated = SignupSchema.safeParse({
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        role: data.role,
        otp: data.otp,
        agreed: data.agreed === 'true' || data.agreed === 'on',
        marketingAgreed: data.marketingAgreed === 'true' || data.marketingAgreed === 'on',
        dataSharingAgreed: data.dataSharingAgreed === 'true' || data.dataSharingAgreed === 'on',
        hp: data.hp,
    });

    if (!validated.success) {
        const errs = validated.error.flatten().fieldErrors;
        return { error: Object.values(errs).flat()[0] || "Validation failed" };
    }
    const { name, email, password, phone, role, otp, marketingAgreed, dataSharingAgreed } = validated.data;

    // OTTP Verification (Mock logic - in production sync with SMS provider)
    if (otp !== "123456") {
        return { error: "Invalid OTP. For testing, please use 123456." };
    }

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return { error: 'User already exists' };
        }

        const hashedPassword = await encryptPassword(password);

        const roleUp = role.toUpperCase();
        const isOwner = roleUp === "OWNER";
        const isStudent = roleUp === "USER";

        const displayId = await generateSequentialId(role === 'OWNER' ? 'OWNER' : 'USER');

        const user = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash: hashedPassword,
                phone,
                phoneVerified: true, // They verified OTP in Signup UI
                role: roleUp,
                roles: roleUp,          // comma-separated for future multi-role
                isStudent,
                isOwner,
                displayId,
                applicationId: displayId,
            }
        });

        // Log T&C Consent for legal compliance (DPDP Phase 2/3)
        logAuditEvent({
            actorId: user.id,
            actorRole: user.role,
            actorName: user.name || 'User',
            actionType: 'CREATE',
            entityType: 'USER',
            entityId: user.id,
            description: `User signed up and agreed to: T&C: true, Marketing: ${marketingAgreed}, DataSharing: ${dataSharingAgreed}`,
            newValue: { marketingAgreed, dataSharingAgreed }
        });

        // Send Welcome Email (async, don't block redirect)
        sendEmail({
            to: email,
            subject: 'Welcome to RentPe! 🚀',
            html: WelcomeTemplate(name),
        }).catch(err => console.error('Failed to send welcome email:', err));

        return { success: true };

    } catch (e) {
        console.error("Signup Error:", e);
        return { error: 'Registration failed. Please try again.' };
    }
}

export async function login(formData: FormData) {
    const data = Object.fromEntries(formData.entries());

    const validated = LoginSchema.safeParse({
        email: data.email,
        password: data.password,
    });

    if (!validated.success) {
        return { error: 'Invalid email or password' };
    }

    const { email, password } = validated.data;

    try {
        // Fetch all needed fields explicitly
        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                passwordHash: true,
                role: true,
                roles: true,
                name: true,
                status: true,
                adminRole: true,
                displayId: true,
                phone: true,
                twoFactorEnabled: true,
                twoFactorSecret: true,
            }
        });

        if (!user) {
            // Security Phase 3: Log failed attempt
            // Since we don't have a user, we use a system actor or dummy ID
            logAuditEvent({
                actorId: '00000000-0000-0000-0000-000000000000',
                actorRole: 'USER',
                actorName: 'Anonymous',
                actionType: 'LOGIN',
                entityType: 'USER',
                entityId: 'ANY',
                description: `Failed login attempt for: ${email}. Reason: Invalid email.`,
            });
            return { error: 'Invalid credentials' };
        }

        if (user.status === 'BANNED' || user.status === 'INACTIVE') {
            return { error: 'Your account has been suspended. Please contact support.' };
        }

        const isMatch = await comparePassword(password, user.passwordHash);
        if (!isMatch) {
            // Security Phase 3: Log failed attempt for existing user
            logAuditEvent({
                actorId: user.id,
                actorRole: user.role,
                actorName: user.name || 'User',
                actionType: 'LOGIN',
                entityType: 'USER',
                entityId: user.id,
                description: `Failed login attempt for: ${email}. Reason: Incorrect password.`,
            });
            return { error: 'Invalid credentials' };
        }

        // 2FA Check
        if (user.twoFactorEnabled) {
            return { require2FA: true, userId: user.id };
        }

        // Update last login timestamp
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
        });

        // Create Session
        let permissions: string[] = [];
        if (user.role === 'ADMIN') {
            const emp = await prisma.employee.findUnique({
                where: { email: user.email },
                select: { permissions: true, status: true }
            });
            if (emp && emp.status === 'ACTIVE') {
                try { permissions = JSON.parse((emp as any).permissions || "[]"); } catch { }
            }
        }

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const token = await signJWT({
            userId: user.id,
            email: user.email,
            role: user.role as any,
            roles: user.roles,
            name: user.name,
            permissions,
            adminRole: user.adminRole ?? null,
            displayId: user.displayId ?? null,
            phone: user.phone ?? null,
            expiresAt,
        });

        const cookieStore = await cookies();
        cookieStore.set('rentpe_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            expires: expiresAt,
            sameSite: 'lax',
            path: '/',
        });

        // Redirect based on active role
        if (user.role === 'ADMIN') {
            redirect('/dashboard/admin');
        } else if (user.role === 'OWNER') {
            redirect('/dashboard/owner');
        } else if (user.role === 'ONBOARDER') {
            redirect('/dashboard/onboarder');
        } else if (user.role === 'VERIFIER') {
            redirect('/dashboard/verifier');
        } else {
            redirect('/');
        }
    } catch (e: any) {
        if (e.message === 'NEXT_REDIRECT') throw e;
        console.error("Login Error:", e);
        return { error: 'Something went wrong. Please try again.' };
    }
}

export async function verify2FALogin(userId: string, token: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                role: true,
                roles: true,
                name: true,
                phone: true,
                displayId: true,
                twoFactorEnabled: true,
                twoFactorSecret: true,
            }
        });

        if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
            return { error: 'Invalid session or 2FA not enabled' };
        }

        const isValid = verify2FAToken(user.twoFactorSecret, token);
        if (!isValid) {
            return { error: 'Invalid verification code' };
        }

        // Create Session
        let permissions: string[] = [];
        if (user.role === 'ADMIN') {
            const emp = await prisma.employee.findUnique({
                where: { email: user.email },
                select: { permissions: true, status: true }
            });
            if (emp && emp.status === 'ACTIVE') {
                try { permissions = JSON.parse(emp.permissions || "[]"); } catch { }
            }
        }

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const jwtToken = await signJWT({
            userId: user.id,
            email: user.email,
            role: user.role as any,
            roles: user.roles,
            name: user.name,
            phone: user.phone,
            displayId: user.displayId,
            permissions,
            expiresAt,
        });

        const cookieStore = await cookies();
        cookieStore.set('rentpe_session', jwtToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            expires: expiresAt,
            sameSite: 'lax',
            path: '/',
        });

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
        });

        return { success: true, redirect: user.role === 'ADMIN' ? '/dashboard/admin' : user.role === 'OWNER' ? '/dashboard/owner' : '/dashboard/student' };
    } catch (e) {
        console.error("2FA Login Error:", e);
        return { error: 'Authentication failed' };
    }
}

export async function logout() {
    const cookieStore = await cookies();
    cookieStore.delete('rentpe_session');
    // Do NOT call redirect() here — LogoutButton handles client-side redirect.
}

export async function switchRole(targetRole: UserRole) {
    const session = await getSession();
    if (!session || !session.userId) {
        throw new Error("Unauthorized");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.userId as string },
        select: {
            id: true,
            email: true,
            role: true,
            roles: true,
            name: true,
        }
    });

    if (!user) {
        throw new Error("User not found");
    }

    // Verify the target role is in the user's allowed roles list
    const allowedRoles = user.roles.split(',').map(r => r.trim());
    if (!allowedRoles.includes(targetRole) && user.role !== targetRole) {
        throw new Error("You do not have permission for this role");
    }

    // Update active role in DB
    await prisma.user.update({
        where: { id: user.id },
        data: { role: targetRole }
    });

    // Issue a fresh JWT with the new active role
    let permissions: string[] = [];
    let adminRole: string | null = null;
    if (targetRole === 'ADMIN') {
        const emp = await prisma.employee.findUnique({
            where: { email: user.email },
            select: { permissions: true, status: true }
        });
        if (emp && emp.status === 'ACTIVE') {
            try { permissions = JSON.parse(emp.permissions || "[]"); } catch { }
        }
        const adminUserRecord = await prisma.user.findUnique({
            where: { id: user.id },
            select: { adminRole: true }
        });
        adminRole = adminUserRecord?.adminRole ?? null;
    }

    // Fetch displayId and phone for all roles
    const fullUserRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { displayId: true, phone: true }
    });

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const token = await signJWT({
        userId: user.id,
        email: user.email,
        role: targetRole,
        roles: user.roles,
        name: user.name,
        permissions,
        adminRole,
        displayId: fullUserRecord?.displayId ?? null,
        phone: fullUserRecord?.phone ?? null,
        expiresAt,
    });

    const cookieStore = await cookies();
    cookieStore.set('rentpe_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: expiresAt,
        sameSite: 'lax',
        path: '/',
    });

    // Redirect to the new dashboard
    if (targetRole === 'ADMIN') {
        redirect('/dashboard/admin');
    } else if (targetRole === 'OWNER') {
        redirect('/dashboard/owner');
    } else if (targetRole === 'ONBOARDER') {
        redirect('/dashboard/onboarder');
    } else if (targetRole === 'VERIFIER') {
        redirect('/dashboard/verifier');
    } else {
        redirect('/dashboard/student');
    }
}

export async function checkSessionIntegrity() {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { status: 'unauthenticated' };

        const user = await prisma.user.findUnique({
            where: { id: session.userId as string },
            select: { role: true, email: true }
        });

        if (!user) return { status: 'unauthenticated' };

        // If session role and DB role don't match — another tab re-logged in
        const sessionRole = session.role as string;
        if (sessionRole !== user.role) {
            return {
                status: 'mismatch',
                currentRole: user.role,
                sessionRole,
            };
        }

        return { status: 'ok', role: user.role };
    } catch {
        return { status: 'error' };
    }
}

export async function getCurrentUser() {
    try {
        const session = await getSession();
        if (!session || !session.userId) return null;

        const user = await prisma.user.findUnique({
            where: { id: session.userId as string },
            select: {
                id: true, email: true, name: true, role: true, roles: true,
                phone: true, twoFactorEnabled: true, businessName: true, profilePhoto: true,
                staffPermissions: true, parentOwnerId: true, adminRole: true,
                adminProfile: {
                    select: {
                        permissions: true,
                        department: true,
                        role: true
                    }
                }
            }
        } as any);

        if (!user) {
            // Return session data at least
            return {
                id: session.userId,
                name: (session as any).name || null,
                email: (session as any).email || null,
                phone: null,
                role: session.role,
                createdAt: new Date().toISOString()
            };
        }

        // Parse admin permissions if they exist
        let adminPermissions: string[] = [];
        const adminProfile = (user as any).adminProfile;
        if (adminProfile?.permissions) {
            try {
                adminPermissions = JSON.parse(adminProfile.permissions);
            } catch (e) {
                console.error("Failed to parse admin permissions", e);
            }
        }

        return {
            ...user,
            name: user.name || session.name || null,
            email: user.email || session.email || null,
            permissions: adminPermissions.length > 0 ? adminPermissions : (user.adminRole === 'SUPER_ADMIN' ? [] : []), // If super admin, logic in Sidebar handles it
            isSuperAdmin: user.adminRole === 'SUPER_ADMIN'
        };
    } catch (e) {
        console.error("getCurrentUser Error:", e);
        return null;
    }
}

export async function deleteUserAccount() {
    const session = await getSession();
    if (!session || !session.userId) throw new Error("Unauthorized");

    try {
        const userId = session.userId as string;
        
        // 1. Mark user as DELETED (Anonymization)
        await prisma.user.update({
            where: { id: userId },
            data: { 
                status: 'DELETED',
                name: 'Deleted User',
                email: `deleted_${userId}@rentpe.com`,
                phone: null,
                passwordHash: 'DELETED_BY_USER'
            }
        });

        // 2. Log final audit event (Legal Trail)
        logAuditEvent({
            actorId: userId,
            actorRole: session.role as string,
            actorName: (session as any).name || 'User',
            actionType: 'DELETE',
            entityType: 'USER',
            entityId: userId,
            description: `User requested complete account erasure. KYC data and PII purged.`,
        });

        const cookieStore = await cookies();
        cookieStore.delete('rentpe_session');
        
        return { success: true };
    } catch (e) {
        console.error("Account Deletion Error:", e);
        return { error: 'Failed to process account deletion.' };
    }
}

export async function getSecurityLogs() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    return await prisma.auditLog.findMany({
        where: {
            actionType: { in: ['LOGIN_FAILURE', 'ACCOUNT_PURGED'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
    });
}
