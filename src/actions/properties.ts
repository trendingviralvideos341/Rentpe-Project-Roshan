'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function getProperties(ownerId?: string) {
    const session = await getSession();
    let where: any = {};

    if (ownerId) {
        where.ownerId = ownerId;
    } else if (session?.role === 'OWNER') {
        where.ownerId = (session as any).userId;
    }

    return prisma.property.findMany({
        where,
        include: {
            rooms: true,
            owner: {
                select: {
                    name: true,
                    email: true
                }
            }
        },
        orderBy: {
            updatedAt: 'desc'
        }
    });
}

export async function getPropertyById(id: string) {
    return prisma.property.findUnique({
        where: { id },
        include: {
            rooms: true,
            foodMenu: true,
            owner: {
                select: {
                    name: true,
                    email: true
                }
            }
        }
    });
}

export async function createProperty(formData: FormData) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') {
        throw new Error("Unauthorized");
    }

    const name = formData.get("name") as string;
    const address = formData.get("address") as string;
    const city = formData.get("city") as string;
    const description = formData.get("description") as string;
    const amenities = formData.get("amenities") as string; // JSON string
    const images = formData.get("images") as string; // JSON string
    const ownerName = formData.get("ownerName") as string;
    const pgLicence = formData.get("pgLicence") as string;
    const roomsJson = formData.get("rooms") as string;

    // Server-side validation
    if (!name?.trim()) throw new Error("Property name is required");
    if (!address?.trim()) throw new Error("Address is required");
    if (!city?.trim()) throw new Error("City is required");
    if (!description?.trim()) throw new Error("Description is required");
    if (!ownerName?.trim()) throw new Error("Building owner name is required");

    // Create property
    const property = await prisma.property.create({
        data: {
            name,
            address,
            city,
            description,
            amenities: amenities || "[]",
            images: images || "[]",
            ownerName: ownerName || null,
            pgLicence: pgLicence || null,
            ownerId: (session as any).userId,
            status: "PENDING_APPROVAL",
        }
    });

    // Create rooms if provided
    if (roomsJson) {
        try {
            const rooms = JSON.parse(roomsJson);
            if (Array.isArray(rooms) && rooms.length > 0) {
                await prisma.room.createMany({
                    data: rooms.map((r: any) => ({
                        propertyId: property.id,
                        roomNumber: r.roomNumber,
                        type: r.type,
                        price: r.price,
                        availability: r.availability,
                    }))
                });
            }
        } catch (e) {
            console.error("Failed to create rooms:", e);
        }
    }

    return property;
}
