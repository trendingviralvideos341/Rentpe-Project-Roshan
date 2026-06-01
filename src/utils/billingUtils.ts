// ─── billingUtils.ts ─────────────────────────────────────────────────────────
// Unified Calendar-Month Billing helpers
//
// INDUSTRY STANDARD (Zolo / Stanza / NestAway model):
//   • Billing cycle is always the 1st of every calendar month.
//   • On joining, first-month rent is PRORATED from move-in date → last day of that month.
//   • From next month onward, a full month invoice generates on the 1st.
//   • Last-month rent on move-out is PRORATED from 1st → move-out date.
//
// Formula:
//   daily_rate  = monthly_rent / days_in_that_month
//   prorated    = daily_rate × occupied_days   (rounded to nearest rupee)

/** Returns the total number of days in a given calendar month (0-indexed month). */
export function daysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

/** Round to 2 decimal places, then to nearest rupee (no paise). */
export function prorateAmount(
    monthlyRate: number,
    occupiedDays: number,
    totalDaysInMonth: number
): number {
    return Math.round((monthlyRate / totalDaysInMonth) * occupiedDays);
}

/**
 * FIRST-MONTH PRORATED RENT (Unified Calendar Billing)
 * Calculates rent from moveInDate → last day of that month (inclusive).
 *
 * Example: Move-in 28-May (31-day month)
 *   days occupied = 31 − 28 + 1 = 4
 *   daily rate    = ₹10,000 / 31 = ₹322.58
 *   prorated      = 4 × ₹322.58 = ₹1,290
 */
export function firstMonthRent(monthlyRent: number, moveInDate: Date): number {
    const y = moveInDate.getFullYear();
    const m = moveInDate.getMonth();
    const total = daysInMonth(y, m);
    const occupied = total - moveInDate.getDate() + 1; // move-in day → last day
    return prorateAmount(monthlyRent, occupied, total);
}

/**
 * LAST-MONTH PRORATED RENT (Unified Calendar Billing)
 * Calculates rent from 1st of move-out month → moveOutDate (inclusive).
 *
 * Example: Move-out 15-Jun (30-day month)
 *   days occupied = 15
 *   daily rate    = ₹10,000 / 30 = ₹333.33
 *   prorated      = 15 × ₹333.33 = ₹5,000
 */
export function lastMonthRent(monthlyRent: number, moveOutDate: Date): number {
    const y = moveOutDate.getFullYear();
    const m = moveOutDate.getMonth();
    const total = daysInMonth(y, m);
    const occupied = moveOutDate.getDate(); // 1st → move-out day
    return prorateAmount(monthlyRent, occupied, total);
}

/**
 * FOOD: Prorated charge from opt-in date to end of that month.
 */
export function proratedFoodCharge(monthlyFoodRate: number, fromDate: Date): number {
    const y = fromDate.getFullYear();
    const m = fromDate.getMonth();
    const total = daysInMonth(y, m);
    const days = total - fromDate.getDate() + 1;
    return prorateAmount(monthlyFoodRate, days, total);
}

/**
 * Returns the number of prorated days for a given move-in in the current month.
 * Useful for UI display ("you will be charged for X days this month").
 */
export function proratedDays(moveInDate: Date): number {
    const y = moveInDate.getFullYear();
    const m = moveInDate.getMonth();
    const total = daysInMonth(y, m);
    return total - moveInDate.getDate() + 1;
}

/**
 * Returns a human-readable proration note.
 * E.g. "Prorated — 28 May to 31 May (4 days)"
 */
export function proratedNote(moveInDate: Date): string {
    const y = moveInDate.getFullYear();
    const m = moveInDate.getMonth();
    const total = daysInMonth(y, m);
    const days = total - moveInDate.getDate() + 1;
    const monthName = moveInDate.toLocaleString('en-IN', { month: 'long' });
    return `Prorated — ${moveInDate.getDate()} ${monthName} to ${total} ${monthName} (${days} day${days !== 1 ? 's' : ''})`;
}
