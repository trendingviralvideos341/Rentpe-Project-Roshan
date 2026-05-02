"use client";

import { Fragment, useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { getTenants, markRentAsPaid, markRentAsUnpaid, blockTenant, unblockTenant } from "@/actions/tenants";
import { toast } from "sonner";

export default function TenantsPage() {
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState("ALL");
    const [filterProperty, setFilterProperty] = useState("ALL");
    const [filterPayment, setFilterPayment] = useState("ALL");
    const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
    const [blockNotes, setBlockNotes] = useState<Record<string, string>>({});
    const [unblockNotes, setUnblockNotes] = useState<Record<string, string>>({});
    const [payNotes, setPayNotes] = useState<Record<string, string>>({});
    const [showPayNote, setShowPayNote] = useState<Record<string, boolean>>({});
    const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());

    const currentMonth = new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });

    const fetchTenants = async () => {
        setLoading(true);
        try { setTenants(await getTenants()); }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchTenants(); }, []);

    const toggleHistory = (id: string) => {
        setExpandedHistory(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleMarkPaid = async (recordId: string, tenantId: string) => {
        const note = payNotes[tenantId]?.trim();
        if (!note) { toast.error("Please enter a note before marking as paid."); return; }
        try {
            await markRentAsPaid(recordId, note);
            setPayNotes(p => ({ ...p, [tenantId]: "" }));
            setShowPayNote(p => ({ ...p, [tenantId]: false }));
            await fetchTenants();
        } catch { toast.error("Failed to mark rent as paid."); }
    };

    const handleMarkUnpaid = async (recordId: string, tenantId: string) => {
        const note = payNotes[tenantId]?.trim();
        if (!note) { toast.error("Please enter a note before reversing payment."); return; }
        toast("Reverse this payment?", {
            description: "This will mark the rent as UNPAID.",
            action: {
                label: "Confirm",
                onClick: async () => {
                    try {
                        await markRentAsUnpaid(recordId, note);
                        setPayNotes(p => ({ ...p, [tenantId]: "" }));
                        setShowPayNote(p => ({ ...p, [tenantId]: false }));
                        await fetchTenants();
                    } catch { toast.error("Failed to mark rent as unpaid."); }
                }
            }
        });
    };

    const handleBlock = async (tenantId: string) => {
        const note = blockNotes[tenantId]?.trim();
        if (!note) { toast.error("Please enter a reason before blocking this tenant."); return; }
        try {
            await blockTenant(tenantId, note);
            setBlockNotes(p => { const n = { ...p }; delete n[tenantId]; return n; });
            await fetchTenants();
        } catch { toast.error("Failed to block tenant."); }
    };

    const handleUnblock = async (tenantId: string) => {
        const note = unblockNotes[tenantId]?.trim();
        if (!note) { toast.error("Please enter a reason before unblocking this tenant."); return; }
        try {
            await unblockTenant(tenantId, note);
            setUnblockNotes(p => { const n = { ...p }; delete n[tenantId]; return n; });
            await fetchTenants();
        } catch { toast.error("Failed to unblock tenant."); }
    };

    const properties = Array.from(new Set(tenants.map(t => t.property?.name).filter(Boolean)));

    const filteredTenants = tenants.filter(t => {
        const latestRent = t.rentRecords.find((r: any) => r.month === currentMonth);
        const isPaid = latestRent?.paid ?? false;

        const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.roomNumber.toLowerCase().includes(search.toLowerCase()) ||
            t.displayId.toLowerCase().includes(search.toLowerCase());

        const matchType = filterType === "ALL" || t.roomType === filterType;
        const matchProperty = filterProperty === "ALL" || t.property?.name === filterProperty;

        if (filterPayment === "BLOCKED") return matchSearch && matchType && matchProperty && t.status === "Blocked";
        if (filterPayment !== "ALL" && t.status === "Blocked") return false;

        const matchPayment = filterPayment === "ALL" || (filterPayment === "PAID" && isPaid) || (filterPayment === "UNPAID" && !isPaid);
        return matchSearch && matchType && matchProperty && matchPayment;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const unpaidCount = tenants.filter(t => {
        const latestRent = t.rentRecords.find((r: any) => r.month === currentMonth);
        return !latestRent?.paid && t.status !== "Blocked";
    }).length;

    if (loading) return <div className="p-8 text-center animate-pulse">Loading tenants...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Tenants</h1>
                    <p className="text-muted-foreground">Manage active tenants and track monthly rent.</p>
                </div>
                <div className="flex gap-2 items-center">
                    <span className="text-sm text-muted-foreground">Total: <strong>{tenants.length}</strong></span>
                    {unpaidCount > 0 && <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">{unpaidCount} Unpaid</span>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-indigo-50 border-indigo-100">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Total Expected Rent</p>
                        <p className="text-2xl font-black text-indigo-900 mt-1">
                            ₹{filteredTenants.reduce((acc, t) => acc + (t.rentAmount || 0), 0).toLocaleString('en-IN')}
                        </p>
                        <p className="text-[10px] text-indigo-500 mt-1">Based on {filteredTenants.length} tenants</p>
                    </CardContent>
                </Card>
                <Card className="bg-emerald-50 border-emerald-100">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Collected This Month</p>
                        <p className="text-2xl font-black text-emerald-900 mt-1">
                            ₹{filteredTenants.filter(t => t.rentRecords.some((r: any) => r.month === currentMonth && r.paid)).reduce((acc, t) => acc + (t.rentAmount || 0), 0).toLocaleString('en-IN')}
                        </p>
                        <p className="text-[10px] text-emerald-500 mt-1">{filteredTenants.filter(t => t.rentRecords.some((r: any) => r.month === currentMonth && r.paid)).length} Payments received</p>
                    </CardContent>
                </Card>
                <Card className="bg-rose-50 border-rose-100">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Pending This Month</p>
                        <p className="text-2xl font-black text-rose-900 mt-1">
                            ₹{filteredTenants.filter(t => !t.rentRecords.some((r: any) => r.month === currentMonth && r.paid) && t.status === "Active").reduce((acc, t) => acc + (t.rentAmount || 0), 0).toLocaleString('en-IN')}
                        </p>
                        <p className="text-[10px] text-rose-500 mt-1">{filteredTenants.filter(t => !t.rentRecords.some((r: any) => r.month === currentMonth && r.paid) && t.status === "Active").length} Unpaid tenants</p>
                    </CardContent>
                </Card>
            </div>
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                            <Input placeholder="Search by name, room, or ID..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select className="border rounded-md p-2 bg-background text-sm" value={filterProperty} onChange={e => setFilterProperty(e.target.value)}>
                            <option value="ALL">All Properties (PGs)</option>
                            {properties.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                        <select className="border rounded-md p-2 bg-background text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
                            <option value="ALL">All Room Types</option>
                            <option value="Single Sharing">Single Sharing</option>
                            <option value="Double Sharing">Double Sharing</option>
                            <option value="Three Sharing">Three Sharing</option>
                            <option value="Four Sharing">Four Sharing</option>
                        </select>
                        <select className="border rounded-md p-2 bg-background text-sm" value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
                            <option value="ALL">All Payments</option>
                            <option value="PAID">Rent Paid (This Month)</option>
                            <option value="UNPAID">Rent Unpaid (This Month)</option>
                            <option value="BLOCKED">Blocked Tenants</option>
                        </select>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted border-b">
                                <tr>
                                    <th className="p-4 text-left font-medium">Tenant ID</th>
                                    <th className="p-4 text-left font-medium">Name & PG</th>
                                    <th className="p-4 text-left font-medium">Room</th>
                                    <th className="p-4 text-left font-medium">Start Date</th>
                                    <th className="p-4 text-left font-medium">Monthly Rent</th>
                                    <th className="p-4 text-left font-medium">{currentMonth} Status</th>
                                    <th className="p-4 text-left font-medium">Status & History</th>
                                    <th className="p-4 text-left font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTenants.map(t => {
                                    const latestRent = t.rentRecords.find((r: any) => r.month === currentMonth);
                                    const isPaid = latestRent?.paid ?? false;
                                    const isBlocked = t.status === "Blocked";
                                    const isCheckedOut = t.status === "Checked Out";
                                    const isUpcoming = t.status === "Upcoming";
                                    const isActive = t.status === "Active";
                                    const historyExpanded = expandedHistory.has(t.id);

                                    return (
                                        <Fragment key={t.id}>
                                            <tr className={`border-b hover:bg-muted/5 ${isBlocked ? "bg-red-50/40" : ""}`}>
                                                <td className="p-4 font-mono text-xs">{t.displayId}</td>
                                                <td className="p-4">
                                                    <div className={`font-medium ${isBlocked ? "line-through text-red-400" : ""}`}>{t.name}</div>
                                                    <div className="text-[10px] text-indigo-600 font-bold uppercase">{t.property?.name || "Unknown PG"}</div>
                                                    <div className="text-xs text-muted-foreground">{t.phone}</div>
                                                </td>
                                                <td className="p-4 text-sm">{t.roomNumber} <span className="text-xs text-muted-foreground">({t.roomType})</span></td>
                                                <td className="p-4 text-sm">{t.moveInDate}</td>
                                                <td className="p-4 font-bold">₹{t.rentAmount}</td>
                                                <td className="p-4">
                                                    {isBlocked ? (
                                                        <span className="text-xs text-red-500 font-bold">🚫 Blocked</span>
                                                    ) : isCheckedOut ? (
                                                        <span className="text-xs text-gray-500 font-bold">🏠 Checked Out</span>
                                                    ) : isUpcoming ? (
                                                        <span className="text-xs text-blue-500 font-bold">⏳ Upcoming</span>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${isPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                                                {isPaid ? <><CheckCircle className="h-3 w-3" /> Paid</> : <><XCircle className="h-3 w-3" /> Unpaid</>}
                                                            </span>
                                                            {latestRent && (
                                                                <div>
                                                                    {showPayNote[t.id] && (
                                                                        <div className="mt-1 space-y-1">
                                                                            <Input className="h-7 text-xs" placeholder="Mandatory note..."
                                                                                value={payNotes[t.id] || ""}
                                                                                onChange={e => setPayNotes(p => ({ ...p, [t.id]: e.target.value }))} />
                                                                            <div className="flex gap-1">
                                                                                {!isPaid && (
                                                                                    <Button size="sm" className="h-6 text-[10px] bg-green-600 hover:bg-green-700" onClick={() => handleMarkPaid(latestRent.id, t.id)}>
                                                                                        ✓ Mark Paid
                                                                                    </Button>
                                                                                )}
                                                                                {isPaid && (
                                                                                    <Button size="sm" variant="outline" className="h-6 text-[10px] border-red-300 text-red-600" onClick={() => handleMarkUnpaid(latestRent.id, t.id)}>
                                                                                        ↩ Unpaid
                                                                                    </Button>
                                                                                )}
                                                                                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setShowPayNote(p => ({ ...p, [t.id]: false }))}>✕</Button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {!showPayNote[t.id] && (
                                                                        <Button size="sm" variant="outline" className="h-6 text-[10px] mt-1" onClick={() => setShowPayNote(p => ({ ...p, [t.id]: true }))}>
                                                                            {isPaid ? "↩ Mark Unpaid" : "✓ Mark Paid"}
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isBlocked ? "bg-red-100 text-red-800" : isCheckedOut ? "bg-slate-100 text-slate-800" : isUpcoming ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
                                                            {isBlocked ? "🚫 Blocked" : isCheckedOut ? "Checked Out" : isUpcoming ? "Upcoming" : "✅ Active"}
                                                        </span>
                                                        {t.actionNotes?.length > 0 && (
                                                            <button onClick={() => toggleHistory(t.id)} className="text-muted-foreground hover:text-foreground">
                                                                {historyExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                            </button>
                                                        )}
                                                    </div>
                                                    {historyExpanded && t.actionNotes?.length > 0 && (
                                                        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                                                            {t.actionNotes.map((note: any, i: number) => (
                                                                <div key={i} className={`text-[9px] p-1.5 rounded border ${note.action === 'BLOCKED' ? "bg-red-50 border-red-200 text-red-700" : note.action === 'UNBLOCKED' ? "bg-green-50 border-green-200 text-green-700" : note.action === 'PAYMENT_MARKED_PAID' ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-700"}`}>
                                                                    <div className="font-bold uppercase">
                                                                        {note.action === 'BLOCKED' ? "🚫 Blocked" : note.action === 'UNBLOCKED' ? "✅ Unblocked" : note.action === 'PAYMENT_MARKED_PAID' ? "💰 Paid" : note.action === 'PAYMENT_MARKED_UNPAID' ? "↩ Unpaid" : note.action}
                                                                    </div>
                                                                    <div>Note: {note.reason}</div>
                                                                    <div className="text-[8px] opacity-70">{new Date(note.timestamp).toLocaleString('en-IN')}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {!isBlocked ? (
                                                        <div className="space-y-1">
                                                            <Input className="h-7 text-xs w-40" placeholder="Block reason (required)..."
                                                                value={blockNotes[t.id] || ""}
                                                                onChange={e => setBlockNotes(p => ({ ...p, [t.id]: e.target.value }))} />
                                                            <Button size="sm" variant="destructive" className="h-7 text-[10px] w-full"
                                                                disabled={!blockNotes[t.id]?.trim()} onClick={() => handleBlock(t.id)}>
                                                                🚫 Block Tenant
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            <div className="text-[10px] text-red-600 font-medium">Blocked: {t.vacatedOn}</div>
                                                            <Input className="h-7 text-xs w-40" placeholder="Unblock reason (required)..."
                                                                value={unblockNotes[t.id] || ""}
                                                                onChange={e => setUnblockNotes(p => ({ ...p, [t.id]: e.target.value }))} />
                                                            <Button size="sm" variant="outline" className="h-7 text-[10px] w-full border-green-300 text-green-700 hover:bg-green-50"
                                                                disabled={!unblockNotes[t.id]?.trim()} onClick={() => handleUnblock(t.id)}>
                                                                ✅ Unblock Tenant
                                                            </Button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                            {expandedTenant === t.id && (
                                                <tr className="bg-blue-50/30">
                                                    <td colSpan={8} className="p-4">
                                                        <div className="text-sm font-bold mb-2">📋 Full Rent History</div>
                                                        <div className="grid grid-cols-4 gap-2">
                                                            {t.rentRecords.map((r: any) => (
                                                                <div key={r.id} className={`p-2 rounded border text-xs ${r.paid ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                                                                    <div className="font-bold">{r.month}</div>
                                                                    <div>{r.paid ? `✅ Paid on ${r.paidOn}` : "❌ Unpaid"}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                                {filteredTenants.length === 0 && (
                                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No tenants found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
