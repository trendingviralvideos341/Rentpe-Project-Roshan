'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { generate2FASecret, generate2FAQRCode, verify2FAToken } from "@/lib/2fa";
import { revalidatePath } from "next/cache";

/**
 * Initialize 2FA setup for the current admin
 */
export async function setup2FA() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const userId = (session as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new Error("User not found");

    const secret = generate2FASecret();
    const qrCode = await generate2FAQRCode(user.email, secret);

    // Temp store secret in DB but don't enable it yet
    await prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecret: secret, twoFactorEnabled: false }
    });

    return { secret, qrCode };
}

/**
 * Confirm and activate 2FA with the first token
 */
export async function confirm2FA(token: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const userId = (session as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorSecret: true } });
    if (!user || !user.twoFactorSecret) throw new Error("2FA not initialized");

    const isValid = verify2FAToken(user.twoFactorSecret, token);
    if (!isValid) return { error: "Invalid verification code. Please try again." };

    await prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: true }
    });

    await prisma.auditLog.create({
        data: {
            action: '2FA_ENABLED',
            targetId: userId,
            targetType: 'USER',
            details: 'Two-factor authentication enabled successfully.',
            performedBy: userId
        }
    });

    revalidatePath('/dashboard/admin/settings');
    return { success: true };
}

/**
 * Disable 2FA (requires current token for security)
 */
export async function disable2FA(token: string) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') throw new Error("Unauthorized");

    const userId = (session as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorSecret: true } });
    if (!user || !user.twoFactorSecret) throw new Error("2FA not enabled");

    const isValid = verify2FAToken(user.twoFactorSecret, token);
    if (!isValid) return { error: "Invalid verification code. Cannot disable 2FA." };

    await prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: false, twoFactorSecret: null }
    });

    await prisma.auditLog.create({
        data: {
            action: '2FA_DISABLED',
            targetId: userId,
            targetType: 'USER',
            details: 'Two-factor authentication disabled by user.',
            performedBy: userId
        }
    });

    revalidatePath('/dashboard/admin/settings');
    return { success: true };
}
