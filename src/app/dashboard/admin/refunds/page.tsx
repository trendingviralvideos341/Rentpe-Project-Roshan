"use client";

import { useState, useEffect, useCallback } from "react";
import { getRefundRequests, approveRefund, rejectRefund, applyOwnerRefundPenalty } from "@/actions/adminPhase2";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    CreditCard, CheckCircle, XCircle, RefreshCcw, Search,
    IndianRupee, Filter, Calendar, ChevronDown, AlertOctagon, ShieldAlert, Clock
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
    const [modal, setModal] = useState<{ type: "approve" | "reject" | "penalty"; refund: any } | null>(null);
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
        if ((modal.type === "reject" || modal.type === "penalty") && !note.trim()) { toast.error("Reason required"); return; }
        setActionLoading(true);
        try {
            if (modal.type === "approve") {
                await approveRefund(modal.refund.id, note);
                toast.success("✅ Refund approved & user notified");
            } else if (modal.type === "reject") {
                await rejectRefund(modal.refund.id, note);
                toast.success("❌ Refund rejected & user notified");
            } else if (modal.type === "penalty") {
                await applyOwnerRefundPenalty(modal.refund.id, note);
                toast.success("✅ Penalty applied successfully");
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
        .reduce((sum: number, r: any) => sum + Number(r.amount), 0);

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

            {/* 🚨 ALARM BELL: Overdue Deposit Refunds (Admin investigates here BEFORE applying penalty) */}
            <div className="bg-gradient-to-r from-red-600 to-rose-700 rounded-2xl p-5 shadow-xl shadow-red-500/20">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <AlertOctagon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                        <p className="text-white font-black text-base flex items-center gap-2">
                            🚨 Overdue Deposit Refunds — Admin Action Required
                        </p>
                        <p className="text-red-100 text-xs mt-1 leading-relaxed">
                            These are security deposit refunds where the owner has NOT paid the tenant after vacating.
                            <strong className="text-white"> Do NOT apply the penalty automatically.</strong> First call the owner to investigate.
                            Only click "Apply Penalty" if the owner refuses to refund after investigation.
                        </p>

                        {/* Overdue deposit rows from SecurityDeposit model */}
                        {data?.overdueDeposits?.length > 0 ? (
                            <div className="mt-4 space-y-2">
                                {data.overdueDeposits.map((od: any) => {
                                    const daysOverdue = Math.floor((Date.now() - new Date(od.refundDueBy).getTime()) / 86400000);
                                    return (
                                        <div key={od.id} className="bg-white/10 border border-white/20 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
                                            <div>
                                                <p className="text-white font-black text-sm">{od.tenantName}</p>
                                                <p className="text-red-200 text-xs">{od.propertyName} · Overdue by <strong>{daysOverdue} days</strong> · Amount: <strong>₹{Number(od.refundAmount || od.amount || 0).toLocaleString('en-IN')}</strong></p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl border border-white/30 transition-all flex items-center gap-1.5"
                                                    onClick={() => setModal({ type: 'penalty' as any, refund: od })}
                                                >
                                                    <ShieldAlert className="w-3.5 h-3.5" />
                                                    Apply Withholding Penalty
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="mt-3 text-red-200 text-xs font-bold flex items-center gap-1.5">
                                <CheckCircle className="w-4 h-4 text-emerald-300" />
                                No overdue deposit refunds at this time. Great!
                            </p>
                        )}
                    </div>
                </div>
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
                        {modal.type !== 'penalty' && (
                            <h3 className="font-black text-lg flex items-center gap-2">
                                {modal.type === "approve"
                                    ? <><CheckCircle className="h-5 w-5 text-green-500" />Approve Refund</>
                                    : <><XCircle className="h-5 w-5 text-red-500" />Reject Refund</>
                                }
                            </h3>
                        )}

                        {modal.type === 'penalty' ? (
                            <div className="space-y-4">
                                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                                    <AlertOctagon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-black text-red-800 text-sm">Withholding Penalty — Confirm Before Proceeding</p>
                                        <p className="text-xs text-red-700 mt-1">You are about to deduct <strong>₹{Number(modal.refund.refundAmount || modal.refund.amount || 0).toLocaleString('en-IN')}</strong> from <strong>{modal.refund.ownerName || 'this owner'}'s</strong> next payout to compensate the tenant. This action is logged and cannot be undone.</p>
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1">
                                    <p><strong>Tenant:</strong> {modal.refund.tenantName}</p>
                                    <p><strong>Property:</strong> {modal.refund.propertyName}</p>
                                    <p><strong>Refund Amount:</strong> ₹{Number(modal.refund.refundAmount || modal.refund.amount || 0).toLocaleString('en-IN')}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase mb-1 block">Admin Investigation Note (required)</label>
                                    <textarea
                                        className="w-full border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                                        rows={3}
                                        placeholder="e.g. Owner contacted 3 times, refused to refund. Penalty applied as per T&C Section 8.2..."
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <Button variant="outline" className="flex-1" onClick={() => { setModal(null); setNote(''); }}>Cancel</Button>
                                    <Button
                                        className="flex-1 bg-red-600 hover:bg-red-700"
                                        disabled={actionLoading || !note.trim()}
                                        onClick={handleAction}
                                    >
                                        {actionLoading ? 'Processing...' : '🛡️ Apply Penalty & Notify'}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
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
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
