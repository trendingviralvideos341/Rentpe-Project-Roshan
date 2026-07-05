'use server';

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { generate2FASecret, generate2FAQRCode, verify2FAToken } from "@/lib/2fa";
import { encrypt, decrypt, decryptIfPresent } from "@/lib/crypto";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";

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

    // SECURITY FIX: Encrypt the 2FA secret before storing.
    // The raw secret is returned to the browser ONCE for QR code display,
    // but only the encrypted form is persisted to the database.
    const encryptedSecret = encrypt(secret);

    // Temp store encrypted secret in DB but don't enable it yet
    await prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecretEncrypted: encryptedSecret, twoFactorEnabled: false }
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
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorSecretEncrypted: true } });
    if (!user || !user.twoFactorSecretEncrypted) throw new Error("2FA not initialized");

    // SECURITY FIX: Decrypt the stored secret before verifying the TOTP token
    const secret = decrypt(user.twoFactorSecretEncrypted);
    const isValid = verify2FAToken(secret, token);
    if (!isValid) return { error: "Invalid verification code. Please try again." };

    await prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: true }
    });

    logAuditEvent({
        actorId: userId,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'USER',
        entityId: userId,
        description: 'Two-factor authentication enabled successfully.',
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
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorSecretEncrypted: true } });
    if (!user || !user.twoFactorSecretEncrypted) throw new Error("2FA not enabled");

    // SECURITY FIX: Decrypt before verifying the disable token
    const secret = decrypt(user.twoFactorSecretEncrypted);
    const isValid = verify2FAToken(secret, token);
    if (!isValid) return { error: "Invalid verification code. Cannot disable 2FA." };

    await prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: false, twoFactorSecretEncrypted: null }
    });

    logAuditEvent({
        actorId: userId,
        actorRole: 'ADMIN',
        actorName: (session as any).name || 'Admin',
        actionType: 'UPDATE',
        entityType: 'USER',
        entityId: userId,
        description: 'Two-factor authentication disabled by user.',
    });

    revalidatePath('/dashboard/admin/settings');
    return { success: true };
}
