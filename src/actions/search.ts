"use server";

import prisma from "@/lib/prisma";
import { Property } from "@/types/models";

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
    const where: any = { status: { in: ['APPROVED', 'LIVE'] } };

    // Full-text search across name/city/address
    if (query?.trim()) {
        where.OR = [
            { name: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } },
            { address: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
        ];
    }

    if (filters?.city) where.city = { contains: filters.city, mode: 'insensitive' };

    try {
        const properties = await prisma.property.findMany({
            where,
            include: {
                rooms: { select: { price: true, type: true, availability: true } },
                _count: { select: { reviews: true } }
            }
        }) as (Property & { rooms: any[], _count: { reviews: number } })[];

        console.log(`[SEARCH_ACTION] Found ${properties.length} raw properties for query: "${query}"`);

        // Map and enrich results
        let results = properties.map((p: any) => {
            try {
                const prices = p.rooms.map((r: any) => r.price).filter(Boolean);
                const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
                const totalAvailable = p.rooms.reduce((sum: number, r: any) => sum + (r.availability || 0), 0);

                // For APPROVED properties, show ALL uploaded photos (no verification gating)
                // Verification gating is for the admin review step, not for public visibility
                const buildingPhotos: string[] = [];
                try {
                    const parsed = p.buildingPhotos ? JSON.parse(p.buildingPhotos) : [];
                    parsed.forEach((url: string) => { if (url) buildingPhotos.push(url); });
                } catch {}

                const commonAreaPhotos: string[] = [];
                try {
                    const parsed = p.commonAreaPhotos ? JSON.parse(p.commonAreaPhotos) : [];
                    parsed.forEach((url: string) => { if (url) commonAreaPhotos.push(url); });
                } catch {}

                // Also pull from legacy images field as fallback
                const legacyImages: string[] = [];
                try {
                    const parsed = p.images ? JSON.parse(p.images) : [];
                    parsed.forEach((url: string) => { if (url) legacyImages.push(url); });
                } catch {}

                const allPhotos = [...buildingPhotos, ...commonAreaPhotos, ...legacyImages];

                return {
                    ...p,
                    minPrice,
                    maxPrice,
                    totalAvailableBeds: totalAvailable,
                    // Industry standard: show as full/waitlist, not hidden
                    isFull: totalAvailable === 0,
                    amenities: JSON.parse(p.amenities || '[]'),
                    image: allPhotos[0] || '',
                    buildingPhotos,
                    commonAreaPhotos,
                    allPhotos,
                    isVerified: p.isVerified || false,
                    genderType: p.genderType || 'COED',
                    propertyType: p.propertyType || 'PG',
                    rating: p.averageRating || 0,
                };
            } catch (err) {
                console.error(`[SEARCH_ACTION] Error processing property ${p.id}:`, err);
                return null;
            }
        }).filter(Boolean) as any[];

        // Post-fetch filters
        if (filters?.minPrice) results = results.filter(r => r.minPrice >= filters.minPrice!);
        if (filters?.maxPrice) results = results.filter(r => r.minPrice <= filters.maxPrice!);

        if (filters?.amenities?.length) {
            results = results.filter(r =>
                filters.amenities!.every((a: string) => r.amenities.includes(a))
            );
        }

        // Industry standard: Show ALL approved properties in search.
        // Properties with 0 availability are shown with isFull=true so students
        // can still view, save, or join a waitlist — same as OYO, Stanza, NestAway.

        // Sorting
        switch (filters?.sortBy) {
            case 'price_asc': results.sort((a, b) => a.minPrice - b.minPrice); break;
            case 'price_desc': results.sort((a, b) => b.minPrice - a.minPrice); break;
            case 'rating': results.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0)); break;
            case 'newest': results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
            default: results.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
        }

        console.log(`[SEARCH_ACTION] Returning ${results.length} enriched results for query: "${query}"`);
        return results;
    } catch (error) {
        console.error("[SEARCH_ACTION] Global Search Error:", error);
        return [];
    }
}

export async function getSearchFilterOptions() {
    try {
        const properties = await prisma.property.findMany({
            where: { status: 'LIVE' },
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
    } catch (e) {
        return { cities: [], amenities: [], genderTypes: [], propertyTypes: [], sortOptions: [] };
    }
}
