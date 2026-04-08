'use server';
import crypto from "crypto";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { generateSequentialId } from "@/lib/ids";

export async function getOwnerStaff() {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') throw new Error("Unauthorized");

    const staff = await prisma.user.findMany({
        where: { 
            parentOwnerId: session.userId,
            deletedAt: null 
        },
        select: {
            id: true,
            displayId: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            createdAt: true,
            staffPermissions: true,
            occupationDetail: true,
            resetToken: true
        },
        orderBy: { createdAt: 'desc' }
    });

    return staff.map(s => ({
        ...s,
        designation: s.occupationDetail,
        permissions: s.staffPermissions
    }));
}

export async function addOwnerStaff(data: {
    name: string,
    email: string,
    phone: string,
    designation: string,
    staffAddress: string,
    permissions: string[],
    propertyIds: string[]
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
    const inviteTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const displayId = await generateSequentialId('STAFF');

    const result = await prisma.$transaction(async (tx) => {
        // 1. Create User
        const staff = await tx.user.create({
            data: {
                displayId,
                email: data.email,
                name: data.name,
                phone: data.phone,
                passwordHash: 'INVITED_PENDING',
                role: 'STAFF', // Set directly to STAFF for staff users
                roles: ['STAFF'],
                status: 'INVITED',
                parentOwnerId: ownerId,
                staffPermissions: JSON.stringify(data.permissions),
                resetToken: inviteToken,
                resetTokenExpiry: inviteTokenExpiry,
                occupationDetail: data.designation,
                currentAddress: data.staffAddress,
                isOwner: false, // Explicitly false for staff
            }
        });

        // 2. Create OwnerEmployee Profile (needed for property assignments)
        const employee = await tx.ownerEmployee.create({
            data: {
                displayId,
                ownerId,
                userId: staff.id,
                name: data.name,
                email: data.email,
                phone: data.phone,
                role: data.designation,
                status: 'ACTIVE',
                invitationToken: inviteToken, // Keep in sync
                invitationExpires: inviteTokenExpiry
            }
        });

        // 3. Create Property Assignments
        if (data.propertyIds && data.propertyIds.length > 0) {
            await tx.employeePropertyAssignment.createMany({
                data: data.propertyIds.map(pid => ({
                    employeeId: employee.id,
                    propertyId: pid,
                    assignedBy: ownerId
                }))
            });
        }

        return { staff, employee };
    });

    logAuditEvent({
        actorId: ownerId,
        actorRole: 'OWNER',
        actorName: (session as any).name || 'Owner',
        actionType: 'CREATE',
        entityType: 'USER',
        entityId: result.staff.id,
        description: `Invited staff ${data.name} as ${data.designation} with ${data.propertyIds.length} properties`,
    });

    revalidatePath('/dashboard/owner/staff');

    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/join-team?token=${inviteToken}`;
    
    return { success: true, inviteLink, staffId: result.staff.id };
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
                emailVerified: true, // Auto-verify upon joining via secure invite token
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
