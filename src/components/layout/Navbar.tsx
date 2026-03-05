'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Home } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import NotificationBell from '@/components/layout/NotificationBell';

export function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

const Navbar = ({ session }: { session: any }) => {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    const isOwner = session?.role === "OWNER";
    const isAdmin = session?.role === "ADMIN";
    const userRole = isOwner ? "Owner" : isAdmin ? "Admin" : session ? "Student" : null;
    const isLoggedIn = !!session;

    const dashboardHref = userRole === 'Owner' ? "/dashboard/owner" : userRole === 'Admin' ? "/dashboard/admin" : "/dashboard/student";

    return (
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
                    <Link href="/list-property" className="text-sm font-medium hover:text-primary transition-colors">List Property</Link>
                    <Link href="/about" className="text-sm font-medium hover:text-primary transition-colors">About Us</Link>
                </div>

                {/* Auth Buttons */}
                <div className="hidden md:flex items-center space-x-3">
                    {isLoggedIn ? (
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-muted-foreground hidden sm:inline-block">
                                Welcome, <strong>{session?.name || session?.user?.name || userRole}</strong>
                            </span>
                            <NotificationBell />
                            <Link href={dashboardHref}>
                                <button className="px-4 py-2 text-sm font-semibold rounded-lg border-2 border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors">
                                    Dashboard
                                </button>
                            </Link>
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
                    <Link href="/list-property" className="block text-sm font-medium hover:text-primary" onClick={() => setIsOpen(false)}>List Property</Link>
                    <div className="pt-4 border-t flex flex-col space-y-2">
                        {isLoggedIn ? (
                            <Link href={dashboardHref} className="w-full text-center px-4 py-2 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold" onClick={() => setIsOpen(false)}>
                                Dashboard
                            </Link>
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
    );
};

export default Navbar;
