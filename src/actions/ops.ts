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
    if (!session || !['OWNER', 'STAFF'].includes(session.role)) throw new Error("Unauthorized");

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
import { OWNER_CATEGORIES, ADMIN_CATEGORIES, OWNER_TO_ADMIN_CATEGORIES, determineTargetTeam, getAssignedTo } from '@/lib/ticket-categories';


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

    let propertyId = data.propertyId || null;
    let bookingId = null;

    if (!propertyId) {
        // Find student's active booking
        const activeBooking = await prisma.booking.findFirst({
            where: {
                userId: (session as any).userId,
                status: 'ACTIVE',
            },
            select: {
                propertyId: true,
                id: true
            }
        });
        if (activeBooking) {
            propertyId = activeBooking.propertyId;
            bookingId = activeBooking.id;
        } else {
            // Fallback: get the latest booking of the student
            const latestBooking = await prisma.booking.findFirst({
                where: {
                    userId: (session as any).userId,
                },
                orderBy: {
                    createdAt: 'desc'
                },
                select: {
                    propertyId: true,
                    id: true
                }
            });
            if (latestBooking) {
                propertyId = latestBooking.propertyId;
                bookingId = latestBooking.id;
            }
        }
    }

    const count = await prisma.ticket.count();
    const displayId = `TKT-${String(count + 1).padStart(4, '0')}`;
    
    let targetTeam = determineTargetTeam(data.category);
    let assignedTo = getAssignedTo(data.category);

    // If there is no property associated, it must route to admin
    if (!propertyId) {
        targetTeam = 'ADMIN';
        assignedTo = 'ADMIN';
    }

    const ticket = await (prisma.ticket as any).create({
        data: {
            displayId,
            userId: (session as any).userId,
            propertyId,
            bookingId,
            category: data.category,
            description: data.description,
            priority: data.priority || 'MEDIUM',
            status: 'OPEN',
            replies: '[]',
            targetTeam,
            assignedTo,
            raisedByRole: 'USER'
        }
    });

    revalidatePath('/dashboard/student/tickets');
    revalidatePath('/dashboard/owner/tickets');
    revalidatePath('/dashboard/admin/tickets');
    return ticket;
}

// Server action: get pending ticket count for owner dashboard sidebar
export async function getPendingOwnerTicketsCount() {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF'].includes(session.role)) return 0;

    const user = await prisma.user.findUnique({ 
        where: { id: session.userId },
        include: { staffProfile: true }
    });
    
    let propertyIds: string[] = [];
    if (user?.staffProfile) {
        const assignments = await prisma.staffPropertyAssignment.findMany({
            where: { staffMemberId: user.staffProfile.id },
            select: { propertyId: true }
        });
        propertyIds = assignments.map(a => a.propertyId);
    } else {
        const properties = await prisma.property.findMany({ 
            where: { ownerId: user?.parentOwnerId || session.userId }, 
            select: { id: true } 
        });
        propertyIds = properties.map(p => p.id);
    }

    return prisma.ticket.count({
        where: {
            propertyId: { in: propertyIds },
            targetTeam: 'OWNER',
            raisedByRole: 'USER',
            status: { notIn: ['RESOLVED', 'CLOSED'] }
        }
    });
}

// Server action: get pending ticket count for admin dashboard sidebar
export async function getPendingAdminTicketsCount() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return 0;

    return prisma.ticket.count({
        where: {
            targetTeam: 'ADMIN',
            status: { notIn: ['RESOLVED', 'CLOSED'] }
        }
    });
}


// Owner: get tickets routed to them (from students) + their own tickets to admin
export async function getOwnerTickets() {
    const session = await getSession();
    if (!session || !['OWNER', 'STAFF'].includes(session.role)) throw new Error("Unauthorized");

    const user = await prisma.user.findUnique({ 
        where: { id: session.userId },
        include: { staffProfile: true }
    });
    
    let propertyIds: string[] = [];
    
    if (user?.staffProfile) {
        const assignments = await prisma.staffPropertyAssignment.findMany({
            where: { staffMemberId: user.staffProfile.id },
            select: { propertyId: true }
        });
        propertyIds = assignments.map(a => a.propertyId);
    } else {
        const properties = await prisma.property.findMany({ 
            where: { ownerId: user?.parentOwnerId || session.userId }, 
            select: { id: true } 
        });
        propertyIds = properties.map(p => p.id);
    }

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
    if (!session || !['OWNER', 'STAFF'].includes(session.role)) throw new Error("Unauthorized");

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
    if (!session || !['OWNER', 'STAFF'].includes(session.role)) throw new Error("Unauthorized");

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
            raisedByRole: session.role
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
    if (!session || !['OWNER', 'STAFF'].includes(session.role)) throw new Error("Unauthorized");

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

    const userId = (session as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    // Determine the sender name based on the business rules
    let senderName = user?.name || session.role;
    if (['OWNER', 'STAFF'].includes(session.role) && ticket.raisedByRole === 'USER') {
        if (ticket.propertyId) {
            const prop = await prisma.property.findUnique({
                where: { id: ticket.propertyId },
                select: { name: true }
            });
            senderName = prop?.name ? `${prop.name} Management Team` : "Management Team";
        } else {
            senderName = "Management Team";
        }
    } else if (session.role === 'ADMIN') {
        senderName = "Rentpe Support Team";
    }

    // Append to legacy JSON replies (for backward compat)
    const replies = JSON.parse((ticket as any).replies || "[]");
    replies.push({
        sender: session.role,
        senderId: userId,
        senderName,
        message,
        timestamp: new Date().toISOString()
    });

    // Also create a TicketMessage record
    await prisma.ticketMessage.create({
        data: {
            ticketId: id,
            senderId: userId,
            senderRole: session.role,
            senderName,
            message,
        }
    });

    const updated = await prisma.ticket.update({
        where: { id },
        data: { replies: JSON.stringify(replies) }
    });

    // Notify the ticket owner if someone else is replying
    if (ticket.userId !== userId) {
        await prisma.notification.create({
            data: {
                userId: ticket.userId,
                type: 'TICKET_REPLY',
                category: 'SUPPORT',
                message: `New reply on your ticket ${ticket.displayId}: "${message.slice(0, 80)}${message.length > 80 ? '...' : ''}"`,
                isPersistent: false,
            }
        });
    }

    revalidatePath('/dashboard/owner/tickets');
    revalidatePath('/dashboard/student/tickets');
    revalidatePath('/dashboard/admin/tickets');
    return updated;
}

// Add a threaded message to a ticket (new system)
export async function addTicketMessage(ticketId: string, message: string) {
    return replyToTicket(ticketId, message);
}

// Update ticket status with optional note
export async function updateTicketStatus(
    id: string,
    status: 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'ESCALATED',
    note?: string
) {
    const session = await getSession();
    if (!session || !['OWNER', 'ADMIN', 'STAFF'].includes(session.role)) throw new Error("Unauthorized");

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new Error("Ticket not found");

    const dataToUpdate: any = {
        status,
        ...(note && session.role === 'OWNER' ? { ownerNote: note } : {}),
        ...(note && session.role === 'ADMIN' ? { adminNote: note } : {}),
        ...(status === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
    };

    const updated = await prisma.ticket.update({ where: { id }, data: dataToUpdate });

    const statusMessages: Record<string, string> = {
        ACKNOWLEDGED: `Your support ticket ${ticket.displayId} has been acknowledged.`,
        IN_PROGRESS: `Work has started on your ticket ${ticket.displayId}.`,
        RESOLVED: `Your ticket ${ticket.displayId} has been resolved.${note ? ` Resolution: ${note}` : ''}`,
        CLOSED: `Your ticket ${ticket.displayId} has been closed.`,
        ESCALATED: `Your ticket ${ticket.displayId} has been escalated.`,
    };

    if (statusMessages[status]) {
        await prisma.notification.create({
            data: {
                userId: ticket.userId,
                type: 'TICKET_STATUS',
                category: 'SUPPORT',
                message: statusMessages[status],
                isPersistent: status === 'RESOLVED',
            }
        });
    }

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: session.role,
        actorName: (session as any).name || session.role,
        actionType: 'UPDATE',
        entityType: 'TICKET',
        entityId: id,
        description: `Ticket ${ticket.displayId} status updated to ${status}. Note: ${note || 'None'}`,
    });

    revalidatePath('/dashboard/owner/tickets');
    revalidatePath('/dashboard/admin/tickets');
    revalidatePath('/dashboard/student/tickets');
    return updated;
}

// Get ticket with full message thread
export async function getTicketThread(ticketId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
            messages: { orderBy: { createdAt: 'asc' } },
            property: { select: { name: true } },
            user: { select: { name: true, email: true } },
        }
    });

    if (!ticket) throw new Error("Ticket not found");
    return ticket;
}

