import Link from 'next/link';
import { Facebook, Twitter, Instagram, Linkedin, Mail, Phone, MapPin } from 'lucide-react';

const Footer = () => {
    return (
        <footer className="bg-muted/30 border-t mt-auto">
            <div className="container mx-auto py-12 px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Brand & Bio */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-foreground">RentPe</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            India's smartest PG & Hostel aggregator. Connecting students and professionals with verified, premium stays.
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
                            <li><Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                            <li><Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
                            <li><Link href="/refund" className="hover:text-primary transition-colors">Refund Policy</Link></li>
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

                <div className="border-t mt-12 pt-8 text-center text-sm text-muted-foreground">
                    © {new Date().getFullYear()} RentPe. All rights reserved.
                </div>
            </div>
        </footer>
    );
};

export default Footer;
