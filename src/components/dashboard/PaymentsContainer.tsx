"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, IndianRupee, RefreshCcw, ChevronDown, ChevronUp, History } from "lucide-react";
import { getTenants, markRentAsPaid, markRentAsUnpaid } from "@/actions/tenants";
import { toast } from "sonner";

export function PaymentsContainer() {
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [payNotes, setPayNotes] = useState<Record<string, string>>({});
    const [showNote, setShowNote] = useState<Record<string, boolean>>({});
    const [filterStatus, setFilterStatus] = useState<"ALL" | "PAID" | "UNPAID">("ALL");
    const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());

    const currentMonth = new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });

    const fetchData = async () => {
        setLoading(true);
        try { 
            const data = await getTenants();
            setTenants(data); 
        }
        catch (e) { 
            console.error(e);
            toast.error("Failed to fetch payments data");
        }
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

    const activeTenants = tenants.filter(t => t.status !== "VACATED" && t.status !== "Checked Out");

    const totalExpected = activeTenants.reduce((sum, t) => sum + (Number(t.rent) || 0), 0);
    const paidTenants = activeTenants.filter(t => {
        const r = t.rentRecords?.find((r: any) => r.month === currentMonth);
        return r?.paid;
    });
    const unpaidTenants = activeTenants.filter(t => {
        const r = t.rentRecords?.find((r: any) => r.month === currentMonth);
        return !r?.paid;
    });
    const totalReceived = paidTenants.reduce((sum, t) => sum + (Number(t.rent) || 0), 0);
    const totalPending = unpaidTenants.reduce((sum, t) => sum + (Number(t.rent) || 0), 0);

    const handleMarkPaid = async (recordId: string, tenantId: string) => {
        const note = payNotes[tenantId]?.trim();
        if (!note) { toast.error("A note is mandatory before marking as Paid."); return; }
        try {
            await markRentAsPaid(recordId, note);
            setPayNotes(p => ({ ...p, [tenantId]: "" }));
            setShowNote(p => ({ ...p, [tenantId]: false }));
            toast.success("Rent marked as paid");
            await fetchData();
        } catch { toast.error("Failed to mark as paid."); }
    };

    const handleMarkUnpaid = (recordId: string, tenantId: string) => {
        const note = payNotes[tenantId]?.trim();
        if (!note) { toast.error("A note is mandatory before reversing payment."); return; }
        toast("Reverse this payment to UNPAID?", {
            action: {
                label: "Confirm",
                onClick: async () => {
                    try {
                        await markRentAsUnpaid(recordId, note);
                        setPayNotes(p => ({ ...p, [tenantId]: "" }));
                        setShowNote(p => ({ ...p, [tenantId]: false }));
                        toast.success("Payment reversed to unpaid.");
                        await fetchData();
                    } catch { toast.error("Failed to reverse payment."); }
                }
            }
        });
    };

    const filtered = activeTenants.filter(t => {
        const r = t.rentRecords?.find((r: any) => r.month === currentMonth);
        const isPaid = r?.paid ?? false;
        if (filterStatus === "PAID") return isPaid;
        if (filterStatus === "UNPAID") return !isPaid;
        return true;
    });

    if (loading && tenants.length === 0) return (
        <div className="p-8 flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground font-medium text-xs tracking-widest uppercase text-center">Loading Payments...</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Payments</h1>
                    <p className="text-muted-foreground">Track monthly rent collection for {currentMonth}.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="rounded-xl">
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
                    <div key={stat.label} className={`p-4 rounded-xl border-2 ${stat.color} shadow-sm transition-all hover:scale-[1.02]`}>
                        <div className="text-2xl mb-1">{stat.icon}</div>
                        <div className="text-2xl font-bold">{stat.value}</div>
                        <div className="text-sm font-medium opacity-80">{stat.label}</div>
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
                        className={`rounded-xl px-4 ${filterStatus === status ? (status === "PAID" ? "bg-green-600 hover:bg-green-700" : status === "UNPAID" ? "bg-red-600 hover:bg-red-700" : "") : ""}`}
                        onClick={() => setFilterStatus(status)}
                    >
                        {status === "ALL" ? `All (${activeTenants.length})` : status === "PAID" ? `✅ Paid (${paidTenants.length})` : `❌ Unpaid (${unpaidTenants.length})`}
                    </Button>
                ))}
            </div>

            {/* ── Mobile Cards ── */}
            <div className="md:hidden space-y-3">
                {filtered.length === 0 ? (
                    <p className="text-center text-muted-foreground py-12">No payment records found.</p>
                ) : filtered.map(t => {
                    const record = t.rentRecords?.find((r: any) => r.month === currentMonth);
                    const isPaid = record?.paid ?? false;
                    return (
                        <div key={t.id} className={`bg-white border rounded-2xl p-4 shadow-sm space-y-3 ${
                            isPaid ? "border-l-4 border-l-green-400" : "border-l-4 border-l-red-400"}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-black text-sm">{t.name}</p>
                                    <p className="text-[10px] text-primary font-bold">{t.property?.name}</p>
                                    <p className="text-[10px] font-mono text-slate-400">{t.displayId}</p>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-[10px] font-black ${
                                    isPaid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                    {isPaid ? "✅ Paid" : "❌ Unpaid"}
                                </span>
                            </div>
                            <div className="text-xs text-slate-600 space-y-1">
                                <p>🛏 {t.roomNumber} · {t.roomType}</p>
                                <p>💰 ₹{Number(t.rent).toLocaleString()} / month</p>
                                {record?.paidOn && <p>📅 Paid on: {record.paidOn}</p>}
                            </div>
                            {!showNote[t.id] ? (
                                <Button size="sm" variant="outline" className="w-full text-xs"
                                    onClick={() => setShowNote(p => ({ ...p, [t.id]: true }))}>
                                    {isPaid ? "↩ Reverse Payment" : "✓ Mark as Paid"}
                                </Button>
                            ) : (
                                <div className="space-y-2">
                                    <input className="w-full border rounded-lg p-2 text-xs" placeholder="Note (mandatory)..."
                                        value={payNotes[t.id] || ""}
                                        onChange={e => setPayNotes(p => ({ ...p, [t.id]: e.target.value }))} />
                                    <div className="flex gap-2">
                                        {!isPaid && record && (
                                            <Button size="sm" className="bg-green-600 flex-1 text-xs" onClick={() => handleMarkPaid(record.id, t.id)}>Confirm Paid</Button>
                                        )}
                                        {isPaid && record && (
                                            <Button size="sm" variant="outline" className="border-red-300 text-red-600 flex-1 text-xs" onClick={() => handleMarkUnpaid(record.id, t.id)}>Confirm Reverse</Button>
                                        )}
                                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowNote(p => ({ ...p, [t.id]: false }))}>✕</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Desktop Table ── */}
            <div className="hidden md:block">
                <Card className="rounded-[24px] border-2 border-slate-100 shadow-sm overflow-hidden bg-white">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b-2 border-slate-100">
                                    <tr>
                                        <th className="p-4 text-left font-bold text-slate-600 uppercase text-[10px] tracking-wider">Tenant</th>
                                        <th className="p-4 text-left font-bold text-slate-600 uppercase text-[10px] tracking-wider">Room</th>
                                        <th className="p-4 text-left font-bold text-slate-600 uppercase text-[10px] tracking-wider">Rent</th>
                                        <th className="p-4 text-left font-bold text-slate-600 uppercase text-[10px] tracking-wider">{currentMonth} Status</th>
                                        <th className="p-4 text-left font-bold text-slate-600 uppercase text-[10px] tracking-wider">Paid On</th>
                                        <th className="p-4 text-left font-bold text-slate-600 uppercase text-[10px] tracking-wider">Action</th>
                                        <th className="p-4 text-left font-bold text-slate-600 uppercase text-[10px] tracking-wider">Full History</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map(t => {
                                        const record = t.rentRecords?.find((r: any) => r.month === currentMonth);
                                        const isPaid = record?.paid ?? false;
                                        const allRecords = t.rentRecords || [];
                                        const paymentNotes = (t.actionNotes || []).filter((n: any) => n.action === 'PAYMENT_MARKED_PAID' || n.action === 'PAYMENT_MARKED_UNPAID');
                                        const isHistoryOpen = expandedHistory.has(t.id);
                                        return (
                                            <tr key={t.id} className={`transition-colors hover:bg-slate-50/50 ${isPaid ? "bg-green-50/10" : "bg-red-50/10"}`}>
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-800">{t.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 group">
                                                        <span className="opacity-60 group-hover:opacity-100 transition-opacity">ID:</span> {t.displayId}
                                                    </div>
                                                    <div className="text-[10px] text-primary font-bold mt-1">{t.property?.name}</div>
                                                </td>
                                                <td className="p-4">
                                                    <span className="font-bold text-slate-700">{t.roomNumber}</span>
                                                    <div className="text-[9px] font-black uppercase text-slate-400">{t.roomType}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-black text-lg text-slate-800 flex items-center">
                                                        <IndianRupee className="h-3.5 w-3.5 mr-0.5 opacity-60" />
                                                        {Number(t.rent).toLocaleString()}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                        isPaid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                                        {isPaid ? <><CheckCircle className="h-3.5 w-3.5" /> Paid</> : <><XCircle className="h-3.5 w-3.5" /> Unpaid</>}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-xs font-medium text-slate-500">{record?.paidOn || "—"}</td>
                                                <td className="p-4">
                                                    {!showNote[t.id] ? (
                                                        <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold rounded-xl border-2"
                                                            onClick={() => setShowNote(p => ({ ...p, [t.id]: true }))}>
                                                            {isPaid ? "REVERSE PAYMENT" : "MARK AS PAID"}
                                                        </Button>
                                                    ) : (
                                                        <div className="space-y-1.5 min-w-[200px] animate-in slide-in-from-top-2 duration-200">
                                                            <Input className="h-8 text-[10px] rounded-xl border-2" placeholder="Note (mandatory)..."
                                                                value={payNotes[t.id] || ""}
                                                                onChange={e => setPayNotes(p => ({ ...p, [t.id]: e.target.value }))} />
                                                            <div className="flex gap-1.5">
                                                                {!isPaid && record && (
                                                                    <Button size="sm" className="h-7 text-[10px] font-black bg-green-600 hover:bg-green-700 rounded-lg flex-1" onClick={() => handleMarkPaid(record.id, t.id)}>CONFIRM PAID</Button>
                                                                )}
                                                                {isPaid && record && (
                                                                    <Button size="sm" variant="outline" className="h-7 text-[10px] font-black border-2 border-red-300 text-red-600 rounded-lg flex-1" onClick={() => handleMarkUnpaid(record.id, t.id)}>CONFIRM REVERSE</Button>
                                                                )}
                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" onClick={() => setShowNote(p => ({ ...p, [t.id]: false }))}>✕</Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <div className="relative">
                                                        <Button size="sm" variant="ghost"
                                                            className={`h-8 text-[10px] font-black gap-1.5 rounded-xl border-2 transition-all shadow-sm ${
                                                                isHistoryOpen ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "border-transparent bg-slate-50 hover:bg-slate-100"}`}
                                                            onClick={() => toggleHistory(t.id)}>
                                                            <History className="h-3 w-3" />
                                                            {isHistoryOpen ? "CLOSE" : `${allRecords.length} MONTHS`}
                                                            {isHistoryOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                        </Button>
                                                        {isHistoryOpen && (
                                                            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border-2 border-slate-100 shadow-2xl z-20 p-3 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                                                <div>
                                                                    <div className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest px-1">📅 Rent History</div>
                                                                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                                                                        {allRecords.length > 0 ? allRecords.map((r: any) => (
                                                                            <div key={r.id} className={`text-[10px] p-2 rounded-xl border-2 ${
                                                                                r.paid ? "bg-green-50/50 border-green-100 text-green-700" : "bg-red-50/50 border-red-100 text-red-700"}`}>
                                                                                <div className="flex justify-between items-center">
                                                                                    <span className="font-black">{r.month}</span>
                                                                                    <span className="text-[8px] font-black uppercase">{r.paid ? "PAID" : "UNPAID"}</span>
                                                                                </div>
                                                                                {r.paidOn && <div className="text-[9px] font-medium opacity-60 mt-0.5">Paid on: {r.paidOn}</div>}
                                                                            </div>
                                                                        )) : <div className="text-[10px] text-slate-400 italic text-center p-4">No records found</div>}
                                                                    </div>
                                                                </div>
                                                                {paymentNotes.length > 0 && (
                                                                    <div className="pt-2 border-t border-slate-100">
                                                                        <div className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest px-1">📝 Audit Logs</div>
                                                                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 no-scrollbar">
                                                                            {paymentNotes.map((note: any, i: number) => (
                                                                                <div key={i} className={`text-[9px] p-2 rounded-xl border-2 ${
                                                                                    note.action === 'PAYMENT_MARKED_PAID' ? "bg-blue-50/50 border-blue-100 text-blue-700" : "bg-orange-50/50 border-orange-100 text-orange-700"}`}>
                                                                                    <div className="font-black flex justify-between">
                                                                                        <span>{note.action === 'PAYMENT_MARKED_PAID' ? "💰 MARKED PAID" : "↩ REVERSED"}</span>
                                                                                        <span className="text-[8px] opacity-60">{new Date(note.timestamp).toLocaleDateString()}</span>
                                                                                    </div>
                                                                                    <div className="mt-1 font-medium">{note.reason}</div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filtered.length === 0 && (
                                        <tr><td colSpan={7} className="p-12 text-center text-slate-400 italic font-medium">No payment records found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
