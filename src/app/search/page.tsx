"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Search, MapPin, Star, Building, X, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { searchProperties } from "@/actions/search";
import { searchPropertiesFuzzy } from "@/actions/properties";
import { getCurrentUser } from "@/actions/auth";
import { ImageCarousel } from "@/components/ImageCarousel";

const CITIES = ["Delhi", "Bangalore", "Pune", "Mumbai", "Kota"];

export default function SearchPage() {
    const [query, setQuery] = useState("");
    const [properties, setProperties] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [activeCity, setActiveCity] = useState("");
    const [sortBy, setSortBy] = useState("recommended");
    const [isShowingFuzzy, setIsShowingFuzzy] = useState(false);
    const [filters, setFilters] = useState({
        minPrice: "",
        maxPrice: "",
        type: "",
        genderType: "",
    });

    useEffect(() => {
        getCurrentUser().then(u => setCurrentUser(u)).catch(() => {});
    }, []);

    const handleSearch = async (
        forceQuery?: string, 
        forceCity?: string, 
        overrideFilters?: { minPrice?: string; maxPrice?: string; type?: string; genderType?: string }
    ) => {
        setLoading(true);
        setIsShowingFuzzy(false);
        try {
            const q = forceQuery !== undefined ? forceQuery : query;
            const city = forceCity !== undefined ? forceCity : activeCity;
            const currentFilters = overrideFilters || filters;

            // ── Standard path: Prisma ILIKE / full enriched search ─────────
            let results = await searchProperties(q || city, {
                city: city || undefined,
                minPrice: currentFilters.minPrice ? parseInt(currentFilters.minPrice) : undefined,
                maxPrice: currentFilters.maxPrice ? parseInt(currentFilters.maxPrice) : undefined,
                type: currentFilters.type || undefined,
                genderType: currentFilters.genderType || undefined,
            });

            // ── Automatic Fuzzy Fallback ─────────────
            if (results.length === 0 && q.trim()) {
                const fuzzyResults = await searchPropertiesFuzzy(q.trim());
                if (fuzzyResults.length > 0) {
                    setIsShowingFuzzy(true);
                    results = fuzzyResults.map(r => ({
                        ...r,
                        minPrice: r.price ?? 0,
                        maxPrice: r.price ?? 0,
                        totalAvailableBeds: null,
                        isFull: false,
                        amenities: [],
                        buildingPhotos: [],
                        commonAreaPhotos: [],
                        allPhotos: [],
                        image: '',
                        isVerified: false,
                        genderType: 'COED',
                        propertyType: 'PG',
                        rating: 0,
                        _fuzzy: true,
                    }));
                }
            }

            setProperties(results);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const q = new URLSearchParams(window.location.search).get("q") || "";
        if (q) setQuery(q);
        handleSearch(q);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectCity = (city: string) => {
        const next = activeCity === city ? "" : city;
        setActiveCity(next);
        handleSearch(query, next);
    };

    const clearAll = () => {
        setQuery("");
        setActiveCity("");
        const clearedFilters = { minPrice: "", maxPrice: "", type: "", genderType: "" };
        setFilters(clearedFilters);
        handleSearch("", "", clearedFilters);
    };

    const sorted = [...properties].sort((a, b) => {
        if (sortBy === "price_asc") return (a.minPrice || 0) - (b.minPrice || 0);
        if (sortBy === "price_desc") return (b.minPrice || 0) - (a.minPrice || 0);
        if (sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
        return 0;
    });

    return (
        <div className="min-h-screen bg-slate-50">

            {/* ── Hero Search Bar ── */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-8 md:py-10">
                <div className="max-w-2xl mx-auto text-center space-y-4">
                    <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-1 rounded-full text-xs font-bold text-indigo-200 uppercase tracking-widest">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                        Verified PGs across India
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                        Find your perfect <span className="text-indigo-300">stay</span>
                    </h1>

                    {/* Search Input */}
                    <div className="flex gap-2 bg-white/10 border border-white/20 rounded-2xl p-2 backdrop-blur-sm">
                        <Input
                            placeholder="Search by city, area, or PG name..."
                            className="flex-1 border-0 bg-transparent text-white placeholder:text-white/40 focus-visible:ring-0 h-10 text-sm"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        />
                        {query && (
                            <button onClick={() => { setQuery(""); handleSearch(""); }}
                                className="text-white/40 hover:text-white px-2">
                                <X className="h-4 w-4" />
                            </button>
                        )}
                        <Button onClick={() => handleSearch()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 rounded-xl shrink-0 h-10">
                            <Search className="h-4 w-4 mr-2" /> Search
                        </Button>
                    </div>

                    {/* City Pills */}
                    <div className="flex gap-2 flex-wrap justify-center pt-1">
                        {CITIES.map(city => (
                            <button
                                key={city}
                                onClick={() => selectCity(city)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                    activeCity === city
                                        ? "bg-indigo-500 border-indigo-400 text-white"
                                        : "bg-white/10 border-white/20 text-white/70 hover:bg-white/20 hover:text-white"
                                }`}
                            >
                                📍 {city}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="max-w-6xl mx-auto px-4 py-6">

                {/* Toolbar */}
                <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                    <div className="text-sm text-slate-500">
                        {loading ? "Searching..." : (
                            <span>
                                <strong className="text-slate-800">{sorted.length}</strong>
                                {" "}propert{sorted.length !== 1 ? "ies" : "y"} found
                                {activeCity && <span> in <strong className="text-indigo-600">{activeCity}</strong></span>}
                                {isShowingFuzzy && (
                                    <span className="ml-2 text-amber-600 font-medium inline-flex items-center gap-1">
                                        <Sparkles className="h-3 w-3" /> Showing smart matches for your search.
                                    </span>
                                )}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Price Filter — inline, simple */}
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                            <span className="text-slate-400">₹</span>
                            <input
                                type="number"
                                placeholder="Min"
                                className="w-20 outline-none text-slate-700 bg-transparent"
                                value={filters.minPrice}
                                onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))}
                            />
                            <span className="text-slate-300">–</span>
                            <input
                                type="number"
                                placeholder="Max"
                                className="w-20 outline-none text-slate-700 bg-transparent"
                                value={filters.maxPrice}
                                onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))}
                            />
                            <button onClick={() => handleSearch()}
                                className="ml-1 text-indigo-600 font-bold hover:text-indigo-800">
                                Go
                            </button>
                        </div>

                        {/* Room Type */}
                        <select
                            value={filters.type}
                            onChange={e => {
                                const nextFilters = { ...filters, type: e.target.value };
                                setFilters(nextFilters);
                                handleSearch(query, activeCity, nextFilters);
                            }}
                            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 outline-none"
                        >
                            <option value="">All room types</option>
                            <option value="Single">Single sharing</option>
                            <option value="Double">Double sharing</option>
                            <option value="Triple">Triple sharing</option>
                        </select>

                        {/* Sort */}
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value)}
                            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 outline-none"
                        >
                            <option value="recommended">Recommended</option>
                            <option value="price_asc">Price: Low → High</option>
                            <option value="price_desc">Price: High → Low</option>
                            <option value="rating">Best rated</option>
                        </select>



                        {/* Gender Filter */}
                        <select
                            value={filters.genderType}
                            onChange={e => {
                                const nextFilters = { ...filters, genderType: e.target.value };
                                setFilters(nextFilters);
                                handleSearch(query, activeCity, nextFilters);
                            }}
                            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 outline-none font-bold cursor-pointer hover:border-indigo-200 focus:border-indigo-500 transition-all"
                        >
                            <option value="">All genders</option>
                            <option value="BOYS">Boys</option>
                            <option value="GIRLS">Girls</option>
                            <option value="COED">CoLiving</option>
                        </select>
                    </div>
                </div>

                {/* Results */}
                {loading ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="h-72 rounded-2xl bg-slate-200 animate-pulse" />
                        ))}
                    </div>
                ) : sorted.length === 0 ? (
                    /* ── Empty State ── */
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
                            <Building className="h-8 w-8 text-indigo-400" />
                        </div>
                        <h2 className="text-xl font-black text-slate-800">No properties found</h2>
                        <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
                            Try a different city or remove filters. New PGs are added every week!
                        </p>
                        <div className="flex gap-3 flex-wrap justify-center pt-2">
                            <Button onClick={clearAll} variant="outline" className="rounded-xl text-sm">
                                <X className="h-4 w-4 mr-2" /> Clear all filters
                            </Button>
                            <Button onClick={() => selectCity("Bangalore")}
                                className="bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm">
                                Browse Bangalore PGs
                            </Button>
                        </div>
                        {/* Popular city shortcuts */}
                        <div className="pt-4 space-y-2">
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Try these cities</p>
                            <div className="flex gap-2 flex-wrap justify-center">
                                {CITIES.map(city => (
                                    <button key={city} onClick={() => selectCity(city)}
                                        className="px-3 py-1 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-all">
                                        {city}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── Property Grid ── */
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sorted.map(prop => (
                            <Card key={prop.id}
                                className="overflow-hidden rounded-2xl border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 bg-white group">
                                <Link href={`/property/${prop.id}`} className="block">
                                    <div className="h-44 overflow-hidden relative bg-slate-100">
                                        {(() => {
                                            const imgs: string[] = prop.allPhotos?.length
                                                ? prop.allPhotos
                                                : [
                                                    ...(Array.isArray(prop.buildingPhotos) ? prop.buildingPhotos : []),
                                                    ...(Array.isArray(prop.commonAreaPhotos) ? prop.commonAreaPhotos : [])
                                                  ].filter(Boolean);
                                            return <ImageCarousel images={imgs} alt={prop.name} />;
                                        })()}

                                        {/* Rating */}
                                        <div className="absolute top-2 right-2 z-30 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-white flex items-center gap-1">
                                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                            {prop.rating || "New"}
                                        </div>

                                        {/* Your property badge */}
                                        {currentUser?.id && prop.ownerId === currentUser.id && (
                                            <div className="absolute top-2 left-2 z-30 bg-amber-500 text-white text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest">
                                                🏠 Your PG
                                            </div>
                                        )}

                                        {/* Full badge */}
                                        {prop.isFull && (
                                            <div className="absolute top-2 left-2 z-30 bg-orange-500 text-white px-2 py-1 rounded-lg text-[10px] font-bold">
                                                Currently Full
                                            </div>
                                        )}
                                    </div>
                                </Link>

                                <CardHeader className="p-4 pb-2">
                                    <h3 className="font-black text-slate-900 text-base leading-tight truncate">
                                        {prop.name}
                                    </h3>
                                    <div className="flex items-center text-slate-500 text-xs mt-1 gap-1">
                                        <MapPin className="h-3 w-3 shrink-0" />
                                        {prop.city}, {prop.address}
                                    </div>
                                </CardHeader>

                                <CardContent className="px-4 pb-3">
                                    {/* Amenities & Gender */}
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {prop.amenities?.slice(0, 3).map((a: string) => (
                                            <span key={a}
                                                className="bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                {a}
                                            </span>
                                        ))}
                                        {(prop.amenities?.length || 0) > 3 && (
                                            <span className="text-[10px] text-slate-400 font-bold self-center">
                                                +{prop.amenities.length - 3} more
                                            </span>
                                        )}
                                        {prop.genderType && (
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border tracking-wider ${
                                                prop.genderType === 'BOYS'
                                                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                                                    : prop.genderType === 'GIRLS'
                                                        ? 'bg-pink-50 border-pink-200 text-pink-600'
                                                        : 'bg-indigo-50 border-indigo-200 text-indigo-600'
                                            }`}>
                                                {prop.genderType === 'BOYS' ? 'Gender - Boys' : prop.genderType === 'GIRLS' ? 'Gender - Girls' : 'Gender - CoLiving'}
                                            </span>
                                        )}
                                    </div>

                                    {/* Price + availability */}
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <span className="text-xl font-black text-indigo-600">
                                                ₹{prop.minPrice > 0 ? prop.minPrice.toLocaleString('en-IN') : "—"}
                                            </span>
                                            {prop.minPrice > 0 && (
                                                <span className="text-xs text-slate-400 ml-1">/mo onwards</span>
                                            )}
                                        </div>
                                        <span className={`text-xs font-bold ${prop.isFull ? "text-orange-500" : "text-green-600"}`}>
                                            {prop.isFull
                                                ? "Waitlist available"
                                                : `${prop.totalAvailableBeds} bed${prop.totalAvailableBeds !== 1 ? "s" : ""} free`
                                            }
                                        </span>
                                    </div>
                                </CardContent>

                                <CardFooter className="px-4 pb-4 pt-0">
                                    <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm" asChild>
                                        <Link href={`/property/${prop.id}`}>View Details →</Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}

                {/* ── Owner CTA Banner ── */}
                {!loading && (
                    <div className="mt-10 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-6 md:p-10 text-white relative overflow-hidden">
                        <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
                        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-purple-400/20 rounded-full blur-2xl" />
                        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="text-center md:text-left space-y-3">
                                <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-xs font-bold border border-white/30">
                                    <Building className="h-3 w-3" /> For PG &amp; Hostel Owners
                                </div>
                                <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
                                    Reach thousands of students<br className="hidden md:block" /> in just a few clicks.
                                </h2>
                                <p className="text-sm text-white/70 max-w-md leading-relaxed">
                                    List your property and get verified instantly to start receiving bookings.
                                </p>
                                <div className="flex gap-3 flex-wrap justify-center md:justify-start pt-1">
                                    <Link href="/list-property">
                                        <Button className="bg-white text-indigo-700 hover:bg-indigo-50 font-black rounded-xl px-6 h-11">
                                            🚀 List Your Property
                                        </Button>
                                    </Link>
                                    <Link href="/about">
                                        <Button variant="outline" className="border-white/40 text-white bg-transparent hover:bg-white/10 rounded-xl px-6 h-11 font-bold">
                                            Learn How It Works
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                            <div className="hidden md:flex w-28 h-28 bg-white/10 rounded-3xl items-center justify-center border border-white/20 shrink-0">
                                <Building className="h-14 w-14 text-white/80" />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
