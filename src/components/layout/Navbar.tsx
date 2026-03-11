'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Home, ArrowLeftRight, Loader2, Eye, Building } from 'lucide-react';
import { useState, useTransition } from 'react';
import { switchRole } from '@/actions/auth';
import { stopImpersonation } from '@/actions/admin-auth';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import NotificationBell from '@/components/layout/NotificationBell';

export function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

const Navbar = ({ session }: { session: any }) => {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const isOwner = session?.role === "OWNER";
    const isAdmin = session?.role === "ADMIN";
    const userRole = isOwner ? "Owner" : isAdmin ? "Admin" : session ? "Student" : null;
    const isLoggedIn = !!session;

    const rolesList = session?.roles?.split(',') || [];
    const hasMultipleRoles = rolesList.length > 1;

    const handleSwitch = (target: string) => {
        startTransition(async () => {
            try {
                await switchRole(target);
            } catch (err) {
                console.error("Switch failed", err);
            }
        });
    };

    const dashboardHref = userRole === 'Owner' ? "/dashboard/owner" : userRole === 'Admin' ? "/dashboard/admin" : "/dashboard/student";

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

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-6">
                        <Link href="/search" className="text-sm font-medium hover:text-primary transition-colors">Find PG</Link>
                        <Link href="/list-property">
                            <button className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-full bg-amber-500 text-white hover:bg-amber-600 transition-all shadow-sm group">
                                <Building className="h-4 w-4 group-hover:scale-110 transition-transform" />
                                List Your PG
                            </button>
                        </Link>
                        <Link href="/about" className="text-sm font-medium hover:text-primary transition-colors">About Us</Link>
                    </div>

                    {/* Auth Buttons */}
                    <div className="hidden md:flex items-center space-x-3">
                        {isLoggedIn ? (
                            <div className="flex items-center gap-3">
                                {hasMultipleRoles && (
                                    <button
                                        onClick={() => handleSwitch(isOwner ? "USER" : "OWNER")}
                                        disabled={isPending}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all disabled:opacity-50"
                                    >
                                        {isPending ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <ArrowLeftRight className="h-3 w-3" />
                                        )}
                                        Switch to {isOwner ? "Student" : "Owner"}
                                    </button>
                                )}
                                <span className="text-sm font-medium text-muted-foreground hidden sm:inline-block">
                                    Welcome, <strong>{session?.name || session?.user?.name || userRole}</strong>
                                </span>
                                <NotificationBell />
                                <div className="flex items-center gap-2">
                                    <Link href={dashboardHref + "?tab=profile"}>
                                        <button className="px-4 py-2 text-sm font-bold rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90 transition-opacity shadow-sm">
                                            My Profile
                                        </button>
                                    </Link>
                                    <Link href={dashboardHref}>
                                        <button className="px-4 py-2 text-sm font-semibold rounded-lg border-2 border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors">
                                            Dashboard
                                        </button>
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <>
                                <Link href="/login">
                                    <button className="px-5 py-2 text-sm font-bold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm">
                                        Sign In
                                    </button>
                                </Link>
                                <Link href="/signup">
                                    <button className="px-5 py-2 text-sm font-bold rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:opacity-90 transition-opacity shadow-md">
                                        Sign Up
                                    </button>
                                </Link>
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button className="md:hidden p-2 hover:bg-muted rounded-md" onClick={() => setIsOpen(!isOpen)}>
                        <Menu className="h-6 w-6" />
                    </button>
                </div>

                {/* Mobile Menu */}
                {isOpen && (
                    <div className="md:hidden border-t bg-background p-4 space-y-4 animate-in slide-in-from-top-2">
                        <Link href="/search" className="block text-sm font-medium hover:text-primary" onClick={() => setIsOpen(false)}>Find PG</Link>
                        <Link href="/list-property" className="block" onClick={() => setIsOpen(false)}>
                            <div className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold rounded-lg bg-amber-500 text-white shadow-sm">
                                <Building className="h-4 w-4" />
                                List Your Property
                            </div>
                        </Link>
                        <div className="pt-4 border-t flex flex-col space-y-2">
                            {isLoggedIn ? (
                                <div className="flex flex-col space-y-2">
                                    {hasMultipleRoles && (
                                        <button
                                            onClick={() => handleSwitch(isOwner ? "USER" : "OWNER")}
                                            disabled={isPending}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold rounded-lg bg-amber-50 text-amber-700 border border-amber-200 mb-2"
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
