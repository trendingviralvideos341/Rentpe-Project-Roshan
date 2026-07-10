'use server';

import prisma from "@/lib/prisma";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { logAuditEvent } from "@/lib/audit";
import { withSafeAction } from "@/lib/safe-action";

// Generates a token, saves it to the user, and "sends" it (prints to console for MVP)
export const requestPasswordReset = withSafeAction(async function _requestPasswordReset(email: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            // Return success even if not found to prevent email enumeration attacks
            return { message: "If an account with that email exists, we have sent a reset link." };
        }

        // Generate a random 64-character hex token
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Token expires in 1 hour
        const resetTokenExpiry = new Date(Date.now() + 3600000);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken,
                resetTokenExpiry
            }
        });

        // IN A PRODUCTION ENVIRONMENT:
        // You would use Resend, SendGrid, or AWS SES here to email `http://yourdomain.com/reset-password?token=${resetToken}`

        // FOR THIS MVP LOCAL TESTING: We log the secure link to the Node console
        console.log(`\n\n=========================================\n`);
        console.log(`🔐 PASSWORD RESET REQUEST FOR: ${email}`);
        console.log(`🔗 Link: http://localhost:3000/reset-password?token=${resetToken}`);
        console.log(`\n=========================================\n\n`);

        return { message: "If an account with that email exists, we have sent a reset link." };
    } catch (error) {
        console.error("Password reset request error:", error);
        throw new Error("An unexpected error occurred. Please try again later.");
    }
});

// Validates the token and updates the user's password hash
export const executePasswordReset = withSafeAction(async function _executePasswordReset(token: string, newPassword: string) {
    try {
        if (!token || token.length < 32 || newPassword.length < 6) {
            throw new Error("Invalid token or password too short.");
        }

        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpiry: {
                    gt: new Date() // Must be in the future
                }
            }
        });

        if (!user) {
            throw new Error("This password reset link is invalid or has expired.");
        }

        // Hash the new password securely
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        // Update the password and instantly invalidate the token so it can't be reused
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                resetToken: null,
                resetTokenExpiry: null
            }
        });

        // Log the security event
        logAuditEvent({
            actorId: user.id,
            actorRole: user.role || 'USER',
            actorName: user.name || 'User',
            actionType: 'UPDATE', // Password reset
            entityType: 'USER',
            entityId: user.id,
            description: `User completed self-serve password reset via email token link.`,
        });

        return { message: "Your password has been reset successfully. You can now log in." };

    } catch (error: any) {
        console.error("Execute reset error:", error);
        throw new Error(error.message || "Failed to reset password. Please try again.");
    }
});
