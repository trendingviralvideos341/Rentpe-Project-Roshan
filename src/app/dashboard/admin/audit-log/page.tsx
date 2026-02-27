"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, RefreshCcw, ChevronDown, ChevronUp } from "lucide-react";
import { getAuditLogs } from "@/actions/admin";
import { Button } from "@/components/ui/button";

const actionLabels: Record<string, { label: string; color: string; icon: string }> = {
    USER_BANNED: { label: "User Banned", color: "bg-red-100 text-red-800 border-red-200", icon: "🚫" },
    USER_UNBANNED: { label: "User Unbanned", color: "bg-green-100 text-green-800 border-green-200", icon: "✅" },
    TEAM_MEMBER_ADDED: { label: "Team Member Added", color: "bg-blue-100 text-blue-800 border-blue-200", icon: "👤" },
    TEAM_ACCESS_REVOKED: { label: "Team Access Revoked", color: "bg-orange-100 text-orange-800 border-orange-200", icon: "🔒" },
    TEAM_ACCESS_RESTORED: { label: "Team Access Restored", color: "bg-green-100 text-green-800 border-green-200", icon: "🔓" },
    BOOKING_APPROVED: { label: "Booking Approved", color: "bg-green-100 text-green-800 border-green-200", icon: "✅" },
    BOOKING_REJECTED: { label: "Booking Rejected", color: "bg-red-100 text-red-800 border-red-200", icon: "❌" },
    BOOKING_REQUESTED: { label: "Booking Requested", color: "bg-blue-100 text-blue-800 border-blue-200", icon: "📋" },
    TENANT_VACATED: { label: "Tenant Vacated", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: "🏠" },
    TENANT_RESTORED: { label: "Tenant Restored", color: "bg-purple-100 text-purple-800 border-purple-200", icon: "🔄" },
    STAFF_ADDED: { label: "Staff Added", color: "bg-blue-100 text-blue-800 border-blue-200", icon: "👥" },
    STAFF_REMOVED: { label: "Staff Removed", color: "bg-orange-100 text-orange-800 border-orange-200", icon: "🔒" },
    STAFF_RESTORED: { label: "Staff Restored", color: "bg-green-100 text-green-800 border-green-200", icon: "✅" },
    RENT_PAID: { label: "Rent Marked Paid", color: "bg-green-100 text-green-800 border-green-200", icon: "💰" },
    RENT_UNPAID: { label: "Rent Reversed Unpaid", color: "bg-red-100 text-red-800 border-red-200", icon: "↩️" },
    PAYMENT_MARKED_PAID: { label: "Payment Marked", color: "bg-green-100 text-green-800 border-green-200", icon: "💰" },
    TEAM_MEMBER_RESTORED: { label: "Team Restored", color: "bg-green-100 text-green-800 border-green-200", icon: "✅" },
    TICKET_RESOLVED: { label: "Ticket Resolved", color: "bg-teal-100 text-teal-800 border-teal-200", icon: "🎫" },
    FOOD_MENU_UPDATED: { label: "Food Menu Updated", color: "bg-amber-100 text-amber-800 border-amber-200", icon: "🍽️" },
};

export default function AuditLogPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterAction, setFilterAction] = useState("ALL");
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await getAuditLogs();
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
            (l.performedBy || "").toLowerCase().includes(search.toLowerCase()) ||
            l.action.toLowerCase().includes(search.toLowerCase())
        );

    const uniqueActions = [...new Set(logs.map(l => l.action))].sort();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold">Audit Log</h1>
                    <p className="text-muted-foreground">Complete record of all actions taken by admins, owners, and owner teams — with notes.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: "Total Logs", value: logs.length, color: "bg-blue-50 border-blue-200 text-blue-700" },
                    { label: "Bans/Blocks", value: logs.filter(l => l.action.includes("BANNED") || l.action.includes("REVOKED") || l.action.includes("REMOVED")).length, color: "bg-red-50 border-red-200 text-red-700" },
                    { label: "Approvals", value: logs.filter(l => l.action.includes("APPROVED") || l.action.includes("PAID") || l.action.includes("RESTORED")).length, color: "bg-green-50 border-green-200 text-green-700" },
                    { label: "Today", value: logs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString()).length, color: "bg-purple-50 border-purple-200 text-purple-700" },
                ].map(stat => (
                    <div key={stat.label} className={`p-3 rounded-lg border text-center ${stat.color}`}>
                        <div className="text-2xl font-bold">{stat.value}</div>
                        <div className="text-xs font-medium">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex gap-4 items-center">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-10" placeholder="Search by ID, details, performer, or action..." value={search} onChange={e => setSearch(e.target.value)} />
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

            {/* Log Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted border-b">
                                <tr>
                                    <th className="p-4 text-left font-medium w-40">Timestamp</th>
                                    <th className="p-4 text-left font-medium w-48">Action</th>
                                    <th className="p-4 text-left font-medium">Target</th>
                                    <th className="p-4 text-left font-medium">Notes / Reason</th>
                                    <th className="p-4 text-left font-medium w-32">Performed By</th>
                                    <th className="p-4 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {loading ? (
                                    <tr><td colSpan={6} className="p-8 text-center animate-pulse">Loading audit logs...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No audit logs found.</td></tr>
                                ) : (
                                    filtered.map((log) => {
                                        const info = actionLabels[log.action] || { label: log.action, color: "bg-gray-100 text-gray-800 border-gray-200", icon: "📌" };
                                        const isExpanded = expandedRows.has(log.id);
                                        const hasDetails = log.details && log.details.length > 0;
                                        return (
                                            <>
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
                                                        {hasDetails ? (
                                                            <div className="flex items-start gap-2">
                                                                <div className="flex-1">
                                                                    <p className="text-sm text-foreground line-clamp-2">{log.details}</p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic">No notes recorded</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="text-xs font-mono bg-muted px-2 py-1 rounded truncate max-w-[100px]" title={log.performedBy}>
                                                            {log.performedBy ? log.performedBy.split('-')[0] + '...' : 'System'}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-muted-foreground">
                                                        {hasDetails && (isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr key={`${log.id}-expanded`} className="bg-amber-50/50 border-b border-amber-100">
                                                        <td colSpan={6} className="px-6 py-4">
                                                            <div className="flex gap-6">
                                                                <div className="flex-1">
                                                                    <div className="text-xs font-bold uppercase text-amber-700 mb-1">📝 Full Notes / Reason</div>
                                                                    <p className="text-sm text-foreground bg-white border border-amber-200 rounded-lg p-3 leading-relaxed">
                                                                        {log.details}
                                                                    </p>
                                                                </div>
                                                                <div className="text-xs space-y-2 min-w-[200px]">
                                                                    <div>
                                                                        <span className="font-bold text-muted-foreground uppercase">Action ID</span>
                                                                        <div className="font-mono text-[10px] mt-0.5 break-all">{log.id}</div>
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-bold text-muted-foreground uppercase">Performed By (ID)</span>
                                                                        <div className="font-mono text-[10px] mt-0.5 break-all">{log.performedBy || "System"}</div>
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
                                            </>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {filtered.length > 0 && (
                        <div className="p-4 border-t text-xs text-muted-foreground text-center">
                            Showing {filtered.length} of {logs.length} log entries. Click any row to expand full notes.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
