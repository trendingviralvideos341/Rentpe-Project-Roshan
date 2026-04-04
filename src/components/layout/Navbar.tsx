'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Home, ArrowLeftRight, Loader2, Eye, Building, Search, Info, LayoutDashboard, PlusCircle, Users } from 'lucide-react';
import { useState, useTransition } from 'react';
import { switchRole } from '@/actions/auth';
import { UserRole } from '@/types/auth';
import { stopImpersonation } from '@/actions/admin-auth';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import NotificationBell from '@/components/layout/NotificationBell';

export function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

const Navbar = ({ session }: { session: any }) => {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const rolesList: string[] = Array.isArray(session?.roles)
        ? session.roles
        : typeof session?.roles === 'string'
            ? session.roles.split(',').map((r: string) => r.trim())
            : [session?.role].filter(Boolean);

    const hasOwnerAccess = rolesList.includes('OWNER');
    const hasAdminAccess = rolesList.includes('ADMIN');
    const hasStaffAccess = rolesList.includes('STAFF');

    const isOwner = session?.role === "OWNER";
    const isAdmin = session?.role === "ADMIN";
    const isLoggedIn = !!session;
    const userRole = isOwner ? "Owner" : isAdmin ? "Admin" : session ? "Student" : null;
    const hasMultipleRoles = hasOwnerAccess && (rolesList.includes('USER') || rolesList.includes('STUDENT'));

    const handleSwitch = (target: UserRole) => {
        startTransition(async () => {
            try {
                await switchRole(target);
            } catch (err) {
                console.error("Switch failed", err);
            }
        });
    };

    // The Dashboard button should take the user to their business context if they have one.
    // Logic: If session.role is explicitly set, use it. Otherwise, default to highest available.
    let dashboardHref = "/dashboard/student";
    if (session?.role === 'ADMIN' || (hasAdminAccess && !session?.role)) {
        dashboardHref = "/dashboard/admin";
    } else if (session?.role === 'OWNER' || (hasOwnerAccess && !session?.role)) {
        dashboardHref = "/dashboard/owner";
    } else if (session?.role === 'STAFF' || (hasStaffAccess && !session?.role)) {
        dashboardHref = "/dashboard/staff";
    } else if (session?.role === 'USER') {
        dashboardHref = "/dashboard/student";
    }

    const isImpersonating = !!session?.impersonatorId;

    const handleStopImpersonation = () => {
        startTransition(async () => {
            try {
                const returnUrl = await stopImpersonation();
                router.push(returnUrl);
            } catch (err) {
                console.error("Stop impersonation failed", err);
            }
        });
    };

    return (
        <>
            {isImpersonating && (
                <div className="w-full bg-red-600 text-white text-sm font-bold py-2 px-4 flex justify-between items-center z-[60] relative">
                    <div className="flex items-center gap-2 animate-pulse">
                        <Eye className="h-4 w-4" />
                        [GOD MODE] IMPERSONATING: {session?.name || session?.user?.name || userRole}
                    </div>
                    <button
                        onClick={handleStopImpersonation}
                        disabled={isPending}
                        suppressHydrationWarning
                        className="bg-white text-red-700 px-4 py-1 text-xs rounded shadow-sm hover:bg-gray-100 disabled:opacity-50 transition-colors uppercase tracking-wider"
                    >
                        {isPending ? 'Returning...' : 'Return to Admin'}
                    </button>
                </div>
            )}
            <nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto flex h-16 items-center justify-between px-4">
                    {/* Brand Logo */}
                    <Link href="/" className="flex items-center space-x-2">
                        <div className="bg-primary/10 p-2 rounded-full">
                            <Home className="h-6 w-6 text-primary" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                            RentPe
                        </span>
                    </Link>

                    {/* Desktop Navigation — context-aware based on active role */}
                    <div className="hidden md:flex items-center space-x-3">
                        {isOwner || isAdmin ? (
                            // OWNER / ADMIN MODE — business-context nav
                            <>
                                <Link
                                    href="/dashboard/owner/properties"
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-full bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-600 hover:text-white hover:border-violet-600 transition-all shadow-sm group"
                                >
                                    <LayoutDashboard className="h-4 w-4 group-hover:scale-110 transition-transform" />
                                    My Properties
                                </Link>
                                <Link
                                    href="/list-property"
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all shadow-sm group"
                                >
                                    <PlusCircle className="h-4 w-4 group-hover:scale-110 transition-transform" />
                                    Add Property
                                </Link>
                                <Link
                                    href="/dashboard/owner/staff"
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-sm group"
                                >
                                    <Users className="h-4 w-4 group-hover:scale-110 transition-transform" />
                                    Management & Staff
                                </Link>
                            </>
                        ) : (
                            // STUDENT / GUEST MODE — discovery nav
                            <>
                                <Link
                                    href="/search"
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm group"
                                >
                                    <Search className="h-4 w-4 group-hover:scale-110 transition-transform" />
                                    Find PG
                                </Link>
                                <Link
                                    href="/list-property"
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all shadow-sm group"
                                >
                                    <Building className="h-4 w-4 group-hover:scale-110 transition-transform" />
                                    List Your PG
                                </Link>
                                <Link
                                    href="/about"
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-sm group"
                                >
                                    <Info className="h-4 w-4 group-hover:scale-110 transition-transform" />
                                    About Us
                                </Link>
                            </>
                        )}
                    </div>

                    {/* Auth Buttons */}
                    <div className="hidden md:flex items-center space-x-3">
                        {isLoggedIn ? (
                            <div className="flex items-center gap-3">
                                {hasMultipleRoles && (
                                    <button
                                        onClick={() => handleSwitch(isOwner ? "USER" : "OWNER")}
                                        disabled={isPending}
                                        suppressHydrationWarning
                                        title={isOwner ? 'Switch to Student Dashboard' : 'Switch to Owner Dashboard'}
                                        className="flex items-center gap-0.5 bg-slate-100 hover:bg-slate-200 border-2 border-slate-200 rounded-xl p-1 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${!isOwner ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}>
                                            🎓 Student
                                        </div>
                                        <div className="px-1">
                                            {isPending ? <Loader2 className="h-3 w-3 text-slate-400 animate-spin" /> : <ArrowLeftRight className="h-3 w-3 text-slate-400" />}
                                        </div>
                                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${isOwner ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}>
                                            🏠 Owner
                                        </div>
                                    </button>
                                )}
                                <span className="text-sm font-medium text-muted-foreground hidden sm:inline-block">
                                    Welcome, <strong>{session?.name || session?.user?.name || userRole}</strong>
                                </span>
                                <NotificationBell />
                                <div className="flex items-center gap-2">
                                    <Link 
                                        href={dashboardHref + "?tab=profile"}
                                        className="px-4 py-2 text-sm font-bold rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90 transition-opacity shadow-sm"
                                    >
                                        My Profile
                                    </Link>
                                    <Link 
                                        href={dashboardHref}
                                        className="px-4 py-2 text-sm font-semibold rounded-lg border-2 border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors"
                                    >
                                        Dashboard
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <>
                                <Link 
                                    href="/login"
                                    className="px-5 py-2 text-sm font-bold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm"
                                >
                                    Sign In
                                </Link>
                                <Link 
                                    href="/signup"
                                    className="px-5 py-2 text-sm font-bold rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:opacity-90 transition-opacity shadow-md"
                                >
                                    Sign Up
                                </Link>
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button 
                        className="md:hidden p-2 hover:bg-muted rounded-md" 
                        onClick={() => setIsOpen(!isOpen)}
                        suppressHydrationWarning
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                </div>

                {/* Mobile Menu */}
                {isOpen && (
                    <div className="md:hidden border-t bg-background p-4 space-y-3 animate-in slide-in-from-top-2">
                        {isOwner || isAdmin ? (
                            // OWNER / ADMIN MODE — business-context mobile nav
                            <>
                                <Link href="/dashboard/owner/properties" className="block" onClick={() => setIsOpen(false)}>
                                    <div className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold rounded-lg bg-violet-50 text-violet-700 border border-violet-200 shadow-sm">
                                        <LayoutDashboard className="h-4 w-4" />
                                        My Properties
                                    </div>
                                </Link>
                                <Link href="/list-property" className="block" onClick={() => setIsOpen(false)}>
                                    <div className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold rounded-lg bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
                                        <PlusCircle className="h-4 w-4" />
                                        Add Property
                                    </div>
                                </Link>
                                <Link href="/dashboard/owner/staff" className="block" onClick={() => setIsOpen(false)}>
                                    <div className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                                        <Users className="h-4 w-4" />
                                        Management & Staff
                                    </div>
                                </Link>
                            </>
                        ) : (
                            // STUDENT / GUEST MODE — discovery mobile nav
                            <>
                                <Link href="/search" className="block" onClick={() => setIsOpen(false)}>
                                    <div className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm">
                                        <Search className="h-4 w-4" />
                                        Find PG
                                    </div>
                                </Link>
                                <Link href="/list-property" className="block" onClick={() => setIsOpen(false)}>
                                    <div className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold rounded-lg bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
                                        <Building className="h-4 w-4" />
                                        List Your PG
                                    </div>
                                </Link>
                            </>
                        )}
                        <div className="pt-4 border-t flex flex-col space-y-2">
                            {isLoggedIn ? (
                                <div className="flex flex-col space-y-2">
                                    {hasMultipleRoles && (
                                        <button
                                            onClick={() => handleSwitch(isOwner ? "USER" : "OWNER")}
                                            disabled={isPending}
                                            suppressHydrationWarning
                                            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold rounded-lg bg-amber-50 text-amber-700 border border-indigo-200 mb-2"
                                        >
                                            {isPending ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <ArrowLeftRight className="h-4 w-4" />
                                            )}
                                            Switch to {isOwner ? "Student" : "Owner"} Mode
                                        </button>
                                    )}
                                    <Link href={dashboardHref + "?tab=profile"} className="w-full text-center px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg font-bold shadow-sm" onClick={() => setIsOpen(false)}>
                                        My Profile
                                    </Link>
                                    <Link href={dashboardHref} className="w-full text-center px-4 py-2 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold" onClick={() => setIsOpen(false)}>
                                        Dashboard
                                    </Link>
                                </div>
                            ) : (
                                <>
                                    <Link href="/login" className="w-full text-center px-4 py-2 bg-green-600 text-white rounded-lg font-semibold" onClick={() => setIsOpen(false)}>
                                        Login
                                    </Link>
                                    <Link href="/signup" className="w-full text-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold" onClick={() => setIsOpen(false)}>
                                        Sign Up
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </nav>
        </>
    );
};

export default Navbar;
