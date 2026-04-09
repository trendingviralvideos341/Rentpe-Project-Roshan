'use client';

import { useEffect, useState, useTransition } from 'react';
import { getOwnerFinancialReport } from '@/actions/ownerDashboard';
import { toast } from 'sonner';
import { Download, FileText, Loader2, IndianRupee } from 'lucide-react';

function getFinancialYear() {
    const now = new Date();
    return now.getMonth() >= 3
        ? { label: `FY ${now.getFullYear()}-${now.getFullYear() + 1}`, from: `${now.getFullYear()}-04-01`, to: `${now.getFullYear() + 1}-03-31` }
        : { label: `FY ${now.getFullYear() - 1}-${now.getFullYear()}`, from: `${now.getFullYear() - 1}-04-01`, to: `${now.getFullYear()}-03-31` };
}

function buildFYOptions() {
    const year = new Date().getFullYear();
    return [
        { label: `FY ${year - 1}-${year}`, from: `${year - 1}-04-01`, to: `${year}-03-31` },
        { label: `FY ${year}-${year + 1}`, from: `${year}-04-01`, to: `${year + 1}-03-31` },
    ];
}

export default function TaxSummaryPage() {
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
    const [report, setReport] = useState<any>(null);
    const [fyOptions] = useState(buildFYOptions);
    const [selectedFY, setSelectedFY] = useState(fyOptions.find(f => f.label === getFinancialYear().label) || fyOptions[0]);

    const reload = (fy: typeof fyOptions[0]) => {
        setLoading(true);
        getOwnerFinancialReport(new Date(fy.from), new Date(fy.to)).then(data => {
            setReport(data);
            setLoading(false);
        });
    };

    useEffect(() => { reload(selectedFY); }, [selectedFY]);

    const handleExportPDF = async () => {
        if (!report) return;
        setExporting('pdf');
        try {
            const { jsPDF } = await import('jspdf');
            const autoTable = (await import('jspdf-autotable')).default;

            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.setTextColor(79, 70, 229);
            doc.text('RentPe — Tax Summary Report', 14, 20);
            doc.setFontSize(11);
            doc.setTextColor(100, 100, 100);
            doc.text(`Financial Year: ${selectedFY.label}`, 14, 30);
            doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 37);

            // Summary box
            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);
            const s = report.summary;
            doc.text(`Total Gross Revenue: ₹${s.totalGross.toLocaleString('en-IN')}`, 14, 50);
            doc.text(`Total Refunds: ₹${s.totalRefunds.toLocaleString('en-IN')}`, 14, 57);
            doc.text(`Net Revenue: ₹${s.totalNet.toLocaleString('en-IN')}`, 14, 64);
            doc.text(`Total Bookings: ${s.totalBookings}  |  Confirmed: ${s.confirmedBookings}  |  Cancelled: ${s.cancelledBookings}`, 14, 71);

            // Table
            autoTable(doc, {
                startY: 82,
                head: [['Booking ID', 'Property', 'Room Type', 'Amount', 'Status', 'Date', 'Net Revenue']],
                body: report.report.map((r: any) => [
                    r.bookingId,
                    r.property,
                    r.roomType,
                    `₹${r.amount?.toLocaleString('en-IN')}`,
                    r.status,
                    new Date(r.date).toLocaleDateString('en-IN'),
                    `₹${r.netRevenue?.toLocaleString('en-IN')}`,
                ]),
                styles: { fontSize: 8, cellPadding: 3 },
                headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 255] },
            });

            doc.save(`RentPe-TaxSummary-${selectedFY.label.replace(' ', '-')}.pdf`);
            toast.success('PDF downloaded successfully!');
        } catch (e: any) {
            toast.error('Failed to generate PDF');
        } finally {
            setExporting(null);
        }
    };

    const handleExportCSV = () => {
        if (!report) return;
        setExporting('csv');
        try {
            const headers = ['Booking ID', 'Property', 'Room Type', 'Amount', 'Status', 'Date', 'Refund Amount', 'Net Revenue'];
            const rows = report.report.map((r: any) => [
                r.bookingId, r.property, r.roomType, r.amount, r.status,
                new Date(r.date).toLocaleDateString('en-IN'), r.refundAmount, r.netRevenue
            ]);
            const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RentPe-TaxSummary-${selectedFY.label.replace(' ', '-')}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('CSV copied to downloads!');
        } catch (e) {
            toast.error('Failed to export CSV');
        } finally {
            setExporting(null);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
    );

    const s = report?.summary;
    const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 pt-10 pb-20 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="max-w-5xl mx-auto relative z-10">
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <Download className="w-8 h-8" /> Tax Summary Export
                    </h1>
                    <p className="text-indigo-200 text-sm font-medium mt-1">Download financial reports for your CA</p>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 -mt-12 relative z-10 space-y-6">
                {/* FY Selector */}
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-5 flex items-center gap-4 flex-wrap">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Financial Year</label>
                        <div className="flex gap-2">
                            {fyOptions.map(fy => (
                                <button key={fy.label} onClick={() => setSelectedFY(fy)}
                                    className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${selectedFY.label === fy.label ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                    {fy.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="ml-auto text-xs text-slate-400 font-medium">
                        {selectedFY.from} → {selectedFY.to}
                    </div>
                </div>

                {/* Summary Preview */}
                {s && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Total Gross', val: fmt(s.totalGross), color: 'indigo' },
                            { label: 'Total Refunds', val: fmt(s.totalRefunds), color: 'red' },
                            { label: 'Net Revenue', val: fmt(s.totalNet), color: 'emerald' },
                            { label: 'Bookings', val: s.totalBookings, color: 'purple' },
                        ].map(card => (
                            <div key={card.label} className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100 text-center">
                                <p className="text-xl font-black text-slate-900">{card.val}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{card.label}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Export Buttons */}
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 space-y-4">
                    <h3 className="font-black text-slate-900 text-lg">Export Options</h3>
                    <p className="text-sm text-slate-500">Download your financial data in these formats for your accountant / CA.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button onClick={handleExportPDF} disabled={exporting !== null}
                            className="flex items-center gap-4 p-5 bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-2xl hover:from-red-100 hover:to-rose-100 transition-all disabled:opacity-50 text-left">
                            {exporting === 'pdf' ? (
                                <Loader2 className="w-10 h-10 text-red-500 animate-spin flex-shrink-0" />
                            ) : (
                                <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-5 h-5 text-white" />
                                </div>
                            )}
                            <div>
                                <p className="font-black text-slate-900">📄 Download PDF</p>
                                <p className="text-xs text-slate-500 mt-0.5">Formatted report with summary + transaction table</p>
                            </div>
                        </button>

                        <button onClick={handleExportCSV} disabled={exporting !== null}
                            className="flex items-center gap-4 p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl hover:from-emerald-100 hover:to-teal-100 transition-all disabled:opacity-50 text-left">
                            {exporting === 'csv' ? (
                                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin flex-shrink-0" />
                            ) : (
                                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Download className="w-5 h-5 text-white" />
                                </div>
                            )}
                            <div>
                                <p className="font-black text-slate-900">📊 Download CSV</p>
                                <p className="text-xs text-slate-500 mt-0.5">Full transaction ledger for manual import</p>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Transaction Preview */}
                {report?.report?.length > 0 && (
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-black text-slate-900">Transaction Preview</h3>
                            <span className="text-xs text-slate-400 font-bold">{report.report.length} records</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/50">
                                        {['Booking ID', 'Property', 'Amount', 'Status', 'Date', 'Net Revenue'].map(h => (
                                            <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {report.report.slice(0, 20).map((r: any, i: number) => (
                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-3 text-xs font-bold text-indigo-600 font-mono">{r.bookingId}</td>
                                            <td className="px-4 py-3 text-xs text-slate-600">{r.property}</td>
                                            <td className="px-4 py-3 text-xs font-black text-slate-800">₹{Number(r.amount || 0).toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${['BOOKING_CONFIRMED', 'CHECKED_IN', 'PAID', 'CASH_PAID'].includes(r.status) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                                            <td className="px-4 py-3 text-xs font-black text-emerald-600">₹{Number(r.netRevenue || 0).toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {report.report.length > 20 && (
                                <p className="text-center text-xs text-slate-400 py-3 font-bold">
                                    Showing 20 of {report.report.length} records. Download to see all.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
