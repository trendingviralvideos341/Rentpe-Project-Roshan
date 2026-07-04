import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { rateLimits } from '@/lib/ratelimit';

// SECURITY FIX [C-4]: Guard against empty string JWT_SECRET. Crash loudly rather than use an unsafe default.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
    throw new Error("CRITICAL: JWT_SECRET is not set or is empty. Cannot verify session tokens.");
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// Define protected and public routes
const protectedRoutes = ['/dashboard'];
const publicRoutes = ['/login', '/signup', '/'];

export default async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;
    const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
    const isPublicRoute = publicRoutes.some(route => path === route);

    const token = req.cookies.get('rentpe_session')?.value;

    // 1. Decrypt session
    let session: any = null;
    if (token) {
        try {
            const { payload } = await jwtVerify(token, JWT_SECRET);
            session = payload;
        } catch (e) {
            // Token expired or invalid
        }
    }

    // 2. Upstash Redis Rate Limiting (production-grade, distributed)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';

    let limiter: (typeof rateLimits)[keyof typeof rateLimits] | null = null;
    const isAuthPath = path.startsWith('/auth/') || path.startsWith('/api/auth/') || path === '/login' || path === '/signup';
    if (isAuthPath) {
        // Strict auth limit (5/min) should only apply to form submissions/actions (POST)
        // Page views (GET) use the more generous API limit to avoid prefetching lockouts
        limiter = req.method === 'GET' ? rateLimits.api : rateLimits.auth;
    } else if (path.startsWith('/api/payments/')) {
        limiter = rateLimits.payment;
    } else if (path.includes('/properties/') || path.includes('/bookings/')) {
        limiter = rateLimits.lookup;
    } else if (path.startsWith('/api/')) {
        limiter = rateLimits.api;
    }

    if (limiter) {
        try {
            const { success, reset } = await limiter.limit(`${ip}-${session?.userId ?? 'anon'}`);
            if (!success) {
                const retryAfter = Math.ceil((reset - Date.now()) / 1000);
                return new NextResponse(
                    JSON.stringify({ error: "Too many requests.", retryAfter }),
                    { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': retryAfter.toString() } }
                );
            }
        } catch {
            // If Redis is unavailable, fail open (don't block users)
            console.warn('Rate limit check failed — Redis may be unavailable');
        }
    }

    // 2. Redirect to /login if not authenticated and trying to access protected route
    if (isProtectedRoute && !session) {
        return NextResponse.redirect(new URL('/login', req.nextUrl));
    }

    // 3. Strict Role-Based Access Control (RBAC) on Dashboards
    if (isProtectedRoute && session) {
        const role = (session as any).role;
        const roles: string[] = Array.isArray((session as any).roles)
            ? (session as any).roles
            : typeof (session as any).roles === 'string'
                ? (session as any).roles.split(',').map((r: string) => r.trim())
                : [role];
        const isImpersonating = !!(session as any).impersonatorId;

        // Block non-Admins from Admin dashboard (strict — roles array must include ADMIN)
        if (path.startsWith('/dashboard/admin') && !roles.includes('ADMIN') && role !== 'ADMIN') {
            if (roles.includes('OWNER') || role === 'OWNER') return NextResponse.redirect(new URL('/dashboard/owner', req.nextUrl));
            if (roles.includes('STAFF') || role === 'STAFF') return NextResponse.redirect(new URL('/dashboard/staff', req.nextUrl));
            return NextResponse.redirect(new URL('/dashboard/student', req.nextUrl));
        }

        // Block non-Staff from Staff dashboard
        if (path.startsWith('/dashboard/staff') && !roles.includes('STAFF') && role !== 'STAFF') {
            if (roles.includes('ADMIN') || role === 'ADMIN') return NextResponse.redirect(new URL('/dashboard/admin', req.nextUrl));
            if (roles.includes('OWNER') || role === 'OWNER') return NextResponse.redirect(new URL('/dashboard/owner', req.nextUrl));
            return NextResponse.redirect(new URL('/dashboard/student', req.nextUrl));
        }

        // ── CRITICAL RBAC & IDENTITY HARDENING ──
        // (1) Redirect any privileged role (ADMIN, OWNER, STAFF) away from /dashboard/student
        // unless they are dual-role (USER + OWNER) AND have explicitly switched to 'USER' mode.
        if (path.startsWith('/dashboard/student')) {
            // Admin landing on student? Send them back to admin.
            if (role === 'ADMIN' || roles.includes('ADMIN')) {
                return NextResponse.redirect(new URL('/dashboard/admin', req.nextUrl));
            }
            
            // Staff landing on student? Send them back to staff.
            if (role === 'STAFF' || roles.includes('STAFF')) {
                return NextResponse.redirect(new URL('/dashboard/staff', req.nextUrl));
            }

            // Owner landing on student:
            // (a) If they ONLY have the OWNER role → Redirect to /dashboard/owner
            // (b) If they are dual-role (USER + OWNER) BUT their active session role is 'OWNER' → Redirect to /dashboard/owner
            const isOwner = role === 'OWNER' || roles.includes('OWNER');
            const isUser = role === 'USER' || roles.includes('USER');
            
            if (isOwner && !isUser) {
                return NextResponse.redirect(new URL('/dashboard/owner', req.nextUrl));
            }

            // Dual-role users whose active session role is NOT 'USER' (i.e. they are in 'OWNER' mode)
            // should not be allowed on the student dashboard. Land them on Owner.
            if (isOwner && isUser && role !== 'USER') {
                return NextResponse.redirect(new URL('/dashboard/owner', req.nextUrl));
            }

            // Only pure Students OR Dual-role users in 'USER' mode are allowed through.
        }

        // (2) Block non-Owner users from Owner dashboard
        if (path.startsWith('/dashboard/owner') && !roles.includes('OWNER') && role !== 'OWNER') {
            if (roles.includes('ADMIN') || role === 'ADMIN') return NextResponse.redirect(new URL('/dashboard/admin', req.nextUrl));
            // Un-upgraded students → student dashboard
            return NextResponse.redirect(new URL('/dashboard/student', req.nextUrl));
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

// Middleware runs on all routes except static files and Next.js internals.
// This ensures rate limiting applies to API routes too.
// RBAC redirect logic only fires for /dashboard/* routes.
export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|css|js)$).*)',
    ],
};
