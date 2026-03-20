/**
 * foodBillingUtils.ts
 * Pure, side-effect-free utility functions for the Food Billing system.
 * No Prisma imports — fully testable in isolation.
 * All monetary values use round2dp(). All dates normalized to UTC.
 */

// ─────────────────────────────────────────────
// 1. DATE UTILITIES
// ─────────────────────────────────────────────

/** Normalize any date to UTC midnight */
export function toUTC(date: Date | string): Date {
    const d = new Date(date);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Format as YYYY-MM-DD (ISO date) */
export function toISODate(date: Date | string): string {
    const d = toUTC(date);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Format as YYYY-MM (ISO billing month) for invoice dedup */
export function toBillingMonth(date: Date | string): string {
    const d = toUTC(date);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

/** Returns the number of days in a given UTC month */
function daysInUTCMonth(year: number, month: number): number {
    // month is 0-indexed
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Returns the start of the next billing cycle given an anchor day and a reference date.
 * Edge case: if anchorDay > days in target month, falls back to last day of month.
 *
 * @param anchorDay  Day-of-month the tenant's cycle starts (1–31)
 * @param fromDate   Reference date (usually "today")
 */
export function nextBillingCycleStart(anchorDay: number, fromDate: Date | string): Date {
    const from = toUTC(fromDate);
    const year = from.getUTCFullYear();
    const month = from.getUTCMonth(); // 0-indexed
    const currentDay = from.getUTCDate();

    // If we haven't passed this month's anchor yet, it's this month; otherwise next month
    let targetYear = year;
    let targetMonth = month;

    if (currentDay >= anchorDay) {
        targetMonth += 1;
        if (targetMonth > 11) {
            targetMonth = 0;
            targetYear += 1;
        }
    }

    const maxDay = daysInUTCMonth(targetYear, targetMonth);
    const targetDay = Math.min(anchorDay, maxDay); // edge case: anchorDay > days in month

    return new Date(Date.UTC(targetYear, targetMonth, targetDay));
}

// ─────────────────────────────────────────────
// 2. FINANCIAL UTILITIES
// ─────────────────────────────────────────────

/** Consistent 2 decimal place rounding for all monetary values */
export function round2dp(n: number): number {
    return Math.round(n * 100) / 100;
}

/**
 * Calculate pro-rated food charge for first activation in a billing cycle.
 * Formula: price × (daysActive / totalDaysInCycle)
 *
 * @param foodPrice     Full monthly price (₹)
 * @param effectiveFrom Date food became active
 * @param cycleStart    Start of billing cycle
 * @param cycleEnd      End of billing cycle (exclusive)
 */
export function calculateProratedFood(
    foodPrice: number,
    effectiveFrom: Date | string,
    cycleStart: Date | string,
    cycleEnd: Date | string
): number {
    const start = toUTC(cycleStart);
    const end = toUTC(cycleEnd);
    const active = toUTC(effectiveFrom);

    const totalMs = end.getTime() - start.getTime();
    const totalDays = totalMs / (1000 * 60 * 60 * 24);

    // Active from the later of effectiveFrom and cycleStart
    const activeFrom = active > start ? active : start;
    const activeDays = Math.max(0, (end.getTime() - activeFrom.getTime()) / (1000 * 60 * 60 * 24));

    if (totalDays === 0) return 0;
    return round2dp(foodPrice * (activeDays / totalDays));
}

// ─────────────────────────────────────────────
// 3. FOOD PREFERENCE HELPERS
// ─────────────────────────────────────────────

/**
 * Get the active food preference for a billing date.
 * Expects an array pre-sorted by effectiveFrom DESC (caller uses orderBy: desc).
 * Returns the first CONFIRMED record where effectiveFrom <= billingDate.
 */
export function getActiveFoodPreference<T extends {
    status: string;
    effectiveFrom: Date;
    foodSelected: boolean;
}>(prefs: T[], billingDate: Date): T | null {
    const date = toUTC(billingDate);
    return prefs.find(
        p => p.status === 'CONFIRMED' && toUTC(p.effectiveFrom) <= date
    ) ?? null;
}

/**
 * Returns true if this is the very first time food has ever been activated
 * for this booking (no prior CONFIRMED pref with foodSelected=true).
 */
export function isFirstActivation<T extends {
    status: string;
    foodSelected: boolean;
}>(prefs: T[]): boolean {
    return !prefs.some(p => p.status === 'CONFIRMED' && p.foodSelected === true);
}

// ─────────────────────────────────────────────
// 4. TOKEN VALIDATION
// ─────────────────────────────────────────────

/**
 * Validate a food preference confirmation token.
 * Returns true only if token is not expired and not already used.
 */
export function isTokenValid(pref: {
    tokenExpiry: Date | null | undefined;
    tokenUsed: boolean;
}): boolean {
    if (pref.tokenUsed) return false;
    if (!pref.tokenExpiry) return false;
    return new Date(pref.tokenExpiry) > new Date();
}

// ─────────────────────────────────────────────
// 5. CREDIT NOTE APPLICATION
// ─────────────────────────────────────────────

export interface CreditNoteInput {
    id: string;
    amount: number;
    status: string;
    createdAt: Date;
}

export interface CreditNoteResult {
    finalAmount: number;       // invoice amount after credits (always >= 0)
    creditApplied: number;     // total credits deducted
    carryForward: number;      // excess credits not used (to be carried to next cycle)
    appliedIds: string[];      // IDs of credit notes that were fully/partially applied
}

/**
 * Apply pending credit notes to an invoice amount using FIFO order (createdAt ASC).
 * - Negative billing protection: finalAmount never goes below 0
 * - Excess credits are returned as carryForward
 * - All amounts via round2dp
 *
 * @param invoiceAmount  Subtotal (rent + food) before credits
 * @param credits        Array of PENDING credit notes (should already be sorted createdAt ASC)
 */
export function applyCreditNotes(
    invoiceAmount: number,
    credits: CreditNoteInput[]
): CreditNoteResult {
    // Sort FIFO — caller should pass pre-sorted, but we enforce it here too
    const sorted = [...credits].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let remaining = round2dp(invoiceAmount);
    let creditApplied = 0;
    const appliedIds: string[] = [];

    for (const note of sorted) {
        if (remaining <= 0) break;
        const apply = Math.min(note.amount, remaining);
        remaining = round2dp(remaining - apply);
        creditApplied = round2dp(creditApplied + apply);
        appliedIds.push(note.id);
    }

    // Total credits available vs what we applied
    const totalCredits = round2dp(credits.reduce((s, c) => s + c.amount, 0));
    const carryForward = round2dp(Math.max(0, totalCredits - creditApplied));
    const finalAmount = round2dp(Math.max(0, invoiceAmount - creditApplied));

    return { finalAmount, creditApplied, carryForward, appliedIds };
}
