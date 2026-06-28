"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
    Building2, CheckCircle2, Clock, Download, IndianRupee,
    ArrowLeft, Search, Filter, TrendingUp, Users, AlertCircle
} from "lucide-react";
import Link from "next/link";

type PropertyEntry = {
    id: string;
    displayId: string | null;
    name: string;
    city: string;
    status: string;
    onboardingPaidAt: string | null;
    onboardingPaymentMethod: string | null;
    onboardingRazorpayId: string | null;
    onboardingRazorpayOrderId: string | null;
    createdAt: string;
    feeAmount: number;
    isPaid: boolean;
    owner: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        displayId: string;
    };
};

type PageData = {
    properties: PropertyEntry[];
    feeAmount: number;
    totalCollected: number;
    paidCount: number;
    pendingCount: number;
};

function StatusBadge({ paid }: { paid: boolean }) {
    return paid ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Paid
        </span>
    ) : (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> Pending
        </span>
    );
}

export default function AdminOnboardingFeesClient({ data }: { data: PageData }) {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"ALL" | "PAID" | "PENDING">("ALL");

    const filtered = useMemo(() => {
        return data.properties.filter(p => {
            const matchSearch =
                !search ||
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                (p.displayId || "").toLowerCase().includes(search.toLowerCase()) ||
                p.owner.name.toLowerCase().includes(search.toLowerCase()) ||
                (p.onboardingRazorpayId || "").toLowerCase().includes(search.toLowerCase());
            const matchFilter =
                filter === "ALL" ||
                (filter === "PAID" && p.isPaid) ||
                (filter === "PENDING" && !p.isPaid);
            return matchSearch && matchFilter;
        });
    }, [data.properties, search, filter]);

    const GST_RATE   = 0.18;
    const feeBase    = Math.round((data.feeAmount / (1 + GST_RATE)) * 100) / 100;
    const gst        = Math.round((data.feeAmount - feeBase) * 100) / 100;

    return (
        <div className="-mx-4 -mt-4 md:-mx-8 md:-mt-8 min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 px-4 pt-5 pb-8 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -left-10 bottom-0 w-48 h-48 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
                <div className="max-w-6xl mx-auto relative z-10">
                    <Link href="/dashboard/admin"
                        className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-4 transition-all border border-white/30 backdrop-blur-sm">
                        <ArrowLeft className="w-3 h-3" /> Back
                    </Link>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white">Property Onboarding Fees</h1>
                            <p className="text-indigo-200 text-xs font-medium mt-0.5">Global ledger — all owners & properties</p>
                        </div>
                    </div>

                    {/* Header summary chips */}
                    <div className="flex flex-wrap gap-2 text-xs">
                        <span className="bg-white/15 border border-white/20 text-white px-3 py-1 rounded-full font-bold backdrop-blur-sm">
                            Total Properties: {data.properties.length}
                        </span>
                        <span className="bg-emerald-500/30 border border-emerald-400/30 text-emerald-100 px-3 py-1 rounded-full font-bold">
                            ✓ Paid: {data.paidCount}
                        </span>
                        <span className="bg-amber-500/30 border border-amber-400/30 text-amber-100 px-3 py-1 rounded-full font-bold">
                            ⏳ Pending: {data.pendingCount}
                        </span>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 mt-5 space-y-5">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded-2xl p-4 shadow-lg shadow-indigo-100/50 border border-slate-100">
                        <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center mb-3">
                            <IndianRupee className="w-4 h-4 text-emerald-600" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Collected</p>
                        <p className="text-lg font-black text-slate-900 mt-0.5">₹{data.totalCollected.toLocaleString("en-IN")}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-lg shadow-indigo-100/50 border border-slate-100">
                        <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center mb-3">
                            <TrendingUp className="w-4 h-4 text-indigo-600" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">GST Collected</p>
                        <p className="text-lg font-black text-slate-900 mt-0.5">₹{(data.paidCount * gst).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-lg shadow-indigo-100/50 border border-slate-100">
                        <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
                            <CheckCircle2 className="w-4 h-4 text-purple-600" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Properties Paid</p>
                        <p className="text-lg font-black text-slate-900 mt-0.5">{data.paidCount}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-lg shadow-indigo-100/50 border border-slate-100">
                        <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center mb-3">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pending Payment</p>
                        <p className="text-lg font-black text-slate-900 mt-0.5">{data.pendingCount}</p>
                    </div>
                </div>

                {/* GST Breakup Info */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-3.5 flex flex-wrap gap-6 text-xs text-slate-600">
                    <span className="flex items-center gap-1.5"><IndianRupee className="w-3 h-3 text-indigo-500" /><span className="font-bold text-slate-700">Fee per property:</span> ₹{data.feeAmount}</span>
                    <span className="flex items-center gap-1.5">📋 <span className="font-bold text-slate-700">Base (excl. GST):</span> ₹{feeBase.toFixed(2)}</span>
                    <span className="flex items-center gap-1.5">🏛 <span className="font-bold text-slate-700">CGST @ 9%:</span> ₹{(gst / 2).toFixed(2)}</span>
                    <span className="flex items-center gap-1.5">🏛 <span className="font-bold text-slate-700">SGST @ 9%:</span> ₹{(gst / 2).toFixed(2)}</span>
                    <span className="flex items-center gap-1.5">📌 <span className="font-bold text-slate-700">SAC Code:</span> 998314</span>
                </div>

                {/* Search & Filter */}
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex-1 min-w-[200px] relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            id="admin-obdfee-search"
                            type="text"
                            placeholder="Search by owner, property, Razorpay ID..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1">
                        <Filter className="w-3.5 h-3.5 text-slate-400 ml-2" />
                        {(["ALL", "PAID", "PENDING"] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${filter === f ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <span className="text-xs text-slate-400 font-bold">{filtered.length} records</span>
                </div>

                {/* Main Table */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                        <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <Users className="w-4 h-4 text-indigo-600" /> All Property Onboarding Fees
                        </h2>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="py-16 text-center">
                            <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <p className="text-sm font-bold text-slate-400">No records found</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            {["Owner", "Property Name", "Property ID", "Date & Time", "Amount", "Razorpay Payment ID", "Method", "Status", "Receipt"].map(h => (
                                                <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(p => (
                                            <tr key={p.id} className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors">
                                                <td className="px-4 py-3.5">
                                                    <p className="font-bold text-slate-800 text-xs">{p.owner.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{p.owner.displayId}</p>
                                                </td>
                                                <td className="px-4 py-3.5 font-bold text-slate-700 text-xs max-w-[140px]">
                                                    <span className="truncate block">{p.name}</span>
                                                    <span className="text-[10px] text-slate-400">{p.city}</span>
                                                </td>
                                                <td className="px-4 py-3.5 text-xs font-mono text-indigo-600 font-bold">{p.displayId || "—"}</td>
                                                <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                                                    {p.onboardingPaidAt ? format(new Date(p.onboardingPaidAt), "dd MMM yyyy, HH:mm") : "—"}
                                                </td>
                                                <td className="px-4 py-3.5 text-xs font-black text-slate-900">₹{p.feeAmount}</td>
                                                <td className="px-4 py-3.5 text-[10px] font-mono text-slate-500 max-w-[160px]">
                                                    <span className="truncate block">{p.onboardingRazorpayId || "—"}</span>
                                                </td>
                                                <td className="px-4 py-3.5 text-xs text-slate-500">
                                                    {p.onboardingPaymentMethod === "ONLINE" ? "🔵 Online" : p.onboardingPaymentMethod === "CASH" ? "💵 Cash" : "—"}
                                                </td>
                                                <td className="px-4 py-3.5"><StatusBadge paid={p.isPaid} /></td>
                                                <td className="px-4 py-3.5">
                                                    {p.isPaid ? (
                                                        <a
                                                            href={`/api/receipts/onboarding/${p.id}?download=1`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-indigo-100 transition-all"
                                                        >
                                                            <Download className="w-3 h-3" /> PDF
                                                        </a>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs font-bold">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="md:hidden divide-y divide-slate-50">
                                {filtered.map(p => (
                                    <div key={p.id} className="p-4 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm">{p.name}</p>
                                                <p className="text-[10px] font-mono text-indigo-600">{p.displayId || "—"}</p>
                                                <p className="text-[10px] text-slate-500 mt-0.5">Owner: <span className="font-bold">{p.owner.name}</span></p>
                                            </div>
                                            <StatusBadge paid={p.isPaid} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-500">
                                            <div><span className="font-bold text-slate-700">Amount:</span> ₹{p.feeAmount}</div>
                                            <div><span className="font-bold text-slate-700">Date:</span> {p.onboardingPaidAt ? format(new Date(p.onboardingPaidAt), "dd MMM yy") : "—"}</div>
                                            {p.onboardingRazorpayId && (
                                                <div className="col-span-2 truncate font-mono text-[10px]">{p.onboardingRazorpayId}</div>
                                            )}
                                        </div>
                                        {p.isPaid && (
                                            <a
                                                href={`/api/receipts/onboarding/${p.id}?download=1`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-black rounded-xl border border-indigo-100"
                                            >
                                                <Download className="w-3.5 h-3.5" /> Download Receipt
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <p className="text-center text-xs text-slate-400 font-medium">
                    All amounts include 18% GST (CGST 9% + SGST 9%). SAC Code 998314. For refund queries, check admin support tickets.
                </p>
            </div>
        </div>
    );
}
