"use server";

import { z } from 'zod';
import prisma from "@/lib/prisma";
import { sendEmail } from '@/lib/email';
import { WelcomeTemplate } from '@/lib/email-templates';
import { verify2FAToken } from "@/lib/2fa";
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { encryptPassword, comparePassword, signJWT, getSession } from '@/lib/auth';

const SignupSchema = z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    phone: z.string().startsWith("+91").length(13),
    role: z.enum(["USER", "OWNER"]),
    agreed: z.boolean().refine(v => v === true, "You must agree to the Terms of Service"),
});

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

export async function signup(formData: FormData) {
    const data = Object.fromEntries(formData.entries());

    const validated = SignupSchema.safeParse({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        phone: data.phone,
        role: data.role,
        agreed: data.agreed === 'true' || data.agreed === 'on',
    });

    if (!validated.success) {
        return { error: 'Invalid data' };
    }

    const { firstName, lastName, email, password, phone, role } = validated.data;

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return { error: 'User already exists' };
        }

        const hashedPassword = await encryptPassword(password);

        // Generate unique human-readable ID based on role
        const roleUp = role.toUpperCase();
        const count = await prisma.user.count({ where: { role: roleUp } });
        const seq = String(count + 1).padStart(6, '0');
        const prefixMap: Record<string, string> = { OWNER: 'OW', USER: 'TNT', ADMIN: 'ADM', ONBOARDER: 'ONB', VERIFIER: 'VER' };
        const prefix = prefixMap[roleUp] || 'USR';
        const displayId = `${prefix}-${seq}`;

        const isOwner = roleUp === "OWNER";
        const isStudent = roleUp === "USER";

        const user = await prisma.user.create({
            data: {
                name: `${firstName} ${lastName}`,
                email,
                passwordHash: hashedPassword,
                phone,
                role: roleUp,
                roles: roleUp,          // comma-separated for future multi-role
                isStudent,
                isOwner,
                displayId,
            }
        });

        // Log T&C Consent for legal compliance
        await prisma.auditLog.create({
            data: {
                action: 'TC_CONSENT_GIVEN',
                targetId: user.id,
                targetType: 'USER',
                details: `User agreed to Terms of Service, Privacy Policy, and Tenant Agreement at signup.`,
                performedBy: user.id
            }
        });

        // Send Welcome Email (async, don't block redirect)
        sendEmail({
            to: email,
            subject: 'Welcome to RentPe! 🚀',
            html: WelcomeTemplate(`${firstName} ${lastName}`),
        }).catch(err => console.error('Failed to send welcome email:', err));

    } catch (e) {
        console.error("Signup Error:", e);
        return { error: 'Database connection failed. Please try again later.' };
    }

    redirect('/login');
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
            } as any
        });

        if (!user) {
            return { error: 'Invalid credentials' };
        }

        if ((user as any).status === 'BANNED' || (user as any).status === 'INACTIVE') {
            return { error: 'Your account has been suspended. Please contact support.' };
        }

        const isMatch = await comparePassword(password, (user as any).passwordHash);
        if (!isMatch) {
            return { error: 'Invalid credentials' };
        }

        // 2FA Check
        if ((user as any).twoFactorEnabled) {
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
                try { permissions = JSON.parse(emp.permissions || "[]"); } catch { }
            }
        }

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const token = await signJWT({
            userId: (user as any).id,
            email: (user as any).email,
            role: (user as any).role,
            roles: (user as any).roles,
            name: (user as any).name,
            permissions,
            adminRole: (user as any).adminRole ?? null,
            displayId: (user as any).displayId ?? null,
            phone: (user as any).phone ?? null,
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
        if ((user as any).role === 'ADMIN') {
            redirect('/dashboard/admin');
        } else if ((user as any).role === 'OWNER') {
            redirect('/dashboard/owner');
        } else if ((user as any).role === 'ONBOARDER') {
            redirect('/dashboard/onboarder');
        } else if ((user as any).role === 'VERIFIER') {
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

        if (!user || !(user as any).twoFactorEnabled || !(user as any).twoFactorSecret) {
            return { error: 'Invalid session or 2FA not enabled' };
        }

        const isValid = verify2FAToken((user as any).twoFactorSecret, token);
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
            role: user.role,
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

export async function switchRole(targetRole: string) {
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
                impersonatorId: true, twoFactorEnabled: true
            } as any
        });

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

        return {
            ...user,
            name: user.name || (session as any).name || null,
            email: user.email || (session as any).email || null,
        };
    } catch (e) {
        console.error("getCurrentUser Error:", e);
        return null;
    }
}
