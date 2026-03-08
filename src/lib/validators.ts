/**
 * RentPe – Shared Field Validators
 * Single source of truth for all field validation across the entire app.
 * Returns "" on success, error string on failure.
 */

// Strict format: local@domain.tld — TLD must be 2-6 LETTERS only (no numbers)
export const validateEmail = (v: string): string => {
    const trimmed = v.trim();
    if (!trimmed) return "Email is required";
    // standard industry regex but keeping TLD restricted to 2-6 alphabets as requested
    const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6}$/;
    if (!re.test(trimmed)) return "Enter a valid email (e.g. name@company.com)";
    return "";
};

// ── Phone ────────────────────────────────────────────────────────────────────
// Accepts +91 followed by 10 digits OR just 10 digits (6-9 start)
// Enforces +91 followed by exactly 10 digits (6-9 start)
export const validatePhone = (v: string): string => {
    const trimmed = v.trim();
    if (!trimmed) return "Phone number is required";
    
    // Strict format: +91XXXXXXXXXX
    const re = /^\+91[6-9]\d{9}$/;
    if (!re.test(trimmed)) {
        if (!trimmed.startsWith("+91")) return "Phone number must start with +91";
        if (trimmed.length !== 13) return "Phone number must be exactly 10 digits after +91";
        return "Enter a valid Indian mobile number starting with 6-9";
    }
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

// ── Helpers for phone input — Allow flexible input, normalize to +91 for DB ──
export function normalizePhone(raw: string): string {
    let v = raw.trim().replace(/\s+/g, ""); // Remove spaces

    // If it's exactly 10 digits starting with 6-9, prepend +91
    if (/^[6-9]\d{9}$/.test(v)) {
        return "+91" + v;
    }

    // If it starts with 91 (no +), prepend +
    if (/^91[6-9]\d{9}$/.test(v)) {
        return "+" + v;
    }

    // Otherwise ensure it starts with +91 if intended for Indian numbers
    if (!v.startsWith("+91") && v.length >= 10) {
        // Fallback or leave as is if already valid
    }

    if (v.length > 13) v = v.slice(0, 13);
    return v;
}
