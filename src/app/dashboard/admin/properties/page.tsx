"use client";

import { useState, useEffect, useCallback } from "react";
import { getAllPropertiesForAdmin, getAdminPropertyStatusCounts, exemptPropertyFee, rejectProperty, requestPropertyCorrections } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2, RefreshCcw, Eye, CheckCircle, XCircle, AlertCircle, Phone, Mail, Filter } from "lucide-react";
import Link from "next/link";

const STATUS_TABS = [
    { key: "ALL", label: "All" },
    { key: "PENDING_VERIFICATION", label: "⏳ Pending" },
    { key: "VERIFYING_DOCUMENTS", label: "🔍 In Review" },
    { key: "APPROVED", label: "✅ Live" },
    { key: "REJECTED", label: "❌ Rejected" },
    { key: "NEEDS_CORRECTION", label: "🔄 Needs Fix" },
];

function statusColor(status: string) {
    const map: Record<string, string> = {
        APPROVED: "bg-green-100 text-green-800",
        PENDING_VERIFICATION: "bg-amber-100 text-amber-800",
        VERIFYING_DOCUMENTS: "bg-blue-100 text-blue-800",
        REJECTED: "bg-red-100 text-red-800",
        NEEDS_CORRECTION: "bg-orange-100 text-orange-800",
        SUSPENDED: "bg-slate-100 text-slate-800",
        VERIFIED_SUCCESSFULLY: "bg-emerald-100 text-emerald-800",
        APPROVED_PENDING_PAYMENT: "bg-purple-100 text-purple-800",
    };
    return map[status] || "bg-gray-100 text-gray-700";
}

export default function AdminPropertiesPage() {
    const [properties, setProperties] = useState<any[]>([]);
    const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
    const [filter, setFilter] = useState("ALL");
    const [loading, setLoading] = useState(true);
    const [actionModal, setActionModal] = useState<{ type: "reject" | "correction" | "approve"; prop: any } | null>(null);
    const [actionReason, setActionReason] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [searchQ, setSearchQ] = useState("");

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [props, counts] = await Promise.all([
                getAllPropertiesForAdmin(filter === "ALL" ? undefined : filter),
                getAdminPropertyStatusCounts(),
            ]);
            setProperties(props as any[]);
            setStatusCounts(counts);
        } catch {
            toast.error("Failed to load properties");
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleAction = async () => {
        if (!actionModal) return;
        setActionLoading(true);
        try {
            if (actionModal.type === "approve") {
                await exemptPropertyFee(actionModal.prop.id, "Approved via admin properties queue");
                toast.success(`"${actionModal.prop.name}" is now LIVE!`);
            } else if (actionModal.type === "reject") {
                if (!actionReason.trim()) { toast.error("Reason required"); setActionLoading(false); return; }
                await rejectProperty(actionModal.prop.id, actionReason);
                toast.success("Property rejected & owner notified");
            } else if (actionModal.type === "correction") {
                if (!actionReason.trim()) { toast.error("Correction notes required"); setActionLoading(false); return; }
                await requestPropertyCorrections(actionModal.prop.id, actionReason);
                toast.success("Owner notified to make corrections");
            }
            setActionModal(null);
            setActionReason("");
            fetchData();
        } catch (e: any) {
            toast.error(e.message || "Action failed");
        } finally {
            setActionLoading(false);
        }
    };

    const filtered = properties.filter(p =>
        !searchQ || p.name?.toLowerCase().includes(searchQ.toLowerCase()) ||
        p.city?.toLowerCase().includes(searchQ.toLowerCase()) ||
        p.owner?.name?.toLowerCase().includes(searchQ.toLowerCase())
    );

    const pendingCount = statusCounts['PENDING_VERIFICATION'] || 0;
    const liveCount = statusCounts['APPROVED'] || 0;
    const rejectedCount = (statusCounts['REJECTED'] || 0) + (statusCounts['SUSPENDED'] || 0);
    const correctionCount = statusCounts['NEEDS_CORRECTION'] || 0;

    return (
        <div className="space-y-4 md:space-y-6 pb-20 md:pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
                        <Building2 className="h-7 w-7 text-indigo-600" /> Property Approval Queue
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Review and approve properties for the platform</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchData} disabled={loading} className="w-full sm:w-auto">
                        <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                    </Button>
                </div>
            </div>

            {/* Summary Cards - 2x2 mobile, 4 desktop */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {[
                    { label: "🟡 Pending", value: pendingCount, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", key: "PENDING_VERIFICATION" },
                    { label: "✅ Live", value: liveCount, color: "text-green-600", bg: "bg-green-50 border-green-200", key: "APPROVED" },
                    { label: "❌ Rejected", value: rejectedCount, color: "text-red-600", bg: "bg-red-50 border-red-200", key: "REJECTED" },
                    { label: "🔄 Needs Fix", value: correctionCount, color: "text-orange-600", bg: "bg-orange-50 border-orange-200", key: "NEEDS_CORRECTION" },
                ].map(card => (
                    <Card key={card.key} className={`border cursor-pointer hover:shadow-md transition-shadow ${card.bg}`} onClick={() => setFilter(card.key)}>
                        <CardContent className="p-4">
                            <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
                            <p className="text-xs text-muted-foreground font-semibold mt-1">{card.label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filter Tabs + Search */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar flex-1">
                    {STATUS_TABS.map(tab => (
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
                <input
                    type="text"
                    placeholder="🔍 Search property, city, owner..."
                    className="border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full sm:w-64"
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                />
            </div>

            {/* Properties — cards on mobile, table on desktop */}
            {loading ? (
                <div className="grid gap-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed rounded-xl">
                    <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
                    <p className="font-bold text-slate-700">No properties found for this filter.</p>
                </div>
            ) : (
                <>
                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                        {filtered.map((prop: any) => (
                            <Card key={prop.id} className="border-l-4 border-l-indigo-400">
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-slate-900 truncate">{prop.name}</p>
                                            <p className="text-xs text-muted-foreground">{prop.city} · {prop.displayId}</p>
                                        </div>
                                        <Badge className={`text-xs shrink-0 ml-2 border-0 ${statusColor(prop.status)}`}>
                                            {prop.status.replace(/_/g, ' ')}
                                        </Badge>
                                    </div>
                                    <div className="text-xs text-slate-600 space-y-1">
                                        <div className="flex items-center gap-1.5">
                                            <Mail className="h-3 w-3" />
                                            <span className="truncate">{prop.owner?.email || "—"}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Phone className="h-3 w-3" />
                                            <span>{prop.owner?.phone || "—"}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        <Link href={`/dashboard/admin/properties/${prop.id}`}>
                                            <Button size="sm" variant="outline" className="text-xs">
                                                <Eye className="h-3.5 w-3.5 mr-1" /> View
                                            </Button>
                                        </Link>
                                        {prop.status !== 'APPROVED' && (
                                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs" onClick={() => setActionModal({ type: "approve", prop })}>
                                                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                                            </Button>
                                        )}
                                        {prop.status !== 'REJECTED' && (
                                            <Button size="sm" variant="destructive" className="text-xs" onClick={() => setActionModal({ type: "reject", prop })}>
                                                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                                            </Button>
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
                                    {["Property", "Owner", "City / Type", "Status", "Submitted", "Actions"].map(h => (
                                        <th key={h} className="text-left px-4 py-3 text-xs font-black uppercase text-slate-500">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filtered.map((prop: any) => (
                                    <tr key={prop.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-slate-900 max-w-[180px] truncate">{prop.name}</p>
                                            <p className="text-xs text-muted-foreground font-mono">{prop.displayId}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium">{prop.owner?.name || "—"}</p>
                                            <p className="text-xs text-muted-foreground">{prop.owner?.phone}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium">{prop.city}</p>
                                            <p className="text-xs text-muted-foreground">{prop.propertyType}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge className={`border-0 ${statusColor(prop.status)}`}>
                                                {prop.status.replace(/_/g, ' ')}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500">
                                            {new Date(prop.createdAt).toLocaleDateString('en-IN')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2 flex-wrap">
                                                <Link href={`/dashboard/admin/properties/${prop.id}`}>
                                                    <Button size="sm" variant="outline" className="text-xs">
                                                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                                                    </Button>
                                                </Link>
                                                {prop.status !== 'APPROVED' && (
                                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs" onClick={() => setActionModal({ type: "approve", prop })}>
                                                        ✅ Approve
                                                    </Button>
                                                )}
                                                <Button size="sm" variant="outline" className="text-xs text-orange-600 border-orange-200" onClick={() => setActionModal({ type: "correction", prop })}>
                                                    ⚠️ Corrections
                                                </Button>
                                                {prop.status !== 'REJECTED' && (
                                                    <Button size="sm" variant="destructive" className="text-xs" onClick={() => setActionModal({ type: "reject", prop })}>
                                                        ❌ Reject
                                                    </Button>
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

            {/* Action Modal */}
            {actionModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-6">
                    <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 space-y-4">
                        <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                            {actionModal.type === "approve" && <><CheckCircle className="h-5 w-5 text-green-500" /> Approve Property</>}
                            {actionModal.type === "reject" && <><XCircle className="h-5 w-5 text-red-500" /> Reject Property</>}
                            {actionModal.type === "correction" && <><AlertCircle className="h-5 w-5 text-orange-500" /> Request Corrections</>}
                        </h3>
                        <p className="text-sm text-slate-600 font-medium">"{actionModal.prop.name}"</p>

                        {actionModal.type === "approve" && (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
                                This will set the property to LIVE and notify the owner. Owner&apos;s onboarding fee will be waived.
                            </div>
                        )}

                        {(actionModal.type === "reject" || actionModal.type === "correction") && (
                            <textarea
                                className="w-full border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                rows={3}
                                placeholder={actionModal.type === "reject"
                                    ? "Reason for rejection (owner will be notified)..."
                                    : "What needs to be corrected? (owner will be notified)..."
                                }
                                value={actionReason}
                                onChange={e => setActionReason(e.target.value)}
                            />
                        )}

                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => { setActionModal(null); setActionReason(""); }}>
                                Cancel
                            </Button>
                            <Button
                                className={`flex-1 ${actionModal.type === "approve" ? "bg-green-600 hover:bg-green-700" : actionModal.type === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700"}`}
                                disabled={actionLoading || ((actionModal.type !== "approve") && !actionReason.trim())}
                                onClick={handleAction}
                            >
                                {actionLoading ? "Processing..." : actionModal.type === "approve" ? "Make Live" : actionModal.type === "reject" ? "Reject & Notify" : "Send Correction Request"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
