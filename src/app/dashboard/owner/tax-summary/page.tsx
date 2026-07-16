'use client';

import { useEffect, useState } from 'react';
import { getOwnerFinancialReport, getOwnerMonthlyTaxBreakdown } from '@/actions/ownerDashboard';
import { toast } from 'sonner';
import {
    Download, FileText, Loader2, IndianRupee, Shield,
    BadgeCheck, AlertTriangle, TrendingUp, Receipt, Building2,
    Eye, X, Info, CheckSquare, Square, CalendarDays, HelpCircle, Search
} from 'lucide-react';

// Build Financial Year options: FY 2025–26, FY 2026–27, FY 2027–28
// Indian FY: April 1st (IST) to March 31st (IST) = UTC offsets applied
function buildFYOptions() {
    const now = new Date();
    const thisYear = now.getFullYear();
    const fyStart = now.getMonth() >= 3 ? thisYear : thisYear - 1; // If Jan-Mar, FY started last year
    return [
        {
            label: `FY ${fyStart - 1}\u201326`,
            from: new Date(Date.UTC(fyStart - 1, 2, 31, 18, 30, 0, 0)),      // Apr 1 IST
            to:   new Date(Date.UTC(fyStart, 2, 31, 18, 29, 59, 999)),        // Mar 31 23:59 IST
        },
        {
            label: `FY ${fyStart}\u2013${String(fyStart + 1).slice(-2)}`,
            from: new Date(Date.UTC(fyStart, 2, 31, 18, 30, 0, 0)),
            to:   new Date(Date.UTC(fyStart + 1, 2, 31, 18, 29, 59, 999)),
        },
        {
            label: `FY ${fyStart + 1}\u2013${String(fyStart + 2).slice(-2)}`,
            from: new Date(Date.UTC(fyStart + 1, 2, 31, 18, 30, 0, 0)),
            to:   new Date(Date.UTC(fyStart + 2, 2, 31, 18, 29, 59, 999)),
        },
    ];
}

function getCurrentFY() {
    const now = new Date();
    const s = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `FY ${s}\u2013${String(s + 1).slice(-2)}`;
}

const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function Tip({ content }: { content: string }) {
    const [show, setShow] = useState(false);
    return (
        <span className="relative inline-flex items-center ml-1" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onClick={(e) => { e.stopPropagation(); setShow(!show); }}>
            <Info className={`w-3.5 h-3.5 cursor-pointer transition-colors ${show ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`} />
            {show && (
                <span className="absolute z-[9999] top-full mt-2 left-1/2 -translate-x-1/2 w-52 bg-slate-900 text-white text-[11px] font-normal rounded-xl px-3 py-2 shadow-2xl leading-relaxed whitespace-normal pointer-events-none text-center">
                    {content}
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900" />
                </span>
            )}
        </span>
    );
}

function KpiCard({ label, value, sub, icon: Icon, color = 'indigo' }: any) {
    const colors: Record<string, string> = {
        indigo: 'from-indigo-500 to-indigo-700',
        emerald: 'from-emerald-500 to-emerald-700',
        amber: 'from-amber-500 to-orange-600',
        violet: 'from-violet-500 to-purple-700',
        rose: 'from-rose-500 to-red-600',
    };
    return (
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-5 flex items-start gap-4 hover:shadow-lg transition-all duration-200">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center flex-shrink-0 shadow`}>
                <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
                <p className="text-2xl font-black text-slate-900 truncate">{value}</p>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-0.5">{label}</p>
                {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
            </div>
        </div>
    );
}

export default function TaxSummaryPage() {
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
    const [report, setReport] = useState<any>(null);
    const [monthly, setMonthly] = useState<any[]>([]);
    const [fyOptions] = useState(buildFYOptions);
    const [selectedFY, setSelectedFY] = useState(
        fyOptions.find(f => f.label === getCurrentFY()) || fyOptions[0]
    );

    // UX states
    const [previewMonth, setPreviewMonth] = useState<string | null>(null);
    const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
    const [bulkDownloading, setBulkDownloading] = useState(false);
    const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'monthly' | 'transactions' | 'onboarding'>('overview');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('tab') === 'onboarding') {
            setActiveTab('onboarding');
        }
    }, []);

    // Search and filters
    const [search, setSearch] = useState('');
    const [selectedProperty, setSelectedProperty] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [exportMonth, setExportMonth] = useState('ALL');
    const [exportFYLabel, setExportFYLabel] = useState(fyOptions[fyOptions.length - 1].label);
    const [globalMonth, setGlobalMonth] = useState<string>(String(new Date().getMonth()));

    const uniqueProperties = Array.from(new Set((report?.report || []).map((r: any) => r.property))).filter(Boolean).sort() as string[];

    const filteredRows = (report?.report || []).filter((r: any) => {
        const q = search.toLowerCase();
        if (q) {
            const match = (
                r.tenantName?.toLowerCase().includes(q) ||
                r.tenantId?.toLowerCase().includes(q) ||
                r.bookingId?.toLowerCase().includes(q) ||
                r.property?.toLowerCase().includes(q) ||
                r.razorpayTransferId?.toLowerCase().includes(q) ||
                r.roomType?.toLowerCase().includes(q)
            );
            if (!match) return false;
        }
        if (selectedProperty !== 'ALL' && r.property !== selectedProperty) return false;
        if (startDate) {
            const d = new Date(r.date);
            const s = new Date(startDate);
            s.setHours(0,0,0,0);
            if (d < s) return false;
        }
        if (endDate) {
            const d = new Date(r.date);
            const e = new Date(endDate);
            e.setHours(23,59,59,999);
            if (d > e) return false;
        }
        if (globalMonth !== 'ALL') {
            const m = parseInt(globalMonth);
            const year = m < 3 ? selectedFY.to.getFullYear() : selectedFY.from.getFullYear();
            const d = new Date(r.date);
            if (d.getMonth() !== m || d.getFullYear() !== year) return false;
        }
        return true;
    });

    // Get the most recent month within selectedFY for per-month download
    const currentDownloadMonth: string = (() => {
        const now = new Date();
        const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const toMonthStr = (d: Date | string) => {
            const dt = typeof d === 'string' ? new Date(d) : d;
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        };
        const fyFrom = toMonthStr(selectedFY.from);
        const fyTo   = toMonthStr(selectedFY.to);
        if (nowStr >= fyFrom && nowStr <= fyTo) return nowStr;
        return fyTo;
    })();

    const reload = (fy: typeof fyOptions[0]) => {
        setLoading(true);
        setSelectedMonths([]);
        setSearch('');
        setSelectedProperty('ALL');
        setStartDate('');
        setEndDate('');
        Promise.all([
            getOwnerFinancialReport(fy.from, fy.to),
            getOwnerMonthlyTaxBreakdown(fy.from, fy.to),
        ]).then(([r, m]) => {
            setReport(r);
            setMonthly(m);
            setLoading(false);
        }).catch((e: any) => {
            toast.error(e.message || 'Failed to load financial data');
            setLoading(false);
        });
    };

    useEffect(() => {
        reload(selectedFY);
    }, [selectedFY]);

    const getExportMonthString = () => {
        const activeFY = fyOptions.find((f: any) => f.label === exportFYLabel) || fyOptions[0];
        if (exportMonth === 'ALL') return null;
        const m = parseInt(exportMonth);
        const year = m < 3 ? activeFY.to.getFullYear() : activeFY.from.getFullYear();
        return `${year}-${String(m + 1).padStart(2, '0')}`;
    };

    const handleExportPDF = async (month?: string) => {
        if (!report) return;
        setExporting('pdf');
        try {
            const targetMonth = month || getExportMonthString() || currentDownloadMonth;
            const res = await fetch(`/api/receipts/owner/${targetMonth}?format=pdf`);
            if (!res.ok) throw new Error('Server error generating PDF');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RentPe-Owner-Statement-${targetMonth}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('PDF downloaded — includes individual GST Tax Invoices for your CA!');
        } catch (e) {
            console.error(e);
            toast.error('Failed to generate PDF');
        } finally {
            setExporting(null);
        }
    };

    const handleExportCSV = () => {
        if (!report) return;
        setExporting('csv');
        try {
            const activeFY = fyOptions.find((f: any) => f.label === exportFYLabel) || fyOptions[0];
            let rowsToExport = filteredRows;
            if (exportMonth !== 'ALL') {
                const m = parseInt(exportMonth);
                const year = m < 3 ? activeFY.to.getFullYear() : activeFY.from.getFullYear();
                rowsToExport = filteredRows.filter((r: any) => {
                    const d = new Date(r.date);
                    return d.getMonth() === m && d.getFullYear() === year;
                });
            }
            const s = report.summary;
            const headers = [
                'Booking ID', 'Tenant ID', 'Internal Booking ID',
                'Bank UTR / Ref', 'Razorpay Order ID', 'Razorpay Payment ID',
                'Tenant Name', 'Property', 'Room Type', 'Payment Method',
                'Gross Amount', 'Rent Amount (Taxable)', 'Security Deposit (Non-Taxable)',
                'Platform Commission', 'GST Charged (18%)',
                'TDS Deducted (1%)', 'Owner Net Payout',
                'Refund Amount', 'Net Revenue',
                'Status', 'Date'
            ];
            const rows = rowsToExport.map((r: any) => [
                r.bookingId, r.tenantId, r.internalBookingId,
                r.razorpayTransferId, r.razorpayOrderId, r.razorpayPaymentId,
                r.tenantName, r.property, r.roomType, r.paymentMethod,
                r.amount, r.rentAmount, r.depositAmount,
                r.platformFeeCharged, r.gstCharged,
                s.tdsExempt ? 0 : r.tdsDeducted, r.ownerNetPayout,
                r.refundAmount, r.netRevenue,
                r.status, new Date(r.date).toLocaleString('en-IN'),
            ]);
            const csvContent = [headers, ...rows]
                .map(row => row.map((c: any) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
                .join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const monthName = exportMonth === 'ALL' ? 'FullYear' : new Date(0, parseInt(exportMonth)).toLocaleString('default', { month: 'short' });
            a.download = `RentPe-TaxLedger-${activeFY.label.replace(/\s/g, '-')}-${monthName}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('CSV exported with all IDs and tax columns!');
        } catch {
            toast.error('Failed to export CSV');
        } finally {
            setExporting(null);
        }
    };

    const handleBulkDownloadZIP = async () => {
        if (selectedMonths.length === 0) return;
        setBulkDownloading(true);
        try {
            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();

            await Promise.all(selectedMonths.map(async (m) => {
                const res = await fetch(`/api/receipts/owner/${m}?format=pdf`);
                if (res.ok) {
                    const arrayBuffer = await res.arrayBuffer();
                    zip.file(`RentPe-Owner-Statement-${m}.pdf`, arrayBuffer);
                }
            }));

            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RentPe-TaxInvoices-Bulk-${selectedFY.label.replace(/\s/g, '-')}.zip`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('ZIP Archive containing all selected invoices compiled and downloaded!');
        } catch (e) {
            console.error(e);
            toast.error('Failed to create ZIP package');
        } finally {
            setBulkDownloading(false);
            setSelectedMonths([]);
        }
    };

    const toggleSelectAll = () => {
        if (selectedMonths.length === monthly.length) {
            setSelectedMonths([]);
        } else {
            setSelectedMonths(monthly.map(m => String(m.key)));
        }
    };

    const toggleSelectMonth = (mKey: string) => {
        setSelectedMonths(prev =>
            prev.includes(mKey) ? prev.filter(k => k !== mKey) : [...prev, mKey]
        );
    };

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-9 h-9 text-indigo-600 animate-spin" />
            <p className="text-slate-500 font-medium text-sm">Loading your tax summary...</p>
        </div>
    );

    const s = (() => {
        if (!report) return null;
        if (globalMonth === 'ALL') return report.summary;
        
        const filteredForSummary = (report.report || []).filter((r: any) => {
            const m = parseInt(globalMonth);
            const year = m < 3 ? selectedFY.to.getFullYear() : selectedFY.from.getFullYear();
            const d = new Date(r.date);
            return d.getMonth() === m && d.getFullYear() === year;
        });

        const totalGross = filteredForSummary.reduce((acc: number, r: any) => acc + (r.amount || 0), 0);
        const totalPlatformFeeCharged = filteredForSummary.reduce((acc: number, r: any) => acc + (r.platformFeeCharged || 0), 0);
        const totalGstCharged = filteredForSummary.reduce((acc: number, r: any) => acc + (r.gstCharged || 0), 0);
        const totalTdsDeducted = filteredForSummary.reduce((acc: number, r: any) => acc + (r.tdsDeducted || 0), 0);
        const totalOwnerNetPayout = filteredForSummary.reduce((acc: number, r: any) => acc + (r.ownerNetPayout || 0), 0);
        const totalRefunds = filteredForSummary.reduce((acc: number, r: any) => acc + (r.refundAmount || 0), 0);

        return {
            ...report.summary,
            totalGross,
            totalPlatformFeeCharged,
            totalGstCharged,
            totalTdsDeducted,
            totalOwnerNetPayout,
            confirmedBookings: filteredForSummary.length,
            totalRefunds
        };
    })();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/20 pb-20">
            {/* Premium Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 px-6 pt-10 pb-24 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #a78bfa 0%, transparent 60%)' }} />
                <div className="w-full px-4 relative z-10">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Receipt className="w-5 h-5 text-indigo-200" />
                                <span className="text-indigo-200 text-xs font-bold uppercase tracking-widest">Financial Statement</span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Tax Summary & Payout Ledger</h1>
                            <p className="text-indigo-100 text-sm font-medium mt-2">Your complete financial picture — GST, TDS, and net payouts</p>
                        </div>
                        {/* FY & Month Selector */}
                        <div className="flex items-center gap-3 flex-wrap mt-2 sm:mt-0">
                            {/* SELECT YEAR */}
                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-indigo-200 mb-1">Select Year</label>
                                <select
                                    value={selectedFY.label}
                                    onChange={(e) => {
                                        const fy = fyOptions.find(f => f.label === e.target.value);
                                        if (fy) setSelectedFY(fy);
                                    }}
                                    className="text-sm font-black rounded-full px-5 py-2.5 bg-white/90 hover:bg-white text-indigo-900 focus:outline-none focus:ring-4 focus:ring-white/20 cursor-pointer min-w-[120px] shadow-lg transition-all border-0 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23312E81%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_16px_center] bg-[length:10px_auto] pr-10"
                                >
                                    {fyOptions.map((fy: any) => (
                                        <option key={fy.label} value={fy.label}>{fy.label}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {/* SELECT MONTH */}
                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-indigo-200 mb-1">Select Month</label>
                                <select
                                    value={globalMonth}
                                    onChange={(e) => setGlobalMonth(e.target.value)}
                                    className="text-sm font-black rounded-full px-5 py-2.5 bg-white/90 hover:bg-white text-indigo-900 focus:outline-none focus:ring-4 focus:ring-white/20 cursor-pointer min-w-[140px] shadow-lg transition-all border-0 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23312E81%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_16px_center] bg-[length:10px_auto] pr-10"
                                >
                                    <option value="ALL">All Months (Full FY)</option>
                                    <option value="3">April</option>
                                    <option value="4">May</option>
                                    <option value="5">June</option>
                                    <option value="6">July</option>
                                    <option value="7">August</option>
                                    <option value="8">September</option>
                                    <option value="9">October</option>
                                    <option value="10">November</option>
                                    <option value="11">December</option>
                                    <option value="0">January</option>
                                    <option value="1">February</option>
                                    <option value="2">March</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="w-full h-px bg-white/20 my-6" />

                    {/* Tab Navigation */}
                    <div className="flex gap-1.5 bg-white/10 rounded-2xl p-1 w-fit flex-wrap">
                        {[
                            { id: 'overview', label: 'Financial Overview', icon: TrendingUp },
                            { id: 'monthly', label: 'Monthly Statements', icon: Receipt },
                            { id: 'transactions', label: 'Payout Ledger', icon: Search },
                            { id: 'onboarding', label: 'Onboarding Fees', icon: Building2 },
                        ].map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-white text-indigo-700 shadow-lg'
                                            : 'text-indigo-100 hover:text-white hover:bg-white/10'
                                    }`}>
                                    <Icon className="w-4 h-4" />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="w-full px-4 md:px-8 -mt-14 relative z-10 space-y-6">

                {/* TDS Exemption Banner */}
                {s?.tdsExempt ? (
                    <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 flex items-start gap-4">
                        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow">
                            <BadgeCheck className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <p className="font-black text-emerald-800 text-base">TDS Exempt — No deduction on your payouts</p>
                            <p className="text-sm text-emerald-600 mt-0.5">
                                {s.tdsExemptionReason || 'Your account has an active TDS exemption certificate registered with RentPe.'}
                            </p>
                            {s.tdsCertificateUrl && (
                                <a href={s.tdsCertificateUrl} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-emerald-700 hover:text-emerald-900 underline">
                                    <FileText className="w-3.5 h-3.5" /> View Certificate
                                </a>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-amber-800 text-sm">Standard TDS Applies — 1% deducted under Section 194-O</p>
                            <p className="text-xs text-amber-600 mt-0.5">
                                RentPe deducts 1% TDS on your gross rent as required for e-commerce aggregators. Contact your admin if you have a nil/lower TDS certificate.
                            </p>
                        </div>
                    </div>
                )}


                {/* ── Tab 1: Financial Overview ── */}
                {activeTab === 'overview' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* KPI Cards */}
                        {s && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <KpiCard label="Total Gross Rent" value={fmtShort(s.totalGross)} icon={IndianRupee} color="indigo" sub={`${s.confirmedBookings} paid bookings`} />
                                <KpiCard label="Platform Commission" value={fmtShort(s.totalPlatformFeeCharged)} icon={Building2} color="amber" sub="Platform commission charged" />
                                <KpiCard label="GST Charged (18%)" value={fmtShort(s.totalGstCharged)} icon={Receipt} color="violet" sub="On platform commission only" />
                                <KpiCard label="TDS Deducted (1%)" value={s.tdsExempt ? '₹0 (Exempt)' : fmtShort(s.totalTdsDeducted)} icon={Shield} color={s.tdsExempt ? 'emerald' : 'rose'} sub="Sec 194-O" />
                                <KpiCard label="Your Net Payout" value={fmtShort(s.totalOwnerNetPayout)} icon={TrendingUp} color="emerald" sub="After fees + TDS" />
                                <KpiCard label="Total Refunds" value={fmtShort(s.totalRefunds)} icon={Download} color="rose" sub="Processed refunds" />
                                {s.totalOnboardingPaid > 0 && (
                                    <KpiCard label="Property Onboarding Paid" value={fmtShort(s.totalOnboardingPaid)} icon={Building2} color="indigo" sub={`Incl. ${fmtShort(s.totalOnboardingGst)} GST ITC`} />
                                )}
                            </div>
                        )}


                    </div>
                )}

                {/* ── Tab 2: Monthly Statements ── */}
                {activeTab === 'monthly' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Summary Banner */}
                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-700 font-medium">
                            🧾 Download detailed monthly statements and individual GST invoices here for claiming Input Tax Credits (ITC).
                        </div>

                        {/* Monthly Tax Breakdown Table */}
                        {monthly.length > 0 && (
                            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-black text-slate-900 text-lg">Monthly Tax Breakdown</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Month-by-month view of gross rent, platform commission, GST, TDS, and your net payout</p>
                                    </div>
                                    <button
                                        onClick={toggleSelectAll}
                                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-1.5"
                                    >
                                        {selectedMonths.length === monthly.length ? (
                                            <>
                                                <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                                                <span>Deselect All</span>
                                            </>
                                        ) : (
                                            <>
                                                <Square className="w-3.5 h-3.5 text-slate-400" />
                                                <span>Select All ({monthly.length})</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="px-4 py-3 text-left w-12"></th>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Month <Tip content="Billing month for rent collection" /></th>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Transactions <Tip content="Number of completed bookings processed this month" /></th>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Gross Rent <Tip content="Total money collected from students before any platform commission or TDS" /></th>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Platform Commission <Tip content="RentPe platform fee commission (expense for owner)" /></th>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">GST (18%) <Tip content="18% GST charged on the platform commission (claimable as Input Tax Credit)" /></th>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">TDS (1%) <Tip content="1% TDS deducted under Section 194-O (sent to Income Tax Dept on your behalf)" /></th>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Your Net Payout <Tip content="Actual money sent to your bank account after platform commission, GST, and TDS" /></th>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Action <Tip content="Statements and invoice preview options" /></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {monthly.map((m: any) => {
                                                const isSelected = selectedMonths.includes(String(m.key));
                                                return (
                                                    <tr key={m.key} className={`transition-colors duration-150 ${isSelected ? 'bg-indigo-50/20' : 'hover:bg-slate-50/50'}`}>
                                                        <td className="px-4 py-3">
                                                            <button onClick={() => toggleSelectMonth(String(m.key))} className="text-slate-400 hover:text-indigo-600 transition-colors">
                                                                {isSelected ? (
                                                                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                                                                ) : (
                                                                    <Square className="w-4 h-4" />
                                                                )}
                                                            </button>
                                                        </td>
                                                        <td className="px-4 py-3 font-bold text-slate-800">{m.month}</td>
                                                        <td className="px-4 py-3 text-slate-500">{m.transactions}</td>
                                                        <td className="px-4 py-3 font-black text-slate-900">{fmtShort(m.grossRent)}</td>
                                                        <td className="px-4 py-3 font-bold text-amber-600">{fmtShort(m.platformFee)}</td>
                                                        <td className="px-4 py-3 font-bold text-violet-600">{fmtShort(m.gst)}</td>
                                                        <td className="px-4 py-3 font-bold text-rose-600">
                                                            {s?.tdsExempt ? <span className="text-emerald-600">₹0 ✓</span> : fmtShort(m.tds)}
                                                        </td>
                                                        <td className="px-4 py-3 font-black text-emerald-600">{fmtShort(m.netPayout)}</td>
                                                        <td className="px-4 py-3 flex gap-2">
                                                            <button
                                                                onClick={() => setPreviewMonth(String(m.key))}
                                                                className="px-2.5 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                                <span>Preview</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleExportPDF(String(m.key))}
                                                                disabled={exporting !== null}
                                                                className="px-2.5 py-1 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-100 transition-colors flex items-center gap-1 disabled:opacity-50"
                                                            >
                                                                <Download className="w-3.5 h-3.5" />
                                                                <span>PDF</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-slate-900 text-white font-black text-sm">
                                                <td></td>
                                                <td className="px-4 py-3">TOTAL</td>
                                                <td className="px-4 py-3">{monthly.reduce((s, m) => s + m.transactions, 0)}</td>
                                                <td className="px-4 py-3">{fmtShort(monthly.reduce((s, m) => s + m.grossRent, 0))}</td>
                                                <td className="px-4 py-3">{fmtShort(monthly.reduce((s, m) => s + m.platformFee, 0))}</td>
                                                <td className="px-4 py-3">{fmtShort(monthly.reduce((s, m) => s + m.gst, 0))}</td>
                                                <td className="px-4 py-3">{s?.tdsExempt ? '₹0 ✓' : fmtShort(monthly.reduce((s, m) => s + m.tds, 0))}</td>
                                                <td className="px-4 py-3">{fmtShort(monthly.reduce((s, m) => s + m.netPayout, 0))}</td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Export Section */}
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                                <div>
                                    <h3 className="font-black text-slate-900 text-lg mb-1">Export for Your CA / Accountant</h3>
                                    <p className="text-sm text-slate-500 mb-1">
                                        Downloads include: Booking IDs, Razorpay IDs, GST breakdown (CGST+SGST), TDS deducted (Sec 194-O), and net payout.
                                    </p>
                                    <p className="text-xs text-indigo-600 font-bold flex items-center gap-1.5">
                                        <Info className="w-4 h-4 flex-shrink-0" />
                                        <span>📋 PDFs include individual GST Tax Invoices (RP/FY26-27/000001...) per transaction — perfect for claiming Input Tax Credit.</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        className="h-10 rounded-xl border border-indigo-200 bg-indigo-50/50 px-4 text-sm font-black text-indigo-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm hover:bg-indigo-50 transition-colors"
                                        value={exportFYLabel}
                                        onChange={(e) => setExportFYLabel(e.target.value)}
                                    >
                                        {fyOptions.map((fy: any) => (
                                            <option key={fy.label} value={fy.label}>{fy.label}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="h-10 rounded-xl border border-indigo-200 bg-indigo-50/50 px-4 text-sm font-black text-indigo-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[160px] shadow-sm hover:bg-indigo-50 transition-colors"
                                        value={exportMonth}
                                        onChange={(e) => setExportMonth(e.target.value)}
                                    >
                                        <option value="ALL">All Months (Full FY)</option>
                                        <option value="3">April</option>
                                        <option value="4">May</option>
                                        <option value="5">June</option>
                                        <option value="6">July</option>
                                        <option value="7">August</option>
                                        <option value="8">September</option>
                                        <option value="9">October</option>
                                        <option value="10">November</option>
                                        <option value="11">December</option>
                                        <option value="0">January</option>
                                        <option value="1">February</option>
                                        <option value="2">March</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <button onClick={() => handleExportPDF(getExportMonthString() || currentDownloadMonth)} disabled={exporting !== null || exportMonth === 'ALL'}
                                        className="w-full flex items-center gap-4 p-5 bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl hover:from-indigo-100 hover:to-violet-100 transition-all disabled:opacity-50 text-left">
                                        {exporting === 'pdf'
                                            ? <Loader2 className="w-10 h-10 text-indigo-500 animate-spin flex-shrink-0" />
                                            : <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5 text-white" /></div>
                                        }
                                        <div>
                                            <p className="font-black text-slate-900">📄 Download Monthly PDF</p>
                                            <p className="text-xs text-slate-500 mt-0.5">Page 1: Summary · Page 2+: Individual GST Tax Invoices</p>
                                            <p className="text-[10px] text-indigo-500 font-bold mt-0.5">
                                                {exportMonth === 'ALL' ? 'Select a specific month to download PDF' : `Month: ${getExportMonthString() || currentDownloadMonth}`}
                                            </p>
                                        </div>
                                    </button>
                                </div>

                                <button onClick={handleExportCSV} disabled={exporting !== null}
                                    className="flex items-center gap-4 p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl hover:from-emerald-100 hover:to-teal-100 transition-all disabled:opacity-50 text-left">
                                    {exporting === 'csv'
                                        ? <Loader2 className="w-10 h-10 text-emerald-500 animate-spin flex-shrink-0" />
                                        : <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center flex-shrink-0"><Download className="w-5 h-5 text-white" /></div>
                                    }
                                    <div>
                                        <p className="font-black text-slate-900">📊 Download CSV</p>
                                        <p className="text-xs text-slate-500 mt-0.5">All 18 columns — Razorpay IDs, GST, TDS, Net Payout per transaction</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Tab 3: Payout Ledger ── */}
                {activeTab === 'transactions' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Summary Banner */}
                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-700 font-medium">
                            🔎 A detailed transaction log showing exactly when payments were processed, who paid (including Tenant IDs), and Razorpay references.
                        </div>

                        {/* Transaction Preview Table */}
                        {report?.report?.length > 0 && (
                            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                                <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4">
                                    <div>
                                        <h3 className="font-black text-slate-900 text-lg">Transaction Preview</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Showing {filteredRows.slice(0, 25).length} of {filteredRows.length} records • Use CSV/PDF to download full audit trail</p>
                                    </div>
                                </div>

                                {/* Search and Filters Bar */}
                                <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3 flex-wrap">
                                    <div className="relative flex-1 min-w-[200px]">
                                        <input
                                            className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-4 pr-10 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                            placeholder="Search by Tenant Name, Tenant ID, Booking ID..."
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                        />
                                    </div>

                                    {/* Property Dropdown Filter */}
                                    <select
                                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                        value={selectedProperty}
                                        onChange={e => setSelectedProperty(e.target.value)}
                                    >
                                        <option value="ALL">All Properties</option>
                                        {uniqueProperties.map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>

                                    {/* Date Range Filters */}
                                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2 h-10">
                                        <input
                                            type="date"
                                            className="bg-transparent text-xs text-slate-600 focus:outline-none cursor-pointer font-bold"
                                            value={startDate}
                                            onChange={e => setStartDate(e.target.value)}
                                        />
                                        <span className="text-[10px] text-slate-400 font-bold">to</span>
                                        <input
                                            type="date"
                                            className="bg-transparent text-xs text-slate-600 focus:outline-none cursor-pointer font-bold"
                                            value={endDate}
                                            onChange={e => setEndDate(e.target.value)}
                                        />
                                        {(startDate || endDate) && (
                                            <button 
                                                onClick={() => { setStartDate(''); setEndDate(''); }}
                                                className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold px-1.5 py-0.5 rounded ml-1"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-slate-800 text-white">
                                                <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest whitespace-nowrap">Date <Tip content="Date the transaction was processed" /></th>
                                                <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest whitespace-nowrap">Booking ID <Tip content="RentPe's unique reference ID for the booking" /></th>
                                                <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest whitespace-nowrap">Tenant ID <Tip content="Student's permanent tenant ID on the platform" /></th>
                                                <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest whitespace-nowrap">Bank UTR / Ref <Tip content="Bank transfer reference number for reconciliation" /></th>
                                                <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest whitespace-nowrap">Tenant Name <Tip content="Full name of the student who paid" /></th>
                                                <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest whitespace-nowrap">Property <Tip content="Name of the building where the room is allocated" /></th>
                                                <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest whitespace-nowrap">Rent (Taxable) <Tip content="Rent amount paid before platform deductions" /></th>
                                                <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest whitespace-nowrap">Deposit <Tip content="Security deposit (Non-taxable)" /></th>
                                                <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest whitespace-nowrap">Platform Commission <Tip content="RentPe platform commission charged on this transaction" /></th>
                                                <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest whitespace-nowrap">GST <Tip content="18% GST on the platform commission" /></th>
                                                <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest whitespace-nowrap">TDS <Tip content="1% TDS withheld under Section 194-O" /></th>
                                                <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest whitespace-nowrap">Net Payout <Tip content="Final payout amount sent to your bank account" /></th>
                                                <th className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest whitespace-nowrap">Status <Tip content="Current status of the transaction (e.g. CONFIRMED, PAID, etc.)" /></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {filteredRows.slice(0, 25).map((r: any, i: number) => (
                                                <tr key={i} className="hover:bg-indigo-50/20 transition-colors">
                                                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                                                    <td className="px-3 py-2.5 font-mono text-indigo-600 font-bold">{r.bookingId}</td>
                                                    <td className="px-3 py-2.5 font-mono text-indigo-600 font-bold">{r.tenantId}</td>
                                                    <td className="px-3 py-2.5 font-mono text-slate-400 max-w-[110px] truncate">{r.razorpayTransferId}</td>

                                                    <td className="px-3 py-2.5 font-bold text-slate-700">
                                                        {r.tenantName}
                                                        {r.type === 'PROPERTY_ONBOARDING' && (
                                                            <span className="ml-1.5 bg-blue-100 text-blue-700 text-[8px] px-1 py-0.5 rounded font-black uppercase">B2B Exp</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-slate-600 max-w-[120px] truncate">{r.property}</td>
                                                    <td className="px-3 py-2.5 font-black text-slate-900">{fmtShort(r.rentAmount || 0)}</td>
                                                    <td className="px-3 py-2.5 font-black text-slate-500">{fmtShort(r.depositAmount || 0)}</td>
                                                    <td className="px-3 py-2.5 font-bold text-amber-600">{fmtShort(r.platformFeeCharged)}</td>
                                                    <td className="px-3 py-2.5 font-bold text-violet-600">{fmtShort(r.gstCharged)}</td>
                                                    <td className="px-3 py-2.5 font-bold text-rose-600">
                                                        {s?.tdsExempt ? <span className="text-emerald-600">₹0</span> : fmtShort(r.tdsDeducted)}
                                                    </td>
                                                    <td className={`px-3 py-2.5 font-black ${r.ownerNetPayout < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmtShort(r.ownerNetPayout)}</td>
                                                    <td className="px-3 py-2.5">
                                                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                            r.type === 'PROPERTY_ONBOARDING'
                                                                ? 'bg-blue-100 text-blue-700'
                                                                : ['BOOKING_CONFIRMED', 'CHECKED_IN', 'PAID', 'CASH_PAID'].includes(r.status)
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : r.status === 'CANCELLED'
                                                                ? 'bg-rose-100 text-rose-700'
                                                                : 'bg-slate-100 text-slate-500'
                                                        }`}>{r.type === 'PROPERTY_ONBOARDING' ? 'PAID' : r.status}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {filteredRows.length > 25 && (
                                        <p className="text-center text-xs text-slate-400 py-3 font-bold border-t border-slate-50">
                                            Showing 25 of {filteredRows.length} records. Download CSV/PDF to see all.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Tab 4: Onboarding Fees ── */}
                {activeTab === 'onboarding' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-700 font-medium flex items-center gap-2">
                            <Building2 className="w-5 h-5 flex-shrink-0" />
                            <span>One-time property setup fees and GST invoices. This is a B2B expense and you can claim the 18% GST as Input Tax Credit (ITC).</span>
                        </div>
                        
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h3 className="font-black text-slate-900 text-lg">Property Onboarding History</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Track all properties you have onboarded onto RentPe</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Property</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Base Fee</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">CGST (9%)</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">SGST (9%)</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Total Paid</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredRows.filter((r: any) => r.type === 'PROPERTY_ONBOARDING').map((r: any, i: number) => {
                                            const feeAmount = Math.abs(r.ownerNetPayout || 99);
                                            const gst = r.gstCharged || 15.10;
                                            const base = feeAmount - gst;
                                            return (
                                                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-4 py-3 font-medium text-slate-700">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                                                    <td className="px-4 py-3 font-bold text-slate-900">{r.property}</td>
                                                    <td className="px-4 py-3 font-bold text-slate-600">{fmtShort(base)}</td>
                                                    <td className="px-4 py-3 font-bold text-violet-600">{fmtShort(gst / 2)}</td>
                                                    <td className="px-4 py-3 font-bold text-violet-600">{fmtShort(gst / 2)}</td>
                                                    <td className="px-4 py-3 font-black text-rose-600">{fmtShort(feeAmount)}</td>
                                                </tr>
                                            );
                                        })}
                                        {filteredRows.filter((r: any) => r.type === 'PROPERTY_ONBOARDING').length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm font-bold">No onboarding fees found for this period.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── In-Browser PDF Preview Modal ────────────────────────────────────── */}
            {previewMonth && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-base">📄 Statement Preview</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Month: {previewMonth} · Includes summary & GST Tax Invoices</p>
                            </div>
                            <button
                                onClick={() => setPreviewMonth(null)}
                                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex-1 bg-slate-100 overflow-y-auto p-4 flex justify-center">
                            <iframe
                                src={`/api/receipts/owner/${previewMonth}?format=pdf#toolbar=0`}
                                className="w-full h-[65vh] rounded-xl border border-slate-200 bg-white"
                                title="Statement PDF Preview"
                            />
                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => setPreviewMonth(null)}
                                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl text-sm transition-colors"
                            >
                                Close Preview
                            </button>
                            <button
                                onClick={() => {
                                    handleExportPDF(previewMonth);
                                    setPreviewMonth(null);
                                }}
                                className="px-4 py-2 bg-indigo-600 text-white font-bold hover:bg-indigo-700 rounded-xl text-sm transition-colors flex items-center gap-1.5 shadow-md"
                            >
                                <Download className="w-4 h-4" />
                                <span>Download PDF</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Checkbox Bulk Export Floating Bar ─────────────────────────────────── */}
            {selectedMonths.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur border border-slate-800 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom duration-300">
                    <div>
                        <p className="text-white font-black text-sm">{selectedMonths.length} statement{selectedMonths.length > 1 ? 's' : ''} selected</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Ready to compile as ZIP</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSelectedMonths([])}
                            className="px-3 py-2 text-slate-400 font-bold hover:text-white text-xs transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleBulkDownloadZIP}
                            disabled={bulkDownloading}
                            className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-black text-xs hover:from-indigo-600 hover:to-violet-700 rounded-xl shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {bulkDownloading ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Packing ZIP...</span>
                                </>
                            ) : (
                                <>
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download ZIP</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
