import { SignJWT, jwtVerify } from 'jose';
import { hash, compare } from 'bcryptjs';
import { cookies } from 'next/headers';
import { Session } from '@/types/auth';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback-secret-for-dev-only-replace-it'
);

export async function encryptPassword(password: string) {
    return hash(password, 10);
}

export async function comparePassword(password: string, hashedPassword: string) {
    return compare(password, hashedPassword);
}

export async function signJWT(payload: Partial<Session> & Record<string, any>) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(JWT_SECRET);
}

export async function verifyJWT(token: string): Promise<Session | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload as unknown as Session;
    } catch (e) {
        return null;
    }
}

export async function getSession(): Promise<Session | null> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('rentpe_session')?.value;
        if (!token) return null;
        return verifyJWT(token);
    } catch (e) {
        // Fallback for build time or errors
        return null;
    }
}
