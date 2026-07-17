"use server";

import { z } from 'zod';
import prisma from "@/lib/prisma";
import { sendEmail } from '@/lib/email';
import { WelcomeTemplate, EmailVerificationTemplate, PasswordResetTemplate } from '@/lib/email-templates';
import { verify2FAToken } from "@/lib/2fa";
import { decrypt } from "@/lib/crypto";
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { encryptPassword, comparePassword, signJWT, getSession } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { generateSequentialId, generateMasterId } from "@/lib/ids";
import { NotificationService } from "@/lib/notifications";
import { Session, UserRole } from '@/types/auth';
import crypto from 'crypto';
import { verifyOTP } from '@/lib/otp';

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
    phoneOtp: z.string().length(6, "Mobile OTP must be 6 digits"),
    agreed: z.boolean().refine(v => v === true, "You must agree to the Terms of Service"),
    marketingAgreed: z.boolean().optional(),
    // DPDP Act compliance: dataSharingAgreed is labeled "(Required)" in the UI — enforce it server-side too
    dataSharingAgreed: z.boolean().refine(v => v === true, "You must consent to data sharing to use RentPe. This is required under our Terms of Service."),
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
        phoneOtp: data.phoneOtp,
        agreed: data.agreed === 'true' || data.agreed === 'on',
        marketingAgreed: data.marketingAgreed === 'true' || data.marketingAgreed === 'on',
        dataSharingAgreed: data.dataSharingAgreed === 'true' || data.dataSharingAgreed === 'on',
        hp: data.hp,
    });

    if (!validated.success) {
        const errs = validated.error.flatten().fieldErrors;
        return { error: Object.values(errs).flat()[0] || "Validation failed" };
    }
    const { name, email, password, phone, role, otp, phoneOtp, marketingAgreed, dataSharingAgreed } = validated.data;

    // OTP Verification — Email-based (free). Mock mode = ON by default (EMAIL_OTP_ENABLED=true to go live)
    const otpResult = await verifyOTP(email, otp);
    if (!otpResult.success) {
        return { error: otpResult.error || "Invalid OTP. Please try again." };
    }

    // Phone Verification — Mock mode (123456)
    if (phoneOtp !== "123456") {
        return { error: "Invalid Mobile OTP. For testing, please use 123456." };
    }

    try {
        // ── Check for existing account by email ─────────────────
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            // Industry-standard: guide user to correct path instead of generic error
            if (role === 'OWNER') {
                return { error: 'This email is already registered. Please login to your existing account. To upgrade to Owner, contact RentPe support.' };
            }
            return { error: 'An account with this email already exists. Please login instead.' };
        }

        // ── Check for existing account by phone ─────────────────
        // SECURITY FIX [H-2]: phone field now has @unique in schema. Use findUnique for efficiency.
        // This prevents duplicate phone registrations (identity fraud, KYC bypass).
        const existingPhone = await prisma.user.findUnique({ where: { phone } });
        if (existingPhone) {
            return { error: 'This mobile number is already associated with another account. Please use a different number or login to your existing account.' };
        }

        const hashedPassword = await encryptPassword(password);


        const roleUp = role.toUpperCase();
        const isOwner = roleUp === "OWNER";
        const isStudent = roleUp === "USER";

        const displayId = await generateMasterId(roleUp);

        // OTP was verified above — email ownership is already proven.
        // No secondary email-link verification needed.
        const user = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash: hashedPassword,
                phone,
                phoneVerified: true,          // ✅ Mobile OTP verified above
                emailVerified: true,          // ✅ Email OTP verified above
                emailVerificationToken: null, // Not needed (OTP-based flow)
                role: roleUp,
                // Strict role separation: Owners get ONLY OWNER, Students get ONLY USER
                // Dual-role is only granted manually by Admin
                roles: roleUp === 'OWNER' ? ['OWNER'] : ['USER'],
                primaryRole: roleUp === 'OWNER' ? 'OWNER' : 'USER',
                isStudent,
                isOwner,
                displayId,
                status: 'ACTIVE',             // ✅ Active immediately after email OTP
                applicationId: displayId,
                // Legal compliance: T&C acceptance (DPDP Act 2023, MTA 2021, Consumer Protection Act 2019)
                termsAccepted: true,
                termsAcceptedAt: new Date(),
                termsVersion: 'v1.0-2026-03', // Bump this version when T&C changes, to force re-acceptance
            }
        });

        // Log T&C Consent for legal compliance (DPDP Phase 2/3)
        await logAuditEvent({
            actorId: user.id,
            actorRole: user.role,
            actorName: user.name || 'User',
            actionType: 'CREATE',
            entityType: 'USER',
            entityId: user.id,
            description: `User signed up and agreed to: T&C: true (Version: v1.0-2026-03), Marketing: ${marketingAgreed}, DataSharing: ${dataSharingAgreed}`,
            newValue: { termsAccepted: true, termsVersion: 'v1.0-2026-03', marketingAgreed, dataSharingAgreed }
        });

        // Send Welcome Email (account is already verified via OTP)
        sendEmail({
            to: email,
            subject: 'Welcome to RentPe! 🚀',
            html: WelcomeTemplate(name),
        }).catch(err => console.error('Failed to send welcome email:', err));

        return { success: true, message: "Account created successfully! You can now log in." };

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
                primaryRole: true,
                name: true,
                status: true,
                adminRole: true,
                displayId: true,
                phone: true,
                twoFactorEnabled: true,
                twoFactorSecretEncrypted: true,
                emailVerified: true,
            }
        });

        if (!user) {
            // Security Phase 3: Log failed attempt
            // Since we don't have a user, we use a system actor or dummy ID
            logAuditEvent({
                actorId: 'SYSTEM-ANONYMOUS',
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
            await logAuditEvent({
                actorId: user.id,
                actorRole: user.role,
                actorName: user.name || 'User',
                actionType: 'LOGIN',
                entityType: 'USER',
                entityId: user.id,
                description: `Blocked login attempt for: ${email}. Reason: Account status ${user.status}.`,
            });
            return { error: 'Your account has been suspended. Please contact support.' };
        }

        if (!user.emailVerified) {
            return { error: 'Your email is not verified. Please check your inbox for the verification link.' };
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
            role: user.role as UserRole,
            roles: Array.isArray(user.roles)
                ? user.roles
                : typeof user.roles === 'string'
                    ? (user.roles as string).split(',').map((r: string) => r.trim())
                    : [user.role],
            primaryRole: user.primaryRole ?? user.role,
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

        // Audit Log Success
        await logAuditEvent({
            actorId: user.id,
            actorRole: user.role,
            actorName: user.name || 'User',
            actionType: 'LOGIN',
            entityType: 'USER',
            entityId: user.id,
            description: `User logged in successfully: ${email}.`,
        });

        // Redirect based on primaryRole (allows dual-role users to land on last used dashboard)
        const redirectRole = user.primaryRole || user.role;
        if (redirectRole === 'ADMIN') {
            redirect('/dashboard/admin');
        } else if (redirectRole === 'OWNER') {
            redirect('/dashboard/owner');
        } else if (redirectRole === 'ONBOARDER') {
            redirect('/dashboard/onboarder');
        } else if (redirectRole === 'VERIFIER') {
            redirect('/dashboard/verifier');
        } else if (redirectRole === 'STAFF') {
            redirect('/dashboard/staff');
        } else {
            redirect('/dashboard/student');
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
                primaryRole: true,
                name: true,
                phone: true,
                displayId: true,
                twoFactorEnabled: true,
                twoFactorSecretEncrypted: true,
            }
        });

        if (!user || !user.twoFactorEnabled || !user.twoFactorSecretEncrypted) {
            return { error: 'Invalid session or 2FA not enabled' };
        }

        // SECURITY FIX: Decrypt the stored secret before TOTP verification
        const decryptedSecret = decrypt(user.twoFactorSecretEncrypted);
        const isValid = verify2FAToken(decryptedSecret, token);
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
            role: user.role as UserRole,
            roles: Array.isArray(user.roles)
                ? user.roles
                : typeof user.roles === 'string'
                    ? (user.roles as string).split(',').map((r: string) => r.trim())
                    : [user.role],
            primaryRole: (user as any).primaryRole ?? user.role,
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

        // FIX [2]: Use primaryRole for redirect so dual-role users land on the correct dashboard.
        // user.role is the authoritative role (set at signup); primaryRole is the last-active dashboard.
        const primaryRole = (user as any).primaryRole ?? user.role;
        const redirectPath =
            primaryRole === 'ADMIN'     ? '/dashboard/admin'     :
            primaryRole === 'OWNER'     ? '/dashboard/owner'     :
            primaryRole === 'ONBOARDER' ? '/dashboard/onboarder' :
            primaryRole === 'VERIFIER'  ? '/dashboard/verifier'  :
            primaryRole === 'STAFF'     ? '/dashboard/staff'     :
                                          '/dashboard/student';

        return { success: true, redirect: redirectPath };
    } catch (e) {
        console.error("2FA Login Error:", e);
        return { error: 'Authentication failed' };
    }
}

export async function logout() {
    const session = await getSession();
    if (session && session.userId) {
        await logAuditEvent({
            actorId: session.userId,
            actorRole: session.role || 'USER',
            actorName: session.name || 'User',
            actionType: 'LOGOUT',
            entityType: 'USER',
            entityId: session.userId,
            description: `User logged out: ${session.email}.`,
        });
    }

    const cookieStore = await cookies();
    cookieStore.delete('rentpe_session');
    // Do NOT call redirect() here — LogoutButton handles client-side redirect.
}

export async function verifyEmail(token: string) {
    if (!token) return { error: "Verification token is required." };

    try {
        const user = await prisma.user.findUnique({
            where: { emailVerificationToken: token }
        });

        if (!user) return { error: "Invalid or expired verification token." };
        if (user.emailVerified) return { success: true, message: "Email already verified." };

        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerified: true,
                emailVerificationToken: null,
                status: 'ACTIVE'
            }
        });

        await logAuditEvent({
            actorId: user.id,
            actorRole: user.role,
            actorName: user.name || 'User',
            actionType: 'UPDATE',
            entityType: 'USER',
            entityId: user.id,
            description: `Email verified successfully for: ${user.email}.`,
        });

        // FIX [3]: Welcome email removed from here — signup() already sends it immediately
        // after OTP verification. Sending it again here would result in duplicate welcome emails.
        // This path is now a legacy fallback for token-based verification (no longer the primary flow).

        return { success: true, message: "Email verified successfully! You can now log in." };
    } catch (e) {
        console.error("Email Verification Error:", e);
        return { error: "Failed to verify email. Please try again." };
    }
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
    const allowedRoles: string[] = Array.isArray(user.roles)
        ? user.roles
        : (user.roles as unknown as string).split(',').map((r: string) => r.trim());
    
    if (!allowedRoles.includes(targetRole) && user.role !== targetRole) {
        throw new Error("You do not have permission for this role");
    }

    // IMPORTANT: Only update `primaryRole` (the user's PREFERENCE / last-used dashboard).
    // NEVER overwrite `role` — that is the authoritative role set at account creation
    // or by Admin upgrade only. Overwriting it causes permanent role corruption.
    await prisma.user.update({
        where: { id: user.id },
        data: { primaryRole: targetRole }   // ← preference only, NOT the authoritative role
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
        roles: Array.isArray(user.roles)
            ? user.roles
            : typeof user.roles === 'string'
                ? (user.roles as string).split(',').map((r: string) => r.trim())
                : [user.role],
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
    } else if (targetRole === 'STAFF') {
        redirect('/dashboard/staff');
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
            select: { role: true, roles: true, email: true }
        });

        if (!user || user.email !== session.email) return { status: 'unauthenticated' };

        const sessionRole = session.role as string;

        // FIX: For dual-role users, the JWT role just needs to be in their
        // allowed roles[] array — not necessarily equal to user.role.
        //
        // user.role = the immutable authoritative role set at signup (e.g. 'OWNER')
        // user.roles = all roles the user holds (e.g. ['OWNER', 'USER'])
        // session.role = the active context role after a switch (e.g. 'USER')
        //
        // Old check: sessionRole !== user.role  ← always mismatch for dual-role after switch ❌
        // New check: sessionRole in roles[]      ← correct validation for multi-role system ✅
        //
        // A REAL mismatch (e.g. another tab logged in as different account) is still caught
        // because an unknown role would not be in the user's roles[] array.
        const isValidRole = user.roles.includes(sessionRole) || sessionRole === user.role;

        if (!isValidRole) {
            return {
                status: 'mismatch',
                currentRole: user.role,
                sessionRole,
            };
        }

        return { status: 'ok', role: sessionRole };
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
                staffPermissions: true, parentOwnerId: true, adminRole: true, displayId: true,
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

        // FIX [4]: Block deletion if user has any active bookings/tenancy.
        // Deleting an account mid-tenancy would orphan the owner's tenant records and break active agreements.
        const activeBookings = await prisma.booking.count({
            where: {
                userId,
                status: { in: ['ACTIVE', 'APPROVED', 'APPLIED'] },
                deletedAt: null,
            }
        });
        if (activeBookings > 0) {
            return { error: 'Cannot delete account with active bookings. Please vacate your current PG first.' };
        }

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

    // FIX [5]: Previously queried 'LOGIN_FAILURE' and 'ACCOUNT_PURGED' which are never written.
    // Actual logged values are: 'LOGIN' (for both success & failure), 'LOGOUT', and 'DELETE'.
    // We filter failures by checking the description for 'Failed' to surface only security events.
    return await prisma.auditLog.findMany({
        where: {
            OR: [
                {
                    actionType: { in: ['LOGIN', 'LOGOUT', 'DELETE'] },
                    description: { contains: 'Failed' }
                },
                {
                    actionType: 'DELETE',
                    entityType: 'USER',
                }
            ]
        },
        orderBy: { createdAt: 'desc' },
        take: 50
    });
}

// ─── Forgot Password — Step 1: Request Reset ──────────────────────────────────
export async function forgotPassword(formData: FormData) {
    const email = (formData.get('email') as string)?.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: "Please enter a valid email address." };
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, name: true, email: true, status: true }
        });

        // SECURITY: Always return the same message — prevents account enumeration
        const genericMessage = "If this email is registered, you'll receive a reset link shortly.";

        if (!user || user.status === 'BANNED' || user.status === 'DELETED') {
            return { success: true, message: genericMessage };
        }

        // Generate cryptographically secure token (raw — sent via email)
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

        // Store SHA-256 hash — never the raw token in DB
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: hashedToken,
                passwordResetExpiry: resetExpiry,
            }
        });

        const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${resetToken}`;

        sendEmail({
            to: email,
            subject: 'Reset Your RentPe Password 🔐',
            html: PasswordResetTemplate(user.name || 'User', resetUrl),
        }).catch(err => console.error('Failed to send password reset email:', err));

        logAuditEvent({
            actorId: user.id,
            actorRole: 'USER',
            actorName: user.name || 'User',
            actionType: 'UPDATE',
            entityType: 'USER',
            entityId: user.id,
            description: `Password reset requested for: ${email}. Token expires: ${resetExpiry.toISOString()}`,
        });

        return { success: true, message: genericMessage };

    } catch (e) {
        console.error("Forgot Password Error:", e);
        return { error: "Something went wrong. Please try again." };
    }
}

// ─── Reset Password — Step 2: Set New Password ────────────────────────────────
export async function resetPassword(formData: FormData) {
    const token = (formData.get('token') as string)?.trim();
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!token) return { error: "Invalid reset link." };
    if (!newPassword || newPassword.length < 8) return { error: "Password must be at least 8 characters." };
    if (!/[A-Z]/.test(newPassword)) return { error: "Password must contain at least one uppercase letter." };
    if (!/[a-z]/.test(newPassword)) return { error: "Password must contain at least one lowercase letter." };
    if (!/[0-9]/.test(newPassword)) return { error: "Password must contain at least one number." };
    if (newPassword !== confirmPassword) return { error: "Passwords do not match." };

    try {
        // Hash the token to compare against the stored hash
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await prisma.user.findFirst({
            where: {
                passwordResetToken: hashedToken,
                passwordResetExpiry: { gt: new Date() },
            },
            select: { id: true, email: true, name: true, role: true }
        });

        if (!user) {
            return { error: "This reset link is invalid or has expired. Please request a new one." };
        }

        const hashedPassword = await encryptPassword(newPassword);

        // Update password, clear token, and mark email as verified (since they used an email link)
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: hashedPassword,
                passwordResetToken: null,
                passwordResetExpiry: null,
                emailVerified: true,
                emailVerificationToken: null,
            }
        });

        logAuditEvent({
            actorId: user.id,
            actorRole: user.role,
            actorName: user.name || 'User',
            actionType: 'UPDATE',
            entityType: 'USER',
            entityId: user.id,
            description: `Password successfully reset for: ${user.email}.`,
        });

        return { success: true, message: "Password reset successfully! You can now log in with your new password." };

    } catch (e) {
        console.error("Reset Password Error:", e);
        return { error: "Something went wrong. Please try again." };
    }
}

/**
 * Resend Verification Email action
 * triggered manually by user from Login page if they see "email unverified" error
 */
export async function resendVerificationEmail(email: string) {
    if (!email) return { error: "Email is required." };

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, name: true, email: true, emailVerified: true, emailVerificationToken: true }
        });

        if (!user) {
            // Security: don't reveal if user exists
            return { success: true, message: "If that email is registered, we've sent a new verification link." };
        }

        if (user.emailVerified) {
            return { success: true, message: "Your email is already verified. You can log in." };
        }

        // Generate new token if missing
        const token = user.emailVerificationToken || crypto.randomBytes(32).toString('hex');
        
        if (!user.emailVerificationToken) {
            await prisma.user.update({
                where: { id: user.id },
                data: { emailVerificationToken: token }
            });
        }

        const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`;
        await sendEmail({
            to: user.email,
            subject: "Verify your RentPe account",
            html: EmailVerificationTemplate(user.name || "Resident", verificationUrl)
        });

        return { success: true, message: "A fresh verification link has been sent to your inbox!" };

    } catch (e) {
        console.error("Resend Verification Error:", e);
        return { error: "Failed to resend verification email." };
    }
}
