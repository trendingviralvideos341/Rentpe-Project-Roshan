/**
 * Formats a Financial Year start year into a human-readable label.
 * E.g., 2026 -> "FY 2026-27"
 */
export function getFYLabel(fyStartYear: number): string {
    const endYear = (fyStartYear + 1).toString().slice(-2);
    return `FY ${fyStartYear}-${endYear}`;
}

/**
 * Generates an array of Financial Year dropdown options.
 * @param fromFY - The earliest FY start year to show (e.g., 2023)
 * @param toFY   - The latest FY start year to show (e.g., 2027)
 */
export function getFYOptions(fromFY: number, toFY: number) {
    const options = [];
    for (let fy = toFY; fy >= fromFY; fy--) {
        options.push({ value: String(fy), label: getFYLabel(fy) });
    }
    return options;
}

/**
 * Formats a date into Indian locale date string.
 * E.g., 2026-04-01 -> "1 April 2026"
 */
export function formatIndianDate(date: Date): string {
    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Kolkata'
    });
}

/**
 * Formats a date into Indian locale short month + year.
 * E.g., 2026-04-01 -> "Apr 2026"
 */
export function formatShortMonthYear(date: Date): string {
    return date.toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata'
    });
}
