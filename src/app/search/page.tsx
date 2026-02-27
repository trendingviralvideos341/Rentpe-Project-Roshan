"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Search, MapPin, Star, Building } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { searchProperties } from "@/actions/search";

export default function SearchPage() {
    const [query, setQuery] = useState("");
    const [properties, setProperties] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const handleSearch = async (forceQuery?: string) => {
        setLoading(true);
        try {
            const results = await searchProperties(forceQuery !== undefined ? forceQuery : query);
            setProperties(results);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        handleSearch();
    }, []);

    return (
        <div className="container mx-auto py-8 px-4 min-h-screen">
            {/* Search Header */}
            <div className="mb-8 space-y-4">
                <h1 className="text-3xl font-bold">Find your perfect stay</h1>
                <div className="flex gap-4 max-w-2xl">
                    <Input
                        placeholder="Search by city, area, or PG name..."
                        className="h-12 text-lg"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button size="lg" className="px-8" onClick={() => handleSearch()}>
                        <Search className="mr-2 h-4 w-4" /> Search
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex gap-2 flex-wrap pb-4 border-b">
                    {["Delhi", "Bangalore", "Pune", "Price: Low to High", "AC Rooms"].map((filter) => (
                        <Button
                            key={filter}
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() => {
                                if (["Delhi", "Bangalore", "Pune"].includes(filter)) {
                                    setQuery(filter);
                                    handleSearch(filter);
                                }
                            }}
                        >
                            {filter}
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
                                    <div className="h-48 overflow-hidden relative bg-muted cursor-pointer">
                                        {prop.image ? (
                                            <img
                                                src={prop.image}
                                                alt={prop.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 group-hover:from-purple-100 group-hover:to-blue-100 transition-colors">
                                                <Building className="h-12 w-12 text-purple-300" />
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-sm font-bold flex items-center">
                                            <Star className="h-4 w-4 text-yellow-500 mr-1 fill-yellow-500" /> {prop.rating}
                                        </div>
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                            <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-purple-700 font-bold text-sm px-3 py-1.5 rounded-full shadow">
                                                👁 View Details
                                            </span>
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
                                            <span key={a} className="bg-muted px-2 py-1 rounded text-xs font-medium">{a}</span>
                                        ))}
                                        {prop.amenities.length > 4 && (
                                            <span className="text-xs text-muted-foreground">+{prop.amenities.length - 4} more</span>
                                        )}
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <span className="text-2xl font-bold">₹{prop.minPrice.toLocaleString()}</span>
                                            <span className="text-sm text-muted-foreground">/month onwards</span>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="p-4 pt-0">
                                    <Button
                                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold shadow-md hover:shadow-lg transition-all"
                                        asChild
                                    >
                                        <Link href={`/property/${prop.id}`}>🏠 View Details →</Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>

                    {properties.length === 0 && (
                        <div className="py-20 text-center space-y-4">
                            <div className="bg-muted w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                                <Search className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h2 className="text-2xl font-semibold">No properties found</h2>
                            <p className="text-muted-foreground">Try adjusting your search or filters to find what you're looking for.</p>
                            <Button variant="outline" onClick={() => { setQuery(""); handleSearch(""); }}>Clear all filters</Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
