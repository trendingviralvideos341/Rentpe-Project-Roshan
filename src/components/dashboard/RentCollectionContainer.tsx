'use client';

import { useEffect, useState, useTransition } from 'react';
import { getOwnerRentCollection, sendRentReminder } from '@/actions/ownerRentCollection';
import { toast } from 'sonner';
import { IndianRupee, Clock, CheckCircle2, AlertCircle, Loader2, MessageCircle, FileText, Filter, TrendingUp, Search } from 'lucide-react';
import { format } from 'date-fns';

type FilterTab = 'ALL' | 'PAID' | 'PENDING' | 'PARTIAL';

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: string }> = {
    PAID:    { label: 'Paid',    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: 'Γ£à' },
    PENDING: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 border-amber-200',     icon: 'ΓÅ░' },
    PARTIAL: { label: 'Partial', cls: 'bg-blue-100 text-blue-700 border-blue-200',         icon: '≡ƒö╡' },
    OVERDUE: { label: 'Overdue', cls: 'bg-red-100 text-red-700 border-red-200',            icon: 'Γ¥î' },
};

function getStatus(inv: any): string {
    if (inv.status === 'PAID') return 'PAID';
    if (inv.daysOverdue > 0) return 'OVERDUE';
    if (inv.status === 'PARTIAL') return 'PARTIAL';
    return 'PENDING';
}

function getCurrentMonth() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function getPreviousMonth() {
    const n = new Date();
    n.setMonth(n.getMonth() - 1);
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

export function RentCollectionContainer() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterTab>('ALL');
    const [month, setMonth] = useState(getCurrentMonth());
    const [search, setSearch] = useState('');
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

    const handleReminder = (inv: any) => {
        setSendingId(inv.id);
        startTransition(async () => {
            try {
                const result = await sendRentReminder(inv.id);
                if (result.whatsappUrl) {
                    window.open(result.whatsappUrl, '_blank');
                }
                toast.success(`Reminder sent to ${result.tenantName}`);
            } catch (e: any) {
                toast.error(e.message || 'Failed to send reminder');
            } finally {
                setSendingId(null);
            }
        });
    };

    const filtered = invoices
        .filter(inv => {
            const s = getStatus(inv);
            if (filter === 'ALL') return true;
            return s === filter;
        })
        .filter(inv =>
            !search ||
            inv.tenantName.toLowerCase().includes(search.toLowerCase()) ||
            inv.roomNumber.toLowerCase().includes(search.toLowerCase())
        );

    const totalCollected = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.paidAmount, 0);
    const totalDue = invoices.filter(i => getStatus(i) === 'PENDING').reduce((s, i) => s + (i.amount - i.paidAmount), 0);
    const totalOverdue = invoices.filter(i => getStatus(i) === 'OVERDUE').reduce((s, i) => s + (i.amount - i.paidAmount), 0);
    const totalExpected = invoices.reduce((s, i) => s + i.amount, 0);

    const fmt = (n: number) => `Γé╣${n.toLocaleString('en-IN')}`;

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-6 pt-10 pb-20 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute left-1/2 bottom-0 w-96 h-32 bg-purple-400/20 rounded-full blur-2xl" />
                <div className="max-w-6xl mx-auto relative z-10">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                                <IndianRupee className="w-8 h-8" /> Rent Collection
                            </h1>
                            <p className="text-indigo-200 text-sm font-medium mt-1">Track all tenant payments in one place</p>
                        </div>
                        {/* Month picker */}
                        <div className="flex gap-2">
                            <button onClick={() => setMonth(getPreviousMonth())}
                                className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${month === getPreviousMonth() ? 'bg-white text-indigo-700' : 'bg-white/20 text-white hover:bg-white/30'}`}>
                                Last Month
                            </button>
                            <button onClick={() => setMonth(getCurrentMonth())}
                                className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${month === getCurrentMonth() ? 'bg-white text-indigo-700' : 'bg-white/20 text-white hover:bg-white/30'}`}>
                                This Month
                            </button>
                            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                                className="px-3 py-2 rounded-xl bg-white/20 text-white text-sm font-bold border border-white/30 focus:outline-none focus:bg-white/30" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 -mt-12 relative z-10 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Total Collected', val: fmt(totalCollected), sub: `${invoices.filter(i => i.status === 'PAID').length} paid`, icon: CheckCircle2, color: 'emerald' },
                        { label: 'Due This Month', val: fmt(totalDue), sub: `${invoices.filter(i => getStatus(i) === 'PENDING').length} pending`, icon: Clock, color: 'amber' },
                        { label: 'Overdue', val: fmt(totalOverdue), sub: `${invoices.filter(i => getStatus(i) === 'OVERDUE').length} tenants`, icon: AlertCircle, color: 'red' },
                        { label: 'Total Expected', val: fmt(totalExpected), sub: `${invoices.length} invoices`, icon: TrendingUp, color: 'indigo' },
                    ].map(card => (
                        <div key={card.label} className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{card.label}</p>
                                <card.icon className={`w-4 h-4 text-${card.color}-500`} />
                            </div>
                            <p className="text-xl font-black text-slate-900">{card.val}</p>
                            <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Filter + Search */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="bg-white rounded-2xl border border-slate-100 p-2 flex gap-2 overflow-x-auto flex-1">
                        {(['ALL', 'PAID', 'PENDING', 'PARTIAL'] as FilterTab[]).map(f => (
                            <button key={f} onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${filter === f ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search tenant or room..."
                            className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64" />
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="font-black text-slate-900">Payment Status</h2>
                        <span className="text-xs text-slate-400 font-bold">{filtered.length} records</span>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="py-16 text-center">
                            <IndianRupee className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                            <p className="font-black text-slate-400">No invoices found for this period</p>
                            <p className="text-sm text-slate-300 mt-1">Try a different month or filter</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/50">
                                            {['Tenant', 'Room', 'Month', 'Amount', 'Due Date', 'Status', 'Action'].map(h => (
                                                <th key={h} className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filtered.map(inv => {
                                            const s = getStatus(inv);
                                            const sc = STATUS_CONFIG[s];
                                            return (
                                                <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-5 py-4">
                                                        <p className="font-black text-slate-900 text-sm">{inv.tenantName}</p>
                                                        <p className="text-xs text-slate-400">{inv.propertyName}</p>
                                                    </td>
                                                    <td className="px-5 py-4 text-sm font-bold text-slate-600">{inv.roomNumber}</td>
                                                    <td className="px-5 py-4 text-sm text-slate-600">{inv.month}</td>
                                                    <td className="px-5 py-4">
                                                        <p className="font-black text-slate-900">Γé╣{inv.amount.toLocaleString('en-IN')}</p>
                                                        {inv.paidAmount > 0 && inv.status !== 'PAID' && (
                                                            <p className="text-xs text-emerald-600">Paid: Γé╣{inv.paidAmount.toLocaleString('en-IN')}</p>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-sm text-slate-600">
                                                        {inv.dueDate ? format(new Date(inv.dueDate), 'd MMM yyyy') : 'ΓÇö'}
                                                        {inv.daysOverdue > 0 && (
                                                            <p className="text-xs text-red-600 font-bold">{inv.daysOverdue}d overdue</p>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border uppercase ${sc.cls}`}>
                                                            {sc.icon} {s === 'OVERDUE' ? `${inv.daysOverdue}d overdue` : sc.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        {s === 'PAID' ? (
                                                            <button className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-black rounded-lg flex items-center gap-1">
                                                                <FileText className="w-3 h-3" /> Receipt
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleReminder(inv)}
                                                                disabled={isPending && sendingId === inv.id}
                                                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-black rounded-lg flex items-center gap-1 disabled:opacity-50 transition-all"
                                                            >
                                                                {isPending && sendingId === inv.id ? (
                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                ) : (
                                                                    <MessageCircle className="w-3 h-3" />
                                                                )}
                                                                Remind
                                                            </button>
                                                        )}
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
                                    const s = getStatus(inv);
                                    const sc = STATUS_CONFIG[s];
                                    return (
                                        <div key={inv.id} className="p-4 space-y-3">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="font-black text-slate-900">{inv.tenantName}</p>
                                                    <p className="text-xs text-slate-400">{inv.propertyName} ┬╖ Room {inv.roomNumber}</p>
                                                </div>
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${sc.cls}`}>
                                                    {sc.icon} {s}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-black text-slate-900">Γé╣{inv.amount.toLocaleString('en-IN')}</p>
                                                    <p className="text-xs text-slate-400">{inv.month}</p>
                                                </div>
                                                {s !== 'PAID' && (
                                                    <button onClick={() => handleReminder(inv)} disabled={isPending}
                                                        className="px-4 py-2 bg-green-600 text-white text-xs font-black rounded-xl flex items-center gap-1 disabled:opacity-50">
                                                        <MessageCircle className="w-3 h-3" /> Send Reminder
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
