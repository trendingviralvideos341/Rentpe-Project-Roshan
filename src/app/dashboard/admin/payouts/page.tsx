"use client";

import { useState, useEffect, useCallback } from "react";
import { getOwnerPayouts, processOwnerPayout, processBulkPayouts } from "@/actions/adminPhase2";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { IndianRupee, RefreshCcw, CheckCircle, Users, Loader2, Square, CheckSquare } from "lucide-react";

const STATUS_TABS = [
    { key: "ALL", label: "All" },
    { key: "PENDING", label: "⏳ Pending" },
    { key: "APPROVED", label: "🟡 Approved" },
    { key: "PAID", label: "✅ Paid" },
    { key: "FAILED", label: "❌ Failed" },
];

const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    APPROVED: "bg-blue-100 text-blue-800",
    PAID: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
};

export default function PayoutsPage() {
    const [data, setData] = useState<any>(null);
    const [filter, setFilter] = useState("ALL");
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<string[]>([]);
    const [processing, setProcessing] = useState<string | null>(null);
    const [bulkProcessing, setBulkProcessing] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getOwnerPayouts(undefined, filter === "ALL" ? undefined : filter);
            setData(result);
            setSelected([]);
        } catch { toast.error("Failed to load payouts"); }
        finally { setLoading(false); }
    }, [filter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleProcess = async (payoutId: string) => {
        setProcessing(payoutId);
        try {
            await processOwnerPayout(payoutId);
            toast.success("Payout processed!");
            fetchData();
        } catch { toast.error("Processing failed"); }
        finally { setProcessing(null); }
    };

    const handleBulkProcess = async () => {
        if (selected.length === 0) { toast.error("Select at least one payout"); return; }
        setBulkProcessing(true);
        try {
            const result = await processBulkPayouts(selected);
            toast.success(`${result.succeeded} payouts processed${result.failed > 0 ? `, ${result.failed} failed` : ""}`);
            fetchData();
        } catch { toast.error("Bulk processing failed"); }
        finally { setBulkProcessing(false); }
    };

    const toggleSelect = (id: string) =>
        setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

    const toggleAll = () => {
        const pending = data?.payouts.filter((p: any) => p.status === 'PENDING' || p.status === 'APPROVED').map((p: any) => p.id) || [];
        setSelected(prev => prev.length === pending.length ? [] : pending);
    };

    const formatAmount = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

    return (
        <div className="space-y-4 md:space-y-6 pb-20 md:pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
                        <IndianRupee className="h-7 w-7 text-green-600" /> Owner Payout Management
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Process and track owner payout disbursements</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchData} disabled={loading}>
                        <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                    </Button>
                    {selected.length > 0 && (
                        <Button className="bg-green-600 hover:bg-green-700" onClick={handleBulkProcess} disabled={bulkProcessing}>
                            {bulkProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</> : <>✅ Pay {selected.length} Selected</>}
                        </Button>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {[
                    { label: "💰 Total Volume", value: data ? formatAmount(data.stats.totalThisMonth) : "—", color: "text-slate-900", bg: "bg-slate-50 border-slate-200" },
                    { label: "⏳ Pending", value: data ? formatAmount(data.stats.pending) : "—", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
                    { label: "✅ Paid Out", value: data ? formatAmount(data.stats.paid) : "—", color: "text-green-600", bg: "bg-green-50 border-green-200" },
                    { label: "💹 Commission Earned", value: data ? formatAmount(data.stats.commission) : "—", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
                ].map(card => (
                    <Card key={card.label} className={`border ${card.bg}`}>
                        <CardContent className="p-4">
                            <p className={`text-lg md:text-2xl font-black ${card.color} truncate`}>{card.value}</p>
                            <p className="text-xs text-muted-foreground font-semibold mt-1">{card.label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {STATUS_TABS.map(tab => (
                    <button key={tab.key} onClick={() => setFilter(tab.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${filter === tab.key ? "bg-green-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-green-300"}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div className="grid gap-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
            ) : data?.payouts.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed rounded-xl">
                    <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
                    <p className="font-bold text-slate-700">No payouts in this category.</p>
                </div>
            ) : (
                <>
                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                        {data?.payouts.map((p: any) => {
                            const canPay = p.status === 'PENDING' || p.status === 'APPROVED';
                            return (
                                <Card key={p.id} className={`border-l-4 ${p.status === 'PAID' ? 'border-l-green-400' : p.status === 'PENDING' ? 'border-l-amber-400' : 'border-l-blue-400'}`}>
                                    <CardContent className="p-4 space-y-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-mono text-xs text-slate-400">{p.displayId}</p>
                                                <p className="font-black text-lg text-slate-900">{formatAmount(p.netAmount)}</p>
                                            </div>
                                            <Badge className={`border-0 text-xs ${STATUS_COLORS[p.status] || ""}`}>{p.status}</Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-600">
                                            <Users className="h-3.5 w-3.5" />
                                            <span>{p.owner?.name || "—"}</span>
                                            <span className="text-slate-400">· Period: {p.period}</span>
                                        </div>
                                        <p className="text-xs text-slate-500">Gross: {formatAmount(p.grossAmount)} · Commission: {formatAmount(p.commissionAmount)}</p>
                                        {canPay && (
                                            <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-xs mt-1" disabled={processing === p.id} onClick={() => handleProcess(p.id)}>
                                                {processing === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Mark as Paid</>}
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block bg-white rounded-2xl border shadow-sm overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-slate-50">
                            <button onClick={toggleAll} className="text-slate-500 hover:text-slate-900">
                                {selected.length > 0 ? <CheckSquare className="h-4 w-4 text-indigo-600" /> : <Square className="h-4 w-4" />}
                            </button>
                            {selected.length > 0 && (
                                <span className="text-xs text-indigo-600 font-bold">{selected.length} selected</span>
                            )}
                        </div>
                        <table className="w-full text-sm">
                            <thead className="border-b">
                                <tr>
                                    {["", "Payout ID", "Owner", "Period", "Gross", "Commission", "Net", "Status", "Actions"].map(h => (
                                        <th key={h} className="text-left px-4 py-3 text-xs font-black uppercase text-slate-500">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {data?.payouts.map((p: any) => {
                                    const canPay = p.status === 'PENDING' || p.status === 'APPROVED';
                                    const isSelected = selected.includes(p.id);
                                    return (
                                        <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? "bg-indigo-50" : ""}`}>
                                            <td className="px-4 py-3 w-8">
                                                {canPay && (
                                                    <button onClick={() => toggleSelect(p.id)}>
                                                        {isSelected ? <CheckSquare className="h-4 w-4 text-indigo-600" /> : <Square className="h-4 w-4 text-slate-400" />}
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.displayId}</td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium">{p.owner?.name || "—"}</p>
                                                <p className="text-xs text-muted-foreground">{p.owner?.email}</p>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-medium">{p.period}</td>
                                            <td className="px-4 py-3 font-medium">{formatAmount(p.grossAmount)}</td>
                                            <td className="px-4 py-3 text-orange-600 font-medium">-{formatAmount(p.commissionAmount)}</td>
                                            <td className="px-4 py-3 font-black text-green-700">{formatAmount(p.netAmount)}</td>
                                            <td className="px-4 py-3"><Badge className={`border-0 ${STATUS_COLORS[p.status] || ""}`}>{p.status}</Badge></td>
                                            <td className="px-4 py-3">
                                                {canPay && (
                                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs" disabled={processing === p.id} onClick={() => handleProcess(p.id)}>
                                                        {processing === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Pay Now"}
                                                    </Button>
                                                )}
                                                {p.paidAt && <p className="text-xs text-slate-400 mt-1">{new Date(p.paidAt).toLocaleDateString('en-IN')}</p>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
