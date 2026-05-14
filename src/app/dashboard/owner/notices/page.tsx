'use client';

import { useEffect, useState, useTransition } from 'react';
import { getOwnerVacatingNotices, acknowledgeVacatingNotice, getTenantForSettlement } from '@/actions/tenancy';
import { toast } from 'sonner';
import { FileText, Clock, CheckCircle2, Loader2, X, Calendar as CalendarIcon, List, ChevronLeft, ChevronRight, Home, AlertTriangle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { SettlementModal } from '@/components/dashboard/SettlementModal';
import { VacatingTimeline } from '@/components/ui/VacatingTimeline';

const STATUS_CONFIG: Record<string, { label: string; cls: string; color: string }> = {
    SUBMITTED:    { label: 'Submitted',    cls: 'bg-amber-100 text-amber-700 border-amber-200', color: 'bg-amber-500' },
    ACKNOWLEDGED: { label: 'Acknowledged', cls: 'bg-blue-100 text-blue-700 border-blue-200', color: 'bg-blue-500' },
    APPROVED:     { label: 'Approved',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', color: 'bg-emerald-500' },
    DISPUTED:     { label: 'Disputed',     cls: 'bg-red-100 text-red-700 border-red-200', color: 'bg-red-500' },
    WITHDRAWN:    { label: 'Withdrawn',    cls: 'bg-slate-100 text-slate-500 border-slate-200', color: 'bg-slate-400' },
};

export default function OwnerNoticesPage() {
    const [notices, setNotices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<any>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [view, setView] = useState<'list' | 'calendar'>('list');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [revisedMoveOutDate, setRevisedMoveOutDate] = useState('');
    const [isPending, startTransition] = useTransition();

    // Move-out now confirmation + settlement
    const [confirmNotice, setConfirmNotice] = useState<any>(null);   // notice to confirm early move-out
    const [settlementTenant, setSettlementTenant] = useState<any>(null); // tenant data for SettlementModal
    const [fetchingTenant, setFetchingTenant] = useState(false);

    const handleMoveOutNow = (notice: any) => setConfirmNotice(notice);

    const handleConfirmMoveOut = async () => {
        if (!confirmNotice) return;
        setFetchingTenant(true);
        try {
            const tenant = await getTenantForSettlement(confirmNotice.bookingId);
            setSettlementTenant(tenant);
            setConfirmNotice(null);
        } catch (e: any) {
            toast.error(e.message || 'Could not load tenant data.');
        } finally {
            setFetchingTenant(false);
        }
    };

    useEffect(() => {
        getOwnerVacatingNotices().then(data => {
            setNotices(data);
            setLoading(false);
        });
    }, []);

    const handleAcknowledge = (noticeId: string) => {
        startTransition(async () => {
            try {
                const updated = await acknowledgeVacatingNotice(noticeId, note, revisedMoveOutDate || undefined);
                setNotices(prev => prev.map(n => n.id === noticeId ? { ...n, ...updated } : n));
                setExpandedId(null);
                setNote('');
                setRevisedMoveOutDate('');
                toast.success('Notice acknowledged with approved date.');
            } catch (e: any) {
                toast.error(e.message || 'Action failed.');
            }
        });
    };

    // Group upcoming move-outs by month
    const upcoming = notices
        .filter(n => n.status !== 'WITHDRAWN' && new Date(n.plannedMoveOut) >= new Date())
        .sort((a, b) => new Date(a.plannedMoveOut).getTime() - new Date(b.plannedMoveOut).getTime());

    // Calendar logic
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const getNoticesForDay = (day: Date) => {
        return notices.filter(n => n.status !== 'WITHDRAWN' && isSameDay(new Date(n.plannedMoveOut), day));
    };

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
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Vacating Notices</h1>
                            <p className="text-indigo-200 text-sm font-medium mt-1">Manage tenant move-out notifications</p>
                        </div>
                        <div className="flex bg-white/20 backdrop-blur-md rounded-xl p-1 gap-1 border border-white/30">
                            <button onClick={() => setView('list')}
                                className={`px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2 transition-all ${view === 'list' ? 'bg-white text-indigo-700 shadow-lg' : 'text-white hover:bg-white/10'}`}>
                                <List className="w-4 h-4" /> List
                            </button>
                            <button onClick={() => setView('calendar')}
                                className={`px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2 transition-all ${view === 'calendar' ? 'bg-white text-indigo-700 shadow-lg' : 'text-white hover:bg-white/10'}`}>
                                <CalendarIcon className="w-4 h-4" /> Calendar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 -mt-12 relative z-10 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Total', val: notices.length, highlight: true },
                        { label: 'Pending Action', val: notices.filter(n => n.status === 'SUBMITTED').length, highlight: false },
                        { label: 'Upcoming (30d)', val: upcoming.filter(n => {
                            const days = Math.ceil((new Date(n.plannedMoveOut).getTime() - Date.now()) / 86400000);
                            return days <= 30;
                        }).length, highlight: false },
                        { label: 'This Month', val: upcoming.filter(n => {
                            const d = new Date(n.plannedMoveOut);
                            const now = new Date();
                            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                        }).length, highlight: false },
                    ].map(stat => (
                        <div key={stat.label} className={`rounded-2xl p-4 shadow-lg border text-center ${stat.highlight ? 'bg-indigo-600 border-indigo-500' : 'bg-white border-slate-100'}`}>
                            <p className={`text-2xl font-black ${stat.highlight ? 'text-white' : 'text-slate-900'}`}>{stat.val}</p>
                            <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${stat.highlight ? 'text-indigo-200' : 'text-slate-400'}`}>{stat.label}</p>
                        </div>
                    ))}
                </div>

                {view === 'list' ? (
                    <>
                        {/* Upcoming Move-outs List */}
                        {upcoming.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5">
                                <h2 className="font-black text-amber-900 flex items-center gap-2 mb-4">
                                    <CalendarIcon className="w-5 h-5" /> Upcoming Move-outs
                                </h2>
                                <div className="space-y-3">
                                    {upcoming.slice(0, 5).map(n => {
                                        const daysLeft = Math.ceil((new Date(n.plannedMoveOut).getTime() - Date.now()) / 86400000);
                                        return (
                                            <div key={n.id} className="flex items-center justify-between bg-white/70 rounded-2xl p-4 border border-amber-100">
                                                <div>
                                                    <p className="font-black text-slate-900 text-sm">{n.booking?.guestName}</p>
                                                    <p className="text-xs text-slate-500">{n.booking?.propertyName} · {n.displayId}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-slate-900 text-sm">
                                                        {format(new Date(n.plannedMoveOut), 'd MMM')}
                                                    </p>
                                                    <p className={`text-[10px] font-black ${daysLeft <= 7 ? 'text-red-600' : 'text-slate-400'}`}>
                                                        {daysLeft} days
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Full Notice List */}
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                            <div className="p-5 border-b border-slate-100">
                                <h2 className="font-black text-slate-900 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-indigo-600" /> All Notices
                                </h2>
                            </div>

                            {notices.length === 0 ? (
                                <div className="py-16 text-center">
                                    <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                    <p className="font-black text-slate-400">No vacating notices yet</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {notices.map(notice => {
                                        const sc = STATUS_CONFIG[notice.status] || STATUS_CONFIG.SUBMITTED;
                                        const daysLeft = Math.ceil((new Date(notice.plannedMoveOut).getTime() - Date.now()) / 86400000);
                                        return (
                                            <div key={notice.id} className="p-5 hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0">
                                                {/* Top row: details + action buttons */}
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h3 className="font-black text-slate-900">{notice.booking?.guestName}</h3>
                                                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase ${sc.cls}`}>{sc.label}</span>
                                                        </div>
                                                        <p className="text-sm text-slate-500">{notice.booking?.propertyName}</p>
                                                        <p className="text-sm font-medium text-slate-700">Reason: {notice.reason}</p>
                                                        <div className="flex items-center gap-4 flex-wrap">
                                                            <span className="text-xs text-slate-400">Filed: {format(new Date(notice.submittedAt), 'd MMM yyyy')}</span>
                                                            <span className={`text-xs font-bold ${daysLeft < 0 ? 'text-red-600' : daysLeft <= 7 ? 'text-amber-600' : 'text-slate-600'}`}>
                                                                Move-out: {format(new Date(notice.plannedMoveOut), 'd MMM yyyy')}
                                                                {daysLeft >= 0 ? ` (${daysLeft} days)` : ' (past)'}
                                                            </span>
                                                        </div>
                                                        {notice.tenantComment && (
                                                             <div className="mt-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">
                                                                 <span className="text-[10px] font-black text-violet-500">⚠️ Early-Leave Request: </span>
                                                                 <span className="text-xs text-violet-800 font-medium">{notice.tenantComment}</span>
                                                             </div>
                                                         )}
                                                        {notice.ownerNote && (
                                                            <p className="text-xs text-indigo-600 font-medium">Your note: {notice.ownerNote}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col gap-2 shrink-0">
                                                        <button
                                                            onClick={() => {
                                                                const isOpen = expandedId === notice.id;
                                                                setExpandedId(isOpen ? null : notice.id);
                                                                if (!isOpen) {
                                                                    setNote('');
                                                                    setRevisedMoveOutDate(format(new Date(notice.plannedMoveOut), 'yyyy-MM-dd'));
                                                                }
                                                            }}
                                                            className={`px-4 py-2 font-black text-xs rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 shadow-md ${
                                                                expandedId === notice.id
                                                                    ? 'bg-slate-200 text-slate-700 shadow-slate-100'
                                                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                                                            }`}
                                                        >
                                                            <FileText className="w-3.5 h-3.5" />
                                                            {expandedId === notice.id ? 'Hide Details' : 'View Details'}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* ── Inline Expanded Details ── */}
                                                {expandedId === notice.id && (
                                                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                                                        {notice.status === 'SUBMITTED' ? (
                                                            <>
                                                                <div className="grid grid-cols-1 gap-4">
                                                                    <div>
                                                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Approved Move-out Date</label>
                                                                        <input
                                                                            type="date"
                                                                            value={revisedMoveOutDate}
                                                                            onChange={e => setRevisedMoveOutDate(e.target.value)}
                                                                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                                        />
                                                                        <p className="text-[10px] text-slate-400 mt-1 italic">Default is tenant&apos;s request: {format(new Date(notice.plannedMoveOut), 'd MMM yyyy')}</p>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Your Response (optional)</label>
                                                                        <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
                                                                            placeholder="Add a note for the tenant..."
                                                                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                                                                    </div>
                                                                </div>
                                                                <button onClick={() => handleAcknowledge(notice.id)} disabled={isPending}
                                                                    className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm rounded-2xl disabled:opacity-50 transition-all shadow-lg shadow-indigo-200">
                                                                    {isPending ? 'Acknowledging...' : 'Acknowledge Notice ✓'}
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                {notice.ownerNote && (
                                                                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                                                        <p className="text-[10px] font-black uppercase text-indigo-400 mb-1">Your Note</p>
                                                                        <p className="text-xs text-indigo-700">{notice.ownerNote}</p>
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">Vacating Progress</p>
                                                                    <VacatingTimeline notice={notice} />
                                                                </div>
                                                                {notice.status === 'ACKNOWLEDGED' && (
                                                                    <button
                                                                        onClick={() => { setExpandedId(null); handleMoveOutNow(notice); }}
                                                                        className="w-full py-3 bg-gradient-to-r from-rose-600 to-orange-600 text-white font-black text-sm rounded-2xl hover:from-rose-700 hover:to-orange-700 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2"
                                                                    >
                                                                        <Home className="w-4 h-4" /> Move Out &amp; Settlement Now
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* CALENDAR VIEW */
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="font-black text-slate-900 flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-indigo-600" /> Move-out Calendar
                            </h2>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                                </button>
                                <span className="text-sm font-black text-slate-900 min-w-[120px] text-center">
                                    {format(currentDate, 'MMMM yyyy')}
                                </span>
                                <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                                    <ChevronRight className="w-5 h-5 text-slate-600" />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {day}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7">
                            {calendarDays.map((day, idx) => {
                                const dayNotices = getNoticesForDay(day);
                                const isCurrentMonth = isSameMonth(day, currentDate);
                                return (
                                    <div key={idx} className={`min-h-[120px] border-b border-r border-slate-50 p-2 transition-all hover:bg-slate-50/50 ${!isCurrentMonth ? 'bg-slate-50/30 opacity-40' : ''}`}>
                                        <div className="flex justify-between items-start">
                                            <span className={`text-xs font-black ${isSameDay(day, new Date()) ? 'bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-slate-400'}`}>
                                                {format(day, 'd')}
                                            </span>
                                        </div>
                                        <div className="mt-2 space-y-1">
                                            {dayNotices.map(n => {
                                                const sc = STATUS_CONFIG[n.status] || STATUS_CONFIG.SUBMITTED;
                                                return (
                                                    <div 
                                                        key={n.id} 
                                                        onClick={() => {
                                                            setSelected(n);
                                                            if (n.status === 'SUBMITTED') {
                                                                setRevisedMoveOutDate(format(new Date(n.plannedMoveOut), 'yyyy-MM-dd'));
                                                            }
                                                        }}
                                                        className={`text-[9px] font-black p-1.5 rounded-lg border flex flex-col cursor-pointer transition-all hover:scale-[1.02] shadow-sm ${sc.cls}`}
                                                    >
                                                        <span className="truncate">{n.booking?.guestName}</span>
                                                        <span className="flex items-center gap-1 mt-0.5">
                                                           <div className={`w-1 h-1 rounded-full ${sc.color}`} />
                                                           <span className="text-[8px] opacity-70 uppercase">{n.status}</span>
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Acknowledge Modal */}
            {selected && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="font-black text-slate-900">
                                {selected.status === 'ACKNOWLEDGED' ? 'Notice Details' : 'Acknowledge Notice'}
                            </h2>
                            <button onClick={() => setSelected(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                                <p className="text-sm font-black text-slate-900">{selected.booking?.guestName}</p>
                                <p className="text-xs text-slate-500">Planned Move-out: <strong>{format(new Date(selected.plannedMoveOut), 'd MMM yyyy')}</strong></p>
                                <p className="text-xs text-slate-500">Reason: {selected.reason}</p>
                                <p className="text-xs font-black text-indigo-600">Status: {selected.status}</p>
                            </div>
                             {selected.tenantComment && (
                                 <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
                                     <p className="text-[10px] font-black uppercase tracking-widest text-violet-500 mb-1">⚠️ Tenant Early-Leave Request</p>
                                     <p className="text-sm text-violet-800 font-medium">{selected.tenantComment}</p>
                                 </div>
                             )}
                            {selected.status === 'SUBMITTED' ? (
                                <>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Approved Move-out Date</label>
                                            <input 
                                                type="date" 
                                                value={revisedMoveOutDate} 
                                                onChange={e => setRevisedMoveOutDate(e.target.value)}
                                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                                            />
                                            <p className="text-[10px] text-slate-400 mt-1 italic">Default is tenant's request: {format(new Date(selected.plannedMoveOut), 'd MMM yyyy')}</p>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Your Response (optional)</label>
                                            <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
                                                placeholder="Add a note for the tenant..."
                                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                                        </div>
                                    </div>
                                    <button onClick={() => handleAcknowledge(selected.id)} disabled={isPending}
                                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm rounded-2xl disabled:opacity-50 transition-all shadow-lg shadow-indigo-200">
                                        {isPending ? 'Acknowledging...' : 'Acknowledge Notice ✓'}
                                    </button>
                                </>
                            ) : (
                                <div className="space-y-4">
                                   {selected.ownerNote && (
                                       <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                           <p className="text-[10px] font-black uppercase text-indigo-400 mb-1">Your Note</p>
                                           <p className="text-xs text-indigo-700">{selected.ownerNote}</p>
                                       </div>
                                   )}
                                   {/* ── Vacating Progress Timeline ── */}
                                   <div className="pt-2">
                                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">Vacating Progress</p>
                                       <VacatingTimeline notice={selected} />
                                   </div>
                                   {/* ── Move Out & Settlement button (inside modal) ── */}
                                   {selected.status === 'ACKNOWLEDGED' && (
                                       <button
                                           onClick={() => { setSelected(null); handleMoveOutNow(selected); }}
                                           className="w-full py-3 bg-gradient-to-r from-rose-600 to-orange-600 text-white font-black text-sm rounded-2xl hover:from-rose-700 hover:to-orange-700 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2"
                                       >
                                           <Home className="w-4 h-4" /> Move Out &amp; Settlement Now
                                       </button>
                                   )}
                                   <button onClick={() => setSelected(null)} className="w-full py-3 bg-slate-100 text-slate-600 font-black text-xs rounded-xl hover:bg-slate-200 transition-all">
                                        Close
                                   </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Early Move-Out Confirmation Dialog ── */}
            {confirmNotice && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="bg-amber-50 p-6 border-b border-amber-100">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                                </div>
                                <h2 className="font-black text-slate-900 text-lg">Confirm Early Move-Out</h2>
                            </div>
                            <p className="text-sm text-slate-600">
                                Move-out was scheduled for{' '}
                                <strong className="text-slate-900">{format(new Date(confirmNotice.plannedMoveOut), 'd MMM yyyy')}</strong>,
                                but you are selecting{' '}
                                <strong className="text-rose-700">{format(new Date(), 'd MMM yyyy')} (Today)</strong>.
                            </p>
                            <div className="mt-3 bg-white border border-amber-200 rounded-2xl p-3">
                                <p className="text-xs font-black text-amber-700 uppercase tracking-widest mb-1">What happens next</p>
                                <p className="text-xs text-slate-600">
                                    Today&apos;s date will be used for all settlement calculations — pro-rata rent, security deposit, and deductions.
                                </p>
                            </div>
                        </div>
                        <div className="p-5 flex gap-3">
                            <button
                                onClick={handleConfirmMoveOut}
                                disabled={fetchingTenant}
                                className="flex-1 py-3 bg-gradient-to-r from-rose-600 to-orange-600 text-white font-black text-sm rounded-2xl hover:from-rose-700 hover:to-orange-700 disabled:opacity-50 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2"
                            >
                                {fetchingTenant
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
                                    : <><Home className="w-4 h-4" /> Confirm Move-Out</>
                                }
                            </button>
                            <button
                                onClick={() => setConfirmNotice(null)}
                                disabled={fetchingTenant}
                                className="flex-1 py-3 bg-indigo-600 text-white font-black text-sm rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Settlement Modal ── */}
            {settlementTenant && (
                <SettlementModal
                    tenant={settlementTenant}
                    onClose={() => setSettlementTenant(null)}
                    onSuccess={() => {
                        setSettlementTenant(null);
                        getOwnerVacatingNotices().then(setNotices);
                    }}
                />
            )}
        </div>
    );
}
