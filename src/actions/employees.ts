"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./auth";
import { generateSequentialId } from "@/lib/ids";
import { logAuditEvent } from "@/lib/audit";
import crypto from "crypto";
import { encryptPassword } from "@/lib/auth";

export async function getOwnerStaffMembers() {
    const user = await getCurrentUser() as any;
    if (!user || !user.isOwner) throw new Error("Unauthorized");

    return await prisma.ownerStaffMember.findMany({
        where: { ownerId: user.id },
        include: {
            assignments: {
                include: { property: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
}

export async function createOwnerStaffMember(data: {
    name: string;
    email: string;
    phone: string;
    role: string;
    pincode?: string;
    city?: string;
    state?: string;
    postOffice?: string;
    address?: string;
}) {
    const user = await getCurrentUser() as any;
    if (!user || !user.isOwner) throw new Error("Unauthorized");

    const displayId = await generateSequentialId('STAFF');
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const employee = await prisma.ownerStaffMember.create({
        data: {
            ...data,
            displayId,
            ownerId: user.id,
            invitationToken,
            invitationExpires
        }
    });

    await logAuditEvent({
        actorId: user.id,
        actorRole: "OWNER",
        actorName: user.name || "Owner",
        actionType: "CREATE",
        entityType: "STAFF_MEMBER",
        entityId: employee.id,
        entityName: employee.name,
        description: `Created new employee ${employee.name} (${employee.displayId})`
    });

    revalidatePath("/dashboard/owner/staff");
    return employee;
}

export async function updateOwnerStaffMember(id: string, data: any) {
    const user = await getCurrentUser() as any;
    if (!user || !user.isOwner) throw new Error("Unauthorized");

    const employee = await prisma.ownerStaffMember.update({
        where: { id, ownerId: user.id },
        data
    });

    await logAuditEvent({
        actorId: user.id,
        actorRole: "OWNER",
        actorName: user.name || "Owner",
        actionType: "UPDATE",
        entityType: "STAFF_MEMBER",
        entityId: employee.id,
        entityName: employee.name,
        description: `Updated employee ${employee.name} details`
    });

    revalidatePath("/dashboard/owner/staff");
    return employee;
}

export async function assignStaffMemberToProperty(staffMemberId: string, propertyId: string) {
    const user = await getCurrentUser() as any;
    if (!user || !user.isOwner) throw new Error("Unauthorized");

    const assignment = await prisma.staffPropertyAssignment.create({
        data: {
            staffMemberId,
            propertyId,
            assignedBy: user.id
        },
        include: { staffMember: true, property: true }
    });

    await logAuditEvent({
        actorId: user.id,
        actorRole: "OWNER",
        actorName: user.name || "Owner",
        actionType: "UPDATE",
        entityType: "STAFF_MEMBER",
        entityId: staffMemberId,
        entityName: assignment.staffMember.name,
        description: `Assigned employee ${assignment.staffMember.name} to property ${assignment.property.name}`
    });

    revalidatePath("/dashboard/owner/staff");
    return assignment;
}

export async function removeStaffMemberFromProperty(staffMemberId: string, propertyId: string) {
    const user = await getCurrentUser() as any;
    if (!user || !user.isOwner) throw new Error("Unauthorized");

    const assignment = await (prisma as any).staffPropertyAssignment.update({
        where: {
            staffMemberId_propertyId: { staffMemberId, propertyId }
        },
        data: { status: 'CANCELLED', deletedAt: new Date() },
        include: { staffMember: true, property: true }
    });

    await logAuditEvent({
        actorId: user.id,
        actorRole: "OWNER",
        actorName: user.name || "Owner",
        actionType: "UPDATE",
        entityType: "STAFF_MEMBER",
        entityId: staffMemberId,
        entityName: assignment.staffMember.name,
        description: `Removed employee ${assignment.staffMember.name} from property ${assignment.property.name}`
    });

    revalidatePath("/dashboard/owner/staff");
    return assignment;
}

export async function getAdminStaffMembers() {
    const user = await getCurrentUser() as any;
    if (!user || !user.isAdmin) throw new Error("Unauthorized");

    return await prisma.ownerStaffMember.findMany({
        include: {
            owner: true,
            assignments: {
                include: { property: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
}

/**
 * Gets the list of property IDs assigned to a specific user (employee).
 */
export async function getAssignedPropertyIds(userId: string): Promise<string[]> {
    const employee = await prisma.ownerStaffMember.findUnique({
        where: { userId },
        select: { assignments: { select: { propertyId: true } } }
    });

    if (!employee) return [];
    return employee.assignments.map(a => a.propertyId);
}

export async function validateStaffInvite(token: string) {
    if (!token) throw new Error("Invalid invitation link");

    const employee = await prisma.ownerStaffMember.findUnique({
        where: { invitationToken: token },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            invitationExpires: true,
            userId: true,
            ownerId: true,
            owner: { select: { name: true, businessName: true } }
        }
    });

    if (!employee) throw new Error("Invalid or expired invitation link");
    if (employee.userId) throw new Error("This invitation has already been used");
    if (employee.invitationExpires && employee.invitationExpires < new Date()) {
        throw new Error("This invitation has expired");
    }

    return employee;
}

export async function activateStaffAccount(token: string, passwordPlain: string) {
    const employee = await validateStaffInvite(token);

    const hashedPassword = await encryptPassword(passwordPlain);
    const displayId = await generateSequentialId('USER');

    // Create the User record for the staff member
    const newStaffUser = await prisma.user.create({
        data: {
            name: employee.name,
            email: employee.email,
            phone: employee.phone,
            passwordHash: hashedPassword,
            role: 'STAFF',
            roles: ['STAFF'],
            status: 'ACTIVE',
            parentOwnerId: employee.ownerId,
            displayId,
            applicationId: displayId
        }
    });

    // Link User to Employee and invalidate token
    await prisma.ownerStaffMember.update({
        where: { id: employee.id },
        data: {
            userId: newStaffUser.id,
            invitationToken: null,
            invitationExpires: null,
            status: 'ACTIVE'
        }
    });

    await logAuditEvent({
        actorId: newStaffUser.id,
        actorRole: "STAFF",
        actorName: newStaffUser.name || "Staff",
        actionType: "ACTIVATE",
        entityType: "USER",
        entityId: newStaffUser.id,
        description: `Staff account activated via invitation token`
    });

    return { success: true, email: employee.email };
}

export async function getStaffDashboardData() {
    const user = await getCurrentUser() as any;
    if (!user || user.role !== 'STAFF') throw new Error("Unauthorized");

    // 1. Get assigned property IDs
    const propertyIds = await getAssignedPropertyIds(user.id);
    
    if (propertyIds.length === 0) {
        return {
            properties: [],
            propertyCount: 0,
            todayCheckins: 0,
            openTickets: 0
        };
    }

    // 2. Fetch full property details
    const properties = await prisma.property.findMany({
        where: { id: { in: propertyIds } },
        select: {
            id: true,
            name: true,
            address: true,
            city: true,
            displayId: true
        }
    });

    // 3. Today's Check-ins (String match on moveInDate)
    const today = new Date().toISOString().split('T')[0];
    const todayCheckins = await prisma.booking.count({
        where: {
            propertyId: { in: propertyIds },
            moveInDate: today,
            status: { notIn: ['CANCELLED', 'REJECTED'] }
        }
    });

    // 4. Open Maintenance Tickets
    const openTickets = await prisma.ticket.count({
        where: {
            propertyId: { in: propertyIds },
            status: 'OPEN'
        }
    });

    return {
        properties,
        propertyCount: properties.length,
        todayCheckins,
        openTickets
    };
}

