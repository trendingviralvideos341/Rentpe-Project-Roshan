'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { getOwnerRentCollection, sendRentReminder, markInvoiceAsCashPaid } from '@/actions/ownerRentCollection';
import { getInvoiceForReceipt } from '@/actions/payments';
import { getCashPaymentEnabled } from '@/actions/platform';
import { toast } from 'sonner';
import {
    IndianRupee, AlertCircle, Loader2, MessageCircle,
    FileText, Search, Globe, Banknote, XCircle, History,
    ChevronDown, ChevronUp, X, RefreshCw, Download, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

type Tab = 'ALL' | 'ONLINE' | 'CASH' | 'PENDING' | 'OVERDUE' | 'TOKEN';


// ── Receipt Preview Modal (HTML inline — no iframe) ────────────────
type InvoiceData = Awaited<ReturnType<typeof getInvoiceForReceipt>>;

function inr(n: number) {
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ReceiptModal({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
    const [data, setData] = useState<InvoiceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        getInvoiceForReceipt(invoiceId)
            .then(setData)
            .catch(e => setError(e.message || 'Failed to load receipt'))
            .finally(() => setLoading(false));
    }, [invoiceId]);

    const downloadUrl = `/api/receipts/${invoiceId}?download=1`;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

                {/* Modal top bar */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-indigo-700 text-white shrink-0">
                    <div className="flex items-center gap-2">
                        <FileText className="w-4.5 h-4.5 text-indigo-200" />
                        <span className="font-black text-sm">Rent Receipt</span>
                        {data && <span className="text-indigo-300 text-xs font-mono">#{data.displayId}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-lg transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" /> Download PDF
                        </a>
                        <button
                            onClick={onClose}
                            className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-black rounded-lg transition-colors"
                        >
                            <X className="w-3.5 h-3.5" /> Close
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1">
                    {loading && (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        </div>
                    )}
                    {error && (
                        <div className="flex items-center justify-center py-20 text-red-500 font-bold text-sm">{error}</div>
                    )}
                    {data && !loading && (
                        <div className="p-6 space-y-5 font-sans text-slate-800">

                            {/* Header band */}
                            <div className="rounded-xl overflow-hidden">
                                <div className="bg-gradient-to-r from-indigo-700 to-violet-600 px-6 py-5 flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-white text-xl font-black tracking-tight">RentPe</p>
                                            <span className="inline-flex items-center px-1.5 py-0.5 bg-white/15 text-white text-[8px] font-black rounded uppercase tracking-wider">
                                                Customer Copy
                                            </span>
                                        </div>
                                        <p className="text-indigo-200 text-xs mt-0.5">Verified PGs &amp; Hostels</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-white text-base font-black tracking-widest uppercase">Rent Receipt</p>
                                        <p className="text-indigo-200 text-xs font-mono mt-0.5">#{data.displayId}</p>
                                        <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 bg-emerald-500 text-white text-[10px] font-black rounded-full uppercase tracking-wider">
                                            ✓ PAID
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Tenant + Property cards */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Tenant Details</p>
                                    <p className="font-black text-slate-900 text-sm">{data.tenantName}</p>
                                    <p className="text-[10px] font-mono text-indigo-600 mt-0.5">{data.tenantDisplayId}</p>
                                    <p className="text-[11px] text-slate-500 mt-1">{data.tenantEmail}</p>
                                    <p className="text-[11px] text-slate-500">Room: {data.tenantRoom}{data.tenantRoomType ? ` · ${data.tenantRoomType}` : ''}</p>
                                    <p className="text-[11px] text-slate-500">Stay from: {data.stayFrom}</p>
                                </div>
                                <div className="border border-indigo-100 rounded-xl p-4 bg-indigo-50">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Property Details</p>
                                    <p className="font-black text-slate-900 text-sm">{data.propertyName}</p>
                                    <p className="text-[11px] text-slate-500 mt-1">{data.propertyAddress}</p>
                                    <p className="text-[11px] text-slate-500">{data.propertyCity}</p>
                                    {data.propertyGst && <p className="text-[10px] font-mono text-slate-500 mt-1">GSTIN: {data.propertyGst}</p>}
                                </div>
                            </div>

                            {/* Payment summary table */}
                            <div className="rounded-xl border border-slate-200 overflow-hidden">
                                <div className="bg-indigo-700 px-4 py-2.5">
                                    <p className="text-white text-[10px] font-black uppercase tracking-widest">Payment Summary</p>
                                </div>
                                <table className="w-full text-sm">
                                    <tbody>
                                        {[
                                            { label: 'Period / Month',  value: data.month,           bold: false },
                                            { label: 'Invoice No.',     value: data.displayId,        bold: false, mono: true },
                                            { label: 'Tenant ID',       value: data.tenantDisplayId,  bold: false, mono: true },
                                            { label: 'Rent Amount',     value: inr(data.rentAmount),  bold: false },
                                            ...(data.foodAmount > 0 ? [{ label: 'Food Charges', value: inr(data.foodAmount), bold: false }] : []),
                                            ...(data.creditApplied > 0 ? [{ label: 'Credit Applied', value: `- ${inr(data.creditApplied)}`, bold: false }] : []),
                                            { label: 'Gross Rent Collected', value: inr(data.amount), bold: true, highlight: true },
                                            { label: 'Due Date',        value: data.dueDate,          bold: false },
                                            { label: 'Paid On',         value: data.paidAt,           bold: false },
                                            { label: 'Payment Method',  value: data.paymentMethod,    bold: false },
                                            { label: 'Payment Ref',     value: data.paymentRef,       bold: false, mono: true },
                                        ].map((row: any, i) => (
                                            <tr key={i} className={`border-b border-slate-100 ${row.highlight ? 'bg-indigo-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                                                <td className={`px-4 py-2.5 text-xs ${row.bold ? 'font-black text-indigo-700' : 'text-slate-500'}`}>
                                                    {row.label}
                                                </td>
                                                <td className={`px-4 py-2.5 text-right text-xs ${row.bold ? 'font-black text-slate-900 text-sm' : row.mono ? 'font-mono text-slate-700' : 'text-slate-800 font-medium'}`}>
                                                    {row.value}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* ✅ LEGAL: Platform Commission Breakdown for Owner */}
                                {data.feesEnabled && data.ownerFee > 0 && (
                                    <div className="bg-amber-50 border-t-2 border-amber-200 px-4 py-3 space-y-1.5">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-2">💼 RentPe Commission Breakdown</p>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-600">Gross Rent Collected</span>
                                            <span className="font-black text-slate-800">{inr(data.amount)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-amber-700">RentPe Platform Commission</span>
                                            <span className="font-black text-amber-700">− {inr(data.ownerFee)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs border-t border-amber-200 pt-1.5 mt-1">
                                            <span className="font-black text-emerald-700">✅ Net Payout to You</span>
                                            <span className="font-black text-emerald-700 text-sm">{inr(data.netPayout)}</span>
                                        </div>
                                        <p className="text-[9px] text-amber-600 italic mt-1">Commission deducted via Razorpay Route. Keep this for your income tax records.</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer note */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center">
                                <p className="text-[10px] text-slate-400 italic">
                                    This is a computer-generated receipt and does not require a physical signature.
                                </p>
                                <p className="text-[10px] text-indigo-500 font-bold mt-0.5">rentpe.in</p>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function getCurrentMonth() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function getPreviousMonth() {
    const n = new Date();
    n.setMonth(n.getMonth() - 1);
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function getStatus(inv: any): string {
    if (inv.txnType === 'TOKEN_PAYMENT') return 'TOKEN_PAID';
    if (inv.status === 'PAID' && (inv.paymentMethod === 'ONLINE' || inv.paymentMethod === 'RAZORPAY')) return 'ONLINE_PAID';
    if (inv.status === 'PAID' && inv.paymentMethod === 'CASH') return 'CASH_PAID';
    if (inv.status === 'PAID') return 'ONLINE_PAID'; // default paid = online
    if (inv.daysOverdue > 0) return 'OVERDUE';
    return 'UNPAID';
}

function StatusBadge({ inv }: { inv: any }) {
    const s = getStatus(inv);
    if (s === 'TOKEN_PAID') return (
        <div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-teal-100 text-teal-700 border border-teal-200 uppercase">
                🔐 Token Paid
            </span>
            {inv.tokenPaymentId && (
                <p className="text-[9px] text-slate-400 mt-0.5 font-mono">ID: {inv.tokenPaymentId.slice(0, 16)}…</p>
            )}
        </div>
    );
    if (s === 'ONLINE_PAID') return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">
            <Globe className="w-3 h-3" /> Online Paid
        </span>
    );
    if (s === 'CASH_PAID') return (
        <div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-green-100 text-green-700 border border-green-200 uppercase">
                <Banknote className="w-3 h-3" /> Cash Paid
            </span>
            {inv.confirmedByName && (
                <p className="text-[9px] text-slate-400 mt-0.5">by {inv.confirmedByName}</p>
            )}
        </div>
    );
    if (s === 'OVERDUE') return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-200 uppercase">
            <AlertCircle className="w-3 h-3" /> {inv.daysOverdue}d Overdue
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-200 uppercase">
            <XCircle className="w-3 h-3" /> Unpaid
        </span>
    );
}

// ── Cash Confirm Modal ─────────────────────────────────
function CashConfirmModal({ inv, onClose, onConfirm }: { inv: any; onClose: () => void; onConfirm: (note: string) => void }) {
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-black text-slate-900">Confirm Cash Payment</h2>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1">
                    <p className="text-sm font-black text-green-800">₹{inv.amount.toLocaleString('en-IN')} cash received from</p>
                    <p className="text-lg font-black text-slate-900">{inv.tenantName}</p>
                    <p className="text-xs text-slate-400">Room {inv.roomNumber} · {inv.month}</p>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Note (mandatory)</label>
                    <input
                        className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                        placeholder="e.g. Received in person on 11 Apr 2026"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                    />
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 text-sm font-black text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Cancel</button>
                    <button
                        disabled={!note.trim() || busy}
                        onClick={async () => { setBusy(true); onConfirm(note); }}
                        className="flex-1 py-2.5 text-sm font-black text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                        Confirm ₹{inv.amount.toLocaleString('en-IN')}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── History Modal ─────────────────────────────────────
function HistoryModal({ 
    tenantName, 
    tenantDisplayId, 
    history, 
    onClose,
    onSelectReceipt
}: { 
    tenantName: string; 
    tenantDisplayId: string; 
    history: any[]; 
    onClose: () => void;
    onSelectReceipt: (invoiceId: string) => void;
}) {
    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-700 to-violet-600 text-white shrink-0">
                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5 text-indigo-200" />
                        <div>
                            <h3 className="font-black text-sm tracking-wide">Rent Payment History</h3>
                            <p className="text-[10px] text-indigo-200 font-medium">Tenant: <span className="font-bold">{tenantName}</span> · {tenantDisplayId}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-4">
                    <div className="space-y-3">
                        {history.length === 0 ? (
                            <div className="py-12 text-center text-slate-400">
                                <History className="w-12 h-12 mx-auto text-slate-200 mb-2" />
                                <p className="text-sm font-bold">No payment history records found.</p>
                            </div>
                        ) : (
                            history.map((record: any, index: number) => {
                                const isPaid = record.status === 'PAID';
                                return (
                                    <div 
                                        key={index} 
                                        onClick={() => {
                                            if (isPaid && record.id) {
                                                onSelectReceipt(record.id);
                                            }
                                        }}
                                        className={`p-4 rounded-2xl border-2 transition-all hover:shadow-md ${
                                            isPaid 
                                                ? 'bg-emerald-50/50 border-emerald-100 hover:border-emerald-200 cursor-pointer' 
                                                : 'bg-red-50/50 border-red-100 hover:border-red-200'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <span className="text-xs font-black text-slate-900 tracking-tight">
                                                    {record.month}
                                                </span>
                                                <p className="text-lg font-black text-slate-900 mt-1">
                                                    ₹{record.amount?.toLocaleString('en-IN')}
                                                </p>
                                            </div>
                                            {isPaid ? (
                                                <div className="flex flex-col items-end">
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        Paid
                                                    </span>
                                                    <span className="text-[9px] text-emerald-600 font-bold mt-1.5 flex items-center gap-1">
                                                        <Eye className="w-3 h-3" /> Click to View Receipt
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-800">
                                                    Unpaid
                                                </span>
                                            )}
                                        </div>

                                        {isPaid && (
                                            <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[10px]">
                                                <div>
                                                    <span className="text-slate-400 font-bold block uppercase tracking-wider">Paid On</span>
                                                    <span className="text-slate-700 font-black">
                                                        {record.paidAt ? format(new Date(record.paidAt), 'dd MMM yyyy') : '—'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 font-bold block uppercase tracking-wider">Payment Method</span>
                                                    <span className="text-slate-700 font-black">
                                                        {record.paymentMethod === 'CASH' ? '💵 Cash' : '🌐 Online'}
                                                    </span>
                                                </div>
                                                {record.paymentMethod === 'CASH' && record.confirmedByName && (
                                                    <div className="col-span-2 mt-1 bg-slate-100/50 p-2 rounded-xl border border-slate-200/50">
                                                        <span className="text-slate-400 font-bold block uppercase tracking-wider">Confirmed By</span>
                                                        <span className="text-slate-700 font-black">{record.confirmedByName}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-lg transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Commission Modal ───────────────────────────────────
function CommissionModal({ 
    tenantName, 
    tenantDisplayId, 
    history, 
    onClose 
}: { 
    tenantName: string; 
    tenantDisplayId: string; 
    history: any[]; 
    onClose: () => void 
}) {
    const paidRecords = history.filter((r: any) => r.status === 'PAID');

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white shrink-0">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-amber-200" />
                        <div>
                            <h3 className="font-black text-sm tracking-wide">Platform Commission Invoices</h3>
                            <p className="text-[10px] text-amber-100 font-medium">Tenant: <span className="font-bold">{tenantName}</span> · {tenantDisplayId}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-4">
                    <div className="space-y-3">
                        {paidRecords.length === 0 ? (
                            <div className="py-12 text-center text-slate-400">
                                <FileText className="w-12 h-12 mx-auto text-slate-200 mb-2" />
                                <p className="text-sm font-bold">No commission invoices generated yet.</p>
                                <p className="text-xs text-slate-400 mt-1">Platform commissions are only billed on paid rent transactions.</p>
                            </div>
                        ) : (
                            paidRecords.map((record: any, index: number) => {
                                const payment = record.payments?.[0];
                                const platformFee = payment?.platformFee;
                                const ownerFee = platformFee ? Number(platformFee.ownerFee) : 0;
                                
                                // Calculate GST decomposition (inclusive)
                                const GST_RATE = 0.18;
                                const ownerFeeGst = ownerFee > 0 ? Math.round((ownerFee * GST_RATE / (1 + GST_RATE)) * 100) / 100 : 0;
                                const ownerFeeBase = ownerFee > 0 ? Math.round((ownerFee - ownerFeeGst) * 100) / 100 : 0;
                                const ownerCgst = Math.round((ownerFeeGst / 2) * 100) / 100;
                                const ownerSgst = Math.round((ownerFeeGst - ownerCgst) * 100) / 100;

                                const downloadUrl = `/api/receipts/${record.id}?download=1`;

                                return (
                                    <div 
                                        key={index} 
                                        className="p-5 rounded-2xl border-2 border-amber-100 bg-amber-50/30 space-y-3"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <span className="text-xs font-black text-slate-900 tracking-tight">
                                                    {record.month}
                                                </span>
                                                <p className="text-sm text-slate-500 mt-0.5">
                                                    Rent Paid: <span className="font-bold text-slate-700">₹{record.amount?.toLocaleString('en-IN')}</span>
                                                </p>
                                            </div>
                                            <a
                                                href={downloadUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-amber-600/10 hover:shadow-lg"
                                            >
                                                <Download className="w-3.5 h-3.5" /> Download Tax Invoice
                                            </a>
                                        </div>

                                        {ownerFee > 0 ? (
                                            <div className="pt-3 border-t border-amber-100/80 space-y-1.5 text-xs text-slate-600">
                                                <div className="flex justify-between">
                                                    <span>Platform Service Charge (Base)</span>
                                                    <span className="font-semibold text-slate-800">₹{ownerFeeBase.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between text-[11px] text-slate-500 pl-3">
                                                    <span>CGST (9%)</span>
                                                    <span>₹{ownerCgst.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between text-[11px] text-slate-500 pl-3">
                                                    <span>SGST (9%)</span>
                                                    <span>₹{ownerSgst.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between border-t border-amber-100/50 pt-1.5 mt-1 font-bold">
                                                    <span className="text-amber-800">Total Platform Commission (GST Incl.)</span>
                                                    <span className="text-amber-800">₹{ownerFee.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between text-[11px] text-emerald-700 font-black pt-1">
                                                    <span>Estimated Net Payout</span>
                                                    <span>₹{(record.amount - ownerFee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="pt-2 border-t border-amber-100/80 text-[10px] text-slate-400 italic">
                                                Commission is not applicable (Cash / Direct settlement).
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-600 hover:bg-slate-700 text-white font-black text-xs rounded-xl transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── MAIN COMPONENT ────────────────────────────────────
export function RentCollectionContainer() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('ALL');
    const [month, setMonth] = useState(getCurrentMonth());
    const [search, setSearch] = useState('');
    const [methodFilter, setMethodFilter] = useState('ALL');
    const [propertyFilter, setPropertyFilter] = useState('ALL');
    const [roomTypeFilter, setRoomTypeFilter] = useState('ALL');
    const [cashModal, setCashModal] = useState<any>(null);
    const [receiptModal, setReceiptModal] = useState<string | null>(null);
    const [historyModal, setHistoryModal] = useState<{ tenantName: string; tenantDisplayId: string; history: any[] } | null>(null);
    const [commissionModal, setCommissionModal] = useState<{ tenantName: string; tenantDisplayId: string; history: any[] } | null>(null);
    const [allowCashPayment, setAllowCashPayment] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [sendingId, setSendingId] = useState<string | null>(null);

    const reload = (m: string) => {
        setLoading(true);
        getOwnerRentCollection(m).then(data => {
            setInvoices(data);
            setLoading(false);
        });
    };

    useEffect(() => { reload(month); }, [month]);

    useEffect(() => {
        getCashPaymentEnabled().then(setAllowCashPayment).catch(console.error);
    }, []);

    // ── summary stats ──
    const tokenPayments = invoices.filter(i => i.txnType === 'TOKEN_PAYMENT');
    const rentInvoices = invoices.filter(i => i.txnType !== 'TOKEN_PAYMENT');
    const onlinePaid = rentInvoices.filter(i => i.status === 'PAID' && i.paymentMethod !== 'CASH');
    const cashPaid = rentInvoices.filter(i => i.status === 'PAID' && i.paymentMethod === 'CASH');
    const unpaid = rentInvoices.filter(i => i.status !== 'PAID');
    const totalReceived = rentInvoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.paidAmount, 0);
    const onlineReceived = onlinePaid.reduce((s, i) => s + i.paidAmount, 0);
    const cashReceived = cashPaid.reduce((s, i) => s + i.paidAmount, 0);
    
    // Split unpaid into Pending (not late) and Overdue (late)
    const pendingInvoices = unpaid.filter(i => (i.daysOverdue ?? 0) <= 0);
    const overdueInvoices = unpaid.filter(i => (i.daysOverdue ?? 0) > 0);
    const totalPending = pendingInvoices.reduce((s, i) => s + i.amount, 0);
    const totalOverdue = overdueInvoices.reduce((s, i) => s + i.amount, 0);

    const totalExpected = rentInvoices.reduce((s, i) => s + i.amount, 0);
    const collectionRate = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;
    const tokenTotal = tokenPayments.reduce((s, i) => s + i.amount, 0);

    // ── unique options for filters ──
    const propertyOptions = Array.from(new Set(invoices.map(i => i.propertyName).filter(Boolean)));
    const roomTypeOptions = Array.from(new Set(invoices.map(i => i.roomType).filter(Boolean)));

    const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

    // ── filters ──
    const filtered = invoices.filter(inv => {
        const s = getStatus(inv);
        // Status Tabs Filter
        if (tab === 'ONLINE' && s !== 'ONLINE_PAID') return false;
        if (tab === 'CASH' && s !== 'CASH_PAID') return false;
        if (tab === 'PENDING' && s !== 'UNPAID') return false;
        if (tab === 'OVERDUE' && s !== 'OVERDUE') return false;
        if (tab === 'TOKEN' && s !== 'TOKEN_PAID') return false;
        // Hide token rows from ONLINE/CASH/PENDING/OVERDUE tabs
        if (tab !== 'ALL' && tab !== 'TOKEN' && s === 'TOKEN_PAID') return false;

        // Dropdown Filters
        if (propertyFilter !== 'ALL' && inv.propertyName !== propertyFilter) return false;
        if (roomTypeFilter !== 'ALL' && inv.roomType !== roomTypeFilter) return false;
        if (methodFilter !== 'ALL') {
             const isPaid = inv.status === 'PAID';
             if (methodFilter === 'ONLINE' && (!isPaid || inv.paymentMethod === 'CASH')) return false;
             if (methodFilter === 'CASH' && (!isPaid || inv.paymentMethod !== 'CASH')) return false;
             if (methodFilter === 'UNPAID' && isPaid) return false;
        }

        const q = search.toLowerCase();
        if (q && !inv.tenantName.toLowerCase().includes(q) && !inv.tenantDisplayId?.toLowerCase().includes(q)
            && !inv.roomNumber.toLowerCase().includes(q) && !inv.tenantPhone?.includes(q) && !inv.tenantEmail?.toLowerCase().includes(q)) return false;
        return true;
    });

    // ── cash paid confirm ──
    const handleCashPaid = (note: string) => {
        if (!cashModal) return;
        startTransition(async () => {
            try {
                const res = await markInvoiceAsCashPaid(cashModal.id, note);
                toast.success(`Cash payment confirmed for ${res.tenantName} — ${fmt(res.amount)}`);
                setCashModal(null);
                reload(month);
            } catch (e: any) {
                toast.error(e.message || 'Failed');
                setCashModal(null);
            }
        });
    };

    const handleReminder = (inv: any) => {
        setSendingId(inv.id);
        startTransition(async () => {
            try {
                const res = await sendRentReminder(inv.id);
                if (res.whatsappUrl) window.open(res.whatsappUrl, '_blank');
                toast.success(`Reminder sent to ${res.tenantName}`);
            } catch (e: any) {
                toast.error(e.message || 'Failed');
            } finally { setSendingId(null); }
        });
    };

    const TABS: { key: Tab; label: string; count: number }[] = [
        { key: 'ALL', label: 'All', count: invoices.length },
        { key: 'ONLINE', label: '🌐 Online Paid', count: onlinePaid.length },
        { key: 'CASH', label: '💵 Cash Paid', count: cashPaid.length },
        { key: 'PENDING', label: '⏳ Pending', count: pendingInvoices.length },
        { key: 'OVERDUE', label: '🚨 Overdue', count: overdueInvoices.length },
        { key: 'TOKEN', label: '🔐 Token Paid', count: tokenPayments.length },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <IndianRupee className="w-6 h-6 text-indigo-600" /> Rent & Payments
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">Full rent collection dashboard</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setMonth(getPreviousMonth())}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${month === getPreviousMonth() ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        Last Month
                    </button>
                    <button onClick={() => setMonth(getCurrentMonth())}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${month === getCurrentMonth() ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        This Month
                    </button>
                    <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-400" />
                    <button onClick={() => reload(month)} disabled={loading}
                        className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* 6 Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[
                    { label: 'Total Received', val: fmt(totalReceived), icon: '💰', color: 'bg-green-50 border-green-200 text-green-800' },
                    { label: 'Online Received', val: fmt(onlineReceived), icon: '🌐', color: 'bg-sky-50 border-sky-200 text-sky-800' },
                    { label: 'Cash Received', val: fmt(cashReceived), icon: '💵', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
                    { label: 'Pending (Not Late)', val: fmt(totalPending), icon: '⏳', color: 'bg-amber-50 border-amber-200 text-amber-800' },
                    { label: 'Overdue (Defaulter)', val: fmt(totalOverdue), icon: '🚨', color: 'bg-red-50 border-red-200 text-red-800' },
                    { label: 'Collection Rate', val: `${collectionRate}%`, icon: '📊', color: 'bg-purple-50 border-purple-200 text-purple-800' },
                ].map(c => (
                    <div key={c.label} className={`p-4 rounded-2xl border-2 ${c.color} shadow-sm`}>
                        <div className="text-xl mb-1">{c.icon}</div>
                        <div className="text-xl font-black">{c.val}</div>
                        <div className="text-[10px] font-semibold opacity-70 mt-0.5">{c.label}</div>
                    </div>
                ))}
            </div>

            {/* Token Payments Banner — shown when tokens exist this month */}
            {tokenPayments.length > 0 && (
                <div className="flex items-center justify-between p-4 rounded-2xl border-2 border-teal-200 bg-teal-50">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🔐</span>
                        <div>
                            <p className="text-sm font-black text-teal-800">Token / Room-Lock Payments This Month</p>
                            <p className="text-xs text-teal-600">{tokenPayments.length} booking{tokenPayments.length > 1 ? 's' : ''} paid token · Total {fmt(tokenTotal)}</p>
                        </div>
                    </div>
                    <button onClick={() => setTab('TOKEN')}
                        className="text-[11px] font-black px-3 py-1.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors">
                        View Tokens →
                    </button>
                </div>
            )}

            {/* Tab + Search bar */}
            <div className="flex flex-col lg:flex-row gap-3">
                <div className="bg-white rounded-2xl border border-slate-100 p-1.5 flex gap-1 flex-wrap shrink-0">
                    {TABS.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap transition-all ${tab === t.key ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}>
                            {t.label} ({t.count})
                        </button>
                    ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search by name, room, or ID..."
                            className="pl-9 pr-4 py-2.5 w-full bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                <X className="w-4 h-4 text-slate-400" />
                            </button>
                        )}
                    </div>
                    
                    {/* Property Filter */}
                    <select 
                        value={propertyFilter} 
                        onChange={e => setPropertyFilter(e.target.value)}
                        className="px-3 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 min-w-[150px]"
                    >
                        <option value="ALL">All Properties (PGs)</option>
                        {propertyOptions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>

                    {/* Room Type Filter */}
                    <select 
                        value={roomTypeFilter} 
                        onChange={e => setRoomTypeFilter(e.target.value)}
                        className="px-3 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 min-w-[130px]"
                    >
                        <option value="ALL">All Room Types</option>
                        {roomTypeOptions.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                    </select>

                    {/* Method Filter */}
                    <select 
                        value={methodFilter} 
                        onChange={e => setMethodFilter(e.target.value)}
                        className="px-3 py-2.5 bg-white border-2 border-slate-900 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 shrink-0"
                    >
                        <option value="ALL">All Payments</option>
                        <option value="ONLINE">🌐 Online Only</option>
                        <option value="CASH">💵 Cash Only</option>
                        <option value="UNPAID">❌ Unpaid Only</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-black text-slate-900">Payment Records</h2>
                    <span className="text-xs text-slate-400 font-bold">{filtered.length} records</span>
                </div>

                {loading ? (
                    <div className="py-16 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-16 text-center">
                        <IndianRupee className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="font-black text-slate-400">No records found</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/60">
                                        {['Tenant', 'Tenant ID', 'Phone', 'Room', 'PG Name', 'Amount', 'Month', 'Status', 'Paid On', 'Paid By', 'Rent Payment History', 'Reminder Action', 'Platform Commission Invoice'].map(h => (
                                            <th key={h} className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filtered.map(inv => {
                                        const s = getStatus(inv);
                                        const isPaid = inv.status === 'PAID';
                                        const isUnpaid = !isPaid;
                                        return (
                                            <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <p className="font-black text-slate-900 text-sm whitespace-nowrap">{inv.tenantName}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{inv.tenantDisplayId || '—'}</span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{inv.tenantPhone || '—'}</td>
                                                <td className="px-4 py-3">
                                                    <span className="font-bold text-slate-700 text-sm">{inv.roomNumber}</span>
                                                    {inv.roomType && <p className="text-[9px] uppercase text-slate-400">{inv.roomType}</p>}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{inv.propertyName || '—'}</td>
                                                <td className="px-4 py-3">
                                                    <span className="font-black text-slate-900 whitespace-nowrap">₹{inv.amount.toLocaleString('en-IN')}</span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{inv.month}</td>
                                                <td className="px-4 py-3"><StatusBadge inv={inv} /></td>
                                                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                                                    {inv.paidAt ? format(new Date(inv.paidAt), 'd MMM yyyy') : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-xs whitespace-nowrap">
                                                    {isPaid ? (
                                                        inv.paymentMethod === 'CASH'
                                                            ? <span className="text-slate-600">{inv.confirmedByName || 'Owner'}</span>
                                                            : <span className="text-slate-400 italic">Razorpay Auto</span>
                                                    ) : '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => setHistoryModal({ tenantName: inv.tenantName, tenantDisplayId: inv.tenantDisplayId || '—', history: inv.history })}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black rounded-xl border bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all whitespace-nowrap"
                                                    >
                                                        <History className="w-3 h-3 text-slate-400" />
                                                        {inv.history?.filter((r: any) => r.status === 'PAID').length || 0} / {inv.history?.length || 0} months
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {inv.txnType === 'TOKEN_PAYMENT' ? (
                                                            <div className="space-y-1">
                                                                 <span className="px-2.5 py-1.5 bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-black rounded-lg flex items-center gap-1">
                                                                     🔐 Room Reserved
                                                                 </span>
                                                                 <p className="text-[9px] text-slate-400 font-mono">{inv.tenantDisplayId}</p>
                                                             </div>
                                                         ) : isPaid ? (
                                                             <button
                                                                 disabled
                                                                 className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 text-slate-400 text-[10px] font-black rounded-lg flex items-center gap-1 cursor-not-allowed whitespace-nowrap"
                                                             >
                                                                 ✓ Paid
                                                             </button>
                                                         ) : (
                                                             <>
                                                                 {allowCashPayment && (
                                                                     <button onClick={() => setCashModal(inv)}
                                                                         className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[10px] font-black rounded-lg flex items-center gap-1 whitespace-nowrap">
                                                                         <Banknote className="w-3 h-3" /> Cash Paid
                                                                     </button>
                                                                 )}
                                                                 <button
                                                                     onClick={() => handleReminder(inv)}
                                                                     disabled={isPending && sendingId === inv.id}
                                                                     className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-lg flex items-center gap-1 disabled:opacity-50">
                                                                     {isPending && sendingId === inv.id
                                                                         ? <Loader2 className="w-3 h-3 animate-spin" />
                                                                         : <MessageCircle className="w-3 h-3" />}
                                                                     Remind
                                                                 </button>
                                                             </>
                                                         )}
                                                     </div>
                                                 </td>
                                                 <td className="px-4 py-3">
                                                     <button
                                                         onClick={() => setCommissionModal({ tenantName: inv.tenantName, tenantDisplayId: inv.tenantDisplayId || '—', history: inv.history })}
                                                         className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black rounded-xl border bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 hover:text-amber-800 transition-all whitespace-nowrap"
                                                     >
                                                         <FileText className="w-3 h-3 text-amber-600" />
                                                         Commission
                                                     </button>
                                                 </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {filtered.map(inv => {
                                const isPaid = inv.status === 'PAID';
                                return (
                                    <div key={inv.id} className="p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-black text-slate-900">{inv.tenantName}</p>
                                                <p className="text-[10px] font-mono text-indigo-500">{inv.tenantDisplayId}</p>
                                                <p className="text-xs text-slate-400">{inv.propertyName} · Room {inv.roomNumber}</p>
                                            </div>
                                            <StatusBadge inv={inv} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-black text-slate-900">₹{inv.amount.toLocaleString('en-IN')}</p>
                                                <p className="text-xs text-slate-400">{inv.month}</p>
                                            </div>
                                            <button
                                                onClick={() => setHistoryModal({ tenantName: inv.tenantName, tenantDisplayId: inv.tenantDisplayId || '—', history: inv.history })}
                                                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black rounded-xl border bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all"
                                            >
                                                <History className="w-3 h-3 text-slate-400" />
                                                {inv.history?.length || 0} months
                                            </button>
                                        </div>
                                        {!isPaid && (
                                            <div className="flex gap-2">
                                                {allowCashPayment && (
                                                    <button onClick={() => setCashModal(inv)}
                                                        className="flex-1 py-2 bg-green-600 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1">
                                                        <Banknote className="w-3.5 h-3.5" /> Cash Paid
                                                    </button>
                                                )}
                                                <button onClick={() => handleReminder(inv)} disabled={isPending}
                                                    className="flex-1 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1 disabled:opacity-50">
                                                    <MessageCircle className="w-3.5 h-3.5" /> Remind
                                                </button>
                                            </div>
                                        )}
                                        {isPaid && (
                                            <button
                                                onClick={() => setReceiptModal(inv.id)}
                                                className="w-full py-2 text-center bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 hover:bg-indigo-100"
                                            >
                                                <Eye className="w-3.5 h-3.5" /> View Receipt
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Cash Confirm Modal */}
            {cashModal && (
                <CashConfirmModal
                    inv={cashModal}
                    onClose={() => setCashModal(null)}
                    onConfirm={handleCashPaid}
                />
            )}

            {/* Receipt Preview Modal */}
            {receiptModal && (
                <ReceiptModal
                    invoiceId={receiptModal}
                    onClose={() => setReceiptModal(null)}
                />
            )}

            {/* History Preview Modal */}
            {historyModal && (
                <HistoryModal
                    tenantName={historyModal.tenantName}
                    tenantDisplayId={historyModal.tenantDisplayId}
                    history={historyModal.history}
                    onClose={() => setHistoryModal(null)}
                    onSelectReceipt={(invoiceId) => {
                        setHistoryModal(null);
                        setReceiptModal(invoiceId);
                    }}
                />
            )}

            {/* Commission Preview Modal */}
            {commissionModal && (
                <CommissionModal
                    tenantName={commissionModal.tenantName}
                    tenantDisplayId={commissionModal.tenantDisplayId}
                    history={commissionModal.history}
                    onClose={() => setCommissionModal(null)}
                />
            )}
        </div>
    );
}
