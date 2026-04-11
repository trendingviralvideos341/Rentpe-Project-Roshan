// ─── billingUtils.ts ─────────────────────────────────────────────────────────
// Prorated rent & food calculation helpers

export function daysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

export function prorateAmount(monthlyRate: number, occupiedDays: number, totalDaysInMonth: number): number {
    return Math.round((monthlyRate / totalDaysInMonth) * occupiedDays);
}

/** First-month rent: from moveInDate to end of that month (inclusive). */
export function firstMonthRent(monthlyRent: number, moveInDate: Date): number {
    const y = moveInDate.getFullYear();
    const m = moveInDate.getMonth();
    const total = daysInMonth(y, m);
    const occupied = total - moveInDate.getDate() + 1;
    return prorateAmount(monthlyRent, occupied, total);
}

/** Last-month rent: from 1st of the month to moveOutDate (inclusive). */
export function lastMonthRent(monthlyRent: number, moveOutDate: Date): number {
    const y = moveOutDate.getFullYear();
    const m = moveOutDate.getMonth();
    const total = daysInMonth(y, m);
    const occupied = moveOutDate.getDate();
    return prorateAmount(monthlyRent, occupied, total);
}

/** Food charge from opt-in date to end of that month. */
export function proratedFoodCharge(monthlyFoodRate: number, fromDate: Date): number {
    const y = fromDate.getFullYear();
    const m = fromDate.getMonth();
    const total = daysInMonth(y, m);
    const days = total - fromDate.getDate() + 1;
    return prorateAmount(monthlyFoodRate, days, total);
}
