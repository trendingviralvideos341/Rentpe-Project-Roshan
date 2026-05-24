"use client";

import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import {
    FileText, CheckCircle2, Clock, AlertTriangle, Minus, TrendingUp,
    Calendar, Shield, IndianRupee, ChevronDown, Building2,
    Tag, CreditCard, Home, ArrowLeft
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
    // Priority 2: Any booking with token paid that is NOT completed/vacated
    const tokenPaidNotDone = data.find(d =>
        d.booking.tokenPaidAt && !d.booking.completedAt && !['CHECKED_OUT', 'CANCELLED', 'REJECTED'].includes(d.booking.status)
    );
    if (tokenPaidNotDone) return tokenPaidNotDone.booking.id;
    // Priority 3: Most recent booking with token paid
    const anyTokenPaid = data.find(d => d.booking.tokenPaidAt);
    if (anyTokenPaid) return anyTokenPaid.booking.id;
    // Priority 4: Most recent booking
    return data[0].booking.id;
}

// ─── Label for dropdown entry ─────────────────────────────────────────────────
function bookingLabel(d: BookingEntry) {
    const yr = new Date(d.booking.createdAt).getFullYear();
    const isActive   = d.booking.status === 'ACTIVE';
    const isVacated  = !!d.booking.completedAt || ['CHECKED_OUT', 'CANCELLED', 'REJECTED'].includes(d.booking.status);
    const hasToken   = !!d.booking.tokenPaidAt;

    let tag = '';
    if (isActive)           tag = ' · Current';
    else if (isVacated)     tag = ' · Past';
    else if (hasToken)      tag = ' · Current';

    return `${d.booking.propertyName} — ${d.booking.displayId} (${yr})${tag}`;
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
        TOKEN:    { label: "Token",   icon: <Tag className="w-3 h-3" />,        cls: "bg-violet-50 text-violet-700 border-violet-100" },
        INVOICE:  { label: "Rent",    icon: <Home className="w-3 h-3" />,       cls: "bg-indigo-50 text-indigo-700 border-indigo-100" },
        DEPOSIT:  { label: "Deposit", icon: <Shield className="w-3 h-3" />,     cls: "bg-teal-50 text-teal-700 border-teal-100" },
        PAYMENT:  { label: "Payment", icon: <CreditCard className="w-3 h-3" />, cls: "bg-slate-50 text-slate-600 border-slate-100" },
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

    // Reset to default (current PG) on every mount / navigation
    useEffect(() => {
        setSelectedId(findCurrentBooking(data));
    }, [data]);

    // Close dropdown on outside click
    useEffect(() => {
        if (!dropdownOpen) return;
        const handler = () => setDropdownOpen(false);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [dropdownOpen]);

    const selected = useMemo(
        () => data.find(d => d.booking.id === selectedId) || data[0] || null,
        [selectedId, data]
    );

    const { invoices, rawPayments, depositInfo, booking } = selected || {
        invoices: [], rawPayments: [], depositInfo: null, booking: null
    };

    // ─── Summary stats ────────────────────────────────────────────────────────
    const currentYear = new Date().getFullYear();
    const fyStart = new Date(currentYear, 3, 1);
    const fyEnd   = new Date(currentYear + 1, 2, 31);

    // Include token amount in FY total if paid
    const tokenPaidFY = (booking?.tokenPaidAt &&
        new Date(booking.tokenPaidAt) >= fyStart &&
        new Date(booking.tokenPaidAt) <= fyEnd)
        ? (booking.tokenAmount || 0) : 0;

    const invoicePaidFY = invoices
        .filter(i => i.status === 'PAID' && i.paidAt && new Date(i.paidAt) >= fyStart && new Date(i.paidAt) <= fyEnd)
        .reduce((sum, i) => sum + i.amount, 0);

    const totalPaid = tokenPaidFY + invoicePaidFY;

    const now = new Date();
    const currentInvoice = invoices.find(i => {
        if (!i.dueDate) return false;
        const due = new Date(i.dueDate);
        return due.getMonth() === now.getMonth() && due.getFullYear() === now.getFullYear();
    });
    const nextDue = invoices.find(i => i.status === 'PENDING' && i.dueDate && new Date(i.dueDate) >= now);

    // ─── Combined ledger rows ─────────────────────────────────────────────────
    type LedgerRow = {
        id: string; date: Date; label: string; amount: number;
        status: string; type: string; receiptHref?: string; txId?: string | null;
    };

    const ledgerRows = useMemo((): LedgerRow[] => {
        const rows: LedgerRow[] = [];

        // 1. Token payment
        if (booking?.tokenPaidAt) {
            rows.push({
                id: `token-${booking.id}`,
                date: new Date(booking.tokenPaidAt),
                label: `Token Payment — ${booking.propertyName}`,
                amount: booking.tokenAmount,
                status: 'SUCCESS',
                type: 'TOKEN',
                receiptHref: `/api/receipts/token/${booking.id}`,
                txId: booking.tokenPaymentId,
            });
        }

        // 2. Security deposit
        if (depositInfo) {
            rows.push({
                id: `deposit-${depositInfo.id}`,
                date: depositInfo.paidAt
                    ? new Date(depositInfo.paidAt)
                    : booking?.activeAt ? new Date(booking.activeAt) : new Date(),
                label: `Security Deposit — ${booking?.propertyName}`,
                amount: depositInfo.amount,
                status: depositInfo.status === 'PAID' ? 'SUCCESS' : depositInfo.status,
                type: 'DEPOSIT',
            });
        }

        // 3. Monthly rent invoices
        invoices.forEach(inv => {
            rows.push({
                id: `inv-${inv.id}`,
                date: inv.paidAt
                    ? new Date(inv.paidAt)
                    : inv.dueDate ? new Date(inv.dueDate) : new Date(),
                label: inv.month ? `Rent — ${inv.month}` : `Rent Invoice ${inv.displayId}`,
                amount: inv.amount,
                status: inv.status,
                type: 'INVOICE',
                receiptHref: inv.status === 'PAID' ? `/api/receipts/${inv.id}` : undefined,
            });
        });

        // 4. Only FAILED or REFUNDED raw payment attempts (NOT PENDING — those are just abandoned Razorpay orders)
        const invoicePaymentIds = new Set(invoices.flatMap(i => i.payments.map(p => p.id)));
        rawPayments
            .filter(p =>
                !invoicePaymentIds.has(p.id) &&
                (p.status === 'FAILED' || p.status === 'REFUNDED')
            )
            .forEach(p => {
                rows.push({
                    id: `pay-${p.id}`,
                    date: new Date(p.date),
                    label: p.invoiceId ? `Rent Payment — Failed` : p.depositId ? `Deposit Payment — Failed` : `Payment — Failed`,
                    amount: p.amount,
                    status: p.status,
                    type: 'PAYMENT',
                    txId: p.razorpayId || p.razorpayOrderId,
                });
            });

        return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [booking, invoices, rawPayments, depositInfo]);

    // Only show bookings with token paid or that are active/completed
    const meaningfulBookings = data.filter(d =>
        d.booking.tokenPaidAt ||
        ['ACTIVE', 'COMPLETED', 'MOVE_IN_SCHEDULED', 'BOOKING_CONFIRMED', 'PHYSICAL_VERIFIED', 'ROOM_RESERVED'].includes(d.booking.status)
    );
    const dropdownOptions = meaningfulBookings.length > 0 ? meaningfulBookings : data;

    if (!data.length) {
        return (
            <div className="-mx-4 -mt-4 md:-mx-8 md:-mt-8 min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 flex flex-col">
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-4 pt-10 pb-16 relative">
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                    </div>
                    <div className="max-w-4xl mx-auto relative z-10">
                        <Link href="/dashboard/student"
                            className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-4 py-2 rounded-full mb-5 transition-all border border-white/30 backdrop-blur-sm">
                            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
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

    return (
        <div className="-mx-4 -mt-4 md:-mx-8 md:-mt-8 min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">

            {/* ── Compact Header ── */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-4 pt-5 pb-6 relative" style={{ zIndex: 20 }}>
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                </div>

                <div className="max-w-4xl mx-auto relative" style={{ zIndex: 10 }}>
                    {/* Top row: back button + PG selector */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <Link
                            href="/dashboard/student"
                            className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/35 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-all border border-white/30 backdrop-blur-sm"
                        >
                            <ArrowLeft className="w-3 h-3" /> Back
                        </Link>

                        {/* PG Selector */}
                        <div style={{ position: 'relative', zIndex: 100 }}>
                            <button
                                id="pg-selector-btn"
                                onClick={(e) => { e.stopPropagation(); setDropdownOpen(v => !v); }}
                                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur border border-white/30 rounded-full px-3 py-1.5 text-white text-xs font-bold transition-all"
                            >
                                <Building2 className="w-3 h-3 text-indigo-200 shrink-0" />
                                <span className="truncate max-w-[180px] md:max-w-sm">
                                    {selected ? bookingLabel(selected) : "Select a PG..."}
                                </span>
                                <ChevronDown className={`w-3 h-3 text-white shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {dropdownOpen && (
                                <div
                                    className="absolute right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
                                    style={{ zIndex: 999, top: '100%', minWidth: '280px' }}
                                    onClick={e => e.stopPropagation()}
                                >
                                    {dropdownOptions.map(d => {
                                        const isVacated  = !!d.booking.completedAt || ['CHECKED_OUT', 'CANCELLED', 'REJECTED'].includes(d.booking.status);
                                        const isCurrent  = !isVacated && (d.booking.status === 'ACTIVE' || !!d.booking.tokenPaidAt);
                                        const isSelected = d.booking.id === selectedId;
                                        return (
                                            <button
                                                key={d.booking.id}
                                                onClick={() => { setSelectedId(d.booking.id); setDropdownOpen(false); }}
                                                className={`w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0 ${isSelected ? 'bg-indigo-50' : ''}`}
                                            >
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600' : isCurrent ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                                                    <Building2 className={`w-4 h-4 ${isSelected ? 'text-white' : isCurrent ? 'text-indigo-600' : 'text-slate-400'}`} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-700' : 'text-slate-800'}`}>
                                                        {d.booking.propertyName}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                                                        <span>{d.booking.displayId}</span>
                                                        <span>·</span>
                                                        <span>{new Date(d.booking.createdAt).getFullYear()}</span>
                                                        {isCurrent && !isVacated && (
                                                            <span className="text-emerald-600 font-bold">● Current</span>
                                                        )}
                                                        {isVacated && (
                                                            <span className="text-slate-400 font-bold">✓ Past</span>
                                                        )}
                                                    </p>
                                                </div>
                                                {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Title row */}
                    <div className="mt-3">
                        <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">Payment History</h1>
                        <p className="text-indigo-200 text-xs font-medium mt-0.5">Your complete rent ledger and receipts</p>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 mt-5 relative space-y-5" style={{ zIndex: 10 }}>
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
                            currentInvoice?.status === 'PAID'   ? 'bg-emerald-100' :
                            currentInvoice?.status === 'OVERDUE' ? 'bg-red-100' :
                            booking?.tokenPaidAt                  ? 'bg-emerald-100' : 'bg-amber-100'
                        }`}>
                            {currentInvoice?.status === 'PAID' || (!currentInvoice && booking?.tokenPaidAt)
                                ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                : currentInvoice?.status === 'OVERDUE'
                                    ? <AlertTriangle className="w-4 h-4 text-red-600" />
                                    : <Clock className="w-4 h-4 text-amber-600" />
                            }
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">This Month</p>
                        <p className="text-base font-black text-slate-900 mt-0.5">
                            {currentInvoice
                                ? currentInvoice.status
                                : booking?.tokenPaidAt
                                    ? 'Token Paid'
                                    : '—'}
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
                        <span className={`font-bold ${booking.status === 'ACTIVE' ? 'text-emerald-600' : 'text-slate-500'}`}>
                            {booking.status.replace(/_/g, ' ')}
                        </span>
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
                            {/* Desktop Table */}
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
                                                <td className="px-5 py-4 font-semibold text-slate-700 text-xs max-w-[220px]">
                                                    <span>{row.label}</span>
                                                    {row.txId && (
                                                        <span className="block text-[9px] text-slate-400 font-mono mt-0.5 truncate max-w-[200px]">
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
                                                    {row.receiptHref ? (
                                                        <a
                                                            href={row.receiptHref}
                                                            target="_blank"
                                                            rel="noreferrer"
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
                                {ledgerRows.map(row => (
                                    <div key={row.id} className="p-4 flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <span className="text-xs font-bold text-slate-800 block mb-1">{row.label}</span>
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
                                            {row.receiptHref && (
                                                <a
                                                    href={row.receiptHref}
                                                    target="_blank"
                                                    rel="noreferrer"
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
