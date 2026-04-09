"use client";

import { useState, useEffect, useCallback } from "react";
import { getKYCQueue, verifyDocument, rejectDocument } from "@/actions/adminPhase2";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, CheckCircle, XCircle, Eye, Clock, FileCheck, User, RefreshCcw, X, ZoomIn } from "lucide-react";

const FILTER_TABS = [
    { key: "ALL", label: "All Docs" },
    { key: "PENDING", label: "⏳ Pending" },
    { key: "VERIFIED", label: "✅ Verified" },
    { key: "AADHAAR", label: "Aadhaar" },
    { key: "PAN", label: "PAN Card" },
    { key: "PG_LICENCE", label: "PG Licence" },
    { key: "LIVE_PHOTO", label: "Live Photo" },
];

interface DocItem {
    id: string;
    propertyId: string;
    propertyName: string;
    propertyDisplayId?: string;
    city: string;
    docType: string;
    docLabel: string;
    docUrl: string;
    isVerified: boolean;
    owner: { id: string; name?: string; email?: string; phone?: string; displayId?: string };
    submittedAt: string;
}

export default function KYCQueuePage() {
    const [data, setData] = useState<{ queue: DocItem[]; stats: { pending: number; verified: number; total: number } } | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("ALL");
    const [rejectTarget, setRejectTarget] = useState<DocItem | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [viewerDoc, setViewerDoc] = useState<DocItem | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getKYCQueue(filter);
            setData(result);
        } catch {
            toast.error("Failed to load KYC queue");
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleVerify = async (item: DocItem) => {
        setActionLoading(item.id);
        try {
            await verifyDocument(item.propertyId, item.docType);
            toast.success(`${item.docLabel} verified!`);
            fetchData();
        } catch {
            toast.error("Verification failed");
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async () => {
        if (!rejectTarget || !rejectReason.trim()) { toast.error("Please provide a reason"); return; }
        setActionLoading(rejectTarget.id);
        try {
            await rejectDocument(rejectTarget.propertyId, rejectTarget.docType, rejectReason);
            toast.success("Document rejected & owner notified");
            setRejectTarget(null);
            setRejectReason("");
            fetchData();
        } catch {
            toast.error("Rejection failed");
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="space-y-4 md:space-y-6 pb-20 md:pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
                        <Shield className="h-7 w-7 text-indigo-600" /> KYC Verification Queue
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Review and verify owner documents</p>
                </div>
                <Button variant="outline" onClick={fetchData} disabled={loading} className="w-full sm:w-auto">
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            {/* Summary Cards - 2 on mobile, 4 on desktop */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {[
                    { label: "⏳ Pending", value: data?.stats.pending ?? "—", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
                    { label: "✅ Verified", value: data?.stats.verified ?? "—", color: "text-green-600", bg: "bg-green-50 border-green-200" },
                    { label: "📋 Total Docs", value: data?.stats.total ?? "—", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
                    { label: "🔁 Queue Active", value: loading ? "..." : "YES", color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
                ].map(card => (
                    <Card key={card.label} className={`border ${card.bg}`}>
                        <CardContent className="p-4">
                            <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
                            <p className="text-xs text-muted-foreground font-semibold mt-1">{card.label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filter Tabs — horizontal scroll on mobile */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {FILTER_TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${filter === tab.key
                            ? "bg-indigo-600 text-white shadow-md"
                            : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Queue — cards on mobile, table on desktop */}
            {loading ? (
                <div className="grid gap-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : data?.queue.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed rounded-xl">
                    <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
                    <p className="font-bold text-slate-700">All clear! No documents in this filter.</p>
                </div>
            ) : (
                <>
                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                        {data?.queue.map(item => (
                            <Card key={item.id} className={`border-l-4 ${item.isVerified ? "border-l-green-400" : "border-l-amber-400"}`}>
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-sm text-slate-900 truncate max-w-[180px]">{item.propertyName}</p>
                                            <p className="text-xs text-muted-foreground">{item.city} · {item.propertyDisplayId}</p>
                                        </div>
                                        <Badge className={item.isVerified ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                                            {item.isVerified ? "Verified" : "Pending"}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-600">
                                        <FileCheck className="h-3.5 w-3.5" />
                                        <span className="font-semibold">{item.docLabel}</span>
                                        <span>·</span>
                                        <User className="h-3.5 w-3.5" />
                                        <span className="truncate">{item.owner?.name || "Owner"}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setViewerDoc(item)}>
                                            <Eye className="h-3.5 w-3.5 mr-1" /> View
                                        </Button>
                                        {!item.isVerified && (
                                            <>
                                                <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-xs" disabled={actionLoading === item.id} onClick={() => handleVerify(item)}>
                                                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Verify
                                                </Button>
                                                <Button size="sm" variant="destructive" className="flex-1 text-xs" onClick={() => setRejectTarget(item)}>
                                                    <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block bg-white rounded-2xl border shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    {["Property", "Owner", "Document", "City", "Status", "Submitted", "Actions"].map(h => (
                                        <th key={h} className="text-left px-4 py-3 text-xs font-black uppercase text-slate-500">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {data?.queue.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-slate-900 truncate max-w-[160px]">{item.propertyName}</p>
                                            <p className="text-xs text-muted-foreground">{item.propertyDisplayId}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium">{item.owner?.name || "—"}</p>
                                            <p className="text-xs text-muted-foreground">{item.owner?.email}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">{item.docLabel}</span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{item.city}</td>
                                        <td className="px-4 py-3">
                                            <Badge className={item.isVerified ? "bg-green-100 text-green-800 border-0" : "bg-amber-100 text-amber-800 border-0"}>
                                                {item.isVerified ? "✅ Verified" : "⏳ Pending"}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500">
                                            {new Date(item.submittedAt).toLocaleDateString('en-IN')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" onClick={() => setViewerDoc(item)}>
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Button>
                                                {!item.isVerified && (
                                                    <>
                                                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs" disabled={actionLoading === item.id} onClick={() => handleVerify(item)}>
                                                            ✅ Verify
                                                        </Button>
                                                        <Button size="sm" variant="destructive" className="text-xs" onClick={() => setRejectTarget(item)}>
                                                            ❌ Reject
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Document Viewer Modal — full screen on mobile */}
            {viewerDoc && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-0 md:p-6" onClick={() => setViewerDoc(null)}>
                    <div className="bg-white w-full h-full md:h-auto md:max-w-3xl md:rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b bg-slate-50">
                            <div>
                                <h3 className="font-black text-slate-900">{viewerDoc.docLabel}</h3>
                                <p className="text-xs text-muted-foreground">{viewerDoc.propertyName}</p>
                            </div>
                            <button onClick={() => setViewerDoc(null)} className="p-2 rounded-full hover:bg-slate-200">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100 min-h-[300px]">
                            {viewerDoc.docUrl.startsWith('data:image') || viewerDoc.docUrl.match(/\.(jpg|jpeg|png|webp|gif)/i) ? (
                                <img src={viewerDoc.docUrl} alt={viewerDoc.docLabel} className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg" />
                            ) : (
                                <div className="text-center space-y-3">
                                    <FileCheck className="h-16 w-16 text-indigo-400 mx-auto" />
                                    <a href={viewerDoc.docUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold underline flex items-center gap-2 justify-center">
                                        <ZoomIn className="h-4 w-4" /> Open Document
                                    </a>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t bg-white flex flex-col sm:flex-row gap-3">
                            {!viewerDoc.isVerified ? (
                                <>
                                    <Button className="flex-1 bg-green-600 hover:bg-green-700" disabled={actionLoading === viewerDoc.id} onClick={() => { handleVerify(viewerDoc); setViewerDoc(null); }}>
                                        <CheckCircle className="h-4 w-4 mr-2" /> Approve Document
                                    </Button>
                                    <Button variant="destructive" className="flex-1" onClick={() => { setRejectTarget(viewerDoc); setViewerDoc(null); }}>
                                        <XCircle className="h-4 w-4 mr-2" /> Reject Document
                                    </Button>
                                </>
                            ) : (
                                <div className="flex-1 flex items-center gap-2 text-green-700 font-bold">
                                    <CheckCircle className="h-5 w-5" /> This document is verified
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {rejectTarget && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-6">
                    <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 space-y-4">
                        <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                            <XCircle className="h-5 w-5 text-red-500" /> Reject Document
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Rejecting <strong>{rejectTarget.docLabel}</strong> for <strong>{rejectTarget.propertyName}</strong>. Owner will be notified.
                        </p>
                        <textarea
                            className="w-full border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                            rows={3}
                            placeholder="Reason for rejection (e.g. Document is blurry, wrong document type...)"
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                        />
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>
                                Cancel
                            </Button>
                            <Button variant="destructive" className="flex-1" disabled={!rejectReason.trim() || actionLoading === rejectTarget.id} onClick={handleReject}>
                                Reject & Notify Owner
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
