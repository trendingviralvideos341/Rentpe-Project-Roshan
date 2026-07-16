'use client';

import { useEffect, useState, useTransition } from 'react';
import { getOwnerRoomChangeRequests, updateRoomChangeStatus } from '@/actions/roomChange';
import { toast } from 'sonner';
import { RefreshCw, Loader2, X, BedDouble } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; cls: string; activeCls: string }> = {
    PENDING:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700 border-amber-200', activeCls: 'bg-amber-500 text-white border-amber-600 shadow-amber-500/30' },
    APPROVED:  { label: 'Approved',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', activeCls: 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/30' },
    REJECTED:  { label: 'Rejected',  cls: 'bg-red-100 text-red-700 border-red-200', activeCls: 'bg-red-500 text-white border-red-600 shadow-red-500/30' },
    COMPLETED: { label: 'Completed', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200', activeCls: 'bg-indigo-500 text-white border-indigo-600 shadow-indigo-500/30' },
};

export default function OwnerRoomChangesPage() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<any>(null);
    const [note, setNote] = useState('');
    const [isPending, startTransition] = useTransition();

    const [selectedYear, setSelectedYear] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [selectedProperty, setSelectedProperty] = useState<string>('ALL');
    const [activeTab, setActiveTab] = useState<string>('ALL');

    useEffect(() => {
        getOwnerRoomChangeRequests().then(data => {
            setRequests(data);
            setLoading(false);

            if (data && data.length > 0) {
                const dates = data.map((n: any) => new Date(n.createdAt));
                const latestDate = new Date(Math.max(...dates.map(d => d.getTime())));
                setSelectedYear(latestDate.getFullYear().toString());
                setSelectedMonth(latestDate.getMonth().toString());
            } else {
                const now = new Date();
                setSelectedYear(now.getFullYear().toString());
                setSelectedMonth(now.getMonth().toString());
            }
        });
    }, []);

    const handleAction = (status: 'APPROVED' | 'REJECTED') => {
        if (!selected) return;
        startTransition(async () => {
            try {
                const updated = await updateRoomChangeStatus(selected.id, status, note);
                setRequests(prev => prev.map(r => r.id === selected.id ? { ...r, ...updated } : r));
                setSelected(null);
                setNote('');
                toast.success(`Request ${status.toLowerCase()}.`);
            } catch (e: any) {
                toast.error(e.message || 'Action failed.');
            }
        });
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
    );

    const uniqueYears = Array.from(new Set(
        requests.map((r: any) => new Date(r.createdAt).getFullYear())
    )).sort((a, b) => b - a);
    const currentYear = new Date().getFullYear();
    if (!uniqueYears.includes(currentYear)) uniqueYears.push(currentYear);
    uniqueYears.sort((a, b) => b - a);

    const MONTHS = [
        { value: '0', label: 'January' },
        { value: '1', label: 'February' },
        { value: '2', label: 'March' },
        { value: '3', label: 'April' },
        { value: '4', label: 'May' },
        { value: '5', label: 'June' },
        { value: '6', label: 'July' },
        { value: '7', label: 'August' },
        { value: '8', label: 'September' },
        { value: '9', label: 'October' },
        { value: '10', label: 'November' },
        { value: '11', label: 'December' }
    ];

    const uniqueProperties = Array.from(new Set(
        requests.map((r: any) => r.booking?.propertyName).filter(Boolean)
    )).sort();

    const baseFilteredRequests = requests.filter(r => {
        const date = new Date(r.createdAt);
        const yearMatch = selectedYear === 'ALL' || date.getFullYear() === Number(selectedYear);
        const monthMatch = selectedMonth === 'ALL' || date.getMonth() === Number(selectedMonth);
        const propertyMatch = selectedProperty === 'ALL' || r.booking?.propertyName === selectedProperty;
        return yearMatch && monthMatch && propertyMatch;
    });

    const displayRequests = activeTab === 'ALL' 
        ? baseFilteredRequests 
        : baseFilteredRequests.filter(r => r.status === activeTab);

    const pending = baseFilteredRequests.filter(r => r.status === 'PENDING').length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 pt-10 pb-20 rounded-3xl relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="w-full relative z-10">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Room Change Requests</h1>
                            <p className="text-indigo-200 text-sm font-medium mt-1">Approve or reject tenant room change requests</p>
                            {pending > 0 && (
                                <div className="mt-3 inline-flex items-center gap-2 bg-amber-400/30 border border-amber-400/50 px-4 py-2 rounded-2xl backdrop-blur-sm">
                                    <span className="text-sm font-black text-white">{pending} pending request{pending > 1 ? 's' : ''} awaiting your action</span>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-4 flex-wrap justify-end">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Select Property</span>
                                <select
                                    value={selectedProperty}
                                    onChange={(e) => setSelectedProperty(e.target.value)}
                                    className="bg-white text-slate-800 text-xs font-black px-4 py-2.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent cursor-pointer min-w-[140px]"
                                >
                                    <option value="ALL">All Properties</option>
                                    {uniqueProperties.map(p => (
                                        <option key={p as string} value={p as string}>{p as string}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Select Year</span>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                    className="bg-white text-slate-800 text-xs font-black px-4 py-2.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent cursor-pointer min-w-[110px]"
                                >
                                    <option value="ALL">All Years</option>
                                    {uniqueYears.map(y => (
                                        <option key={y} value={y.toString()}>{y}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Select Month</span>
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="bg-white text-slate-800 text-xs font-black px-4 py-2.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent cursor-pointer min-w-[130px]"
                                >
                                    <option value="ALL">All Months</option>
                                    {MONTHS.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full px-4 -mt-12 relative z-10 space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(['PENDING','APPROVED','REJECTED','COMPLETED'] as const).map(s => {
                        const isActive = activeTab === s;
                        const config = STATUS_CONFIG[s];
                        return (
                            <div 
                                key={s} 
                                onClick={() => setActiveTab(isActive ? 'ALL' : s)}
                                className={`rounded-2xl p-4 shadow-lg border text-center cursor-pointer transition-all duration-300 transform hover:scale-105 active:scale-95 ${isActive ? config.activeCls : 'bg-white border-slate-100 hover:shadow-xl'}`}
                            >
                                <p className={`text-2xl font-black ${isActive ? 'text-white' : 'text-slate-900'}`}>
                                    {baseFilteredRequests.filter(r => r.status === s).length}
                                </p>
                                <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isActive ? 'text-white/90' : config.cls.split(' ')[1]}`}>
                                    {s}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* Request List */}
                {displayRequests.length === 0 ? (
                    <div className="bg-white rounded-3xl shadow-xl p-12 text-center border border-slate-100">
                        <RefreshCw className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="font-black text-slate-500 text-lg">No room change requests yet</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                        <div className="p-5 border-b border-slate-100">
                            <h2 className="font-black text-slate-900 flex items-center gap-2">
                                <BedDouble className="w-5 h-5 text-indigo-600" /> All Requests
                            </h2>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {displayRequests.map(req => {
                                const sc = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING;
                                return (
                                    <div key={req.id} className="p-5 hover:bg-slate-50/50 transition-colors">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 space-y-1.5">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-black text-slate-900">{req.booking?.guestName}</h3>
                                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase ${sc.cls}`}>{sc.label}</span>
                                                </div>
                                                <p className="text-sm text-slate-500">{req.booking?.propertyName} · {req.booking?.displayId}</p>
                                                <p className="text-sm font-medium text-slate-700">{req.reason}</p>
                                                <div className="flex gap-4 text-xs text-slate-400 flex-wrap">
                                                    <span>From: <strong className="text-slate-600">{req.currentRoom?.roomNumber} ({req.currentRoom?.type})</strong></span>
                                                    {req.requestedRoom && (
                                                        <span>Preferred: <strong className="text-slate-600">{req.requestedRoom?.roomNumber} ({req.requestedRoom?.type})</strong></span>
                                                    )}
                                                    {req.preferredDate && (
                                                        <span>By: {new Date(req.preferredDate).toLocaleDateString('en-IN')}</span>
                                                    )}
                                                </div>
                                                {req.ownerNote && (
                                                    <p className="text-xs text-indigo-600 font-medium">Your note: {req.ownerNote}</p>
                                                )}
                                            </div>
                                            {req.status === 'PENDING' && (
                                                <button
                                                    onClick={() => { setSelected(req); setNote(''); }}
                                                    className="px-4 py-2 bg-indigo-600 text-white font-black text-xs rounded-xl hover:bg-indigo-700 transition-all whitespace-nowrap"
                                                >
                                                    Review →
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-2">{req.displayId} · {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Review Modal */}
            {selected && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="font-black text-slate-900">Review Request</h2>
                            <button onClick={() => setSelected(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                                <p className="font-black text-slate-900">{selected.booking?.guestName}</p>
                                <p className="text-sm text-slate-500">Reason: {selected.reason}</p>
                                <p className="text-sm text-slate-500">Current Room: <strong>{selected.currentRoom?.roomNumber}</strong></p>
                                {selected.requestedRoom && <p className="text-sm text-slate-500">Requested: <strong>{selected.requestedRoom?.roomNumber}</strong></p>}
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Note / Reason (optional)</label>
                                <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
                                    placeholder="Explain your decision to the tenant..."
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => handleAction('REJECTED')} disabled={isPending}
                                    className="py-3 bg-red-50 hover:bg-red-100 text-red-700 font-black text-sm rounded-2xl border border-red-200 disabled:opacity-50 transition-all">
                                    Reject ✗
                                </button>
                                <button onClick={() => handleAction('APPROVED')} disabled={isPending}
                                    className="py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm rounded-2xl disabled:opacity-50 transition-all shadow-lg shadow-indigo-200">
                                    Approve ✓
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
