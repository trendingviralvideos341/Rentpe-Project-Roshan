'use server';

import { cookies } from 'next/headers';
import prisma from "@/lib/prisma";
import { getSession, signJWT } from "@/lib/auth";
import { revalidatePath } from 'next/cache';

export async function impersonateUser(targetUserId: string) {
    const session = await getSession();
    // Only genuine Admins can trigger impersonation, not someone who is already impersonating
    if (!session || session.role !== 'ADMIN' || (session as any).impersonatorId) {
        throw new Error("Unauthorized: Only authentic Admins can impersonate users.");
    }

    const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId }
    });

    if (!targetUser) throw new Error("User not found");
    if (targetUser.role === 'ADMIN') throw new Error("Cannot impersonate another admin");

    const payload = {
        userId: targetUser.id,
        role: targetUser.role,
        email: targetUser.email,
        name: targetUser.name,
        // The magic trace that proves this is a God Mode override:
        impersonatorId: (session as any).userId
    };

    const token = await signJWT(payload);

    const cookieStore = await cookies();
    cookieStore.set('rentpe_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 // 24 hours
    });

    await prisma.auditLog.create({
        data: {
            action: 'IMPERSONATION_STARTED',
            targetId: targetUser.id,
            targetType: 'USER',
            details: `Admin ${(session as any).userId} started impersonating ${targetUser.email}`,
            performedBy: (session as any).userId
        }
    });

    // Return the URL prefix
    if (targetUser.role === 'OWNER') return '/dashboard/owner';
    return '/dashboard/student';
}

export async function stopImpersonation() {
    const session = await getSession();
    if (!session || !(session as any).impersonatorId) {
        throw new Error("Not currently impersonating anyone");
    }

    const adminId = (session as any).impersonatorId;

    const adminUser = await prisma.user.findUnique({
        where: { id: adminId }
    });

    if (!adminUser || adminUser.role !== 'ADMIN') throw new Error("Original admin profile corrupted");

    const payload = {
        userId: adminUser.id,
        role: adminUser.role,
        email: adminUser.email,
        name: adminUser.name
    };

    const token = await signJWT(payload);

    const cookieStore = await cookies();
    cookieStore.set('rentpe_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24
    });

    await prisma.auditLog.create({
        data: {
            action: 'IMPERSONATION_STOPPED',
            targetId: adminUser.id,
            targetType: 'USER',
            details: `Admin ${adminUser.email} safely returned to admin profile`,
            performedBy: adminUser.id
        }
    });

    return '/dashboard/admin/users';
}
