import { JS_FINANCIAL_YEAR_START_MONTH_INDEX } from '@/constants/date';
import { PeriodOption, DateRange } from '@/types/date';
import { getISTDate } from './timezone';

/**
 * Calculates the starting year of the financial year for a given calendar date.
 * E.g., July 2026 -> FY 2026-27 (returns 2026)
 * E.g., Feb 2026 -> FY 2025-26 (returns 2025)
 */
export function getCurrentFY(today: Date = new Date()): number {
    const istDate = getISTDate(today);
    const month = istDate.getMonth(); // 0-indexed
    const year = istDate.getFullYear();
    return month >= JS_FINANCIAL_YEAR_START_MONTH_INDEX ? year : year - 1;
}

/**
 * Generates the list of 12 months for a financial year, starting with April and ending with March.
 * Value format is standardized to "01" to "12".
 */
export function getFYMonths(): PeriodOption[] {
    return [
        { value: '04', label: 'April' },
        { value: '05', label: 'May' },
        { value: '06', label: 'June' },
        { value: '07', label: 'July' },
        { value: '08', label: 'August' },
        { value: '09', label: 'September' },
        { value: '10', label: 'October' },
        { value: '11', label: 'November' },
        { value: '12', label: 'December' },
        { value: '01', label: 'January' },
        { value: '02', label: 'February' },
        { value: '03', label: 'March' }
    ];
}

/**
 * Checks if a given month and FY year represents a future month relative to today's date.
 * monthValue parameter format: "01" to "12"
 */
export function isFutureFYMonth(monthValue: string, fyYear: number, today: Date = new Date()): boolean {
    const istDate = getISTDate(today);
    const currentFY = getCurrentFY(istDate);

    if (fyYear > currentFY) return true;
    if (fyYear < currentFY) return false;

    // Same FY: compare months
    const monthNum = parseInt(monthValue, 10);
    const currentMonthNum = istDate.getMonth() + 1; // 1-indexed (1 to 12)

    // In FY, months are ordered: 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3
    // We can map these to order scores (0 to 11) for comparison
    const getMonthOrder = (m: number) => (m >= 4 ? m - 4 : m + 8);

    return getMonthOrder(monthNum) > getMonthOrder(currentMonthNum);
}

/**
 * Returns the exact UTC Date range for a given Financial Year or a single month inside it.
 * Enforces IST boundary rules (00:00:00 IST to 23:59:59.999 IST).
 */
export function getFYDateRange(fyYear: number, month?: string): DateRange {
    if (!month || month === 'all' || month === 'ALL') {
        // Full Financial Year: April 1st 00:00:00 IST to March 31st 23:59:59.999 IST of next year
        const start = new Date(Date.UTC(fyYear, 3, 1, 0, 0, 0, 0));
        start.setUTCHours(start.getUTCHours() - 5);
        start.setUTCMinutes(start.getUTCMinutes() - 30); // April 1 00:00 IST

        const end = new Date(Date.UTC(fyYear + 1, 2, 31, 23, 59, 59, 999));
        end.setUTCHours(end.getUTCHours() - 5);
        end.setUTCMinutes(end.getUTCMinutes() - 30); // March 31 23:59 IST

        return { gte: start, lt: end };
    }

    const monthNum = parseInt(month, 10);
    const calendarYear = monthNum >= 4 ? fyYear : fyYear + 1;

    // Start of month
    const start = new Date(Date.UTC(calendarYear, monthNum - 1, 1, 0, 0, 0, 0));
    start.setUTCHours(start.getUTCHours() - 5);
    start.setUTCMinutes(start.getUTCMinutes() - 30);

    // End of month (last millisecond of the month)
    const end = new Date(Date.UTC(calendarYear, monthNum, 0, 23, 59, 59, 999));
    end.setUTCHours(end.getUTCHours() - 5);
    end.setUTCMinutes(end.getUTCMinutes() - 30);

    return { gte: start, lt: end };
}
