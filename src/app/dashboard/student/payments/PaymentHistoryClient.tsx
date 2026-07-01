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
    const depositInvoiceId = `DEP-INV-${depositInfo?.id?.slice(-8).toUpperCase() || 'XXXXXXXX'}`;
    const receiptNo = `DEP-${depositInfo?.id?.slice(-6).toUpperCase() || 'XXXXXX'}`;
    const depositPdfUrl = depositInfo?.id ? `/api/receipts/deposit/${depositInfo.id}?download=1` : (booking?.id ? `/api/receipts/token/${booking.id}?download=1` : null);
    const paidDate = depositInfo?.paidAt ? new Date(depositInfo.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    const isPaid = depositInfo?.status === 'PAID';

    const depositPayment = rawPayments.find(p => p.depositId === depositInfo?.id && (p.status === 'VERIFIED' || p.status === 'SUCCESS'));
    const joiningPayment = depositPayment || rawPayments.find(p => !p.invoiceId && !p.depositId && (p.status === 'VERIFIED' || p.status === 'SUCCESS'));
    const anyVerifiedPayment = joiningPayment || rawPayments.find(p => p.status === 'VERIFIED' || p.status === 'SUCCESS');
    const txId = anyVerifiedPayment?.razorpayId || anyVerifiedPayment?.razorpayOrderId || null;
    const rawMethod = anyVerifiedPayment?.method || booking?.paymentMethod || null;
    const paymentMode = rawMethod === 'CASH' ? 'CASH' : rawMethod === 'ONLINE' ? 'ONLINE' : rawMethod ? rawMethod.toUpperCase() : '—';
    const roomAssigned = booking?.roomAssigned || '';
    const roomParts = roomAssigned.split('—');
    const roomDisplay = roomParts[0]?.replace(/room/i, '').trim() || roomAssigned || '—';
    const bedDisplay = roomParts[1]?.replace(/bed/i, '').trim() || '';

    const depositAmount = Number(depositInfo?.amount || 0);
    const firstMonthRent = Number(booking?.pendingAmount || booking?.amount || 0);
    const totalCollected = depositAmount + firstMonthRent;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4 overflow-hidden print:shadow-none">
                <div className="bg-[#0F766E] px-4 py-3 flex items-center justify-between text-white">
                    <div className="flex items-center gap-2 font-bold text-sm">
                        <Shield className="w-4 h-4" /> Deposit Receipt <span className="text-[#99F6E4]">#{receiptNo}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {depositPdfUrl && (
                            <a href={depositPdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold rounded-lg transition-all border border-[#14B8A6]">
                                <Download className="w-3.5 h-3.5" /> Download PDF
                            </a>
                        )}
                        <button onClick={onClose} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-all">
                            <X className="w-3.5 h-3.5" /> Close
                        </button>
                    </div>
                </div>

                <div className="p-6 md:p-8 space-y-6">
                    <div className="bg-[#14B8A6] rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3" />
                        <div>
                            <h2 className="text-2xl font-black tracking-tight">RentPe</h2>
                            <p className="text-teal-100 text-sm font-medium mt-1">Verified PGs & Hostels</p>
                        </div>
                        <div className="text-left md:text-right mt-4 md:mt-0 relative z-10">
                            <h3 className="text-lg font-black uppercase tracking-widest">DEPOSIT RECEIPT</h3>
                            <p className="text-teal-100 text-sm font-bold mb-2">#{receiptNo}</p>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-white text-[10px] font-black uppercase tracking-wider rounded-md ${isPaid ? 'bg-[#0D9488]' : 'bg-[#D97706]'}`}>
                                {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />} {isPaid ? 'PAID' : 'PENDING'}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] mb-2">TENANT DETAILS</p>
                            <p className="font-black text-[#0F172A] text-base">{booking?.guestName || '—'}</p>
                            {booking?.guestPhone && <p className="text-xs text-[#64748B] mt-1 font-mono">RP-TN-{booking.guestPhone.replace(/\D/g, '').slice(-10)}</p>}
                            {booking?.guestEmail && <p className="text-xs text-[#64748B] mt-1">{booking.guestEmail}</p>}
                            <p className="text-xs text-[#64748B] mt-1">Room: {roomDisplay}{bedDisplay ? ` · Bed ${bedDisplay}` : ''}</p>
                        </div>
                        <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl p-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#4ADE80] mb-2">PROPERTY DETAILS</p>
                            <p className="font-black text-[#166534] text-base">{booking?.propertyName || '—'}</p>
                            <p className="text-xs text-[#15803D] mt-1 leading-relaxed max-w-[200px]">
                                Booking Ref: {booking?.displayId || '—'}
                            </p>
                        </div>
                    </div>

                    <div>
                        <div className="bg-[#0F766E] text-white px-4 py-2 rounded-t-xl text-[10px] font-black uppercase tracking-widest">
                            PAYMENT SUMMARY
                        </div>
                        <div className="border border-[#E2E8F0] border-t-0 rounded-b-xl overflow-hidden text-sm divide-y divide-[#F1F5F9]">
                            <div className="flex justify-between items-center px-4 py-3">
                                <span className="text-[#64748B]">Receipt No.</span>
                                <span className="font-bold text-[#0F172A]">{receiptNo}</span>
                            </div>
                            <div className="flex justify-between items-center px-4 py-3">
                                <span className="text-[#64748B]">Security Deposit</span>
                                <span className="font-bold text-[#0F172A]">₹{depositAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            {firstMonthRent > 0 && (
                                <div className="flex justify-between items-center px-4 py-3">
                                    <span className="text-[#64748B]">First Month Rent</span>
                                    <span className="font-bold text-[#0F172A]">₹{firstMonthRent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center px-4 py-4 bg-[#F8FAFC]">
                                <span className="text-[#0F766E] font-black text-sm">Total Collected</span>
                                <span className="font-black text-[#0F172A] text-base">₹{totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center px-4 py-3">
                                <span className="text-[#64748B]">Paid On</span>
                                <span className="font-bold text-[#0F172A]">{paidDate}</span>
                            </div>
                            <div className="flex justify-between items-center px-4 py-3">
                                <span className="text-[#64748B]">Payment Method</span>
                                <span className="font-bold text-[#0F172A]">{paymentMode}</span>
                            </div>
                            <div className="flex justify-between items-start px-4 py-3">
                                <span className="text-[#64748B] shrink-0">Payment Ref</span>
                                <span className="font-mono text-xs text-[#0F172A] text-right break-all max-w-[60%]">
                                    {txId || 'Captured / Online Confirmation'}
                                </span>
                            </div>
                        </div>
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
    const rentPdfUrl = invoice?.id ? `/api/receipts/${invoice.id}?download=1` : null;
    const paidDate = invoice?.paidAt
        ? new Date(invoice.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—';
    const dueDate = invoice?.dueDate
        ? new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';
    const payment = invoice?.payments?.find((p: any) => p.status === 'VERIFIED' || p.status === 'SUCCESS') || invoice?.payments?.[0];
    const txId = payment?.razorpayId || payment?.razorpayOrderId || null;
    const rawMethod = invoice?.paymentMethod || payment?.method || booking?.paymentMethod || null;
    const paymentMode = rawMethod === 'CASH' ? 'CASH'
        : rawMethod === 'ONLINE' ? 'ONLINE'
        : rawMethod ? rawMethod.toUpperCase() : '—';
    const rentAmount = Number(invoice?.rentAmount || invoice?.amount || 0);
    const totalAmount = Number(invoice?.amount || 0);
    const totalAmountPaid = payment ? Number(payment.amount) : totalAmount;
    const convenienceFee = Math.max(0, totalAmountPaid - totalAmount);
    const GST_RATE = 0.18;
    const convenienceFeeGst = convenienceFee > 0 ? Math.round((convenienceFee * GST_RATE / (1 + GST_RATE)) * 100) / 100 : 0;
    const convenienceFeeBase = convenienceFee > 0 ? Math.round((convenienceFee - convenienceFeeGst) * 100) / 100 : 0;
    const roomAssigned = booking?.roomAssigned || '';
    const roomParts = roomAssigned.split('—');
    const roomDisplay = roomParts[0]?.replace(/room/i, '').trim() || roomAssigned || '—';
    const bedDisplay = roomParts[1]?.replace(/bed/i, '').trim() || '';

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4 overflow-hidden print:shadow-none">
                {/* Title Bar */}
                <div className="bg-[#4C28D5] px-4 py-3 flex items-center justify-between text-white">
                    <div className="flex items-center gap-2 font-bold text-sm">
                        <FileText className="w-4 h-4" /> Rent Receipt <span className="text-[#A78BFA]">#{receiptNo}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {rentPdfUrl && (
                            <a
                                href={rentPdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold rounded-lg transition-all"
                            >
                                <Download className="w-3.5 h-3.5" /> Download PDF
                            </a>
                        )}
                        <button onClick={onClose} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-all">
                            <X className="w-3.5 h-3.5" /> Close
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 md:p-8 space-y-6">
                    {/* Purple Banner */}
                    <div className="bg-[#6332F6] rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
                        <div>
                            <h2 className="text-2xl font-black tracking-tight">RentPe</h2>
                            <p className="text-indigo-200 text-sm font-medium mt-1">Verified PGs & Hostels</p>
                        </div>
                        <div className="text-left md:text-right mt-4 md:mt-0 relative z-10">
                            <h3 className="text-lg font-black uppercase tracking-widest">RENT RECEIPT</h3>
                            <p className="text-indigo-200 text-sm font-bold mb-2">#{receiptNo}</p>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#10B981] text-white text-[10px] font-black uppercase tracking-wider rounded-md">
                                <CheckCircle2 className="w-3 h-3" /> PAID
                            </span>
                        </div>
                    </div>

                    {/* Details Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] mb-2">TENANT DETAILS</p>
                            <p className="font-black text-[#0F172A] text-base">{booking?.guestName || '—'}</p>
                            {booking?.guestPhone && <p className="text-xs text-[#64748B] mt-1 font-mono">RP-TN-{booking.guestPhone.replace(/\D/g, '').slice(-10)}</p>}
                            {booking?.guestEmail && <p className="text-xs text-[#64748B] mt-1">{booking.guestEmail}</p>}
                            <p className="text-xs text-[#64748B] mt-1">Room: {roomDisplay}{bedDisplay ? ` · Bed ${bedDisplay}` : ''}</p>
                            {(booking?.agreementSignedAt || booking?.activeAt) && (
                                <p className="text-xs text-[#64748B] mt-1">Stay from: <span className="font-bold text-[#334155]">{new Date(booking.agreementSignedAt || booking.activeAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></p>
                            )}
                        </div>
                        <div className="bg-[#F0F9FF] border border-[#E0F2FE] rounded-xl p-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#7DD3FC] mb-2">PROPERTY DETAILS</p>
                            <p className="font-black text-[#0369A1] text-base">{booking?.propertyName || '—'}</p>
                            <p className="text-xs text-[#0284C7] mt-1 leading-relaxed max-w-[200px]">
                                {booking?.propertyAddress || 'Bangalore, Karnataka - India'}
                            </p>
                        </div>
                    </div>

                    {/* Payment Summary */}
                    <div>
                        <div className="bg-[#4C28D5] text-white px-4 py-2 rounded-t-xl text-[10px] font-black uppercase tracking-widest">
                            PAYMENT SUMMARY
                        </div>
                        <div className="border border-[#E2E8F0] border-t-0 rounded-b-xl overflow-hidden text-sm divide-y divide-[#F1F5F9]">
                            <div className="flex justify-between items-center px-4 py-3">
                                <span className="text-[#64748B]">Period / Month</span>
                                <span className="font-bold text-[#0F172A]">{invoice?.month || '—'}</span>
                            </div>
                            <div className="flex justify-between items-center px-4 py-3">
                                <span className="text-[#64748B]">Invoice No.</span>
                                <span className="font-bold text-[#0F172A]">{receiptNo}</span>
                            </div>
                            {booking?.guestPhone && (
                                <div className="flex justify-between items-center px-4 py-3">
                                    <span className="text-[#64748B]">Tenant ID</span>
                                    <span className="font-mono text-[#0F172A]">RP-TN-{booking.guestPhone.replace(/\D/g, '').slice(-10)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center px-4 py-3">
                                <span className="text-[#64748B]">Rent Amount</span>
                                <span className="font-bold text-[#0F172A]">₹{rentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            {convenienceFee > 0 && (
                                <>
                                    <div className="flex justify-between items-center px-4 py-3 bg-violet-50/50">
                                        <span className="text-[#64748B] font-medium">RentPe Convenience Fee (Base)</span>
                                        <span className="font-bold text-[#0F172A]">₹{convenienceFeeBase.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center px-4 py-3 bg-violet-50/50">
                                        <span className="text-[#64748B] font-medium">GST (18% inclusive)</span>
                                        <span className="font-bold text-[#0F172A]">₹{convenienceFeeGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </>
                            )}
                            <div className="flex justify-between items-center px-4 py-4 bg-[#F8FAFC]">
                                <span className="text-[#4C28D5] font-black text-sm">Total Paid by You</span>
                                <span className="font-black text-[#0F172A] text-base">₹{totalAmountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center px-4 py-3">
                                <span className="text-[#64748B]">Due Date</span>
                                <span className="font-bold text-[#0F172A]">{dueDate}</span>
                            </div>
                            <div className="flex justify-between items-center px-4 py-3">
                                <span className="text-[#64748B]">Paid On</span>
                                <span className="font-bold text-[#0F172A]">{paidDate}</span>
                            </div>
                            <div className="flex justify-between items-center px-4 py-3">
                                <span className="text-[#64748B]">Payment Method</span>
                                <span className="font-bold text-[#0F172A]">{paymentMode}</span>
                            </div>
                            <div className="flex justify-between items-start px-4 py-3">
                                <span className="text-[#64748B] shrink-0">Payment Ref</span>
                                <span className="font-mono text-xs text-[#0F172A] text-right break-all max-w-[60%]">
                                    {txId || 'Captured / Online Confirmation'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-xl px-4 py-3 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-[#D97706]" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#B45309]">RENTPE VERIFIED TRANSACTION</span>
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
    const tokenPdfUrl = booking?.id ? `/api/receipts/token/${booking.id}?download=1` : null;
    const paidDate = booking?.tokenPaidAt
        ? new Date(booking.tokenPaidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—';
    const txId = booking?.tokenPaymentId || null;
    const rawMethod = booking?.paymentMethod || null;
    const paymentMode = rawMethod === 'CASH' ? 'CASH'
        : rawMethod === 'ONLINE' ? 'ONLINE'
        : rawMethod ? rawMethod.toUpperCase() : '—';
    const tokenAmount = Number(booking?.tokenAmount || 1000);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4 overflow-hidden print:shadow-none">
                <div className="bg-[#4C28D5] px-4 py-3 flex items-center justify-between text-white">
                    <div className="flex items-center gap-2 font-bold text-sm">
                        <Tag className="w-4 h-4" /> Token Receipt <span className="text-[#A78BFA]">#{receiptNo}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {tokenPdfUrl && (
                            <a href={tokenPdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold rounded-lg transition-all">
                                <Download className="w-3.5 h-3.5" /> Download PDF
                            </a>
                        )}
                        <button onClick={onClose} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-all">
                            <X className="w-3.5 h-3.5" /> Close
                        </button>
                    </div>
                </div>

                <div className="p-6 md:p-8 space-y-6">
                    <div className="bg-[#8B5CF6] rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
                        <div>
                            <h2 className="text-2xl font-black tracking-tight">RentPe</h2>
                            <p className="text-indigo-100 text-sm font-medium mt-1">Verified PGs & Hostels</p>
                        </div>
                        <div className="text-left md:text-right mt-4 md:mt-0 relative z-10">
                            <h3 className="text-lg font-black uppercase tracking-widest">TOKEN RECEIPT</h3>
                            <p className="text-indigo-100 text-sm font-bold mb-2">#{receiptNo}</p>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#10B981] text-white text-[10px] font-black uppercase tracking-wider rounded-md">
                                <CheckCircle2 className="w-3 h-3" /> PAID
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] mb-2">TENANT DETAILS</p>
                            <p className="font-black text-[#0F172A] text-base">{booking?.guestName || '—'}</p>
                            {booking?.guestPhone && <p className="text-xs text-[#64748B] mt-1 font-mono">RP-TN-{booking.guestPhone.replace(/\D/g, '').slice(-10)}</p>}
                            {booking?.guestEmail && <p className="text-xs text-[#64748B] mt-1">{booking.guestEmail}</p>}
                        </div>
                        <div className="bg-[#F0F9FF] border border-[#E0F2FE] rounded-xl p-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#7DD3FC] mb-2">PROPERTY DETAILS</p>
                            <p className="font-black text-[#0369A1] text-base">{booking?.propertyName || '—'}</p>
                            <p className="text-xs text-[#0284C7] mt-1 leading-relaxed max-w-[200px]">
                                Booking Ref: {booking?.displayId || '—'}
                            </p>
                        </div>
                    </div>

                    <div>
                        <div className="bg-[#4C28D5] text-white px-4 py-2 rounded-t-xl text-[10px] font-black uppercase tracking-widest">
                            PAYMENT SUMMARY
                        </div>
                        <div className="border border-[#E2E8F0] border-t-0 rounded-b-xl overflow-hidden text-sm divide-y divide-[#F1F5F9]">
                            <div className="flex justify-between items-center px-4 py-3">
                                <span className="text-[#64748B]">Receipt No.</span>
                                <span className="font-bold text-[#0F172A]">{receiptNo}</span>
                            </div>
                            <div className="flex justify-between items-center px-4 py-3">
                                <span className="text-[#64748B]">Token Amount</span>
                                <span className="font-bold text-[#0F172A]">₹{tokenAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center px-4 py-4 bg-[#F8FAFC]">
                                <span className="text-[#4C28D5] font-black text-sm">Total Paid</span>
                                <span className="font-black text-[#0F172A] text-base">₹{tokenAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center px-4 py-3">
                                <span className="text-[#64748B]">Paid On</span>
                                <span className="font-bold text-[#0F172A]">{paidDate}</span>
                            </div>
                            <div className="flex justify-between items-center px-4 py-3">
                                <span className="text-[#64748B]">Payment Method</span>
                                <span className="font-bold text-[#0F172A]">{paymentMode}</span>
                            </div>
                            <div className="flex justify-between items-start px-4 py-3">
                                <span className="text-[#64748B] shrink-0">Payment Ref</span>
                                <span className="font-mono text-xs text-[#0F172A] text-right break-all max-w-[60%]">
                                    {txId || 'Captured / Online Confirmation'}
                                </span>
                            </div>
                        </div>
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
