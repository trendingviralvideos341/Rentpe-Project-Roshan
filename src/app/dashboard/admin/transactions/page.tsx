"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Search, Download, FileText, Filter, X, ChevronDown, TrendingUp, TrendingDown, IndianRupee, Receipt, Users, Building2, ArrowDownLeft, ArrowUpRight, CreditCard, AlertCircle } from "lucide-react";
import { getTransactions } from "@/actions/admin";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
    `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtShort = (n: number) =>
    `₹${Number(n || 0).toLocaleString("en-IN")}`;

const fmtDate = (d: any) => {
    if (!d) return "—";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtTime = (d: any) => {
    if (!d) return "";
    return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

// Sanitize for CSV (prevent formula injection)
const csvSafe = (val: any): string => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    if (["+", "-", "=", "@", "|", "%"].some(c => s.startsWith(c))) return `'${s}`;
    return s.replace(/"/g, '""');
};

// ─────────────────────────────────────────────────────────────────────────────
// Export Utilities
// ─────────────────────────────────────────────────────────────────────────────

function exportToCSV(rows: any[], headers: { key: string; label: string }[], filename: string) {
    const headerRow = headers.map(h => `"${h.label}"`).join(",");
    const dataRows = rows.map(r =>
        headers.map(h => `"${csvSafe(r[h.key])}"`).join(",")
    );
    const csv = [headerRow, ...dataRows].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportToPDF(title: string, rows: any[], headers: { key: string; label: string }[], summaryLines: string[]) {
    const tableRows = rows.map(r =>
        `<tr>${headers.map(h => `<td>${csvSafe(r[h.key]) || "—"}</td>`).join("")}</tr>`
    ).join("");

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 10px; color: #1e293b; }
  h1 { font-size: 16px; color: #1e3a5f; margin-bottom: 4px; }
  .meta { font-size: 9px; color: #64748b; margin-bottom: 12px; }
  .summary { background: #f1f5f9; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 9px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1e40af; color: white; padding: 5px 6px; text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; font-size: 9px; }
  tr:nth-child(even) { background: #f8fafc; }
  @page { size: A3 landscape; margin: 1cm; }
</style>
</head>
<body>
  <h1>RentPe — ${title}</h1>
  <div class="meta">Generated: ${new Date().toLocaleString("en-IN")} | Total Records: ${rows.length}</div>
  <div class="summary">${summaryLines.join(" &nbsp;|&nbsp; ")}</div>
  <table>
    <thead><tr>${headers.map(h => `<th>${h.label}</th>`).join("")}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) {
        win.document.write(html);
        win.document.close();
        win.print();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable Sub-Components
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }: {
    label: string; value: string; sub?: string;
    icon: any; color: "indigo" | "violet" | "rose" | "emerald" | "amber" | "cyan";
}) {
    const gradients: Record<string, string> = {
        indigo: "from-indigo-600 to-indigo-800",
        violet: "from-violet-600 to-violet-800",
        rose: "from-rose-500 to-red-700",
        emerald: "from-emerald-500 to-emerald-700",
        amber: "from-amber-500 to-orange-600",
        cyan: "from-cyan-500 to-cyan-700",
    };
    return (
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-4 flex items-center gap-3 hover:shadow-lg transition-all duration-200">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradients[color]} flex items-center justify-center flex-shrink-0 shadow`}>
                <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
                <p className="text-xl font-black text-slate-900 truncate">{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        SUCCESS: "bg-emerald-100 text-emerald-800",
        VERIFIED: "bg-emerald-100 text-emerald-800",
        PAID: "bg-emerald-100 text-emerald-800",
        PROCESSED: "bg-emerald-100 text-emerald-800",
        REFUNDED: "bg-rose-100 text-rose-800",
        FAILED: "bg-red-100 text-red-800",
        REJECTED: "bg-red-100 text-red-800",
        PENDING: "bg-amber-100 text-amber-800",
        APPROVED: "bg-blue-100 text-blue-800",
        DUPLICATE: "bg-orange-100 text-orange-800",
    };
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${map[status] || "bg-slate-100 text-slate-600"}`}>
            {status}
        </span>
    );
}

function TypeBadge({ type, label }: { type: string; label?: string }) {
    const map: Record<string, string> = {
        TOKEN_PAYMENT: "bg-teal-100 text-teal-700",
        RENT: "bg-indigo-100 text-indigo-700",
        DEPOSIT: "bg-amber-100 text-amber-700",
        PROPERTY_ONBOARDING: "bg-purple-100 text-purple-700",
        PAYMENT: "bg-slate-100 text-slate-600",
        DAMAGE_RECOVERY: "bg-orange-100 text-orange-700",
        RENT_SETTLEMENT: "bg-violet-100 text-violet-700",
        CANCELLATION_REFUND: "bg-rose-100 text-rose-700",
        DAMAGE_RECOVERY_REFUND: "bg-red-100 text-red-700",
        DUPLICATE_REFUND: "bg-pink-100 text-pink-700",
        OFFLINE_SETTLEMENT: "bg-slate-100 text-slate-600",
        ONBOARDING_REFUND: "bg-purple-100 text-purple-700",
    };
    return (
        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight whitespace-nowrap ${map[type] || "bg-slate-100 text-slate-600"}`}>
            {label || type.replace(/_/g, " ")}
        </span>
    );
}

function MultiSelectFilter({ label, options, selected, onChange }: {
    label: string;
    options: { value: string; label: string }[];
    selected: string[];
    onChange: (vals: string[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const toggle = (val: string) => {
        if (val === "ALL") { onChange(["ALL"]); return; }
        const next = selected.includes(val)
            ? selected.filter(v => v !== val && v !== "ALL")
            : [...selected.filter(v => v !== "ALL"), val];
        onChange(next.length === 0 ? ["ALL"] : next);
    };
    const isAll = selected.includes("ALL") || selected.length === 0;
    const displayLabel = isAll ? "All" : `${selected.length} selected`;

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    !isAll ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                }`}
            >
                <span className="text-slate-400 font-normal">{label}:</span>
                <span>{displayLabel}</span>
                <ChevronDown className="w-3 h-3" />
            </button>
            {open && (
                <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-1 min-w-[160px]">
                    {[{ value: "ALL", label: "All" }, ...options].map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => toggle(opt.value)}
                            className={`w-full text-left px-3 py-1.5 text-xs rounded-lg flex items-center gap-2 hover:bg-blue-50 ${
                                (isAll && opt.value === "ALL") || selected.includes(opt.value) ? "text-blue-700 font-bold" : "text-slate-700"
                            }`}
                        >
                            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                                (isAll && opt.value === "ALL") || selected.includes(opt.value)
                                    ? "bg-blue-600 border-blue-600" : "border-slate-300"
                            }`}>
                                {((isAll && opt.value === "ALL") || selected.includes(opt.value)) && (
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                )}
                            </span>
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
            {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
        </div>
    );
}

function DateRangeFilter({ from, to, onChange }: {
    from: string; to: string;
    onChange: (from: string, to: string) => void;
}) {
    return (
        <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">From:</span>
            <input type="date" value={from} onChange={e => onChange(e.target.value, to)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400" />
            <span className="text-xs text-slate-500 font-medium">To:</span>
            <input type="date" value={to} onChange={e => onChange(from, e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400" />
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <tr>
            <td colSpan={20} className="py-16 text-center">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                        <Receipt className="w-7 h-7 text-slate-300" />
                    </div>
                    <p className="text-sm font-semibold">{message}</p>
                    <p className="text-xs">Try adjusting your filters or search query</p>
                </div>
            </td>
        </tr>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab A — Customer Transactions
// ─────────────────────────────────────────────────────────────────────────────

function TabA({ transactions, loading }: { transactions: any[]; loading: boolean }) {
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<string[]>(["ALL"]);
    const [statusFilter, setStatusFilter] = useState<string[]>(["ALL"]);
    const [methodFilter, setMethodFilter] = useState<string[]>(["ALL"]);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [showFilters, setShowFilters] = useState(false);

    const filtered = useMemo(() => {
        return transactions.filter(txn => {
            if (!typeFilter.includes("ALL") && !typeFilter.includes(txn.txnType)) return false;
            if (!statusFilter.includes("ALL") && !statusFilter.includes(txn.status)) return false;
            if (!methodFilter.includes("ALL") && !methodFilter.includes(txn.method?.toUpperCase())) return false;
            if (dateFrom && new Date(txn.date) < new Date(dateFrom)) return false;
            if (dateTo && new Date(txn.date) > new Date(dateTo + "T23:59:59")) return false;
            const q = search.toLowerCase();
            if (!q) return true;
            return (
                txn.id?.toLowerCase().includes(q) ||
                txn.razorpayId?.toLowerCase().includes(q) ||
                txn.booking?.user?.name?.toLowerCase().includes(q) ||
                txn.booking?.user?.email?.toLowerCase().includes(q) ||
                txn.booking?.user?.phone?.toLowerCase().includes(q) ||
                txn.propertyDetails?.name?.toLowerCase().includes(q) ||
                txn.booking?.displayId?.toLowerCase().includes(q) ||
                txn.tenantId?.toLowerCase().includes(q) ||
                txn.propertyDetails?.displayId?.toLowerCase().includes(q)
            );
        });
    }, [transactions, search, typeFilter, statusFilter, methodFilter, dateFrom, dateTo]);

    const totalInflow = filtered.filter(t => Number(t.totalPaid) > 0).reduce((s, t) => s + Number(t.totalPaid || 0), 0);
    const totalGST = filtered.reduce((s, t) => s + Number(t.platformGst || 0), 0);
    const totalPlatformFees = filtered.reduce((s, t) => s + Number(t.platformFeeAmt || 0), 0);
    const totalTDS = filtered.reduce((s, t) => s + Number(t.tdsAmount || 0), 0);

    const csvHeaders = [
        { key: "txnType", label: "Type" },
        { key: "_date", label: "Date" },
        { key: "_bookingId", label: "Booking/RentPe ID" },
        { key: "tenantId", label: "Tenant ID" },
        { key: "_propName", label: "Property Name" },
        { key: "_propCity", label: "City" },
        { key: "_propId", label: "Property ID" },
        { key: "_userName", label: "User Name" },
        { key: "_userEmail", label: "User Email" },
        { key: "_userPhone", label: "User Phone" },
        { key: "_userId", label: "User ID" },
        { key: "_rentAmt", label: "Rent Amount" },
        { key: "_platFee", label: "Platform Fee" },
        { key: "_onbFee", label: "Onboarding Fee" },
        { key: "_gst", label: "GST" },
        { key: "_tds", label: "TDS" },
        { key: "_total", label: "Total Paid" },
        { key: "method", label: "Method" },
        { key: "status", label: "Status" },
        { key: "razorpayId", label: "Razorpay/Ref ID" },
    ];
    const csvRows = filtered.map(t => ({
        ...t,
        _date: fmtDate(t.date),
        _bookingId: t.booking?.displayId || "—",
        _propName: t.propertyDetails?.name || "—",
        _propCity: t.propertyDetails?.city || "—",
        _propId: t.propertyDetails?.displayId || "—",
        _userName: t.booking?.user?.name || "—",
        _userEmail: t.booking?.user?.email || "—",
        _userPhone: t.booking?.user?.phone || "—",
        _userId: t.booking?.user?.displayId || "—",
        _rentAmt: Number(t.rentAmount || 0),
        _platFee: t.txnType !== "PROPERTY_ONBOARDING" ? Number(t.platformFeeAmt || 0) : 0,
        _onbFee: t.txnType === "PROPERTY_ONBOARDING" ? Number(t.platformFeeAmt || 0) : 0,
        _gst: Number(t.platformGst || 0),
        _tds: Number(t.tdsAmount || 0),
        _total: Number(t.totalPaid || 0),
    }));

    const hasActiveFilter = !typeFilter.includes("ALL") || !statusFilter.includes("ALL") || !methodFilter.includes("ALL") || dateFrom || dateTo;

    return (
        <div className="space-y-5">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Inflows" value={fmtShort(totalInflow)} sub={`${filtered.length} records`} icon={TrendingUp} color="indigo" />
                <StatCard label="Platform Fees" value={fmtShort(totalPlatformFees)} icon={CreditCard} color="cyan" />
                <StatCard label="GST Collected" value={fmtShort(totalGST)} sub="18% on fees" icon={Receipt} color="amber" />
                <StatCard label="TDS Deducted" value={fmtShort(totalTDS)} sub="Sec 194-O" icon={IndianRupee} color="emerald" />
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input className="pl-9 w-full h-10 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-slate-400"
                        placeholder="Search by ID, Name, Phone, Property..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}
                    className={`rounded-xl flex items-center gap-2 ${hasActiveFilter ? "border-blue-400 text-blue-700 bg-blue-50" : ""}`}>
                    <Filter className="w-4 h-4" />{hasActiveFilter ? "Filters Active" : "Filters"}
                </Button>
                {hasActiveFilter && (
                    <Button variant="ghost" size="sm" onClick={() => { setTypeFilter(["ALL"]); setStatusFilter(["ALL"]); setMethodFilter(["ALL"]); setDateFrom(""); setDateTo(""); }}
                        className="text-xs text-slate-500 hover:text-red-500 rounded-xl flex items-center gap-1">
                        <X className="w-3 h-3" /> Clear
                    </Button>
                )}
                <div className="flex gap-2 ml-auto">
                    <Button variant="outline" size="sm" onClick={() => exportToCSV(csvRows, csvHeaders, "RentPe_CustomerTransactions")}
                        className="rounded-xl flex items-center gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                        <Download className="w-4 h-4" /> Excel
                    </Button>
                    <Button variant="outline" size="sm"
                        onClick={() => exportToPDF("Customer Transactions — Tab A", csvRows, csvHeaders, [
                            `Total Inflow: ${fmtShort(totalInflow)}`,
                            `Platform Fees: ${fmtShort(totalPlatformFees)}`,
                            `GST: ${fmtShort(totalGST)}`,
                            `TDS: ${fmtShort(totalTDS)}`,
                            `Records: ${filtered.length}`
                        ])}
                        className="rounded-xl flex items-center gap-2 border-red-300 text-red-600 hover:bg-red-50">
                        <FileText className="w-4 h-4" /> PDF
                    </Button>
                </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
                    <MultiSelectFilter label="Type" selected={typeFilter} onChange={setTypeFilter} options={[
                        { value: "TOKEN_PAYMENT", label: "🔐 Token Payment" },
                        { value: "RENT", label: "📄 Rent" },
                        { value: "DEPOSIT", label: "🔒 Deposit" },
                        { value: "PROPERTY_ONBOARDING", label: "🏢 Onboarding Fee" },
                        { value: "DAMAGE_RECOVERY", label: "⚡ Damage Recovery" },
                        { value: "PAYMENT", label: "💳 Other Payment" },
                    ]} />
                    <MultiSelectFilter label="Status" selected={statusFilter} onChange={setStatusFilter} options={[
                        { value: "SUCCESS", label: "Success" },
                        { value: "VERIFIED", label: "Verified" },
                        { value: "PENDING", label: "Pending" },
                        { value: "FAILED", label: "Failed" },
                        { value: "DUPLICATE", label: "Duplicate" },
                        { value: "REFUNDED", label: "Refunded" },
                    ]} />
                    <MultiSelectFilter label="Method" selected={methodFilter} onChange={setMethodFilter} options={[
                        { value: "RAZORPAY", label: "Razorpay" },
                        { value: "CASH", label: "Cash" },
                        { value: "UPI", label: "UPI" },
                        { value: "OFFLINE", label: "Offline" },
                    ]} />
                    <DateRangeFilter from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} />
                </div>
            )}

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left min-w-[1500px]">
                            <thead className="bg-gradient-to-r from-indigo-50 to-slate-50 border-b border-indigo-100 text-[11px] text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                                <tr>
                                    <th className="p-3.5 font-bold min-w-[130px]">Type & Date</th>
                                    <th className="p-3.5 font-bold min-w-[120px]">Flow</th>
                                    <th className="p-3.5 font-bold min-w-[130px]">RentPe ID</th>
                                    <th className="p-3.5 font-bold min-w-[120px]">Tenant ID</th>
                                    <th className="p-3.5 font-bold min-w-[180px]">Property Details</th>
                                    <th className="p-3.5 font-bold min-w-[180px]">User Details</th>
                                    <th className="p-3.5 font-bold min-w-[110px] text-right">Rent Amt</th>
                                    <th className="p-3.5 font-bold min-w-[110px] text-right">Plat. Fees</th>
                                    <th className="p-3.5 font-bold min-w-[130px] text-right">Onboarding Fee</th>
                                    <th className="p-3.5 font-bold min-w-[90px] text-right">GST</th>
                                    <th className="p-3.5 font-bold min-w-[90px] text-right">TDS</th>
                                    <th className="p-3.5 font-bold min-w-[120px] text-right">Total Paid</th>
                                    <th className="p-3.5 font-bold min-w-[140px]">Ref & Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan={13} className="p-10 text-center">
                                        <div className="flex items-center justify-center gap-3 text-slate-400">
                                            <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                                            Loading transactions...
                                        </div>
                                    </td></tr>
                                ) : filtered.length === 0 ? (
                                    <EmptyState message="No transactions found" />
                                ) : filtered.map(txn => (
                                    <tr key={txn.id} className="hover:bg-blue-50/40 transition-colors duration-100 group">
                                        <td className="p-3.5 align-top">
                                            <TypeBadge type={txn.txnType} label={txn.txnLabel?.replace(/^[^ ]+ /, "") || txn.txnType?.replace(/_/g, " ")} />
                                            <div className="text-xs text-slate-500 mt-1.5 font-medium">{fmtDate(txn.date)}</div>
                                            <div className="text-[10px] text-slate-400">{fmtTime(txn.date)}</div>
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <div className="flex items-center gap-1 text-[10px] font-bold bg-slate-50 px-2 py-1 rounded-lg w-fit">
                                                <span className={txn.source === "STUDENT" ? "text-indigo-600" : txn.source === "OWNER" ? "text-purple-600" : "text-slate-600"}>{txn.source}</span>
                                                <span className="text-slate-300">→</span>
                                                <span className={txn.destination === "PLATFORM" ? "text-slate-600" : txn.destination === "STUDENT" ? "text-indigo-600" : "text-purple-600"}>{txn.destination}</span>
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-mono mt-1 uppercase">{txn.method || "—"}</div>
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <div className="font-mono text-xs font-bold text-slate-700 leading-relaxed">{txn.booking?.displayId || "—"}</div>
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <div className="font-mono text-xs font-bold text-slate-700">{txn.tenantId || "—"}</div>
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <div className="font-semibold text-sm text-slate-800 truncate max-w-[170px]">{txn.propertyDetails?.name || "—"}</div>
                                            {txn.propertyDetails?.city && <div className="text-[10px] text-slate-400 mt-0.5">📍 {txn.propertyDetails.city}</div>}
                                            {txn.propertyDetails?.displayId && <div className="text-[10px] font-mono text-purple-500 font-bold mt-0.5">{txn.propertyDetails.displayId}</div>}
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <div className="font-semibold text-sm text-slate-800 truncate max-w-[170px]">{txn.booking?.user?.name || "—"}</div>
                                            {txn.booking?.user?.email && <div className="text-[10px] text-slate-400 truncate max-w-[170px] mt-0.5">{txn.booking.user.email}</div>}
                                            {txn.booking?.user?.phone && <div className="text-[10px] text-slate-400 mt-0.5">📞 {txn.booking.user.phone}</div>}
                                            {txn.booking?.user?.displayId && <div className="text-[10px] font-mono text-indigo-400 font-bold mt-0.5">{txn.booking.user.displayId}</div>}
                                        </td>
                                        <td className="p-3.5 align-top text-right">
                                            <div className="text-sm font-bold text-slate-700">{txn.rentAmount ? fmtShort(Math.abs(Number(txn.rentAmount))) : "—"}</div>
                                        </td>
                                        <td className="p-3.5 align-top text-right">
                                            <div className="text-sm font-medium text-slate-500">
                                                {txn.txnType !== "PROPERTY_ONBOARDING" && txn.platformFeeAmt ? fmtShort(Number(txn.platformFeeAmt)) : "—"}
                                            </div>
                                        </td>
                                        <td className="p-3.5 align-top text-right">
                                            <div className="text-sm font-medium text-purple-600">
                                                {txn.txnType === "PROPERTY_ONBOARDING" && txn.platformFeeAmt ? fmtShort(Number(txn.platformFeeAmt)) : "—"}
                                            </div>
                                        </td>
                                        <td className="p-3.5 align-top text-right">
                                            <div className="text-sm font-medium text-amber-600">{txn.platformGst ? fmtShort(Number(txn.platformGst)) : "—"}</div>
                                        </td>
                                        <td className="p-3.5 align-top text-right">
                                            <div className="text-sm font-medium text-emerald-600">{txn.tdsAmount ? fmtShort(Number(txn.tdsAmount)) : "—"}</div>
                                        </td>
                                        <td className="p-3.5 align-top text-right">
                                            <div className={`text-sm font-black ${Number(txn.totalPaid) < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                                                {Number(txn.totalPaid) < 0
                                                    ? `- ${fmtShort(Math.abs(Number(txn.totalPaid)))}`
                                                    : fmtShort(Number(txn.totalPaid))}
                                            </div>
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <div className="flex flex-col gap-1.5">
                                                <StatusBadge status={txn.status} />
                                                <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]" title={txn.id}>{txn.id?.slice(0, 12)}…</div>
                                                {txn.razorpayId && (
                                                    <div className="text-[10px] text-blue-500 font-mono font-bold truncate max-w-[120px]" title={txn.razorpayId}>{txn.razorpayId}</div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {!loading && filtered.length > 0 && (
                        <div className="px-4 py-3 border-t bg-slate-50 text-xs text-slate-500 flex items-center gap-2">
                            <span className="font-semibold text-slate-700">{filtered.length}</span> records shown
                            {filtered.length !== transactions.length && <span className="text-blue-600">(filtered from {transactions.length} total)</span>}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab B — Owner Payouts Log
// ─────────────────────────────────────────────────────────────────────────────

function TabB({ payouts, loading }: { payouts: any[]; loading: boolean }) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string[]>(["ALL"]);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [showFilters, setShowFilters] = useState(false);

    const filtered = useMemo(() => {
        return payouts.filter(p => {
            if (!statusFilter.includes("ALL") && !statusFilter.includes(p.status)) return false;
            if (dateFrom && p.date && new Date(p.date) < new Date(dateFrom)) return false;
            if (dateTo && p.date && new Date(p.date) > new Date(dateTo + "T23:59:59")) return false;
            const q = search.toLowerCase();
            if (!q) return true;
            return (
                p.displayId?.toLowerCase().includes(q) ||
                p.owner?.name?.toLowerCase().includes(q) ||
                p.owner?.email?.toLowerCase().includes(q) ||
                p.owner?.phone?.toLowerCase().includes(q) ||
                p.owner?.displayId?.toLowerCase().includes(q) ||
                p.property?.name?.toLowerCase().includes(q) ||
                p.property?.displayId?.toLowerCase().includes(q) ||
                p.txnReference?.toLowerCase().includes(q) ||
                p.period?.toLowerCase().includes(q)
            );
        });
    }, [payouts, search, statusFilter, dateFrom, dateTo]);

    const totalGross = filtered.reduce((s, p) => s + Number(p.grossAmount || 0), 0);
    const totalCommission = filtered.reduce((s, p) => s + Number(p.commissionAmount || 0), 0);
    const totalGSTOwner = filtered.reduce((s, p) => s + Number(p.gstOnOwnerFee || 0), 0);
    const totalNet = filtered.reduce((s, p) => s + Number(p.netAmount || 0), 0);

    const csvHeaders = [
        { key: "_date", label: "Payout Date" },
        { key: "displayId", label: "Payout ID" },
        { key: "type", label: "Type" },
        { key: "period", label: "Period" },
        { key: "_ownerName", label: "Owner Name" },
        { key: "_ownerEmail", label: "Owner Email" },
        { key: "_ownerPhone", label: "Owner Phone" },
        { key: "_ownerId", label: "Owner ID" },
        { key: "_propName", label: "Property Name" },
        { key: "_propCity", label: "City" },
        { key: "_propId", label: "Property ID" },
        { key: "grossAmount", label: "Gross Rent (₹)" },
        { key: "commissionAmount", label: "Commission (₹)" },
        { key: "gstOnOwnerFee", label: "GST on Commission (₹)" },
        { key: "tdsAmount", label: "TDS Deducted (₹)" },
        { key: "netAmount", label: "Net Transferred (₹)" },
        { key: "paymentMode", label: "Payment Mode" },
        { key: "txnReference", label: "UTR/Razorpay Ref" },
        { key: "status", label: "Status" },
        { key: "notes", label: "Notes" },
    ];
    const csvRows = filtered.map(p => ({
        ...p,
        _date: fmtDate(p.date),
        _ownerName: p.owner?.name || "—",
        _ownerEmail: p.owner?.email || "—",
        _ownerPhone: p.owner?.phone || "—",
        _ownerId: p.owner?.displayId || "—",
        _propName: p.property?.name || "—",
        _propCity: p.property?.city || "—",
        _propId: p.property?.displayId || "—",
    }));

    const hasActiveFilter = !statusFilter.includes("ALL") || dateFrom || dateTo;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Gross Paid" value={fmtShort(totalGross)} sub={`${filtered.length} payouts`} icon={TrendingUp} color="violet" />
                <StatCard label="Commission Retained" value={fmtShort(totalCommission)} icon={CreditCard} color="amber" />
                <StatCard label="GST on Commission" value={fmtShort(totalGSTOwner)} sub="18% collected" icon={Receipt} color="cyan" />
                <StatCard label="Net Paid to Owners" value={fmtShort(totalNet)} sub="After all deductions" icon={ArrowUpRight} color="rose" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input className="pl-9 w-full h-10 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent placeholder:text-slate-400"
                        placeholder="Search by Payout ID, Owner, Property, UTR..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}
                    className={`rounded-xl flex items-center gap-2 ${hasActiveFilter ? "border-violet-400 text-violet-700 bg-violet-50" : ""}`}>
                    <Filter className="w-4 h-4" />{hasActiveFilter ? "Filters Active" : "Filters"}
                </Button>
                {hasActiveFilter && (
                    <Button variant="ghost" size="sm" onClick={() => { setStatusFilter(["ALL"]); setDateFrom(""); setDateTo(""); }}
                        className="text-xs text-slate-500 hover:text-red-500 rounded-xl flex items-center gap-1">
                        <X className="w-3 h-3" /> Clear
                    </Button>
                )}
                <div className="flex gap-2 ml-auto">
                    <Button variant="outline" size="sm" onClick={() => exportToCSV(csvRows, csvHeaders, "RentPe_OwnerPayouts")}
                        className="rounded-xl flex items-center gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                        <Download className="w-4 h-4" /> Excel
                    </Button>
                    <Button variant="outline" size="sm"
                        onClick={() => exportToPDF("Owner Payouts Log — Tab B", csvRows, csvHeaders, [
                            `Gross: ${fmtShort(totalGross)}`,
                            `Commission: ${fmtShort(totalCommission)}`,
                            `GST: ${fmtShort(totalGSTOwner)}`,
                            `Net Paid: ${fmtShort(totalNet)}`,
                            `Records: ${filtered.length}`
                        ])}
                        className="rounded-xl flex items-center gap-2 border-red-300 text-red-600 hover:bg-red-50">
                        <FileText className="w-4 h-4" /> PDF
                    </Button>
                </div>
            </div>

            {showFilters && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
                    <MultiSelectFilter label="Status" selected={statusFilter} onChange={setStatusFilter} options={[
                        { value: "PENDING", label: "Pending" },
                        { value: "APPROVED", label: "Approved" },
                        { value: "PAID", label: "Paid" },
                    ]} />
                    <DateRangeFilter from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} />
                </div>
            )}

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left min-w-[1600px]">
                            <thead className="bg-gradient-to-r from-violet-50 to-slate-50 border-b border-violet-100 text-[11px] text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                                <tr>
                                    <th className="p-3.5 font-bold min-w-[120px]">Payout Date</th>
                                    <th className="p-3.5 font-bold min-w-[130px]">Payout ID</th>
                                    <th className="p-3.5 font-bold min-w-[120px]">Type</th>
                                    <th className="p-3.5 font-bold min-w-[110px]">Period</th>
                                    <th className="p-3.5 font-bold min-w-[180px]">Owner Details</th>
                                    <th className="p-3.5 font-bold min-w-[170px]">Property Details</th>
                                    <th className="p-3.5 font-bold min-w-[120px] text-right">Gross Rent ➕</th>
                                    <th className="p-3.5 font-bold min-w-[130px] text-right">Commission ➖</th>
                                    <th className="p-3.5 font-bold min-w-[140px] text-right">GST on Comm ➖</th>
                                    <th className="p-3.5 font-bold min-w-[120px] text-right">TDS ➖</th>
                                    <th className="p-3.5 font-bold min-w-[130px] text-right">Net Transferred</th>
                                    <th className="p-3.5 font-bold min-w-[130px]">UTR / Ref</th>
                                    <th className="p-3.5 font-bold min-w-[100px]">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan={13} className="p-10 text-center">
                                        <div className="flex items-center justify-center gap-3 text-slate-400">
                                            <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                                            Loading payouts...
                                        </div>
                                    </td></tr>
                                ) : filtered.length === 0 ? (
                                    <EmptyState message="No owner payouts found" />
                                ) : filtered.map(p => (
                                    <tr key={p.id} className="hover:bg-blue-50/40 transition-colors duration-100">
                                        <td className="p-3.5 align-top">
                                            <div className="text-xs font-semibold text-slate-700">{fmtDate(p.date)}</div>
                                            <div className="text-[10px] text-slate-400">{fmtTime(p.date)}</div>
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <div className="font-mono text-xs font-bold text-violet-700">{p.displayId || "—"}</div>
                                            {p.paymentMode && <div className="text-[10px] text-slate-400 mt-0.5 uppercase">{p.paymentMode}</div>}
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <TypeBadge type={p.type || "RENT_SETTLEMENT"} />
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <div className="text-xs font-semibold text-slate-700">{p.period || "—"}</div>
                                            {p.bookingCount > 0 && <div className="text-[10px] text-slate-400 mt-0.5">{p.bookingCount} bookings</div>}
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <div className="font-semibold text-sm text-slate-800 truncate max-w-[170px]">{p.owner?.name || "—"}</div>
                                            {p.owner?.email && <div className="text-[10px] text-slate-400 truncate max-w-[170px] mt-0.5">{p.owner.email}</div>}
                                            {p.owner?.phone && <div className="text-[10px] text-slate-400 mt-0.5">📞 {p.owner.phone}</div>}
                                            {p.owner?.displayId && <div className="text-[10px] font-mono text-purple-500 font-bold mt-0.5">{p.owner.displayId}</div>}
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <div className="font-semibold text-sm text-slate-800 truncate max-w-[160px]">{p.property?.name || "—"}</div>
                                            {p.property?.city && <div className="text-[10px] text-slate-400 mt-0.5">📍 {p.property.city}</div>}
                                            {p.property?.displayId && <div className="text-[10px] font-mono text-violet-500 font-bold mt-0.5">{p.property.displayId}</div>}
                                        </td>
                                        <td className="p-3.5 align-top text-right">
                                            <div className="text-sm font-bold text-emerald-700">{fmt(p.grossAmount)}</div>
                                        </td>
                                        <td className="p-3.5 align-top text-right">
                                            <div className="text-sm font-medium text-rose-600">- {fmt(p.commissionAmount)}</div>
                                        </td>
                                        <td className="p-3.5 align-top text-right">
                                            <div className="text-sm font-medium text-amber-600">- {fmt(p.gstOnOwnerFee || 0)}</div>
                                        </td>
                                        <td className="p-3.5 align-top text-right">
                                            <div className="text-sm font-medium text-orange-600">- {fmt(p.tdsAmount || 0)}</div>
                                        </td>
                                        <td className="p-3.5 align-top text-right">
                                            <div className="text-base font-black text-rose-700">- {fmt(p.netAmount)}</div>
                                        </td>
                                        <td className="p-3.5 align-top">
                                            {p.txnReference
                                                ? <div className="text-[10px] font-mono text-blue-600 font-bold break-all">{p.txnReference}</div>
                                                : <div className="text-[10px] text-slate-400">—</div>
                                            }
                                            {p.notes && <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">{p.notes}</div>}
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <StatusBadge status={p.status} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {!loading && filtered.length > 0 && (
                        <div className="px-4 py-3 border-t bg-slate-50 text-xs text-slate-500 flex items-center gap-2">
                            <span className="font-semibold text-slate-700">{filtered.length}</span> records shown
                            {filtered.length !== payouts.length && <span className="text-violet-600">(filtered from {payouts.length} total)</span>}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab C — Refunds Log
// ─────────────────────────────────────────────────────────────────────────────

function TabC({ refunds, loading }: { refunds: any[]; loading: boolean }) {
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<string[]>(["ALL"]);
    const [recipientFilter, setRecipientFilter] = useState<string[]>(["ALL"]);
    const [methodFilter, setMethodFilter] = useState<string[]>(["ALL"]);
    const [statusFilter, setStatusFilter] = useState<string[]>(["ALL"]);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [showFilters, setShowFilters] = useState(false);

    const filtered = useMemo(() => {
        return refunds.filter(r => {
            if (!typeFilter.includes("ALL") && !typeFilter.includes(r.type)) return false;
            if (!recipientFilter.includes("ALL") && !recipientFilter.includes(r.recipientType)) return false;
            if (!methodFilter.includes("ALL") && !methodFilter.includes(r.method?.toUpperCase())) return false;
            if (!statusFilter.includes("ALL") && !statusFilter.includes(r.status?.toUpperCase())) return false;
            if (dateFrom && r.date && new Date(r.date) < new Date(dateFrom)) return false;
            if (dateTo && r.date && new Date(r.date) > new Date(dateTo + "T23:59:59")) return false;
            const q = search.toLowerCase();
            if (!q) return true;
            return (
                r.displayId?.toLowerCase().includes(q) ||
                r.bookingDisplayId?.toLowerCase().includes(q) ||
                r.tenantId?.toLowerCase().includes(q) ||
                r.recipient?.name?.toLowerCase().includes(q) ||
                r.recipient?.email?.toLowerCase().includes(q) ||
                r.recipient?.phone?.toLowerCase().includes(q) ||
                r.property?.name?.toLowerCase().includes(q) ||
                r.txnReference?.toLowerCase().includes(q) ||
                r.creditNoteId?.toLowerCase().includes(q)
            );
        });
    }, [refunds, search, typeFilter, recipientFilter, methodFilter, statusFilter, dateFrom, dateTo]);

    const totalRefunded = filtered.reduce((s, r) => s + Number(r.netRefunded || 0), 0);
    const totalOnline = filtered.filter(r => r.method !== "OFFLINE").reduce((s, r) => s + Number(r.netRefunded || 0), 0);
    const totalOffline = filtered.filter(r => r.method === "OFFLINE").reduce((s, r) => s + Number(r.netRefunded || 0), 0);
    const totalGSTReversed = filtered.reduce((s, r) => s + Number(r.gstRefunded || 0), 0);

    const csvHeaders = [
        { key: "_date", label: "Refund Date" },
        { key: "displayId", label: "Refund ID" },
        { key: "type", label: "Refund Type" },
        { key: "recipientType", label: "Recipient Type" },
        { key: "_recipientName", label: "Recipient Name" },
        { key: "_recipientEmail", label: "Recipient Email" },
        { key: "_recipientPhone", label: "Recipient Phone" },
        { key: "_recipientId", label: "Recipient ID" },
        { key: "_propName", label: "Property Name" },
        { key: "_propCity", label: "City" },
        { key: "bookingDisplayId", label: "Booking ID" },
        { key: "tenantId", label: "Tenant ID" },
        { key: "amount", label: "Gross Refund (₹)" },
        { key: "platformFeeRefunded", label: "Platform Fee Reversed (₹)" },
        { key: "gstRefunded", label: "GST Reversed (₹)" },
        { key: "netRefunded", label: "Net Refunded (₹)" },
        { key: "method", label: "Method" },
        { key: "txnReference", label: "Razorpay/UTR Ref" },
        { key: "creditNoteId", label: "Credit Note ID" },
        { key: "status", label: "Status" },
        { key: "reason", label: "Reason" },
        { key: "notes", label: "Notes" },
    ];
    const csvRows = filtered.map(r => ({
        ...r,
        _date: fmtDate(r.date),
        _recipientName: r.recipient?.name || "—",
        _recipientEmail: r.recipient?.email || "—",
        _recipientPhone: r.recipient?.phone || "—",
        _recipientId: r.recipient?.displayId || "—",
        _propName: r.property?.name || "—",
        _propCity: r.property?.city || "—",
    }));

    const hasActiveFilter = !typeFilter.includes("ALL") || !recipientFilter.includes("ALL") || !methodFilter.includes("ALL") || !statusFilter.includes("ALL") || dateFrom || dateTo;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Refunded" value={fmtShort(totalRefunded)} sub={`${filtered.length} refunds`} icon={TrendingDown} color="rose" />
                <StatCard label="Online Refunds" value={fmtShort(totalOnline)} sub="via Razorpay" icon={CreditCard} color="indigo" />
                <StatCard label="Offline Refunds" value={fmtShort(totalOffline)} sub="Direct / Cash" icon={ArrowDownLeft} color="amber" />
                <StatCard label="GST Reversed" value={fmtShort(totalGSTReversed)} sub="Credit Notes" icon={Receipt} color="emerald" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input className="pl-9 w-full h-10 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent placeholder:text-slate-400"
                        placeholder="Search by ID, Name, Booking ID, UTR..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}
                    className={`rounded-xl flex items-center gap-2 ${hasActiveFilter ? "border-rose-400 text-rose-700 bg-rose-50" : ""}`}>
                    <Filter className="w-4 h-4" />{hasActiveFilter ? "Filters Active" : "Filters"}
                </Button>
                {hasActiveFilter && (
                    <Button variant="ghost" size="sm" onClick={() => { setTypeFilter(["ALL"]); setRecipientFilter(["ALL"]); setMethodFilter(["ALL"]); setStatusFilter(["ALL"]); setDateFrom(""); setDateTo(""); }}
                        className="text-xs text-slate-500 hover:text-red-500 rounded-xl flex items-center gap-1">
                        <X className="w-3 h-3" /> Clear
                    </Button>
                )}
                <div className="flex gap-2 ml-auto">
                    <Button variant="outline" size="sm" onClick={() => exportToCSV(csvRows, csvHeaders, "RentPe_Refunds")}
                        className="rounded-xl flex items-center gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                        <Download className="w-4 h-4" /> Excel
                    </Button>
                    <Button variant="outline" size="sm"
                        onClick={() => exportToPDF("Refunds Log — Tab C", csvRows, csvHeaders, [
                            `Total Refunded: ${fmtShort(totalRefunded)}`,
                            `Online: ${fmtShort(totalOnline)}`,
                            `Offline: ${fmtShort(totalOffline)}`,
                            `GST Reversed: ${fmtShort(totalGSTReversed)}`,
                            `Records: ${filtered.length}`
                        ])}
                        className="rounded-xl flex items-center gap-2 border-red-300 text-red-600 hover:bg-red-50">
                        <FileText className="w-4 h-4" /> PDF
                    </Button>
                </div>
            </div>

            {showFilters && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
                    <MultiSelectFilter label="Type" selected={typeFilter} onChange={setTypeFilter} options={[
                        { value: "CANCELLATION_REFUND", label: "Cancellation Refund" },
                        { value: "DAMAGE_RECOVERY_REFUND", label: "Damage Recovery Refund" },
                        { value: "DUPLICATE_REFUND", label: "Duplicate Refund" },
                        { value: "OFFLINE_SETTLEMENT", label: "Offline Settlement" },
                        { value: "ONBOARDING_REFUND", label: "Onboarding Fee Refund" },
                    ]} />
                    <MultiSelectFilter label="Recipient" selected={recipientFilter} onChange={setRecipientFilter} options={[
                        { value: "STUDENT", label: "Student" },
                        { value: "OWNER", label: "Owner" },
                    ]} />
                    <MultiSelectFilter label="Method" selected={methodFilter} onChange={setMethodFilter} options={[
                        { value: "RAZORPAY", label: "Razorpay" },
                        { value: "OFFLINE", label: "Offline / Cash" },
                        { value: "BANK_TRANSFER", label: "Bank Transfer" },
                    ]} />
                    <MultiSelectFilter label="Status" selected={statusFilter} onChange={setStatusFilter} options={[
                        { value: "PROCESSED", label: "Processed" },
                        { value: "PENDING", label: "Pending" },
                        { value: "REJECTED", label: "Rejected" },
                    ]} />
                    <DateRangeFilter from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} />
                </div>
            )}

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left min-w-[1600px]">
                            <thead className="bg-gradient-to-r from-rose-50 to-slate-50 border-b border-rose-100 text-[11px] text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                                <tr>
                                    <th className="p-3.5 font-bold min-w-[120px]">Refund Date</th>
                                    <th className="p-3.5 font-bold min-w-[140px]">Refund ID</th>
                                    <th className="p-3.5 font-bold min-w-[160px]">Type</th>
                                    <th className="p-3.5 font-bold min-w-[100px]">Recipient</th>
                                    <th className="p-3.5 font-bold min-w-[180px]">Recipient Details</th>
                                    <th className="p-3.5 font-bold min-w-[170px]">Property Details</th>
                                    <th className="p-3.5 font-bold min-w-[120px]">Booking ID</th>
                                    <th className="p-3.5 font-bold min-w-[110px] text-right">Gross Refund</th>
                                    <th className="p-3.5 font-bold min-w-[130px] text-right">Fee Reversed</th>
                                    <th className="p-3.5 font-bold min-w-[120px] text-right">GST Reversed</th>
                                    <th className="p-3.5 font-bold min-w-[120px] text-right">Net Refunded</th>
                                    <th className="p-3.5 font-bold min-w-[100px]">Method</th>
                                    <th className="p-3.5 font-bold min-w-[130px]">UTR / Razorpay Ref</th>
                                    <th className="p-3.5 font-bold min-w-[100px]">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan={14} className="p-10 text-center">
                                        <div className="flex items-center justify-center gap-3 text-slate-400">
                                            <div className="w-6 h-6 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                                            Loading refunds...
                                        </div>
                                    </td></tr>
                                ) : filtered.length === 0 ? (
                                    <EmptyState message="No refunds found" />
                                ) : filtered.map(r => (
                                    <tr key={r.id} className="hover:bg-blue-50/40 transition-colors duration-100">
                                        <td className="p-3.5 align-top">
                                            <div className="text-xs font-semibold text-slate-700">{fmtDate(r.date)}</div>
                                            <div className="text-[10px] text-slate-400">{fmtTime(r.date)}</div>
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <div className="font-mono text-xs font-bold text-rose-700 break-all">{r.displayId || r.id?.slice(0, 16) || "—"}</div>
                                            {r.creditNoteId && <div className="text-[10px] text-amber-600 font-mono font-bold mt-0.5">CN: {r.creditNoteId}</div>}
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <TypeBadge type={r.type || "CANCELLATION_REFUND"} />
                                            {r.reason && <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">{r.reason}</div>}
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                r.recipientType === "OWNER" ? "bg-purple-100 text-purple-700" : "bg-indigo-100 text-indigo-700"
                                            }`}>{r.recipientType || "STUDENT"}</span>
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <div className="font-semibold text-sm text-slate-800 truncate max-w-[170px]">{r.recipient?.name || "—"}</div>
                                            {r.recipient?.email && <div className="text-[10px] text-slate-400 truncate max-w-[170px] mt-0.5">{r.recipient.email}</div>}
                                            {r.recipient?.phone && <div className="text-[10px] text-slate-400 mt-0.5">📞 {r.recipient.phone}</div>}
                                            {r.recipient?.displayId && <div className="text-[10px] font-mono text-indigo-400 font-bold mt-0.5">{r.recipient.displayId}</div>}
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <div className="font-semibold text-sm text-slate-800 truncate max-w-[160px]">{r.property?.name || "—"}</div>
                                            {r.property?.city && <div className="text-[10px] text-slate-400 mt-0.5">📍 {r.property.city}</div>}
                                            {r.property?.displayId && <div className="text-[10px] font-mono text-violet-500 font-bold mt-0.5">{r.property.displayId}</div>}
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <div className="font-mono text-xs font-bold text-slate-700">{r.bookingDisplayId || "—"}</div>
                                            {r.tenantId && <div className="text-[10px] font-mono text-slate-400 mt-0.5">{r.tenantId}</div>}
                                        </td>
                                        <td className="p-3.5 align-top text-right">
                                            <div className="text-sm font-bold text-rose-600">- {fmt(r.amount)}</div>
                                        </td>
                                        <td className="p-3.5 align-top text-right">
                                            <div className="text-sm font-medium text-slate-500">{r.platformFeeRefunded ? `- ${fmt(r.platformFeeRefunded)}` : "—"}</div>
                                        </td>
                                        <td className="p-3.5 align-top text-right">
                                            <div className="text-sm font-medium text-amber-600">{r.gstRefunded ? `- ${fmt(r.gstRefunded)}` : "—"}</div>
                                        </td>
                                        <td className="p-3.5 align-top text-right">
                                            <div className="text-base font-black text-rose-700">- {fmt(r.netRefunded)}</div>
                                            {r.method === "OFFLINE" && (
                                                <div className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase">Offline — No bank impact</div>
                                            )}
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                r.method === "OFFLINE" ? "bg-slate-100 text-slate-600" : "bg-blue-100 text-blue-700"
                                            }`}>{r.method || "—"}</span>
                                        </td>
                                        <td className="p-3.5 align-top">
                                            {r.txnReference
                                                ? <div className="text-[10px] font-mono text-blue-600 font-bold break-all">{r.txnReference}</div>
                                                : <div className="text-[10px] text-slate-400">—</div>
                                            }
                                        </td>
                                        <td className="p-3.5 align-top">
                                            <StatusBadge status={r.status || "PROCESSED"} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {!loading && filtered.length > 0 && (
                        <div className="px-4 py-3 border-t bg-slate-50 text-xs text-slate-500 flex items-center gap-2">
                            <span className="font-semibold text-slate-700">{filtered.length}</span> records shown
                            {filtered.length !== refunds.length && <span className="text-rose-600">(filtered from {refunds.length} total)</span>}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
    {
        id: "A",
        label: "Customer Transactions",
        emoji: "📥",
        desc: "All inflows: Rent, Deposits, Tokens, Onboarding",
        activeClass: "border-indigo-600 text-indigo-700 bg-indigo-50",
        hoverClass: "hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/60",
    },
    {
        id: "B",
        label: "Owner Payouts Log",
        emoji: "🏦",
        desc: "Monthly settlements paid to property owners",
        activeClass: "border-violet-600 text-violet-700 bg-violet-50",
        hoverClass: "hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50/60",
    },
    {
        id: "C",
        label: "Refunds Log",
        emoji: "↩️",
        desc: "All refunds — Students & Owners, Online & Offline",
        activeClass: "border-rose-600 text-rose-700 bg-rose-50",
        hoverClass: "hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/60",
    },
];

export default function AdminTransactionsPage() {
    const [activeTab, setActiveTab] = useState<"A" | "B" | "C">("A");
    const [transactions, setTransactions] = useState<any[]>([]);
    const [payouts, setPayouts] = useState<any[]>([]);
    const [refunds, setRefunds] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getTransactions() as any;
            // Support both old (array) and new ({ transactions, payouts, refunds }) return shapes
            if (Array.isArray(data)) {
                setTransactions(data);
                setPayouts([]);
                setRefunds([]);
            } else {
                setTransactions(data?.transactions || []);
                setPayouts(data?.payouts || []);
                setRefunds(data?.refunds || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const activeTabMeta = TABS.find(t => t.id === activeTab)!;

    return (
        <div className="space-y-6 pb-10">
            {/* Page header */}
            <div className="flex justify-between items-start flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Global Transactions</h1>
                    <p className="text-slate-500 mt-1 text-sm">Complete financial ledger — inflows, owner payouts, and refunds across the platform.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}
                    className="rounded-xl flex items-center gap-2">
                    <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-0 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                {TABS.map((tab, i) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as "A" | "B" | "C")}
                        className={`flex-1 flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-2.5 px-5 py-4 text-left transition-all duration-200 border-b-2 
                            ${activeTab === tab.id
                                ? `${tab.activeClass} border-b-[3px]`
                                : `border-b-transparent text-slate-500 ${tab.hoverClass}`
                            }
                            ${i > 0 ? "border-l border-slate-100" : ""}
                        `}
                    >
                        <span className="text-xl flex-shrink-0 mt-0.5">{tab.emoji}</span>
                        <div>
                            <div className={`text-sm font-bold ${activeTab === tab.id ? "" : "text-slate-700"}`}>
                                Tab {tab.id}: {tab.label}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 hidden sm:block">{tab.desc}</div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="transition-all duration-200">
                {activeTab === "A" && <TabA transactions={transactions} loading={loading} />}
                {activeTab === "B" && <TabB payouts={payouts} loading={loading} />}
                {activeTab === "C" && <TabC refunds={refunds} loading={loading} />}
            </div>
        </div>
    );
}
