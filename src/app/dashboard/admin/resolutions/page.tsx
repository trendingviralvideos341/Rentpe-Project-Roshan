"use client";

import { useState, useEffect, useCallback } from "react";
import { getDisputesForAdmin, getRefundRequests, approveRefund, rejectRefund } from "@/actions/adminPhase2";
import { resolveDispute, reviewDispute } from "@/actions/disputes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { MessageSquareWarning, RefreshCcw, CheckCircle, XCircle, ArrowRight, CreditCard, IndianRupee } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

// ── DISPUTES TAB ──────────────────────────────────────────────

const STATUS_TABS_DISPUTE = [
    { key: "ALL", label: "All" }, { key: "OPEN", label: "🔴 Open" },
    { key: "UNDER_REVIEW", label: "🟡 Under Review" }, { key: "RESOLVED", label: "✅ Resolved" }, { key: "CLOSED", label: "⚫ Closed" },
];
const PRIORITY_COLORS: Record<string, string> = { URGENT: "bg-red-100 text-red-800", HIGH: "bg-orange-100 text-orange-800", MEDIUM: "bg-amber-100 text-amber-800", LOW: "bg-slate-100 text-slate-600" };
const STATUS_COLORS_D: Record<string, string> = { OPEN: "bg-red-100 text-red-800", UNDER_REVIEW: "bg-amber-100 text-amber-800", RESOLVED: "bg-green-100 text-green-800", CLOSED: "bg-slate-100 text-slate-600" };

function DisputesTab() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("ALL");
    const [resolveModal, setResolveModal] = useState<any>(null);
    const [resolution, setResolution] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try { const result = await getDisputesForAdmin(filter === "ALL" ? undefined : filter); setData(result); }
        catch { toast.error("Failed to load disputes"); }
        finally { setLoading(false); }
    }, [filter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleResolve = async () => {
        if (!resolveModal || !resolution.trim()) { toast.error("Resolution text required"); return; }
        setActionLoading(true);
        try { await resolveDispute(resolveModal.id, resolution); toast.success("Dispute resolved!"); setResolveModal(null); setResolution(""); fetchData(); }
        catch { toast.error("Failed to resolve"); }
        finally { setActionLoading(false); }
    };

    const handleReview = async (id: string) => {
        try { await reviewDispute(id); toast.success("Marked as Under Review"); fetchData(); }
        catch { toast.error("Failed"); }
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "🔴 Open", value: data?.stats.open ?? "—", color: "text-red-600", bg: "bg-red-50 border-red-200" },
                    { label: "🟡 Under Review", value: data?.stats.underReview ?? "—", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
                    { label: "✅ Resolved", value: data?.stats.resolved ?? "—", color: "text-green-600", bg: "bg-green-50 border-green-200" },
                    { label: "⚡ Urgent", value: data?.stats.urgent ?? "—", color: "text-red-700", bg: "bg-red-100 border-red-300" },
                ].map(card => <Card key={card.label} className={`border ${card.bg}`}><CardContent className="p-4"><p className={`text-2xl font-black ${card.color}`}>{card.value}</p><p className="text-xs text-muted-foreground font-semibold mt-1">{card.label}</p></CardContent></Card>)}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {STATUS_TABS_DISPUTE.map(tab => (
                    <button key={tab.key} onClick={() => setFilter(tab.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${filter === tab.key ? "bg-red-600 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:border-red-300"}`}>
                        {tab.label}
                    </button>
                ))}
            </div>
            {loading ? (
                <div className="grid gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}</div>
            ) : data?.disputes.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed rounded-xl"><CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" /><p className="font-bold text-slate-700">No disputes in this category.</p></div>
            ) : (
                <>
                    <div className="md:hidden space-y-3">
                        {data?.disputes.map((d: any) => (
                            <Card key={d.id} className={`border-l-4 ${d.priority === 'URGENT' ? 'border-l-red-500' : 'border-l-amber-400'}`}>
                                <CardContent className="p-4 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <p className="font-bold text-sm text-slate-900 truncate">{d.subject}</p>
                                        <Badge className={`text-xs shrink-0 ml-2 border-0 ${STATUS_COLORS_D[d.status] || ""}`}>{d.status}</Badge>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold border-0 ${PRIORITY_COLORS[d.priority] || ""}`}>{d.priority}</span>
                                        <span className="text-xs text-slate-500">· {d.type} · {d.raisedByUser?.name || 'Unknown'}</span>
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                        <Link href={`/dashboard/admin/disputes/${d.id}`} className="flex-1"><Button size="sm" variant="outline" className="w-full text-xs">View <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button></Link>
                                        {d.status === 'OPEN' && <Button size="sm" variant="outline" className="text-xs text-amber-600 border-amber-200" onClick={() => handleReview(d.id)}>Review</Button>}
                                        {d.status !== 'RESOLVED' && d.status !== 'CLOSED' && <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs" onClick={() => setResolveModal(d)}>Resolve</Button>}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <div className="hidden md:block bg-white rounded-2xl border shadow-sm overflow-hidden">
                        <table className="w-full text-sm"><thead className="bg-slate-50 border-b"><tr>{["ID", "Subject", "Type", "Raised By", "Priority", "Status", "Actions"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-black uppercase text-slate-500">{h}</th>)}</tr></thead>
                            <tbody className="divide-y">
                                {data?.disputes.map((d: any) => (
                                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{d.displayId}</td>
                                        <td className="px-4 py-3"><p className="font-medium max-w-[200px] truncate">{d.subject}</p><p className="text-xs text-muted-foreground">{d.messageCount} messages</p></td>
                                        <td className="px-4 py-3"><span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">{d.type}</span></td>
                                        <td className="px-4 py-3 text-sm">{d.raisedByUser?.name || "—"}</td>
                                        <td className="px-4 py-3"><Badge className={`border-0 ${PRIORITY_COLORS[d.priority] || ""}`}>{d.priority}</Badge></td>
                                        <td className="px-4 py-3"><Badge className={`border-0 ${STATUS_COLORS_D[d.status] || ""}`}>{d.status}</Badge></td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2">
                                                <Link href={`/dashboard/admin/disputes/${d.id}`}><Button size="sm" variant="outline" className="text-xs">View</Button></Link>
                                                {d.status === 'OPEN' && <Button size="sm" variant="outline" className="text-xs text-amber-600" onClick={() => handleReview(d.id)}>Review</Button>}
                                                {d.status !== 'RESOLVED' && d.status !== 'CLOSED' && <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs" onClick={() => setResolveModal(d)}>Resolve</Button>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {resolveModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-6">
                    <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 space-y-4">
                        <h3 className="font-black text-lg flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" />Resolve Dispute</h3>
                        <p className="text-sm text-slate-600">"{resolveModal.subject}"</p>
                        <textarea className="w-full border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-300" rows={4} placeholder="Describe the resolution..." value={resolution} onChange={e => setResolution(e.target.value)} />
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => { setResolveModal(null); setResolution(""); }}>Cancel</Button>
                            <Button className="flex-1 bg-green-600 hover:bg-green-700" disabled={!resolution.trim() || actionLoading} onClick={handleResolve}>{actionLoading ? "Resolving..." : "Mark Resolved & Notify"}</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── REFUNDS TAB ───────────────────────────────────────────────

const STATUS_TABS_REFUND = [
    { key: "ALL", label: "All" }, { key: "PENDING", label: "⏳ Pending" },
    { key: "PROCESSED", label: "✅ Processed" }, { key: "REJECTED", label: "❌ Rejected" },
];
const STATUS_COLORS_R: Record<string, string> = { PENDING: "bg-amber-100 text-amber-800", PROCESSED: "bg-green-100 text-green-800", REJECTED: "bg-red-100 text-red-800" };

function RefundsTab() {
    const [data, setData] = useState<any>(null);
    const [filter, setFilter] = useState("ALL");
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<{ type: "approve" | "reject"; refund: any } | null>(null);
    const [note, setNote] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try { const result = await getRefundRequests(filter === "ALL" ? undefined : filter); setData(result); }
        catch { toast.error("Failed to load refunds"); }
        finally { setLoading(false); }
    }, [filter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleAction = async () => {
        if (!modal) return;
        if (modal.type === "reject" && !note.trim()) { toast.error("Reason required"); return; }
        setActionLoading(true);
        try {
            if (modal.type === "approve") { await approveRefund(modal.refund.id, note); toast.success("Refund approved!"); }
            else { await rejectRefund(modal.refund.id, note); toast.success("Refund rejected. User notified."); }
            setModal(null); setNote(""); fetchData();
        } catch { toast.error("Action failed"); }
        finally { setActionLoading(false); }
    };

    const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "⏳ Pending", value: data?.stats.pendingCount ?? "—", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
                    { label: "✅ Processed (₹)", value: data ? fmt(data.stats.processedAmount) : "—", color: "text-green-600", bg: "bg-green-50 border-green-200" },
                    { label: "❌ Rejected", value: data?.stats.rejectedCount ?? "—", color: "text-red-600", bg: "bg-red-50 border-red-200" },
                    { label: "💰 Total Refunded", value: data ? fmt(data.stats.totalAmount) : "—", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
                ].map(card => <Card key={card.label} className={`border ${card.bg}`}><CardContent className="p-4"><p className={`text-xl md:text-2xl font-black ${card.color} truncate`}>{card.value}</p><p className="text-xs text-muted-foreground font-semibold mt-1">{card.label}</p></CardContent></Card>)}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {STATUS_TABS_REFUND.map(tab => (
                    <button key={tab.key} onClick={() => setFilter(tab.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${filter === tab.key ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"}`}>
                        {tab.label}
                    </button>
                ))}
            </div>
            {loading ? (
                <div className="grid gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}</div>
            ) : data?.refunds.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed rounded-xl"><CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" /><p className="font-bold text-slate-700">No refund requests in this category.</p></div>
            ) : (
                <>
                    <div className="md:hidden space-y-3">
                        {data?.refunds.map((r: any) => (
                            <Card key={r.id} className={`border-l-4 ${r.status === 'PENDING' ? 'border-l-amber-400' : r.status === 'PROCESSED' ? 'border-l-green-400' : 'border-l-red-400'}`}>
                                <CardContent className="p-4 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div><p className="font-mono text-xs text-slate-400">{r.id?.slice(-8).toUpperCase()}</p><p className="font-bold text-lg text-slate-900">{fmt(r.amount)}</p></div>
                                        <Badge className={`border-0 text-xs ${STATUS_COLORS_R[r.status] || ""}`}>{r.status}</Badge>
                                    </div>
                                    <div className="text-xs text-slate-600 space-y-1">
                                        <p><strong>User:</strong> {r.booking?.user?.name || "—"}</p>
                                        <p className="truncate"><strong>Reason:</strong> {r.reason}</p>
                                    </div>
                                    {r.status === 'PENDING' && (
                                        <div className="flex gap-2 pt-1">
                                            <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-xs" onClick={() => setModal({ type: "approve", refund: r })}><CheckCircle className="h-3.5 w-3.5 mr-1" />Approve</Button>
                                            <Button size="sm" variant="destructive" className="flex-1 text-xs" onClick={() => setModal({ type: "reject", refund: r })}><XCircle className="h-3.5 w-3.5 mr-1" />Reject</Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <div className="hidden md:block bg-white rounded-2xl border shadow-sm overflow-hidden">
                        <table className="w-full text-sm"><thead className="bg-slate-50 border-b"><tr>{["Ref ID", "User", "Amount", "Reason", "Status", "Requested On", "Actions"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-black uppercase text-slate-500">{h}</th>)}</tr></thead>
                            <tbody className="divide-y">
                                {data?.refunds.map((r: any) => (
                                    <tr key={r.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.id?.slice(-8).toUpperCase()}</td>
                                        <td className="px-4 py-3"><p className="font-medium">{r.booking?.user?.name || "—"}</p><p className="text-xs text-muted-foreground">{r.booking?.user?.email}</p></td>
                                        <td className="px-4 py-3 font-bold text-slate-900">{fmt(r.amount)}</td>
                                        <td className="px-4 py-3 max-w-[200px]"><p className="truncate text-xs text-slate-600">{r.reason}</p></td>
                                        <td className="px-4 py-3"><Badge className={`border-0 ${STATUS_COLORS_R[r.status] || ""}`}>{r.status}</Badge></td>
                                        <td className="px-4 py-3 text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                                        <td className="px-4 py-3">
                                            {r.status === 'PENDING' && <div className="flex gap-2">
                                                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs" onClick={() => setModal({ type: "approve", refund: r })}>Approve</Button>
                                                <Button size="sm" variant="destructive" className="text-xs" onClick={() => setModal({ type: "reject", refund: r })}>Reject</Button>
                                            </div>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {modal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-6">
                    <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 space-y-4">
                        <h3 className="font-black text-lg flex items-center gap-2">
                            {modal.type === "approve" ? <><CheckCircle className="h-5 w-5 text-green-500" />Approve Refund</> : <><XCircle className="h-5 w-5 text-red-500" />Reject Refund</>}
                        </h3>
                        <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
                            <p><strong>Amount:</strong> {fmt(modal.refund.amount)}</p>
                            <p><strong>User:</strong> {modal.refund.booking?.user?.name || "—"}</p>
                            <p className="text-muted-foreground text-xs">{modal.refund.reason}</p>
                        </div>
                        <textarea className="w-full border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" rows={3}
                            placeholder={modal.type === "approve" ? "Optional admin note..." : "Reason for rejection (required)..."}
                            value={note} onChange={e => setNote(e.target.value)} />
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => { setModal(null); setNote(""); }}>Cancel</Button>
                            <Button className={`flex-1 ${modal.type === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                                disabled={actionLoading || (modal.type === "reject" && !note.trim())} onClick={handleAction}>
                                {actionLoading ? "Processing..." : modal.type === "approve" ? "Approve & Notify" : "Reject & Notify"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── MAIN PAGE ─────────────────────────────────────────────────

export default function AdminResolutionsPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialTab = searchParams.get("tab") === "refunds" ? "refunds" : "disputes";
    const [activeTab, setActiveTab] = useState(initialTab);

    const switchTab = (tab: string) => {
        setActiveTab(tab);
        router.replace(`/dashboard/admin/resolutions?tab=${tab}`, { scroll: false });
    };

    return (
        <div className="space-y-4 md:space-y-6 pb-20 md:pb-8">
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
                    <MessageSquareWarning className="h-7 w-7 text-red-600" /> Resolution Centre
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Disputes & Refund management in one place</p>
            </div>

            <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
                {[
                    { id: "disputes", label: "⚠️ Disputes" },
                    { id: "refunds", label: "💳 Refunds" },
                ].map(t => (
                    <button key={t.id} onClick={() => switchTab(t.id)}
                        className={`px-5 py-2 rounded-lg text-xs font-black transition-all uppercase tracking-wider ${activeTab === t.id ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-700"}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === "disputes" ? <DisputesTab /> : <RefundsTab />}
        </div>
    );
}
