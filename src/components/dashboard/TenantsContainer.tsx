"use client";

import { Fragment, useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, PlusCircle, ClipboardCheck } from "lucide-react";
import { getTenants, markRentAsPaid, markRentAsUnpaid, blockTenant, unblockTenant, generateNextRentRecord, initiateMoveOut } from "@/actions/tenants";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function TenantsContainer() {
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
    const [showGenerateRent, setShowGenerateRent] = useState<Record<string, boolean>>({});
    const [generateMonth, setGenerateMonth] = useState<Record<string, string>>({});
    const [showMoveOut, setShowMoveOut] = useState<Record<string, boolean>>({});
    const [moveOutDeductions, setMoveOutDeductions] = useState<Record<string, string>>({});
    const [moveOutNote, setMoveOutNote] = useState<Record<string, string>>({});
    const [viewingChecklist, setViewingChecklist] = useState<any>(null);

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
            toast.success("Rent marked as Paid.");
            await fetchTenants();
        } catch { toast.error("Failed to mark rent as paid."); }
    };

    const handleMarkUnpaid = (recordId: string, tenantId: string) => {
        const note = payNotes[tenantId]?.trim();
        if (!note) { toast.error("Please enter a note before reversing payment."); return; }
        toast("Reverse this payment to UNPAID?", {
            action: {
                label: "Confirm",
                onClick: async () => {
                    try {
                        await markRentAsUnpaid(recordId, note);
                        setPayNotes(p => ({ ...p, [tenantId]: "" }));
                        setShowPayNote(p => ({ ...p, [tenantId]: false }));
                        toast.success("Rent reversed to Unpaid.");
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
            toast.success("Tenant successfully blocked.");
            await fetchTenants();
        } catch { toast.error("Failed to block tenant."); }
    };

    const handleUnblock = async (tenantId: string) => {
        const note = unblockNotes[tenantId]?.trim();
        if (!note) { toast.error("Please enter a reason before unblocking this tenant."); return; }
        try {
            await unblockTenant(tenantId, note);
            setUnblockNotes(p => { const n = { ...p }; delete n[tenantId]; return n; });
            toast.success("Tenant unblocked and reactivated.");
            await fetchTenants();
        } catch { toast.error("Failed to unblock tenant."); }
    };

    const handleGenerateRent = async (tenantId: string) => {
        const month = generateMonth[tenantId] || currentMonth;
        try {
            await generateNextRentRecord(tenantId, month);
            setShowGenerateRent(p => ({ ...p, [tenantId]: false }));
            toast.success(`Rent invoice generated for ${month}`);
            await fetchTenants();
        } catch (e: any) {
            toast.error(e.message || "Failed to generate rent.");
        }
    };

    const handleMoveOut = async (tenantId: string) => {
        const deductions = parseFloat(moveOutDeductions[tenantId] || "0");
        const note = moveOutNote[tenantId]?.trim();
        if (!note) { toast.error("Please enter a move-out note/settlement summary."); return; }

        try {
            await initiateMoveOut(tenantId, deductions, note);
            setShowMoveOut(p => ({ ...p, [tenantId]: false }));
            toast.success("Move-out processed. Room is now vacant.");
            await fetchTenants();
        } catch (e: any) {
            toast.error(e.message || "Failed to process move-out.");
        }
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

        if (filterPayment === ("BLOCKED" as any)) return matchSearch && matchType && matchProperty && t.status === "Blocked";
        
        const matchPayment = filterPayment === "ALL" || (filterPayment === "PAID" && isPaid) || (filterPayment === "UNPAID" && !isPaid);
        return matchSearch && matchType && matchProperty && matchPayment && t.status !== "Blocked";
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const unpaidCount = tenants.filter(t => {
        const latestRent = t.rentRecords.find((r: any) => r.month === currentMonth);
        return !latestRent?.paid && t.status === "Active";
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

            {/* ── Mobile Cards ── */}
            <div className="md:hidden space-y-3">
                {filteredTenants.length === 0 ? (
                    <p className="text-center text-muted-foreground py-12">No tenants found.</p>
                ) : filteredTenants.map(t => {
                    const latestRent = t.rentRecords.find((r: any) => r.month === currentMonth);
                    const isPaid = latestRent?.paid ?? false;
                    const isBlocked = t.status === "Blocked";
                    const isCheckedOut = t.status === "Checked Out";
                    return (
                        <div key={t.id} className={`bg-white border rounded-2xl p-4 shadow-sm space-y-3 ${
                            isBlocked ? "border-l-4 border-l-red-400" : isPaid ? "border-l-4 border-l-green-400" : "border-l-4 border-l-amber-400"}`}>
                            <div className="flex justify-between items-start gap-2">
                                <div>
                                    <p className={`font-black text-sm ${isBlocked ? "text-red-500" : isCheckedOut ? "text-slate-500 italic" : ""}`}>{t.name}</p>
                                    <p className="text-[10px] font-mono text-purple-600">{t.displayId}</p>
                                    <p className="text-[10px] text-indigo-600 font-bold">{t.property?.name}</p>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-[10px] font-black ${
                                    isBlocked ? "bg-red-100 text-red-700" :
                                    isCheckedOut ? "bg-slate-100 text-slate-600" :
                                    isPaid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                    {isBlocked ? "🚫 Blocked" : isCheckedOut ? "🏠 Out" : isPaid ? "✅ Paid" : "❌ Unpaid"}
                                </span>
                            </div>
                            <div className="text-xs text-slate-600 space-y-1">
                                <p>🛏 {t.roomNumber} ({t.roomType})</p>
                                <p>💰 ₹{t.rentAmount}/month</p>
                                <p>📅 Move-in: {t.moveInDate}</p>
                            </div>
                            {!isBlocked && !isCheckedOut && (
                                <div className="flex gap-2 flex-wrap">
                                    {latestRent && !showPayNote[t.id] && (
                                        <Button size="sm" variant="outline" className="text-xs flex-1"
                                            onClick={() => setShowPayNote(p => ({ ...p, [t.id]: true }))}>
                                            {isPaid ? "↩ Mark Unpaid" : "✓ Mark Paid"}
                                        </Button>
                                    )}
                                    <Button size="sm" variant="outline" className="text-xs border-blue-300 text-blue-700"
                                        onClick={() => setShowMoveOut(p => ({ ...p, [t.id]: true }))}>
                                        🚶 Move Out
                                    </Button>
                                </div>
                            )}
                            {showPayNote[t.id] && latestRent && (
                                <div className="space-y-2 pt-2 border-t">
                                    <input className="w-full border rounded-lg p-2 text-xs" placeholder="Note (mandatory)..."
                                        value={payNotes[t.id] || ""}
                                        onChange={e => setPayNotes(p => ({ ...p, [t.id]: e.target.value }))} />
                                    <div className="flex gap-2">
                                        {!isPaid && (
                                            <Button size="sm" className="bg-green-600 flex-1 text-xs" onClick={() => handleMarkPaid(latestRent.id, t.id)}>Confirm Paid</Button>
                                        )}
                                        {isPaid && (
                                            <Button size="sm" variant="outline" className="border-red-300 text-red-600 flex-1 text-xs" onClick={() => handleMarkUnpaid(latestRent.id, t.id)}>Confirm Reverse</Button>
                                        )}
                                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowPayNote(p => ({ ...p, [t.id]: false }))}>✕</Button>
                                    </div>
                                </div>
                            )}
                            {isBlocked && (
                                <div className="space-y-2 pt-2 border-t">
                                    <input className="w-full border rounded-lg p-2 text-xs" placeholder="Unblock reason..."
                                        value={unblockNotes[t.id] || ""}
                                        onChange={e => setUnblockNotes(p => ({ ...p, [t.id]: e.target.value }))} />
                                    <Button size="sm" variant="outline" className="w-full text-xs border-green-300 text-green-700"
                                        onClick={() => handleUnblock(t.id)}>✅ Unblock</Button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Desktop Table ── */}
            <div className="hidden md:block">
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted border-b">
                                <tr>
                                    <th className="p-4 text-left font-medium">Tenant ID</th>
                                    <th className="p-4 text-left font-medium">Name &amp; PG</th>
                                    <th className="p-4 text-left font-medium">Room</th>
                                    <th className="p-4 text-left font-medium">Start Date</th>
                                    <th className="p-4 text-left font-medium">Monthly Rent</th>
                                    <th className="p-4 text-left font-medium">{currentMonth} Status</th>
                                    <th className="p-4 text-left font-medium">Status &amp; History</th>
                                    <th className="p-4 text-left font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTenants.map(t => {
                                    const latestRent = t.rentRecords.find((r: any) => r.month === currentMonth);
                                    const isPaid = latestRent?.paid ?? false;
                                    const isBlocked = t.status === "Blocked";
                                    const isCheckedOut = t.status === "Checked Out";
                                    const historyExpanded = expandedHistory.has(t.id);

                                    return (
                                        <Fragment key={t.id}>
                                        <tr className={`border-b hover:bg-muted/5 ${isCheckedOut ? "bg-slate-50 opacity-80" : isBlocked ? "bg-red-50" : ""}`}>
                                            <td className="p-4 font-mono text-xs text-purple-700 font-bold">{t.displayId}</td>
                                                <td className="p-4">
                                                    <div className={`font-medium ${isCheckedOut ? "text-slate-500 italic" : isBlocked ? "text-red-500" : ""}`}>{t.name}</div>
                                                    <div className="text-[10px] text-indigo-600 font-bold uppercase">{t.property?.name || "Unknown PG"}</div>
                                                    <div className="text-xs text-muted-foreground">{t.phone}</div>
                                                </td>
                                                <td className="p-4 text-sm">{t.roomNumber} <span className="text-xs text-muted-foreground">({t.roomType})</span></td>
                                                <td className="p-4 text-sm">{t.moveInDate}</td>
                                                <td className="p-4 font-bold">₹{t.rentAmount}</td>

                                                {/* Payment Status */}
                                                <td className="p-4">
                                                    {isCheckedOut ? (
                                                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">🏠 Checked Out</span>
                                                    ) : isBlocked ? (
                                                        <span className="text-xs text-red-500 font-bold uppercase tracking-wider">🚫 Blocked</span>
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
                                                                                    <Button size="sm" className="h-6 text-[10px] bg-green-600 hover:bg-green-700" onClick={() => handleMarkPaid(latestRent.id, t.id)}>✓ Mark Paid</Button>
                                                                                )}
                                                                                {isPaid && (
                                                                                    <Button size="sm" variant="outline" className="h-6 text-[10px] border-red-300 text-red-600" onClick={() => handleMarkUnpaid(latestRent.id, t.id)}>↩ Unpaid</Button>
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

                                                {/* Status & History */}
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isCheckedOut ? "bg-slate-100 text-slate-600" : isBlocked ? "bg-red-100 text-red-800" : t.status === 'Upcoming' ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                                                            {isCheckedOut ? "Checked Out" : isBlocked ? "Blocked" : t.status === 'Upcoming' ? "Upcoming" : "Active"}
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
                                                                <div key={i} className={`text-[9px] p-1.5 rounded border ${
                                                                    note.action === 'MOVED_OUT' ? "bg-slate-50 border-slate-200 text-slate-700" :
                                                                    note.action === 'BLOCKED' ? "bg-red-50 border-red-200 text-red-700" :
                                                                    note.action === 'UNBLOCKED' ? "bg-green-50 border-green-200 text-green-700" :
                                                                    note.action === 'PAYMENT_MARKED_PAID' ? "bg-blue-50 border-blue-200 text-blue-700" :
                                                                    "bg-gray-50 border-gray-200 text-gray-700"}`}>
                                                                    <div className="font-bold uppercase">
                                                                        {note.action === 'MOVED_OUT' ? "🏠 Moved Out" : note.action === 'BLOCKED' ? "🚫 Blocked" : note.action === 'UNBLOCKED' ? "✅ Unblocked" : note.action === 'PAYMENT_MARKED_PAID' ? "💰 Paid" : note.action === 'PAYMENT_MARKED_UNPAID' ? "↩ Unpaid" : note.action}
                                                                    </div>
                                                                    <div>Note: {note.reason}</div>
                                                                    <div className="text-[8px] opacity-70">{new Date(note.timestamp).toLocaleString('en-IN')}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Actions column */}
                                                <td className="p-4 text-center">
                                                    <div className="flex flex-col gap-1 items-center">
                                                        {!isBlocked ? (
                                                            <>
                                                                <Button size="sm" variant="outline"
                                                                    className="h-7 text-[10px] w-full border-blue-400 text-blue-700 hover:bg-blue-50"
                                                                    onClick={() => setShowMoveOut(p => ({ ...p, [t.id]: true }))}>
                                                                    🚶 Move Out &amp; Settlement
                                                                </Button>
                                                                <Input className="h-7 text-xs w-full" placeholder="Block reason..."
                                                                    value={blockNotes[t.id] || ""}
                                                                    onChange={e => setBlockNotes(p => ({ ...p, [t.id]: e.target.value }))} />
                                                                <Button size="sm" variant="destructive" className="h-7 text-[10px] w-full"
                                                                    disabled={!blockNotes[t.id]?.trim()}
                                                                    onClick={() => handleBlock(t.id)}>
                                                                    🚫 Block Tenant
                                                                </Button>
                                                                {showGenerateRent[t.id] ? (
                                                                    <div className="space-y-1 w-full pt-1 border-t mt-1">
                                                                        <Input type="month" className="h-7 text-xs"
                                                                            value={generateMonth[t.id] || ""}
                                                                            onChange={e => setGenerateMonth(p => ({ ...p, [t.id]: e.target.value }))} />
                                                                        <div className="flex gap-1">
                                                                            <Button size="sm" className="h-6 text-[10px] flex-1" onClick={() => handleGenerateRent(t.id)}>Generate</Button>
                                                                            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setShowGenerateRent(p => ({ ...p, [t.id]: false }))}>✕</Button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <Button size="sm" variant="outline" className="h-7 text-[10px] w-full bg-blue-50 border-blue-200"
                                                                        onClick={() => setShowGenerateRent(p => ({ ...p, [t.id]: true }))}>
                                                                        <PlusCircle className="mr-1 h-3 w-3" /> Rent
                                                                    </Button>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Input className="h-7 text-xs w-full" placeholder="Unblock reason..."
                                                                    value={unblockNotes[t.id] || ""}
                                                                    onChange={e => setUnblockNotes(p => ({ ...p, [t.id]: e.target.value }))} />
                                                                <Button size="sm" variant="outline" className="h-7 text-[10px] w-full border-green-300 text-green-700 hover:bg-green-50"
                                                                    onClick={() => handleUnblock(t.id)}>
                                                                    ✅ Unblock
                                                                </Button>
                                                            </>
                                                        )}
                                                        {t.booking?.moveInChecklist && (
                                                            <Button size="sm" variant="outline"
                                                                className="h-7 text-[10px] w-full mt-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                                                onClick={() => setViewingChecklist(t)}>
                                                                <ClipboardCheck className="mr-1 h-3.5 w-3.5" /> Checklist
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Rent History Expandable */}
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
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
            </div>

            {/* Move Out Dialogs */}
            {filteredTenants.map(t => (
                <Dialog key={`moveout-${t.id}`} open={!!showMoveOut[t.id]} onOpenChange={(open) => setShowMoveOut(p => ({ ...p, [t.id]: open }))}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-blue-600" />
                                Settlement
                            </DialogTitle>
                            <DialogDescription>
                                Process move-out for {t.name}.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4 text-sm">
                            <div className="p-3 bg-red-50 rounded-lg border border-red-100 font-bold">
                                Unpaid Rent: ₹{t.rentRecords.filter((r: any) => !r.paid).reduce((acc: number, r: any) => acc + parseFloat(r.amount), 0).toLocaleString()}
                            </div>
                            <div className="space-y-2">
                                <label className="font-semibold block">Damage Deductions (₹)</label>
                                <Input type="number" value={moveOutDeductions[t.id] || "0"} onChange={e => setMoveOutDeductions(p => ({ ...p, [t.id]: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <label className="font-semibold block">Notes</label>
                                <textarea className="w-full border p-2 rounded h-20 bg-muted/20" value={moveOutNote[t.id] || ""} onChange={e => setMoveOutNote(p => ({ ...p, [t.id]: e.target.value }))} />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setShowMoveOut(p => ({ ...p, [t.id]: false }))}>Cancel</Button>
                            <Button className="bg-blue-600" onClick={() => handleMoveOut(t.id)}>Finalize</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            ))}

            {/* View Checklist Dialog */}
            <Dialog open={!!viewingChecklist} onOpenChange={(open) => !open && setViewingChecklist(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                            Move-in Checklist
                        </DialogTitle>
                        <DialogDescription>
                            Reviewing checklist for <strong>{viewingChecklist?.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
                        {(() => {
                            if (!viewingChecklist?.booking?.moveInChecklist) return null;
                            let items = [];
                            try {
                                items = typeof viewingChecklist.booking.moveInChecklist.items === 'string' 
                                    ? JSON.parse(viewingChecklist.booking.moveInChecklist.items) 
                                    : viewingChecklist.booking.moveInChecklist.items;
                            } catch (e) { console.error(e); }

                            if (!items || items.length === 0) return <p className="text-center text-muted-foreground py-8">No items recorded.</p>;

                            return items.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 text-sm">
                                    <span className="font-medium">{item.task}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.status === 'COMPLETED' ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                                        {item.status}
                                    </span>
                                </div>
                            ));
                        })()}
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setViewingChecklist(null)} className="w-full">Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
