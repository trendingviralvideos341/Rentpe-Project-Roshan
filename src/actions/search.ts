'use server';

import prisma from "@/lib/prisma";

export async function searchProperties(query?: string, filters?: {
    city?: string,
    minPrice?: number,
    maxPrice?: number,
    type?: string
}) {
    const where: any = {};

    if (query) {
        where.AND = [
            { status: 'LIVE' },
            {
                OR: [
                    { name: { contains: query } },
                    { city: { contains: query } },
                    { address: { contains: query } }
                ]
            }
        ];
    } else {
        where.status = 'LIVE';
    }

    if (filters?.city) {
        where.city = { contains: filters.city };
    }

    const properties = await prisma.property.findMany({
        where,
        include: {
            rooms: {
                select: {
                    price: true,
                    type: true,
                    availability: true
                }
            }
        }
    });

    // Map min price and aggregate ratings (mocked for now as schema doesn't have rating)
    const results = properties.map(p => {
        const prices = p.rooms.map(r => r.price);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;

        return {
            ...p,
            minPrice,
            rating: 4.5, // Placeholder
            amenities: JSON.parse(p.amenities || "[]"),
            image: JSON.parse(p.images || "[]")[0] || "",
            buildingPhotos: p.buildingPhotos ? JSON.parse(p.buildingPhotos) : [],
            commonAreaPhotos: p.commonAreaPhotos ? JSON.parse(p.commonAreaPhotos) : []
        };
    });

    // Apply price filters post-fetch for simplicity if needed, or refine Prisma query
    let filteredResults = results;
    if (filters?.minPrice) {
        filteredResults = filteredResults.filter(r => r.minPrice >= filters.minPrice!);
    }
    if (filters?.maxPrice) {
        filteredResults = filteredResults.filter(r => r.minPrice <= filters.maxPrice!);
    }

    return filteredResults;
}
