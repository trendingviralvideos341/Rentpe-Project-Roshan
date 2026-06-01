'use client';

import { useEffect, useState, useTransition } from 'react';
import { getOwnerDeposits, updateDepositStatus } from '@/actions/ownerRentCollection';
import { toast } from 'sonner';
import { Shield, Loader2, X, AlertCircle, Receipt, Printer, CheckCircle2, Clock } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
    PENDING:              { label: 'Pending Collection', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    PAID:                 { label: 'Held',               cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    REFUND_PENDING:       { label: 'Refund Pending',     cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    REFUNDED:             { label: 'Refunded',           cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    PARTIALLY_REFUNDED:   { label: 'Part Refunded',      cls: 'bg-teal-100 text-teal-700 border-teal-200' },
    FORFEITED:            { label: 'Forfeited',          cls: 'bg-red-100 text-red-700 border-red-200' },
};

function ReceiptModal({ dep, onClose }: { dep: any; onClose: () => void }) {
    const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
    const now = new Date();
    const collectedDate = dep.collectedOn
        ? new Date(dep.collectedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

    const isPaid = ['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FORFEITED'].includes(dep.status);
    const receiptNo = `DEP-${dep.id.slice(-6).toUpperCase()}`;
    const statusLabel = STATUS_CONFIG[dep.status]?.label || dep.status;
    const depositInvoiceId = `DEP-INV-${dep.id.slice(-8).toUpperCase()}`;

    // Extract room number and bed number from roomAssigned (format: "Room 102 — Bed A" or "102")
    const roomAssigned = dep.roomAssigned || '';
    const roomParts = roomAssigned.split('—');
    const roomDisplay = roomParts[0]?.replace(/room/i, '').trim() || dep.roomNumber || '—';
    const bedDisplay = roomParts[1]?.replace(/bed/i, '').trim() || null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md my-4 overflow-y-auto max-h-[92vh] print:shadow-none print:max-h-none animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white relative overflow-hidden print:bg-indigo-700">
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
                    <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full" />
                    <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-xl transition-all z-10 print:hidden">
                        <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3 mb-3 relative z-10">
                        <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-indigo-200">Security Deposit Receipt</p>
                            <p className="font-black text-lg">{receiptNo}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 relative z-10">
                        {isPaid ? (
                            <span className="flex items-center gap-1.5 bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 text-xs font-black px-3 py-1 rounded-full">
                                <CheckCircle2 className="w-3 h-3" /> {statusLabel}
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 bg-amber-500/30 border border-amber-400/40 text-amber-100 text-xs font-black px-3 py-1 rounded-full">
                                <Clock className="w-3 h-3" /> Pending Collection
                            </span>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">

                    {/* Room + Bed details */}
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
                        {dep.roomType && (
                            <div className="flex-1 bg-slate-50 rounded-xl p-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Type</p>
                                <p className="text-sm font-black text-slate-800">{dep.roomType}</p>
                            </div>
                        )}
                    </div>

                    {/* Tenant Details */}
                    <div className="bg-slate-50 rounded-2xl p-4 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tenant Details</p>
                        <p className="font-black text-slate-900 text-base">{dep.tenantName}</p>
                        {dep.tenantPhone && <p className="text-sm text-slate-500">{dep.tenantPhone}</p>}
                        {dep.tenantEmail && <p className="text-sm text-slate-400">{dep.tenantEmail}</p>}
                    </div>

                    {/* Reference IDs */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-teal-500 mb-1">Deposit Invoice ID</p>
                            <p className="text-xs font-mono font-black text-teal-700">{depositInvoiceId}</p>
                        </div>
                        {dep.bookingDisplayId && (
                            <div className="bg-slate-50 rounded-xl p-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Booking ID</p>
                                <p className="text-xs font-mono font-black text-slate-700">{dep.bookingDisplayId}</p>
                            </div>
                        )}
                    </div>

                    {/* Tenant ID */}
                    {dep.tenantDisplayId && (
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tenant ID</p>
                            <p className="text-xs font-mono font-black text-slate-700">{dep.tenantDisplayId}</p>
                        </div>
                    )}

                    {/* Transaction ID */}
                    <div className={`rounded-xl p-3 ${dep.razorpayId ? 'bg-indigo-50 border border-indigo-100' : 'bg-amber-50 border border-amber-100'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${dep.razorpayId ? 'text-indigo-400' : 'text-amber-500'}`}>Transaction ID (Razorpay)</p>
                        <p className={`text-xs font-mono font-bold break-all ${dep.razorpayId ? 'text-indigo-700' : 'text-amber-600 italic'}`}>
                            {dep.razorpayId || 'Pending / Not yet captured'}
                        </p>
                    </div>

                    {/* Payment Breakdown */}
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Breakdown</p>
                        <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                            <div className="flex justify-between items-center px-4 py-3">
                                <div>
                                    <p className="text-sm font-black text-slate-800">Security Deposit</p>
                                    <p className="text-xs text-slate-400">One-time refundable deposit</p>
                                </div>
                                <p className="font-black text-slate-900">{fmt(dep.amount)}</p>
                            </div>
                            {dep.monthlyRent > 0 && (
                                <div className="flex justify-between items-center px-4 py-3 bg-indigo-50/50">
                                    <div>
                                        <p className="text-sm font-black text-slate-800">First Month Rent</p>
                                        <p className="text-xs text-slate-400">Paid at joining</p>
                                    </div>
                                    <p className="font-black text-indigo-700">{fmt(dep.monthlyRent)}</p>
                                </div>
                            )}
                            <div className="flex justify-between items-center px-4 py-3 bg-slate-50">
                                <p className="text-sm font-black text-slate-600">Total Collected at Joining</p>
                                <p className="font-black text-lg text-slate-900">{fmt(dep.amount + (dep.monthlyRent || 0))}</p>
                            </div>
                        </div>
                    </div>

                    {/* Date + Payment Mode */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Date Collected</p>
                            <p className="text-sm font-black text-slate-700">{collectedDate}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Payment Mode</p>
                            <p className="text-sm font-black text-slate-700">{dep.paymentMethod || '—'}</p>
                        </div>
                    </div>

                    {/* Refund info */}
                    {dep.refundAmount && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">Refund Processed</p>
                            <p className="font-black text-emerald-700">{fmt(dep.refundAmount)}</p>
                            {dep.deductionReason && <p className="text-xs text-emerald-600 mt-1">{dep.deductionReason}</p>}
                        </div>
                    )}

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

                    {/* Actions */}
                    <div className="flex gap-3 print:hidden">
                        <button
                            onClick={() => window.print()}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm rounded-2xl transition-all"
                        >
                            <Printer className="w-4 h-4" /> Print / Save PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl transition-all"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function DepositsPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<any>(null);
    const [actionType, setActionType] = useState<'REFUNDED' | 'FORFEITED' | null>(null);
    const [refundAmount, setRefundAmount] = useState('');
    const [reason, setReason] = useState('');
    const [isPending, startTransition] = useTransition();
    const [receiptDep, setReceiptDep] = useState<any>(null);

    const reload = () => {
        setLoading(true);
        getOwnerDeposits().then(d => { setData(d); setLoading(false); });
    };

    useEffect(() => { reload(); }, []);

    const handleAction = () => {
        if (!selected || !actionType) return;
        startTransition(async () => {
            try {
                await updateDepositStatus(selected.id, actionType, {
                    refundAmount: refundAmount ? parseFloat(refundAmount) : undefined,
                    reason,
                });
                toast.success(`Deposit ${actionType.toLowerCase()} successfully.`);
                setSelected(null); setActionType(null); setRefundAmount(''); setReason('');
                reload();
            } catch (e: any) { toast.error(e.message || 'Action failed'); }
        });
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
    );

    const { deposits, summary } = data;
    const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 pt-10 pb-20 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="max-w-5xl mx-auto relative z-10">
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <Shield className="w-8 h-8" /> Security Deposits
                    </h1>
                    <p className="text-indigo-200 text-sm font-medium mt-1">Manage all tenant security deposits · Latest first</p>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 -mt-12 relative z-10 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Total Deposits Held', val: fmt(summary.totalHeld), sub: `${deposits.filter((d: any) => d.status === 'PAID').length} active` },
                        { label: 'Pending Refund', val: `${summary.refundPending}`, sub: 'need processing' },
                        { label: 'Refunded This Month', val: fmt(summary.refundedThisMonth), sub: 'processed' },
                    ].map(card => (
                        <div key={card.label} className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100 text-center">
                            <p className="text-xl md:text-2xl font-black text-slate-900">{card.val}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{card.label}</p>
                            <p className="text-xs text-slate-300 mt-0.5">{card.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Table */}
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="font-black text-slate-900">All Security Deposits</h2>
                        <span className="text-xs text-slate-400 font-medium">Newest first</span>
                    </div>

                    {deposits.length === 0 ? (
                        <div className="py-16 text-center">
                            <Shield className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                            <p className="font-black text-slate-400">No security deposits found</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/50">
                                            {['#', 'Tenant', 'Room', 'Deposit', 'Date', 'Mode', 'Status', 'Action'].map(h => (
                                                <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {deposits.map((dep: any, idx: number) => {
                                            const sc = STATUS_CONFIG[dep.status] || STATUS_CONFIG.PENDING;
                                            const collDate = dep.collectedOn
                                                ? new Date(dep.collectedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                : '—';
                                            return (
                                                <tr key={dep.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-4 py-4 text-xs font-black text-slate-300">#{deposits.length - idx}</td>
                                                    <td className="px-4 py-4">
                                                        <p className="font-black text-slate-900 text-sm">{dep.tenantName}</p>
                                                        <p className="text-xs text-slate-400">{dep.tenantPhone}</p>
                                                        {dep.bookingDisplayId && <p className="text-[10px] font-mono text-slate-300">{dep.bookingDisplayId}</p>}
                                                    </td>
                                                    <td className="px-4 py-4 text-sm font-bold text-slate-600">{dep.roomNumber}</td>
                                                    <td className="px-4 py-4">
                                                        <p className="font-black text-slate-900">₹{dep.amount.toLocaleString('en-IN')}</p>
                                                        {dep.refundAmount && <p className="text-xs text-emerald-600">Refund: ₹{dep.refundAmount.toLocaleString('en-IN')}</p>}
                                                    </td>
                                                    <td className="px-4 py-4 text-xs text-slate-500 font-medium whitespace-nowrap">{collDate}</td>
                                                    <td className="px-4 py-4 text-xs font-bold text-slate-500">{dep.paymentMethod || '—'}</td>
                                                    <td className="px-4 py-4">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase ${sc.cls}`}>{sc.label}</span>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex gap-2 flex-wrap">
                                                            <button
                                                                onClick={() => setReceiptDep(dep)}
                                                                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-black rounded-lg hover:bg-indigo-100 transition-all border border-indigo-200 flex items-center gap-1"
                                                            >
                                                                <Receipt className="w-3 h-3" /> Receipt
                                                            </button>
                                                            {dep.status === 'PAID' && (
                                                                <>
                                                                    <button
                                                                        onClick={() => { setSelected(dep); setActionType('REFUNDED'); setRefundAmount(String(dep.amount)); }}
                                                                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-black rounded-lg hover:bg-emerald-700 transition-all"
                                                                    >Refund</button>
                                                                    <button
                                                                        onClick={() => { setSelected(dep); setActionType('FORFEITED'); }}
                                                                        className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-black rounded-lg hover:bg-red-100 transition-all border border-red-200"
                                                                    >Forfeit</button>
                                                                </>
                                                            )}
                                                            {['REFUNDED', 'PARTIALLY_REFUNDED', 'FORFEITED'].includes(dep.status) && (
                                                                <span className="text-xs text-slate-400 font-medium self-center">Processed</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile */}
                            <div className="md:hidden divide-y divide-slate-100">
                                {deposits.map((dep: any, idx: number) => {
                                    const sc = STATUS_CONFIG[dep.status] || STATUS_CONFIG.PENDING;
                                    const collDate = dep.collectedOn
                                        ? new Date(dep.collectedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                        : '—';
                                    return (
                                        <div key={dep.id} className="p-4 space-y-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-black text-slate-900">{dep.tenantName}</p>
                                                    <p className="text-xs text-slate-400">Room {dep.roomNumber} · {collDate}</p>
                                                    {dep.paymentMethod && <p className="text-xs text-slate-400">{dep.paymentMethod}</p>}
                                                </div>
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${sc.cls} h-fit`}>{sc.label}</span>
                                            </div>
                                            <p className="font-black text-slate-800">₹{dep.amount.toLocaleString('en-IN')}</p>
                                            <div className="flex gap-2 flex-wrap">
                                                <button
                                                    onClick={() => setReceiptDep(dep)}
                                                    className="flex-1 py-2 bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-black rounded-xl flex items-center justify-center gap-1"
                                                >
                                                    <Receipt className="w-3 h-3" /> Receipt
                                                </button>
                                                {dep.status === 'PAID' && (
                                                    <>
                                                        <button onClick={() => { setSelected(dep); setActionType('REFUNDED'); setRefundAmount(String(dep.amount)); }}
                                                            className="flex-1 py-2 bg-emerald-600 text-white text-xs font-black rounded-xl">Refund</button>
                                                        <button onClick={() => { setSelected(dep); setActionType('FORFEITED'); }}
                                                            className="flex-1 py-2 bg-red-50 text-red-600 border border-red-200 text-xs font-black rounded-xl">Forfeit</button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Receipt Modal */}
            {receiptDep && <ReceiptModal dep={receiptDep} onClose={() => setReceiptDep(null)} />}

            {/* Refund / Forfeit Modal */}
            {selected && actionType && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="font-black text-slate-900">
                                {actionType === 'REFUNDED' ? '💚 Process Refund' : '❌ Forfeit Deposit'}
                            </h2>
                            <button onClick={() => { setSelected(null); setActionType(null); }} className="p-2 hover:bg-slate-100 rounded-xl">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="bg-slate-50 rounded-2xl p-4">
                                <p className="font-black text-slate-900">{selected.tenantName}</p>
                                <p className="text-xs text-slate-500">Deposit: ₹{selected.amount.toLocaleString('en-IN')}</p>
                            </div>
                            {actionType === 'REFUNDED' && (
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Refund Amount (₹)</label>
                                    <input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
                                        max={selected.amount}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                                    {actionType === 'FORFEITED' ? 'Forfeit Reason *' : 'Notes (optional)'}
                                </label>
                                <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
                                    placeholder={actionType === 'FORFEITED' ? 'Reason for forfeiting deposit...' : 'Optional notes...'}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                            </div>
                            {actionType === 'FORFEITED' && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-700 font-medium">This action is irreversible. The deposit will be forfeited and the tenant will be notified.</p>
                                </div>
                            )}
                            <button onClick={handleAction} disabled={isPending || (actionType === 'FORFEITED' && !reason.trim())}
                                className={`w-full py-4 font-black text-sm rounded-2xl text-white disabled:opacity-50 transition-all shadow-lg ${actionType === 'REFUNDED' ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-red-600 to-rose-600'}`}>
                                {isPending ? 'Processing...' : (actionType === 'REFUNDED' ? `Confirm Refund ₹${parseFloat(refundAmount || '0').toLocaleString('en-IN')}` : 'Confirm Forfeit')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
