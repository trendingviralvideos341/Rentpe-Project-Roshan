'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Twitter, Instagram, Linkedin, Mail, Phone, MapPin } from 'lucide-react';

// Routes where the footer should NOT appear (any dashboard, admin, or staff portal)
const DASHBOARD_PREFIXES = [
    '/dashboard',
    '/admin',
    '/staff',
    '/auth',
];

const Footer = () => {
    const pathname = usePathname();

    // Hide footer on all dashboard/admin/staff/auth pages
    const isDashboardRoute = DASHBOARD_PREFIXES.some(prefix => pathname?.startsWith(prefix));
    if (isDashboardRoute) return null;

    return (
        <footer className="bg-muted/30 border-t mt-auto">
            <div className="container mx-auto py-12 px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Brand & Bio */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-foreground">RentPe</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            India&apos;s smartest PG & Hostel aggregator. Connecting students and professionals with verified, high-fidelity stays.
                        </p>
                        <div className="flex space-x-4">
                            <Link href="#" className="p-2 bg-background rounded-full hover:text-primary transition-colors border shadow-sm">
                                <Instagram className="h-4 w-4" />
                            </Link>
                            <Link href="#" className="p-2 bg-background rounded-full hover:text-primary transition-colors border shadow-sm">
                                <Twitter className="h-4 w-4" />
                            </Link>
                            <Link href="#" className="p-2 bg-background rounded-full hover:text-primary transition-colors border shadow-sm">
                                <Linkedin className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="space-y-4">
                        <h4 className="font-semibold">Quick Links</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="/search" className="hover:text-primary transition-colors">Find a PG</Link></li>
                            <li><Link href="/list-property" className="hover:text-primary transition-colors">List Your Property</Link></li>
                            <li><Link href="/about" className="hover:text-primary transition-colors">About Us</Link></li>
                            <li><Link href="/contact" className="hover:text-primary transition-colors">Contact Support</Link></li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div className="space-y-4">
                        <h4 className="font-semibold">Legal</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
                            <li><Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                            <li><Link href="/refund" className="hover:text-primary transition-colors">Refund Policy</Link></li>
                            <li><Link href="/safety" className="hover:text-primary transition-colors">Platform Safety</Link></li>
                            <li><Link href="/tenant-agreement" className="hover:text-primary transition-colors">Tenant Agreement</Link></li>
                            <li><Link href="/cookie-policy" className="hover:text-primary transition-colors">Cookie Policy</Link></li>
                            <li><Link href="/secure" className="hover:text-primary transition-colors">Security Practices</Link></li>
                            <li><Link href="/bug-bounty" className="hover:text-primary transition-colors">Bug Bounty</Link></li>
                            <li><Link href="/guidelines" className="hover:text-primary transition-colors">Community Guidelines</Link></li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div className="space-y-4">
                        <h4 className="font-semibold">Contact Us</h4>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <div className="flex items-start space-x-3">
                                <MapPin className="h-5 w-5 text-primary shrink-0" />
                                <span>123 Startup Hub, Koramangala, Bangalore, Karnataka - 560034</span>
                            </div>
                            <div className="flex items-center space-x-3">
                                <Phone className="h-4 w-4 text-primary" />
                                <span>+91 98765 43210</span>
                            </div>
                            <div className="flex items-center space-x-3">
                                <Mail className="h-4 w-4 text-primary" />
                                <span>support@rentpe.in</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>© {new Date().getFullYear()} RentPe Technologies Pvt. Ltd. All rights reserved.</span>
                    <div className="flex flex-wrap gap-4">
                        <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
                        <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
                        <Link href="/refund" className="hover:text-primary transition-colors">Refunds</Link>
                        <Link href="/cookie-policy" className="hover:text-primary transition-colors">Cookies</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
