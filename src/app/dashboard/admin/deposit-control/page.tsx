'use client';

import { useEffect, useState, useTransition } from 'react';
import {
    getPendingTransfers,
    releaseTransferToOwner,
    applyRentWithholding,
    getPendingTransfers as refreshTransfers
} from '@/actions/payments';
import {
    getOwnerOverdueDepositCount,
    checkDepositRefundCompliance
} from '@/actions/ownerRentCollection';
import { getAllDepositDisputes, resolveDepositDispute } from '@/actions/disputeDeposit';
import { unwrap } from '@/lib/safe-action';
import { toast } from 'sonner';
import {
    Shield, Loader2, RefreshCcw, CheckCircle2, AlertTriangle,
    DollarSign, Zap, FileText, ChevronRight, X, ArrowRight
} from 'lucide-react';

// ── Release Transfer Modal ──────────────────────────────────────────────────
function ReleaseModal({ payment, onClose, onSuccess }: { payment: any; onClose: () => void; onSuccess: () => void }) {
    const [isPending, startTransition] = useTransition();
    const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

    const handleRelease = () => {
        startTransition(async () => {
            try {
                const result = await releaseTransferToOwner(payment.paymentId);
                toast.success(`Transfer released! ID: ${result.transferId}${result.isDummy ? ' [DUMMY MODE]' : ''}`);
                onSuccess();
                onClose();
            } catch (e: any) {
                toast.error(e.message || 'Failed to release transfer');
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 rounded-t-3xl relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full" />
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-xl transition-all">
                        <X className="w-4 h-4 text-white" />
                    </button>
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                            <ArrowRight className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-emerald-100">Release Transfer</p>
                            <p className="font-black text-white text-lg">{fmt(payment.amount)}</p>
                        </div>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Booking</span>
                            <span className="font-black text-slate-900">{payment.bookingDisplayId}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Property</span>
                            <span className="font-bold text-slate-800">{payment.propertyName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Owner</span>
                            <span className="font-bold text-slate-800">{payment.ownerName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Amount</span>
                            <span className="font-black text-emerald-600">{fmt(payment.amount)}</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">
                            This will release the payment to the owner's Razorpay linked account.
                            Ensure the owner has NO overdue deposit refunds before releasing.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 border-2 border-slate-200 text-slate-600 font-black text-sm rounded-2xl">Cancel</button>
                        <button
                            onClick={handleRelease}
                            disabled={isPending}
                            className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-sm rounded-2xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50"
                        >
                            {isPending ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Releasing...</span> : '✅ Release Transfer'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Resolve Dispute Modal ───────────────────────────────────────────────────
function ResolveDisputeModal({ dispute, onClose, onSuccess }: { dispute: any; onClose: () => void; onSuccess: () => void }) {
    const [resolution, setResolution] = useState('');
    const [action, setAction] = useState<'FAVOR_STUDENT' | 'FAVOR_OWNER' | 'PARTIAL' | 'DISMISSED'>('FAVOR_STUDENT');
    const [isPending, startTransition] = useTransition();

    const handleResolve = () => {
        if (!resolution.trim()) { toast.error('Please provide resolution notes'); return; }
        startTransition(async () => {
            try {
                await resolveDepositDispute(dispute.id, resolution, action);
                toast.success('Dispute resolved successfully!');
                onSuccess();
                onClose();
            } catch (e: any) {
                toast.error(e.message || 'Failed to resolve dispute');
            }
        });
    };

    const ACTIONS: { value: typeof action; label: string; desc: string; cls: string }[] = [
        { value: 'FAVOR_STUDENT', label: '✅ Favor Student', desc: 'Full refund to student, withhold from owner', cls: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
        { value: 'FAVOR_OWNER', label: '🏠 Favor Owner', desc: 'Deductions are valid, close dispute', cls: 'border-blue-400 bg-blue-50 text-blue-800' },
        { value: 'PARTIAL', label: '⚖️ Partial Resolution', desc: 'Compromise — partial refund to student', cls: 'border-amber-400 bg-amber-50 text-amber-800' },
        { value: 'DISMISSED', label: '❌ Dismissed', desc: 'No valid grounds, case closed', cls: 'border-slate-300 bg-slate-50 text-slate-600' },
    ];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-t-3xl sticky top-0">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-xl transition-all">
                        <X className="w-4 h-4 text-white" />
                    </button>
                    <p className="text-xs font-black uppercase tracking-widest text-indigo-200 mb-1">Resolve Dispute</p>
                    <p className="font-black text-white">{dispute.displayId}</p>
                    <p className="text-indigo-200 text-sm">{dispute.tenantName}</p>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Student's Complaint</p>
                        <p className="text-sm text-slate-700">{dispute.description}</p>
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Decision</p>
                        <div className="space-y-2">
                            {ACTIONS.map(a => (
                                <button
                                    key={a.value}
                                    onClick={() => setAction(a.value)}
                                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${action === a.value ? a.cls + ' border-current' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                                >
                                    <p className="font-black text-sm">{a.label}</p>
                                    <p className="text-xs mt-0.5 opacity-70">{a.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Resolution Notes *</label>
                        <textarea
                            rows={3}
                            value={resolution}
                            onChange={e => setResolution(e.target.value)}
                            placeholder="Explain your decision..."
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 border-2 border-slate-200 text-slate-600 font-black text-sm rounded-2xl">Cancel</button>
                        <button onClick={handleResolve} disabled={isPending || !resolution.trim()} className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm rounded-2xl disabled:opacity-50 transition-all">
                            {isPending ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Resolving...</span> : '⚖️ Resolve Dispute'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main Admin Deposit Control Panel ────────────────────────────────────────
export default function AdminDepositControlPage() {
    const [transfers, setTransfers] = useState<any[]>([]);
    const [disputes, setDisputes] = useState<any[]>([]);
    const [overdueInfo, setOverdueInfo] = useState<{ count: number; totalAmount: number }>({ count: 0, totalAmount: 0 });
    const [loading, setLoading] = useState(true);
    const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
    const [selectedDispute, setSelectedDispute] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'transfers' | 'disputes' | 'overdue'>('transfers');
    const [runningCompliance, startCompliance] = useTransition();
    const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

    const load = () => {
        setLoading(true);
        Promise.all([
            getPendingTransfers(),
            getAllDepositDisputes(),
            getOwnerOverdueDepositCount(),
        ]).then(([t, d, o]) => {
            setTransfers(t);
            setDisputes(d);
            setOverdueInfo(o);
            setLoading(false);
        }).catch(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const runComplianceCheck = () => {
        startCompliance(async () => {
            try {
                const result = await unwrap(checkDepositRefundCompliance());
                toast.success(`Compliance check done! ${result.processed} deposits escalated.`);
                load();
            } catch (e: any) {
                toast.error(e.message || 'Compliance check failed');
            }
        });
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
    );

    const tabs = [
        { id: 'transfers', label: 'Pending Transfers', count: transfers.length, icon: ArrowRight, color: 'text-emerald-600' },
        { id: 'disputes', label: 'Deposit Disputes', count: disputes.filter(d => d.status !== 'RESOLVED').length, icon: Shield, color: 'text-amber-600' },
        { id: 'overdue', label: 'Overdue Refunds', count: overdueInfo.count, icon: AlertTriangle, color: 'text-red-600' },
    ] as const;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">

            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 px-6 pt-10 pb-20 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
                <div className="max-w-6xl mx-auto relative z-10">
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <Shield className="w-8 h-8 text-indigo-400" /> Win-Win Deposit Control Center
                    </h1>
                    <p className="text-indigo-300 text-sm mt-1">Manage delayed transfers · Resolve disputes · Enforce rent withholding</p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 -mt-12 relative z-10 space-y-6">

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100">
                        <p className="text-2xl font-black text-emerald-600">{fmt(transfers.reduce((s, t) => s + t.amount, 0))}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Held in Nodal</p>
                        <p className="text-xs text-slate-300">{transfers.length} pending releases</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100">
                        <p className="text-2xl font-black text-amber-600">{disputes.filter(d => d.status !== 'RESOLVED').length}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Open Disputes</p>
                        <p className="text-xs text-slate-300">Awaiting resolution</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100">
                        <p className="text-2xl font-black text-red-600">{overdueInfo.count}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Overdue Deposits</p>
                        <p className="text-xs text-slate-300">{fmt(overdueInfo.totalAmount)} at risk</p>
                    </div>
                </div>

                {/* Compliance Trigger */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 flex items-center justify-between shadow-lg">
                    <div>
                        <p className="font-black text-white">Auto-Compliance Check</p>
                        <p className="text-indigo-200 text-sm">Scan for deposits past 15-day deadline and escalate to REFUND_OVERDUE</p>
                    </div>
                    <button
                        onClick={runComplianceCheck}
                        disabled={runningCompliance}
                        className="flex items-center gap-2 px-5 py-3 bg-white text-indigo-700 font-black text-sm rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex-shrink-0 ml-4"
                    >
                        {runningCompliance ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        Run Now
                    </button>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="flex border-b border-slate-100">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-black transition-all border-b-2 ${isActive ? `${tab.color} border-current bg-slate-50/50` : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    {tab.count > 0 && (
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isActive ? 'bg-current/10 text-current' : 'bg-slate-100 text-slate-500'}`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Pending Transfers */}
                    {activeTab === 'transfers' && (
                        <div>
                            {transfers.length === 0 ? (
                                <div className="py-16 text-center">
                                    <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                                    <p className="font-black text-slate-400">No pending transfers</p>
                                    <p className="text-xs text-slate-300 mt-1">All payments have been released to owners</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {transfers.map(t => (
                                        <div key={t.paymentId} className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors gap-4">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-slate-900">{t.propertyName}</p>
                                                <p className="text-xs text-slate-500">{t.ownerName} · Booking: {t.bookingDisplayId}</p>
                                                <p className="text-[10px] text-slate-400">{new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="font-black text-slate-900">{fmt(t.amount)}</p>
                                                <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-black">⏳ HELD</span>
                                            </div>
                                            <button
                                                onClick={() => setSelectedTransfer(t)}
                                                id={`release-btn-${t.paymentId}`}
                                                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all flex-shrink-0"
                                            >
                                                Release →
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Disputes */}
                    {activeTab === 'disputes' && (
                        <div>
                            {disputes.length === 0 ? (
                                <div className="py-16 text-center">
                                    <Shield className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                    <p className="font-black text-slate-400">No deposit disputes</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {disputes.map(d => {
                                        const statusCls = ({
                                            OPEN: 'bg-red-100 text-red-700',
                                            IN_REVIEW: 'bg-amber-100 text-amber-700',
                                            ESCALATED: 'bg-orange-100 text-orange-700',
                                            RESOLVED: 'bg-emerald-100 text-emerald-700',
                                        } as Record<string, string>)[d.status] || 'bg-slate-100 text-slate-600';
                                        const priorityCls = d.priority === 'HIGH' ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-600';
                                        return (
                                            <div key={d.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                                                <div className="flex items-start justify-between gap-3 mb-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${statusCls}`}>{d.status}</span>
                                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${priorityCls}`}>{d.priority}</span>
                                                            <span className="text-[10px] font-mono text-slate-400">{d.displayId}</span>
                                                        </div>
                                                        <p className="font-black text-slate-900">{d.tenantName}</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">{d.description?.slice(0, 100)}...</p>
                                                    </div>
                                                    {d.status !== 'RESOLVED' && (
                                                        <button
                                                            onClick={() => setSelectedDispute(d)}
                                                            id={`resolve-btn-${d.id}`}
                                                            className="px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-xs rounded-xl hover:shadow-lg transition-all flex-shrink-0"
                                                        >
                                                            Resolve
                                                        </button>
                                                    )}
                                                </div>
                                                {d.resolution && (
                                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 mt-2">
                                                        <p className="text-xs text-emerald-700"><strong>Resolution:</strong> {d.resolution}</p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Overdue */}
                    {activeTab === 'overdue' && (
                        <div className="p-6">
                            {overdueInfo.count === 0 ? (
                                <div className="py-10 text-center">
                                    <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                                    <p className="font-black text-slate-400">No overdue deposit refunds</p>
                                    <p className="text-xs text-slate-300 mt-1">All owners are processing refunds on time</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
                                        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-black text-red-800">{overdueInfo.count} overdue deposit refunds · {fmt(overdueInfo.totalAmount)} at risk</p>
                                            <p className="text-red-600 text-sm mt-1">
                                                Run the Compliance Check above to escalate them to REFUND_OVERDUE status,
                                                then use "Apply Withholding" from owner payouts to recover the amount.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
                                        <p className="font-black text-indigo-800 text-sm mb-2">🛡️ Enforcement Procedure</p>
                                        <ol className="text-xs text-indigo-700 space-y-2 list-decimal list-inside">
                                            <li>Run Compliance Check to flag overdue deposits</li>
                                            <li>Notify the owner (auto-done via system notification)</li>
                                            <li>If still not resolved, use <code className="bg-indigo-100 px-1 rounded">applyRentWithholding()</code> to deduct from next payout</li>
                                            <li>Mark deposit as <code className="bg-indigo-100 px-1 rounded">REFUNDED_VIA_WITHHOLDING</code></li>
                                            <li>Manually transfer to student's bank account</li>
                                        </ol>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {selectedTransfer && <ReleaseModal payment={selectedTransfer} onClose={() => setSelectedTransfer(null)} onSuccess={load} />}
            {selectedDispute && <ResolveDisputeModal dispute={selectedDispute} onClose={() => setSelectedDispute(null)} onSuccess={load} />}
        </div>
    );
}
