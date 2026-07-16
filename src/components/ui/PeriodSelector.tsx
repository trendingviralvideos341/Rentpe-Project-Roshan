'use client';

import React, { useMemo } from 'react';
import { PeriodFilter } from '@/types/date';
import { getCurrentFY, getFYMonths, isFutureFYMonth } from '@/lib/date';
import { getFYOptions } from '@/lib/date/formatter';

interface PeriodSelectorProps {
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
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({
    value,
    onChange,
    today = new Date(),
    fromFY = 2023,
    toFY,
    className = '',
    showLabels = true
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

    return (
        <div className={`flex items-center gap-4 flex-wrap ${className}`}>
            {/* Financial Year Selector */}
            <div className="flex flex-col gap-1">
                {showLabels && (
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Select Year
                    </label>
                )}
                <select
                    aria-label="Select Financial Year"
                    value={value.financialYear ?? String(currentFY)}
                    onChange={handleYearChange}
                    className="appearance-none h-9 pl-3 pr-8 text-xs font-bold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer min-w-[140px] text-slate-700"
                >
                    {fyOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Month Selector */}
            <div className="flex flex-col gap-1">
                {showLabels && (
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Select Month
                    </label>
                )}
                <select
                    aria-label="Select Month"
                    value={value.month ?? 'all'}
                    onChange={handleMonthChange}
                    className="appearance-none h-9 pl-3 pr-8 text-xs font-bold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer min-w-[130px] text-slate-700"
                >
                    <option value="all">All Months (FY)</option>
                    {monthOptions.map(m => (
                        <option key={m.value} value={m.value}>
                            {m.label}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default React.memo(PeriodSelector);
