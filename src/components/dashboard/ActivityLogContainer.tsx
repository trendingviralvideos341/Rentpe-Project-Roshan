"use client";

import { useState, useEffect, Fragment } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, RefreshCcw, ChevronDown, ChevronUp, User, Users } from "lucide-react";
import { getOwnerActivityLog } from "@/actions/activity";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const actionLabels: Record<string, { label: string; color: string; icon: string }> = {
    BOOKING_APPROVED: { label: "Booking Approved", color: "bg-green-100 text-green-800 border-green-200", icon: "✅" },
    BOOKING_REJECTED: { label: "Booking Rejected", color: "bg-red-100 text-red-800 border-red-200", icon: "❌" },
    TENANT_VACATED: { label: "Tenant Vacated", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: "🏠" },
    TENANT_RESTORED: { label: "Tenant Restored", color: "bg-purple-100 text-purple-800 border-purple-200", icon: "🔄" },
    STAFF_ADDED: { label: "Staff Added", color: "bg-blue-100 text-blue-800 border-blue-200", icon: "👥" },
    STAFF_REMOVED: { label: "Staff Removed", color: "bg-orange-100 text-orange-800 border-orange-200", icon: "🔒" },
    STAFF_RESTORED: { label: "Staff Restored", color: "bg-green-100 text-green-800 border-green-200", icon: "✅" },
    RENT_PAID: { label: "Rent Marked Paid", color: "bg-green-100 text-green-800 border-green-200", icon: "💰" },
    RENT_UNPAID: { label: "Rent Reversed Unpaid", color: "bg-red-100 text-red-800 border-red-200", icon: "↩️" },
    TICKET_RESOLVED: { label: "Ticket Resolved", color: "bg-teal-100 text-teal-800 border-teal-200", icon: "🎫" },
    FOOD_MENU_UPDATED: { label: "Food Menu Updated", color: "bg-amber-100 text-amber-800 border-amber-200", icon: "🍽️" },
};

export function ActivityLogContainer({ role }: { role: 'owner' | 'staff' }) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterAction, setFilterAction] = useState("ALL");
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState(role === 'owner' ? "owner" : "staff");

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await getOwnerActivityLog();
            setLogs(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const filtered = logs
        .filter(l => filterAction === "ALL" || l.actionType === filterAction)
        .filter(l =>
            (l.entityId || "").toLowerCase().includes(search.toLowerCase()) ||
            (l.description || "").toLowerCase().includes(search.toLowerCase()) ||
            l.actionType.toLowerCase().includes(search.toLowerCase())
        );

    const uniqueActions = [...new Set(logs.map(l => l.actionType))].sort();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold">Activity Log</h1>
                    <p className="text-muted-foreground">{role === 'owner' ? "All actions taken by you and your staff — with notes and reasons." : "Your recent actions and updates."}</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Actions", value: logs.length, color: "bg-blue-50 border-blue-200 text-blue-700" },
                    { label: "Approvals", value: logs.filter(l => l.actionType.includes("APPROVED") || l.actionType.includes("PAID") || l.actionType.includes("RESTORED")).length, color: "bg-green-50 border-green-200 text-green-700" },
                    { label: "Rejections", value: logs.filter(l => l.actionType.includes("REJECTED") || l.actionType.includes("REMOVED") || l.actionType.includes("VACATED")).length, color: "bg-red-50 border-red-200 text-red-700" },
                    { label: "Today", value: logs.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length, color: "bg-purple-50 border-purple-200 text-purple-700" },
                ].map(stat => (
                    <div key={stat.label} className={`p-3 rounded-lg border text-center ${stat.color}`}>
                        <div className="text-2xl font-bold">{stat.value}</div>
                        <div className="text-xs font-medium">{stat.label}</div>
                    </div>
                ))}
            </div>

            {role === 'owner' ? (
                <Tabs defaultValue="owner" value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
                    <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted p-1">
                        <TabsTrigger value="owner" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-600 font-semibold">
                            <User className="w-4 h-4 mr-2" /> My Actions
                        </TabsTrigger>
                        <TabsTrigger value="staff" className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600 font-semibold">
                            <Users className="w-4 h-4 mr-2" /> Staff Actions
                        </TabsTrigger>
                    </TabsList>

                    <FilterControls 
                        search={search} 
                        setSearch={setSearch} 
                        filterAction={filterAction} 
                        setFilterAction={setFilterAction} 
                        uniqueActions={uniqueActions} 
                        logs={logs} 
                    />

                    {["owner", "staff"].map(tabValue => {
                        const activeLogs = filtered.filter(l => {
                            if (tabValue === "owner") return l.actor?.role === 'OWNER';
                            return l.actor?.role === 'STAFF';
                        });

                        return (
                            <TabsContent key={tabValue} value={tabValue}>
                                <LogTable 
                                    loading={loading} 
                                    activeLogs={activeLogs} 
                                    expandedRows={expandedRows} 
                                    toggleRow={toggleRow} 
                                    showActor={tabValue === "staff"} 
                                />
                            </TabsContent>
                        );
                    })}
                </Tabs>
            ) : (
                <div className="space-y-4">
                    <FilterControls 
                        search={search} 
                        setSearch={setSearch} 
                        filterAction={filterAction} 
                        setFilterAction={setFilterAction} 
                        uniqueActions={uniqueActions} 
                        logs={logs} 
                    />
                    <LogTable 
                        loading={loading} 
                        activeLogs={filtered} 
                        expandedRows={expandedRows} 
                        toggleRow={toggleRow} 
                        showActor={false} 
                    />
                </div>
            )}
        </div>
    );
}

function FilterControls({ search, setSearch, filterAction, setFilterAction, uniqueActions, logs }: any) {
    return (
        <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1 w-full relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-10" placeholder="Search activity..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="w-full sm:w-auto border rounded-md p-2 bg-background text-sm min-w-[200px]" value={filterAction} onChange={e => setFilterAction(e.target.value)}>
                <option value="ALL">All Actions ({logs.length})</option>
                {uniqueActions.map((a: string) => {
                    const info = actionLabels[a];
                    return (
                        <option key={a} value={a}>
                            {info ? `${info.icon} ${info.label}` : a} ({logs.filter((l: any) => l.actionType === a).length})
                        </option>
                    );
                })}
            </select>
        </div>
    );
}

function LogTable({ loading, activeLogs, expandedRows, toggleRow, showActor }: any) {
    return (
        <Card>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            <tr>
                                <th className="p-4 text-left w-40">Timestamp</th>
                                <th className="p-4 text-left w-48">Action</th>
                                <th className="p-4 text-left">Target Entity</th>
                                <th className="p-4 text-left">Details</th>
                                <th className="p-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center animate-pulse font-bold text-muted-foreground">Synchronizing Logs...</td></tr>
                            ) : activeLogs.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No recent activity detected.</td></tr>
                            ) : (
                                activeLogs.map((log: any) => {
                                    const info = actionLabels[log.actionType] || { label: log.actionType, color: "bg-gray-100 text-gray-800 border-gray-200", icon: "📌" };
                                    const isExpanded = expandedRows.has(log.id);
                                    const hasDetails = log.description && log.description.length > 0;
                                    return (
                                        <Fragment key={log.id}>
                                            <tr className={`hover:bg-indigo-50/30 cursor-pointer transition-colors ${isExpanded ? "bg-indigo-50/50" : ""}`} onClick={() => hasDetails && toggleRow(log.id)}>
                                                <td className="p-4 text-xs">
                                                    <div className="font-bold text-slate-700">{new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                                                    <div className="text-slate-400">{new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border-2 shadow-sm ${info.color}`}>
                                                        {info.icon} {info.label}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-left">
                                                    <div className="text-[10px] font-black uppercase text-slate-400">{log.entityType || "SYSTEM"}</div>
                                                    {log.entityName && (
                                                        <div className="text-xs font-semibold text-slate-700 truncate max-w-[140px] mb-0.5" title={log.entityName}>
                                                            {log.entityName}
                                                        </div>
                                                    )}
                                                    <div className="font-mono text-[9px] font-bold text-indigo-600 truncate max-w-[120px] leading-tight" title={log.entityId}>
                                                        ID: {log.entityId || "N/A"}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    {showActor && <div className="text-[10px] font-bold text-indigo-600 mb-1">BY: {log.actor?.displayId || log.actorId}</div>}
                                                    <p className="text-xs font-medium text-slate-600 line-clamp-2">{log.description || "No notes recorded"}</p>
                                                </td>
                                                <td className="p-4 text-slate-400">{hasDetails && (isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}</td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-indigo-50/20 border-b border-indigo-100">
                                                    <td colSpan={5} className="px-8 py-6">
                                                        <div className="bg-white border-2 border-indigo-100 rounded-2xl p-4 shadow-sm">
                                                            <div className="text-[10px] font-black uppercase text-indigo-600 mb-3 tracking-widest px-1">Full Transaction Notes</div>
                                                            <p className="text-xs font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">{log.description}</p>
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t-2 border-indigo-50">
                                                                <div>
                                                                    <div className="text-[9px] font-black text-slate-400 uppercase">Actor</div>
                                                                    <div className="text-[10px] font-bold text-slate-700">{log.actor?.name || "System"} ({log.actor?.displayId || "ID-N/A"})</div>
                                                                    {log.actor?.email && <div className="text-[9px] font-mono text-slate-500 mt-0.5 truncate" title={log.actor.email}>{log.actor.email}</div>}
                                                                </div>
                                                                <div>
                                                                    <div className="text-[9px] font-black text-slate-400 uppercase">Action</div>
                                                                    <div className="text-[10px] font-bold text-slate-700">{log.actionType}</div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-[9px] font-black text-slate-400 uppercase">Entity</div>
                                                                    <div className="text-[10px] font-bold text-slate-700">{log.entityType}: {log.entityId}</div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-[9px] font-black text-slate-400 uppercase">Date/Time</div>
                                                                    <div className="text-[10px] font-bold text-slate-700">{new Date(log.createdAt).toLocaleString()}</div>
                                                                </div>
                                                            </div>

                                                            {/* Changes */}
                                                            {(log.previousValue || log.newValue) && (
                                                                <div className="space-y-3 pt-4 border-t-2 border-indigo-50 mt-6">
                                                                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-600">Audit Difference (Data Changes)</h4>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                        <div className="bg-red-50/50 p-3.5 rounded-2xl border border-red-100">
                                                                            <div className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-1.5">Previous Data Value</div>
                                                                            <pre className="text-[10px] font-mono font-medium text-red-900 whitespace-pre-wrap overflow-x-auto max-h-48 scrollbar-thin">
                                                                                {JSON.stringify(log.previousValue, null, 2) || "N/A"}
                                                                            </pre>
                                                                        </div>
                                                                        <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100">
                                                                            <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1.5">New Data Value</div>
                                                                            <pre className="text-[10px] font-mono font-medium text-emerald-900 whitespace-pre-wrap overflow-x-auto max-h-48 scrollbar-thin">
                                                                                {JSON.stringify(log.newValue, null, 2) || "N/A"}
                                                                            </pre>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
