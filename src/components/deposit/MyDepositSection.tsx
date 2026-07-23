'use client';

import { useEffect, useState, useTransition } from 'react';
import { getMyDepositStatus } from '@/actions/ownerRentCollection';
import { raiseDepositDispute } from '@/actions/disputeDeposit';
import { toast } from 'sonner';
import {
    Shield, AlertTriangle, CheckCircle2, Clock, X,
    ChevronDown, ChevronUp, MessageSquare, Loader2, Info
} from 'lucide-react';
import { TENANT_STATUS } from '@/lib/constants/statuses';

// ── Status config for student view ───────────────────────────────────────────
const DEPOSIT_STATUS: Record<string, { label: string; icon: string; cls: string; desc: string }> = {
    PENDING: {
        label: 'Collection Pending',
        icon: '⏳',
        cls: 'bg-slate-100 text-slate-700 border-slate-200',
        desc: 'Deposit has not been collected yet.'
    },
    PAID: {
        label: 'Held by Owner',
        icon: '🔐',
        cls: 'bg-blue-100 text-blue-700 border-blue-200',
        desc: 'Your deposit is securely held by the property owner.'
    },
    REFUND_PENDING: {
        label: 'Refund in Progress',
        icon: '⏳',
        cls: 'bg-amber-100 text-amber-700 border-amber-200',
        desc: 'Refund is being processed by the owner.'
    },
    REFUND_OVERDUE: {
        label: 'Refund Overdue',
        icon: '⚠️',
        cls: 'bg-red-100 text-red-700 border-red-200',
        desc: 'The refund deadline has passed. You can raise a dispute.'
    },
    PARTIALLY_REFUNDED: {
        label: 'Partially Refunded',
        icon: '✅',
        cls: 'bg-teal-100 text-teal-700 border-teal-200',
        desc: 'A partial refund was processed after deductions.'
    },
    REFUNDED: {
        label: 'Fully Refunded',
        icon: '✅',
        cls: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        desc: 'Your full deposit has been refunded.'
    },
    FORFEITED: {
        label: 'Forfeited',
        icon: '❌',
        cls: 'bg-rose-100 text-rose-700 border-rose-200',
        desc: 'Deposit was forfeited due to deductions exceeding the deposit amount.'
    },
    REFUNDED_VIA_WITHHOLDING: {
        label: 'Settled via RentPe',
        icon: '🛡️',
        cls: 'bg-purple-100 text-purple-700 border-purple-200',
        desc: 'RentPe recovered your deposit from the owner\'s future payouts.'
    },
};

// ── Raise Dispute Modal ───────────────────────────────────────────────────────
function DisputeModal({ depositId, onClose }: { depositId: string; onClose: () => void }) {
    const [reason, setReason] = useState('');
    const [details, setDetails] = useState('');
    const [isPending, startTransition] = useTransition();

    const handleSubmit = () => {
        if (!reason.trim()) { toast.error('Please provide a reason for the dispute.'); return; }
        startTransition(async () => {
            try {
                const result = await raiseDepositDispute(depositId, reason, details);
                toast.success(`Dispute raised! Reference: ${result.displayId}. Our team will review within 3–5 business days.`);
                onClose();
            } catch (e: any) {
                toast.error(e.message || 'Failed to raise dispute. Please try again.');
            }
        });
    };

    const COMMON_REASONS = [
        'Owner has not refunded deposit after 15+ days of move-out',
        'I disagree with the deduction amount — it seems excessive',
        'I was not notified about the deduction breakdown',
        'Owner is not responding to my refund requests',
    ];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 rounded-t-3xl relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full" />
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-xl transition-all">
                        <X className="w-4 h-4 text-white" />
                    </button>
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-amber-100">Deposit Dispute</p>
                            <p className="font-black text-white text-lg">Raise a Dispute</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
                        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700">RentPe will review your case and assist. If the owner still doesn't refund, we will recover it from their future rent payouts.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Reason for Dispute *</label>
                        <div className="space-y-2 mb-3">
                            {COMMON_REASONS.map(r => (
                                <button
                                    key={r}
                                    onClick={() => setReason(r)}
                                    className={`w-full text-left text-xs p-3 rounded-xl border transition-all font-medium ${reason === r ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                        <textarea
                            rows={2}
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="Or type your own reason..."
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none text-slate-700"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Additional Details (Optional)</label>
                        <textarea
                            rows={2}
                            value={details}
                            onChange={e => setDetails(e.target.value)}
                            placeholder="Any additional context (dates, amounts, communication history)..."
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none text-slate-700"
                        />
                    </div>

                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 border-2 border-slate-200 text-slate-600 font-black text-sm rounded-2xl hover:border-slate-300 transition-all">
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isPending || !reason.trim()}
                            className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-sm rounded-2xl hover:shadow-lg hover:shadow-amber-500/25 transition-all disabled:opacity-50"
                        >
                            {isPending ? (
                                <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Submitting...</span>
                            ) : '🚀 Submit Dispute'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── My Deposit Section (exported for use in student dashboard) ────────────────
export function MyDepositSection() {
    const [depositData, setDepositData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const [showDispute, setShowDispute] = useState(false);

    useEffect(() => {
        getMyDepositStatus()
            .then(data => { setDepositData(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    // Don't show if no deposit found
    if (loading) return null;
    if (!depositData) return null;

    const dep = depositData;
    const statusConfig = DEPOSIT_STATUS[dep.status] || DEPOSIT_STATUS.PAID;
    const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

    const hasDeductions = dep.deductionAmount && dep.deductionAmount > 0;
    const bd = dep.deductionBreakdown;

    return (
        <div className={`rounded-3xl border-2 overflow-hidden shadow-lg transition-all duration-300 ${
            dep.status === 'REFUND_OVERDUE' ? 'border-red-300 shadow-red-100' :
            dep.status === 'REFUNDED' || dep.status === 'REFUNDED_VIA_WITHHOLDING' ? 'border-emerald-300 shadow-emerald-100' :
            'border-indigo-200 shadow-indigo-50'
        }`}>
            {/* Header */}
            <div className={`p-4 flex items-center justify-between ${
                dep.status === 'REFUND_OVERDUE' ? 'bg-gradient-to-r from-red-500 to-rose-500' :
                dep.status === 'REFUNDED' || dep.status === 'REFUNDED_VIA_WITHHOLDING' ? 'bg-gradient-to-r from-emerald-500 to-teal-600' :
                dep.status === 'PARTIALLY_REFUNDED' ? 'bg-gradient-to-r from-teal-500 to-emerald-500' :
                'bg-gradient-to-r from-indigo-500 to-purple-600'
            }`}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                        <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-white/80">My Security Deposit</p>
                        <p className="font-black text-white text-lg">{fmt(dep.depositAmount)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black border bg-white/20 text-white border-white/30`}>
                        {statusConfig.icon} {statusConfig.label}
                    </span>
                    <button onClick={() => setExpanded(e => !e)} className="p-2 hover:bg-white/20 rounded-xl transition-all">
                        {expanded ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="bg-white">
                {/* Summary bar — always visible */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-xs font-medium">{statusConfig.desc}</span>
                    </div>
                    {dep.refundAmount !== null && dep.refundAmount !== undefined && (
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Refund</p>
                            <p className={`font-black text-sm ${dep.refundAmount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(dep.refundAmount)}</p>
                        </div>
                    )}
                </div>

                {/* Overdue Warning */}
                {dep.status === 'REFUND_OVERDUE' && (
                    <div className="mx-4 mt-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
                        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-black text-red-800 text-sm">Refund is Overdue!</p>
                            <p className="text-red-600 text-xs mt-1">
                                The 15-day refund deadline has passed. You can raise a dispute and RentPe will help recover your deposit from the owner's future rent payouts.
                            </p>
                        </div>
                    </div>
                )}

                {/* Days remaining banner */}
                {dep.refundDueBy && dep.status === 'PAID' && dep.tenantStatus === TENANT_STATUS.CHECKED_OUT && (
                    <div className="mx-4 mt-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-3">
                        <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <div>
                            <p className="font-bold text-amber-800 text-sm">
                                {dep.daysRemaining > 0
                                    ? `${dep.daysRemaining} days remaining for owner to process your refund`
                                    : 'Refund deadline reached'}
                            </p>
                            <p className="text-amber-600 text-xs">Due by: {new Date(dep.refundDueBy).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                        </div>
                    </div>
                )}

                {/* Active Dispute */}
                {dep.activeDispute && (
                    <div className="mx-4 mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <MessageSquare className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-black text-amber-800 text-sm">Dispute Active — Ref: {dep.activeDispute.displayId}</p>
                            <p className="text-amber-600 text-xs mt-1">Status: {dep.activeDispute.status}. Our team is reviewing your case.</p>
                        </div>
                    </div>
                )}

                {/* Expandable details */}
                {expanded && (
                    <div className="p-4 space-y-4 animate-in fade-in duration-200">
                        {/* Property info */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 rounded-xl p-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Property</p>
                                <p className="text-sm font-black text-slate-800">{dep.propertyName || '—'}</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Room</p>
                                <p className="text-sm font-black text-slate-800">{dep.roomNumber || '—'}</p>
                            </div>
                        </div>

                        {/* Settlement Breakdown */}
                        {hasDeductions && (
                            <div className="bg-slate-50 rounded-2xl p-4">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Settlement Breakdown</p>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Original Deposit</span>
                                        <span className="font-black text-slate-900">{fmt(dep.depositAmount)}</span>
                                    </div>
                                    {bd.damages > 0 && <div className="flex justify-between"><span className="text-red-500 text-xs">− Room Damages</span><span className="font-bold text-red-600 text-xs">{fmt(bd.damages)}</span></div>}
                                    {bd.utilities > 0 && <div className="flex justify-between"><span className="text-red-500 text-xs">− Utilities</span><span className="font-bold text-red-600 text-xs">{fmt(bd.utilities)}</span></div>}
                                    {bd.unpaidRent > 0 && <div className="flex justify-between"><span className="text-red-500 text-xs">− Unpaid Rent</span><span className="font-bold text-red-600 text-xs">{fmt(bd.unpaidRent)}</span></div>}
                                    {bd.noticePeriod > 0 && <div className="flex justify-between"><span className="text-red-500 text-xs">− Notice Period</span><span className="font-bold text-red-600 text-xs">{fmt(bd.noticePeriod)}</span></div>}
                                    {bd.other > 0 && <div className="flex justify-between"><span className="text-red-500 text-xs">− Other</span><span className="font-bold text-red-600 text-xs">{fmt(bd.other)}</span></div>}
                                    <div className="border-t border-slate-200 pt-2 flex justify-between">
                                        <span className={`font-black ${dep.refundAmount > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                            {dep.refundAmount > 0 ? '✅ Refund to You' : '❌ No Refund'}
                                        </span>
                                        <span className={`font-black text-base ${dep.refundAmount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {fmt(dep.refundAmount || 0)}
                                        </span>
                                    </div>
                                </div>
                                {dep.settlementNotes && (
                                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                                        <p className="text-xs text-amber-700"><strong>Owner's Note:</strong> {dep.settlementNotes}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Info note */}
                        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
                            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-700">
                                RentPe is an aggregator — the deposit is between you and your owner. If you face issues, raise a dispute and we will assist by recovering from the owner's future payouts.
                            </p>
                        </div>
                    </div>
                )}

                {/* Raise Dispute CTA */}
                {dep.canRaiseDispute && (
                    <div className="px-4 pb-4">
                        <button
                            id="raise-deposit-dispute-btn"
                            onClick={() => setShowDispute(true)}
                            className={`w-full py-3.5 font-black text-sm rounded-2xl text-white transition-all shadow-lg ${
                                dep.status === 'REFUND_OVERDUE'
                                    ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:shadow-red-500/25'
                                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-amber-500/25'
                            }`}
                        >
                            🚨 Raise Deposit Dispute
                        </button>
                        <p className="text-center text-xs text-slate-400 mt-2">Disputes are reviewed within 3–5 business days</p>
                    </div>
                )}

                {/* Settled message */}
                {['REFUNDED', 'REFUNDED_VIA_WITHHOLDING'].includes(dep.status) && (
                    <div className="px-4 pb-4 flex items-center justify-center gap-2 text-emerald-600">
                        <CheckCircle2 className="w-5 h-5" />
                        <p className="font-black text-sm">Deposit fully settled ✓</p>
                    </div>
                )}
            </div>

            {/* Dispute Modal */}
            {showDispute && <DisputeModal depositId={dep.depositId} onClose={() => setShowDispute(false)} />}
        </div>
    );
}
