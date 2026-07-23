import { getCurrentFY, getCurrentFYMonthString } from '@/lib/date';
import { PeriodFilter } from '@/types/date';

const CURRENT_VERSION = '1';

const VALID_MONTHS = new Set([
    '01', '02', '03', '04', '05', '06',
    '07', '08', '09', '10', '11', '12', 'all', 'ALL'
]);

const VALID_QUARTERS = new Set(['Q1', 'Q2', 'Q3', 'Q4', 'all', 'ALL']);

/**
 * Validates and sanitizes a Financial Year value from URL params.
 * Accepts a 4-digit year string (e.g., "2026"). Capped at current FY.
 */
function sanitizeFY(raw: string | null, today: Date): string {
    const current = getCurrentFY(today);
    if (!raw) return String(current);
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed < 2020 || parsed > current) {
        return String(current);
    }
    return String(parsed);
}

/**
 * Validates and sanitizes a Month value from URL params.
 * Accepts "01" to "12", "all", or "ALL". Falls back to defaultMonth or "all".
 */
function sanitizeMonth(raw: string | null, defaultMonth: string = 'all'): string {
    if (!raw) return defaultMonth;
    const padded = raw.padStart(2, '0');
    if (!VALID_MONTHS.has(padded) && !VALID_MONTHS.has(raw)) return defaultMonth;
    return padded === raw ? raw : padded;
}

/**
 * Validates and sanitizes a Quarter value from URL params.
 */
function sanitizeQuarter(raw: string | null): string {
    if (!raw || !VALID_QUARTERS.has(raw)) return 'all';
    return raw;
}

/**
 * Reads and parses search params into a validated PeriodFilter.
 * Always safe — invalid or missing values fall back to sensible defaults.
 * Supports versioned query strings (?v=1&fy=2026&month=04).
 */
export function parsePeriodSearchParams(
    searchParams: URLSearchParams,
    today: Date = new Date(),
    options?: { defaultMonth?: string }
): PeriodFilter {
    const fallbackMonth = options?.defaultMonth ?? 'all';
    // If version doesn't match, return defaults (forward-compatible fallback)
    const version = searchParams.get('v');
    if (version && version !== CURRENT_VERSION) {
        return {
            mode: 'financialYear',
            financialYear: String(getCurrentFY(today)),
            month: fallbackMonth,
            quarter: 'all'
        };
    }

    return {
        mode: 'financialYear',
        financialYear: sanitizeFY(searchParams.get('fy'), today),
        month: sanitizeMonth(searchParams.get('month'), fallbackMonth),
        quarter: sanitizeQuarter(searchParams.get('quarter'))
    };
}

/**
 * Serializes a PeriodFilter into a versioned URLSearchParams string.
 * E.g., { financialYear: "2026", month: "04" } -> "v=1&fy=2026&month=04"
 */
export function serializePeriodFilter(filter: PeriodFilter): string {
    const params = new URLSearchParams();
    params.set('v', CURRENT_VERSION);
    if (filter.financialYear) params.set('fy', filter.financialYear);
    if (filter.month && filter.month !== 'all') params.set('month', filter.month);
    if (filter.quarter && filter.quarter !== 'all') params.set('quarter', filter.quarter);
    return params.toString();
}
