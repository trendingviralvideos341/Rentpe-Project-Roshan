"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    CheckCircle, XCircle, Users, Loader2, Search,
    Eye, Building, ShieldAlert, Phone, Mail, Calendar, Info, AlertTriangle
} from "lucide-react";
import { getTenants, markRentAsPaid, markRentAsUnpaid, blockTenant, unblockTenant } from "@/actions/tenants";
import { ownerFileVacatingNotice } from "@/actions/tenancy";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function TenantsPage() {
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState("ALL");
    const [filterProperty, setFilterProperty] = useState("ALL");
    const [filterStatus, setFilterStatus] = useState("ALL");
    
    // Modal drawer state
    const [selectedTenant, setSelectedTenant] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<"profile" | "ledger" | "support">("profile");

    // Action notes state
    const [blockNote, setBlockNote] = useState("");
    const [unblockNote, setUnblockNote] = useState("");
    const [ledgerNote, setLedgerNote] = useState<Record<string, string>>({});
    const [actionLoading, setActionLoading] = useState(false);

    // Notice override form state
    const [plannedMoveOut, setPlannedMoveOut] = useState("");
    const [moveOutReason, setMoveOutReason] = useState("");

    const currentMonth = new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });

    const fetchTenants = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getTenants();
            setTenants(data);
            // Update selected tenant reference if open to reflect new state
            if (selectedTenant) {
                const updated = data.find((t: any) => t.id === selectedTenant.id);
                if (updated) setSelectedTenant(updated);
            }
        } catch (e: any) {
            toast.error("Failed to fetch tenants: " + e.message);
        } finally {
            setLoading(false);
        }
    }, [selectedTenant]);

    useEffect(() => {
        fetchTenants();
    }, []);

    const handleMarkPaid = async (recordId: string, tenantId: string) => {
        const note = ledgerNote[recordId]?.trim();
        if (!note) {
            toast.error("Please enter a note before marking as paid.");
            return;
        }
        setActionLoading(true);
        try {
            await markRentAsPaid(recordId, note);
            toast.success("Rent marked as paid.");
            setLedgerNote(prev => ({ ...prev, [recordId]: "" }));
            await fetchTenants();
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleMarkUnpaid = async (recordId: string, tenantId: string) => {
        const note = ledgerNote[recordId]?.trim();
        if (!note) {
            toast.error("Please enter a note before reversing payment.");
            return;
        }
        setActionLoading(true);
        try {
            await markRentAsUnpaid(recordId, note);
            toast.success("Payment reversed to unpaid.");
            setLedgerNote(prev => ({ ...prev, [recordId]: "" }));
            await fetchTenants();
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleBlock = async (tenantId: string) => {
        if (!blockNote.trim()) {
            toast.error("Reason is required to block a tenant.");
            return;
        }
        setActionLoading(true);
        try {
            await blockTenant(tenantId, blockNote.trim());
            toast.success("Tenant has been blocked.");
            setBlockNote("");
            await fetchTenants();
        } catch (e: any) {
            toast.error("Error blocking tenant: " + e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleUnblock = async (tenantId: string) => {
        if (!unblockNote.trim()) {
            toast.error("Reason is required to unblock a tenant.");
            return;
        }
        setActionLoading(true);
        try {
            await unblockTenant(tenantId, unblockNote.trim());
            toast.success("Tenant has been unblocked.");
            setUnblockNote("");
            await fetchTenants();
        } catch (e: any) {
            toast.error("Error unblocking tenant: " + e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleInitiateNotice = async (tenantId: string) => {
        if (!plannedMoveOut) {
            toast.error("Please select a target move-out date.");
            return;
        }
        if (!moveOutReason.trim()) {
            toast.error("Please specify a reason for the notice.");
            return;
        }

        setActionLoading(true);
        try {
            await ownerFileVacatingNotice({
                tenantId,
                plannedMoveOut,
                reason: moveOutReason.trim()
            });
            toast.success("Move-Out Notice initiated successfully. Routed to standard Notice settlements.");
            setPlannedMoveOut("");
            setMoveOutReason("");
            await fetchTenants();
        } catch (e: any) {
            toast.error("Error initiating notice: " + e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const properties = Array.from(new Set(tenants.map(t => t.property?.name).filter(Boolean)));

    // Stats calculations
    const activeCount = tenants.filter(t => t.status === "Active").length;
    const upcomingCount = tenants.filter(t => t.status === "Upcoming").length;
    const checkedOutCount = tenants.filter(t => t.status === "Checked Out" || t.status === "Blocked").length;

    const filteredTenants = tenants.filter(t => {
        const matchSearch =
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.phone.includes(search) ||
            t.roomNumber.toLowerCase().includes(search.toLowerCase()) ||
            t.displayId.toLowerCase().includes(search.toLowerCase());

        const matchProperty = filterProperty === "ALL" || t.property?.name === filterProperty;
        const matchType = filterType === "ALL" || t.roomType === filterType;
        const matchStatus = filterStatus === "ALL" || 
            (filterStatus === "ACTIVE" && t.status === "Active") ||
            (filterStatus === "UPCOMING" && t.status === "Upcoming") ||
            (filterStatus === "CHECKED_OUT" && t.status === "Checked Out") ||
            (filterStatus === "BLOCKED" && t.status === "Blocked");

        return matchSearch && matchProperty && matchType && matchStatus;
    });

    if (loading && tenants.length === 0) {
        return (
            <div className="min-h-[400px] flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-slate-500 font-bold">Loading Tenants...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">Support Command Center</h1>
                    <p className="text-muted-foreground text-sm">Monitor all platform tenants, audit dues, log notes, and schedule move-outs safely.</p>
                </div>
            </div>

            {/* Occupancy Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 border-indigo-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-2xl font-black text-indigo-950">{activeCount}</p>
                            <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mt-1">Active Tenants</p>
                        </div>
                        <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-md">
                            <Users className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-2xl font-black text-blue-950">{upcomingCount}</p>
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">Upcoming Move-ins</p>
                        </div>
                        <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-md">
                            <Calendar className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-2xl font-black text-slate-900">{checkedOutCount}</p>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Checked Out / Blocked</p>
                        </div>
                        <div className="w-10 h-10 bg-slate-500 rounded-xl flex items-center justify-center text-white shadow-md">
                            <Building className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter Bar */}
            <Card className="border-slate-100 shadow-sm">
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="flex-1 min-w-[240px] relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <Input
                                placeholder="Search by name, room, phone, display ID..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 bg-slate-50 border-slate-200"
                            />
                        </div>
                        <select
                            className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-xs font-bold text-slate-700"
                            value={filterProperty}
                            onChange={e => setFilterProperty(e.target.value)}
                        >
                            <option value="ALL">All PG Properties</option>
                            {properties.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                        <select
                            className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-xs font-bold text-slate-700"
                            value={filterType}
                            onChange={e => setFilterType(e.target.value)}
                        >
                            <option value="ALL">All Sharing Types</option>
                            <option value="Single Sharing">Single Sharing</option>
                            <option value="Double Sharing">Double Sharing</option>
                            <option value="Three Sharing">Three Sharing</option>
                            <option value="Four Sharing">Four Sharing</option>
                        </select>
                        <select
                            className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-xs font-bold text-slate-700"
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="ACTIVE">✅ Active</option>
                            <option value="UPCOMING">⏳ Upcoming</option>
                            <option value="CHECKED_OUT">🏠 Checked Out</option>
                            <option value="BLOCKED">🚫 Blocked</option>
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* Tenants Data Table */}
            <Card className="border-slate-100 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-900 text-white text-xs font-bold">
                                <tr>
                                    <th className="p-4 uppercase tracking-wider">Tenant ID</th>
                                    <th className="p-4 uppercase tracking-wider">Name & PG</th>
                                    <th className="p-4 uppercase tracking-wider">Contact</th>
                                    <th className="p-4 uppercase tracking-wider">Room/Type</th>
                                    <th className="p-4 uppercase tracking-wider">Start Date</th>
                                    <th className="p-4 uppercase tracking-wider">Rent</th>
                                    <th className="p-4 uppercase tracking-wider">Status</th>
                                    <th className="p-4 uppercase tracking-wider text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {filteredTenants.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                                            No tenants match your search filter.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTenants.map(t => {
                                        const isBlocked = t.status === "Blocked";
                                        const isCheckedOut = t.status === "Checked Out";
                                        const isUpcoming = t.status === "Upcoming";
                                        const isActive = t.status === "Active";

                                        return (
                                            <tr key={t.id} className={`hover:bg-slate-50/50 transition-colors ${isBlocked ? "bg-red-50/20" : ""}`}>
                                                <td className="p-4 font-mono text-xs text-slate-500 font-bold">{t.displayId}</td>
                                                <td className="p-4">
                                                    <p className={`font-bold text-slate-900 ${isBlocked ? "line-through text-slate-400" : ""}`}>{t.name}</p>
                                                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-0.5">{t.property?.name || "Unknown PG"}</p>
                                                </td>
                                                <td className="p-4">
                                                    <p className="text-slate-700 font-medium text-xs">{t.phone}</p>
                                                    <p className="text-slate-400 text-[10px]">{t.email}</p>
                                                </td>
                                                <td className="p-4 text-xs font-bold text-slate-700">
                                                    {t.roomNumber} <span className="text-slate-400 font-normal">({t.roomType})</span>
                                                </td>
                                                <td className="p-4 text-xs text-slate-600 font-semibold">{t.startDate || t.moveInDate}</td>
                                                <td className="p-4 font-bold text-slate-900">₹{t.rentAmount}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                        isActive ? "bg-green-100 text-green-700" :
                                                        isUpcoming ? "bg-blue-100 text-blue-700" :
                                                        isBlocked ? "bg-red-100 text-red-700" :
                                                        "bg-slate-100 text-slate-600"
                                                    }`}>
                                                        {t.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <Button
                                                        size="sm"
                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg px-3 py-1 flex items-center gap-1.5 mx-auto"
                                                        onClick={() => {
                                                            setSelectedTenant(t);
                                                            setActiveTab("profile");
                                                        }}
                                                    >
                                                        <Eye className="w-3.5 h-3.5" /> View Details
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Support Command Center View Details Drawer Dialog */}
            {selectedTenant && (
                <Dialog open={!!selectedTenant} onOpenChange={() => setSelectedTenant(null)}>
                    <DialogContent className="max-w-2xl bg-white border rounded-2xl p-6 shadow-2xl">
                        <DialogHeader className="border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                                    <Users className="w-5 h-5" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-black text-slate-900">{selectedTenant.name}</DialogTitle>
                                    <DialogDescription className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                        ID: {selectedTenant.displayId} · Property: {selectedTenant.property?.name || "Unknown PG"}
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        {/* Navigation Tabs */}
                        <div className="flex border-b border-slate-100 gap-2 mt-4">
                            {[
                                { id: "profile", label: "Tenant Profile", icon: Users },
                                { id: "ledger", label: "Tenancy Ledger", icon: Info },
                                { id: "support", label: "Admin Overrides", icon: ShieldAlert },
                            ].map(t => {
                                const Icon = t.icon;
                                return (
                                    <button
                                        key={t.id}
                                        onClick={() => setActiveTab(t.id as any)}
                                        className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                                            activeTab === t.id
                                                ? "border-indigo-600 text-indigo-600"
                                                : "border-transparent text-slate-400 hover:text-slate-600"
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {t.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="py-4 space-y-4 max-h-[400px] overflow-y-auto pr-1">
                            {/* TAB 1: Profile */}
                            {activeTab === "profile" && (
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Full Name</p>
                                        <p className="font-bold text-slate-900">{selectedTenant.name}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Status</p>
                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                            selectedTenant.status === "Active" ? "bg-green-100 text-green-700" :
                                            selectedTenant.status === "Upcoming" ? "bg-blue-100 text-blue-700" :
                                            "bg-red-100 text-red-700"
                                        }`}>{selectedTenant.status}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</p>
                                        <p className="font-bold text-slate-900">{selectedTenant.phone}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1"><Mail className="w-3 h-3" /> Email</p>
                                        <p className="font-bold text-slate-900">{selectedTenant.email}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Assigned Room</p>
                                        <p className="font-bold text-slate-900">{selectedTenant.roomNumber} ({selectedTenant.roomType})</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Monthly Rent</p>
                                        <p className="font-bold text-slate-900">₹{selectedTenant.rentAmount || selectedTenant.rent}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Contract Start Date</p>
                                        <p className="font-bold text-slate-900">{selectedTenant.startDate || selectedTenant.moveInDate}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Booking Reference</p>
                                        <p className="font-mono text-xs font-bold text-slate-600">{selectedTenant.booking?.displayId || "N/A"}</p>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: Ledger */}
                            {activeTab === "ledger" && (
                                <div className="space-y-3">
                                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Rent Invoices & Payments</h4>
                                    {selectedTenant.rentRecords?.length === 0 ? (
                                        <p className="text-xs text-slate-400 text-center py-4">No rent records generated for this tenant.</p>
                                    ) : (
                                        <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
                                            {selectedTenant.rentRecords.map((r: any) => (
                                                <div key={r.id} className="p-3 bg-slate-50 flex items-center justify-between flex-wrap gap-2 text-xs">
                                                    <div>
                                                        <p className="font-bold text-slate-900">{r.month}</p>
                                                        <p className="text-slate-500 font-semibold mt-0.5">Amount: ₹{r.amount}</p>
                                                        {r.note && <p className="text-[10px] text-indigo-500 font-medium">Note: {r.note}</p>}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${
                                                            r.paid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                                        }`}>
                                                            {r.paid ? `Paid (${r.paidOn})` : "Unpaid"}
                                                        </span>
                                                        
                                                        <div className="flex items-center gap-1.5">
                                                            <Input
                                                                className="h-7 text-xs w-28 bg-white"
                                                                placeholder="Note for override..."
                                                                value={ledgerNote[r.id] || ""}
                                                                onChange={e => setLedgerNote(prev => ({ ...prev, [r.id]: e.target.value }))}
                                                            />
                                                            {r.paid ? (
                                                                <Button
                                                                    size="sm"
                                                                    disabled={actionLoading}
                                                                    className="h-7 text-[10px] bg-red-600 hover:bg-red-700"
                                                                    onClick={() => handleMarkUnpaid(r.id, selectedTenant.id)}
                                                                >
                                                                    Force Unpaid
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    size="sm"
                                                                    disabled={actionLoading}
                                                                    className="h-7 text-[10px] bg-green-600 hover:bg-green-700"
                                                                    onClick={() => handleMarkPaid(r.id, selectedTenant.id)}
                                                                >
                                                                    Force Paid
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 3: Support Actions */}
                            {activeTab === "support" && (
                                <div className="space-y-6">
                                    {/* Eviction/Block controls */}
                                    <div className="p-4 bg-red-50/50 border border-red-200 rounded-2xl space-y-3">
                                        <h4 className="font-bold text-red-800 text-xs uppercase tracking-widest flex items-center gap-1.5">
                                            <AlertTriangle className="w-4 h-4" /> Block & Evict Tenant (Emergency)
                                        </h4>
                                        <p className="text-xs text-red-700">Evicting a tenant will seize the deposit against dues and vacate the bed immediately.</p>
                                        
                                        {selectedTenant.status !== "Blocked" ? (
                                            <div className="space-y-2">
                                                <Input
                                                    placeholder="Reason for blocking tenant (required)..."
                                                    value={blockNote}
                                                    onChange={e => setBlockNote(e.target.value)}
                                                    className="bg-white border-red-200 text-xs"
                                                />
                                                <Button
                                                    size="sm"
                                                    disabled={actionLoading || !blockNote.trim()}
                                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold"
                                                    onClick={() => handleBlock(selectedTenant.id)}
                                                >
                                                    🚫 Evict & Block Tenant
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <Input
                                                    placeholder="Reason for unblocking tenant (required)..."
                                                    value={unblockNote}
                                                    onChange={e => setUnblockNote(e.target.value)}
                                                    className="bg-white border-red-200 text-xs"
                                                />
                                                <Button
                                                    size="sm"
                                                    disabled={actionLoading || !unblockNote.trim()}
                                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                                    onClick={() => handleUnblock(selectedTenant.id)}
                                                >
                                                    ✓ Restore & Unblock Tenant
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Safe Move-Out Notice Override */}
                                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-3">
                                        <h4 className="font-bold text-indigo-950 text-xs uppercase tracking-widest flex items-center gap-1.5">
                                            <Info className="w-4 h-4" /> Schedule Move-Out Notice (Recommended)
                                        </h4>
                                        <p className="text-xs text-indigo-700">
                                            This schedules a formal move-out date. The student will be put in the standard notices settlement queue to correctly calculate security deposit refunds and pro-rata rent.
                                        </p>
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-indigo-900 uppercase">Move-Out Date</label>
                                                    <Input
                                                        type="date"
                                                        className="bg-white border-indigo-200 text-xs h-9"
                                                        value={plannedMoveOut}
                                                        onChange={e => setPlannedMoveOut(e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-indigo-900 uppercase">Reason</label>
                                                    <Input
                                                        placeholder="e.g. Agreement End, Relocation..."
                                                        className="bg-white border-indigo-200 text-xs h-9"
                                                        value={moveOutReason}
                                                        onChange={e => setMoveOutReason(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                disabled={actionLoading || !plannedMoveOut || !moveOutReason.trim()}
                                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                                                onClick={() => handleInitiateNotice(selectedTenant.id)}
                                            >
                                                Initiate Move-Out Notice
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Tenant Audit Logs */}
                                    <div className="space-y-2">
                                        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Tenant Audit Log History</h4>
                                        {selectedTenant.actionNotes?.length === 0 ? (
                                            <p className="text-xs text-slate-400 text-center py-2">No history logged for this tenant.</p>
                                        ) : (
                                            <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                                {selectedTenant.actionNotes.map((note: any, i: number) => (
                                                    <div key={i} className="text-xs p-2 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-start">
                                                        <div>
                                                            <span className="font-black text-[9px] uppercase tracking-wider bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">
                                                                {note.action}
                                                            </span>
                                                            <p className="text-slate-700 mt-1">{note.reason}</p>
                                                        </div>
                                                        <span className="text-[9px] text-slate-400">{new Date(note.timestamp).toLocaleDateString('en-IN')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
