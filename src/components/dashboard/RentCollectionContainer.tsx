'use client';

import { useEffect, useState, useTransition } from 'react';
import { getOwnerRentCollection, sendRentReminder, markInvoiceAsCashPaid } from '@/actions/ownerRentCollection';
import { toast } from 'sonner';
import {
    IndianRupee, Clock, CheckCircle2, AlertCircle, Loader2, MessageCircle,
    FileText, Search, Globe, Banknote, XCircle, TrendingUp, History,
    ChevronDown, ChevronUp, X, RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

type Tab = 'ALL' | 'ONLINE' | 'CASH' | 'UNPAID';

function getCurrentMonth() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function getPreviousMonth() {
    const n = new Date();
    n.setMonth(n.getMonth() - 1);
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function getStatus(inv: any): string {
    if (inv.status === 'PAID' && (inv.paymentMethod === 'ONLINE' || inv.paymentMethod === 'RAZORPAY')) return 'ONLINE_PAID';
    if (inv.status === 'PAID' && inv.paymentMethod === 'CASH') return 'CASH_PAID';
    if (inv.status === 'PAID') return 'ONLINE_PAID'; // default paid = online
    if (inv.daysOverdue > 0) return 'OVERDUE';
    return 'UNPAID';
}

function StatusBadge({ inv }: { inv: any }) {
    const s = getStatus(inv);
    if (s === 'ONLINE_PAID') return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">
            <Globe className="w-3 h-3" /> Online Paid
        </span>
    );
    if (s === 'CASH_PAID') return (
        <div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-green-100 text-green-700 border border-green-200 uppercase">
                <Banknote className="w-3 h-3" /> Cash Paid
            </span>
            {inv.confirmedByName && (
                <p className="text-[9px] text-slate-400 mt-0.5">by {inv.confirmedByName}</p>
            )}
        </div>
    );
    if (s === 'OVERDUE') return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-200 uppercase">
            <AlertCircle className="w-3 h-3" /> {inv.daysOverdue}d Overdue
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-200 uppercase">
            <XCircle className="w-3 h-3" /> Unpaid
        </span>
    );
}

// ── Cash Confirm Modal ─────────────────────────────────
function CashConfirmModal({ inv, onClose, onConfirm }: { inv: any; onClose: () => void; onConfirm: (note: string) => void }) {
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-black text-slate-900">Confirm Cash Payment</h2>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1">
                    <p className="text-sm font-black text-green-800">₹{inv.amount.toLocaleString('en-IN')} cash received from</p>
                    <p className="text-lg font-black text-slate-900">{inv.tenantName}</p>
                    <p className="text-xs text-slate-400">Room {inv.roomNumber} · {inv.month}</p>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Note (mandatory)</label>
                    <input
                        className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                        placeholder="e.g. Received in person on 11 Apr 2026"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                    />
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 text-sm font-black text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Cancel</button>
                    <button
                        disabled={!note.trim() || busy}
                        onClick={async () => { setBusy(true); onConfirm(note); }}
                        className="flex-1 py-2.5 text-sm font-black text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                        Confirm ₹{inv.amount.toLocaleString('en-IN')}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── History Dropdown ──────────────────────────────────
function HistoryDropdown({ history }: { history: any[] }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black rounded-xl border-2 transition-all ${open ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'}`}
            >
                <History className="w-3 h-3" />
                {history.length} months
                {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border-2 border-slate-100 shadow-2xl z-20 p-3 space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2">📅 Rent History</p>
                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                        {history.length === 0 && <p className="text-[10px] text-slate-400 italic text-center py-4">No history</p>}
                        {history.map((h: any, i: number) => (
                            <div key={i} className={`text-[10px] p-2 rounded-xl border ${h.status === 'PAID' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                                <div className="flex justify-between font-black">
                                    <span>{h.month}</span>
                                    <span>{h.status === 'PAID' ? (h.paymentMethod === 'CASH' ? '💵 Cash' : '🌐 Online') : '❌ Unpaid'}</span>
                                </div>
                                <div className="flex justify-between mt-0.5 opacity-70 font-medium">
                                    <span>₹{h.amount?.toLocaleString('en-IN')}</span>
                                    <span>{h.paidAt ? format(new Date(h.paidAt), 'd MMM yy') : '—'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── MAIN COMPONENT ────────────────────────────────────
export function RentCollectionContainer() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('ALL');
    const [month, setMonth] = useState(getCurrentMonth());
    const [search, setSearch] = useState('');
    const [methodFilter, setMethodFilter] = useState('ALL');
    const [propertyFilter, setPropertyFilter] = useState('ALL');
    const [roomTypeFilter, setRoomTypeFilter] = useState('ALL');
    const [cashModal, setCashModal] = useState<any>(null);
    const [isPending, startTransition] = useTransition();
    const [sendingId, setSendingId] = useState<string | null>(null);

    const reload = (m: string) => {
        setLoading(true);
        getOwnerRentCollection(m).then(data => {
            setInvoices(data);
            setLoading(false);
        });
    };

    useEffect(() => { reload(month); }, [month]);

    // ── summary stats ──
    const onlinePaid = invoices.filter(i => i.status === 'PAID' && i.paymentMethod !== 'CASH');
    const cashPaid = invoices.filter(i => i.status === 'PAID' && i.paymentMethod === 'CASH');
    const unpaid = invoices.filter(i => i.status !== 'PAID');
    const totalReceived = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.paidAmount, 0);
    const onlineReceived = onlinePaid.reduce((s, i) => s + i.paidAmount, 0);
    const cashReceived = cashPaid.reduce((s, i) => s + i.paidAmount, 0);
    const totalUnpaid = unpaid.reduce((s, i) => s + i.amount, 0);
    const totalExpected = invoices.reduce((s, i) => s + i.amount, 0);
    const collectionRate = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;

    // ── unique options for filters ──
    const propertyOptions = Array.from(new Set(invoices.map(i => i.propertyName).filter(Boolean)));
    const roomTypeOptions = Array.from(new Set(invoices.map(i => i.roomType).filter(Boolean)));

    const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

    // ── filters ──
    const filtered = invoices.filter(inv => {
        const s = getStatus(inv);
        // Status Tabs Filter
        if (tab === 'ONLINE' && s !== 'ONLINE_PAID') return false;
        if (tab === 'CASH' && s !== 'CASH_PAID') return false;
        if (tab === 'UNPAID' && s !== 'UNPAID' && s !== 'OVERDUE') return false;

        // Dropdown Filters
        if (propertyFilter !== 'ALL' && inv.propertyName !== propertyFilter) return false;
        if (roomTypeFilter !== 'ALL' && inv.roomType !== roomTypeFilter) return false;
        if (methodFilter !== 'ALL') {
             const isPaid = inv.status === 'PAID';
             if (methodFilter === 'ONLINE' && (!isPaid || inv.paymentMethod === 'CASH')) return false;
             if (methodFilter === 'CASH' && (!isPaid || inv.paymentMethod !== 'CASH')) return false;
             if (methodFilter === 'UNPAID' && isPaid) return false;
        }

        const q = search.toLowerCase();
        if (q && !inv.tenantName.toLowerCase().includes(q) && !inv.tenantDisplayId?.toLowerCase().includes(q)
            && !inv.roomNumber.toLowerCase().includes(q) && !inv.tenantPhone?.includes(q) && !inv.tenantEmail?.toLowerCase().includes(q)) return false;
        return true;
    });

    // ── cash paid confirm ──
    const handleCashPaid = (note: string) => {
        if (!cashModal) return;
        startTransition(async () => {
            try {
                const res = await markInvoiceAsCashPaid(cashModal.id, note);
                toast.success(`Cash payment confirmed for ${res.tenantName} — ${fmt(res.amount)}`);
                setCashModal(null);
                reload(month);
            } catch (e: any) {
                toast.error(e.message || 'Failed');
                setCashModal(null);
            }
        });
    };

    const handleReminder = (inv: any) => {
        setSendingId(inv.id);
        startTransition(async () => {
            try {
                const res = await sendRentReminder(inv.id);
                if (res.whatsappUrl) window.open(res.whatsappUrl, '_blank');
                toast.success(`Reminder sent to ${res.tenantName}`);
            } catch (e: any) {
                toast.error(e.message || 'Failed');
            } finally { setSendingId(null); }
        });
    };

    const TABS: { key: Tab; label: string; count: number }[] = [
        { key: 'ALL', label: 'All', count: invoices.length },
        { key: 'ONLINE', label: '🌐 Online Paid', count: onlinePaid.length },
        { key: 'CASH', label: '💵 Cash Paid', count: cashPaid.length },
        { key: 'UNPAID', label: '❌ Unpaid', count: unpaid.length },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <IndianRupee className="w-6 h-6 text-indigo-600" /> Rent & Payments
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">Full rent collection dashboard</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setMonth(getPreviousMonth())}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${month === getPreviousMonth() ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        Last Month
                    </button>
                    <button onClick={() => setMonth(getCurrentMonth())}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${month === getCurrentMonth() ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        This Month
                    </button>
                    <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-400" />
                    <button onClick={() => reload(month)} disabled={loading}
                        className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* 5 Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { label: 'Total Received', val: fmt(totalReceived), icon: '💰', color: 'bg-green-50 border-green-200 text-green-800' },
                    { label: 'Online Received', val: fmt(onlineReceived), icon: '🌐', color: 'bg-sky-50 border-sky-200 text-sky-800' },
                    { label: 'Cash Received', val: fmt(cashReceived), icon: '💵', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
                    { label: 'Unpaid / Pending', val: fmt(totalUnpaid), icon: '⏳', color: 'bg-red-50 border-red-200 text-red-800' },
                    { label: 'Collection Rate', val: `${collectionRate}%`, icon: '📊', color: 'bg-purple-50 border-purple-200 text-purple-800' },
                ].map(c => (
                    <div key={c.label} className={`p-4 rounded-2xl border-2 ${c.color} shadow-sm`}>
                        <div className="text-xl mb-1">{c.icon}</div>
                        <div className="text-xl font-black">{c.val}</div>
                        <div className="text-[11px] font-semibold opacity-70 mt-0.5">{c.label}</div>
                    </div>
                ))}
            </div>

            {/* Tab + Search bar */}
            <div className="flex flex-col lg:flex-row gap-3">
                <div className="bg-white rounded-2xl border border-slate-100 p-1.5 flex gap-1 flex-wrap shrink-0">
                    {TABS.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap transition-all ${tab === t.key ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}>
                            {t.label} ({t.count})
                        </button>
                    ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search by name, room, or ID..."
                            className="pl-9 pr-4 py-2.5 w-full bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                <X className="w-4 h-4 text-slate-400" />
                            </button>
                        )}
                    </div>
                    
                    {/* Property Filter */}
                    <select 
                        value={propertyFilter} 
                        onChange={e => setPropertyFilter(e.target.value)}
                        className="px-3 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 min-w-[150px]"
                    >
                        <option value="ALL">All Properties (PGs)</option>
                        {propertyOptions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>

                    {/* Room Type Filter */}
                    <select 
                        value={roomTypeFilter} 
                        onChange={e => setRoomTypeFilter(e.target.value)}
                        className="px-3 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 min-w-[130px]"
                    >
                        <option value="ALL">All Room Types</option>
                        {roomTypeOptions.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                    </select>

                    {/* Method Filter */}
                    <select 
                        value={methodFilter} 
                        onChange={e => setMethodFilter(e.target.value)}
                        className="px-3 py-2.5 bg-white border-2 border-slate-900 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 shrink-0"
                    >
                        <option value="ALL">All Payments</option>
                        <option value="ONLINE">🌐 Online Only</option>
                        <option value="CASH">💵 Cash Only</option>
                        <option value="UNPAID">❌ Unpaid Only</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-black text-slate-900">Payment Records</h2>
                    <span className="text-xs text-slate-400 font-bold">{filtered.length} records</span>
                </div>

                {loading ? (
                    <div className="py-16 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-16 text-center">
                        <IndianRupee className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="font-black text-slate-400">No records found</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/60">
                                        {['Tenant', 'Tenant ID', 'Phone', 'Room', 'PG Name', 'Amount', 'Month', 'Status', 'Paid On', 'Paid By', 'History', 'Action'].map(h => (
                                            <th key={h} className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filtered.map(inv => {
                                        const s = getStatus(inv);
                                        const isPaid = inv.status === 'PAID';
                                        const isUnpaid = !isPaid;
                                        return (
                                            <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <p className="font-black text-slate-900 text-sm whitespace-nowrap">{inv.tenantName}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{inv.tenantDisplayId || '—'}</span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{inv.tenantPhone || '—'}</td>
                                                <td className="px-4 py-3">
                                                    <span className="font-bold text-slate-700 text-sm">{inv.roomNumber}</span>
                                                    {inv.roomType && <p className="text-[9px] uppercase text-slate-400">{inv.roomType}</p>}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{inv.propertyName || '—'}</td>
                                                <td className="px-4 py-3">
                                                    <span className="font-black text-slate-900 whitespace-nowrap">₹{inv.amount.toLocaleString('en-IN')}</span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{inv.month}</td>
                                                <td className="px-4 py-3"><StatusBadge inv={inv} /></td>
                                                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                                                    {inv.paidAt ? format(new Date(inv.paidAt), 'd MMM yyyy') : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-xs whitespace-nowrap">
                                                    {isPaid ? (
                                                        inv.paymentMethod === 'CASH'
                                                            ? <span className="text-slate-600">{inv.confirmedByName || 'Owner'}</span>
                                                            : <span className="text-slate-400 italic">Razorpay Auto</span>
                                                    ) : '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <HistoryDropdown history={inv.history} />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {isPaid ? (
                                                            <a href={`/api/receipts/${inv.id}`} target="_blank" rel="noopener noreferrer">
                                                                <button className="px-2.5 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-black rounded-lg flex items-center gap-1 hover:bg-slate-200">
                                                                    <FileText className="w-3 h-3" /> Receipt
                                                                </button>
                                                            </a>
                                                        ) : (
                                                            <>
                                                                <button onClick={() => setCashModal(inv)}
                                                                    className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[10px] font-black rounded-lg flex items-center gap-1 whitespace-nowrap">
                                                                    <Banknote className="w-3 h-3" /> Cash Paid
                                                                </button>
                                                                <button
                                                                    onClick={() => handleReminder(inv)}
                                                                    disabled={isPending && sendingId === inv.id}
                                                                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-lg flex items-center gap-1 disabled:opacity-50">
                                                                    {isPending && sendingId === inv.id
                                                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                                                        : <MessageCircle className="w-3 h-3" />}
                                                                    Remind
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {filtered.map(inv => {
                                const isPaid = inv.status === 'PAID';
                                return (
                                    <div key={inv.id} className="p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-black text-slate-900">{inv.tenantName}</p>
                                                <p className="text-[10px] font-mono text-indigo-500">{inv.tenantDisplayId}</p>
                                                <p className="text-xs text-slate-400">{inv.propertyName} · Room {inv.roomNumber}</p>
                                            </div>
                                            <StatusBadge inv={inv} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-black text-slate-900">₹{inv.amount.toLocaleString('en-IN')}</p>
                                                <p className="text-xs text-slate-400">{inv.month}</p>
                                            </div>
                                            <HistoryDropdown history={inv.history} />
                                        </div>
                                        {!isPaid && (
                                            <div className="flex gap-2">
                                                <button onClick={() => setCashModal(inv)}
                                                    className="flex-1 py-2 bg-green-600 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1">
                                                    <Banknote className="w-3.5 h-3.5" /> Cash Paid
                                                </button>
                                                <button onClick={() => handleReminder(inv)} disabled={isPending}
                                                    className="flex-1 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1 disabled:opacity-50">
                                                    <MessageCircle className="w-3.5 h-3.5" /> Remind
                                                </button>
                                            </div>
                                        )}
                                        {isPaid && (
                                            <a href={`/api/receipts/${inv.id}`} target="_blank" rel="noopener noreferrer"
                                                className="block w-full py-2 text-center bg-slate-100 text-slate-600 text-xs font-black rounded-xl">
                                                📄 Download Receipt
                                            </a>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Cash Confirm Modal */}
            {cashModal && (
                <CashConfirmModal
                    inv={cashModal}
                    onClose={() => setCashModal(null)}
                    onConfirm={handleCashPaid}
                />
            )}
        </div>
    );
}
