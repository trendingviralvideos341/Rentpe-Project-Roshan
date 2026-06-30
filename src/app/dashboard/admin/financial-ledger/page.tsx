'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAdminFinancialLedger, getAdminTaxLiability, getAdminPropertyUnitEconomics } from '@/actions/platform';
import { toast } from 'sonner';
import {
    Download, FileText, Loader2, IndianRupee, TrendingUp, Shield,
    Building2, RefreshCcw, Search, Filter, Receipt,
    BadgeCheck, BarChart3, Users, Info
} from 'lucide-react';

// ── Tooltip Component ────────────────────────────────────────────────────────
function Tip({ text }: { text: string }) {
    const [show, setShow] = useState(false);
    return (
        <span className="relative inline-flex items-center ml-1" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onClick={(e) => { e.stopPropagation(); setShow(!show); }}>
            <Info className={`w-3 h-3 cursor-pointer transition-colors ${show ? 'text-indigo-500' : 'text-slate-400 hover:text-indigo-400'}`} />
            {show && (
                <span className="absolute z-[9999] top-full mt-2 left-1/2 -translate-x-1/2 w-52 bg-slate-900 text-white text-[11px] font-normal rounded-xl px-3 py-2 shadow-2xl leading-relaxed whitespace-normal pointer-events-none">
                    {text}
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900" />
                </span>
            )}
        </span>
    );
}

// ── Tab Summary Banner ───────────────────────────────────────────────────────
function TabSummary({ icon, color, title, desc }: { icon: string; color: string; title: string; desc: string }) {
    const colors: Record<string, string> = {
        indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
        amber: 'bg-amber-50 border-amber-200 text-amber-800',
        violet: 'bg-violet-50 border-violet-200 text-violet-800',
        emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    };
    return (
        <div className={`flex items-start gap-3 border rounded-2xl px-5 py-4 ${colors[color]}`}>
            <span className="text-2xl flex-shrink-0">{icon}</span>
            <div>
                <p className="font-black text-sm">{title}</p>
                <p className="text-xs font-medium opacity-80 mt-0.5 leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}

const TABS = [
    { id: 'overview', label: 'Revenue Overview', icon: TrendingUp },
    { id: 'ledger', label: 'Transaction Ledger', icon: Receipt },
    { id: 'tax', label: 'Tax Liability', icon: Shield },
    { id: 'unit', label: 'Unit Economics', icon: BarChart3 },
];

function buildFYOptions() {
    const y = new Date().getFullYear();
    return [
        { label: `FY ${y - 1}-${y}`, from: new Date(`${y - 1}-04-01`), to: new Date(`${y}-03-31`) },
        { label: `FY ${y}-${y + 1}`, from: new Date(`${y}-04-01`), to: new Date(`${y + 1}-03-31`) },
    ];
}

const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function StatCard({ label, value, sub, color = 'indigo', icon: Icon }: any) {
    const colors: Record<string, string> = {
        indigo: 'from-indigo-600 to-indigo-700',
        emerald: 'from-emerald-500 to-emerald-700',
        amber: 'from-amber-500 to-orange-600',
        rose: 'from-rose-500 to-red-700',
        violet: 'from-violet-500 to-purple-700',
        cyan: 'from-cyan-500 to-cyan-700',
    };
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-5 flex items-start gap-4 hover:shadow-xl transition-all duration-200">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center flex-shrink-0 shadow-md`}>
                <Icon className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
                <p className="text-2xl font-black text-slate-900 truncate">{value}</p>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-0.5">{label}</p>
                {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
            </div>
        </div>
    );
}

function TaxBadge({ label, value, color }: { label: string; value: string; color: string }) {
    const colors: Record<string, string> = {
        blue: 'bg-blue-50 border-blue-200 text-blue-700',
        green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        orange: 'bg-amber-50 border-amber-200 text-amber-700',
        red: 'bg-rose-50 border-rose-200 text-rose-700',
    };
    return (
        <div className={`border rounded-xl p-3 text-center ${colors[color]}`}>
            <p className="text-lg font-black">{value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5 opacity-70">{label}</p>
        </div>
    );
}

export default function AdminFinancialLedgerPage() {
    const [activeTab, setActiveTab] = useState('overview');
    const [fyOptions] = useState(buildFYOptions);
    const [selectedFY, setSelectedFY] = useState(fyOptions[fyOptions.length - 1]);
    const [ledger, setLedger] = useState<any>(null);
    const [taxData, setTaxData] = useState<any>(null);
    const [unitData, setUnitData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
    const [typeFilter, setTypeFilter] = useState('ALL');

    const fetchAll = useCallback(async (fy: typeof fyOptions[0]) => {
        setLoading(true);
        try {
            const [l, t, u] = await Promise.all([
                getAdminFinancialLedger(fy.from, fy.to, 100),
                getAdminTaxLiability(fy.from, fy.to),
                getAdminPropertyUnitEconomics(fy.from, fy.to),
            ]);
            setLedger(l);
            setTaxData(t);
            setUnitData(u);
        } catch (e: any) {
            toast.error('Failed to load ledger: ' + e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(selectedFY); }, [selectedFY, fetchAll]);

    const filteredRows = (ledger?.rows || []).filter((r: any) => {
        const q = search.toLowerCase();
        if (!q) return true;
        return (
            r.studentName?.toLowerCase().includes(q) ||
            r.studentEmail?.toLowerCase().includes(q) ||
            r.propertyName?.toLowerCase().includes(q) ||
            r.ownerName?.toLowerCase().includes(q) ||
            r.rentpeBookingId?.toLowerCase().includes(q) ||
            r.razorpayOrderId?.toLowerCase().includes(q) ||
            r.razorpayPaymentId?.toLowerCase().includes(q) ||
            r.razorpayTransferId?.toLowerCase().includes(q)
        );
    });

    const handleExportCSV = async () => {
        setExporting('csv');
        try {
            toast.loading('Fetching full ledger for export...', { id: 'export-csv' });
            const fullLedger = await getAdminFinancialLedger(selectedFY.from, selectedFY.to);
            const rowsToExport = (fullLedger?.rows || []).filter((r: any) => {
                const q = search.toLowerCase();
                if (!q) return true;
                return (
                    r.studentName?.toLowerCase().includes(q) ||
                    r.studentEmail?.toLowerCase().includes(q) ||
                    r.propertyName?.toLowerCase().includes(q) ||
                    r.ownerName?.toLowerCase().includes(q) ||
                    r.rentpeBookingId?.toLowerCase().includes(q) ||
                    r.razorpayOrderId?.toLowerCase().includes(q) ||
                    r.razorpayPaymentId?.toLowerCase().includes(q) ||
                    r.razorpayTransferId?.toLowerCase().includes(q)
                );
            });

            if (!rowsToExport.length) {
                toast.error('No transactions to export', { id: 'export-csv' });
                return;
            }

            const headers = [
                'RentPe Payment ID', 'RentPe Booking ID',
                'Razorpay Order ID', 'Razorpay Payment ID', 'Razorpay Transfer ID',
                'Student Name', 'Student Email', 'Student ID',
                'Property Name', 'City', 'Room Type',
                'Owner Name', 'Owner ID', 'Owner Email',
                'Gross Amount', 'Convenience Fee (Student)', 'Platform Commission (Owner)',
                'GST on Student Fee', 'GST on Owner Fee', 'CGST', 'SGST',
                'TDS Deducted', 'Owner Net Payout', 'Total Charged',
                'Platform Earned', 'SAC Code', 'Payment Method', 'Status', 'Date'
            ];
            const rows = rowsToExport.map((r: any) => [
                r.rentpePaymentId, r.rentpeBookingId,
                r.razorpayOrderId, r.razorpayPaymentId, r.razorpayTransferId,
                r.studentName, r.studentEmail, r.studentId,
                r.propertyName, r.propertyCity, r.roomType,
                r.ownerName, r.ownerId, r.ownerEmail,
                r.grossAmount, r.platformFeeStudent, r.platformFeeOwner,
                r.gstOnStudentFee, r.gstOnOwnerFee, r.cgst, r.sgst,
                r.tdsDeducted, r.ownerNetPayout, r.totalCharged,
                r.platformEarned, r.sacCode, r.paymentMethod, r.status,
                new Date(r.date).toLocaleString('en-IN')
            ]);
            const csv = [headers, ...rows].map(row =>
                row.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(',')
            ).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RentPe-FinancialLedger-${selectedFY.label.replace(/\s/g, '-')}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('CSV exported with all transaction details!', { id: 'export-csv' });
        } catch { 
            toast.error('Export failed', { id: 'export-csv' }); 
        } finally { 
            setExporting(null); 
        }
    };

    const handleExportPDF = async () => {
        setExporting('pdf');
        try {
            toast.loading('Fetching full ledger for PDF export...', { id: 'export-pdf' });
            const fullLedger = await getAdminFinancialLedger(selectedFY.from, selectedFY.to);
            const rowsToExport = (fullLedger?.rows || []).filter((r: any) => {
                const q = search.toLowerCase();
                if (!q) return true;
                return (
                    r.studentName?.toLowerCase().includes(q) ||
                    r.studentEmail?.toLowerCase().includes(q) ||
                    r.propertyName?.toLowerCase().includes(q) ||
                    r.ownerName?.toLowerCase().includes(q) ||
                    r.rentpeBookingId?.toLowerCase().includes(q) ||
                    r.razorpayOrderId?.toLowerCase().includes(q) ||
                    r.razorpayPaymentId?.toLowerCase().includes(q) ||
                    r.razorpayTransferId?.toLowerCase().includes(q)
                );
            });

            const { jsPDF } = await import('jspdf');
            const autoTable = (await import('jspdf-autotable')).default;
            const doc = new jsPDF({ orientation: 'landscape' });
            const t = fullLedger.totals;

            // Header
            doc.setFillColor(67, 56, 202);
            doc.rect(0, 0, 300, 35, 'F');
            doc.setFontSize(22); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
            doc.text('RentPe', 14, 16);
            doc.setFontSize(10); doc.setFont('helvetica', 'normal');
            doc.text('Financial Ledger & Tax Report', 14, 23);
            doc.text(`${selectedFY.label}  |  Generated: ${new Date().toLocaleString('en-IN')}`, 14, 30);

            // Totals Summary
            doc.setFontSize(12); doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold');
            doc.text('Financial Summary', 14, 48);
            autoTable(doc, {
                startY: 53,
                head: [['Metric', 'Amount']],
                body: [
                    ['Total Gross Collected', fmt(t.totalGrossCollected)],
                    ['Platform Earned (Net)', fmt(t.totalPlatformEarned)],
                    ['GST Collected (Total)', fmt(t.totalGstCollected)],
                    ['  - CGST (9%)', fmt(t.totalCgst)],
                    ['  - SGST (9%)', fmt(t.totalSgst)],
                    ['TDS Withheld (Sec 194-O)', fmt(t.totalTdsWithheld)],
                    ['Total Owner Payouts', fmt(t.totalOwnerPayouts)],
                    ['Total Transactions', String(t.transactionCount)],
                ],
                theme: 'grid',
                headStyles: { fillColor: [67, 56, 202], textColor: 255, fontStyle: 'bold' },
                styles: { fontSize: 9, cellPadding: 3 },
                columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
            });

            // Transaction Ledger
            const y2 = (doc as any).lastAutoTable.finalY + 12;
            doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
            doc.text('Transaction Ledger (Full Audit Trail)', 14, y2);
            autoTable(doc, {
                startY: y2 + 5,
                head: [[
                    'Booking ID', 'RP Order ID', 'RP Payment ID', 'RP Transfer ID',
                    'Student', 'Property', 'Owner',
                    'Gross', 'Conv/Comm Fee', 'GST', 'TDS', 'Owner Net', 'Date'
                ]],
                body: rowsToExport.map((r: any) => [
                    r.rentpeBookingId,
                    r.razorpayOrderId?.slice(-12) || '—',
                    r.razorpayPaymentId?.slice(-12) || '—',
                    r.razorpayTransferId?.slice(-12) || '—',
                    r.studentName,
                    r.propertyName?.slice(0, 18),
                    r.ownerName,
                    fmtShort(r.grossAmount),
                    fmtShort(r.platformFeeStudent + r.platformFeeOwner),
                    fmtShort(r.gstOnStudentFee + r.gstOnOwnerFee),
                    fmtShort(r.tdsDeducted),
                    fmtShort(r.ownerNetPayout),
                    new Date(r.date).toLocaleDateString('en-IN'),
                ]),
                styles: { fontSize: 6.5, cellPadding: 2 },
                headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 7 },
                alternateRowStyles: { fillColor: [248, 250, 255] },
            });

            doc.save(`RentPe-FinancialLedger-${selectedFY.label.replace(/\s/g, '-')}.pdf`);
            toast.success('PDF downloaded with complete audit trail!', { id: 'export-pdf' });
        } catch (e) { 
            console.error(e); 
            toast.error('PDF generation failed', { id: 'export-pdf' }); 
        } finally { 
            setExporting(null); 
        }
    };

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="text-slate-500 font-medium">Loading financial data...</p>
        </div>
    );

    const T = ledger?.totals || {};
    const taxT = taxData?.totals || {};

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/20 pb-20">
            {/* Premium Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 pt-10 pb-24 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #6366f1 0%, transparent 50%), radial-gradient(circle at 80% 20%, #8b5cf6 0%, transparent 50%)' }} />
                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
                                    <IndianRupee className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-indigo-300 text-sm font-bold uppercase tracking-widest">Admin Console</span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Financial Ledger</h1>
                            <p className="text-slate-400 text-sm font-medium mt-2">Complete audit trail — every rupee, every tax, every transaction</p>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* FY Selector */}
                            <div className="flex bg-white/10 rounded-xl p-1 gap-1">
                                {fyOptions.map(fy => (
                                    <button key={fy.label} onClick={() => setSelectedFY(fy)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                            selectedFY.label === fy.label
                                                ? 'bg-indigo-500 text-white shadow-lg'
                                                : 'text-slate-300 hover:text-white hover:bg-white/10'
                                        }`}>
                                        {fy.label}
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => fetchAll(selectedFY)}
                                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-all">
                                <RefreshCcw className="w-4 h-4" /> Refresh
                            </button>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex gap-1 mt-8 bg-white/5 rounded-2xl p-1 w-fit">
                        {TABS.map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-indigo-500 text-white shadow-lg'
                                            : 'text-slate-400 hover:text-white hover:bg-white/10'
                                    }`}>
                                    <Icon className="w-4 h-4" />
                                    <span className="hidden md:inline">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 -mt-14 relative z-10 space-y-6">

                {/* ── TAB 1: REVENUE OVERVIEW ── */}
                {activeTab === 'overview' && (
                    <>
                        <TabSummary
                            icon="📊"
                            color="indigo"
                            title="Money Summary — The Big Picture"
                            desc="This tab shows the total money collected across all properties for the selected financial year. It tells you: how much rent came in, how much RentPe earned in fees, how much GST was collected for the government, and how much TDS was withheld from owners. Your CA will use this tab to file taxes."
                        />
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            <StatCard label="Total Gross Collected" value={fmt(T.totalGrossCollected)} icon={IndianRupee} color="indigo" sub={`${T.transactionCount} transactions`} />
                            <StatCard label="Platform Earned" value={fmt(T.totalPlatformEarned)} icon={TrendingUp} color="emerald" sub="Convenience fee (net)" />
                            <StatCard label="GST Collected" value={fmt(T.totalGstCollected)} icon={Receipt} color="amber" sub="CGST + SGST (for govt)" />
                            <StatCard label="TDS Withheld" value={fmt(T.totalTdsWithheld)} icon={Shield} color="violet" sub="Sec 194-O (for govt)" />
                            <StatCard label="CGST (9%)" value={fmt(T.totalCgst)} icon={Receipt} color="cyan" />
                            <StatCard label="SGST (9%)" value={fmt(T.totalSgst)} icon={Receipt} color="cyan" />
                            <StatCard label="Owner Payouts" value={fmt(T.totalOwnerPayouts)} icon={Building2} color="rose" sub="After fees + TDS" />
                            <StatCard label="Transactions" value={T.transactionCount?.toString() || '0'} icon={Users} color="indigo" />
                        </div>

                        {/* Monthly Trend from tax data */}
                        {taxData?.monthly?.length > 0 && (
                            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6">
                                <h3 className="font-black text-slate-900 text-lg mb-4">Monthly Tax Collection Trend</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                                {['Month', 'Transactions', 'GST Collected', 'CGST', 'SGST', 'TDS Withheld', 'Platform Earned'].map(h => (
                                                    <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {taxData.monthly.map((m: any) => (
                                                <tr key={m.key} className="hover:bg-indigo-50/30 transition-colors">
                                                    <td className="px-4 py-3 text-sm font-bold text-slate-800">{m.month}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-600">{m.transactions}</td>
                                                    <td className="px-4 py-3 text-sm font-black text-amber-600">{fmt(m.gst)}</td>
                                                    <td className="px-4 py-3 text-xs text-slate-500">{fmt(m.cgst)}</td>
                                                    <td className="px-4 py-3 text-xs text-slate-500">{fmt(m.sgst)}</td>
                                                    <td className="px-4 py-3 text-sm font-black text-violet-600">{fmt(m.tds)}</td>
                                                    <td className="px-4 py-3 text-sm font-black text-emerald-600">{fmt(m.platformEarned)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Export section */}
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6">
                            <h3 className="font-black text-slate-900 text-lg mb-2">Export Full Report</h3>
                            <p className="text-sm text-slate-500 mb-4">Download complete audit trail with all Razorpay IDs, tax breakdowns, and amounts.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button onClick={handleExportPDF} disabled={exporting !== null}
                                    className="flex items-center gap-4 p-5 bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl hover:from-indigo-100 hover:to-violet-100 transition-all disabled:opacity-50 text-left">
                                    {exporting === 'pdf' ? <Loader2 className="w-10 h-10 text-indigo-500 animate-spin flex-shrink-0" /> : (
                                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5 text-white" /></div>
                                    )}
                                    <div>
                                        <p className="font-black text-slate-900">📄 Download PDF</p>
                                        <p className="text-xs text-slate-500 mt-0.5">Formatted report with summary + full ledger table</p>
                                    </div>
                                </button>
                                <button onClick={handleExportCSV} disabled={exporting !== null}
                                    className="flex items-center gap-4 p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl hover:from-emerald-100 hover:to-teal-100 transition-all disabled:opacity-50 text-left">
                                    {exporting === 'csv' ? <Loader2 className="w-10 h-10 text-emerald-500 animate-spin flex-shrink-0" /> : (
                                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center flex-shrink-0"><Download className="w-5 h-5 text-white" /></div>
                                    )}
                                    <div>
                                        <p className="font-black text-slate-900">📊 Download CSV</p>
                                        <p className="text-xs text-slate-500 mt-0.5">All 29 columns — all IDs, all tax fields, all amounts</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* ── TAB 2: TRANSACTION LEDGER ── */}
                {activeTab === 'ledger' && (
                    <div className="space-y-4">
                    <TabSummary
                        icon="🧾"
                        color="amber"
                        title="All Payments — One Row Per Transaction"
                        desc="Every single payment ever made on RentPe is listed here — like a detailed bank statement. Each row shows who paid, for which property, how much went to the owner, how much was kept as platform fee, and the exact Razorpay IDs for reconciliation. Use Search to find any specific student, property, or Razorpay ID instantly."
                    />
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex items-center gap-3 flex-wrap">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    className="pl-10 w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    placeholder="Search student, property, booking ID, Razorpay ID..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                                <Filter className="w-4 h-4" />
                                {filteredRows.length} of {ledger?.rows?.length || 0} records
                            </div>
                            <button onClick={handleExportCSV} disabled={exporting !== null}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50">
                                <Download className="w-4 h-4" /> Export CSV
                            </button>
                            <button onClick={handleExportPDF} disabled={exporting !== null}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50">
                                <FileText className="w-4 h-4" /> Export PDF
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-slate-900 text-white">
                                        {([
                                            ['Date', 'The exact date and time this payment was made.'],
                                            ['Booking ID', 'RentPe internal booking reference number (e.g. RP-B-00010).'],
                                            ['RP Order ID', 'Razorpay Order ID — created before the student pays. Use this to trace a payment on Razorpay dashboard.'],
                                            ['RP Payment ID', 'Razorpay Payment ID — generated after the student successfully pays. This is the actual money receipt.'],
                                            ['RP Transfer ID', 'Razorpay Transfer ID — set when money is sent from RentPe\'s Razorpay account to the owner. Blank if transfer is pending.'],
                                            ['Student', 'The student (tenant) who made this payment.'],
                                            ['Property', 'The PG/hostel this payment is for.'],
                                            ['Owner', 'The property owner who will receive the payout.'],
                                            ['Gross', 'Total rent amount the student paid (before any deductions).'],
                                            ['Plat.Fee', 'Platform fee charged — includes convenience fee from student + commission from owner.'],
                                            ['GST', 'Goods & Services Tax (18%) collected on the platform fee. This goes to the government.'],
                                            ['TDS', 'Tax Deducted at Source (1% under Section 194-O). Deducted from owner payout and deposited with Income Tax Dept.'],
                                            ['Owner Net', 'Final amount the owner receives: Gross Rent minus Platform Commission minus TDS.'],
                                            ['Status', 'Payment status — VERIFIED means money received and confirmed.']
                                        ] as [string, string][]).map(([h, tip]) => (
                                            <th key={h} className="px-3 py-3 text-left font-bold text-[10px] uppercase tracking-widest whitespace-nowrap">
                                                <span className="flex items-center gap-0.5">{h}<Tip text={tip} /></span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredRows.length === 0 ? (
                                        <tr><td colSpan={14} className="p-8 text-center text-slate-400">No transactions found.</td></tr>
                                    ) : filteredRows.map((r: any, i: number) => (
                                        <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                                            <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                                            <td className="px-3 py-2.5 font-mono text-indigo-600 font-bold">{r.rentpeBookingId}</td>
                                            <td className="px-3 py-2.5 font-mono text-slate-400 max-w-[100px] truncate">{r.razorpayOrderId}</td>
                                            <td className="px-3 py-2.5 font-mono text-slate-400 max-w-[100px] truncate">{r.razorpayPaymentId}</td>
                                            <td className="px-3 py-2.5 font-mono text-slate-400 max-w-[100px] truncate">{r.razorpayTransferId}</td>
                                            <td className="px-3 py-2.5">
                                                <div className="font-bold text-slate-800">{r.studentName}</div>
                                                <div className="text-[10px] text-slate-400">{r.studentEmail}</div>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="font-medium text-slate-700">{r.propertyName}</div>
                                                <div className="text-[10px] text-slate-400">{r.propertyCity}</div>
                                            </td>
                                            <td className="px-3 py-2.5 text-slate-600">{r.ownerName}</td>
                                            <td className="px-3 py-2.5 font-black text-slate-900">{fmtShort(r.grossAmount)}</td>
                                            <td className="px-3 py-2.5 font-bold text-indigo-600">{fmtShort(r.platformFeeStudent + r.platformFeeOwner)}</td>
                                            <td className="px-3 py-2.5 font-bold text-amber-600">{fmtShort(r.gstOnStudentFee + r.gstOnOwnerFee)}</td>
                                            <td className="px-3 py-2.5 font-bold text-violet-600">{fmtShort(r.tdsDeducted)}</td>
                                            <td className="px-3 py-2.5 font-bold text-emerald-600">{fmtShort(r.ownerNetPayout)}</td>
                                            <td className="px-3 py-2.5">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                    r.status === 'SUCCESS' || r.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' :
                                                    r.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                                                }`}>{r.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {filteredRows.length > 0 && (
                            <div className="p-4 border-t border-slate-100 text-xs text-indigo-500 text-center font-bold">
                                ℹ️ Showing the 100 most recent records for performance. Use "Export CSV" or "Export PDF" above to fetch and download the full audit trail.
                            </div>
                        )}
                    </div>
                    </div>
                )}

                {/* ── TAB 3: TAX LIABILITY ── */}
                {activeTab === 'tax' && (
                    <>
                        <TabSummary
                            icon="🏛️"
                            color="violet"
                            title="GST & TDS Report — What We Owe The Government"
                            desc="This tab is for your CA / finance team. GST (18%) is collected on platform fees and must be deposited with the government every quarter. TDS (1%) is deducted from each owner's payout under Section 194-O and deposited with the Income Tax Department. Owners with a lower/nil TDS certificate are shown as 'Exempt'."
                        />
                        {/* GST Summary */}
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6">
                            <h3 className="font-black text-slate-900 text-lg mb-1">GST Liability Summary <Tip text="GST = Goods & Services Tax. RentPe collects 18% GST on its platform fee. This entire GST amount must be deposited with the government. It is split equally as CGST (9%) + SGST (9%)." /></h3>
                            <p className="text-sm text-slate-500 mb-5">SAC Code: 997312 — Short-term accommodation/leasing services</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <TaxBadge label="Total GST Collected" value={fmt(taxT.totalGst)} color="orange" />
                                <TaxBadge label="CGST (9%)" value={fmt(taxT.totalCgst)} color="blue" />
                                <TaxBadge label="SGST (9%)" value={fmt(taxT.totalSgst)} color="blue" />
                                <TaxBadge label="Platform Earned" value={fmt(taxT.totalPlatformEarned)} color="green" />
                            </div>
                        </div>

                        {/* TDS Summary */}
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6">
                            <h3 className="font-black text-slate-900 text-lg mb-1">TDS Liability Summary <Tip text="TDS = Tax Deducted at Source. RentPe must deduct 1% TDS from each owner payout and deposit it with the Income Tax Department under Section 194-O. This applies to all e-commerce aggregators like Zomato, Amazon — and RentPe." /></h3>
                            <p className="text-sm text-slate-500 mb-5">Section 194-O — 1% TDS on gross rent by e-commerce aggregator</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                                <TaxBadge label="Total TDS Withheld" value={fmt(taxT.totalTds)} color="red" />
                                <TaxBadge label="Exempt Owners" value={String(taxData?.exemptOwners?.length || 0)} color="green" />
                                <TaxBadge label="Paying Owners" value={String(taxData?.ownerTds?.length || 0)} color="orange" />
                            </div>
                            {taxData?.ownerTds?.length > 0 && (
                                <>
                                    <h4 className="font-black text-slate-800 mb-3">TDS Withheld by Owner</h4>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-100 bg-slate-50">
                                                    {['Owner Name', 'Owner ID', 'Email', 'Transactions', 'TDS Withheld'].map(h => (
                                                        <th key={h} className="text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {taxData.ownerTds.map((o: any, i: number) => (
                                                    <tr key={i} className="hover:bg-violet-50/30 transition-colors">
                                                        <td className="px-4 py-2 font-bold text-slate-800">{o.ownerName}</td>
                                                        <td className="px-4 py-2 font-mono text-indigo-600">{o.ownerId}</td>
                                                        <td className="px-4 py-2 text-slate-500">{o.ownerEmail}</td>
                                                        <td className="px-4 py-2 text-slate-600">{o.transactions}</td>
                                                        <td className="px-4 py-2 font-black text-violet-700">{fmt(o.totalTds)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* TDS Exempt Owners */}
                        {taxData?.exemptOwners?.length > 0 && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6">
                                <h3 className="font-black text-emerald-800 text-lg mb-4 flex items-center gap-2">
                                    <BadgeCheck className="w-5 h-5" /> TDS Exempt Properties
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {taxData.exemptOwners.map((ex: any, i: number) => (
                                        <div key={i} className="bg-white rounded-xl p-4 border border-emerald-100">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="font-bold text-slate-800">{ex.propertyName || 'All Properties'}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5">{ex.tdsExemptionReason}</p>
                                                </div>
                                                {ex.tdsCertificateUrl && (
                                                    <a href={ex.tdsCertificateUrl} target="_blank" rel="noreferrer"
                                                        className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1">
                                                        <FileText className="w-3 h-3" /> Certificate
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ── TAB 4: UNIT ECONOMICS ── */}
                {activeTab === 'unit' && (
                    <div className="space-y-4">
                    <TabSummary
                        icon="🏢"
                        color="emerald"
                        title="Per Property Breakdown — Which PG Earns The Most?"
                        desc="This tab breaks down every financial metric per property. You can see which PG generated the most rent, how many students stayed there, how much platform fee was earned from it, and what the owner received. The last row shows the total across all properties."
                    />
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                        <div className="p-5 border-b border-slate-100">
                            <h3 className="font-black text-slate-900 text-lg">Property Unit Economics</h3>
                            <p className="text-sm text-slate-500 mt-0.5">Revenue, platform fees, GST, and TDS broken down per property.</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-900 text-white">
                                        {([
                                            ['Property', 'Name of the PG / hostel.'],
                                            ['City', 'City where this property is located.'],
                                            ['Owner', 'The property owner who listed this PG on RentPe.'],
                                            ['Transactions', 'Total number of successful payments received for this property.'],
                                            ['Students', 'Number of unique students who have paid for this property.'],
                                            ['Gross Rent', 'Total rent collected from students for this property.'],
                                            ['Platform Fee', 'Total platform fees earned from this property (student convenience fee + owner commission).'],
                                            ['GST', 'Total GST (18%) collected on platform fees from this property — to be deposited with the government.'],
                                            ['TDS', 'Total TDS (1%) withheld from this owner\'s payouts — deposited with Income Tax Dept.'],
                                            ['Owner Payout', 'Total amount actually transferred to the owner: Gross Rent minus fees minus TDS.'],
                                            ['Platform Earned', 'Net revenue RentPe earned from this property (fees minus GST, which goes to govt).']
                                        ] as [string, string][]).map(([h, tip]) => (
                                            <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                                                <span className="flex items-center gap-0.5">{h}<Tip text={tip} /></span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {!unitData?.properties?.length ? (
                                        <tr><td colSpan={11} className="p-8 text-center text-slate-400">No data yet.</td></tr>
                                    ) : unitData.properties.map((p: any, i: number) => (
                                        <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-slate-900">{p.propertyName}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500">{p.city}</td>
                                            <td className="px-4 py-3 text-slate-600">{p.ownerName}</td>
                                            <td className="px-4 py-3 text-slate-600">{p.transactions}</td>
                                            <td className="px-4 py-3 text-slate-600">{p.uniqueStudents}</td>
                                            <td className="px-4 py-3 font-black text-slate-900">{fmtShort(p.totalGrossRent)}</td>
                                            <td className="px-4 py-3 font-bold text-indigo-600">{fmtShort(p.totalPlatformFee)}</td>
                                            <td className="px-4 py-3 font-bold text-amber-600">{fmtShort(p.totalGst)}</td>
                                            <td className="px-4 py-3 font-bold text-violet-600">{fmtShort(p.totalTds)}</td>
                                            <td className="px-4 py-3 font-bold text-emerald-600">{fmtShort(p.totalOwnerPayout)}</td>
                                            <td className="px-4 py-3 font-black text-indigo-700">{fmtShort(p.platformEarned)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                {unitData?.properties?.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-slate-900 text-white font-black text-sm">
                                            <td className="px-4 py-3" colSpan={5}>TOTALS</td>
                                            <td className="px-4 py-3">{fmtShort(unitData.properties.reduce((s: number, p: any) => s + p.totalGrossRent, 0))}</td>
                                            <td className="px-4 py-3">{fmtShort(unitData.properties.reduce((s: number, p: any) => s + p.totalPlatformFee, 0))}</td>
                                            <td className="px-4 py-3">{fmtShort(unitData.properties.reduce((s: number, p: any) => s + p.totalGst, 0))}</td>
                                            <td className="px-4 py-3">{fmtShort(unitData.properties.reduce((s: number, p: any) => s + p.totalTds, 0))}</td>
                                            <td className="px-4 py-3">{fmtShort(unitData.properties.reduce((s: number, p: any) => s + p.totalOwnerPayout, 0))}</td>
                                            <td className="px-4 py-3">{fmtShort(unitData.properties.reduce((s: number, p: any) => s + p.platformEarned, 0))}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                    </div>
                )}
            </div>
        </div>
    );
}
