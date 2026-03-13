"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./auth";
import { generateSequentialId } from "@/lib/ids";
import { logAuditEvent } from "@/lib/audit";

export async function getOwnerEmployees() {
    const user = await getCurrentUser() as any;
    if (!user || !user.isOwner) throw new Error("Unauthorized");

    return await prisma.ownerEmployee.findMany({
        where: { ownerId: user.id },
        include: {
            assignments: {
                include: { property: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
}

export async function createOwnerEmployee(data: {
    name: string;
    email: string;
    phone: string;
    role: string;
}) {
    const user = await getCurrentUser() as any;
    if (!user || !user.isOwner) throw new Error("Unauthorized");

    const displayId = await generateSequentialId('OWNER_EMPLOYEE');

    const employee = await prisma.ownerEmployee.create({
        data: {
            ...data,
            displayId,
            ownerId: user.id
        }
    });

    await logAuditEvent({
        actorId: user.id,
        actorRole: "OWNER",
        actorName: user.name || "Owner",
        actionType: "CREATE",
        entityType: "EMPLOYEE",
        entityId: employee.id,
        entityName: employee.name,
        description: `Created new employee ${employee.name} (${employee.displayId})`
    });

    revalidatePath("/dashboard/owner/employees");
    return employee;
}

export async function updateOwnerEmployee(id: string, data: any) {
    const user = await getCurrentUser() as any;
    if (!user || !user.isOwner) throw new Error("Unauthorized");

    const employee = await prisma.ownerEmployee.update({
        where: { id, ownerId: user.id },
        data
    });

    await logAuditEvent({
        actorId: user.id,
        actorRole: "OWNER",
        actorName: user.name || "Owner",
        actionType: "UPDATE",
        entityType: "EMPLOYEE",
        entityId: employee.id,
        entityName: employee.name,
        description: `Updated employee ${employee.name} details`
    });

    revalidatePath("/dashboard/owner/employees");
    return employee;
}

export async function assignEmployeeToProperty(employeeId: string, propertyId: string) {
    const user = await getCurrentUser() as any;
    if (!user || !user.isOwner) throw new Error("Unauthorized");

    const assignment = await prisma.employeePropertyAssignment.create({
        data: {
            employeeId,
            propertyId,
            assignedBy: user.id
        },
        include: { employee: true, property: true }
    });

    await logAuditEvent({
        actorId: user.id,
        actorRole: "OWNER",
        actorName: user.name || "Owner",
        actionType: "UPDATE",
        entityType: "EMPLOYEE",
        entityId: employeeId,
        entityName: assignment.employee.name,
        description: `Assigned employee ${assignment.employee.name} to property ${assignment.property.name}`
    });

    revalidatePath("/dashboard/owner/employees");
    return assignment;
}

export async function removeEmployeeFromProperty(employeeId: string, propertyId: string) {
    const user = await getCurrentUser() as any;
    if (!user || !user.isOwner) throw new Error("Unauthorized");

    const assignment = await prisma.employeePropertyAssignment.delete({
        where: {
            employeeId_propertyId: {
                employeeId,
                propertyId
            }
        },
        include: { employee: true, property: true }
    });

    await logAuditEvent({
        actorId: user.id,
        actorRole: "OWNER",
        actorName: user.name || "Owner",
        actionType: "UPDATE",
        entityType: "EMPLOYEE",
        entityId: employeeId,
        entityName: assignment.employee.name,
        description: `Removed employee ${assignment.employee.name} from property ${assignment.property.name}`
    });

    revalidatePath("/dashboard/owner/employees");
    return assignment;
}

export async function getAdminEmployees() {
    const user = await getCurrentUser() as any;
    if (!user || !user.isAdmin) throw new Error("Unauthorized");

    return await prisma.ownerEmployee.findMany({
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
    const employee = await prisma.ownerEmployee.findUnique({
        where: { userId },
        select: { assignments: { select: { propertyId: true } } }
    });

    if (!employee) return [];
    return employee.assignments.map(a => a.propertyId);
}
