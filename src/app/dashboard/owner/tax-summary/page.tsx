'use client';

import { useEffect, useState } from 'react';
import { getOwnerFinancialReport, getOwnerMonthlyTaxBreakdown } from '@/actions/ownerDashboard';
import { toast } from 'sonner';
import {
    Download, FileText, Loader2, IndianRupee, Shield,
    BadgeCheck, AlertTriangle, TrendingUp, Receipt, Building2
} from 'lucide-react';

function buildFYOptions() {
    const year = new Date().getFullYear();
    return [
        { label: `FY ${year - 1}-${year}`, from: new Date(`${year - 1}-04-01`), to: new Date(`${year}-03-31`) },
        { label: `FY ${year}-${year + 1}`, from: new Date(`${year}-04-01`), to: new Date(`${year + 1}-03-31`) },
    ];
}

function getCurrentFY() {
    const now = new Date();
    return now.getMonth() >= 3
        ? `FY ${now.getFullYear()}-${now.getFullYear() + 1}`
        : `FY ${now.getFullYear() - 1}-${now.getFullYear()}`;
}

const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

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
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center flex-shrink-0 shadow`}>
                <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
                <p className="text-xl font-black text-slate-900 truncate">{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{label}</p>
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

    const reload = (fy: typeof fyOptions[0]) => {
        setLoading(true);
        Promise.all([
            getOwnerFinancialReport(fy.from, fy.to),
            getOwnerMonthlyTaxBreakdown(fy.from, fy.to),
        ]).then(([r, m]) => {
            setReport(r);
            setMonthly(m);
            setLoading(false);
        }).catch(() => {
            toast.error('Failed to load financial data');
            setLoading(false);
        });
    };

    useEffect(() => { reload(selectedFY); }, [selectedFY]);

    // ── PDF Export (upgraded with GST/TDS) ──
    const handleExportPDF = async () => {
        if (!report) return;
        setExporting('pdf');
        try {
            const { jsPDF } = await import('jspdf');
            const autoTable = (await import('jspdf-autotable')).default;
            const doc = new jsPDF({ orientation: 'landscape' });
            const s = report.summary;

            // Header
            doc.setFillColor(67, 56, 202);
            doc.rect(0, 0, 300, 35, 'F');
            doc.setFontSize(22); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
            doc.text('RentPe', 14, 16);
            doc.setFontSize(10); doc.setFont('helvetica', 'normal');
            doc.text('Owner Tax Summary & Financial Statement', 14, 23);
            doc.text(`${selectedFY.label}  |  Generated: ${new Date().toLocaleString('en-IN')}`, 14, 30);

            // Owner Details
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(14, 42, 270, 22, 3, 3, 'F');
            doc.setFontSize(11); doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold');
            doc.text(s.businessName || s.ownerName, 20, 52);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
            doc.text(`Owner: ${s.ownerName}  |  Partner ID: ${s.ownerId}  |  TDS Status: ${s.tdsExempt ? '✓ EXEMPT' : 'Standard 1%'}`, 20, 59);

            // Summary Table
            doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
            doc.text('Financial Summary', 14, 76);
            autoTable(doc, {
                startY: 81,
                head: [['Metric', 'Amount']],
                body: [
                    ['Total Gross Rent Collected', fmt(s.totalGross)],
                    ['Platform Fee Charged to You', fmt(s.totalPlatformFeeCharged)],
                    ['GST on Platform Fee (18%)', fmt(s.totalGstCharged)],
                    ['TDS Deducted from Payouts (1%)', s.tdsExempt ? '₹0.00 (Exempt)' : fmt(s.totalTdsDeducted)],
                    ['Your Net Payout (after fees + TDS)', fmt(s.totalOwnerNetPayout)],
                    ['Total Refunds', fmt(s.totalRefunds)],
                    ['Confirmed Bookings', String(s.confirmedBookings)],
                ],
                theme: 'grid',
                headStyles: { fillColor: [67, 56, 202], textColor: 255, fontStyle: 'bold' },
                styles: { fontSize: 9, cellPadding: 3 },
                columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
            });

            // Monthly Breakdown
            if (monthly.length > 0) {
                const y2 = (doc as any).lastAutoTable.finalY + 10;
                doc.setFontSize(12); doc.setFont('helvetica', 'bold');
                doc.text('Monthly Tax Breakdown', 14, y2);
                autoTable(doc, {
                    startY: y2 + 5,
                    head: [['Month', 'Gross Rent', 'Platform Fee', 'GST', 'TDS', 'Net Payout', 'Transactions']],
                    body: monthly.map(m => [
                        m.month,
                        fmtShort(m.grossRent),
                        fmtShort(m.platformFee),
                        fmtShort(m.gst),
                        s.tdsExempt ? '₹0 (Exempt)' : fmtShort(m.tds),
                        fmtShort(m.netPayout),
                        String(m.transactions),
                    ]),
                    styles: { fontSize: 8, cellPadding: 3 },
                    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [248, 250, 255] },
                });
            }

            // Transaction Ledger
            const y3 = (doc as any).lastAutoTable.finalY + 10;
            doc.setFontSize(12); doc.setFont('helvetica', 'bold');
            doc.text('Transaction Ledger (Audit Trail)', 14, y3);
            autoTable(doc, {
                startY: y3 + 5,
                head: [['Booking ID', 'RP Order ID', 'RP Payment ID', 'Tenant', 'Property', 'Gross', 'Platform Fee', 'GST', 'TDS', 'Net Payout', 'Date', 'Status']],
                body: report.report.map((r: any) => [
                    r.bookingId,
                    r.razorpayOrderId?.slice(-12) || '—',
                    r.razorpayPaymentId?.slice(-12) || '—',
                    r.tenantName,
                    r.property?.slice(0, 15),
                    fmtShort(r.amount || 0),
                    fmtShort(r.platformFeeCharged),
                    fmtShort(r.gstCharged),
                    s.tdsExempt ? '₹0' : fmtShort(r.tdsDeducted),
                    fmtShort(r.ownerNetPayout),
                    new Date(r.date).toLocaleDateString('en-IN'),
                    r.status,
                ]),
                styles: { fontSize: 7, cellPadding: 2 },
                headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 7 },
                alternateRowStyles: { fillColor: [248, 250, 255] },
            });

            doc.save(`RentPe-TaxSummary-${selectedFY.label.replace(/\s/g, '-')}.pdf`);
            toast.success('PDF downloaded with complete tax breakdown!');
        } catch (e) {
            console.error(e);
            toast.error('Failed to generate PDF');
        } finally {
            setExporting(null);
        }
    };

    // ── CSV Export (upgraded with GST/TDS + all IDs) ──
    const handleExportCSV = () => {
        if (!report) return;
        setExporting('csv');
        try {
            const s = report.summary;
            const headers = [
                'Booking ID', 'Internal Booking ID',
                'Razorpay Order ID', 'Razorpay Payment ID', 'Razorpay Transfer ID',
                'Tenant Name', 'Property', 'Room Type', 'Payment Method',
                'Gross Amount', 'Platform Fee Charged', 'GST Charged (18%)',
                'TDS Deducted (1%)', 'Owner Net Payout',
                'Refund Amount', 'Net Revenue',
                'Status', 'Date'
            ];
            const rows = report.report.map((r: any) => [
                r.bookingId, r.internalBookingId,
                r.razorpayOrderId, r.razorpayPaymentId, r.razorpayTransferId,
                r.tenantName, r.property, r.roomType, r.paymentMethod,
                r.amount, r.platformFeeCharged, r.gstCharged,
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
            a.download = `RentPe-TaxLedger-${selectedFY.label.replace(/\s/g, '-')}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('CSV exported with all IDs and tax columns!');
        } catch {
            toast.error('Failed to export CSV');
        } finally {
            setExporting(null);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-9 h-9 text-indigo-600 animate-spin" />
            <p className="text-slate-500 font-medium text-sm">Loading your tax summary...</p>
        </div>
    );

    const s = report?.summary;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/20 pb-20">
            {/* Premium Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 px-6 pt-10 pb-24 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #a78bfa 0%, transparent 60%)' }} />
                <div className="max-w-5xl mx-auto relative z-10">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Receipt className="w-5 h-5 text-indigo-200" />
                                <span className="text-indigo-200 text-xs font-bold uppercase tracking-widest">Financial Statement</span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Tax Summary & Payout Ledger</h1>
                            <p className="text-indigo-200 text-sm font-medium mt-2">Your complete financial picture — GST, TDS, and net payouts</p>
                        </div>
                        {/* FY Selector */}
                        <div className="flex bg-white/15 rounded-xl p-1 gap-1">
                            {fyOptions.map(fy => (
                                <button key={fy.label} onClick={() => setSelectedFY(fy)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                        selectedFY.label === fy.label
                                            ? 'bg-white text-indigo-700 shadow'
                                            : 'text-white hover:bg-white/20'
                                    }`}>
                                    {fy.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 -mt-14 relative z-10 space-y-6">

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

                {/* KPI Cards */}
                {s && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <KpiCard label="Total Gross Rent" value={fmtShort(s.totalGross)} icon={IndianRupee} color="indigo" sub={`${s.confirmedBookings} paid bookings`} />
                        <KpiCard label="Platform Fee Charged" value={fmtShort(s.totalPlatformFeeCharged)} icon={Building2} color="amber" sub="Convenience fee" />
                        <KpiCard label="GST Charged (18%)" value={fmtShort(s.totalGstCharged)} icon={Receipt} color="violet" sub="On platform fee only" />
                        <KpiCard label="TDS Deducted (1%)" value={s.tdsExempt ? '₹0 (Exempt)' : fmtShort(s.totalTdsDeducted)} icon={Shield} color={s.tdsExempt ? 'emerald' : 'rose'} sub="Sec 194-O" />
                        <KpiCard label="Your Net Payout" value={fmtShort(s.totalOwnerNetPayout)} icon={TrendingUp} color="emerald" sub="After fees + TDS" />
                        <KpiCard label="Total Refunds" value={fmtShort(s.totalRefunds)} icon={Download} color="rose" sub="Processed refunds" />
                    </div>
                )}

                {/* Monthly Tax Breakdown Table */}
                {monthly.length > 0 && (
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                        <div className="p-5 border-b border-slate-100">
                            <h3 className="font-black text-slate-900 text-lg">Monthly Tax Breakdown</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Month-by-month view of gross rent, platform fees, GST, TDS, and your net payout</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        {['Month', 'Transactions', 'Gross Rent', 'Platform Fee', 'GST (18%)', 'TDS (1%)', 'Your Net Payout'].map(h => (
                                            <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {monthly.map((m: any) => (
                                        <tr key={m.key} className="hover:bg-indigo-50/30 transition-colors">
                                            <td className="px-4 py-3 font-bold text-slate-800">{m.month}</td>
                                            <td className="px-4 py-3 text-slate-500">{m.transactions}</td>
                                            <td className="px-4 py-3 font-black text-slate-900">{fmtShort(m.grossRent)}</td>
                                            <td className="px-4 py-3 font-bold text-amber-600">{fmtShort(m.platformFee)}</td>
                                            <td className="px-4 py-3 font-bold text-violet-600">{fmtShort(m.gst)}</td>
                                            <td className="px-4 py-3 font-bold text-rose-600">
                                                {s?.tdsExempt ? <span className="text-emerald-600">₹0 ✓</span> : fmtShort(m.tds)}
                                            </td>
                                            <td className="px-4 py-3 font-black text-emerald-600">{fmtShort(m.netPayout)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-900 text-white font-black text-sm">
                                        <td className="px-4 py-3">TOTAL</td>
                                        <td className="px-4 py-3">{monthly.reduce((s, m) => s + m.transactions, 0)}</td>
                                        <td className="px-4 py-3">{fmtShort(monthly.reduce((s, m) => s + m.grossRent, 0))}</td>
                                        <td className="px-4 py-3">{fmtShort(monthly.reduce((s, m) => s + m.platformFee, 0))}</td>
                                        <td className="px-4 py-3">{fmtShort(monthly.reduce((s, m) => s + m.gst, 0))}</td>
                                        <td className="px-4 py-3">{s?.tdsExempt ? '₹0 ✓' : fmtShort(monthly.reduce((s, m) => s + m.tds, 0))}</td>
                                        <td className="px-4 py-3">{fmtShort(monthly.reduce((s, m) => s + m.netPayout, 0))}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                {/* Export Section */}
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6">
                    <h3 className="font-black text-slate-900 text-lg mb-1">Export for Your CA / Accountant</h3>
                    <p className="text-sm text-slate-500 mb-5">
                        Downloads include: Booking ID, Razorpay IDs, GST breakdown, TDS deducted, and net payout for every transaction.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button onClick={handleExportPDF} disabled={exporting !== null}
                            className="flex items-center gap-4 p-5 bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl hover:from-indigo-100 hover:to-violet-100 transition-all disabled:opacity-50 text-left">
                            {exporting === 'pdf'
                                ? <Loader2 className="w-10 h-10 text-indigo-500 animate-spin flex-shrink-0" />
                                : <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5 text-white" /></div>
                            }
                            <div>
                                <p className="font-black text-slate-900">📄 Download PDF</p>
                                <p className="text-xs text-slate-500 mt-0.5">Formatted report: Summary + Monthly + Full Ledger with GST/TDS</p>
                            </div>
                        </button>
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

                {/* Transaction Preview Table */}
                {report?.report?.length > 0 && (
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-black text-slate-900">Transaction Preview</h3>
                            <span className="text-xs text-slate-400 font-bold">{report.report.length} records • Download for full audit trail</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-slate-800 text-white">
                                        {['Date', 'Booking ID', 'RP Order ID', 'Tenant', 'Property', 'Gross', 'Platform Fee', 'GST', 'TDS', 'Net Payout', 'Status'].map(h => (
                                            <th key={h} className="text-left px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {report.report.slice(0, 25).map((r: any, i: number) => (
                                        <tr key={i} className="hover:bg-indigo-50/20 transition-colors">
                                            <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                                            <td className="px-3 py-2.5 font-mono text-indigo-600 font-bold">{r.bookingId}</td>
                                            <td className="px-3 py-2.5 font-mono text-slate-400 max-w-[90px] truncate">{r.razorpayOrderId}</td>
                                            <td className="px-3 py-2.5 font-bold text-slate-700">{r.tenantName}</td>
                                            <td className="px-3 py-2.5 text-slate-600 max-w-[120px] truncate">{r.property}</td>
                                            <td className="px-3 py-2.5 font-black text-slate-900">{fmtShort(r.amount || 0)}</td>
                                            <td className="px-3 py-2.5 font-bold text-amber-600">{fmtShort(r.platformFeeCharged)}</td>
                                            <td className="px-3 py-2.5 font-bold text-violet-600">{fmtShort(r.gstCharged)}</td>
                                            <td className="px-3 py-2.5 font-bold text-rose-600">
                                                {s?.tdsExempt ? <span className="text-emerald-600">₹0</span> : fmtShort(r.tdsDeducted)}
                                            </td>
                                            <td className="px-3 py-2.5 font-black text-emerald-600">{fmtShort(r.ownerNetPayout)}</td>
                                            <td className="px-3 py-2.5">
                                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                    ['BOOKING_CONFIRMED', 'CHECKED_IN', 'PAID', 'CASH_PAID'].includes(r.status)
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : r.status === 'CANCELLED'
                                                        ? 'bg-rose-100 text-rose-700'
                                                        : 'bg-slate-100 text-slate-500'
                                                }`}>{r.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {report.report.length > 25 && (
                                <p className="text-center text-xs text-slate-400 py-3 font-bold border-t border-slate-50">
                                    Showing 25 of {report.report.length} records. Download CSV/PDF to see all.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
