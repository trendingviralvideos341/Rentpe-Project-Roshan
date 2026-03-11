"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Search, MapPin, Star, Building, SlidersHorizontal, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { searchProperties } from "@/actions/search";
import { ImageCarousel } from "@/components/ImageCarousel";

export default function SearchPage() {
    const [query, setQuery] = useState("");
    const [properties, setProperties] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showFilters, setShowFilters] = useState(false);

    // Filter State
    const [filters, setFilters] = useState({
        city: "",
        minPrice: "",
        maxPrice: "",
        type: ""
    });

    const handleSearch = async (forceQuery?: string, activeFilters?: any) => {
        setLoading(true);
        try {
            const currentQuery = forceQuery !== undefined ? forceQuery : query;
            const currentFilters = activeFilters !== undefined ? activeFilters : filters;

            const parsedFilters = {
                city: currentFilters.city || undefined,
                minPrice: currentFilters.minPrice ? parseInt(currentFilters.minPrice) : undefined,
                maxPrice: currentFilters.maxPrice ? parseInt(currentFilters.maxPrice) : undefined,
                type: currentFilters.type || undefined
            };

            const results = await searchProperties(currentQuery, parsedFilters);
            setProperties(results);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const q = new URLSearchParams(window.location.search).get("q");
        if (q) setQuery(q);
        handleSearch(q || "");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const applyFilters = () => handleSearch(query, filters);

    const clearFilters = () => {
        const resetFilters = { city: "", minPrice: "", maxPrice: "", type: "" };
        setFilters(resetFilters);
        setQuery("");
        handleSearch("", resetFilters);
    };

    return (
        <div className="container mx-auto py-8 px-4 min-h-screen">
            {/* Search Header */}
            <div className="mb-8 space-y-4">
                <h1 className="text-3xl font-bold">Find your perfect stay</h1>
                <div className="flex gap-4 max-w-3xl">
                    <Input
                        placeholder="Search by city, area, or PG name..."
                        className="h-12 text-lg flex-1"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button size="lg" className="px-8 shrink-0" onClick={() => handleSearch()}>
                        <Search className="mr-2 h-4 w-4" /> Search
                    </Button>
                </div>

                {/* Filter Toggle */}
                <div>
                    <Button
                        variant="outline"
                        onClick={() => setShowFilters(!showFilters)}
                        className="text-muted-foreground border-dashed"
                    >
                        <SlidersHorizontal className="mr-2 h-4 w-4" />
                        {showFilters ? "Hide Filters" : "Show Advanced Filters"}
                    </Button>
                </div>

                {/* Collapsible Filters */}
                {showFilters && (
                    <div className="bg-muted/30 border rounded-xl p-4 mt-2 max-w-3xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground ml-1">City</label>
                            <Input
                                placeholder="e.g. Bangalore"
                                value={filters.city}
                                onChange={e => setFilters({ ...filters, city: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground ml-1">Min Price (₹)</label>
                            <Input
                                type="number"
                                placeholder="₹0"
                                value={filters.minPrice}
                                onChange={e => setFilters({ ...filters, minPrice: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground ml-1">Max Price (₹)</label>
                            <Input
                                type="number"
                                placeholder="Any"
                                value={filters.maxPrice}
                                onChange={e => setFilters({ ...filters, maxPrice: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5 flex flex-col justify-end">
                            <label className="text-xs font-bold text-transparent ml-1 select-none">Actions</label>
                            <div className="flex gap-2">
                                <Button className="flex-1" onClick={applyFilters}>Apply</Button>
                                <Button variant="ghost" onClick={clearFilters}>Clear</Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Quick Filters */}
                <div className="flex gap-2 flex-wrap pb-4 border-b mt-4">
                    {["Delhi", "Bangalore", "Pune", "Mumbai"].map((city) => (
                        <Button
                            key={city}
                            variant="secondary"
                            size="sm"
                            className="rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                            onClick={() => {
                                setQuery(city);
                                handleSearch(city);
                            }}
                        >
                            <MapPin className="mr-1 h-3 w-3" /> {city}
                        </Button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-96 rounded-xl bg-muted animate-pulse" />
                    ))}
                </div>
            ) : (
                <>
                    {/* Results Grid */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {properties.map((prop) => (
                            <Card key={prop.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
                                <Link href={`/property/${prop.id}`} className="block">
                                    <div className="h-48 overflow-hidden relative bg-muted cursor-pointer group/image">
                                        {(() => {
                                            const mergedImages: string[] = [];
                                            if (prop.buildingPhotos && Array.isArray(prop.buildingPhotos)) {
                                                prop.buildingPhotos.forEach((p: any) => {
                                                    if (p) mergedImages.push(typeof p === 'string' ? p : p.url);
                                                });
                                            }
                                            if (prop.commonAreaPhotos && Array.isArray(prop.commonAreaPhotos)) {
                                                prop.commonAreaPhotos.forEach((p: any) => {
                                                    if (p) mergedImages.push(typeof p === 'string' ? p : p.url);
                                                });
                                            }

                                            return <ImageCarousel images={mergedImages} alt={prop.name} />;
                                        })()}

                                        <div className="absolute top-2 right-2 z-[30] bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-sm font-bold flex items-center shadow-sm">
                                            <Star className="h-4 w-4 text-yellow-500 mr-1 fill-yellow-500" /> {prop.rating}
                                        </div>
                                    </div>
                                </Link>
                                <CardHeader className="p-4 pb-2">
                                    <h3 className="text-xl font-bold truncate">{prop.name}</h3>
                                    <div className="flex items-center text-muted-foreground text-sm">
                                        <MapPin className="h-4 w-4 mr-1" /> {prop.city}, {prop.address}
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 pt-2">
                                    <div className="flex flex-wrap gap-2 mb-4 h-16 overflow-hidden">
                                        {prop.amenities.slice(0, 4).map((a: string) => (
                                            <span key={a} className="bg-muted px-2 py-1 rounded text-xs font-medium border">{a}</span>
                                        ))}
                                        {prop.amenities.length > 4 && (
                                            <span className="text-xs text-muted-foreground my-auto">+{prop.amenities.length - 4} more</span>
                                        )}
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <span className="text-2xl font-bold text-primary">₹{prop.minPrice.toLocaleString()}</span>
                                            <span className="text-sm text-muted-foreground">/mo onwards</span>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="p-4 pt-0">
                                    <Button
                                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow transition-all"
                                        asChild
                                    >
                                        <Link href={`/property/${prop.id}`}>View Details</Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>

                    {properties.length === 0 && (
                        <div className="py-20 text-center space-y-4">
                            <div className="bg-muted/50 w-24 h-24 rounded-full flex items-center justify-center mx-auto border">
                                <Building className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h2 className="text-2xl font-semibold">No properties found</h2>
                            <p className="text-muted-foreground max-w-sm mx-auto">Try adjusting your search query, or removing some filters to find what you're looking for.</p>
                            <Button variant="outline" className="mt-2" onClick={clearFilters}>Clear all filters</Button>
                        </div>
                    )}
                </>
            )}

            {/* Owner CTA Section */}
            {!loading && (
                <div className="mt-16 mb-8 bg-gradient-to-r from-blue-600 to-violet-700 rounded-3xl p-8 md:p-12 text-white shadow-2xl relative overflow-hidden group">
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                        <div className="space-y-6 text-center md:text-left flex-1">
                            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-bold border border-white/30 animate-pulse">
                                <Building size={16} />
                                For PG & Hostel Owners
                            </div>
                            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
                                Reach thousands of students <br className="hidden lg:block" /> 
                                in just a few clicks.
                            </h2>
                            <p className="text-lg text-blue-100 max-w-2xl leading-relaxed font-medium">
                                RentPe is India's fastest-growing platform for student housing. 
                                List your property today and get verified instantly to start receiving bookings.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start pt-2">
                                <Link href="/list-property" className="w-full sm:w-auto">
                                    <Button size="lg" className="w-full bg-white text-blue-700 hover:bg-blue-50 font-black px-10 h-14 rounded-2xl shadow-xl hover:scale-105 transition-transform">
                                        🚀 List Your Property
                                    </Button>
                                </Link>
                                <Link href="/about" className="w-full sm:w-auto">
                                    <Button size="lg" variant="outline" className="w-full border-2 border-white/50 text-white hover:bg-white/10 px-8 h-14 rounded-2xl font-bold">
                                        Learn How It Works
                                    </Button>
                                </Link>
                            </div>
                        </div>
                        <div className="hidden lg:block relative">
                            <div className="bg-white/10 p-8 rounded-[40px] backdrop-blur-xl border border-white/20 transform rotate-6 group-hover:rotate-0 transition-transform duration-500 shadow-3xl">
                                <Building size={120} className="text-white opacity-90" />
                            </div>
                            {/* Decorative Sparkle */}
                            <div className="absolute -top-4 -right-4 w-12 h-12 bg-yellow-400 rounded-full blur-2xl opacity-50 animate-pulse" />
                        </div>
                    </div>
                    {/* Decorative Background Elements */}
                    <div className="absolute -top-32 -right-32 w-80 h-80 bg-blue-400 rounded-full blur-[120px] opacity-30 group-hover:opacity-50 transition-opacity" />
                    <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-purple-400 rounded-full blur-[120px] opacity-30 group-hover:opacity-50 transition-opacity" />
                </div>
            )}
        </div>
    );
}
