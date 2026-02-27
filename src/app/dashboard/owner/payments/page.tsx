"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, IndianRupee, RefreshCcw, ChevronDown, ChevronUp, History } from "lucide-react";
import { getTenants, markRentAsPaid, markRentAsUnpaid } from "@/actions/tenants";

export default function OwnerPaymentsPage() {
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [payNotes, setPayNotes] = useState<Record<string, string>>({});
    const [showNote, setShowNote] = useState<Record<string, boolean>>({});
    const [filterStatus, setFilterStatus] = useState<"ALL" | "PAID" | "UNPAID">("ALL");
    const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());

    const currentMonth = new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });

    const fetchData = async () => {
        setLoading(true);
        try { setTenants(await getTenants()); }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const toggleHistory = (id: string) => {
        setExpandedHistory(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const activeTenants = tenants.filter(t => t.status !== "VACATED");

    const totalExpected = activeTenants.reduce((sum, t) => sum + (Number(t.rentAmount) || 0), 0);
    const paidTenants = activeTenants.filter(t => {
        const r = t.rentRecords?.find((r: any) => r.month === currentMonth);
        return r?.paid;
    });
    const unpaidTenants = activeTenants.filter(t => {
        const r = t.rentRecords?.find((r: any) => r.month === currentMonth);
        return !r?.paid;
    });
    const totalReceived = paidTenants.reduce((sum, t) => sum + (Number(t.rentAmount) || 0), 0);
    const totalPending = unpaidTenants.reduce((sum, t) => sum + (Number(t.rentAmount) || 0), 0);

    const handleMarkPaid = async (recordId: string, tenantId: string) => {
        const note = payNotes[tenantId]?.trim();
        if (!note) { alert("A note is mandatory before marking as Paid."); return; }
        try {
            await markRentAsPaid(recordId, note);
            setPayNotes(p => ({ ...p, [tenantId]: "" }));
            setShowNote(p => ({ ...p, [tenantId]: false }));
            await fetchData();
        } catch { alert("Failed to mark as paid."); }
    };

    const handleMarkUnpaid = async (recordId: string, tenantId: string) => {
        const note = payNotes[tenantId]?.trim();
        if (!note) { alert("A note is mandatory before reversing payment."); return; }
        if (!confirm("Reverse this payment to UNPAID?")) return;
        try {
            await markRentAsUnpaid(recordId, note);
            setPayNotes(p => ({ ...p, [tenantId]: "" }));
            setShowNote(p => ({ ...p, [tenantId]: false }));
            await fetchData();
        } catch { alert("Failed to reverse payment."); }
    };

    const filtered = activeTenants.filter(t => {
        const r = t.rentRecords?.find((r: any) => r.month === currentMonth);
        const isPaid = r?.paid ?? false;
        if (filterStatus === "PAID") return isPaid;
        if (filterStatus === "UNPAID") return !isPaid;
        return true;
    });

    if (loading) return <div className="p-8 text-center animate-pulse">Loading payments...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Payments</h1>
                    <p className="text-muted-foreground">Track monthly rent collection for {currentMonth}.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: "Total Expected", value: `₹${totalExpected.toLocaleString()}`, color: "bg-blue-50 border-blue-200 text-blue-700", icon: "💰" },
                    { label: "Total Received", value: `₹${totalReceived.toLocaleString()}`, color: "bg-green-50 border-green-200 text-green-700", icon: "✅" },
                    { label: "Pending", value: `₹${totalPending.toLocaleString()}`, color: "bg-red-50 border-red-200 text-red-700", icon: "⏳" },
                    { label: "Collection Rate", value: `${activeTenants.length ? Math.round((paidTenants.length / activeTenants.length) * 100) : 0}%`, color: "bg-purple-50 border-purple-200 text-purple-700", icon: "📊" },
                ].map(stat => (
                    <div key={stat.label} className={`p-4 rounded-xl border-2 ${stat.color}`}>
                        <div className="text-2xl mb-1">{stat.icon}</div>
                        <div className="text-2xl font-bold">{stat.value}</div>
                        <div className="text-sm font-medium">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
                {(["ALL", "PAID", "UNPAID"] as const).map(status => (
                    <Button
                        key={status}
                        size="sm"
                        variant={filterStatus === status ? "default" : "outline"}
                        className={filterStatus === status ? (status === "PAID" ? "bg-green-600 hover:bg-green-700" : status === "UNPAID" ? "bg-red-600 hover:bg-red-700" : "") : ""}
                        onClick={() => setFilterStatus(status)}
                    >
                        {status === "ALL" ? `All (${activeTenants.length})` : status === "PAID" ? `✅ Paid (${paidTenants.length})` : `❌ Unpaid (${unpaidTenants.length})`}
                    </Button>
                ))}
            </div>

            {/* Payments Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted border-b">
                                <tr>
                                    <th className="p-4 text-left font-medium">Tenant</th>
                                    <th className="p-4 text-left font-medium">Room</th>
                                    <th className="p-4 text-left font-medium">Rent</th>
                                    <th className="p-4 text-left font-medium">{currentMonth} Status</th>
                                    <th className="p-4 text-left font-medium">Paid On</th>
                                    <th className="p-4 text-left font-medium">Action</th>
                                    <th className="p-4 text-left font-medium">Full History</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(t => {
                                    const record = t.rentRecords?.find((r: any) => r.month === currentMonth);
                                    const isPaid = record?.paid ?? false;
                                    const allRecords = t.rentRecords || [];
                                    const paymentNotes = (t.actionNotes || []).filter((n: any) => n.action === 'PAYMENT_MARKED_PAID' || n.action === 'PAYMENT_MARKED_UNPAID');
                                    const isHistoryOpen = expandedHistory.has(t.id);

                                    return (
                                        <tr key={t.id} className={`border-b hover:bg-muted/5 ${isPaid ? "bg-green-50/20" : "bg-red-50/20"}`}>
                                            <td className="p-4">
                                                <div className="font-medium">{t.name}</div>
                                                <div className="text-xs text-muted-foreground font-mono">{t.displayId}</div>
                                            </td>
                                            <td className="p-4 text-sm">{t.roomNumber} <span className="text-xs text-muted-foreground">({t.roomType})</span></td>
                                            <td className="p-4 font-bold text-lg">₹{Number(t.rentAmount).toLocaleString()}</td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${isPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                                    {isPaid ? <><CheckCircle className="h-4 w-4" /> Paid</> : <><XCircle className="h-4 w-4" /> Unpaid</>}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-muted-foreground">{record?.paidOn || "—"}</td>
                                            <td className="p-4">
                                                {!showNote[t.id] ? (
                                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowNote(p => ({ ...p, [t.id]: true }))}>
                                                        {isPaid ? "↩ Mark Unpaid" : "✓ Mark Paid"}
                                                    </Button>
                                                ) : (
                                                    <div className="space-y-1 min-w-[180px]">
                                                        <Input
                                                            className="h-7 text-xs"
                                                            placeholder="Note (mandatory)..."
                                                            value={payNotes[t.id] || ""}
                                                            onChange={e => setPayNotes(p => ({ ...p, [t.id]: e.target.value }))}
                                                        />
                                                        <div className="flex gap-1">
                                                            {!isPaid && record && (
                                                                <Button size="sm" className="h-6 text-[10px] bg-green-600 hover:bg-green-700" onClick={() => handleMarkPaid(record.id, t.id)}>✓ Paid</Button>
                                                            )}
                                                            {isPaid && record && (
                                                                <Button size="sm" variant="outline" className="h-6 text-[10px] border-red-300 text-red-600" onClick={() => handleMarkUnpaid(record.id, t.id)}>↩ Unpaid</Button>
                                                            )}
                                                            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setShowNote(p => ({ ...p, [t.id]: false }))}>✕</Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 text-xs gap-1"
                                                        onClick={() => toggleHistory(t.id)}
                                                    >
                                                        <History className="h-3 w-3" />
                                                        {isHistoryOpen ? "Hide" : `${allRecords.length} months`}
                                                        {isHistoryOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                    </Button>

                                                    {isHistoryOpen && (
                                                        <div className="mt-2 space-y-1 max-h-56 overflow-y-auto">
                                                            {/* Month-by-month rent history */}
                                                            <div className="text-[10px] font-bold text-purple-700 mb-1">📅 Month-by-Month Rent History</div>
                                                            {allRecords.length > 0 ? allRecords.map((r: any) => (
                                                                <div key={r.id} className={`text-[10px] p-1.5 rounded border ${r.paid ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                                                                    <div className="flex justify-between">
                                                                        <span className="font-bold">{r.month}</span>
                                                                        <span>{r.paid ? "✅ Paid" : "❌ Unpaid"}</span>
                                                                    </div>
                                                                    {r.paidOn && <div className="text-[9px] opacity-70">Paid: {r.paidOn}</div>}
                                                                </div>
                                                            )) : <div className="text-[10px] text-muted-foreground italic">No records</div>}

                                                            {/* Action logs */}
                                                            {paymentNotes.length > 0 && (
                                                                <>
                                                                    <div className="text-[10px] font-bold text-blue-700 mt-2 mb-1">📝 Action Logs</div>
                                                                    {paymentNotes.map((note: any, i: number) => (
                                                                        <div key={i} className={`text-[9px] p-1 rounded border ${note.action === 'PAYMENT_MARKED_PAID' ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-orange-50 border-orange-200 text-orange-700"}`}>
                                                                            <div className="font-bold">{note.action === 'PAYMENT_MARKED_PAID' ? "💰 Marked Paid" : "↩ Reversed to Unpaid"}</div>
                                                                            <div>{note.reason}</div>
                                                                            <div className="opacity-60">{new Date(note.timestamp).toLocaleString('en-IN')}</div>
                                                                        </div>
                                                                    ))}
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No tenants found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
