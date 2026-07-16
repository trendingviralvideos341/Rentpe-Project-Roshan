import { DEFAULT_TIMEZONE } from '@/constants/date';

/**
 * Returns a Date object adjusted to Asia/Kolkata (IST) equivalent timezone representation.
 */
export function getISTDate(date: Date = new Date()): Date {
    // Convert current Date to string representation in target timezone, then parse it back
    const tzString = date.toLocaleString('en-US', { timeZone: DEFAULT_TIMEZONE });
    return new Date(tzString);
}

/**
 * Converts a calendar date string (YYYY-MM-DD) to a UTC Date object aligned to 00:00:00 IST.
 * 00:00:00 IST = 18:30:00 UTC of previous calendar day.
 */
export function getISTStartOfDayUTC(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    // Month is 0-indexed in Date.UTC
    const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    // Shift back by 5 hours and 30 minutes to align 00:00 IST to UTC
    utcDate.setUTCHours(utcDate.getUTCHours() - 5);
    utcDate.setUTCMinutes(utcDate.getUTCMinutes() - 30);
    return utcDate;
}

/**
 * Converts a calendar date string (YYYY-MM-DD) to a UTC Date object aligned to 23:59:59.999 IST.
 * 23:59:59.999 IST = 18:29:59.999 UTC of current calendar day.
 */
export function getISTEndOfDayUTC(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    utcDate.setUTCHours(utcDate.getUTCHours() - 5);
    utcDate.setUTCMinutes(utcDate.getUTCMinutes() - 30);
    return utcDate;
}
