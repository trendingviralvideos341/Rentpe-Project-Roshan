'use server';

import prisma from "@/lib/prisma";
import crypto from "crypto";
import bcrypt from "bcryptjs";

// Generates a token, saves it to the user, and "sends" it (prints to console for MVP)
export async function requestPasswordReset(email: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            // Return success even if not found to prevent email enumeration attacks
            return { success: true, message: "If an account with that email exists, we have sent a reset link." };
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

        return { success: true, message: "If an account with that email exists, we have sent a reset link." };
    } catch (error) {
        console.error("Password reset request error:", error);
        return { success: false, error: "An unexpected error occurred. Please try again later." };
    }
}

// Validates the token and updates the user's password hash
export async function executePasswordReset(token: string, newPassword: string) {
    try {
        if (!token || token.length < 32 || newPassword.length < 6) {
            return { success: false, error: "Invalid token or password too short." };
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
            return { success: false, error: "This password reset link is invalid or has expired." };
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
        await prisma.auditLog.create({
            data: {
                action: 'PASSWORD_RESET',
                targetId: user.id,
                targetType: 'USER',
                details: `User completed self-serve password reset via email token link.`,
                performedBy: user.id
            }
        });

        return { success: true, message: "Your password has been reset successfully. You can now log in." };

    } catch (error) {
        console.error("Execute reset error:", error);
        return { success: false, error: "Failed to reset password. Please try again." };
    }
}
