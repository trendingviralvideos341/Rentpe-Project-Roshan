'use server';

import { z } from 'zod';
import prisma from "@/lib/prisma";
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { encryptPassword, comparePassword, signJWT } from '@/lib/auth';

const SignupSchema = z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(["USER", "OWNER"]),
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
        role: data.role,
    });

    if (!validated.success) {
        return { error: 'Invalid data' };
    }

    const { firstName, lastName, email, password, role } = validated.data;

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

        await prisma.user.create({
            data: {
                name: `${firstName} ${lastName}`,
                email,
                passwordHash: hashedPassword,
                role: role.toUpperCase(),
                displayId,
            }
        });
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
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return { error: 'Invalid credentials' };
        }

        const isMatch = await comparePassword(password, user.passwordHash);
        if (!isMatch) {
            return { error: 'Invalid credentials' };
        }

        // Create Session
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const token = await signJWT({
            userId: user.id,
            email: user.email,
            role: user.role,
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

        // Redirect based on role
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
        // Handle redirect "error" which is actually a Next.js control flow mechanism
        if (e.message === 'NEXT_REDIRECT') throw e;
        console.error("Login Error:", e);
        return { error: 'Something went wrong. Please try again.' };
    }
}

export async function logout() {
    const cookieStore = await cookies();
    cookieStore.delete('rentpe_session');
    // Do NOT call redirect() here — it throws and prevents client router.push from firing.
    // The LogoutButton component handles the redirect via router.push('/login').
}
