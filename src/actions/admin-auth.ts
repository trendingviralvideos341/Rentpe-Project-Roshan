'use server';

import { cookies } from 'next/headers';
import prisma from "@/lib/prisma";
import { getSession, signJWT } from "@/lib/auth";
import { revalidatePath } from 'next/cache';
import { logAuditEvent } from "@/lib/audit";

export async function impersonateUser(targetUserId: string) {
    const session = await getSession();
    // Only genuine Admins can trigger impersonation, not someone who is already impersonating
    if (!session || session.role !== 'ADMIN' || session.impersonatorId) {
        throw new Error("Unauthorized: Only authentic Admins can impersonate users.");
    }

    const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId }
    });

    if (!targetUser) throw new Error("User not found");
    if (targetUser.role === 'ADMIN') throw new Error("Cannot impersonate another admin");

    const payload = {
        userId: targetUser.id,
        role: targetUser.role as any,
        email: targetUser.email,
        name: targetUser.name,
        // The magic trace that proves this is a God Mode override:
        impersonatorId: session.userId,
        roles: targetUser.roles, // Added for completeness
    };

    const token = await signJWT(payload);

    const cookieStore = await cookies();
    cookieStore.set('rentpe_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 // 24 hours
    });

    logAuditEvent({
        actorId: session.userId,
        actorRole: session.role || 'ADMIN',
        actorName: session.name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'USER',
        entityId: targetUser.id,
        description: `Admin ${session.userId} started impersonating ${targetUser.email}`,
    });

    // Return the URL prefix
    if (targetUser.role === 'OWNER') return '/dashboard/owner';
    return '/dashboard/student';
}

export async function stopImpersonation() {
    const session = await getSession();
    if (!session || !session.impersonatorId) {
        throw new Error("Not currently impersonating anyone");
    }

    const adminId = session.impersonatorId;

    const adminUser = await prisma.user.findUnique({
        where: { id: adminId }
    });

    if (!adminUser || adminUser.role !== 'ADMIN') throw new Error("Original admin profile corrupted");

    const payload = {
        userId: adminUser.id,
        role: adminUser.role as any,
        email: adminUser.email,
        name: adminUser.name,
        roles: adminUser.roles,
    };

    const token = await signJWT(payload);

    const cookieStore = await cookies();
    cookieStore.set('rentpe_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24
    });

    logAuditEvent({
        actorId: adminUser.id,
        actorRole: 'ADMIN',
        actorName: adminUser.name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'USER',
        entityId: adminUser.id,
        description: `Admin ${adminUser.email} safely returned to admin profile`,
    });

    return '/dashboard/admin/users';
}
