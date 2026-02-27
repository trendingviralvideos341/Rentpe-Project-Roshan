/**
 * RentPe – Shared Field Validators
 * Single source of truth for all field validation across the entire app.
 * Returns "" on success, error string on failure.
 */

// ── Email ────────────────────────────────────────────────────────────────────
// Strict format: local@domain.tld  — TLD must be 2-6 LETTERS only (no numbers)
export const validateEmail = (v: string): string => {
    if (!v.trim()) return "Email is required";
    const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6}$/;
    if (!re.test(v.trim())) return "Enter a valid email (e.g. name@company.com)";
    return "";
};

// ── Phone ────────────────────────────────────────────────────────────────────
// Must start with +91, then a digit 6-9, then exactly 9 more digits
export const validatePhone = (v: string): string => {
    if (!v.trim()) return "Phone number is required";
    if (!/^\+91[6-9]\d{9}$/.test(v.trim()))
        return "Must be +91 followed by 10 digits (e.g. +919876543210)";
    return "";
};

// ── Name ─────────────────────────────────────────────────────────────────────
// Letters, spaces, hyphens, apostrophes, dots — no numbers
export const validateName = (v: string): string => {
    const trimmed = v.trim();
    if (!trimmed || trimmed.length < 2) return "Name must be at least 2 characters";
    if (/\d/.test(trimmed)) return "Name must not contain numbers";
    if (!/^[A-Za-z\s.\-']+$/.test(trimmed)) return "Name must only contain letters";
    return "";
};

// ── Aadhaar ──────────────────────────────────────────────────────────────────
export const validateAadhaar = (v: string): string => {
    if (!v.trim()) return "";
    if (!/^\d{12}$/.test(v.trim())) return "Aadhaar must be exactly 12 digits";
    return "";
};

// ── PAN ──────────────────────────────────────────────────────────────────────
export const validatePAN = (v: string): string => {
    if (!v.trim()) return "";
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v.trim().toUpperCase()))
        return "PAN format: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)";
    return "";
};

// ── Password ─────────────────────────────────────────────────────────────────
export const validatePassword = (v: string): string => {
    if (!v) return "Password is required";
    if (v.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(v)) return "Must include at least one uppercase letter";
    if (!/[0-9]/.test(v)) return "Must include at least one number";
    return "";
};

// ── Helpers for phone input — restrict to +91 prefix + max 13 chars ──────────
export function normalizePhone(raw: string): string {
    let v = raw;
    if (!v.startsWith("+91")) v = "+91" + v.replace(/^\+91/, "");
    if (v.length > 13) v = v.slice(0, 13);
    return v;
}
