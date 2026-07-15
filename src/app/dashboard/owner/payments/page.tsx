'use client';

import { useState, useEffect, useCallback } from 'react';
import { RentCollectionContainer } from '@/components/dashboard/RentCollectionContainer';
import {
    getOwnerPayoutsForOwner,
    getOwnerRefundsForOwner,
} from '@/actions/ownerRentCollection';
import {
    IndianRupee, TrendingUp, TrendingDown, ReceiptText,
    BanknoteIcon, RefreshCw, Copy, Check, Download,
    ArrowDownLeft, AlertTriangle, Clock, ShieldCheck,
    FileText, Loader2, Activity
} from 'lucide-react';

function getCurrentMonth() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
    return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtShort(n: number) {
    return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}
function fmtDate(d: any) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, gradient }: {
    label: string; value: string; sub?: string;
    icon: any; gradient: string;
}) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-3 hover:shadow-md transition-all duration-200 group">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-200`}>
                <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
                <p className="text-lg font-black text-slate-900 tabular-nums">{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ─── Copy Button ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };
    return (
        <button
            onClick={copy}
            title={`Copy: ${text}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-violet-100 text-slate-500 hover:text-violet-700 transition-all"
        >
            {copied ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
            {copied ? 'Copied' : 'Copy'}
        </button>
    );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
        APPROVED: 'bg-blue-100 text-blue-800 border-blue-200',
        PAID: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        PROCESSED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        REJECTED: 'bg-red-100 text-red-800 border-red-200',
    };
    return (
        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide border ${map[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            {status}
        </span>
    );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ message, icon: Icon }: { message: string; icon: any }) {
    return (
        <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Icon className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-400">{message}</p>
            <p className="text-xs text-slate-300 mt-1">No records found for your properties.</p>
        </div>
    );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────
function SkeletonRows({ color, cols }: { color: string; cols: number }) {
    return (
        <>
            {[...Array(5)].map((_, i) => (
                <tr key={i}>
                    {[...Array(cols)].map((_, j) => (
                        <td key={j} className="p-3.5">
                            <div className={`h-5 ${color} animate-pulse rounded-lg`} style={{ width: `${60 + (j * 7) % 35}%` }} />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: Payouts & Invoices
// ─────────────────────────────────────────────────────────────────────────────
function PayoutsTab({ month }: { month: string }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getOwnerPayoutsForOwner(month);
            setData(res);
        } catch (e: any) {
            setError(e.message || 'Failed to load payouts');
        } finally {
            setLoading(false);
        }
    }, [month]);

    useEffect(() => { load(); }, [load]);

    const payouts: any[] = data?.payouts ?? [];
    const stats = data?.stats ?? {};

    return (
        <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Gross Rent Collected" value={fmtShort(stats.totalGross ?? 0)} sub={`For ${new Date(month + "-01").toLocaleString("en-IN", { month: "long", year: "numeric" })}`} icon={TrendingUp} gradient="from-violet-600 to-violet-800" />
                <StatCard label="Platform Commission" value={fmtShort(stats.totalCommission ?? 0)} sub="Incl. GST (18%)" icon={ReceiptText} gradient="from-amber-500 to-orange-600" />
                <StatCard label="Net Paid to Bank" value={fmtShort(stats.totalNet ?? 0)} sub="After commission & TDS" icon={BanknoteIcon} gradient="from-emerald-500 to-emerald-700" />
                <StatCard label="Pending Payouts" value={fmtShort(stats.pendingNet ?? 0)} sub="Awaiting processing" icon={Clock} gradient="from-rose-500 to-red-700" />
            </div>

            {/* CA Advisory Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-xs font-black text-amber-800">CA & Tax Advisory</p>
                    <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                        Declare the <strong>Gross Rent</strong> as rental income in your ITR — NOT the net payout. The platform commission is your allowable business expense. TDS deducted (u/s 194-O) is visible in your Form 26AS and can be claimed as prepaid tax.
                    </p>
                </div>
            </div>

            {/* Header row */}
            <div className="flex items-center justify-between">
                <p className="text-sm font-black text-slate-700">{payouts.length} Payout Records</p>
                <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 transition-all">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 font-bold">{error}</div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[1100px]">
                        <thead className="bg-gradient-to-r from-violet-50 to-slate-50 border-b border-violet-100 text-[11px] text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                            <tr>
                                <th className="p-3.5 font-bold min-w-[120px]">Settlement Date</th>
                                <th className="p-3.5 font-bold min-w-[120px]">Payout ID</th>
                                <th className="p-3.5 font-bold min-w-[130px]">Property</th>
                                <th className="p-3.5 font-bold min-w-[90px]">Period</th>
                                <th className="p-3.5 font-bold min-w-[110px] text-right">Gross Rent ➕</th>
                                <th className="p-3.5 font-bold min-w-[130px] text-right">Commission ➖</th>
                                <th className="p-3.5 font-bold min-w-[90px] text-right">TDS ➖</th>
                                <th className="p-3.5 font-bold min-w-[120px] text-right">Net to Bank ✅</th>
                                <th className="p-3.5 font-bold min-w-[140px]">UTR / Ref</th>
                                <th className="p-3.5 font-bold min-w-[90px]">Status</th>
                                <th className="p-3.5 font-bold min-w-[80px]">Invoice</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={11} className="p-0"><table className="w-full"><tbody><SkeletonRows color="bg-violet-50" cols={11} /></tbody></table></td></tr>
                            ) : payouts.length === 0 ? (
                                <tr><td colSpan={11}><EmptyState message="No payouts found yet" icon={BanknoteIcon} /></td></tr>
                            ) : payouts.map((p: any) => (
                                <tr key={p.id} className="hover:bg-violet-50/30 transition-colors duration-100 group">
                                    <td className="p-3.5 align-top">
                                        <div className="text-xs font-bold text-slate-800">{fmtDate(p.paidAt ?? p.createdAt)}</div>
                                        {p.scheduledFor && <div className="text-[10px] text-slate-400 mt-0.5">Scheduled: {fmtDate(p.scheduledFor)}</div>}
                                    </td>
                                    <td className="p-3.5 align-top">
                                        <div className="font-mono text-xs font-bold text-violet-700">{p.displayId}</div>
                                    </td>
                                    <td className="p-3.5 align-top">
                                        <div className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">{p.propertyName}</div>
                                    </td>
                                    <td className="p-3.5 align-top">
                                        <div className="text-xs font-mono text-slate-600">{p.period || '—'}</div>
                                    </td>
                                    <td className="p-3.5 align-top text-right tabular-nums">
                                        <div className="text-sm font-bold text-slate-800">{fmt(p.grossAmount)}</div>
                                    </td>
                                    <td className="p-3.5 align-top text-right tabular-nums">
                                        <div className="text-sm font-bold text-rose-600">- {fmt(p.commissionAmount)}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">Base: {fmt(p.commissionBase)}</div>
                                        <div className="text-[10px] text-slate-400">CGST: {fmt(p.cgst)} · SGST: {fmt(p.sgst)}</div>
                                    </td>
                                    <td className="p-3.5 align-top text-right tabular-nums">
                                        {p.tdsAmount > 0
                                            ? <div className="text-sm font-bold text-amber-600">- {fmt(p.tdsAmount)}</div>
                                            : <div className="text-sm text-slate-300">—</div>}
                                    </td>
                                    <td className="p-3.5 align-top text-right tabular-nums">
                                        <div className="text-sm font-black text-emerald-700">{fmt(p.netAmount)}</div>
                                    </td>
                                    <td className="p-3.5 align-top">
                                        {p.txnReference ? (
                                            <div className="flex flex-col gap-1">
                                                <span className="font-mono text-[10px] text-slate-700 truncate max-w-[120px]">{p.txnReference}</span>
                                                <CopyButton text={p.txnReference} />
                                            </div>
                                        ) : <span className="text-slate-300 text-xs">—</span>}
                                    </td>
                                    <td className="p-3.5 align-top">
                                        <StatusBadge status={p.status} />
                                    </td>
                                    <td className="p-3.5 align-top">
                                        <a
                                            href={`/api/receipts/${p.id}?download=1`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-black bg-violet-600 hover:bg-violet-700 text-white transition-all shadow-sm shadow-violet-600/20 hover:shadow-md"
                                        >
                                            <FileText className="w-3 h-3" /> PDF
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!loading && payouts.length > 0 && (
                    <div className="px-4 py-3 border-t bg-slate-50 text-xs text-slate-500 flex items-center gap-2">
                        <span className="font-semibold text-slate-700">{payouts.length}</span> payout records loaded
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: Refunds & Tenant Adjustments
// ─────────────────────────────────────────────────────────────────────────────
function RefundsTab({ month }: { month: string }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getOwnerRefundsForOwner(month);
            setData(res);
        } catch (e: any) {
            setError(e.message || 'Failed to load refunds');
        } finally {
            setLoading(false);
        }
    }, [month]);

    useEffect(() => { load(); }, [load]);

    const refunds: any[] = data?.refunds ?? [];
    const stats = data?.stats ?? {};

    return (
        <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatCard label="Total Refunded" value={fmtShort(stats.totalRefunded ?? 0)} sub={`For ${new Date(month + "-01").toLocaleString("en-IN", { month: "long", year: "numeric" })}`} icon={TrendingDown} gradient="from-rose-500 to-red-700" />
                <StatCard label="Pending Refunds" value={`${stats.pendingCount ?? 0} Requests`} sub="Awaiting admin action" icon={Clock} gradient="from-amber-500 to-orange-600" />
            </div>

            {/* Header row */}
            <div className="flex items-center justify-between">
                <p className="text-sm font-black text-slate-700">{refunds.length} Refund Records</p>
                <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 font-bold">{error}</div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[1000px]">
                        <thead className="bg-gradient-to-r from-rose-50 to-slate-50 border-b border-rose-100 text-[11px] text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                            <tr>
                                <th className="p-3.5 font-bold min-w-[120px]">Refund ID</th>
                                <th className="p-3.5 font-bold min-w-[130px]">Tenant & Room</th>
                                <th className="p-3.5 font-bold min-w-[130px]">Property</th>
                                <th className="p-3.5 font-bold min-w-[100px]">Type</th>
                                <th className="p-3.5 font-bold min-w-[90px]">Initiated</th>
                                <th className="p-3.5 font-bold min-w-[90px]">Resolved</th>
                                <th className="p-3.5 font-bold min-w-[100px] text-right">Amount</th>
                                <th className="p-3.5 font-bold min-w-[90px]">TAT</th>
                                <th className="p-3.5 font-bold min-w-[100px]">Status</th>
                                <th className="p-3.5 font-bold min-w-[110px]">UTR Ref</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={10} className="p-0"><table className="w-full"><tbody><SkeletonRows color="bg-rose-50" cols={10} /></tbody></table></td></tr>
                            ) : refunds.length === 0 ? (
                                <tr><td colSpan={10}><EmptyState message="No refunds found" icon={ArrowDownLeft} /></td></tr>
                            ) : refunds.map((r: any) => (
                                <tr key={r.id} className={`transition-colors duration-100 group ${r.isSlaBreached ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-rose-50/30'}`}>
                                    <td className="p-3.5 align-top">
                                        <div className="font-mono text-[10px] font-bold text-rose-700">{r.displayId || r.id.slice(0, 12)}</div>
                                        <div className="font-mono text-[9px] text-slate-400 mt-0.5">{r.bookingDisplayId}</div>
                                    </td>
                                    <td className="p-3.5 align-top">
                                        <div className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">{r.tenantName}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">Room: {r.roomNumber}</div>
                                    </td>
                                    <td className="p-3.5 align-top">
                                        <div className="text-xs font-semibold text-slate-700 truncate max-w-[120px]">{r.propertyName}</div>
                                    </td>
                                    <td className="p-3.5 align-top">
                                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-700 uppercase">{r.refundType}</span>
                                        <div className="text-[9px] text-slate-400 mt-1 max-w-[90px] truncate" title={r.reason}>{r.reason}</div>
                                    </td>
                                    <td className="p-3.5 align-top">
                                        <div className="text-xs font-medium text-slate-700">{fmtDate(r.initiatedAt)}</div>
                                    </td>
                                    <td className="p-3.5 align-top">
                                        <div className="text-xs font-medium text-slate-700">{r.processedAt ? fmtDate(r.processedAt) : '—'}</div>
                                    </td>
                                    <td className="p-3.5 align-top text-right tabular-nums">
                                        <div className="text-sm font-black text-rose-600">{fmt(r.amount)}</div>
                                        {r.platformFeeRefunded > 0 && (
                                            <div className="text-[9px] text-slate-400 mt-0.5">+ Plat Fee: {fmt(r.platformFeeRefunded)}</div>
                                        )}
                                    </td>
                                    <td className="p-3.5 align-top">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black border ${r.isSlaBreached
                                            ? 'bg-red-100 text-red-700 border-red-300'
                                            : r.tatDays <= 3
                                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                                : 'bg-amber-100 text-amber-700 border-amber-200'
                                            }`}>
                                            {r.isSlaBreached && <AlertTriangle className="w-2.5 h-2.5" />}
                                            {r.tatDays}d {r.isSlaBreached ? 'Breached' : r.status === 'PROCESSED' ? 'Resolved' : 'Pending'}
                                        </span>
                                    </td>
                                    <td className="p-3.5 align-top">
                                        <StatusBadge status={r.status} />
                                    </td>
                                    <td className="p-3.5 align-top">
                                        {r.txnReference ? (
                                            <div className="flex flex-col gap-1">
                                                <span className="font-mono text-[10px] text-slate-700 truncate max-w-[100px]">{r.txnReference}</span>
                                                <CopyButton text={r.txnReference} />
                                            </div>
                                        ) : <span className="text-slate-300 text-xs">—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!loading && refunds.length > 0 && (
                    <div className="px-4 py-3 border-t bg-slate-50 text-xs text-slate-500 flex items-center gap-2">
                        <span className="font-semibold text-slate-700">{refunds.length}</span> refund records loaded
                        {stats.breachedCount > 0 && (
                            <span className="ml-2 px-2 py-0.5 rounded-lg bg-red-100 text-red-700 font-black text-[10px]">
                                ⚠ {stats.breachedCount} SLA Breach{stats.breachedCount > 1 ? 'es' : ''}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE: 3-Tab Rent & Payments Settlement Hub
// ─────────────────────────────────────────────────────────────────────────────
type MainTab = 'inflows' | 'payouts' | 'refunds';

const TABS: { key: MainTab; label: string; icon: any; activeClass: string; inactiveClass: string }[] = [
    {
        key: 'inflows',
        label: 'Rent Inflows',
        icon: IndianRupee,
        activeClass: 'border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50/50',
        inactiveClass: 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/30',
    },
    {
        key: 'payouts',
        label: 'Payouts & Invoices',
        icon: BanknoteIcon,
        activeClass: 'border-b-2 border-violet-600 text-violet-700 bg-violet-50/50',
        inactiveClass: 'text-slate-500 hover:text-violet-600 hover:bg-violet-50/30',
    },
    {
        key: 'refunds',
        label: 'Refunds & Adjustments',
        icon: ArrowDownLeft,
        activeClass: 'border-b-2 border-rose-600 text-rose-700 bg-rose-50/50',
        inactiveClass: 'text-slate-500 hover:text-rose-600 hover:bg-rose-50/30',
    },
];

export default function OwnerPaymentsPage() {
    const [activeTab, setActiveTab] = useState<MainTab>('inflows');
    const [month, setMonth] = useState(getCurrentMonth());

    const currentYearNum = new Date().getFullYear();
    const yearOptions = [
        { value: (currentYearNum - 1).toString(), label: (currentYearNum - 1).toString() },
        { value: currentYearNum.toString(), label: currentYearNum.toString() },
        { value: (currentYearNum + 1).toString(), label: (currentYearNum + 1).toString() },
        { value: (currentYearNum + 2).toString(), label: (currentYearNum + 2).toString() }
    ];

    const monthOptions = [
        { value: '01', label: 'January' }, { value: '02', label: 'February' },
        { value: '03', label: 'March' }, { value: '04', label: 'April' },
        { value: '05', label: 'May' }, { value: '06', label: 'June' },
        { value: '07', label: 'July' }, { value: '08', label: 'August' },
        { value: '09', label: 'September' }, { value: '10', label: 'October' },
        { value: '11', label: 'November' }, { value: '12', label: 'December' }
    ];

    const [selectedYear, selectedMonth] = month.split('-');

    return (
        <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 p-4 md:p-8 space-y-6">
            {/* Page Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center shadow-sm">
                            <Activity className="w-4 h-4 text-white" />
                        </div>
                        <h1 className="text-2xl font-black text-slate-900">Rent & Payments Settlement</h1>
                    </div>
                    <p className="text-sm text-slate-500 ml-10">
                        Rent inflows, payout reconciliation, and tenant refund history for all your properties.
                    </p>
                </div>

                {/* YYYY and MM filter */}
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex flex-col">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">SELECT YEAR</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setMonth(`${e.target.value}-${selectedMonth}`)}
                            className="bg-white border-[1.5px] border-indigo-500 rounded-full text-indigo-700 font-black text-xs px-4 py-2 outline-none focus:ring-4 focus:ring-indigo-500/20 shadow-sm appearance-none cursor-pointer pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%234F46E5%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_12px_center] bg-[length:8px_auto]"
                        >
                            {yearOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">SELECT MONTH</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setMonth(`${selectedYear}-${e.target.value}`)}
                            className="bg-white border-[1.5px] border-slate-200 rounded-full text-slate-700 font-black text-xs px-4 py-2 outline-none focus:border-slate-400 shadow-sm appearance-none cursor-pointer pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394A3B8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_12px_center] bg-[length:8px_auto]"
                        >
                            {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex border-b border-slate-200 overflow-x-auto">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-5 py-4 text-sm font-black whitespace-nowrap transition-all duration-150 ${isActive ? tab.activeClass : tab.inactiveClass}`}
                                id={`owner-settlements-tab-${tab.key}`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content */}
                <div className="p-5">
                    {activeTab === 'inflows' && <RentCollectionContainer month={month} />}
                    {activeTab === 'payouts' && <PayoutsTab month={month} />}
                    {activeTab === 'refunds' && <RefundsTab month={month} />}
                </div>
            </div>
        </div>
    );
}
