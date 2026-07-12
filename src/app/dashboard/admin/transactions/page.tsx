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
            txn.booking?.propertyName?.toLowerCase().includes(q) ||
            txn.booking?.displayId?.toLowerCase().includes(q)
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
                                placeholder="Search by ID, Order ID, or User..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted border-b">
                                <tr>
                                    <th className="p-4 text-left font-medium">Type</th>
                                    <th className="p-4 text-left font-medium">Transaction / Ref ID</th>
                                    <th className="p-4 text-left font-medium">User & Property</th>
                                    <th className="p-4 text-left font-medium">Date</th>
                                    <th className="p-4 text-left font-medium">Method</th>
                                    <th className="p-4 text-left font-medium">Amount</th>
                                    <th className="p-4 text-left font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {loading ? (
                                    <tr><td colSpan={7} className="p-8 text-center animate-pulse">Loading transactions...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No transactions found.</td></tr>
                                ) : (
                                    filtered.map((txn) => (
                                        <tr key={txn.id} className="hover:bg-muted/5 transition-colors">
                                            {/* Type badge */}
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase whitespace-nowrap ${
                                                    txn.txnType === 'TOKEN_PAYMENT' ? 'bg-teal-100 text-teal-700' :
                                                    txn.txnType === 'RENT' ? 'bg-indigo-100 text-indigo-700' :
                                                    txn.txnType === 'DEPOSIT' ? 'bg-amber-100 text-amber-700' :
                                                    txn.txnType === 'PROPERTY_ONBOARDING' ? 'bg-purple-100 text-purple-700' :
                                                    txn.txnType === 'REFUND' ? 'bg-rose-100 text-rose-700' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {txn.txnLabel || txn.txnType || 'Payment'}
                                                </span>
                                            </td>
                                            {/* IDs */}
                                            <td className="p-4">
                                                <div className="font-mono text-xs text-muted-foreground">ID: {String(txn.id).slice(0, 12)}...</div>
                                                {txn.booking?.displayId && (
                                                    <div className="text-[10px] text-purple-600 font-bold">Bkg: {txn.booking.displayId}</div>
                                                )}
                                                {(txn.razorpayId || txn.razorpayOrderId) && (
                                                    <div className="text-[10px] text-blue-600 font-medium truncate max-w-[140px]">
                                                        RP: {txn.razorpayId || txn.razorpayOrderId}
                                                    </div>
                                                )}
                                            </td>
                                            {/* User & property */}
                                            <td className="p-4">
                                                <div className="font-medium text-sm">{txn.booking?.user?.name || '—'}</div>
                                                <div className="text-[10px] text-muted-foreground">{txn.booking?.user?.email || ''}</div>
                                                {txn.booking?.propertyName && (
                                                    <div className="text-[10px] text-slate-500 font-medium mt-0.5">📍 {txn.booking.propertyName}</div>
                                                )}
                                            </td>
                                            {/* Date */}
                                            <td className="p-4 text-xs text-muted-foreground">
                                                {new Date(txn.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                <div className="text-[10px]">{new Date(txn.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            {/* Method */}
                                            <td className="p-4">
                                                <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-mono uppercase">{txn.method || '—'}</span>
                                            </td>
                                            {/* Amount */}
                                            <td className={`p-4 font-bold text-sm ${Number(txn.amount) < 0 ? 'text-rose-600' : ''}`}>
                                                {Number(txn.amount) < 0 
                                                    ? `- ₹${Math.abs(Number(txn.amount)).toLocaleString('en-IN')}` 
                                                    : `₹${Number(txn.amount).toLocaleString('en-IN')}`
                                                }
                                            </td>
                                            {/* Status */}
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                                    txn.status === 'SUCCESS' || txn.status === 'VERIFIED' ? 'bg-green-100 text-green-800' :
                                                    txn.status === 'REFUNDED' ? 'bg-rose-100 text-rose-800' :
                                                    txn.status === 'DUPLICATE' ? 'bg-amber-100 text-amber-800' :
                                                    txn.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 
                                                    'bg-red-100 text-red-800'
                                                }`}>
                                                    {txn.status}
                                                </span>
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
