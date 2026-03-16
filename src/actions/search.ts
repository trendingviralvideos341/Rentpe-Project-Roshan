import prisma from "@/lib/prisma";
import { Property } from "@/types/models";
import { UserRole } from "@/types/auth";

export async function searchProperties(query?: string, filters?: {
    city?: string;
    minPrice?: number;
    maxPrice?: number;
    type?: string;
    genderType?: string;         // BOYS | GIRLS | COED
    propertyType?: string;       // PG | HOSTEL | COLIVING
    verifiedOnly?: boolean;      // show only verified properties
    amenities?: string[];        // must have these amenities
    minRating?: number;
    sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'newest';
}) {
    const where: any = { status: 'APPROVED' };

    // Full-text search across name/city/address
    if (query?.trim()) {
        where.OR = [
            { name: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } },
            { address: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
        ];
    }

    // Location filter
    if (filters?.city) where.city = { contains: filters.city, mode: 'insensitive' };

    // ... rest of filters

    const properties = await prisma.property.findMany({
        where,
        include: {
            rooms: { select: { price: true, type: true, availability: true } },
            _count: { select: { reviews: true } }
        }
    }) as (Property & { rooms: any[], _count: { reviews: number } })[];

    // Map and enrich results
    let results = properties.map((p: any) => {
        const prices = p.rooms.map((r: any) => r.price).filter(Boolean);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
        const totalAvailable = p.rooms.reduce((sum: number, r: any) => sum + (r.availability || 0), 0);
        const parsedAmenities: string[] = JSON.parse(p.amenities || '[]');
        
        const verifiedDocs = JSON.parse(p.verifiedDocs || '[]');
        
        // Filter building photos to only show verified ones
        const buildingPhotos = p.buildingPhotos ? JSON.parse(p.buildingPhotos) : [];
        const verifiedBuildingPhotos = buildingPhotos.map((url: string, i: number) => {
            return verifiedDocs.includes(`buildingPhotos-${i}`) ? url : null;
        }).filter(Boolean);

        // Common area photos
        const commonAreaPhotos = p.commonAreaPhotos ? JSON.parse(p.commonAreaPhotos) : [];
        const verifiedCommonAreaPhotos = commonAreaPhotos.map((url: string, i: number) => {
            return verifiedDocs.includes(`commonAreaPhotos-${i}`) ? url : null;
        }).filter(Boolean);

        return {
            ...p,
            minPrice,
            maxPrice,
            totalAvailableBeds: totalAvailable,
            amenities: parsedAmenities,
            image: verifiedBuildingPhotos[0] || verifiedCommonAreaPhotos[0] || '',
            buildingPhotos: verifiedBuildingPhotos,
            commonAreaPhotos: verifiedCommonAreaPhotos,
            isVerified: p.isVerified || false,
            genderType: p.genderType || 'COED',
            propertyType: p.propertyType || 'PG',
        };
    });

    // Price filters (post-fetch for SQLite compatibility)
    if (filters?.minPrice) results = results.filter(r => r.minPrice >= filters.minPrice!);
    if (filters?.maxPrice) results = results.filter(r => r.minPrice <= filters.maxPrice!);

    // Amenity filters
    if (filters?.amenities?.length) {
        results = results.filter(r =>
            filters.amenities!.every((a: string) => r.amenities.includes(a))
        );
    }

    // Only show properties with available beds
    results = results.filter(r => r.totalAvailableBeds > 0);

    // Sorting
    switch (filters?.sortBy) {
        case 'price_asc': results.sort((a, b) => a.minPrice - b.minPrice); break;
        case 'price_desc': results.sort((a, b) => b.minPrice - a.minPrice); break;
        case 'rating': results.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0)); break;
        case 'newest': results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
        default: results.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0)); // default: rating
    }

    return results;
}

/**
 * Get filter metadata for the search page (available cities, amenities, etc.)
 */
export async function getSearchFilterOptions() {
    const properties = await prisma.property.findMany({
        where: { status: 'APPROVED' },
        select: { city: true, amenities: true, genderType: true, propertyType: true }
    });

    const cities = [...new Set(properties.map(p => p.city))].sort();
    const amenitySet = new Set<string>();
    properties.forEach(p => {
        try { JSON.parse(p.amenities || '[]').forEach((a: string) => amenitySet.add(a)); } catch {}
    });

    return {
        cities,
        amenities: [...amenitySet].sort(),
        genderTypes: ['BOYS', 'GIRLS', 'COED'],
        propertyTypes: ['PG', 'HOSTEL', 'COLIVING'],
        sortOptions: [
            { value: 'rating', label: 'Top Rated' },
            { value: 'price_asc', label: 'Price: Low to High' },
            { value: 'price_desc', label: 'Price: High to Low' },
            { value: 'newest', label: 'Newest First' },
        ]
    };
}
