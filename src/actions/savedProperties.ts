'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/** Save a property to student's wishlist */
export async function saveProperty(propertyId: string, note?: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const existing = await (prisma as any).savedProperty.findUnique({
        where: { userId_propertyId: { userId: (session as any).userId, propertyId } }
    });
    if (existing) return existing; // already saved

    const saved = await (prisma as any).savedProperty.create({
        data: { userId: (session as any).userId, propertyId, note }
    });
    revalidatePath('/dashboard/student/saved');
    return saved;
}

/** Remove a property from wishlist */
export async function unsaveProperty(propertyId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    await (prisma as any).savedProperty.deleteMany({
        where: { userId: (session as any).userId, propertyId }
    });
    revalidatePath('/dashboard/student/saved');
    return { success: true };
}

/** Get all saved properties for current student */
export async function getSavedProperties() {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const saved = await (prisma as any).savedProperty.findMany({
        where: { userId: (session as any).userId },
        include: {
            property: {
                include: { rooms: { select: { price: true, type: true, availability: true } } }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    return saved.map((s: any) => {
        const prices = s.property.rooms.map((r: any) => r.price).filter(Boolean);
        const available = s.property.rooms.reduce((sum: number, r: any) => sum + (r.availability || 0), 0);
        return {
            ...s,
            property: {
                ...s.property,
                minPrice: prices.length ? Math.min(...prices) : 0,
                totalAvailableBeds: available,
                amenities: (() => { try { return JSON.parse(s.property.amenities || '[]'); } catch { return []; } })(),
                image: (() => { try { return JSON.parse(s.property.images || '[]')[0] || ''; } catch { return ''; } })(),
            }
        };
    });
}

/** Check if a property is saved by current student */
export async function isPropertySaved(propertyId: string): Promise<boolean> {
    const session = await getSession();
    if (!session) return false;

    const existing = await (prisma as any).savedProperty.findUnique({
        where: { userId_propertyId: { userId: (session as any).userId, propertyId } }
    });
    return !!existing;
}
