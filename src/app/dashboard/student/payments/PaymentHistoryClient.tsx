"use client";

import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import {
    FileText, CheckCircle2, Clock, AlertTriangle, Minus, TrendingUp,
    Calendar, Shield, IndianRupee, ChevronDown, Building2,
    Tag, CreditCard, Home, ArrowLeft, X, Download
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
        guestName: string; guestEmail: string | null; guestPhone: string | null;
        agreementSigned: boolean; agreementSignedAt: Date | string | null; moveInDate: string | null;
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

// ─── Deposit Receipt Modal ────────────────────────────────────────────────────
function DepositReceiptModal({ booking, depositInfo, rawPayments, onClose }: {
    booking: any; depositInfo: any; rawPayments: RawPayment[]; onClose: () => void;
}) {
    const now = new Date();
    const depositInvoiceId = `DEP-INV-${depositInfo?.id?.slice(-8).toUpperCase() || 'XXXXXXXX'}`;
    const receiptNo = `DEP-${depositInfo?.id?.slice(-6).toUpperCase() || 'XXXXXX'}`;
    // Download URL: joining payment / deposit receipts use the token route as fallback
    const depositPdfUrl = booking?.id ? `/api/receipts/token/${booking.id}?download=1` : null;
    const paidDate = depositInfo?.paidAt
        ? new Date(depositInfo.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
        : booking?.agreementSignedAt
            ? new Date(booking.agreementSignedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
            : booking?.activeAt
                ? new Date(booking.activeAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
                : '—';
    const isPaid = depositInfo?.status === 'PAID';

    // Find the deposit payment first (has depositId matching depositInfo.id)
    const depositPayment = rawPayments.find(
        p => p.depositId === depositInfo?.id && (p.status === 'VERIFIED' || p.status === 'SUCCESS')
    );
    // Fallback: joining payment (no invoiceId, no depositId)
    const joiningPayment = depositPayment || rawPayments.find(
        p => !p.invoiceId && !p.depositId && (p.status === 'VERIFIED' || p.status === 'SUCCESS')
    );
    // Also check any verified payment for this booking
    const anyVerifiedPayment = joiningPayment || rawPayments.find(
        p => p.status === 'VERIFIED' || p.status === 'SUCCESS'
    );
    const txId = anyVerifiedPayment?.razorpayId || anyVerifiedPayment?.razorpayOrderId || null;
    const rawMethod = anyVerifiedPayment?.method || booking?.paymentMethod || null;
    const paymentMode = rawMethod === 'CASH' ? 'Cash'
        : rawMethod === 'ONLINE' ? 'Online (Razorpay)'
        : rawMethod ? rawMethod : '—';

    // Extract room number and bed number from roomAssigned (format: "Room 102 — Bed A" or "102")
    const roomAssigned = booking?.roomAssigned || '';
    const roomParts = roomAssigned.split('—');
    const roomDisplay = roomParts[0]?.replace(/room/i, '').trim() || roomAssigned || '—';
    const bedDisplay = roomParts[1]?.replace(/bed/i, '').trim() || null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md my-4 overflow-y-auto max-h-[92vh] print:shadow-none print:max-h-none">
                {/* Header */}
                <div className="bg-gradient-to-br from-teal-600 to-indigo-700 p-6 text-white relative overflow-hidden">
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
                    <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-xl transition-all z-10 print:hidden">
                        <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3 mb-3 relative z-10">
                        <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-teal-200">Security Deposit Receipt</p>
                            <p className="font-black text-lg">{receiptNo}</p>
                        </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full relative z-10 ${
                        isPaid ? 'bg-emerald-500/30 border border-emerald-400/40 text-emerald-100' : 'bg-amber-500/30 border border-amber-400/40 text-amber-100'
                    }`}>
                        {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {isPaid ? 'Held by Owner' : 'Pending'}
                    </span>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {/* Room + Type strip at top */}
                    {roomAssigned && (
                        <div className="flex gap-3">
                            <div className="flex-1 bg-slate-50 rounded-xl p-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Room</p>
                                <p className="text-sm font-black text-slate-800">{roomDisplay}</p>
                            </div>
                            {bedDisplay && (
                                <div className="flex-1 bg-slate-50 rounded-xl p-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Bed</p>
                                    <p className="text-sm font-black text-slate-800">{bedDisplay}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tenant */}
                    <div className="bg-slate-50 rounded-2xl p-4 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tenant Details</p>
                        <p className="font-black text-slate-900 text-base">{booking?.guestName || '—'}</p>
                        {booking?.guestPhone && <p className="text-sm text-slate-500">{booking.guestPhone}</p>}
                        {booking?.guestEmail && <p className="text-sm text-slate-400">{booking.guestEmail}</p>}
                        {booking?.roomAssigned && <p className="text-sm text-slate-400">Room: {booking.roomAssigned}</p>}
                        {(booking?.agreementSignedAt || booking?.activeAt) && (
                            <p className="text-sm text-slate-400">Stay from: <span className="font-bold text-slate-700">{new Date(booking.agreementSignedAt || booking.activeAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></p>
                        )}
                    </div>

                    {/* Reference IDs */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-teal-500 mb-1">Deposit Invoice ID</p>
                            <p className="text-xs font-mono font-black text-teal-700">{depositInvoiceId}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Booking ID</p>
                            <p className="text-xs font-mono font-black text-slate-700">{booking?.displayId || '—'}</p>
                        </div>
                    </div>

                    {/* Tenant ID */}
                    {booking?.guestPhone && (
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tenant ID</p>
                            <p className="text-xs font-mono font-black text-slate-700">
                                {`RP-TN-${booking.guestPhone.replace(/\D/g, '').slice(-10)}`}
                            </p>
                        </div>
                    )}

                    {/* Transaction ID — always show, with fallback */}
                    <div className={`rounded-xl p-3 ${txId ? 'bg-indigo-50 border border-indigo-100' : 'bg-amber-50 border border-amber-100'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${txId ? 'text-indigo-400' : 'text-amber-500'}`}>Transaction ID (Razorpay)</p>
                        <p className={`text-xs font-mono font-bold break-all ${txId ? 'text-indigo-700' : 'text-amber-600 italic'}`}>
                            {txId || 'Pending / Not yet captured'}
                        </p>
                    </div>

                    {/* Breakdown */}
                    <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                        <div className="flex justify-between items-center px-4 py-3">
                            <div>
                                <p className="text-sm font-black text-slate-800">Security Deposit</p>
                                <p className="text-xs text-slate-400">One-time refundable deposit</p>
                            </div>
                            <p className="font-black text-slate-900">₹{(depositInfo?.amount || 0).toLocaleString('en-IN')}</p>
                        </div>
                        {booking?.amount > 0 && (
                            <div className="flex justify-between items-center px-4 py-3 bg-indigo-50/50">
                                <div>
                                    <p className="text-sm font-black text-slate-800">First Month Rent</p>
                                    <p className="text-xs text-slate-400">Paid at joining</p>
                                </div>
                                <p className="font-black text-indigo-700">₹{(booking.amount || 0).toLocaleString('en-IN')}</p>
                            </div>
                        )}
                        <div className="flex justify-between items-center px-4 py-3 bg-slate-50">
                            <p className="text-sm font-black text-slate-600">Total Collected at Joining</p>
                            <p className="font-black text-lg text-slate-900">₹{((depositInfo?.amount || 0) + (booking?.amount || 0)).toLocaleString('en-IN')}</p>
                        </div>
                    </div>

                    {/* Meta */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Paid On</p>
                            <p className="text-sm font-black text-slate-700">{paidDate}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Payment Mode</p>
                            <p className="text-sm font-black text-slate-700">{paymentMode}</p>
                        </div>
                    </div>

                    {/* Legal terms and disclaimer */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1.5 text-[10px] text-slate-500 leading-relaxed">
                        <p className="font-bold text-slate-700 uppercase tracking-wider text-[9px]">Terms of Deposit Refund</p>
                        <p>1. This deposit is held by the property owner and is fully refundable at the time of vacating, subject to checking out as per the lease terms.</p>
                        <p>2. Deductions may apply for unpaid utility bills, rent arrears, notice period defaults, or physical damages to the room/property beyond normal wear and tear.</p>
                        <p className="text-[9px] italic text-slate-400 mt-1">This is a computer-generated confirmation receipt. Signature not required. Subject to the realization of online payments.</p>
                    </div>

                    <p className="text-center text-[10px] text-slate-300 font-bold tracking-wider uppercase">
                        RentPe Ecosystem • Prop-Tech OS for Modern Living • support@rentpe.in
                    </p>

                    <div className="flex gap-3">
                        {depositPdfUrl ? (
                            <a
                                href={depositPdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-teal-600 hover:bg-teal-700 text-white font-black text-sm rounded-2xl transition-all"
                            >
                                <Download className="w-4 h-4" /> Download PDF
                            </a>
                        ) : null}
                        <button onClick={onClose} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm rounded-2xl transition-all">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Client Component ─────────────────────────────────────────────────────
// ─── Rent Receipt Modal ───────────────────────────────────────────────────────
function RentReceiptModal({ booking, invoice, onClose }: {
    booking: any; invoice: any; onClose: () => void;
}) {
    const receiptNo = invoice?.displayId || `INV-${invoice?.id?.slice(-8).toUpperCase() || 'XXXXXXXX'}`;
    // Direct PDF API URL — opens the 2-page HRA + Tax Invoice PDF
    const rentPdfUrl = invoice?.id ? `/api/receipts/${invoice.id}?download=1` : null;
    const paidDate = invoice?.paidAt
        ? new Date(invoice.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—';
    const dueDate = invoice?.dueDate
        ? new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

    // Find verified payment
    const payment = invoice?.payments?.find((p: any) => p.status === 'VERIFIED' || p.status === 'SUCCESS') || invoice?.payments?.[0];
    const txId = payment?.razorpayId || payment?.razorpayOrderId || null;
    const rawMethod = invoice?.paymentMethod || payment?.method || booking?.paymentMethod || null;
    const paymentMode = rawMethod === 'CASH' ? 'Cash'
        : rawMethod === 'ONLINE' ? 'Online (Razorpay)'
        : rawMethod ? rawMethod : '—';

    // Extract room number and bed number from roomAssigned
    const roomAssigned = booking?.roomAssigned || '';
    const roomParts = roomAssigned.split('—');
    const roomDisplay = roomParts[0]?.replace(/room/i, '').trim() || roomAssigned || '—';
    const bedDisplay = roomParts[1]?.replace(/bed/i, '').trim() || null;

    // Financial calculations
    const rentAmount = Number(invoice?.rentAmount || invoice?.amount || 0);
    const foodAmount = Number(invoice?.foodAmount || 0);
    const creditApplied = Number(invoice?.creditApplied || 0);
    const totalAmount = Number(invoice?.amount || 0);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md my-4 overflow-y-auto max-h-[92vh] print:shadow-none print:max-h-none">
                {/* Header */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white relative overflow-hidden">
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
                    <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-xl transition-all z-10 print:hidden">
                        <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3 mb-3 relative z-10">
                        <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Home className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-indigo-200">Rent Receipt</p>
                            <p className="font-black text-lg">{receiptNo}</p>
                        </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full relative z-10 bg-emerald-500/30 border border-emerald-400/40 text-emerald-100">
                        <CheckCircle2 className="w-3 h-3" /> Paid
                    </span>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {/* Room + Type strip at top */}
                    {roomAssigned && (
                        <div className="flex gap-3">
                            <div className="flex-1 bg-slate-50 rounded-xl p-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Room</p>
                                <p className="text-sm font-black text-slate-800">{roomDisplay}</p>
                            </div>
                            {bedDisplay && (
                                <div className="flex-1 bg-slate-50 rounded-xl p-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Bed</p>
                                    <p className="text-sm font-black text-slate-800">{bedDisplay}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tenant */}
                    <div className="bg-slate-50 rounded-2xl p-4 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tenant Details</p>
                        <p className="font-black text-slate-900 text-base">{booking?.guestName || '—'}</p>
                        {booking?.guestPhone && <p className="text-sm text-slate-500">{booking.guestPhone}</p>}
                        {booking?.guestEmail && <p className="text-sm text-slate-400">{booking.guestEmail}</p>}
                        {booking?.roomAssigned && <p className="text-sm text-slate-400">Room: {booking.roomAssigned}</p>}
                        {(booking?.agreementSignedAt || booking?.activeAt) && (
                            <p className="text-sm text-slate-400">Stay from: <span className="font-bold text-slate-700">{new Date(booking.agreementSignedAt || booking.activeAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></p>
                        )}
                    </div>

                    {/* Reference IDs */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-1">Billing Month</p>
                            <p className="text-xs font-mono font-black text-indigo-700">{invoice?.month || '—'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Booking ID</p>
                            <p className="text-xs font-mono font-black text-slate-700">{booking?.displayId || '—'}</p>
                        </div>
                    </div>

                    {/* Tenant ID */}
                    {booking?.guestPhone && (
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tenant ID</p>
                            <p className="text-xs font-mono font-black text-slate-700">
                                {`RP-TN-${booking.guestPhone.replace(/\D/g, '').slice(-10)}`}
                            </p>
                        </div>
                    )}

                    {/* Transaction ID */}
                    <div className={`rounded-xl p-3 ${txId ? 'bg-indigo-50 border border-indigo-100' : 'bg-amber-50 border border-amber-100'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${txId ? 'text-indigo-400' : 'text-amber-500'}`}>Transaction ID (Razorpay)</p>
                        <p className={`text-xs font-mono font-bold break-all ${txId ? 'text-indigo-700' : 'text-amber-600 italic'}`}>
                            {txId || 'Captured / Online Confirmation'}
                        </p>
                    </div>

                    {/* Breakdown */}
                    <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                        <div className="flex justify-between items-center px-4 py-3">
                            <div>
                                <p className="text-sm font-black text-slate-800">Rent Amount</p>
                                <p className="text-xs text-slate-400">Monthly accommodation rent</p>
                            </div>
                            <p className="font-black text-slate-900">₹{rentAmount.toLocaleString('en-IN')}</p>
                        </div>
                        {foodAmount > 0 && (
                            <div className="flex justify-between items-center px-4 py-3">
                                <div>
                                    <p className="text-sm font-black text-slate-800">Food Charges</p>
                                    <p className="text-xs text-slate-400">Monthly meal services</p>
                                </div>
                                <p className="font-black text-slate-900">₹{foodAmount.toLocaleString('en-IN')}</p>
                            </div>
                        )}
                        {creditApplied > 0 && (
                            <div className="flex justify-between items-center px-4 py-3 bg-emerald-50/50">
                                <div>
                                    <p className="text-sm font-black text-emerald-800">Credit Applied</p>
                                    <p className="text-xs text-emerald-500">Discount or adjustment</p>
                                </div>
                                <p className="font-black text-emerald-700">-₹{creditApplied.toLocaleString('en-IN')}</p>
                            </div>
                        )}
                        <div className="flex justify-between items-center px-4 py-3 bg-slate-50">
                            <p className="text-sm font-black text-slate-600">Total Paid</p>
                            <p className="font-black text-lg text-slate-900">₹{totalAmount.toLocaleString('en-IN')}</p>
                        </div>
                    </div>

                    {/* Meta */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Paid On</p>
                            <p className="text-sm font-black text-slate-700">{paidDate}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Payment Mode</p>
                            <p className="text-sm font-black text-slate-700">{paymentMode}</p>
                        </div>
                    </div>

                    {/* Legal terms and disclaimer */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1.5 text-[10px] text-slate-500 leading-relaxed">
                        <p className="font-bold text-slate-700 uppercase tracking-wider text-[9px]">Important Information</p>
                        <p>1. This receipt confirms realization of monthly rent/charges for the period specified above.</p>
                        <p>2. Rent is due on or before the due date. Late payment charges may apply for delayed dues as per standard terms.</p>
                        <p className="text-[9px] italic text-slate-400 mt-1">This is a computer-generated confirmation receipt. Signature not required. Subject to the realization of online payments.</p>
                    </div>

                    <p className="text-center text-[10px] text-slate-300 font-bold tracking-wider uppercase">
                        RentPe Ecosystem • Prop-Tech OS for Modern Living • support@rentpe.in
                    </p>

                    <div className="flex gap-3">
                        {rentPdfUrl ? (
                            <a
                                href={rentPdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl transition-all"
                            >
                                <Download className="w-4 h-4" /> Download PDF
                            </a>
                        ) : null}
                        <button onClick={onClose} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm rounded-2xl transition-all">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Token Receipt Modal ──────────────────────────────────────────────────────
function TokenReceiptModal({ booking, onClose }: {
    booking: any; onClose: () => void;
}) {
    const receiptNo = `TKN-RP-${booking?.displayId || 'XXXXXX'}`;
    // Direct PDF API URL — opens the professional token receipt PDF
    const tokenPdfUrl = booking?.id ? `/api/receipts/token/${booking.id}?download=1` : null;
    const paidDate = booking?.tokenPaidAt
        ? new Date(booking.tokenPaidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—';

    const txId = booking?.tokenPaymentId || null;
    const rawMethod = booking?.paymentMethod || null;
    const paymentMode = rawMethod === 'CASH' ? 'Cash'
        : rawMethod === 'ONLINE' ? 'Online (Razorpay)'
        : rawMethod ? rawMethod : '—';

    // Financial calculations
    const tokenAmount = Number(booking?.tokenAmount || 1000);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md my-4 overflow-y-auto max-h-[92vh] print:shadow-none print:max-h-none">
                {/* Header */}
                <div className="bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white relative overflow-hidden">
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
                    <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-xl transition-all z-10 print:hidden">
                        <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3 mb-3 relative z-10">
                        <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Tag className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-violet-200">Token Payment Receipt</p>
                            <p className="font-black text-lg">{receiptNo}</p>
                        </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full relative z-10 bg-emerald-500/30 border border-emerald-400/40 text-emerald-100">
                        <CheckCircle2 className="w-3 h-3" /> Paid
                    </span>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {/* Tenant */}
                    <div className="bg-slate-50 rounded-2xl p-4 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tenant Details</p>
                        <p className="font-black text-slate-900 text-base">{booking?.guestName || '—'}</p>
                        {booking?.guestPhone && <p className="text-sm text-slate-500">{booking.guestPhone}</p>}
                        {booking?.guestEmail && <p className="text-sm text-slate-400">{booking.guestEmail}</p>}
                    </div>

                    {/* Reference IDs */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-violet-500 mb-1">Receipt ID</p>
                            <p className="text-xs font-mono font-black text-violet-700">{receiptNo}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Booking Ref</p>
                            <p className="text-xs font-mono font-black text-slate-700">{booking?.displayId || '—'}</p>
                        </div>
                    </div>

                    {/* Tenant ID */}
                    {booking?.guestPhone && (
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tenant ID</p>
                            <p className="text-xs font-mono font-black text-slate-700">
                                {`RP-TN-${booking.guestPhone.replace(/\D/g, '').slice(-10)}`}
                            </p>
                        </div>
                    )}

                    {/* Transaction ID */}
                    <div className={`rounded-xl p-3 ${txId ? 'bg-indigo-50 border border-indigo-100' : 'bg-amber-50 border border-amber-100'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${txId ? 'text-indigo-400' : 'text-amber-500'}`}>Transaction ID (Razorpay)</p>
                        <p className={`text-xs font-mono font-bold break-all ${txId ? 'text-indigo-700' : 'text-amber-600 italic'}`}>
                            {txId || 'Captured / Online Confirmation'}
                        </p>
                    </div>

                    {/* Warning note */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[10px] text-amber-800 leading-relaxed font-bold">
                        ⚠️ IMPORTANT: This token amount is non-refundable and confirms your booking intent for {booking?.propertyName || 'the selected property'}.
                    </div>

                    {/* Breakdown */}
                    <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                        <div className="flex justify-between items-center px-4 py-3">
                            <div>
                                <p className="text-sm font-black text-slate-800">Booking Token Payment</p>
                                <p className="text-xs text-slate-400">Confirmation / seat reservation</p>
                            </div>
                            <p className="font-black text-slate-900">₹{tokenAmount.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="flex justify-between items-center px-4 py-3 bg-slate-50">
                            <p className="text-sm font-black text-slate-600">Total Paid</p>
                            <p className="font-black text-lg text-slate-900">₹{tokenAmount.toLocaleString('en-IN')}</p>
                        </div>
                    </div>

                    {/* Meta */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Paid On</p>
                            <p className="text-sm font-black text-slate-700">{paidDate}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Payment Mode</p>
                            <p className="text-sm font-black text-slate-700">{paymentMode}</p>
                        </div>
                    </div>

                    {/* Legal terms and disclaimer */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1.5 text-[10px] text-slate-500 leading-relaxed">
                        <p className="font-bold text-slate-700 uppercase tracking-wider text-[9px]">Important Information</p>
                        <p>1. This token amount confirms your commitment to lease. The PG/Hostel room booking will be verified and held for you.</p>
                        <p>2. If you withdraw the booking, the token amount is forfeited and is non-refundable as per RentPe booking guidelines.</p>
                        <p className="text-[9px] italic text-slate-400 mt-1">This is a computer-generated confirmation receipt. Signature not required. Subject to the realization of online payments.</p>
                    </div>

                    <p className="text-center text-[10px] text-slate-300 font-bold tracking-wider uppercase">
                        RentPe Ecosystem • Prop-Tech OS for Modern Living • support@rentpe.in
                    </p>

                    <div className="flex gap-3">
                        {tokenPdfUrl ? (
                            <a
                                href={tokenPdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-700 text-white font-black text-sm rounded-2xl transition-all"
                            >
                                <Download className="w-4 h-4" /> Download PDF
                            </a>
                        ) : null}
                        <button onClick={onClose} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm rounded-2xl transition-all">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function PaymentHistoryClient({ allData }: { allData: any[] }) {
    const data = allData as BookingEntry[];
    const defaultId = useMemo(() => findCurrentBooking(data), [data]);
    const [selectedId, setSelectedId] = useState<string | null>(defaultId);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [depositReceiptOpen, setDepositReceiptOpen] = useState(false);
    const [tokenReceiptOpen, setTokenReceiptOpen] = useState(false);
    const [rentReceiptOpen, setRentReceiptOpen] = useState(false);
    const [selectedRentInvoice, setSelectedRentInvoice] = useState<Invoice | null>(null);

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
                receiptHref: 'TOKEN_MODAL',
                txId: booking.tokenPaymentId,
            });
        }

        // 2. Security deposit
        if (depositInfo) {
            rows.push({
                id: `deposit-${depositInfo.id}`,
                date: depositInfo.paidAt
                    ? new Date(depositInfo.paidAt)
                    : booking?.agreementSignedAt
                        ? new Date(booking.agreementSignedAt)
                        : booking?.activeAt ? new Date(booking.activeAt) : new Date(),
                label: `Security Deposit — ${booking?.propertyName}`,
                amount: depositInfo.amount,
                status: depositInfo.status === 'PAID' ? 'SUCCESS' : depositInfo.status,
                type: 'DEPOSIT',
                receiptHref: 'DEPOSIT_MODAL',
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
                receiptHref: inv.status === 'PAID' ? `RENT_MODAL:${inv.id}` : undefined,
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
                        {(() => { const moveInDisplay = booking.agreementSignedAt || booking.activeAt; return moveInDisplay && (<span>Move-in: <span className="font-bold text-slate-700">{format(new Date(moveInDisplay), 'dd MMM yyyy')}</span></span>); })()}
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
                                                    {row.receiptHref === 'DEPOSIT_MODAL' ? (
                                                        <button
                                                            onClick={() => setDepositReceiptOpen(true)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-teal-100 transition-all"
                                                        >
                                                            <FileText className="w-3 h-3" /> Receipt
                                                        </button>
                                                    ) : row.receiptHref === 'TOKEN_MODAL' ? (
                                                        <button
                                                            onClick={() => setTokenReceiptOpen(true)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-indigo-100 transition-all hover:shadow-md"
                                                        >
                                                            <FileText className="w-3 h-3" /> Receipt
                                                        </button>
                                                    ) : row.receiptHref?.startsWith('RENT_MODAL:') ? (
                                                        <button
                                                            onClick={() => {
                                                                const invId = row.receiptHref?.split(':')[1];
                                                                const foundInv = invoices.find(i => i.id === invId);
                                                                if (foundInv) {
                                                                    setSelectedRentInvoice(foundInv);
                                                                    setRentReceiptOpen(true);
                                                                }
                                                            }}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-indigo-100 transition-all hover:shadow-md"
                                                        >
                                                            <FileText className="w-3 h-3" /> Receipt
                                                        </button>
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
                                            {row.receiptHref === 'DEPOSIT_MODAL' ? (
                                                <button
                                                    onClick={() => setDepositReceiptOpen(true)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 text-teal-700 text-[10px] font-black uppercase rounded-lg border border-teal-100"
                                                >
                                                    <FileText className="w-3 h-3" /> Receipt
                                                </button>
                                            ) : row.receiptHref === 'TOKEN_MODAL' ? (
                                                <button
                                                    onClick={() => setTokenReceiptOpen(true)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg border border-indigo-100"
                                                >
                                                    <FileText className="w-3 h-3" /> Receipt
                                                </button>
                                            ) : row.receiptHref?.startsWith('RENT_MODAL:') ? (
                                                <button
                                                    onClick={() => {
                                                        const invId = row.receiptHref?.split(':')[1];
                                                        const foundInv = invoices.find(i => i.id === invId);
                                                        if (foundInv) {
                                                            setSelectedRentInvoice(foundInv);
                                                            setRentReceiptOpen(true);
                                                        }
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg border border-indigo-100"
                                                >
                                                    <FileText className="w-3 h-3" /> Receipt
                                                </button>
                                            ) : null}
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

            {/* Deposit Receipt Modal */}
            {depositReceiptOpen && booking && depositInfo && (
                <DepositReceiptModal
                    booking={booking}
                    depositInfo={depositInfo}
                    rawPayments={rawPayments}
                    onClose={() => setDepositReceiptOpen(false)}
                />
            )}

            {/* Token Receipt Modal */}
            {tokenReceiptOpen && booking && (
                <TokenReceiptModal
                    booking={booking}
                    onClose={() => setTokenReceiptOpen(false)}
                />
            )}

            {/* Rent Receipt Modal */}
            {rentReceiptOpen && booking && selectedRentInvoice && (
                <RentReceiptModal
                    booking={booking}
                    invoice={selectedRentInvoice}
                    onClose={() => {
                        setRentReceiptOpen(false);
                        setSelectedRentInvoice(null);
                    }}
                />
            )}
        </div>
    );
}
