import { getMyPaymentHistory } from "@/actions/payments";
import { format } from "date-fns";
import { FileText, CheckCircle2, Clock, AlertTriangle, Minus, TrendingUp, Calendar, Shield, IndianRupee } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Payment History | RentPe Student Dashboard" };

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; cls: string }> = {
        PAID:    { label: "Paid",    cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
        PENDING: { label: "Pending", cls: "bg-amber-100 text-amber-700 border-amber-200" },
        OVERDUE: { label: "Overdue", cls: "bg-red-100 text-red-700 border-red-200" },
        WAIVED:  { label: "Waived",  cls: "bg-slate-100 text-slate-600 border-slate-200" },
    };
    const s = map[status] || { label: status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${s.cls}`}>
            {s.label}
        </span>
    );
}

export default async function PaymentsPage() {
    let data: { invoices: any[]; tenants: any[]; depositInfo: any } = { invoices: [], tenants: [], depositInfo: null };
    try { data = await getMyPaymentHistory(); } catch {}

    const { invoices, depositInfo: securityDeposit } = data;

    // Summary calculations
    const currentYear = new Date().getFullYear();
    const fyStart = new Date(currentYear, 3, 1); // April 1
    const fyEnd = new Date(currentYear + 1, 2, 31);

    const totalPaid = invoices
        .filter((i: any) => i.status === 'PAID' && i.paidAt && new Date(i.paidAt) >= fyStart && new Date(i.paidAt) <= fyEnd)
        .reduce((sum: number, i: any) => sum + i.amount, 0);

    const now = new Date();
    const currentInvoice = invoices.find((i: any) => {
        const due = new Date(i.dueDate);
        return due.getMonth() === now.getMonth() && due.getFullYear() === now.getFullYear();
    });
    const nextDue = invoices.find((i: any) => i.status === 'PENDING' && new Date(i.dueDate) >= now);

    const filterTabs = ["All", "Paid", "Pending", "Overdue"];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-4 pt-10 pb-16 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('/noise.png')] opacity-5" />
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="max-w-4xl mx-auto relative z-10">
                    <Link href="/dashboard/student" className="text-indigo-200 text-xs font-bold flex items-center gap-1 mb-4 hover:text-white transition-colors">
                        ← Back to Dashboard
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Payment History</h1>
                    <p className="text-indigo-200 text-sm font-medium mt-1">Your complete rent ledger and receipts</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 -mt-8 relative z-10 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded-2xl p-4 shadow-lg shadow-indigo-100/50 border border-slate-100">
                        <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center mb-3">
                            <TrendingUp className="w-4 h-4 text-indigo-600" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Paid (FY)</p>
                        <p className="text-lg font-black text-slate-900 mt-0.5">₹{totalPaid.toLocaleString('en-IN')}</p>
                    </div>

                    <div className="bg-white rounded-2xl p-4 shadow-lg shadow-indigo-100/50 border border-slate-100">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
                            currentInvoice?.status === 'PAID' ? 'bg-emerald-100' :
                            currentInvoice?.status === 'OVERDUE' ? 'bg-red-100' : 'bg-amber-100'
                        }`}>
                            {currentInvoice?.status === 'PAID' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
                             currentInvoice?.status === 'OVERDUE' ? <AlertTriangle className="w-4 h-4 text-red-600" /> :
                             <Clock className="w-4 h-4 text-amber-600" />}
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">This Month</p>
                        <p className="text-lg font-black text-slate-900 mt-0.5">
                            {currentInvoice ? currentInvoice.status : '—'}
                        </p>
                    </div>

                    <div className="bg-white rounded-2xl p-4 shadow-lg shadow-indigo-100/50 border border-slate-100">
                        <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
                            <Calendar className="w-4 h-4 text-purple-600" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Next Due</p>
                        <p className="text-sm font-black text-slate-900 mt-0.5">
                            {nextDue ? format(new Date(nextDue.dueDate), 'dd MMM') : '—'}
                        </p>
                    </div>

                    <div className="bg-white rounded-2xl p-4 shadow-lg shadow-indigo-100/50 border border-slate-100">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${securityDeposit?.status === 'PAID' ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                            <Shield className={`w-4 h-4 ${securityDeposit?.status === 'PAID' ? 'text-emerald-600' : 'text-slate-400'}`} />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security Deposit</p>
                        <p className="text-sm font-black text-slate-900 mt-0.5">
                            {securityDeposit ? `₹${securityDeposit.amount} ${securityDeposit.status === 'PAID' ? '✓' : ''}` : '—'}
                        </p>
                    </div>
                </div>

                {/* Payment Table */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <IndianRupee className="w-4 h-4 text-indigo-600" /> Invoice Ledger
                        </h2>
                        <span className="text-xs text-slate-400 font-bold">{invoices.length} records</span>
                    </div>

                    {invoices.length === 0 ? (
                        <div className="py-16 text-center">
                            <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <p className="text-sm font-bold text-slate-400">No invoices yet</p>
                            <p className="text-xs text-slate-300 mt-1">Invoices will appear once your tenancy starts.</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Month</th>
                                            <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Property</th>
                                            <th className="text-right px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</th>
                                            <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Due Date</th>
                                            <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Paid On</th>
                                            <th className="text-center px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                            <th className="text-center px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Receipt</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoices.map((inv: any) => (
                                            <tr key={inv.id} className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors">
                                                <td className="px-5 py-4 font-black text-slate-800">{inv.month}</td>
                                                <td className="px-5 py-4 text-slate-600 font-medium text-xs">{inv.booking?.propertyName || '—'}</td>
                                                <td className="px-5 py-4 text-right font-black text-slate-900">₹{inv.amount.toLocaleString('en-IN')}</td>
                                                <td className="px-5 py-4 text-slate-500 text-xs font-bold">{format(new Date(inv.dueDate), 'dd MMM yyyy')}</td>
                                                <td className="px-5 py-4 text-slate-500 text-xs font-bold">
                                                    {inv.paidAt ? format(new Date(inv.paidAt), 'dd MMM yyyy') : <Minus className="w-3 h-3 text-slate-300 inline" />}
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <StatusBadge status={inv.status} />
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    {inv.status === 'PAID' ? (
                                                        <a
                                                            href={`/api/receipts/${inv.id}`}
                                                            target="_blank"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-indigo-100 transition-all hover:shadow-md"
                                                        >
                                                            <FileText className="w-3 h-3" /> Download
                                                        </a>
                                                    ) : (
                                                        <Minus className="w-3 h-3 text-slate-200 inline" />
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="md:hidden divide-y divide-slate-50">
                                {invoices.map((inv: any) => (
                                    <div key={inv.id} className="p-4 flex items-center justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-black text-slate-900">{inv.month}</span>
                                                <StatusBadge status={inv.status} />
                                            </div>
                                            <p className="text-xs text-slate-500 font-medium truncate">{inv.booking?.propertyName || '—'}</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5 font-bold">
                                                Due: {format(new Date(inv.dueDate), 'dd MMM yyyy')}
                                                {inv.paidAt && ` · Paid: ${format(new Date(inv.paidAt), 'dd MMM')}`}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                            <span className="text-base font-black text-slate-900">₹{inv.amount.toLocaleString('en-IN')}</span>
                                            {inv.status === 'PAID' && (
                                                <a
                                                    href={`/api/receipts/${inv.id}`}
                                                    target="_blank"
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg border border-indigo-100"
                                                >
                                                    <FileText className="w-3 h-3" /> PDF
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer note */}
                <p className="text-center text-xs text-slate-400 font-medium pb-4">
                    Receipts are generated automatically for paid invoices. For disputes, raise a ticket.
                </p>
            </div>
        </div>
    );
}
