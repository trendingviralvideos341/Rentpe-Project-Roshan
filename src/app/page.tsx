"use client";

// GitHub Push Verification Test

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ShieldCheck, Utensils, Users, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push("/search");
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 overflow-hidden">
        <div className="container px-4 mx-auto relative z-10 text-center">
          <div className="max-w-3xl mx-auto space-y-6 animate-in slide-in-from-bottom-5 duration-700">
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

      {/* Features Section */}
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

      {/* CTA Section */}
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

