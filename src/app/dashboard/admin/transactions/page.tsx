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

    const filtered = transactions.filter(txn =>
        txn.id.toLowerCase().includes(search.toLowerCase()) ||
        txn.razorpayOrderId?.toLowerCase().includes(search.toLowerCase()) ||
        txn.booking.user.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold">Transactions</h1>
                    <p className="text-muted-foreground">Global payment history across the platform.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchTransactions} disabled={loading}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
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
                                    <th className="p-4 text-left font-medium">Transaction / Order ID</th>
                                    <th className="p-4 text-left font-medium">User</th>
                                    <th className="p-4 text-left font-medium">Date</th>
                                    <th className="p-4 text-left font-medium">Method</th>
                                    <th className="p-4 text-left font-medium">Amount</th>
                                    <th className="p-4 text-left font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {loading ? (
                                    <tr><td colSpan={6} className="p-8 text-center animate-pulse">Loading transactions...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No transactions found.</td></tr>
                                ) : (
                                    filtered.map((txn) => (
                                        <tr key={txn.id} className="hover:bg-muted/5 transition-colors">
                                            <td className="p-4">
                                                <div className="font-mono text-xs text-muted-foreground">ID: {txn.id.split('-')[0]}...</div>
                                                {txn.razorpayOrderId && (
                                                    <div className="text-[10px] text-blue-600 font-medium truncate flex items-center">
                                                        RP_ORD: {txn.razorpayOrderId}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="font-medium text-sm">{txn.booking.user.name}</div>
                                                <div className="text-[10px] text-muted-foreground">{txn.booking.user.email}</div>
                                            </td>
                                            <td className="p-4 text-xs text-muted-foreground">
                                                {new Date(txn.date).toLocaleDateString('en-IN', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                                <div className="text-[10px]">{new Date(txn.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-mono uppercase">{txn.method}</span>
                                            </td>
                                            <td className="p-4 font-bold text-sm">
                                                ₹{txn.amount.toLocaleString('en-IN')}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${txn.status === 'SUCCESS' || txn.status === 'VERIFIED' ? 'bg-green-100 text-green-800' :
                                                    txn.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
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
