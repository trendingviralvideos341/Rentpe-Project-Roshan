"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
    Building2, CheckCircle2, Clock, Download, IndianRupee,
    ArrowLeft, Search, Filter, TrendingUp, Users, AlertCircle, X
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

function OnboardingReceiptModal({
    property,
    onClose
}: {
    property: PropertyEntry;
    onClose: () => void;
}) {
    const receiptNo = property.displayId ? `OBD-${property.displayId}` : `OBD-RP-${property.id.slice(-6).toUpperCase()}`;
    const paidDate = property.onboardingPaidAt ? format(new Date(property.onboardingPaidAt), "dd MMM yyyy, HH:mm") : "—";
    const paymentMethod = property.onboardingPaymentMethod === "ONLINE" ? "Online (Razorpay)" : property.onboardingPaymentMethod === "CASH" ? "Cash" : "—";
    const pdfUrl = `/api/receipts/onboarding/${property.id}?download=1`;

    const GST_RATE = 0.18;
    const feeBase = Math.round((property.feeAmount / (1 + GST_RATE)) * 100) / 100;
    const gst = Math.round((property.feeAmount - feeBase) * 100) / 100;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md my-4 overflow-y-auto max-h-[92vh] print:shadow-none print:max-h-none">
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white relative overflow-hidden">
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
                    <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-xl transition-all z-10 print:hidden">
                        <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3 mb-3 relative z-10">
                        <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-indigo-200">Onboarding Receipt</p>
                            <p className="font-black text-lg">{receiptNo}</p>
                        </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full relative z-10 bg-emerald-500/30 border border-emerald-400/40 text-emerald-100">
                        <CheckCircle2 className="w-3 h-3" /> Paid
                    </span>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-2xl p-4 space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Owner Details</p>
                            <p className="font-black text-slate-900 text-sm">{property.owner.name}</p>
                            <p className="text-xs text-slate-500">{property.owner.displayId}</p>
                        </div>
                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Property Details</p>
                            <p className="font-black text-indigo-900 text-sm">{property.name}</p>
                            <p className="text-xs text-indigo-700">{property.city}</p>
                        </div>
                    </div>

                    <div className="rounded-xl p-3 bg-indigo-50 border border-indigo-100">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-indigo-400">Transaction ID (Razorpay)</p>
                        <p className="text-xs font-mono font-bold break-all text-indigo-700">
                            {property.onboardingRazorpayId || property.onboardingRazorpayOrderId || '—'}
                        </p>
                    </div>

                    <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                        <div className="flex justify-between items-center px-4 py-3">
                            <div>
                                <p className="text-sm font-black text-slate-800">Platform Onboarding Fee</p>
                                <p className="text-xs text-slate-400">One-time service fee</p>
                            </div>
                            <p className="font-black text-slate-900">₹{feeBase.toFixed(2)}</p>
                        </div>
                        <div className="flex justify-between items-center px-4 py-3 bg-slate-50">
                            <div>
                                <p className="text-sm font-black text-slate-800">GST (18%)</p>
                                <p className="text-xs text-slate-400">CGST 9% + SGST 9%</p>
                            </div>
                            <p className="font-black text-slate-900">₹{gst.toFixed(2)}</p>
                        </div>
                        <div className="flex justify-between items-center px-4 py-3 bg-indigo-50/50">
                            <p className="text-sm font-black text-slate-600">Total Paid</p>
                            <p className="font-black text-lg text-slate-900">₹{property.feeAmount.toLocaleString('en-IN')}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Paid On</p>
                            <p className="text-sm font-black text-slate-700">{paidDate}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Payment Mode</p>
                            <p className="text-sm font-black text-slate-700">{paymentMethod}</p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl transition-all shadow-lg shadow-indigo-200"
                        >
                            <Download className="w-4 h-4" /> Download PDF
                        </a>
                        <button onClick={onClose} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm rounded-2xl transition-all">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AdminOnboardingFeesClient({ data }: { data: PageData }) {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"ALL" | "PAID" | "PENDING">("ALL");
    const [selectedReceipt, setSelectedReceipt] = useState<PropertyEntry | null>(null);

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
                                                        <button
                                                            onClick={() => setSelectedReceipt(p)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-indigo-100 transition-all cursor-pointer"
                                                        >
                                                            <Download className="w-3 h-3" /> PDF
                                                        </button>
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
                                            <button
                                                onClick={() => setSelectedReceipt(p)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-black rounded-xl border border-indigo-100 cursor-pointer"
                                            >
                                                <Download className="w-3.5 h-3.5" /> View Receipt
                                            </button>
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
            
            {/* Receipt Modal */}
            {selectedReceipt && (
                <OnboardingReceiptModal
                    property={selectedReceipt}
                    onClose={() => setSelectedReceipt(null)}
                />
            )}
        </div>
    );
}
