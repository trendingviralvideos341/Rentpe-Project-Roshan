"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ShieldCheck, Utensils, Users, ArrowRight, Star, CheckCircle, MessageCircle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919999999999";

const HOW_IT_WORKS_STUDENT = [
    { step: "01", title: "Search & Find", desc: "Browse verified PGs and hostels in your preferred city or near your college." },
    { step: "02", title: "Book Instantly", desc: "Select your room type, check amenities, and send a booking request in minutes." },
    { step: "03", title: "Move In", desc: "Complete KYC digitally. Sign your agreement online. Move in stress-free." },
];

const HOW_IT_WORKS_OWNER = [
    { step: "01", title: "List Your Property", desc: "Add your PG or hostel with photos, room types, pricing, and amenities." },
    { step: "02", title: "Get Verified", desc: "Our team verifies your property. Go live on RentPe within 24–48 hours." },
    { step: "03", title: "Manage & Earn", desc: "Accept bookings, collect rent digitally, and track payouts from your dashboard." },
];

const TESTIMONIALS = [
    { name: "Priya Sharma", role: "Student — Delhi University", rating: 5, text: "Found an amazing PG near my college within 30 minutes! The food menu preview was the best feature — I knew exactly what I was signing up for." },
    { name: "Rahul Gupta", role: "PG Owner — Bangalore", rating: 5, text: "RentPe completely transformed how I manage my PG. Rent collection, tenant KYC, and payout tracking — all in one dashboard. Couldn't be simpler." },
    { name: "Sneha Patel", role: "Student — Pune", rating: 5, text: "I was worried about shifting to a new city for college. RentPe helped me find a safe, verified hostel with great reviews. Highly recommend!" },
    { name: "Amit Singh", role: "PG Owner — Kota", rating: 5, text: "My occupancy went from 60% to 100% within 3 months of listing on RentPe. The platform genuinely brings serious students." },
];

const TRUST_BADGES = [
    { icon: "🔒", label: "100% Verified", sub: "Every listing is checked" },
    { icon: "⚡", label: "Instant Booking", sub: "No delays, no middlemen" },
    { icon: "💰", label: "No Brokerage", sub: "Zero hidden fees" },
    { icon: "📱", label: "Digital KYC", sub: "Paperless onboarding" },
    { icon: "🛡️", label: "Secure Payments", sub: "Bank-grade security" },
];

export default function Home() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [audience, setAudience] = useState<"student" | "owner">("student");

    const handleSearch = () => {
        if (searchQuery.trim()) {
            router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        } else {
            router.push("/search");
        }
    };

    const howItWorks = audience === "student" ? HOW_IT_WORKS_STUDENT : HOW_IT_WORKS_OWNER;

    return (
        <div className="flex flex-col min-h-screen">
            {/* ── HERO ── */}
            <section className="relative py-20 md:py-32 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 overflow-hidden">
                <div className="container px-4 mx-auto relative z-10 text-center">
                    <div className="max-w-3xl mx-auto space-y-6 animate-in slide-in-from-bottom-5 duration-700">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-full text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-4">
                            🏆 India&apos;s #1 Verified PG & Hostel Platform
                        </div>
                        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground">
                            Find your perfect <span className="text-primary">student home</span> away from home.
                        </h1>
                        <p className="text-xl text-muted-foreground">
                            India&apos;s most trusted aggregator for PGs and Hostels. Verified listings, hygienic food, and a vibrant community waiting for you.
                        </p>

                        {/* Search Box */}
                        <form
                            onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
                            className="bg-white dark:bg-slate-800 p-2 rounded-full shadow-lg border max-w-xl mx-auto flex items-center mt-8"
                        >
                            <div className="pl-4 text-muted-foreground">
                                <Search className="h-5 w-5" />
                            </div>
                            <Input
                                className="border-0 shadow-none focus-visible:ring-0 bg-transparent text-lg"
                                placeholder="Enter city, locality, or college..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <Button type="submit" size="lg" className="rounded-full px-8">
                                Search
                            </Button>
                        </form>

                        <div className="pt-4 flex justify-center space-x-4 text-sm text-muted-foreground">
                            <span>Popular:</span>
                            <Link href="/search?q=delhi" className="hover:text-primary underline">Delhi</Link>
                            <Link href="/search?q=bangalore" className="hover:text-primary underline">Bangalore</Link>
                            <Link href="/search?q=kota" className="hover:text-primary underline">Kota</Link>
                            <Link href="/search?q=pune" className="hover:text-primary underline">Pune</Link>
                        </div>
                    </div>
                </div>

                {/* Decorative blobs */}
                <div className="absolute top-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>
            </section>

            {/* ── TRUST BADGES ── */}
            <section className="py-8 bg-slate-900 text-white overflow-hidden">
                <div className="container px-4 mx-auto">
                    <div className="flex flex-wrap justify-center gap-x-10 gap-y-4">
                        {TRUST_BADGES.map(badge => (
                            <div key={badge.label} className="flex items-center gap-3">
                                <span className="text-2xl">{badge.icon}</span>
                                <div>
                                    <p className="font-bold text-sm">{badge.label}</p>
                                    <p className="text-xs text-slate-400">{badge.sub}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FEATURES ── */}
            <section className="py-20 bg-background">
                <div className="container px-4 mx-auto">
                    <div className="text-center mb-16 space-y-2">
                        <h2 className="text-3xl font-bold">Why choose RentPe?</h2>
                        <p className="text-muted-foreground">We don&apos;t just find you a room, we find you a home.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<ShieldCheck className="h-10 w-10 text-primary" />}
                            title="Verified Listings"
                            description="Every property is physically verified by our ground team to ensure 100% authenticity and safety."
                        />
                        <FeatureCard
                            icon={<Utensils className="h-10 w-10 text-secondary" />}
                            title="Hygienic Food"
                            description="View weekly food menus upfront. Rated by residents for hygiene and taste."
                        />
                        <FeatureCard
                            icon={<Users className="h-10 w-10 text-purple-600" />}
                            title="Student Community"
                            description="Connect with other students. Attend events, workshops, and make lifelong friends."
                        />
                    </div>
                </div>
            </section>

            {/* ── HOW IT WORKS ── */}
            <section className="py-20 bg-slate-50 dark:bg-slate-950">
                <div className="container px-4 mx-auto">
                    <div className="text-center mb-10 space-y-4">
                        <h2 className="text-3xl font-bold">How it Works</h2>
                        {/* Audience toggle */}
                        <div className="inline-flex bg-white dark:bg-slate-800 border rounded-full p-1 gap-1">
                            <button
                                onClick={() => setAudience("student")}
                                className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${audience === "student" ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                🎓 For Students
                            </button>
                            <button
                                onClick={() => setAudience("owner")}
                                className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${audience === "owner" ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                🏠 For Owners
                            </button>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                        {howItWorks.map((item, idx) => (
                            <div key={item.step} className="relative flex flex-col items-start p-6 bg-white dark:bg-slate-900 rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
                                <span className="text-5xl font-black text-primary/10 absolute top-4 right-4">{item.step}</span>
                                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                                    <ChevronRight className="h-5 w-5 text-primary" />
                                </div>
                                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                                {idx < howItWorks.length - 1 && (
                                    <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                                        <ArrowRight className="h-6 w-6 text-primary/30" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="text-center mt-10">
                        <Button size="lg" asChild>
                            {audience === "student"
                                ? <Link href="/search">Find My PG <ArrowRight className="ml-2 h-4 w-4" /></Link>
                                : <Link href="/list-property">List My Property <ArrowRight className="ml-2 h-4 w-4" /></Link>
                            }
                        </Button>
                    </div>
                </div>
            </section>

            {/* ── TESTIMONIALS ── */}
            <section className="py-20 bg-background">
                <div className="container px-4 mx-auto">
                    <div className="text-center mb-14 space-y-2">
                        <h2 className="text-3xl font-bold">Loved by thousands</h2>
                        <p className="text-muted-foreground">See what students and owners say about RentPe.</p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {TESTIMONIALS.map(t => (
                            <div key={t.name} className="bg-card border rounded-2xl p-6 hover:shadow-lg transition-shadow flex flex-col gap-4">
                                <div className="flex gap-0.5">
                                    {[...Array(t.rating)].map((_, i) => (
                                        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                                    ))}
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed flex-1">"{t.text}"</p>
                                <div>
                                    <p className="font-bold text-sm text-foreground">{t.name}</p>
                                    <p className="text-xs text-muted-foreground">{t.role}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="py-20 bg-muted/30">
                <div className="container px-4 mx-auto text-center">
                    <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-2xl p-8 md:p-12 shadow-xl border">
                        <h2 className="text-3xl font-bold mb-4">Are you a Property Owner?</h2>
                        <p className="text-muted-foreground mb-8">
                            List your PG or Hostel on RentPe and reach thousands of students. Manage bookings, payments, and food menus all in one dashboard.
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <Button size="lg" variant="default" asChild>
                                <Link href="/list-property">List Your Property <ArrowRight className="ml-2 h-4 w-4" /></Link>
                            </Button>
                            <Button size="lg" variant="outline" asChild>
                                <Link href="/search">Explore PGs</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── WHATSAPP FAB ── */}
            <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hi%20RentPe!%20I%20need%20help.`}
                target="_blank"
                rel="noopener noreferrer"
                id="whatsapp-fab"
                className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-[#25D366] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                aria-label="Chat on WhatsApp"
            >
                <MessageCircle className="w-7 h-7 fill-white text-white" />
            </a>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="p-6 rounded-xl border bg-card hover:shadow-lg transition-shadow duration-300 group">
            <div className="mb-4 bg-muted w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <p className="text-muted-foreground leading-relaxed">{description}</p>
        </div>
    );
}
