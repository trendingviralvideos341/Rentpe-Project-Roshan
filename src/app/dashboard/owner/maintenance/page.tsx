'use client';

import { useEffect, useState, useTransition } from 'react';
import { getOwnerMaintenanceRequests, updateMaintenanceStatus } from '@/actions/maintenance';
import { toast } from 'sonner';
import { Wrench, Loader2, CheckCircle2, Activity, Clock, X, AlertTriangle, Filter } from 'lucide-react';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
    OPEN:         { label: 'Open',         cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    ACKNOWLEDGED: { label: 'Acknowledged', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    IN_PROGRESS:  { label: 'In Progress',  cls: 'bg-purple-100 text-purple-700 border-purple-200' },
    RESOLVED:     { label: 'Resolved',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    CLOSED:       { label: 'Closed',       cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const PRIORITY_BADGE: Record<Priority, string> = {
    LOW: 'bg-slate-100 text-slate-600',
    MEDIUM: 'bg-amber-100 text-amber-700',
    HIGH: 'bg-orange-100 text-orange-700',
    URGENT: 'bg-red-100 text-red-700 animate-pulse',
};

const CAT_ICONS: Record<string, string> = {
    ELECTRICAL: '💡', PLUMBING: '🚿', FURNITURE: '🛋️',
    CLEANLINESS: '🧹', WIFI: '📶', SECURITY: '🔒', OTHER: '📦',
};

export default function OwnerMaintenancePage() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [selected, setSelected] = useState<any>(null);
    const [note, setNote] = useState('');
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        getOwnerMaintenanceRequests().then(data => {
            setRequests(data);
            setLoading(false);
        });
    }, []);

    const handleAction = (requestId: string, status: 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED') => {
        startTransition(async () => {
            try {
                const updated = await updateMaintenanceStatus(requestId, status, note);
                setRequests(prev => prev.map(r => r.id === requestId ? { ...r, ...updated } : r));
                setSelected(null);
                setNote('');
                toast.success(`Request marked as ${status}`);
            } catch (e: any) {
                toast.error(e.message || 'Action failed.');
            }
        });
    };

    const filtered = filter === 'ALL' ? requests : requests.filter(r => r.status === filter || r.priority === filter);
    const urgentCount = requests.filter(r => r.priority === 'URGENT' && r.status === 'OPEN').length;

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 pt-10 pb-20 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="max-w-5xl mx-auto relative z-10">
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Maintenance Requests</h1>
                    <p className="text-indigo-200 text-sm font-medium mt-1">Manage all property maintenance complaints</p>
                    {urgentCount > 0 && (
                        <div className="mt-4 inline-flex items-center gap-2 bg-red-500/30 border border-red-400/50 backdrop-blur-sm px-4 py-2 rounded-2xl">
                            <AlertTriangle className="w-4 h-4 text-red-200" />
                            <span className="text-sm font-black text-white">{urgentCount} URGENT request{urgentCount > 1 ? 's' : ''} need immediate attention</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 -mt-12 relative z-10 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                        { label: 'Total', val: requests.length, color: 'slate' },
                        { label: 'Open', val: requests.filter(r => r.status === 'OPEN').length, color: 'amber' },
                        { label: 'In Progress', val: requests.filter(r => r.status === 'IN_PROGRESS').length, color: 'purple' },
                        { label: 'Resolved', val: requests.filter(r => r.status === 'RESOLVED').length, color: 'emerald' },
                        { label: 'Urgent', val: urgentCount, color: 'red' },
                    ].map(stat => (
                        <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100 text-center">
                            <p className="text-2xl font-black text-slate-900">{stat.val}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Filter */}
                <div className="bg-white rounded-2xl border border-slate-100 p-2 flex gap-2 overflow-x-auto">
                    {['ALL', 'OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'URGENT'].map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${filter === f ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                            {f.replace('_', ' ')}
                        </button>
                    ))}
                </div>

                {/* Request List */}
                {filtered.length === 0 ? (
                    <div className="bg-white rounded-3xl shadow-xl p-12 text-center border border-slate-100">
                        <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="font-black text-slate-500 text-lg">No requests found</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filtered.map(req => {
                            const sc = STATUS_CONFIG[req.status] || STATUS_CONFIG.OPEN;
                            const isUrgent = req.priority === 'URGENT' && req.status === 'OPEN';
                            return (
                                <div key={req.id} className={`bg-white rounded-3xl shadow-lg border overflow-hidden transition-all hover:shadow-xl ${isUrgent ? 'border-red-200 shadow-red-100' : 'border-slate-100'}`}>
                                    <div className="p-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                                    <span>{CAT_ICONS[req.category] || '📦'}</span>
                                                    <h3 className="font-black text-slate-900">{req.title}</h3>
                                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${PRIORITY_BADGE[req.priority as Priority]}`}>{req.priority}</span>
                                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase ${sc.cls}`}>{sc.label}</span>
                                                </div>
                                                <p className="text-sm text-slate-500">{req.description}</p>
                                                <p className="text-xs text-slate-400 mt-2 font-bold">
                                                    {req.booking?.guestName} · {req.booking?.propertyName}
                                                </p>
                                                {req.photos?.length > 0 && (
                                                    <div className="flex gap-2 mt-3">
                                                        {req.photos.map((url: string, i: number) => (
                                                            <img key={i} src={url} className="w-14 h-14 object-cover rounded-xl border" alt="evidence" />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <button onClick={() => { setSelected(req); setNote(req.ownerNote || ''); }}
                                                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-xs rounded-xl transition-all whitespace-nowrap">
                                                Manage →
                                            </button>
                                        </div>
                                        {req.slaDeadline && req.status !== 'RESOLVED' && (
                                            <p className={`text-[10px] mt-2 font-bold ${new Date(req.slaDeadline) < new Date() ? 'text-red-500' : 'text-slate-400'}`}>
                                                SLA: {new Date(req.slaDeadline).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                {new Date(req.slaDeadline) < new Date() && ' — ⚠️ OVERDUE'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Action Modal */}
            {selected && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="font-black text-slate-900">{selected.title}</h2>
                            <button onClick={() => { setSelected(null); setNote(''); }} className="p-2 hover:bg-slate-100 rounded-xl">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Note / Resolution Details</label>
                                <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
                                    placeholder="Add a note for the tenant..."
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {selected.status === 'OPEN' && (
                                    <button onClick={() => handleAction(selected.id, 'ACKNOWLEDGED')} disabled={isPending}
                                        className="py-3 bg-blue-600 text-white font-black text-sm rounded-2xl disabled:opacity-50 transition-all">
                                        Acknowledge
                                    </button>
                                )}
                                {['OPEN', 'ACKNOWLEDGED'].includes(selected.status) && (
                                    <button onClick={() => handleAction(selected.id, 'IN_PROGRESS')} disabled={isPending}
                                        className="py-3 bg-purple-600 text-white font-black text-sm rounded-2xl disabled:opacity-50 transition-all">
                                        Mark In Progress
                                    </button>
                                )}
                                {selected.status !== 'RESOLVED' && selected.status !== 'CLOSED' && (
                                    <button onClick={() => handleAction(selected.id, 'RESOLVED')} disabled={isPending}
                                        className="py-3 bg-emerald-600 text-white font-black text-sm rounded-2xl disabled:opacity-50 transition-all">
                                        Mark Resolved ✓
                                    </button>
                                )}
                                {selected.status === 'RESOLVED' && (
                                    <button onClick={() => handleAction(selected.id, 'CLOSED')} disabled={isPending}
                                        className="py-3 bg-slate-600 text-white font-black text-sm rounded-2xl disabled:opacity-50 transition-all">
                                        Close
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
