import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

if (!process.env.JWT_SECRET) {
    throw new Error("CRITICAL: JWT_SECRET environment variable is not set! This is required to secure user sessions.");
}

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'unsafe-development-secret-key-1234567890'
);

// Define protected and public routes
const protectedRoutes = ['/dashboard'];
const publicRoutes = ['/login', '/signup', '/'];

// --- Basic Rate Limiter (In-Memory for Dev/Single-Server) ---
// --- Granular Rate Limiting (In-Memory) ---
const IP_REQUESTS = new Map<string, { count: number; lastReset: number }>();

const RATE_LIMITS = {
    DEFAULT: { count: 60, window: 60 * 1000 },
    LOGIN: { count: 10, window: 60 * 1000 },  // 10 attempts per minute
    SIGNUP: { count: 5, window: 60 * 1000 },   // 5 attempts per minute (stricter)
};

function checkRateLimit(ip: string, action: keyof typeof RATE_LIMITS = 'DEFAULT'): boolean {
    const now = Date.now();
    const key = `${ip}:${action}`;
    const limit = RATE_LIMITS[action];
    
    const stats = IP_REQUESTS.get(key) || { count: 0, lastReset: now };

    if (now - stats.lastReset > limit.window) {
        stats.count = 1;
        stats.lastReset = now;
    } else {
        stats.count++;
    }

    IP_REQUESTS.set(key, stats);
    return stats.count > limit.count;
}

export default async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;

    // 0. API Rate Limiting (Security Phase 2)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
    
    let rateLimited = false;
    if (path === '/login') {
        rateLimited = checkRateLimit(ip, 'LOGIN');
    } else if (path === '/signup') {
        rateLimited = checkRateLimit(ip, 'SIGNUP');
    } else if (path.startsWith('/api')) {
        rateLimited = checkRateLimit(ip, 'DEFAULT');
    }

    if (rateLimited) {
        return new NextResponse('Too many requests. Please try again in a minute.', { status: 429 });
    }
    const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
    const isPublicRoute = publicRoutes.some(route => path === route);

    const token = req.cookies.get('rentpe_session')?.value;

    // 1. Decrypt session
    let session = null;
    if (token) {
        try {
            const { payload } = await jwtVerify(token, JWT_SECRET);
            session = payload;
        } catch (e) {
            // Token expired or invalid
        }
    }

    // 2. Redirect to /login if not authenticated and trying to access protected route
    if (isProtectedRoute && !session) {
        return NextResponse.redirect(new URL('/login', req.nextUrl));
    }

    // 3. Strict Role-Based Access Control (RBAC) on Dashboards
    if (isProtectedRoute && session) {
        const role = (session as any).role;
        const isImpersonating = !!(session as any).impersonatorId;

        // Block non-Admins from Admin dashboard (strict)
        if (path.startsWith('/dashboard/admin') && role !== 'ADMIN') {
            return NextResponse.redirect(new URL(role === 'OWNER' ? '/dashboard/owner' : (role === 'STAFF' ? '/dashboard/staff' : '/dashboard/student'), req.nextUrl));
        }

        // Block non-Staff from Staff dashboard
        if (path.startsWith('/dashboard/staff') && role !== 'STAFF') {
            return NextResponse.redirect(new URL(role === 'ADMIN' ? '/dashboard/admin' : (role === 'OWNER' ? '/dashboard/owner' : '/dashboard/student'), req.nextUrl));
        }

        // --- Role-Specific Restrictions for Dashboard Overlaps ---
        // (Prevent STAFF from accessing STUDENT or OWNER routes, and vice versa)
        if (path.startsWith('/dashboard/student') && role !== 'USER') {
            return NextResponse.redirect(new URL(role === 'ADMIN' ? '/dashboard/admin' : (role === 'OWNER' ? '/dashboard/owner' : '/dashboard/staff'), req.nextUrl));
        }

        if (path.startsWith('/dashboard/owner') && role !== 'OWNER') {
            return NextResponse.redirect(new URL(role === 'ADMIN' ? '/dashboard/admin' : (role === 'STAFF' ? '/dashboard/staff' : '/dashboard/student'), req.nextUrl));
        }

        // Legacy staff routes redirection
        if (path.startsWith('/dashboard/onboarder') && role !== 'ONBOARDER') {
            return NextResponse.redirect(new URL('/', req.nextUrl));
        }
        if (path.startsWith('/dashboard/verifier') && role !== 'VERIFIER') {
            return NextResponse.redirect(new URL('/', req.nextUrl));
        }
    }

    // 4. Redirect to dashboard if trying to access auth pages while logged in
    if (isPublicRoute && session && (path === '/login' || path === '/signup')) {
        const role = (session as any).role;
        if (role === 'ADMIN') {
            return NextResponse.redirect(new URL('/dashboard/admin', req.nextUrl));
        } else if (role === 'OWNER') {
            return NextResponse.redirect(new URL('/dashboard/owner', req.nextUrl));
        } else if (role === 'STAFF') {
            return NextResponse.redirect(new URL('/dashboard/staff', req.nextUrl));
        } else {
            return NextResponse.redirect(new URL('/dashboard/student', req.nextUrl));
        }
    }

    return NextResponse.next();
}

// Routes Middleware should not run on
export const config = {
    matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
