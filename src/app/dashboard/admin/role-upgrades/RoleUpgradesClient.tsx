'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { processRoleUpgradeRequest } from '@/actions/roleUpgrade';
import {
    Users, CheckCircle, XCircle, Clock, Home,
    ChevronDown, Loader2, RefreshCcw, Shield, Building
} from 'lucide-react';

type UpgradeRequest = {
    id: string;
    requestedRole: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    reason: string | null;
    propertyType: string | null;
    estimatedRooms: number | null;
    adminNote: string | null;
    createdAt: string;
    reviewedAt: string | null;
    user: {
        id: string;
        name: string | null;
        email: string;
        phone: string | null;
        displayId: string | null;
        status: string;
    };
};

interface Props {
    initialRequests: UpgradeRequest[];
}

export function RoleUpgradesClient({ initialRequests }: Props) {
    const [requests, setRequests] = useState<UpgradeRequest[]>(initialRequests);
    const [isPending, startTransition] = useTransition();
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectNote, setRejectNote] = useState('');

    const refreshData = () => window.location.reload();

    const handleApprove = (req: UpgradeRequest) => {
        startTransition(async () => {
            try {
                const result = await processRoleUpgradeRequest(req.id, 'APPROVED', 'Approved by Admin.');
                if ((result as any)?.error) { toast.error((result as any).error); return; }
                toast.success(`✅ ${req.user.name || req.user.email} has been upgraded to Owner!`);
                setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'APPROVED' } : r));
            } catch (err: any) {
                toast.error(err.message || 'Approval failed.');
            }
        });
    };

    const handleReject = (req: UpgradeRequest) => {
        if (!rejectNote.trim()) { toast.error('Please provide a rejection reason.'); return; }
        startTransition(async () => {
            try {
                const result = await processRoleUpgradeRequest(req.id, 'REJECTED', rejectNote);
                if ((result as any)?.error) { toast.error((result as any).error); return; }
                toast.success('Request rejected.');
                setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'REJECTED', adminNote: rejectNote } : r));
                setRejectingId(null);
                setRejectNote('');
            } catch (err: any) {
                toast.error(err.message || 'Rejection failed.');
            }
        });
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const cfg: Record<string, { cls: string; label: string; icon: React.ElementType }> = {
            PENDING:  { cls: 'bg-amber-100 border-amber-300 text-amber-800', label: 'Pending Review', icon: Clock },
            APPROVED: { cls: 'bg-emerald-100 border-emerald-300 text-emerald-800', label: 'Approved', icon: CheckCircle },
            REJECTED: { cls: 'bg-red-100 border-red-300 text-red-800', label: 'Rejected', icon: XCircle },
        };
        const { cls, label, icon: Icon } = cfg[status] || cfg.PENDING;
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${cls}`}>
                <Icon className="h-3 w-3" />{label}
            </span>
        );
    };

    const pending = requests.filter(r => r.status === 'PENDING');
    const processed = requests.filter(r => r.status !== 'PENDING');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
                        <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Role Upgrade Requests</h1>
                        <p className="text-sm text-slate-500">Review and manage Student → Owner upgrade applications</p>
                    </div>
                </div>
                <button
                    onClick={refreshData}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-2 border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                    <RefreshCcw className="h-4 w-4" /> Refresh
                </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Pending', value: requests.filter(r => r.status === 'PENDING').length, color: 'amber' },
                    { label: 'Approved', value: requests.filter(r => r.status === 'APPROVED').length, color: 'emerald' },
                    { label: 'Rejected', value: requests.filter(r => r.status === 'REJECTED').length, color: 'red' },
                ].map(stat => (
                    <div key={stat.label} className={`bg-${stat.color}-50 border-2 border-${stat.color}-100 rounded-2xl p-4 text-center`}>
                        <div className={`text-3xl font-black text-${stat.color}-700`}>{stat.value}</div>
                        <div className={`text-xs font-bold text-${stat.color}-600 uppercase tracking-wider mt-1`}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Pending Requests */}
            {pending.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-amber-200" />
                        <span className="text-xs font-black uppercase tracking-widest text-amber-600 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" /> Pending Review ({pending.length})
                        </span>
                        <div className="h-px flex-1 bg-amber-200" />
                    </div>

                    {pending.map(req => (
                        <div key={req.id} className="bg-white border-2 border-amber-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0 font-black text-indigo-700 text-sm">
                                            {(req.user.name || req.user.email).charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-black text-slate-900">{req.user.name || 'Unknown'}</h3>
                                                <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500">{req.user.displayId || 'N/A'}</span>
                                                <StatusBadge status={req.status} />
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5">{req.user.email} · {req.user.phone || 'No phone'}</p>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                                                    {req.propertyType || 'PG'} · ~{req.estimatedRooms || 1} rooms
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    Requested: {new Date(req.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {req.reason && (
                                    <div className="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-3">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Owner's Reason</p>
                                        <p className="text-sm text-slate-700 italic">"{req.reason}"</p>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                {rejectingId !== req.id ? (
                                    <div className="flex items-center gap-3 mt-4 flex-wrap">
                                        <button
                                            onClick={() => handleApprove(req)}
                                            disabled={isPending}
                                            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-emerald-200 disabled:opacity-60 hover:-translate-y-0.5 active:translate-y-0"
                                        >
                                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                            Approve — Grant Owner Access
                                        </button>
                                        <button
                                            onClick={() => { setRejectingId(req.id); setRejectNote(''); }}
                                            disabled={isPending}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-black rounded-xl transition-all disabled:opacity-60"
                                        >
                                            <XCircle className="h-4 w-4" /> Reject
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mt-4 border-t pt-4 space-y-3">
                                        <p className="text-sm font-black text-slate-900">Rejection Reason <span className="text-red-500">*</span></p>
                                        <textarea
                                            value={rejectNote}
                                            onChange={e => setRejectNote(e.target.value)}
                                            placeholder="e.g. Missing property ownership documents. Please reapply with supporting documents."
                                            rows={3}
                                            className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                                        />
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => handleReject(req)}
                                                disabled={!rejectNote.trim() || isPending}
                                                className="px-6 py-2.5 text-sm font-black bg-red-600 hover:bg-red-700 text-white rounded-xl disabled:opacity-50 transition-all shadow-lg shadow-red-200"
                                            >
                                                {isPending ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : null}
                                                Confirm Rejection
                                            </button>
                                            <button
                                                onClick={() => setRejectingId(null)}
                                                className="px-5 py-2.5 text-sm font-bold border-2 border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Processed Requests */}
            {processed.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-slate-200" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                            Processed ({processed.length})
                        </span>
                        <div className="h-px flex-1 bg-slate-200" />
                    </div>

                    {processed.map(req => (
                        <div key={req.id} className={`bg-white border-2 rounded-2xl p-4 shadow-sm ${req.status === 'APPROVED' ? 'border-emerald-100' : 'border-red-100'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs">
                                        {(req.user.name || req.user.email).charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-slate-900">{req.user.name || req.user.email}</p>
                                        <p className="text-xs text-slate-500">{req.user.email}</p>
                                    </div>
                                </div>
                                <StatusBadge status={req.status} />
                            </div>
                            {req.adminNote && (
                                <p className="text-xs text-slate-500 mt-2 ml-11 italic">Admin note: "{req.adminNote}"</p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {requests.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="p-4 bg-slate-100 rounded-full mb-4"><Users className="h-10 w-10 text-slate-400" /></div>
                    <h3 className="text-lg font-bold text-slate-900">No Upgrade Requests</h3>
                    <p className="text-sm text-slate-500 mt-1">When students request Owner access, they'll appear here.</p>
                </div>
            )}
        </div>
    );
}
