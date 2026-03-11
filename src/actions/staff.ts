'use server';
import crypto from "crypto";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import bcrypt from "bcryptjs";

export async function getOwnerStaff() {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const staff = await prisma.user.findMany({
        where: { 
            parentOwnerId: (session as any).userId,
            deletedAt: null 
        },
        orderBy: { createdAt: 'desc' }
    });

    return staff;
}

export async function addOwnerStaff(data: {
    name: string,
    email: string,
    phone: string,
    designation: string,
    staffAddress: string,
    permissions: string[],
}) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const ownerId = (session as any).userId;

    // Validate mandatory fields
    if (!data.name || !data.email || !data.phone || !data.designation || !data.staffAddress) {
        throw new Error("All fields (name, email, phone, designation, address) are mandatory.");
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error("User with this email already exists.");

    // Generate invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpiry = new DateTime(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const staff = await prisma.user.create({
        data: {
            displayId: `STF-${Math.floor(Math.random() * 9000) + 1000}`,
            email: data.email,
            name: data.name,
            phone: data.phone,
            passwordHash: 'INVITED_PENDING', // Temp placeholder
            role: 'OWNER',
            roles: 'OWNER,STAFF',
            status: 'INVITED',
            parentOwnerId: ownerId,
            staffPermissions: JSON.stringify(data.permissions),
            resetToken: inviteToken,
            resetTokenExpiry: inviteTokenExpiry,
            // designation and occupationDetail can be used to store staff info
            occupationDetail: data.designation,
            currentAddress: data.staffAddress,
            isOwner: true,
        }
    });

    logAuditEvent({
        actorId: ownerId,
        actorRole: 'OWNER',
        actorName: (session as any).name || 'Owner',
        actionType: 'CREATE',
        entityType: 'USER',
        entityId: staff.id,
        description: `Invited staff ${data.name} as ${data.designation}`,
    });

    revalidatePath('/dashboard/owner/staff');

    // Return invite link for UI (in production this would be emailed)
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/join-team?token=${inviteToken}`;
    
    return { success: true, inviteLink, staffId: staff.id };
}

export async function updateStaffStatus(id: string, status: 'ACTIVE' | 'BLOCKED' | 'REMOVED', reason: string) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const staff = await prisma.user.update({
        where: { id },
        data: { status }
    });

    const action = status === 'BLOCKED' || status === 'REMOVED' ? 'BLOCKED' : 'UNBLOCKED';

    logAuditEvent({
        actorId: (session as any).userId,
        actorRole: (session as any).role || 'OWNER',
        actorName: (session as any).name || 'Owner',
        actionType: action === 'BLOCKED' ? 'REJECT' : 'APPROVE',
        entityType: 'USER',
        entityId: id,
        description: reason,
    });

    revalidatePath('/dashboard/owner/staff');
    return staff;
}

export async function joinStaffTeam(token: string, passwordHash: string) {
    try {
        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpiry: { gte: new Date() },
                status: 'INVITED'
            }
        });

        if (!user) {
            return { success: false, error: "Invalid or expired invitation token." };
        }

        const hashed = await bcrypt.hash(passwordHash, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: hashed,
                status: 'ACTIVE',
                resetToken: null,
                resetTokenExpiry: null
            }
        });

        logAuditEvent({
            actorId: user.id,
            actorRole: 'OWNER',
            actorName: user.name || 'Staff',
            actionType: 'UPDATE',
            entityType: 'USER',
            entityId: user.id,
            description: "Staff account activated via invite",
        });

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
