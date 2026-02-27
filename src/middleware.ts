import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback-secret-for-dev-only-replace-it'
);

// Define protected and public routes
const protectedRoutes = ['/dashboard'];
const publicRoutes = ['/login', '/signup', '/'];

export default async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;
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

    // 3. Redirect to dashboard if trying to access auth pages while logged in
    if (isPublicRoute && session && (path === '/login' || path === '/signup')) {
        const role = (session as any).role;
        if (role === 'ADMIN') {
            return NextResponse.redirect(new URL('/dashboard/admin', req.nextUrl));
        } else if (role === 'OWNER') {
            return NextResponse.redirect(new URL('/dashboard/owner', req.nextUrl));
        }
    }

    return NextResponse.next();
}

// Routes Middleware should not run on
export const config = {
    matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
