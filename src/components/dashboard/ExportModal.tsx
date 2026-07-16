'use client';

import { useState } from 'react';
import { X, Download, FileSpreadsheet, Loader2, ChevronDown } from 'lucide-react';
import { getExportRentInflows, getExportPayouts, getExportRefunds } from '@/actions/exportPayments';
import { unwrap } from '@/lib/safe-action';
import { toast } from 'sonner';

const MONTHS = [
    { value: 'ALL', label: 'All Months (Entire Year)' },
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
];

interface ExportModalProps {
    type: 'RENT_INFLOWS' | 'PAYOUTS' | 'REFUNDS';
    onClose: () => void;
}

export function ExportModal({ type, onClose }: ExportModalProps) {
    const currentYear = new Date().getFullYear();
    const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');
    
    const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
    const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
    const [isExporting, setIsExporting] = useState(false);

    // Calculate available years (e.g., from 2026 up to current year)
    const startYear = 2026;
    const availableYears = Array.from({ length: Math.max(1, currentYear - startYear + 1) }, (_, i) => (startYear + i).toString());

    // Filter available months for the selected year
    const availableMonths = MONTHS.filter(m => {
        if (m.value === 'ALL') return true;
        if (selectedYear === currentYear.toString()) {
            return parseInt(m.value) <= parseInt(currentMonthStr);
        }
        return true;
    });

    const handleExport = async () => {
        setIsExporting(true);
        try {
            let data: any[] = [];
            
            if (type === 'RENT_INFLOWS') {
                data = await unwrap(getExportRentInflows({ year: selectedYear, month: selectedMonth }));
            } else if (type === 'PAYOUTS') {
                data = await unwrap(getExportPayouts({ year: selectedYear, month: selectedMonth }));
            } else if (type === 'REFUNDS') {
                data = await unwrap(getExportRefunds({ year: selectedYear, month: selectedMonth }));
            }

            if (!data || data.length === 0) {
                toast.error('No data found for the selected period.');
                setIsExporting(false);
                return;
            }

            // Convert to CSV
            const headers = Object.keys(data[0]);
            const csvRows = [];
            
            // Add Headers
            csvRows.push(headers.join(','));
            
            // Add Data
            for (const row of data) {
                const values = headers.map(header => {
                    const val = row[header];
                    // Escape commas and quotes for CSV
                    if (val === null || val === undefined) return '""';
                    let stringVal = String(val).replace(/"/g, '""');
                    // Prevent CSV Injection (Formula Injection)
                    if (stringVal.startsWith('=') || stringVal.startsWith('+') || stringVal.startsWith('-') || stringVal.startsWith('@')) {
                        stringVal = `'${stringVal}`;
                    }
                    if (stringVal.includes(',') || stringVal.includes('\n') || stringVal.includes('\r') || stringVal.includes('"')) {
                        return `"${stringVal}"`;
                    }
                    return stringVal;
                });
                csvRows.push(values.join(','));
            }

            const csvString = csvRows.join('\n');
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            let filename = '';
            if (type === 'RENT_INFLOWS') filename = 'Rent_Collection_Report';
            else if (type === 'PAYOUTS') filename = 'Payouts_Report';
            else if (type === 'REFUNDS') filename = 'Refunds_Report';
            
            link.setAttribute('download', `${filename}_${selectedYear}_${selectedMonth === 'ALL' ? 'Annual' : selectedMonth}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast.success('Excel Report downloaded successfully!');
            onClose();
            
        } catch (error: any) {
            console.error('Export Error:', error);
            toast.error(error.message || 'Failed to export data');
        } finally {
            setIsExporting(false);
        }
    };

    const getTitle = () => {
        if (type === 'RENT_INFLOWS') return 'Export Rent Collection';
        if (type === 'PAYOUTS') return 'Export Payouts Data';
        if (type === 'REFUNDS') return 'Export Refunds Data';
        return 'Export Data';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-emerald-600 text-white shrink-0">
                    <div className="flex items-center gap-2.5">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-200" />
                        <h3 className="font-black text-sm tracking-wide">{getTitle()}</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">
                    <div className="space-y-4">
                        {/* Year Selection */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Year</label>
                            <div className="relative">
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                    className="w-full appearance-none bg-slate-50 border-2 border-slate-200 text-slate-800 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer"
                                >
                                    {availableYears.map(yr => (
                                        <option key={yr} value={yr}>{yr}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                                    <ChevronDown className="w-4 h-4" />
                                </div>
                            </div>
                        </div>

                        {/* Month Selection */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Month</label>
                            <div className="relative">
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="w-full appearance-none bg-slate-50 border-2 border-slate-200 text-slate-800 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer"
                                >
                                    {availableMonths.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                                    <ChevronDown className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Info text */}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                        <p className="text-xs text-emerald-800 leading-tight">
                            This report will be downloaded in Excel-compatible format. You can share this directly with your CA for accounting purposes.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        disabled={isExporting}
                        className="flex-1 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-sm rounded-xl transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                    >
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {isExporting ? 'Exporting...' : 'Download'}
                    </button>
                </div>
            </div>
        </div>
    );
}
