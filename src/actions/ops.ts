'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// --- Food Menu ---
export async function getFoodMenu(propertyId: string) {
    return prisma.foodMenu.findMany({
        where: { propertyId },
        orderBy: { dayOfWeek: 'asc' }
    });
}

export async function updateFoodMenu(propertyId: string, day: string, meals: { breakfast?: string, lunch?: string, dinner?: string }) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const updateCalls = [];

    if (meals.breakfast !== undefined) {
        updateCalls.push(updateOrInsertMeal(propertyId, day, 'Breakfast', meals.breakfast));
    }
    if (meals.lunch !== undefined) {
        updateCalls.push(updateOrInsertMeal(propertyId, day, 'Lunch', meals.lunch));
    }
    if (meals.dinner !== undefined) {
        updateCalls.push(updateOrInsertMeal(propertyId, day, 'Dinner', meals.dinner));
    }

    await Promise.all(updateCalls);

    await prisma.auditLog.create({
        data: {
            action: 'FOOD_MENU_UPDATED',
            targetId: propertyId,
            targetType: 'PROPERTY',
            details: `Food menu updated for ${day}: ${Object.entries(meals).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`).join(', ')}`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/owner/food-menu');
    return { success: true };
}

async function updateOrInsertMeal(propertyId: string, day: string, mealType: string, items: string) {
    const existing = await prisma.foodMenu.findFirst({
        where: { propertyId, dayOfWeek: day, mealType }
    });

    if (existing) {
        return prisma.foodMenu.update({
            where: { id: existing.id },
            data: { items }
        });
    } else {
        return prisma.foodMenu.create({
            data: { propertyId, dayOfWeek: day, mealType, items }
        });
    }
}

// --- Support Tickets ---
export async function getOwnerTickets() {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const properties = await prisma.property.findMany({
        where: { ownerId: (session as any).userId },
        select: { id: true }
    });
    const propertyIds = properties.map(p => p.id);

    return prisma.ticket.findMany({
        where: { propertyId: { in: propertyIds } },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
    });
}

export async function resolveTicket(id: string, notes?: string) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const ticket = await prisma.ticket.update({
        where: { id },
        data: { status: 'RESOLVED' }
    });

    await prisma.auditLog.create({
        data: {
            action: 'TICKET_RESOLVED',
            targetId: id,
            targetType: 'TICKET',
            details: notes || `Ticket #${id.slice(0, 8)} resolved`,
            performedBy: (session as any).userId
        }
    });

    revalidatePath('/dashboard/owner/tickets');
    return ticket;
}

export async function replyToTicket(id: string, message: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new Error("Ticket not found");

    const replies = JSON.parse((ticket as any).replies || "[]");
    replies.push({
        sender: session.role,
        senderId: (session as any).userId,
        message,
        timestamp: new Date().toISOString()
    });

    const updated = await prisma.ticket.update({
        where: { id },
        data: { replies: JSON.stringify(replies) }
    });

    revalidatePath('/dashboard/owner/tickets');
    return updated;
}
