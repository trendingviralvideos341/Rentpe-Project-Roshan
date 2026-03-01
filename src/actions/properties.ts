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

    // Create property and rooms in a transaction
    const property = await prisma.$transaction(async (tx) => {
        const newProperty = await tx.property.create({
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

        if (roomsJson) {
            const rooms = JSON.parse(roomsJson);
            if (Array.isArray(rooms) && rooms.length > 0) {
                await tx.room.createMany({
                    data: rooms.map((r: any) => ({
                        propertyId: newProperty.id,
                        roomNumber: r.roomNumber.toString(),
                        type: r.type,
                        price: parseFloat(r.price),
                        availability: parseInt(r.availability),
                    }))
                });
            }
        }

        return newProperty;
    });

    return property;
}

export async function savePropertyDocuments(propertyId: string, docs: {
    aadhaarProof?: string,
    panProof?: string,
    pgLicenceUrl?: string,
    pgPhotoUrl?: string,
    buildingPhotos?: string, // JSON array string
    commonAreaPhotos?: string,
    parkingPhoto?: string,
    bathroomPhoto?: string,
}) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    await prisma.property.update({
        where: { id: propertyId, ownerId: (session as any).userId },
        data: docs
    });

    return { success: true };
}

export async function addRoomToProperty(propertyId: string, roomData: { roomNumber: string, type: string, price: number, availability: number, photoUrl?: string }) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    // Verify ownership
    const property = await prisma.property.findUnique({ where: { id: propertyId, ownerId: (session as any).userId } });
    if (!property) throw new Error("Property not found or unauthorized");

    const room = await prisma.room.create({
        data: {
            ...roomData,
            propertyId
        }
    });

    return room;
}

export async function editRoom(roomId: string, roomData: { roomNumber: string, type: string, price: number, availability: number, photoUrl?: string }) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { property: true }
    });

    if (!room || room.property.ownerId !== (session as any).userId) {
        throw new Error("Room not found or unauthorized");
    }

    return prisma.room.update({
        where: { id: roomId },
        data: roomData
    });
}
