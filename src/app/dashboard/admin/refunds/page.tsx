"use client";

import { useState, useEffect, useCallback } from "react";
import { getRefundRequests, approveRefund, rejectRefund } from "@/actions/adminPhase2";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    CreditCard, CheckCircle, XCircle, RefreshCcw, Search,
    IndianRupee, Filter, Calendar, ChevronDown
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800 border-amber-200",
    PROCESSED: "bg-green-100 text-green-800 border-green-200",
    REJECTED: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_TABS = [
    { key: "ALL", label: "All Refunds" },
    { key: "PENDING", label: "⏳ Pending" },
    { key: "PROCESSED", label: "✅ Processed" },
    { key: "REJECTED", label: "❌ Rejected" },
];

export default function AdminRefundsPage() {
    const [data, setData] = useState<any>(null);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const [dateFilter, setDateFilter] = useState<"ALL" | "7D" | "30D" | "90D">("ALL");
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<{ type: "approve" | "reject"; refund: any } | null>(null);
    const [note, setNote] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [sortBy, setSortBy] = useState<"newest" | "oldest" | "amount_high" | "amount_low">("newest");

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getRefundRequests(statusFilter === "ALL" ? undefined : statusFilter);
            setData(result);
        } catch {
            toast.error("Failed to load refunds");
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleAction = async () => {
        if (!modal) return;
        if (modal.type === "reject" && !note.trim()) { toast.error("Reason required"); return; }
        setActionLoading(true);
        try {
            if (modal.type === "approve") {
                await approveRefund(modal.refund.id, note);
                toast.success("✅ Refund approved & user notified");
            } else {
                await rejectRefund(modal.refund.id, note);
                toast.success("❌ Refund rejected & user notified");
            }
            setModal(null); setNote(""); fetchData();
        } catch { toast.error("Action failed"); }
        finally { setActionLoading(false); }
    };

    const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

    // Client-side filter + sort
    const filteredRefunds = (data?.refunds ?? [])
        .filter((r: any) => {
            // Date filter
            if (dateFilter !== "ALL") {
                const days = dateFilter === "7D" ? 7 : dateFilter === "30D" ? 30 : 90;
                const diff = (Date.now() - new Date(r.createdAt).getTime()) / 86400000;
                if (diff > days) return false;
            }
            // Search
            if (search) {
                const q = search.toLowerCase();
                return (
                    r.booking?.user?.name?.toLowerCase().includes(q) ||
                    r.booking?.user?.email?.toLowerCase().includes(q) ||
                    r.reason?.toLowerCase().includes(q) ||
                    r.id?.toLowerCase().includes(q) ||
                    r.displayId?.toLowerCase().includes(q) ||
                    r.ticketId?.toLowerCase().includes(q)
                );
            }
            return true;
        })
        .sort((a: any, b: any) => {
            if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            if (sortBy === "amount_high") return b.amount - a.amount;
            if (sortBy === "amount_low") return a.amount - b.amount;
            return 0;
        });

    const pendingTotal = (data?.refunds ?? [])
        .filter((r: any) => r.status === "PENDING")
        .reduce((sum: number, r: any) => sum + r.amount, 0);

    return (
        <div className="space-y-4 md:space-y-6 pb-20 md:pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
                        <CreditCard className="h-7 w-7 text-indigo-600" /> Refund Management
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Review, approve or reject all refund requests</p>
                </div>
                <Button variant="outline" onClick={fetchData} disabled={loading} className="w-fit">
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "⏳ Pending", value: data?.stats.pendingCount ?? "—", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
                    { label: "💰 Pending Amount", value: data ? fmt(pendingTotal) : "—", color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
                    { label: "✅ Processed", value: data ? fmt(data.stats.processedAmount) : "—", color: "text-green-600", bg: "bg-green-50 border-green-200" },
                    { label: "❌ Rejected", value: data?.stats.rejectedCount ?? "—", color: "text-red-600", bg: "bg-red-50 border-red-200" },
                ].map(card => (
                    <Card key={card.label} className={`border ${card.bg}`}>
                        <CardContent className="p-4">
                            <p className={`text-xl md:text-2xl font-black ${card.color} truncate`}>{card.value}</p>
                            <p className="text-xs text-muted-foreground font-semibold mt-1">{card.label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters Bar */}
            <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-3">
                {/* Status Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {STATUS_TABS.map(tab => (
                        <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${statusFilter === tab.key ? "bg-indigo-600 text-white shadow-md" : "bg-slate-100 border border-slate-200 text-slate-600 hover:border-indigo-300"}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input placeholder="Search by name, email, reason, ID..." className="pl-10 rounded-xl" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>

                    {/* Date Filter */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
                        {(["ALL", "7D", "30D", "90D"] as const).map(val => (
                            <button key={val} onClick={() => setDateFilter(val)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase ${dateFilter === val ? "bg-indigo-600 text-white shadow-md" : "text-slate-500"}`}>
                                {val === "ALL" ? "All Time" : val === "7D" ? "7 Days" : val === "30D" ? "30 Days" : "90 Days"}
                            </button>
                        ))}
                    </div>

                    {/* Sort */}
                    <div className="relative">
                        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                            className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="amount_high">Amount: High → Low</option>
                            <option value="amount_low">Amount: Low → High</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                <p className="text-xs text-slate-400 font-medium">
                    Showing {filteredRefunds.length} of {data?.refunds?.length ?? 0} refunds
                    {search && ` matching "${search}"`}
                </p>
            </div>

            {/* Table / Cards */}
            {loading ? (
                <div className="grid gap-3">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
                </div>
            ) : filteredRefunds.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed rounded-xl">
                    <CreditCard className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="font-bold text-slate-500">No refunds match your filters.</p>
                </div>
            ) : (
                <>
                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                        {filteredRefunds.map((r: any) => (
                            <Card key={r.id} className={`border-l-4 ${r.status === 'PENDING' ? 'border-l-amber-400' : r.status === 'PROCESSED' ? 'border-l-green-400' : 'border-l-red-400'}`}>
                                <CardContent className="p-4 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            {/* Display RP-RFND-26-27-XXXXXX ID */}
                                            <p className="font-mono text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded inline-block">{r.displayId || r.id?.slice(-10).toUpperCase()}</p>
                                            {r.ticketId && (
                                                <p className="font-mono text-[10px] text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded inline-block ml-1">
                                                    🎫 Ticket Linked
                                                </p>
                                            )}
                                            <p className="font-black text-xl text-slate-900 mt-1">{fmt(r.amount)}</p>
                                        </div>
                                        <Badge className={`border-0 text-xs ${STATUS_COLORS[r.status] || ""}`}>{r.status}</Badge>
                                    </div>
                                    <div className="text-xs text-slate-600 space-y-1">
                                        <p><strong>User:</strong> {r.booking?.user?.name || "—"}</p>
                                        <p className="text-muted-foreground truncate"><strong>Reason:</strong> {r.reason}</p>
                                        <p className="text-muted-foreground">{new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                    </div>
                                    {r.status === 'PENDING' && (
                                        <div className="flex gap-2 pt-1">
                                            <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-xs" onClick={() => setModal({ type: "approve", refund: r })}>
                                                <CheckCircle className="h-3.5 w-3.5 mr-1" />Approve
                                            </Button>
                                            <Button size="sm" variant="destructive" className="flex-1 text-xs" onClick={() => setModal({ type: "reject", refund: r })}>
                                                <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                                            </Button>
                                        </div>
                                    )}
                                    {r.status !== 'PENDING' && r.notes && (
                                        <p className="text-xs text-slate-500 italic">Note: {r.notes}</p>
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
                                {filteredRefunds.map((r: any) => (
                                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded inline-block">
                                                {r.displayId || r.id?.slice(-10).toUpperCase()}
                                            </p>
                                            {r.ticketId && (
                                                <p className="font-mono text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                                                    🎫 TKT Linked
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-slate-900">{r.booking?.user?.name || "—"}</p>
                                            <p className="text-xs text-muted-foreground">{r.booking?.user?.email}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-black text-lg text-slate-900">{fmt(r.amount)}</span>
                                        </td>
                                        <td className="px-4 py-3 max-w-[220px]">
                                            <p className="text-xs text-slate-600 line-clamp-2">{r.reason}</p>
                                            {r.notes && <p className="text-[10px] text-slate-400 mt-1 italic">Admin: {r.notes}</p>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge className={`border-0 ${STATUS_COLORS[r.status] || ""}`}>{r.status}</Badge>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500">
                                            {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-4 py-3">
                                            {r.status === 'PENDING' && (
                                                <div className="flex gap-2">
                                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs" onClick={() => setModal({ type: "approve", refund: r })}>
                                                        ✅ Approve
                                                    </Button>
                                                    <Button size="sm" variant="destructive" className="text-xs" onClick={() => setModal({ type: "reject", refund: r })}>
                                                        ❌ Reject
                                                    </Button>
                                                </div>
                                            )}
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
                    <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 space-y-4 shadow-2xl">
                        <h3 className="font-black text-lg flex items-center gap-2">
                            {modal.type === "approve"
                                ? <><CheckCircle className="h-5 w-5 text-green-500" />Approve Refund</>
                                : <><XCircle className="h-5 w-5 text-red-500" />Reject Refund</>
                            }
                        </h3>
                        <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-2 border">
                            <p className="font-black text-xl text-slate-900">{fmt(modal.refund.amount)}</p>
                            <p className="text-slate-600"><strong>User:</strong> {modal.refund.booking?.user?.name || "—"}</p>
                            {modal.refund.displayId && (
                                <p className="font-mono text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded inline-block font-bold">{modal.refund.displayId}</p>
                            )}
                            {modal.refund.ticketId && (
                                <p className="text-xs text-orange-700 font-bold bg-orange-50 px-2 py-0.5 rounded inline-block ml-1">🎫 Support Ticket Linked</p>
                            )}
                            <p className="text-muted-foreground text-xs mt-1">{modal.refund.reason}</p>

                            {/* Financial Breakdown */}
                            {modal.type === "approve" && (
                                <div className="mt-3 pt-3 border-t space-y-1.5">
                                    <p className="text-[10px] font-black text-slate-500 uppercase">Refund Breakdown</p>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-600">Base Refund (Rent/Deposit)</span>
                                        <span className="font-bold text-slate-900">{fmt(modal.refund.amount)}</span>
                                    </div>
                                    {modal.refund.refundPlatformFee && (
                                        <>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-blue-600">+ Platform Convenience Fee</span>
                                                <span className="font-bold text-blue-700">{fmt(modal.refund.platformFeeRefunded)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-blue-500">+ GST Reversed (CGST+SGST)</span>
                                                <span className="font-bold text-blue-700">{fmt(modal.refund.gstRefunded)}</span>
                                            </div>
                                            <div className="text-[10px] text-blue-500 italic">→ GST Credit Note will be issued: CN/26-27/XXXX</div>
                                        </>
                                    )}
                                    {modal.refund.ownerPenaltyApplied > 0 && (
                                        <div className="flex justify-between text-xs pt-1 border-t mt-1">
                                            <span className="text-orange-600">⚡ 2% MDR Penalty (deducted from Owner)</span>
                                            <span className="font-bold text-orange-700">-{fmt(modal.refund.ownerPenaltyApplied)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-xs font-black pt-1 border-t">
                                        <span>Total Student Refund</span>
                                        <span className="text-green-700">{fmt(
                                            Number(modal.refund.amount) +
                                            (modal.refund.refundPlatformFee ? Number(modal.refund.platformFeeRefunded || 0) + Number(modal.refund.gstRefunded || 0) : 0)
                                        )}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-black text-slate-500 uppercase mb-1 block">
                                {modal.type === "approve" ? "Admin Note (optional)" : "Rejection Reason (required)"}
                            </label>
                            <textarea
                                className="w-full border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                rows={3}
                                placeholder={modal.type === "approve" ? "e.g. Processed via Razorpay..." : "e.g. Booking was completed successfully..."}
                                value={note}
                                onChange={e => setNote(e.target.value)}
                            />
                        </div>
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
