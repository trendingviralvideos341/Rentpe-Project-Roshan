'use client';

import { useEffect, useState, useTransition } from "react";
import { getDeactivationRequests } from "@/actions/admin";
import { approvePropertyDeactivation, rejectPropertyDeactivation, approvePropertyReactivation, rejectPropertyReactivation } from "@/actions/properties";
import { PowerOff, Zap, AlertTriangle, Clock, Building, Users, Calendar, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp, RefreshCcw, Search, Filter, X, ArrowUpDown } from "lucide-react";

type Request = {
    id: string;
    displayId: string;
    name: string;
    address: string;
    city: string;
    status: string;
    deactivationRequestedAt: string | null;
    deactivationReason: string | null;
    owner: { name: string; email: string; phone: string; displayId: string };
    tenants: { id: string; status: string }[];
    bookings: { id: string; status: string }[];
};

export default function DeactivationRequestsPage() {
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [rejectDialogId, setRejectDialogId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isPending, startTransition] = useTransition();

    // ── Filter State ──────────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'ALL' | 'EXIT' | 'RELIST'>('ALL');
    const [filterCity, setFilterCity] = useState('ALL');
    const [filterBlocker, setFilterBlocker] = useState<'ALL' | 'READY' | 'BLOCKED'>('ALL');
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');
    const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'TENANTS' | 'BOOKINGS'>('NEWEST');

    const fetchRequests = async () => {
        setLoading(true);
        try { setRequests(await getDeactivationRequests()); }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchRequests(); }, []);

    const flash = (type: 'success' | 'error', text: string) => {
        setActionMsg({ type, text });
        setTimeout(() => setActionMsg(null), 5000);
    };

    const handleApproveDeactivation = (id: string, name: string) => {
        startTransition(async () => {
            try { await approvePropertyDeactivation(id); flash('success', `"${name}" deactivated successfully.`); fetchRequests(); }
            catch (err: any) { flash('error', err.message); }
        });
    };

    const handleApproveReactivation = (id: string, name: string) => {
        startTransition(async () => {
            try { await approvePropertyReactivation(id); flash('success', `"${name}" is now LIVE again!`); fetchRequests(); }
            catch (err: any) { flash('error', err.message); }
        });
    };

    const handleReject = (id: string, name: string, isReactivation: boolean) => {
        if (!rejectReason.trim()) return;
        startTransition(async () => {
            try {
                if (isReactivation) {
                    await rejectPropertyReactivation(id, rejectReason);
                    flash('success', `Re-list request rejected. "${name}" remains DEACTIVATED.`);
                } else {
                    await rejectPropertyDeactivation(id, rejectReason);
                    flash('success', `Deactivation request rejected. "${name}" remains LIVE.`);
                }
                setRejectDialogId(null);
                setRejectReason('');
                fetchRequests();
            } catch (err: any) { flash('error', err.message); }
        });
    };

    const filteredRequests = requests.filter(req => {
        // Search
        const searchMatch = !searchQuery || 
            req.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.displayId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.owner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.owner.displayId.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Type
        const isRelist = req.status === 'REACTIVATION_REQUESTED';
        const typeMatch = filterType === 'ALL' || (filterType === 'RELIST' ? isRelist : !isRelist);
        
        // City
        const cityMatch = filterCity === 'ALL' || req.city === filterCity;
        
        // Blockers
        const hasBlockers = !isRelist && (req.tenants.length > 0 || req.bookings.length > 0);
        const blockerMatch = filterBlocker === 'ALL' || (filterBlocker === 'READY' ? !hasBlockers : hasBlockers);
        
        // Date
        const reqDate = req.deactivationRequestedAt ? new Date(req.deactivationRequestedAt).getTime() : 0;
        const startTimestamp = dateStart ? new Date(dateStart).setHours(0,0,0,0) : 0;
        const endTimestamp = dateEnd ? new Date(dateEnd).setHours(23,59,59,999) : Infinity;
        const dateMatch = reqDate >= startTimestamp && reqDate <= endTimestamp;
        
        return searchMatch && typeMatch && cityMatch && blockerMatch && dateMatch;
    }).sort((a, b) => {
        if (sortBy === 'NEWEST') return new Date(b.deactivationRequestedAt || 0).getTime() - new Date(a.deactivationRequestedAt || 0).getTime();
        if (sortBy === 'OLDEST') return new Date(a.deactivationRequestedAt || 0).getTime() - new Date(b.deactivationRequestedAt || 0).getTime();
        if (sortBy === 'TENANTS') return b.tenants.length - a.tenants.length;
        if (sortBy === 'BOOKINGS') return b.bookings.length - a.bookings.length;
        return 0;
    });

    const exitReqs = filteredRequests.filter(r => r.status === 'DEACTIVATION_REQUESTED');
    const relistReqs = filteredRequests.filter(r => r.status === 'REACTIVATION_REQUESTED');
    const cities = Array.from(new Set(requests.map(r => r.city))).sort();

    const clearFilters = () => {
        setSearchQuery('');
        setFilterType('ALL');
        setFilterCity('ALL');
        setFilterBlocker('ALL');
        setDateStart('');
        setDateEnd('');
        setSortBy('NEWEST');
    };

    const RequestCard = ({ req, isRelist }: { req: Request; isRelist: boolean }) => {
        const hasBlockers = !isRelist && (req.tenants.length > 0 || req.bookings.length > 0);
        const isExpanded = expanded === req.id;

        return (
            <div className={`bg-white border-2 rounded-2xl overflow-hidden shadow-sm transition-all ${
                isRelist ? 'border-emerald-200' : hasBlockers ? 'border-amber-200' : 'border-slate-200'
            }`}>
                <div className="p-5">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                            <div className={`p-2 rounded-xl flex-shrink-0 ${isRelist ? 'bg-emerald-100' : 'bg-orange-100'}`}>
                                {isRelist
                                    ? <Zap className="h-5 w-5 text-emerald-600" />
                                    : <PowerOff className="h-5 w-5 text-orange-600" />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-bold text-slate-900">{req.name}</h3>
                                    <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500">{req.displayId}</span>
                                    {isRelist ? (
                                        <span className="text-[10px] font-black bg-emerald-600 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                            <Zap className="h-2.5 w-2.5" /> RE-LIST REQUEST
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-black bg-orange-600 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                            <PowerOff className="h-2.5 w-2.5" /> EXIT REQUEST
                                        </span>
                                    )}
                                    {hasBlockers && (
                                        <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" /> BLOCKERS
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">{req.address}, {req.city}</p>
                                <p className="text-xs text-slate-500">
                                    Owner: <span className="font-semibold text-slate-700">{req.owner.name}</span> · {req.owner.email} · {req.owner.displayId}
                                </p>
                            </div>
                        </div>

                        {/* Stats — only for exit requests */}
                        {!isRelist && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <div className={`text-center px-3 py-1.5 rounded-xl border text-xs font-bold ${req.tenants.length > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                                    <div className="flex items-center gap-1"><Users className="h-3 w-3" />{req.tenants.length}</div>
                                    <div>Tenants</div>
                                </div>
                                <div className={`text-center px-3 py-1.5 rounded-xl border text-xs font-bold ${req.bookings.length > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                                    <div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{req.bookings.length}</div>
                                    <div>Bookings</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Reason Box */}
                    <div className="mt-4 space-y-3">
                        {req.deactivationRequestedAt && (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Clock className="h-3.5 w-3.5" />
                                Requested: <span className="font-medium text-slate-700">{new Date(req.deactivationRequestedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            </div>
                        )}
                        <div className={`rounded-xl p-3 ${isRelist ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                            <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${isRelist ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {isRelist ? "Owner's Re-list Reason" : "Owner's Exit Reason"}
                            </p>
                            <p className="text-sm text-slate-800">{req.deactivationReason || 'No reason provided.'}</p>
                        </div>

                        {hasBlockers && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                                <p className="text-[10px] font-black text-red-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" /> Cannot Approve Yet
                                </p>
                                <p className="text-xs text-red-700">
                                    {req.tenants.length > 0 && `${req.tenants.length} active tenant(s) must be moved out first. `}
                                    {req.bookings.length > 0 && `${req.bookings.length} active booking(s) must be cancelled.`}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 mt-4 flex-wrap">
                        {isRelist ? (
                            <button
                                onClick={() => handleApproveReactivation(req.id, req.name)}
                                disabled={isPending}
                                className="flex items-center gap-2 px-5 py-2.5 text-sm font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 transition-all disabled:opacity-60"
                            >
                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                                Approve Re-listing
                            </button>
                        ) : (
                            <button
                                onClick={() => handleApproveDeactivation(req.id, req.name)}
                                disabled={isPending || hasBlockers}
                                title={hasBlockers ? 'Resolve blockers first' : 'Approve and deactivate'}
                                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-black rounded-xl transition-all ${
                                    hasBlockers
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200'
                                }`}
                            >
                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PowerOff className="h-4 w-4" />}
                                Approve Deactivation
                            </button>
                        )}

                        <button
                            onClick={() => { setRejectDialogId(req.id); setRejectReason(''); }}
                            disabled={isPending}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-black bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all shadow-sm disabled:opacity-60"
                        >
                            <XCircle className="h-4 w-4" />
                            Reject Request
                        </button>

                        <button
                            onClick={() => setExpanded(isExpanded ? null : req.id)}
                            className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors ml-auto"
                        >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            {isExpanded ? 'Less' : 'Details'}
                        </button>
                    </div>

                    {isExpanded && (
                        <div className="mt-4 pt-4 border-t text-xs text-slate-500 space-y-1">
                            <p><span className="font-semibold text-slate-700">Owner Phone:</span> {req.owner.phone || 'N/A'}</p>
                            <p><span className="font-semibold text-slate-700">Full Address:</span> {req.address}, {req.city}</p>
                        </div>
                    )}
                </div>

                {/* Inline Reject Dialog */}
                {rejectDialogId === req.id && (
                    <div className="border-t-2 bg-slate-50 p-5">
                        <p className="text-sm font-black text-slate-900 mb-3">
                            Rejection Reason <span className="text-red-500">*</span>
                            <span className="text-xs font-normal text-slate-400 ml-2">
                                ({isRelist ? 'Property stays DEACTIVATED' : 'Property stays LIVE'})
                            </span>
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder={isRelist
                                ? "e.g. Property verification documents have expired. Please re-submit for re-onboarding."
                                : "e.g. Property has 2 active tenants. Please ensure all tenants have vacated before requesting exit."
                            }
                            rows={3}
                            className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                        />
                        <div className="flex gap-3 mt-3">
                            <button
                                onClick={() => handleReject(req.id, req.name, isRelist)}
                                disabled={!rejectReason.trim() || isPending}
                                className="px-5 py-2.5 text-sm font-black bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all"
                            >
                                {isPending ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : null}
                                Confirm Rejection
                            </button>
                            <button
                                onClick={() => setRejectDialogId(null)}
                                className="px-5 py-2.5 text-sm font-medium border-2 border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-900 rounded-xl">
                        <PowerOff className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Property Lifecycle Requests</h1>
                        <p className="text-sm text-slate-500">Manage property exit and re-listing requests</p>
                    </div>
                </div>
                <button
                    onClick={fetchRequests}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-2 border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    Refresh
                </button>
            </div>

            {/* Flash Message */}
            {actionMsg && (
                <div className={`flex items-center gap-3 p-4 rounded-xl text-sm font-semibold border-2 ${
                    actionMsg.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    {actionMsg.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {actionMsg.text}
                </div>
            )}

            {/* Industry Note */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <div className="p-1 bg-blue-100 rounded-lg flex-shrink-0"><Building className="h-4 w-4 text-blue-600" /></div>
                <p className="text-sm text-blue-800">
                    <span className="font-black">📋 RentPe Operational Policy:</span> Properties are deactivated instead of deleted to maintain full audit history.
                    For <span className="font-black text-orange-700">Exit Requests</span>: ensure 0 active tenants and 0 pending bookings before approving.
                    For <span className="font-black text-emerald-700">Re-list Requests</span>: approve to make property live immediately.
                </p>
            </div>

            {/* ── Filters ─────────────────────────────────────────────────── */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Search */}
                    <div className="flex-1 min-w-[240px] relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by property, ID, owner..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-sm border-2 border-slate-100 rounded-xl focus:outline-none focus:border-slate-300 transition-all font-medium"
                        />
                    </div>

                    {/* Request Type */}
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
                        {(['ALL', 'EXIT', 'RELIST'] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                                    filterType === type
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>

                    {/* Filter Dropdowns */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* City */}
                        <div className="relative group">
                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <select
                                value={filterCity}
                                onChange={(e) => setFilterCity(e.target.value)}
                                className="pl-9 pr-9 py-2 text-xs font-bold border-2 border-slate-100 rounded-xl appearance-none bg-white focus:outline-none focus:border-slate-300 cursor-pointer min-w-[130px]"
                            >
                                <option value="ALL">All Cities</option>
                                {cities.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none transition-transform group-focus-within:rotate-180" />
                        </div>

                        {/* Blockers */}
                        {filterType !== 'RELIST' && (
                            <div className="relative group">
                                <AlertTriangle className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <select
                                    value={filterBlocker}
                                    onChange={(e) => setFilterBlocker(e.target.value as any)}
                                    className="pl-9 pr-9 py-2 text-xs font-bold border-2 border-slate-100 rounded-xl appearance-none bg-white focus:outline-none focus:border-slate-300 cursor-pointer min-w-[150px]"
                                >
                                    <option value="ALL">Blocker Status</option>
                                    <option value="READY">Ready to Approve</option>
                                    <option value="BLOCKED">Has Blockers</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                            </div>
                        )}

                        {/* Sort */}
                        <div className="relative group">
                            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="pl-9 pr-9 py-2 text-xs font-bold border-2 border-slate-100 rounded-xl appearance-none bg-white focus:outline-none focus:border-slate-300 cursor-pointer min-w-[140px]"
                            >
                                <option value="NEWEST">Newest First</option>
                                <option value="OLDEST">Oldest First</option>
                                <option value="TENANTS">Most Tenants</option>
                                <option value="BOOKINGS">Most Bookings</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    {/* Clear Button */}
                    {(searchQuery || filterType !== 'ALL' || filterCity !== 'ALL' || filterBlocker !== 'ALL' || dateStart || dateEnd) && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-black text-red-500 hover:bg-red-50 rounded-xl transition-all uppercase tracking-wider"
                        >
                            <X className="h-3.5 w-3.5" /> Clear filters
                        </button>
                    )}
                </div>

                {/* Date Inputs */}
                <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2">
                            <Calendar className="h-3 w-3" /> Date Range
                        </span>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={dateStart}
                                onChange={(e) => setDateStart(e.target.value)}
                                className="px-3 py-1.5 text-xs font-bold border-2 border-slate-50 rounded-lg focus:outline-none focus:border-slate-200 transition-all cursor-pointer"
                            />
                            <span className="text-slate-300 text-xs font-bold">to</span>
                            <input
                                type="date"
                                value={dateEnd}
                                onChange={(e) => setDateEnd(e.target.value)}
                                className="px-3 py-1.5 text-xs font-bold border-2 border-slate-50 rounded-lg focus:outline-none focus:border-slate-200 transition-all cursor-pointer"
                            />
                        </div>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {filteredRequests.length} matching requests
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mr-3" /> Loading requests...
                </div>
            ) : requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="p-4 bg-emerald-100 rounded-full mb-4"><CheckCircle className="h-10 w-10 text-emerald-600" /></div>
                    <h3 className="text-lg font-bold text-slate-900">All Clear</h3>
                    <p className="text-sm text-slate-500 mt-1">No pending deactivation or re-listing requests.</p>
                </div>
            ) : filteredRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="p-4 bg-slate-100 rounded-full mb-4"><Search className="h-10 w-10 text-slate-400" /></div>
                    <h3 className="text-lg font-bold text-slate-900">No matching requests</h3>
                    <p className="text-sm text-slate-500 mt-1">Try adjusting your filters or search query.</p>
                    <button
                        onClick={clearFilters}
                        className="mt-6 px-6 py-2.5 text-sm font-black bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-sm"
                    >
                        Show All Requests
                    </button>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Exit Requests */}
                    {exitReqs.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-px flex-1 bg-orange-200" />
                                <span className="text-xs font-black uppercase tracking-widest text-orange-600 flex items-center gap-1.5">
                                    <PowerOff className="h-3.5 w-3.5" /> Exit Requests ({exitReqs.length})
                                </span>
                                <div className="h-px flex-1 bg-orange-200" />
                            </div>
                            {exitReqs.map(req => <RequestCard key={req.id} req={req} isRelist={false} />)}
                        </div>
                    )}

                    {/* Re-list Requests */}
                    {relistReqs.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-px flex-1 bg-emerald-200" />
                                <span className="text-xs font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
                                    <Zap className="h-3.5 w-3.5" /> Re-list Requests ({relistReqs.length})
                                </span>
                                <div className="h-px flex-1 bg-emerald-200" />
                            </div>
                            {relistReqs.map(req => <RequestCard key={req.id} req={req} isRelist={true} />)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
