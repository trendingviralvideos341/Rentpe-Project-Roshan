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

export default function OwnerActivityLogPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterAction, setFilterAction] = useState("ALL");
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState("owner");

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
        .filter(l => filterAction === "ALL" || l.action === filterAction)
        .filter(l =>
            (l.targetId || "").toLowerCase().includes(search.toLowerCase()) ||
            (l.details || "").toLowerCase().includes(search.toLowerCase()) ||
            l.action.toLowerCase().includes(search.toLowerCase())
        );

    const uniqueActions = [...new Set(logs.map(l => l.action))].sort();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold">Activity Log</h1>
                    <p className="text-muted-foreground">All actions taken by you and your staff — with notes and reasons.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: "Total Actions", value: logs.length, color: "bg-blue-50 border-blue-200 text-blue-700" },
                    { label: "Approvals", value: logs.filter(l => l.action.includes("APPROVED") || l.action.includes("PAID") || l.action.includes("RESTORED")).length, color: "bg-green-50 border-green-200 text-green-700" },
                    { label: "Rejections/Removals", value: logs.filter(l => l.action.includes("REJECTED") || l.action.includes("REMOVED") || l.action.includes("VACATED")).length, color: "bg-red-50 border-red-200 text-red-700" },
                    { label: "Today", value: logs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString()).length, color: "bg-purple-50 border-purple-200 text-purple-700" },
                ].map(stat => (
                    <div key={stat.label} className={`p-3 rounded-lg border text-center ${stat.color}`}>
                        <div className="text-2xl font-bold">{stat.value}</div>
                        <div className="text-xs font-medium">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="owner" value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
                <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted p-1">
                    <TabsTrigger value="owner" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-600 font-semibold">
                        <User className="w-4 h-4 mr-2" /> My Actions
                    </TabsTrigger>
                    <TabsTrigger value="staff" className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600 font-semibold">
                        <Users className="w-4 h-4 mr-2" /> Staff Actions
                    </TabsTrigger>
                </TabsList>

                <div className="flex gap-4 items-center">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-10" placeholder="Search by target ID, notes, or action..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="border rounded-md p-2 bg-background text-sm min-w-[200px]" value={filterAction} onChange={e => setFilterAction(e.target.value)}>
                        <option value="ALL">All Actions ({logs.length})</option>
                        {uniqueActions.map(a => {
                            const info = actionLabels[a];
                            return (
                                <option key={a} value={a}>
                                    {info ? `${info.icon} ${info.label}` : a} ({logs.filter(l => l.action === a).length})
                                </option>
                            );
                        })}
                    </select>
                </div>

                {["owner", "staff"].map(tabValue => {
                    const activeLogs = filtered.filter(l => {
                        // The Owner has a User record (l.performer exists). 
                        // Staff only have OwnerStaff records (l.performer is null, and performedBy is their displayId e.g., STAFF-XXX)
                        if (tabValue === "owner") return l.performer !== null;
                        return l.performer === null;
                    });

                    return (
                        <TabsContent key={tabValue} value={tabValue}>

                            {/* Log Table */}
                            <Card>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-muted border-b">
                                                <tr>
                                                    <th className="p-4 text-left font-medium w-40">When</th>
                                                    <th className="p-4 text-left font-medium w-48">Action</th>
                                                    <th className="p-4 text-left font-medium">Target</th>
                                                    <th className="p-4 text-left font-medium">Notes / Reason</th>
                                                    <th className="p-4 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {loading ? (
                                                    <tr><td colSpan={5} className="p-8 text-center animate-pulse">Loading activity log...</td></tr>
                                                ) : activeLogs.length === 0 ? (
                                                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No activity found in this tab. Actions will appear here.</td></tr>
                                                ) : (
                                                    activeLogs.map((log) => {
                                                        const info = actionLabels[log.action] || { label: log.action, color: "bg-gray-100 text-gray-800 border-gray-200", icon: "📌" };
                                                        const isExpanded = expandedRows.has(log.id);
                                                        const hasDetails = log.details && log.details.length > 0;
                                                        return (
                                                            <Fragment key={log.id}>
                                                                <tr
                                                                    key={log.id}
                                                                    className={`hover:bg-muted/5 cursor-pointer ${isExpanded ? "bg-muted/10" : ""}`}
                                                                    onClick={() => hasDetails && toggleRow(log.id)}
                                                                >
                                                                    <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">
                                                                        <div className="font-medium text-foreground">
                                                                            {new Date(log.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                        </div>
                                                                        <div>
                                                                            {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-4">
                                                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${info.color}`}>
                                                                            {info.icon} {info.label}
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-4">
                                                                        <div className="text-xs font-medium uppercase text-muted-foreground">{log.targetType || "SYSTEM"}</div>
                                                                        <div className="font-mono text-xs text-foreground truncate max-w-[120px]" title={log.targetId}>{log.targetId || "N/A"}</div>
                                                                    </td>
                                                                    <td className="p-4">
                                                                        {tabValue === "staff" && (
                                                                            <div className="text-[10px] font-bold text-blue-600 mb-1">
                                                                                By: {log.performedBy}
                                                                            </div>
                                                                        )}
                                                                        {hasDetails ? (
                                                                            <p className="text-sm text-foreground line-clamp-2">{log.details}</p>
                                                                        ) : (
                                                                            <span className="text-xs text-muted-foreground italic">No notes recorded</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-4 text-muted-foreground">
                                                                        {hasDetails && (isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                                                                    </td>
                                                                </tr>
                                                                {isExpanded && (
                                                                    <tr key={`${log.id}-expanded`} className="bg-amber-50/50 border-b border-amber-100">
                                                                        <td colSpan={5} className="px-6 py-4">
                                                                            <div className="flex gap-6">
                                                                                <div className="flex-1">
                                                                                    <div className="text-xs font-bold uppercase text-amber-700 mb-1">📝 Full Notes / Reason</div>
                                                                                    <p className="text-sm text-foreground bg-white border border-amber-200 rounded-lg p-3 leading-relaxed">
                                                                                        {log.details}
                                                                                    </p>
                                                                                </div>
                                                                                <div className="text-xs space-y-2 min-w-[180px]">
                                                                                    <div>
                                                                                        <span className="font-bold text-muted-foreground uppercase">Action Type</span>
                                                                                        <div className="mt-0.5 font-medium">{info.icon} {info.label}</div>
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="font-bold text-muted-foreground uppercase">Target ID</span>
                                                                                        <div className="font-mono text-[10px] mt-0.5 break-all">{log.targetId || "N/A"}</div>
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="font-bold text-muted-foreground uppercase">Exact Time</span>
                                                                                        <div className="text-[10px] mt-0.5">{new Date(log.timestamp).toLocaleString('en-IN')}</div>
                                                                                    </div>
                                                                                </div>
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
                                    {activeLogs.length > 0 && (
                                        <div className="p-4 border-t text-xs text-muted-foreground text-center">
                                            Showing {activeLogs.length} activity entries in this tab. Click any row to expand full notes.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )
                })}
            </Tabs>
        </div>
    );
}
