/**
 * Email OTP Service
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  🚧  MOCK MODE IS ON BY DEFAULT (for testing)               ║
 * ║                                                              ║
 * ║  OTP is always "123456" until you set:                       ║
 * ║     EMAIL_OTP_ENABLED=true   in your .env                    ║
 * ║                                                              ║
 * ║  When going LIVE:                                            ║
 * ║   1. Set EMAIL_OTP_ENABLED=true in .env                      ║
 * ║   2. Make sure RESEND_API_KEY (or your email provider) works ║
 * ║   3. Remove the mock note from the signup UI                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * No MSG91 needed. No SMS costs. Uses your existing email setup.
 */

import { sendEmail } from "@/lib/email";

// ── Config ────────────────────────────────────────────────────
// Default: MOCK MODE enabled (safe for testing, 123456 always works)
const IS_MOCK_MODE = process.env.EMAIL_OTP_ENABLED !== "true";

// SECURITY FIX [H-4]: In production, fail loudly if mock mode is accidentally active.
// A missing EMAIL_OTP_ENABLED env var would silently allow "123456" as a universal OTP,
// bypassing all email verification — giving any attacker free account creation.
if (process.env.NODE_ENV === 'production' && IS_MOCK_MODE) {
    throw new Error(
        'CRITICAL SECURITY ERROR: OTP mock mode is active in production! ' +
        'Set EMAIL_OTP_ENABLED=true in your environment variables immediately.'
    );
}

// OTP expiry: 10 minutes
const OTP_EXPIRY_MS = 10 * 60 * 1000;

// Max attempts before lockout
const MAX_ATTEMPTS = 5;

// Resend cooldown: 60 seconds
const RESEND_COOLDOWN_MS = 60 * 1000;

// ── In-memory store ───────────────────────────────────────────
// Keyed by email address (lowercased)
const otpStore: Map<string, {
    otp: string;
    expiresAt: number;
    attempts: number;
    lastSentAt: number;
}> = new Map();

function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildOTPEmailHTML(name: string, otp: string, expiryMinutes: number): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #6366f1, #4f46e5); padding: 32px 24px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">🔐 RentPe</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Email Verification</p>
    </div>
    <!-- Body -->
    <div style="padding: 32px 24px;">
      <p style="color: #374151; font-size: 15px; margin: 0 0 8px;">Hi <strong>${name || "there"}</strong>,</p>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">Use the verification code below to complete your RentPe registration:</p>
      <!-- OTP Box -->
      <div style="background: #f5f3ff; border: 2px dashed #818cf8; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <p style="color: #6366f1; font-size: 42px; font-weight: 900; letter-spacing: 12px; margin: 0; font-family: monospace;">${otp}</p>
        <p style="color: #9ca3af; font-size: 12px; margin: 12px 0 0;">Valid for ${expiryMinutes} minutes</p>
      </div>
      <div style="background: #fef3c7; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
        <p style="color: #92400e; font-size: 12px; margin: 0;">⚠️ Never share this OTP with anyone. RentPe staff will never ask for your OTP.</p>
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">If you did not request this, please ignore this email. Your account is safe.</p>
    </div>
    <!-- Footer -->
    <div style="border-top: 1px solid #f1f5f9; padding: 16px 24px; text-align: center;">
      <p style="color: #d1d5db; font-size: 11px; margin: 0;">© 2025 RentPe · India's Trusted PG & Hostel Platform</p>
    </div>
  </div>
</body>
</html>`;
}

// ── sendEmailOTP ─────────────────────────────────────────────

/**
 * Send a 6-digit OTP to the given email address.
 * In MOCK MODE: always uses "123456", no email sent.
 */
export async function sendEmailOTP(
    email: string,
    name?: string
): Promise<{ success: boolean; error?: string }> {
    const key = email.toLowerCase().trim();

    if (IS_MOCK_MODE) {
        // Dev/testing: store mock OTP, no email sent
        otpStore.set(key, {
            otp: "123456",
            expiresAt: Date.now() + OTP_EXPIRY_MS,
            attempts: 0,
            lastSentAt: Date.now(),
        });
        console.log(`[OTP MOCK] OTP for ${key}: 123456`);
        return { success: true };
    }

    // Resend cooldown check
    const existing = otpStore.get(key);
    if (existing && Date.now() - existing.lastSentAt < RESEND_COOLDOWN_MS) {
        const secondsLeft = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt)) / 1000);
        return { success: false, error: `Please wait ${secondsLeft}s before requesting a new OTP.` };
    }

    const otp = generateOTP();
    const expiryMinutes = OTP_EXPIRY_MS / 60000;

    // Store before sending (so even if email fails, we can verify)
    otpStore.set(key, {
        otp,
        expiresAt: Date.now() + OTP_EXPIRY_MS,
        attempts: 0,
        lastSentAt: Date.now(),
    });

    try {
        await sendEmail({
            to: email,
            subject: `${otp} — Your RentPe Verification Code`,
            html: buildOTPEmailHTML(name || "", otp, expiryMinutes),
        });
        return { success: true };
    } catch (err) {
        console.error("[Email OTP] Failed to send email:", err);
        // Remove from store so user can retry
        otpStore.delete(key);
        return { success: false, error: "Failed to send OTP email. Please try again." };
    }
}

// ── verifyOTP ────────────────────────────────────────────────

/**
 * Verify an OTP for a given email address.
 */
export async function verifyOTP(
    email: string,
    otp: string
): Promise<{ success: boolean; error?: string }> {
    const key = email.toLowerCase().trim();
    const stored = otpStore.get(key);

    // In mock mode, always accept "123456"
    if (IS_MOCK_MODE) {
        if (otp.trim() === "123456") return { success: true };
        return { success: false, error: "Invalid OTP. (Testing mode: use 123456)" };
    }

    if (!stored) {
        return { success: false, error: "No OTP found. Please request a new code." };
    }

    if (Date.now() > stored.expiresAt) {
        otpStore.delete(key);
        return { success: false, error: "OTP has expired. Please request a new one." };
    }

    if (stored.attempts >= MAX_ATTEMPTS) {
        otpStore.delete(key);
        return { success: false, error: "Too many incorrect attempts. Please request a new OTP." };
    }

    stored.attempts++;

    if (stored.otp !== otp.trim()) {
        const remaining = MAX_ATTEMPTS - stored.attempts;
        return { success: false, error: `Invalid OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` };
    }

    // Valid — clean up
    otpStore.delete(key);
    return { success: true };
}

// ── resendOTP ────────────────────────────────────────────────

export async function resendOTP(
    email: string,
    name?: string
): Promise<{ success: boolean; error?: string }> {
    return sendEmailOTP(email, name);
}
