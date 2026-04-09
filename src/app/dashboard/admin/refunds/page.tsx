"use client";

import { useState, useEffect, useCallback } from "react";
import { getRefundRequests, approveRefund, rejectRefund } from "@/actions/adminPhase2";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { CreditCard, RefreshCcw, CheckCircle, XCircle, Clock, IndianRupee } from "lucide-react";

const STATUS_TABS = [
    { key: "ALL", label: "All" },
    { key: "PENDING", label: "⏳ Pending" },
    { key: "PROCESSED", label: "✅ Processed" },
    { key: "REJECTED", label: "❌ Rejected" },
];

const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    PROCESSED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
};

export default function RefundsPage() {
    const [data, setData] = useState<any>(null);
    const [filter, setFilter] = useState("ALL");
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<{ type: "approve" | "reject"; refund: any } | null>(null);
    const [note, setNote] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getRefundRequests(filter === "ALL" ? undefined : filter);
            setData(result);
        } catch { toast.error("Failed to load refunds"); }
        finally { setLoading(false); }
    }, [filter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleAction = async () => {
        if (!modal) return;
        if (modal.type === "reject" && !note.trim()) { toast.error("Reason required"); return; }
        setActionLoading(true);
        try {
            if (modal.type === "approve") {
                await approveRefund(modal.refund.id, note);
                toast.success("Refund approved!");
            } else {
                await rejectRefund(modal.refund.id, note);
                toast.success("Refund rejected. User notified.");
            }
            setModal(null);
            setNote("");
            fetchData();
        } catch { toast.error("Action failed"); }
        finally { setActionLoading(false); }
    };

    const formatAmount = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

    return (
        <div className="space-y-4 md:space-y-6 pb-20 md:pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
                        <CreditCard className="h-7 w-7 text-indigo-600" /> Refund Management
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Review and process refund requests</p>
                </div>
                <Button variant="outline" onClick={fetchData} disabled={loading} className="w-full sm:w-auto">
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {[
                    { label: "⏳ Pending", value: data?.stats.pendingCount ?? "—", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
                    { label: "✅ Processed (₹)", value: data ? formatAmount(data.stats.processedAmount) : "—", color: "text-green-600", bg: "bg-green-50 border-green-200" },
                    { label: "❌ Rejected", value: data?.stats.rejectedCount ?? "—", color: "text-red-600", bg: "bg-red-50 border-red-200" },
                    { label: "💰 Total Refunded", value: data ? formatAmount(data.stats.totalAmount) : "—", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
                ].map(card => (
                    <Card key={card.label} className={`border ${card.bg}`}>
                        <CardContent className="p-4">
                            <p className={`text-xl md:text-2xl font-black ${card.color} truncate`}>{card.value}</p>
                            <p className="text-xs text-muted-foreground font-semibold mt-1">{card.label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {STATUS_TABS.map(tab => (
                    <button key={tab.key} onClick={() => setFilter(tab.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${filter === tab.key ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div className="grid gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}</div>
            ) : data?.refunds.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed rounded-xl">
                    <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
                    <p className="font-bold text-slate-700">No refund requests in this category.</p>
                </div>
            ) : (
                <>
                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                        {data?.refunds.map((r: any) => (
                            <Card key={r.id} className={`border-l-4 ${r.status === 'PENDING' ? 'border-l-amber-400' : r.status === 'PROCESSED' ? 'border-l-green-400' : 'border-l-red-400'}`}>
                                <CardContent className="p-4 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-mono text-xs text-slate-400">{r.id?.slice(-8).toUpperCase()}</p>
                                            <p className="font-bold text-lg text-slate-900">{formatAmount(r.amount)}</p>
                                        </div>
                                        <Badge className={`border-0 text-xs ${STATUS_COLORS[r.status] || ""}`}>{r.status}</Badge>
                                    </div>
                                    <div className="text-xs text-slate-600 space-y-1">
                                        <p><strong>User:</strong> {r.booking?.user?.name || "—"}</p>
                                        <p className="truncate"><strong>Reason:</strong> {r.reason}</p>
                                        <p><strong>Requested:</strong> {new Date(r.createdAt).toLocaleDateString('en-IN')}</p>
                                    </div>
                                    {r.status === 'PENDING' && (
                                        <div className="flex gap-2 pt-1">
                                            <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-xs" onClick={() => setModal({ type: "approve", refund: r })}>
                                                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                                            </Button>
                                            <Button size="sm" variant="destructive" className="flex-1 text-xs" onClick={() => setModal({ type: "reject", refund: r })}>
                                                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block bg-white rounded-2xl border shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    {["Ref ID", "User", "Amount", "Reason", "Status", "Requested On", "Actions"].map(h => (
                                        <th key={h} className="text-left px-4 py-3 text-xs font-black uppercase text-slate-500">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {data?.refunds.map((r: any) => (
                                    <tr key={r.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.id?.slice(-8).toUpperCase()}</td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium">{r.booking?.user?.name || "—"}</p>
                                            <p className="text-xs text-muted-foreground">{r.booking?.user?.email}</p>
                                        </td>
                                        <td className="px-4 py-3 font-bold text-slate-900">{formatAmount(r.amount)}</td>
                                        <td className="px-4 py-3 max-w-[200px]">
                                            <p className="truncate text-xs text-slate-600">{r.reason}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge className={`border-0 ${STATUS_COLORS[r.status] || ""}`}>{r.status}</Badge>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                                        <td className="px-4 py-3">
                                            {r.status === 'PENDING' && (
                                                <div className="flex gap-2">
                                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs" onClick={() => setModal({ type: "approve", refund: r })}>Approve</Button>
                                                    <Button size="sm" variant="destructive" className="text-xs" onClick={() => setModal({ type: "reject", refund: r })}>Reject</Button>
                                                </div>
                                            )}
                                            {r.notes && <p className="text-xs text-muted-foreground mt-1 max-w-[150px] truncate">{r.notes}</p>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Action Modal */}
            {modal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-6">
                    <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 space-y-4">
                        <h3 className="font-black text-lg flex items-center gap-2">
                            {modal.type === "approve" ? <><CheckCircle className="h-5 w-5 text-green-500" /> Approve Refund</> : <><XCircle className="h-5 w-5 text-red-500" /> Reject Refund</>}
                        </h3>
                        <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
                            <p><strong>Amount:</strong> {formatAmount(modal.refund.amount)}</p>
                            <p><strong>User:</strong> {modal.refund.booking?.user?.name || "—"}</p>
                            <p className="text-muted-foreground text-xs">{modal.refund.reason}</p>
                        </div>
                        <textarea
                            className="w-full border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            rows={3}
                            placeholder={modal.type === "approve" ? "Optional admin note (e.g. Processed via NEFT)..." : "Reason for rejection (required)..."}
                            value={note}
                            onChange={e => setNote(e.target.value)}
                        />
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => { setModal(null); setNote(""); }}>Cancel</Button>
                            <Button
                                className={`flex-1 ${modal.type === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                                disabled={actionLoading || (modal.type === "reject" && !note.trim())}
                                onClick={handleAction}
                            >
                                {actionLoading ? "Processing..." : modal.type === "approve" ? "Approve & Notify" : "Reject & Notify"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
