'use client';

import { useEffect, useState, useTransition } from 'react';
import { getOwnerDeposits, updateDepositStatus } from '@/actions/ownerRentCollection';
import { toast } from 'sonner';
import { Shield, Loader2, X, AlertCircle } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
    PENDING:              { label: 'Pending Collection',cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    PAID:                 { label: 'Held',             cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    REFUND_PENDING:       { label: 'Refund Pending',   cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    REFUNDED:             { label: 'Refunded',         cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    PARTIALLY_REFUNDED:   { label: 'Part Refunded',    cls: 'bg-teal-100 text-teal-700 border-teal-200' },
    FORFEITED:            { label: 'Forfeited',        cls: 'bg-red-100 text-red-700 border-red-200' },
};

export default function DepositsPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<any>(null);
    const [actionType, setActionType] = useState<'REFUNDED' | 'FORFEITED' | null>(null);
    const [refundAmount, setRefundAmount] = useState('');
    const [reason, setReason] = useState('');
    const [isPending, startTransition] = useTransition();

    const reload = () => {
        setLoading(true);
        getOwnerDeposits().then(d => {
            setData(d);
            setLoading(false);
        });
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
                setSelected(null);
                setActionType(null);
                setRefundAmount('');
                setReason('');
                reload();
            } catch (e: any) {
                toast.error(e.message || 'Action failed');
            }
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
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 pt-10 pb-20 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="max-w-5xl mx-auto relative z-10">
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <Shield className="w-8 h-8" /> Security Deposits
                    </h1>
                    <p className="text-indigo-200 text-sm font-medium mt-1">Manage all tenant security deposits</p>
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
                    <div className="p-5 border-b border-slate-100">
                        <h2 className="font-black text-slate-900">All Security Deposits</h2>
                    </div>

                    {deposits.length === 0 ? (
                        <div className="py-16 text-center">
                            <Shield className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                            <p className="font-black text-slate-400">No security deposits found</p>
                        </div>
                    ) : (
                        <>
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/50">
                                            {['Tenant', 'Room', 'Deposit Amount', 'Status', 'Action'].map(h => (
                                                <th key={h} className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {deposits.map((dep: any) => {
                                            const sc = STATUS_CONFIG[dep.status] || STATUS_CONFIG.PENDING;
                                            return (
                                                <tr key={dep.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-5 py-4">
                                                        <p className="font-black text-slate-900 text-sm">{dep.tenantName}</p>
                                                        <p className="text-xs text-slate-400">{dep.tenantPhone}</p>
                                                    </td>
                                                    <td className="px-5 py-4 text-sm font-bold text-slate-600">{dep.roomNumber}</td>
                                                    <td className="px-5 py-4">
                                                        <p className="font-black text-slate-900">₹{dep.amount.toLocaleString('en-IN')}</p>
                                                        {dep.refundAmount && (
                                                            <p className="text-xs text-emerald-600">Refund: ₹{dep.refundAmount.toLocaleString('en-IN')}</p>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase ${sc.cls}`}>
                                                            {sc.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        {dep.status === 'PAID' && (
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => { setSelected(dep); setActionType('REFUNDED'); setRefundAmount(String(dep.amount)); }}
                                                                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-black rounded-lg hover:bg-emerald-700 transition-all">
                                                                    Refund
                                                                </button>
                                                                <button
                                                                    onClick={() => { setSelected(dep); setActionType('FORFEITED'); }}
                                                                    className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-black rounded-lg hover:bg-red-100 transition-all border border-red-200">
                                                                    Forfeit
                                                                </button>
                                                            </div>
                                                        )}
                                                        {['REFUNDED', 'PARTIALLY_REFUNDED', 'FORFEITED'].includes(dep.status) && (
                                                            <span className="text-xs text-slate-400 font-medium">Processed</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile */}
                            <div className="md:hidden divide-y divide-slate-100">
                                {deposits.map((dep: any) => {
                                    const sc = STATUS_CONFIG[dep.status] || STATUS_CONFIG.PENDING;
                                    return (
                                        <div key={dep.id} className="p-4 space-y-2">
                                            <div className="flex justify-between">
                                                <div>
                                                    <p className="font-black text-slate-900">{dep.tenantName}</p>
                                                    <p className="text-xs text-slate-400">Room {dep.roomNumber}</p>
                                                </div>
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${sc.cls} h-fit`}>{sc.label}</span>
                                            </div>
                                            <p className="font-black text-slate-800">₹{dep.amount.toLocaleString('en-IN')}</p>
                                            {dep.status === 'PAID' && (
                                                <div className="flex gap-2">
                                                    <button onClick={() => { setSelected(dep); setActionType('REFUNDED'); setRefundAmount(String(dep.amount)); }}
                                                        className="flex-1 py-2 bg-emerald-600 text-white text-xs font-black rounded-xl">Refund</button>
                                                    <button onClick={() => { setSelected(dep); setActionType('FORFEITED'); }}
                                                        className="flex-1 py-2 bg-red-50 text-red-600 border border-red-200 text-xs font-black rounded-xl">Forfeit</button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Action Modal */}
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
                                <p className="text-xs text-slate-500">Deposit Amount: ₹{selected.amount.toLocaleString('en-IN')}</p>
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
                                className={`w-full py-4 font-black text-sm rounded-2xl text-white disabled:opacity-50 transition-all shadow-lg ${actionType === 'REFUNDED' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-200' : 'bg-gradient-to-r from-red-600 to-rose-600 shadow-red-200'}`}>
                                {isPending ? 'Processing...' : (actionType === 'REFUNDED' ? `Confirm Refund ₹${parseFloat(refundAmount || '0').toLocaleString('en-IN')}` : 'Confirm Forfeit')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
