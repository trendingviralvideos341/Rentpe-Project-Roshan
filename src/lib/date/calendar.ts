import { PeriodOption } from '@/types/date';
import { MONTH_NAMES, SHORT_MONTH_NAMES } from '@/constants/date';

/**
 * Returns all calendar year months in standard January-December order.
 * Values are 1-indexed ("01" to "12").
 */
export function getCalendarMonths(): PeriodOption[] {
    return Array.from({ length: 12 }, (_, i) => ({
        value: String(i + 1).padStart(2, '0'),
        label: MONTH_NAMES[i]
    }));
}

/**
 * Returns the short label for a given 1-indexed month number.
 */
export function getShortMonthLabel(month: number): string {
    return SHORT_MONTH_NAMES[(month - 1 + 12) % 12];
}

/**
 * Returns the full label for a given 1-indexed month number.
 */
export function getMonthLabel(month: number): string {
    return MONTH_NAMES[(month - 1 + 12) % 12];
}

/**
 * Returns the 4 financial quarters of the Indian Financial Year.
 */
export function getFYQuarters(): PeriodOption[] {
    return [
        { value: 'Q1', label: 'Q1 (Apr – Jun)' },
        { value: 'Q2', label: 'Q2 (Jul – Sep)' },
        { value: 'Q3', label: 'Q3 (Oct – Dec)' },
        { value: 'Q4', label: 'Q4 (Jan – Mar)' }
    ];
}

/**
 * Returns the last day of a month (handles leap years).
 * monthNum: 1-indexed
 */
export function getLastDayOfMonth(year: number, monthNum: number): number {
    return new Date(year, monthNum, 0).getDate();
}
