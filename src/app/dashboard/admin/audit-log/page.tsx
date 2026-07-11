'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Search, Filter, Calendar, User, Building, Landmark, 
    CheckCircle, XCircle, LogIn, LogOut, ArrowRight, 
    Download, RefreshCw, ChevronLeft, ChevronRight,
    Eye, MoreVertical, FileText, Shield, HardDrive, Ghost
} from 'lucide-react';
import { getAuditLogs } from '@/actions/audit';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const getFormattedDiff = (prev: any, next: any) => {
    if (!next || typeof next !== 'object') return null;
    const diffs: { field: string; from: string; to: string }[] = [];
    
    Object.keys(next).forEach((key) => {
        const prevVal = prev ? prev[key] : undefined;
        const nextVal = next[key];
        
        if (key === 'id' || key === 'createdAt' || key === 'updatedAt') return;

        if (JSON.stringify(prevVal) !== JSON.stringify(nextVal)) {
            let fieldLabel = key;
            if (key === 'genderType') fieldLabel = 'Stay Gender Type';
            else if (key === 'foodType') fieldLabel = 'Food Type';
            else if (key === 'foodPricePerMonth') fieldLabel = 'Food Price';
            else if (key === 'noticePeriod') fieldLabel = 'Notice Period';
            else if (key === 'licenseNumber') fieldLabel = 'PG License';
            else if (key === 'reraId') fieldLabel = 'RERA ID';
            else if (key === 'gstNumber') fieldLabel = 'GST Number';
            else if (key === 'description') fieldLabel = 'Description';

            const formatValue = (v: any) => {
                if (v === null || v === undefined || v === '') return 'N/A';
                if (typeof v === 'object') return JSON.stringify(v);
                return String(v);
            };

            diffs.push({
                field: fieldLabel,
                from: formatValue(prevVal),
                to: formatValue(nextVal)
            });
        }
    });

    return diffs;
};

const getFallbackEntityName = (log: any) => {
    if (!log) return "N/A";
    if (log.entityName) return log.entityName;
    if (log.entityType === 'PROPERTY' && log.description) {
        const match = log.description.match(/Property\s+"([^"]+)"/i);
        if (match && match[1]) return match[1];
    }
    return "N/A";
};

const getFilteredDiffObjects = (prev: any, next: any) => {
    if (!next || typeof next !== 'object') return { prevFiltered: null, nextFiltered: null };
    if (!prev || typeof prev !== 'object') return { prevFiltered: null, nextFiltered: next };

    const prevFiltered: any = {};
    const nextFiltered: any = {};
    let hasChanges = false;

    const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);

    allKeys.forEach((key) => {
        if (key === 'id' || key === 'createdAt' || key === 'updatedAt' || key === 'ownerId') return;

        const prevVal = prev[key];
        const nextVal = next[key];

        if (JSON.stringify(prevVal) !== JSON.stringify(nextVal)) {
            prevFiltered[key] = prevVal;
            nextFiltered[key] = nextVal;
            hasChanges = true;
        }
    });

    if (!hasChanges) return { prevFiltered: null, nextFiltered: null };
    return { prevFiltered, nextFiltered };
};

const ROLE_OPTIONS = ['ALL', 'ADMIN', 'OWNER', 'USER', 'EMPLOYEE'];
const ENTITY_OPTIONS = ['ALL', 'USER', 'PROPERTY', 'BOOKING', 'PAYMENT', 'KYC'];
const ACTION_OPTIONS = ['ALL', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'IMPERSONATION'];

export default function AuditLogPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [actorRole, setActorRole] = useState('ALL');
    const [entityType, setEntityType] = useState('ALL');
    const [actionType, setActionType] = useState('ALL');

    const [selectedLog, setSelectedLog] = useState<any | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getAuditLogs({
                actorRole,
                actionType,
                entityType,
                search,
                page,
                limit: 20
            });
            setLogs(res.logs);
            setTotal(res.total);
        } catch (error) {
            toast.error("Failed to fetch audit logs");
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [actorRole, actionType, entityType, search, page]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const getActionBadge = (action: string) => {
        switch (action) {
            case 'CREATE': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">CREATE</span>;
            case 'UPDATE': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">UPDATE</span>;
            case 'DELETE': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">DELETE</span>;
            case 'APPROVE': return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">APPROVE</span>;
            case 'REJECT': return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">REJECT</span>;
            case 'LOGIN': return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium uppercase">LOGIN</span>;
            case 'IMPERSONATION_START': return (
                <span className="flex items-center gap-1.5 px-2 py-1 bg-indigo-600 text-white rounded-full text-xs font-black shadow-sm ring-2 ring-indigo-200 uppercase tracking-tighter">
                    <Ghost size={12} className="animate-pulse" /> START
                </span>
            );
            case 'IMPERSONATION_STOP': return (
                <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 text-slate-100 rounded-full text-xs font-black shadow-sm border border-slate-700 uppercase tracking-tighter">
                    <ArrowRight size={12} /> RETURN
                </span>
            );
            default: return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium uppercase">{action}</span>;
        }
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'ADMIN': return <Shield size={14} className="text-red-500" />;
            case 'OWNER': return <Building size={14} className="text-blue-500" />;
            case 'USER': return <User size={14} className="text-green-500" />;
            default: return <User size={14} className="text-gray-500" />;
        }
    };

    const exportToCSV = () => {
        if (logs.length === 0) return;
        const headers = ["Timestamp", "Actor Name", "Actor Role", "Actor Email", "Action", "Entity Type", "Entity Name", "Entity ID", "Description", "IP Address", "User Agent"];
        const rows = logs.map(l => [
            new Date(l.createdAt).toLocaleString(),
            l.actorName,
            l.actorRole,
            l.actor?.email || "N/A",
            l.actionType,
            l.entityType,
            l.entityName || "N/A",
            l.entityId || "N/A",
            l.description.replace(/,/g, ';'), // Escape commas
            l.ipAddress,
            l.userAgent || "N/A"
        ]);
        
        const csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `rentpe_audit_log_${new Date().toISOString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <HardDrive className="text-blue-600" />
                        System Audit Logs
                    </h1>
                    <p className="text-gray-500 text-sm">Monitor platform activities and security events</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        <Download size={16} />
                        Export CSV
                    </button>
                    <button 
                        onClick={() => { setPage(1); fetchLogs(); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search logs..." 
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Role</span>
                    <select 
                        className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={actorRole}
                        onChange={(e) => setActorRole(e.target.value)}
                    >
                        {ROLE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Entity</span>
                    <select 
                        className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={entityType}
                        onChange={(e) => setEntityType(e.target.value)}
                    >
                        {ENTITY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</span>
                    <select 
                        className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={actionType}
                        onChange={(e) => setActionType(e.target.value)}
                    >
                        {ACTION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-bottom border-gray-100">
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Timestamp</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Actor</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Entity</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Client Info</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {logs.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-100 rounded-xl p-8 max-w-sm mx-auto">
                                            <FileText size={48} className="text-gray-200" />
                                            <p className="text-gray-400 text-sm">No logs found matching your filters.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr 
                                        key={log.id} 
                                        onClick={() => { setSelectedLog(log); setIsDetailOpen(true); }}
                                        className="hover:bg-gray-50 transition-colors group cursor-pointer"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">
                                                {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                {new Date(log.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                                                    {getRoleIcon(log.actorRole)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-slate-800 leading-tight truncate max-w-[150px]" title={log.actorName}>{log.actorName}</div>
                                                    <div className="text-[9px] text-slate-400 font-bold uppercase leading-none mt-0.5">{log.actorRole}</div>
                                                    {log.actor?.email && (
                                                        <div className="text-[10px] text-slate-500 font-mono mt-0.5 leading-none truncate max-w-[180px]" title={log.actor.email}>{log.actor.email}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">{getActionBadge(log.actionType)}</td>
                                        <td className="px-6 py-4">
                                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase transition-colors">
                                                {log.entityType}
                                            </div>
                                            {log.entityName && (
                                                <div className="text-[11px] text-slate-700 font-medium mt-1 max-w-[140px] truncate" title={log.entityName}>
                                                    {log.entityName}
                                                </div>
                                            )}
                                            {log.entityId && (
                                                <div className="text-[9px] text-slate-400 font-mono mt-0.5 max-w-[140px] truncate" title={log.entityId}>
                                                    ID: {log.entityId}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-gray-600 line-clamp-2 max-w-md">
                                                {log.description}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[11px] text-gray-500 font-mono">
                                                {log.ipAddress}
                                            </div>
                                            <div className="text-[10px] text-gray-400 truncate max-w-[120px]" title={log.userAgent}>
                                                {log.userAgent}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedLog(log);
                                                    setIsDetailOpen(true);
                                                }}
                                                className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200 group-hover:block hidden"
                                            >
                                                <Eye size={16} className="text-gray-400 hover:text-blue-500" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="bg-white px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                        Showing <span className="font-semibold text-gray-800">{logs.length > 0 ? (page - 1) * 20 + 1 : 0}</span> to <span className="font-semibold text-gray-800">{Math.min(page * 20, total)}</span> of <span className="font-semibold text-gray-800">{total}</span> results
                    </p>
                    <div className="flex items-center gap-2">
                        <button 
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="p-2 border border-gray-200 rounded-lg enabled:hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-semibold px-4 text-gray-700">Page {page}</span>
                        <button 
                            disabled={page * 20 >= total}
                            onClick={() => setPage(p => p + 1)}
                            className="p-2 border border-gray-200 rounded-lg enabled:hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-[95vw] sm:max-w-5xl bg-white rounded-[32px] border-2 border-slate-100 shadow-2xl p-6 overflow-hidden">
                    <DialogHeader className="border-b-2 border-slate-50 pb-4 mb-4">
                        <DialogTitle className="text-base font-black tracking-wider text-slate-800 uppercase">Audit Log Details</DialogTitle>
                    </DialogHeader>
                    {selectedLog && (
                        <div className="space-y-5">
                            {/* Summary row */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Timestamp</p>
                                    <p className="text-xs font-bold text-slate-800">
                                        {new Date(selectedLog.createdAt).toLocaleString()}
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Actor</p>
                                    <p className="text-xs font-bold text-slate-800 truncate" title={`${selectedLog.actorName} (${selectedLog.actorRole})`}>
                                        {selectedLog.actorName} ({selectedLog.actorRole})
                                    </p>
                                    {selectedLog.actor?.email && (
                                        <p className="text-[9px] font-mono font-medium text-slate-500 truncate select-all mt-0.5" title={selectedLog.actor.email}>
                                            {selectedLog.actor.email}
                                        </p>
                                    )}
                                </div>
                                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Action & Entity</p>
                                    <p className="text-xs font-bold text-slate-800">
                                        <span className="uppercase tracking-tighter mr-1.5">{selectedLog.actionType}</span> 
                                        <span className="bg-slate-100 text-[10px] px-1.5 py-0.5 rounded font-black text-slate-500 uppercase">{selectedLog.entityType}</span>
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Target Entity</p>
                                    <p className="text-xs font-bold text-slate-800 truncate" title={getFallbackEntityName(selectedLog) || selectedLog.entityId || 'N/A'}>
                                        {getFallbackEntityName(selectedLog)}
                                    </p>
                                    <p className="text-[9px] font-mono text-slate-400 truncate" title={selectedLog.entityId || ''}>
                                        {selectedLog.entityId || "N/A"}
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">IP Address</p>
                                    <p className="text-xs font-mono font-bold text-slate-800">{selectedLog.ipAddress || "N/A"}</p>
                                </div>
                            </div>

                            {/* Description block */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Description</p>
                                <p className="text-xs font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">
                                    {selectedLog.description?.replace(/→/g, '->')}
                                </p>
                            </div>

                            {/* Changes */}
                            {(selectedLog.previousValue || selectedLog.newValue) ? (() => {
                                const { prevFiltered, nextFiltered } = getFilteredDiffObjects(selectedLog.previousValue, selectedLog.newValue);
                                return (
                                    <div className="space-y-3 pt-3 border-t-2 border-slate-50">
                                        <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-600">Audit Difference (Data Changes)</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="bg-red-50/50 p-3.5 rounded-2xl border border-red-100">
                                                <div className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-1.5">Previous Data Value</div>
                                                <pre className="text-[10px] font-mono font-medium text-red-900 whitespace-pre-wrap overflow-x-auto max-h-48 scrollbar-thin">
                                                    {prevFiltered ? JSON.stringify(prevFiltered, null, 2) : "N/A (No changes or newly created)"}
                                                </pre>
                                            </div>
                                            <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100">
                                                <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1.5">New Data Value</div>
                                                <pre className="text-[10px] font-mono font-medium text-emerald-900 whitespace-pre-wrap overflow-x-auto max-h-48 scrollbar-thin">
                                                    {nextFiltered ? JSON.stringify(nextFiltered, null, 2) : "N/A"}
                                                </pre>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })() : null}

                            {/* Client agent info */}
                            {selectedLog.userAgent && (
                                <div className="bg-slate-50/30 p-3 rounded-2xl border border-slate-100">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">User Agent Header</p>
                                    <p className="text-[9px] font-medium text-slate-500 font-mono leading-relaxed truncate" title={selectedLog.userAgent}>{selectedLog.userAgent}</p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
