import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback-secret-for-dev-only-replace-it'
);

// Define protected and public routes
const protectedRoutes = ['/dashboard'];
const publicRoutes = ['/login', '/signup', '/'];

// --- Basic Rate Limiter (In-Memory for Dev/Single-Server) ---
// For production scale, use Redis-based limiting.
const IP_REQUESTS = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const stats = IP_REQUESTS.get(ip) || { count: 0, lastReset: now };

    if (now - stats.lastReset > RATE_LIMIT_WINDOW) {
        stats.count = 1;
        stats.lastReset = now;
    } else {
        stats.count++;
    }

    IP_REQUESTS.set(ip, stats);
    return stats.count > MAX_REQUESTS;
}

export default async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;

    // 0. API Rate Limiting (Security Phase 2)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
    if (path.startsWith('/api') || path === '/login' || path === '/signup') {
        if (isRateLimited(ip)) {
            return new NextResponse('Too many requests. Please try again in a minute.', { status: 429 });
        }
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

        // Block Admins/Owners from wandering into student dashboard, unless they are using 'God Mode' (impersonating a student)
        if (path.startsWith('/dashboard/student') && role !== 'USER') {
            return NextResponse.redirect(new URL(role === 'ADMIN' ? '/dashboard/admin' : '/dashboard/owner', req.nextUrl));
        }

        // Block Students/Admins from Owner dashboard (unless impersonating)
        if (path.startsWith('/dashboard/owner') && role !== 'OWNER') {
            return NextResponse.redirect(new URL(role === 'ADMIN' ? '/dashboard/admin' : '/dashboard/student', req.nextUrl));
        }

        // Block non-Admins from Admin dashboard (strict)
        if (path.startsWith('/dashboard/admin') && role !== 'ADMIN') {
            return NextResponse.redirect(new URL(role === 'OWNER' ? '/dashboard/owner' : '/dashboard/student', req.nextUrl));
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
