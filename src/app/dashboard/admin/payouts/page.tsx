"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { getOwnerPayouts, processOwnerPayout, processBulkPayouts, getPayoutDetails } from "@/actions/adminPhase2";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { IndianRupee, RefreshCcw, CheckCircle, Users, Loader2, Square, CheckSquare, ChevronDown, ChevronUp, User } from "lucide-react";
import { useRouter, useSearchParams } from 'next/navigation';
import PeriodSelector from '@/components/ui/PeriodSelector';
import { parsePeriodSearchParams, serializePeriodFilter } from '@/lib/router/periodSearchParams';
import type { PeriodFilter } from '@/types/date';

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

    const router = useRouter();
    const searchParams = useSearchParams();

    // ── Centralized period filter (replaces manual selectedFYStart + selectedFYMonth) ──
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(
        () => parsePeriodSearchParams(new URLSearchParams(searchParams?.toString() ?? ''))
    );

    const handlePeriodChange = (filter: PeriodFilter) => {
        setPeriodFilter(filter);
        router.replace(`?${serializePeriodFilter(filter)}`, { scroll: false });
    };

    // Expandable states for detailed student breakdown
    const [expandedPayouts, setExpandedPayouts] = useState<Record<string, boolean>>({});
    const [payoutDetails, setPayoutDetails] = useState<Record<string, any[]>>({});
    const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({});

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getOwnerPayouts(undefined, filter === "ALL" ? undefined : filter);
            setData(result);
            setSelected([]);
            setExpandedPayouts({});
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

    const filterPayouts = (list: any[]) => {
        if (!list) return [];
        return list.filter((p: any) => {
            const d = p.createdAt || p.paidAt || p.date;
            if (!d) return true;
            const dt = new Date(d);
            const yr = dt.getFullYear();
            const mo = dt.getMonth(); // 0-indexed
            const fyS = parseInt(periodFilter.financialYear ?? '0');
            if (isNaN(fyS)) return true;
            // FY spans from April fyS to March fyS+1
            const inFY = (yr === fyS && mo >= 3) || (yr === fyS + 1 && mo <= 2);
            if (!inFY) return false;
            // periodFilter.month is '01'..'12' (1-indexed) or 'all'
            const pfMonth = periodFilter.month;
            if (pfMonth && pfMonth !== 'all') {
                const pfMo = parseInt(pfMonth) - 1; // convert to 0-indexed
                if (mo !== pfMo) return false;
            }
            return true;
        });
    };

    const filteredPayouts = filterPayouts(data?.payouts || []);

    const toggleAll = () => {
        const pending = filteredPayouts.filter((p: any) => p.status === 'PENDING' || p.status === 'APPROVED').map((p: any) => p.id) || [];
        setSelected(prev => prev.length === pending.length ? [] : pending);
    };

    const toggleExpand = async (payoutId: string) => {
        const isExpanded = !!expandedPayouts[payoutId];
        setExpandedPayouts(prev => ({ ...prev, [payoutId]: !isExpanded }));

        if (!isExpanded && !payoutDetails[payoutId]) {
            setDetailsLoading(prev => ({ ...prev, [payoutId]: true }));
            try {
                const details = await getPayoutDetails(payoutId);
                setPayoutDetails(prev => ({ ...prev, [payoutId]: details }));
            } catch (e: any) {
                toast.error("Failed to fetch breakdown: " + e.message);
            } finally {
                setDetailsLoading(prev => ({ ...prev, [payoutId]: false }));
            }
        }
    };

    const formatAmount = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

    return (
        <div className="space-y-4 md:space-y-6 pb-20 md:pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
                        <IndianRupee className="h-7 w-7 text-green-600" /> Owner Payout Management
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Process and track owner payout disbursements — <span className="font-bold text-indigo-600">Indian FY: April – March</span></p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <PeriodSelector
                        value={periodFilter}
                        onChange={handlePeriodChange}
                        showLabels={false}
                    />
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
                    { label: "💰 Total Volume (Period)", value: data ? formatAmount(filteredPayouts.reduce((s: number, p: any) => s + Number(p.netAmount || 0), 0)) : "—", color: "text-slate-900", bg: "bg-slate-50 border-slate-200" },
                    { label: "⏳ Pending", value: data ? formatAmount(filteredPayouts.filter((p: any) => p.status === 'PENDING').reduce((s: number, p: any) => s + Number(p.netAmount || 0), 0)) : "—", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
                    { label: "✅ Paid Out", value: data ? formatAmount(filteredPayouts.filter((p: any) => p.status === 'PAID').reduce((s: number, p: any) => s + Number(p.netAmount || 0), 0)) : "—", color: "text-green-600", bg: "bg-green-50 border-green-200" },
                    { label: "💹 Commission Earned", value: data ? formatAmount(filteredPayouts.reduce((s: number, p: any) => s + Number(p.commissionAmount || 0), 0)) : "—", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
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
            ) : filteredPayouts.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed rounded-xl">
                    <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
                    <p className="font-bold text-slate-700">No payouts in this category.</p>
                </div>
            ) : (
                <>
                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                        {filteredPayouts.map((p: any) => {
                            const canPay = p.status === 'PENDING' || p.status === 'APPROVED';
                            const isExpanded = !!expandedPayouts[p.id];
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
                                        <div className="flex items-center justify-between text-xs text-slate-600">
                                            <div className="flex items-center gap-2">
                                                <Users className="h-3.5 w-3.5" />
                                                <span className="font-bold">{p.owner?.name || "—"}</span>
                                            </div>
                                            <span className="text-slate-400">Period: {p.period}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-slate-500 border-t pt-2">
                                            <span>Gross: {formatAmount(p.grossAmount)}</span>
                                            <span>Comm: {formatAmount(p.commissionAmount)}</span>
                                            <Button size="sm" variant="ghost" className="h-7 text-xs font-bold text-indigo-600" onClick={() => toggleExpand(p.id)}>
                                                {isExpanded ? "Hide Breakdown" : "View Breakdown"}
                                            </Button>
                                        </div>

                                        {/* Mobile Breakdown */}
                                        {isExpanded && (
                                            <div className="border-t border-dashed mt-2 pt-2 space-y-2">
                                                {detailsLoading[p.id] ? (
                                                    <div className="flex items-center justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-indigo-600" /></div>
                                                ) : payoutDetails[p.id]?.length === 0 ? (
                                                    <p className="text-xs text-slate-400 text-center py-2">No transaction breakdown available.</p>
                                                ) : (
                                                    payoutDetails[p.id]?.map((fee: any) => (
                                                        <div key={fee.id} className="bg-slate-50 p-2 rounded-lg text-xs space-y-1">
                                                            <div className="flex justify-between font-bold text-slate-800">
                                                                <span>{fee.studentName} ({fee.roomBed})</span>
                                                                <span>Net: {formatAmount(fee.netAmount)}</span>
                                                            </div>
                                                            <p className="text-[10px] text-slate-400">ID: {fee.tenantDisplayId} · Phone: {fee.phone}</p>
                                                            <div className="flex justify-between text-[10px] text-slate-500">
                                                                <span>Paid: {formatAmount(fee.grossAmount)}</span>
                                                                <span>TDS: {formatAmount(fee.tdsAmount)}</span>
                                                                <span>GST: {formatAmount(fee.gstAmount)}</span>
                                                                <span>Fee: {formatAmount(fee.ownerFee)}</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}

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
                            <thead className="border-b bg-slate-50 text-xs font-bold text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 w-8"></th>
                                    <th className="px-4 py-3 w-10"></th>
                                    <th className="text-left px-4 py-3 uppercase">Payout ID</th>
                                    <th className="text-left px-4 py-3 uppercase">Owner</th>
                                    <th className="text-left px-4 py-3 uppercase">Period</th>
                                    <th className="text-left px-4 py-3 uppercase">Gross Rent</th>
                                    <th className="text-left px-4 py-3 uppercase text-orange-600">Platform Comm</th>
                                    <th className="text-left px-4 py-3 uppercase text-green-700">Net Payout</th>
                                    <th className="text-left px-4 py-3 uppercase">Status</th>
                                    <th className="text-left px-4 py-3 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y text-slate-700">
                                {filteredPayouts.map((p: any) => {
                                    const canPay = p.status === 'PENDING' || p.status === 'APPROVED';
                                    const isSelected = selected.includes(p.id);
                                    const isExpanded = !!expandedPayouts[p.id];
                                    return (
                                        <Fragment key={p.id}>
                                            <tr className={`hover:bg-slate-50/50 transition-colors ${isSelected ? "bg-indigo-50" : ""}`}>
                                                <td className="px-4 py-3 w-8">
                                                    {canPay && (
                                                        <button onClick={() => toggleSelect(p.id)}>
                                                            {isSelected ? <CheckSquare className="h-4 w-4 text-indigo-600" /> : <Square className="h-4 w-4 text-slate-400" />}
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 w-10 text-center">
                                                    <button onClick={() => toggleExpand(p.id)} className="text-slate-400 hover:text-slate-900 transition-colors">
                                                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs text-slate-400 font-bold">{p.displayId}</td>
                                                <td className="px-4 py-3">
                                                    <p className="font-bold text-slate-900">{p.owner?.name || "—"}</p>
                                                    <p className="text-xs text-muted-foreground">{p.owner?.email}</p>
                                                </td>
                                                <td className="px-4 py-3 text-xs font-bold">{p.period}</td>
                                                <td className="px-4 py-3 font-bold text-slate-900">{formatAmount(p.grossAmount)}</td>
                                                <td className="px-4 py-3 text-orange-600 font-bold">-{formatAmount(p.commissionAmount)}</td>
                                                <td className="px-4 py-3 font-black text-green-700">{formatAmount(p.netAmount)}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[p.status] || ""}`}>
                                                        {p.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {canPay && (
                                                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs font-bold" disabled={processing === p.id} onClick={() => handleProcess(p.id)}>
                                                            {processing === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Pay Now"}
                                                        </Button>
                                                    )}
                                                    {p.paidAt && <p className="text-xs text-slate-400 font-medium">{new Date(p.paidAt).toLocaleDateString('en-IN')}</p>}
                                                </td>
                                            </tr>

                                            {/* Expandable Breakdown Row */}
                                            {isExpanded && (
                                                <tr className="bg-slate-50/50">
                                                    <td colSpan={10} className="px-8 py-4 border-t border-b border-slate-100">
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-2">
                                                                <Users className="w-4 h-4 text-indigo-600" />
                                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-800">Student Rent Settlements Breakdown</h4>
                                                            </div>

                                                            {detailsLoading[p.id] ? (
                                                                <div className="flex items-center justify-center p-6"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
                                                            ) : payoutDetails[p.id]?.length === 0 ? (
                                                                <p className="text-xs text-slate-400 text-center py-4">No detailed transaction records linked to this payout period.</p>
                                                            ) : (
                                                                <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
                                                                    <table className="w-full text-xs text-left">
                                                                        <thead className="bg-slate-100 text-slate-500 font-bold border-b">
                                                                            <tr>
                                                                                <th className="p-3">Tenant ID</th>
                                                                                <th className="p-3">Student Name</th>
                                                                                <th className="p-3">Phone</th>
                                                                                <th className="p-3">Room / Bed</th>
                                                                                <th className="p-3">Paid Amount</th>
                                                                                <th className="p-3 text-red-600">TDS (1%)</th>
                                                                                <th className="p-3">GST (18% on Comm)</th>
                                                                                <th className="p-3 text-indigo-600">Comm Fee</th>
                                                                                <th className="p-3 text-green-700">Net Transferred</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                                                            {payoutDetails[p.id]?.map((fee: any) => (
                                                                                <tr key={fee.id} className="hover:bg-slate-50/50">
                                                                                    <td className="p-3 font-mono text-[10px] text-slate-400">{fee.tenantDisplayId}</td>
                                                                                    <td className="p-3 font-bold text-slate-800">{fee.studentName}</td>
                                                                                    <td className="p-3 text-slate-500">{fee.phone}</td>
                                                                                    <td className="p-3 text-slate-600">{fee.roomBed}</td>
                                                                                    <td className="p-3 font-bold text-slate-900">{formatAmount(fee.grossAmount)}</td>
                                                                                    <td className="p-3 text-red-600 font-bold">-{formatAmount(fee.tdsAmount)}</td>
                                                                                    <td className="p-3 text-slate-500">{formatAmount(fee.gstAmount)}</td>
                                                                                    <td className="p-3 text-indigo-600">-{formatAmount(fee.ownerFee)}</td>
                                                                                    <td className="p-3 text-green-700 font-black">{formatAmount(fee.netAmount)}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
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
