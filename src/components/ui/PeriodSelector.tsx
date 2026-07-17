'use client';

import React, { useMemo } from 'react';
import { PeriodFilter } from '@/types/date';
import { getCurrentFY, getFYMonths, isFutureFYMonth } from '@/lib/date';
import { getFYOptions } from '@/lib/date/formatter';

export interface PeriodSelectorProps {
    value: PeriodFilter;
    onChange: (filter: PeriodFilter) => void;
    /** Inject today's date — defaults to new Date(). Pass a fixed date in tests to simulate rollover. */
    today?: Date;
    /** Earliest FY to show in the dropdown */
    fromFY?: number;
    /** Latest FY to show in the dropdown */
    toFY?: number;
    /** CSS class override for the wrapper div */
    className?: string;
    /** Whether to show the label row above the selectors */
    showLabels?: boolean;
    /** Theme variant to match page aesthetics */
    theme?: 'light' | 'dark';
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({
    value,
    onChange,
    today = new Date(),
    fromFY = 2023,
    toFY,
    className = '',
    showLabels = true,
    theme = 'light'
}) => {
    const currentFY = getCurrentFY(today);
    const effectiveToFY = toFY ?? (currentFY + 1);

    // Memoized FY options list — only recalculates when fromFY or toFY changes
    const fyOptions = useMemo(() => getFYOptions(fromFY, effectiveToFY), [fromFY, effectiveToFY]);

    // Memoized month options — filters out future months when current FY is selected
    const monthOptions = useMemo(() => {
        const allMonths = getFYMonths();
        const selectedFYYear = parseInt(value.financialYear ?? String(currentFY), 10);
        return allMonths.filter(m => !isFutureFYMonth(m.value, selectedFYYear, today));
    }, [value.financialYear, today, currentFY]);

    const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange({
            ...value,
            financialYear: e.target.value,
            month: 'all' // Reset month on FY change to avoid invalid selection
        });
    };

    const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange({
            ...value,
            month: e.target.value
        });
    };

    const labelClass = theme === 'dark' 
        ? "text-[10px] font-bold uppercase tracking-widest text-slate-300"
        : "text-[10px] font-bold uppercase tracking-widest text-slate-400";

    const selectClass = theme === 'dark'
        ? "appearance-none h-9 pl-3 pr-8 text-xs font-bold bg-slate-800/80 border border-slate-700 hover:border-slate-600 text-white rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer min-w-[140px] backdrop-blur-sm transition-colors"
        : "appearance-none h-9 pl-3 pr-8 text-xs font-bold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer min-w-[140px] text-slate-700";

    return (
        <div className={`flex items-center gap-4 flex-wrap ${className}`}>
            {/* Financial Year Selector */}
            <div className="flex flex-col gap-1 relative">
                {showLabels && <label className={labelClass}>Select Year</label>}
                <select
                    aria-label="Select Financial Year"
                    value={value.financialYear ?? String(currentFY)}
                    onChange={handleYearChange}
                    className={selectClass}
                    style={{ colorScheme: theme }}
                >
                    {fyOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 ${showLabels ? 'pt-5' : ''} text-slate-400`}>
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>

            {/* Month Selector */}
            <div className="flex flex-col gap-1 relative">
                {showLabels && <label className={labelClass}>Select Month</label>}
                <select
                    aria-label="Select Month"
                    value={value.month ?? 'all'}
                    onChange={handleMonthChange}
                    className={selectClass}
                    style={{ colorScheme: theme }}
                >
                    <option value="all">All Months (FY)</option>
                    {monthOptions.map(m => (
                        <option key={m.value} value={m.value}>
                            {m.label}
                        </option>
                    ))}
                </select>
                <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 ${showLabels ? 'pt-5' : ''} text-slate-400`}>
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>
        </div>
    );
};

export default React.memo(PeriodSelector);
