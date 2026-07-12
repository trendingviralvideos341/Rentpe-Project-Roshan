"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Search } from "lucide-react";
import { getTransactions } from "@/actions/admin";

export default function AdminTransactionsPage() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>('ALL');

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getTransactions();
            setTransactions(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const filtered = transactions.filter(txn => {
        if (typeFilter !== 'ALL' && txn.txnType !== typeFilter) return false;
        const q = search.toLowerCase();
        if (!q) return true;
        return (
            txn.id?.toLowerCase().includes(q) ||
            txn.razorpayOrderId?.toLowerCase().includes(q) ||
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold">Transactions</h1>
                    <p className="text-muted-foreground">Global payment history across the platform — rent, deposits & token payments.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchTransactions} disabled={loading}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            {/* Summary chips */}
            <div className="flex flex-wrap gap-2">
                {[
                    { key: 'ALL', label: 'All', color: 'bg-slate-100 text-slate-700' },
                    { key: 'TOKEN_PAYMENT', label: '🔐 Token Payments', color: 'bg-teal-100 text-teal-700' },
                    { key: 'RENT', label: '📄 Rent Payments', color: 'bg-indigo-100 text-indigo-700' },
                    { key: 'DEPOSIT', label: '🔒 Deposits', color: 'bg-amber-100 text-amber-700' },
                    { key: 'PROPERTY_ONBOARDING', label: '🏢 Onboarding Fees', color: 'bg-purple-100 text-purple-700' },
                    { key: 'REFUND', label: '🔄 Refunds', color: 'bg-rose-100 text-rose-700' },
                    { key: 'PAYMENT', label: '💳 Other', color: 'bg-slate-100 text-slate-600' },
                ].map(f => (
                    <button key={f.key}
                        onClick={() => setTypeFilter(f.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                            typeFilter === f.key ? `${f.color} ring-2 ring-offset-1 ring-current border-transparent` : 'border-slate-200 text-slate-500 hover:border-slate-400'
                        }`}>
                        {f.label} {typeFilter === f.key ? `(${filtered.length})` : `(${transactions.filter(t => f.key === 'ALL' || t.txnType === f.key).length})`}
                    </button>
                ))}
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="p-4 border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <input
                                className="pl-10 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Search by ID, Tenant, User, or Phone..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left min-w-[1200px]">
                            <thead className="bg-slate-50 border-b text-xs text-slate-500 uppercase tracking-wider">
                                <tr>
                                    <th className="p-4 font-bold min-w-[140px]">Type & Date</th>
                                    <th className="p-4 font-bold min-w-[130px]">Flow</th>
                                    <th className="p-4 font-bold min-w-[110px]">Booking ID</th>
                                    <th className="p-4 font-bold min-w-[110px]">Tenant ID</th>
                                    <th className="p-4 font-bold min-w-[200px]">Property Details</th>
                                    <th className="p-4 font-bold min-w-[200px]">User Details</th>
                                    <th className="p-4 font-bold min-w-[100px] text-right">Rent Amt</th>
                                    <th className="p-4 font-bold min-w-[150px] text-right">Property Onboarding Fees</th>
                                    <th className="p-4 font-bold min-w-[110px] text-right">Plat. Fees</th>
                                    <th className="p-4 font-bold min-w-[80px] text-right">GST</th>
                                    <th className="p-4 font-bold min-w-[80px] text-right">TDS</th>
                                    <th className="p-4 font-bold min-w-[120px] text-right">Total Paid</th>
                                    <th className="p-4 font-bold min-w-[120px]">Ref & Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan={13} className="p-8 text-center animate-pulse">Loading transactions...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={13} className="p-8 text-center text-muted-foreground">No transactions found.</td></tr>
                                ) : (
                                    filtered.map((txn) => (
                                        <tr key={txn.id} className="hover:bg-slate-50/50 transition-colors">
                                            {/* Type & Date */}
                                            <td className="p-4 align-top">
                                                <div className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight whitespace-nowrap ${
                                                    txn.txnType === 'TOKEN_PAYMENT' ? 'bg-teal-100 text-teal-700' :
                                                    txn.txnType === 'RENT' ? 'bg-indigo-100 text-indigo-700' :
                                                    txn.txnType === 'DEPOSIT' ? 'bg-amber-100 text-amber-700' :
                                                    txn.txnType === 'PROPERTY_ONBOARDING' ? 'bg-purple-100 text-purple-700' :
                                                    txn.txnType === 'REFUND' ? 'bg-rose-100 text-rose-700' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {txn.txnLabel || txn.txnType}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-2 font-medium">
                                                    {new Date(txn.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    {new Date(txn.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            
                                            {/* Flow */}
                                            <td className="p-4 align-top">
                                                <div className="flex items-center gap-1.5 text-xs font-bold bg-slate-50 px-2 py-1 rounded w-fit">
                                                    <span className={txn.source === 'STUDENT' ? 'text-indigo-600' : txn.source === 'OWNER' ? 'text-purple-600' : 'text-slate-600'}>{txn.source}</span>
                                                    <span className="text-slate-300">➔</span>
                                                    <span className={txn.destination === 'STUDENT' ? 'text-indigo-600' : txn.destination === 'PLATFORM' ? 'text-slate-600' : 'text-purple-600'}>{txn.destination}</span>
                                                </div>
                                                <div className="text-xs text-slate-400 font-mono mt-1.5 px-1 uppercase">{txn.method || '—'}</div>
                                            </td>

                                            {/* Booking ID */}
                                            <td className="p-4 align-top">
                                                <div className="font-mono text-sm font-bold text-slate-700">{txn.booking?.displayId || '—'}</div>
                                            </td>

                                            {/* Tenant ID */}
                                            <td className="p-4 align-top">
                                                <div className="font-mono text-sm font-bold text-slate-700">{txn.tenantId || '—'}</div>
                                            </td>

                                            {/* Property Details */}
                                            <td className="p-4 align-top">
                                                <div className="font-bold text-sm text-slate-800 truncate max-w-[180px]">{txn.propertyDetails?.name || '—'}</div>
                                                {txn.propertyDetails?.city && <div className="text-xs text-slate-500 mt-0.5">📍 {txn.propertyDetails.city}</div>}
                                                {txn.propertyDetails?.displayId && <div className="text-xs font-mono text-purple-500 font-bold mt-1">{txn.propertyDetails.displayId}</div>}
                                            </td>

                                            {/* User Details */}
                                            <td className="p-4 align-top">
                                                <div className="font-bold text-sm text-slate-800 truncate max-w-[180px]">{txn.booking?.user?.name || '—'}</div>
                                                {txn.booking?.user?.email && <div className="text-xs text-slate-500 truncate max-w-[180px] mt-0.5">{txn.booking.user.email}</div>}
                                                {txn.booking?.user?.phone && <div className="text-xs text-slate-500 mt-0.5">📞 {txn.booking.user.phone}</div>}
                                                {txn.booking?.user?.displayId && <div className="text-xs font-mono text-indigo-400 font-bold mt-1">{txn.booking.user.displayId}</div>}
                                            </td>

                                            {/* Rent Amount */}
                                            <td className="p-4 align-top text-right">
                                                <div className="text-sm font-bold text-slate-700">{txn.rentAmount ? `₹${Math.abs(Number(txn.rentAmount)).toLocaleString('en-IN')}` : '—'}</div>
                                            </td>

                                            {/* Property Onboarding Fees */}
                                            <td className="p-4 align-top text-right">
                                                <div className="text-sm font-medium text-slate-500">{txn.txnType === 'PROPERTY_ONBOARDING' && txn.platformFeeAmt ? `₹${Number(txn.platformFeeAmt).toLocaleString('en-IN')}` : '—'}</div>
                                            </td>

                                            {/* Platform Fees */}
                                            <td className="p-4 align-top text-right">
                                                <div className="text-sm font-medium text-slate-500">{txn.txnType !== 'PROPERTY_ONBOARDING' && txn.platformFeeAmt ? `₹${Number(txn.platformFeeAmt).toLocaleString('en-IN')}` : '—'}</div>
                                            </td>

                                            {/* GST */}
                                            <td className="p-4 align-top text-right">
                                                <div className="text-sm font-medium text-slate-500">{txn.platformGst ? `₹${Number(txn.platformGst).toLocaleString('en-IN')}` : '—'}</div>
                                            </td>

                                            {/* TDS */}
                                            <td className="p-4 align-top text-right">
                                                <div className="text-sm font-medium text-slate-500">{txn.tdsAmount ? `₹${Number(txn.tdsAmount).toLocaleString('en-IN')}` : '—'}</div>
                                            </td>

                                            {/* Total Paid */}
                                            <td className="p-4 align-top text-right">
                                                <div className={`text-sm font-black ${Number(txn.totalPaid) < 0 ? 'text-rose-600' : 'text-green-700'}`}>
                                                    {Number(txn.totalPaid) < 0 ? `- ₹${Math.abs(Number(txn.totalPaid)).toLocaleString('en-IN')}` : `₹${Number(txn.totalPaid).toLocaleString('en-IN')}`}
                                                </div>
                                            </td>

                                            {/* Ref & Status */}
                                            <td className="p-4 align-top">
                                                <div className="flex flex-col gap-1.5 items-start">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-black uppercase ${
                                                        txn.status === 'SUCCESS' || txn.status === 'VERIFIED' ? 'bg-green-100 text-green-800' :
                                                        txn.status === 'REFUNDED' ? 'bg-rose-100 text-rose-800' :
                                                        txn.status === 'DUPLICATE' ? 'bg-amber-100 text-amber-800' :
                                                        txn.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 
                                                        'bg-red-100 text-red-800'
                                                    }`}>
                                                        {txn.status}
                                                    </span>
                                                    <div className="text-xs text-slate-400 font-mono truncate max-w-[120px]" title={txn.id}>{txn.id}</div>
                                                    {(txn.razorpayId || txn.razorpayOrderId) && (
                                                        <div className="text-xs text-blue-500 font-mono font-bold truncate max-w-[120px]" title={txn.razorpayId || txn.razorpayOrderId}>
                                                            {txn.razorpayId || txn.razorpayOrderId}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
