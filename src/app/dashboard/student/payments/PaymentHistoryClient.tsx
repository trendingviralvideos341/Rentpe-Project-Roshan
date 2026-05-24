"use client";

import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import {
    FileText, CheckCircle2, Clock, AlertTriangle, Minus, TrendingUp,
    Calendar, Shield, IndianRupee, ChevronDown, Building2, XCircle,
    RefreshCw, Tag, CreditCard, Home
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
type RawPayment = {
    id: string; amount: number; status: string; method: string | null;
    razorpayId: string | null; razorpayOrderId: string | null;
    invoiceId: string | null; depositId: string | null; date: Date | string;
};
type Invoice = {
    id: string; displayId: string; month: string; billingMonth: string;
    amount: number; rentAmount: number; dueDate: Date | string | null;
    paidAt: Date | string | null; status: string; paymentMethod: string | null;
    payments: RawPayment[];
};
type BookingEntry = {
    booking: {
        id: string; displayId: string; propertyName: string; status: string;
        createdAt: Date | string; tokenPaidAt: Date | string | null;
        tokenPaymentId: string | null; tokenAmount: number;
        paymentMethod: string | null; amount: number; depositAmount: number;
        roomAssigned: string | null; paymentStatus: string;
        activeAt: Date | string | null; completedAt: Date | string | null;
    };
    invoices: Invoice[];
    rawPayments: RawPayment[];
    depositInfo: { id: string; amount: number; status: string; paidAt: Date | string | null } | null;
};

// ─── Helper: pick the "current" booking ───────────────────────────────────────
function findCurrentBooking(data: BookingEntry[]): string | null {
    if (!data.length) return null;
    // Priority 1: ACTIVE booking
    const active = data.find(d => d.booking.status === 'ACTIVE');
    if (active) return active.booking.id;
    // Priority 2: Token paid (most recent)
    const tokenPaid = data.find(d => d.booking.tokenPaidAt);
    if (tokenPaid) return tokenPaid.booking.id;
    // Priority 3: Most recent booking
    return data[0].booking.id;
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; cls: string }> = {
        PAID:     { label: "Paid",     cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
        PENDING:  { label: "Pending",  cls: "bg-amber-100 text-amber-700 border-amber-200" },
        OVERDUE:  { label: "Overdue",  cls: "bg-red-100 text-red-700 border-red-200" },
        WAIVED:   { label: "Waived",   cls: "bg-slate-100 text-slate-600 border-slate-200" },
        VERIFIED: { label: "Success",  cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
        SUCCESS:  { label: "Success",  cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
        FAILED:   { label: "Failed",   cls: "bg-red-100 text-red-700 border-red-200" },
        REFUNDED: { label: "Refunded", cls: "bg-purple-100 text-purple-700 border-purple-200" },
    };
    const s = map[status] || { label: status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${s.cls}`}>
            {s.label}
        </span>
    );
}

function PaymentTypeBadge({ type }: { type: string }) {
    const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
        TOKEN:    { label: "Token",    icon: <Tag className="w-3 h-3" />,       cls: "bg-violet-50 text-violet-700 border-violet-100" },
        INVOICE:  { label: "Rent",     icon: <Home className="w-3 h-3" />,      cls: "bg-indigo-50 text-indigo-700 border-indigo-100" },
        DEPOSIT:  { label: "Deposit",  icon: <Shield className="w-3 h-3" />,    cls: "bg-teal-50 text-teal-700 border-teal-100" },
        PAYMENT:  { label: "Payment",  icon: <CreditCard className="w-3 h-3" />, cls: "bg-slate-50 text-slate-600 border-slate-100" },
    };
    const s = map[type] || map.PAYMENT;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.cls}`}>
            {s.icon}{s.label}
        </span>
    );
}

// ─── Main Client Component ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function PaymentHistoryClient({ allData }: { allData: any[] }) {
    const data = allData as BookingEntry[];
    const defaultId = useMemo(() => findCurrentBooking(data), [data]);
    const [selectedId, setSelectedId] = useState<string | null>(defaultId);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // Reset to default whenever user navigates back to this page
    useEffect(() => {
        setSelectedId(findCurrentBooking(data));
    }, [data]);

    const selected = useMemo(
        () => data.find(d => d.booking.id === selectedId) || data[0] || null,
        [selectedId, data]
    );

    const { invoices, rawPayments, depositInfo, booking } = selected || {
        invoices: [], rawPayments: [], depositInfo: null, booking: null
    };

    // ─── Summary stats for selected booking ──────────────────────────────────
    const currentYear = new Date().getFullYear();
    const fyStart = new Date(currentYear, 3, 1);
    const fyEnd = new Date(currentYear + 1, 2, 31);

    const totalPaid = invoices
        .filter(i => i.status === 'PAID' && i.paidAt && new Date(i.paidAt) >= fyStart && new Date(i.paidAt) <= fyEnd)
        .reduce((sum, i) => sum + i.amount, 0);

    const now = new Date();
    const currentInvoice = invoices.find(i => {
        if (!i.dueDate) return false;
        const due = new Date(i.dueDate);
        return due.getMonth() === now.getMonth() && due.getFullYear() === now.getFullYear();
    });
    const nextDue = invoices.find(i => i.status === 'PENDING' && i.dueDate && new Date(i.dueDate) >= now);

    // ─── Combined ledger rows (token + raw payments + invoices) ──────────────
    type LedgerRow = {
        id: string; date: Date; label: string; amount: number;
        status: string; type: string; receiptId?: string; txId?: string | null;
    };

    const ledgerRows = useMemo((): LedgerRow[] => {
        const rows: LedgerRow[] = [];

        // Token payment row
        if (booking?.tokenPaidAt) {
            rows.push({
                id: `token-${booking.id}`,
                date: new Date(booking.tokenPaidAt),
                label: `Token Payment — ${booking.propertyName}`,
                amount: booking.tokenAmount,
                status: 'SUCCESS',
                type: 'TOKEN',
                txId: booking.tokenPaymentId,
            });
        }

        // Deposit row
        if (depositInfo) {
            rows.push({
                id: `deposit-${depositInfo.id}`,
                date: depositInfo.paidAt ? new Date(depositInfo.paidAt) : (booking?.activeAt ? new Date(booking.activeAt) : new Date()),
                label: `Security Deposit — ${booking?.propertyName}`,
                amount: depositInfo.amount,
                status: depositInfo.status === 'PAID' ? 'SUCCESS' : depositInfo.status,
                type: 'DEPOSIT',
            });
        }

        // Invoice rows
        invoices.forEach(inv => {
            rows.push({
                id: `inv-${inv.id}`,
                date: inv.paidAt ? new Date(inv.paidAt) : (inv.dueDate ? new Date(inv.dueDate) : new Date()),
                label: inv.month ? `Rent — ${inv.month}` : `Rent Invoice ${inv.displayId}`,
                amount: inv.amount,
                status: inv.status,
                type: 'INVOICE',
                receiptId: inv.status === 'PAID' ? inv.id : undefined,
            });
        });

        // Raw payment attempts (failed, pending, refunded — not already in invoices)
        const invoicePaymentIds = new Set(invoices.flatMap(i => i.payments.map(p => p.id)));
        rawPayments
            .filter(p => !invoicePaymentIds.has(p.id) && (p.status === 'FAILED' || p.status === 'PENDING' || p.status === 'REFUNDED'))
            .forEach(p => {
                rows.push({
                    id: `pay-${p.id}`,
                    date: new Date(p.date),
                    label: p.invoiceId ? `Rent Payment Attempt` : p.depositId ? `Deposit Payment Attempt` : `Payment Attempt`,
                    amount: p.amount,
                    status: p.status,
                    type: 'PAYMENT',
                    txId: p.razorpayId || p.razorpayOrderId,
                });
            });

        return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [booking, invoices, rawPayments, depositInfo]);

    // ─── Booking year label ───────────────────────────────────────────────────
    function bookingLabel(d: BookingEntry) {
        const yr = new Date(d.booking.createdAt).getFullYear();
        const isActive = d.booking.status === 'ACTIVE';
        const hasToken = !!d.booking.tokenPaidAt;
        const tag = isActive ? ' · Active' : hasToken ? ' · Past' : '';
        return `${d.booking.propertyName} — ${d.booking.displayId} (${yr})${tag}`;
    }

    if (!data.length) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 flex flex-col">
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-4 pt-10 pb-16 relative overflow-hidden">
                    <div className="max-w-4xl mx-auto relative z-10">
                        <Link href="/dashboard/student" className="text-indigo-200 text-xs font-bold flex items-center gap-1 mb-4 hover:text-white transition-colors">
                            ← Back to Dashboard
                        </Link>
                        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Payment History</h1>
                        <p className="text-indigo-200 text-sm font-medium mt-1">Your complete rent ledger and receipts</p>
                    </div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-500 font-bold">No bookings found</p>
                        <p className="text-slate-400 text-sm mt-1">Book a PG to see your payment history here.</p>
                    </div>
                </div>
            </div>
        );
    }

    // Only show bookings that have token paid OR are active/completed (meaningful ones)
    const meaningfulBookings = data.filter(d =>
        d.booking.tokenPaidAt ||
        ['ACTIVE', 'COMPLETED', 'MOVE_IN_SCHEDULED', 'BOOKING_CONFIRMED', 'PHYSICAL_VERIFIED'].includes(d.booking.status)
    );
    const dropdownOptions = meaningfulBookings.length > 0 ? meaningfulBookings : data;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            {/* ── Header ── */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-4 pt-10 pb-20 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('/noise.png')] opacity-5" />
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute -left-10 bottom-0 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
                <div className="max-w-4xl mx-auto relative z-10">
                    <Link href="/dashboard/student" className="text-indigo-200 text-xs font-bold flex items-center gap-1 mb-4 hover:text-white transition-colors">
                        ← Back to Dashboard
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Payment History</h1>
                    <p className="text-indigo-200 text-sm font-medium mt-1">Your complete rent ledger and receipts</p>

                    {/* ── PG / Booking Selector ── */}
                    <div className="mt-5 relative max-w-sm">
                        <label className="block text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1.5">
                            Viewing payments for
                        </label>
                        <button
                            id="pg-selector-btn"
                            onClick={() => setDropdownOpen(v => !v)}
                            className="w-full flex items-center justify-between gap-2 bg-white/15 hover:bg-white/25 backdrop-blur border border-white/20 rounded-xl px-4 py-3 text-white text-sm font-bold transition-all"
                        >
                            <span className="flex items-center gap-2 truncate">
                                <Building2 className="w-4 h-4 text-indigo-200 shrink-0" />
                                <span className="truncate">
                                    {selected ? bookingLabel(selected) : "Select a PG..."}
                                </span>
                            </span>
                            <ChevronDown className={`w-4 h-4 text-indigo-200 shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {dropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-50">
                                {dropdownOptions.map(d => {
                                    const isActive = d.booking.status === 'ACTIVE';
                                    const isSelected = d.booking.id === selectedId;
                                    return (
                                        <button
                                            key={d.booking.id}
                                            onClick={() => { setSelectedId(d.booking.id); setDropdownOpen(false); }}
                                            className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0 ${isSelected ? 'bg-indigo-50' : ''}`}
                                        >
                                            <Building2 className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                                            <div className="min-w-0">
                                                <p className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-700' : 'text-slate-800'}`}>
                                                    {d.booking.propertyName}
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                    {d.booking.displayId} · {new Date(d.booking.createdAt).getFullYear()}
                                                    {isActive && <span className="ml-1.5 text-emerald-600 font-bold">● Active</span>}
                                                    {!isActive && d.booking.completedAt && <span className="ml-1.5 text-slate-400 font-bold">✓ Vacated</span>}
                                                </p>
                                            </div>
                                            {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 ml-auto mt-0.5" />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 -mt-10 relative z-10 space-y-5">
                {/* ── Summary Cards ── */}
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
                        <p className="text-base font-black text-slate-900 mt-0.5">
                            {currentInvoice ? currentInvoice.status : '—'}
                        </p>
                    </div>

                    <div className="bg-white rounded-2xl p-4 shadow-lg shadow-indigo-100/50 border border-slate-100">
                        <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
                            <Calendar className="w-4 h-4 text-purple-600" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Next Due</p>
                        <p className="text-sm font-black text-slate-900 mt-0.5">
                            {nextDue?.dueDate ? format(new Date(nextDue.dueDate), 'dd MMM') : '—'}
                        </p>
                    </div>

                    <div className="bg-white rounded-2xl p-4 shadow-lg shadow-indigo-100/50 border border-slate-100">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${depositInfo?.status === 'PAID' ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                            <Shield className={`w-4 h-4 ${depositInfo?.status === 'PAID' ? 'text-emerald-600' : 'text-slate-400'}`} />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security Deposit</p>
                        <p className="text-sm font-black text-slate-900 mt-0.5">
                            {depositInfo ? `₹${depositInfo.amount.toLocaleString('en-IN')} ${depositInfo.status === 'PAID' ? '✓' : ''}` : '—'}
                        </p>
                    </div>
                </div>

                {/* ── Booking context strip ── */}
                {booking && (
                    <div className="bg-white rounded-2xl px-5 py-3.5 shadow-sm border border-slate-100 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="font-bold text-slate-700">{booking.propertyName}</span>
                        </span>
                        <span>Booking ID: <span className="font-bold text-slate-700">{booking.displayId}</span></span>
                        {booking.roomAssigned && (
                            <span>Room: <span className="font-bold text-slate-700">{booking.roomAssigned}</span></span>
                        )}
                        <span>Status: <span className={`font-bold ${booking.status === 'ACTIVE' ? 'text-emerald-600' : 'text-slate-500'}`}>{booking.status.replace(/_/g, ' ')}</span></span>
                        {booking.activeAt && (
                            <span>Move-in: <span className="font-bold text-slate-700">{format(new Date(booking.activeAt), 'dd MMM yyyy')}</span></span>
                        )}
                        {booking.completedAt && (
                            <span>Vacated: <span className="font-bold text-slate-700">{format(new Date(booking.completedAt), 'dd MMM yyyy')}</span></span>
                        )}
                    </div>
                )}

                {/* ── Complete Ledger Table ── */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                        <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <IndianRupee className="w-4 h-4 text-indigo-600" /> Complete Payment Ledger
                        </h2>
                        <span className="text-xs text-slate-400 font-bold">{ledgerRows.length} records</span>
                    </div>

                    {ledgerRows.length === 0 ? (
                        <div className="py-16 text-center">
                            <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <p className="text-sm font-bold text-slate-400">No payment records yet</p>
                            <p className="text-xs text-slate-300 mt-1">
                                {booking?.tokenPaidAt
                                    ? "Invoices will appear once your tenancy starts."
                                    : "Pay the token to see payment history here."}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                                            <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Description</th>
                                            <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Type</th>
                                            <th className="text-right px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</th>
                                            <th className="text-center px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                            <th className="text-center px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Receipt</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ledgerRows.map(row => (
                                            <tr key={row.id} className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors">
                                                <td className="px-5 py-4 text-slate-500 text-xs font-bold whitespace-nowrap">
                                                    {format(row.date, 'dd MMM yyyy')}
                                                </td>
                                                <td className="px-5 py-4 font-semibold text-slate-700 text-xs max-w-[200px]">
                                                    <span className="line-clamp-2">{row.label}</span>
                                                    {row.txId && (
                                                        <span className="block text-[9px] text-slate-400 font-mono mt-0.5 truncate max-w-[180px]">
                                                            Ref: {row.txId}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <PaymentTypeBadge type={row.type} />
                                                </td>
                                                <td className="px-5 py-4 text-right font-black text-slate-900">
                                                    ₹{row.amount.toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <StatusBadge status={row.status} />
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    {row.receiptId ? (
                                                        <a
                                                            href={`/api/receipts/${row.receiptId}`}
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

                            {/* Mobile */}
                            <div className="md:hidden divide-y divide-slate-50">
                                {ledgerRows.map(row => (
                                    <div key={row.id} className="p-4 flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="text-xs font-bold text-slate-800 line-clamp-1">{row.label}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <StatusBadge status={row.status} />
                                                <PaymentTypeBadge type={row.type} />
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-1 font-bold">
                                                {format(row.date, 'dd MMM yyyy')}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                            <span className="text-sm font-black text-slate-900">₹{row.amount.toLocaleString('en-IN')}</span>
                                            {row.receiptId && (
                                                <a
                                                    href={`/api/receipts/${row.receiptId}`}
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

                {/* Footer */}
                <p className="text-center text-xs text-slate-400 font-medium pb-4">
                    Receipts are generated automatically for paid invoices. For disputes, raise a ticket.
                </p>
            </div>
        </div>
    );
}
