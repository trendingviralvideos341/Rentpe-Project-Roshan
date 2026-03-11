'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";

export async function getOwnerStaff() {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const staff = await prisma.ownerStaff.findMany({
        where: { ownerId: (session as any).userId },
        orderBy: { updatedAt: 'desc' }
    });

    const staffWithNotes = await Promise.all(staff.map(async (s) => {
        const notes = await prisma.actionNote.findMany({
            where: { targetId: s.id, targetType: 'OWNER_STAFF' },
            orderBy: { timestamp: 'desc' }
        });
        return { ...s, actionNotes: notes };
    }));

    return staffWithNotes;
}

export async function addOwnerStaff(data: {
    name: string,
    email: string,
    phone: string,
    designation: string,
    staffAddress: string,
    permissions: string[],
    idProof?: string,
    addressProof?: string,
    photo?: string,
}) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    // Validate mandatory fields
    if (!data.name || !data.email || !data.phone || !data.designation || !data.staffAddress) {
        throw new Error("All fields (name, email, phone, designation, address) are mandatory.");
    }
    if (!data.idProof || !data.addressProof || !data.photo) {
        throw new Error("ID verification, address verification, and photo are all mandatory.");
    }

    const staff = await prisma.ownerStaff.create({
        data: {
            displayId: `STF-${Math.floor(Math.random() * 9000) + 1000}`,
            ownerId: (session as any).userId,
            name: data.name,
            email: data.email,
            phone: data.phone,
            designation: data.designation,
            staffAddress: data.staffAddress,
            permissions: JSON.stringify(data.permissions),
            idProof: data.idProof,
            addressProof: data.addressProof,
            photo: data.photo,
        }
    });

    await prisma.actionNote.create({
        data: {
            targetId: staff.id,
            targetType: 'OWNER_STAFF',
            action: 'ADDED',
            reason: `Staff member ${staff.name} (${staff.designation}) added`,
            performedBy: (session as any).userId
        }
    });

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'OWNER',
        actorName: (session as any).name || 'Owner',
        actionType: 'CREATE',
        entityType: 'OWNER_STAFF' as any,
        entityId: staff.id,
        description: `${staff.name} (${staff.designation})`,
    });

    revalidatePath('/dashboard/owner/staff');
    return staff;
}

export async function updateStaffStatus(id: string, status: 'ACTIVE' | 'BLOCKED' | 'REMOVED', reason: string) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const staff = await prisma.ownerStaff.update({
        where: { id },
        data: { status }
    });

    const action = status === 'BLOCKED' || status === 'REMOVED' ? 'BLOCKED' : 'UNBLOCKED';

    await prisma.actionNote.create({
        data: {
            targetId: id,
            targetType: 'OWNER_STAFF',
            action,
            reason,
            performedBy: (session as any).userId
        }
    });

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'OWNER',
        actorName: (session as any).name || 'Owner',
        actionType: action === 'BLOCKED' ? 'REJECT' : 'APPROVE',
        entityType: 'OWNER_STAFF' as any,
        entityId: id,
        description: reason,
    });

    revalidatePath('/dashboard/owner/staff');
    return staff;
}
