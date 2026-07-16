export type PeriodMode = 'financialYear' | 'calendarYear' | 'quarter' | 'month' | 'dateRange';

export interface PeriodOption {
    value: string;
    label: string;
}

export interface DateRange {
    gte: Date;
    lt: Date;
}

export interface PeriodFilter {
    mode: PeriodMode;
    financialYear?: string;
    month?: string;
    quarter?: string;
}
