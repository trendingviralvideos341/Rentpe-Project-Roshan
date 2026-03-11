'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";

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

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'OWNER',
        actorName: (session as any).name || 'Owner',
        actionType: 'UPDATE',
        entityType: 'PROPERTY',
        entityId: propertyId,
        description: `Food menu updated for ${day}: ${Object.entries(meals).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`).join(', ')}`,
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
import { OWNER_CATEGORIES, ADMIN_CATEGORIES, OWNER_TO_ADMIN_CATEGORIES, determineTargetTeam } from '@/lib/ticket-categories';


// Student: get own tickets
export async function getStudentTickets() {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    return prisma.ticket.findMany({
        where: { userId: (session as any).userId },
        include: { property: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
    });
}

// Student: create a ticket
export async function createStudentTicket(data: {
    category: string;
    description: string;
    priority?: string;
    propertyId?: string;
}) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const count = await prisma.ticket.count();
    const displayId = `TKT-${String(count + 1).padStart(4, '0')}`;
    const targetTeam = determineTargetTeam(data.category);

    const ticket = await (prisma.ticket as any).create({
        data: {
            displayId,
            userId: (session as any).userId,
            propertyId: data.propertyId || null,
            category: data.category,
            description: data.description,
            priority: data.priority || 'MEDIUM',
            status: 'OPEN',
            replies: '[]',
            targetTeam,
            raisedByRole: 'USER'
        }
    });

    revalidatePath('/dashboard/student/tickets');
    revalidatePath('/dashboard/owner/tickets');
    revalidatePath('/dashboard/admin/tickets');
    return ticket;
}

// Owner: get tickets routed to them (from students) + their own tickets to admin
export async function getOwnerTickets() {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const properties = await prisma.property.findMany({
        where: { ownerId: (session as any).userId },
        select: { id: true }
    });
    const propertyIds = properties.map(p => p.id);

    // Get student tickets routed to OWNER for this owner's properties
    const studentTickets = await (prisma.ticket as any).findMany({
        where: {
            propertyId: { in: propertyIds },
            targetTeam: 'OWNER',
            raisedByRole: 'USER',
        },
        include: { user: { select: { name: true } }, property: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
    });

    return studentTickets;
}

// Owner: get tickets they raised to Admin
export async function getOwnerRaisedTickets() {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    return (prisma.ticket as any).findMany({
        where: {
            userId: (session as any).userId,
            raisedByRole: 'OWNER',
        },
        include: { property: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
    });
}

// Owner: create a ticket to admin
export async function createOwnerTicket(data: {
    category: string;
    description: string;
    priority?: string;
    propertyId?: string;
}) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const count = await prisma.ticket.count();
    const displayId = `TKT-${String(count + 1).padStart(4, '0')}`;

    const ticket = await (prisma.ticket as any).create({
        data: {
            displayId,
            userId: (session as any).userId,
            propertyId: data.propertyId || null,
            category: data.category,
            description: data.description,
            priority: data.priority || 'MEDIUM',
            status: 'OPEN',
            replies: '[]',
            targetTeam: 'ADMIN',
            raisedByRole: 'OWNER'
        }
    });

    revalidatePath('/dashboard/owner/tickets');
    revalidatePath('/dashboard/admin/tickets');
    return ticket;
}

// Admin: get ALL tickets (full visibility)
export async function getAllTickets() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    return prisma.ticket.findMany({
        include: {
            user: { select: { name: true, email: true } },
            property: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
}

export async function resolveTicket(id: string, notes?: string) {
    const session = await getSession();
    if (!session || (session.role !== 'OWNER' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

    const ticket = await prisma.ticket.update({
        where: { id },
        data: { status: 'RESOLVED' }
    });

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'TICKET',
        entityId: id,
        description: notes || `Ticket #${id.slice(0, 8)} resolved by ${session.role}`,
    });

    revalidatePath('/dashboard/owner/tickets');
    revalidatePath('/dashboard/admin/tickets');
    revalidatePath('/dashboard/student/tickets');
    return ticket;
}

export async function escalateTicketToAdmin(id: string) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const ticket = await (prisma.ticket as any).update({
        where: { id },
        data: { targetTeam: 'ADMIN', status: 'ESCALATED' }
    });

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'OWNER',
        actorName: (session as any).name || 'Owner',
        actionType: 'UPDATE',
        entityType: 'TICKET',
        entityId: id,
        description: `Ticket escalated to Admin by Owner`,
    });

    revalidatePath('/dashboard/owner/tickets');
    revalidatePath('/dashboard/admin/tickets');
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
    revalidatePath('/dashboard/student/tickets');
    revalidatePath('/dashboard/admin/tickets');
    return updated;
}


