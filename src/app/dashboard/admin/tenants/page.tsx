"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    CheckCircle, XCircle, Users, Loader2, Search,
    Eye, Building, ShieldAlert, Phone, Mail, Calendar, Info, AlertTriangle,
    X, Download, FileText, CheckCircle2
} from "lucide-react";
import { getTenants, markRentAsPaid, markRentAsUnpaid, blockTenant, unblockTenant } from "@/actions/tenants";
import { getInvoiceForReceipt } from "@/actions/payments";
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

    // Dialog state for Marking Paid
    const [markingPaidRecord, setMarkingPaidRecord] = useState<any>(null);
    const [overrideMethod, setOverrideMethod] = useState<'CASH' | 'ONLINE'>('CASH');
    const [overrideReason, setOverrideReason] = useState('');

    // Dialog state for Viewing Receipt
    const [viewingReceiptInvoice, setViewingReceiptInvoice] = useState<any>(null);
    const [receiptLoading, setReceiptLoading] = useState(false);

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

    const handleConfirmMarkPaid = async () => {
        if (!markingPaidRecord) return;
        if (!overrideReason.trim()) {
            toast.error("Please enter a mandatory reason/reference.");
            return;
        }
        setActionLoading(true);
        try {
            await markRentAsPaid(markingPaidRecord.id, overrideMethod, overrideReason.trim());
            toast.success("Rent marked as paid successfully.");
            setMarkingPaidRecord(null);
            setOverrideReason("");
            await fetchTenants();
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleViewReceipt = async (invoiceId: string) => {
        setReceiptLoading(true);
        try {
            const data = await getInvoiceForReceipt(invoiceId);
            setViewingReceiptInvoice(data);
        } catch (e: any) {
            toast.error("Failed to load receipt: " + e.message);
        } finally {
            setReceiptLoading(false);
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
                                { id: "ledger", label: "Tenant Payment History", icon: Info },
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

                            {/* TAB 2: Tenant Payment History (formerly Ledger) */}
                            {activeTab === "ledger" && (
                                <div className="space-y-3">
                                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Rent Invoices & Payments</h4>
                                    {selectedTenant.rentRecords?.length === 0 ? (
                                        <p className="text-xs text-slate-400 text-center py-4">No rent records generated for this tenant.</p>
                                    ) : (
                                        <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
                                            {selectedTenant.rentRecords.map((r: any) => {
                                                const matchingInvoice = selectedTenant.billingProfile?.invoices?.find(
                                                    (inv: any) => inv.month === r.month
                                                );
                                                const payment = matchingInvoice?.payments?.[0];
                                                
                                                return (
                                                    <div key={r.id} className="p-3.5 bg-slate-50 flex flex-col gap-2 text-xs">
                                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                                            <div>
                                                                <p className="font-bold text-slate-900 text-sm">{r.month}</p>
                                                                <p className="text-slate-500 font-semibold mt-0.5">Rent Due: ₹{r.amount}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${
                                                                    r.paid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                                                }`}>
                                                                    {r.paid ? `Paid (${r.paidOn})` : "Unpaid"}
                                                                </span>

                                                                {r.paid && matchingInvoice && (
                                                                    <Button
                                                                        size="sm"
                                                                        className="h-7 text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200"
                                                                        onClick={() => handleViewReceipt(matchingInvoice.id)}
                                                                        disabled={receiptLoading}
                                                                    >
                                                                        <Eye className="w-3 h-3 mr-1" /> View Receipt
                                                                    </Button>
                                                                )}

                                                                {!r.paid ? (
                                                                    <Button
                                                                        size="sm"
                                                                        disabled={actionLoading}
                                                                        className="h-7 text-[10px] bg-green-600 hover:bg-green-700 text-white font-bold"
                                                                        onClick={() => {
                                                                            setMarkingPaidRecord(r);
                                                                            setOverrideMethod('CASH');
                                                                            setOverrideReason('');
                                                                        }}
                                                                    >
                                                                        Mark Paid
                                                                    </Button>
                                                                ) : (
                                                                    <div className="flex items-center gap-1">
                                                                        <Input
                                                                            className="h-7 text-xs w-28 bg-white"
                                                                            placeholder="Reversal note..."
                                                                            value={ledgerNote[r.id] || ""}
                                                                            onChange={e => setLedgerNote(prev => ({ ...prev, [r.id]: e.target.value }))}
                                                                        />
                                                                        <Button
                                                                            size="sm"
                                                                            disabled={actionLoading}
                                                                            className="h-7 text-[10px] bg-red-600 hover:bg-red-700 text-white font-bold"
                                                                            onClick={() => handleMarkUnpaid(r.id, selectedTenant.id)}
                                                                        >
                                                                            Force Unpaid
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Step 4 requirement: display audit notes for cash/online payments */}
                                                        {r.paid && (
                                                            <div className="bg-white border border-slate-100 rounded-lg p-2 mt-1 text-[10px] text-slate-500 font-mono">
                                                                {matchingInvoice?.paymentMethod === 'ONLINE' || payment ? (
                                                                    <p className="text-indigo-600 font-bold flex items-center gap-1">
                                                                        ⚡ ONLINE: Paid on {matchingInvoice?.paidAt ? new Date(matchingInvoice.paidAt).toLocaleString('en-IN') : r.paidOn} via Razorpay (Tx ID: {payment?.razorpayId || matchingInvoice?.paymentRef || 'Verified'})
                                                                    </p>
                                                                ) : (
                                                                    <p className="text-amber-600 font-bold">
                                                                        💵 CASH: Direct settlement (Confirmed by {matchingInvoice?.confirmedByName || 'Owner/Admin'})
                                                                        {r.note && <span className="block text-slate-500 font-normal mt-0.5 font-sans">Audit details: {r.note}</span>}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
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

            {/* Mark Paid Override Dialog */}
            {markingPaidRecord && (
                <Dialog open={!!markingPaidRecord} onOpenChange={() => setMarkingPaidRecord(null)}>
                    <DialogContent className="max-w-md bg-white border rounded-2xl p-6 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600" /> Mark Rent Invoice as Paid
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-400 font-bold uppercase mt-1">
                                Month: {markingPaidRecord.month} · Rent Amount: ₹{markingPaidRecord.amount}
                            </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4 py-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Payment Mode</label>
                                <select
                                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                    value={overrideMethod}
                                    onChange={e => setOverrideMethod(e.target.value as any)}
                                >
                                    <option value="CASH">💵 Cash Paid</option>
                                    <option value="ONLINE">💳 Online Paid (Gateway / UPI Override)</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Mandatory Notes / Reference (Required)</label>
                                <Input
                                    placeholder={overrideMethod === 'ONLINE' ? "e.g. Razorpay Transaction ID (pay_xxxx) or UTR Ref..." : "e.g. Cash received by owner / direct payment remarks..."}
                                    value={overrideReason}
                                    onChange={e => setOverrideReason(e.target.value)}
                                    className="bg-slate-50 border-slate-200 text-xs"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setMarkingPaidRecord(null)}
                                className="font-bold border-slate-200 rounded-xl"
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                disabled={actionLoading || !overrideReason.trim()}
                                onClick={handleConfirmMarkPaid}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl"
                            >
                                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null} Confirm Payment
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* View Receipt Dialog (Mirrors Tenant/Student Copy Modal) */}
            {viewingReceiptInvoice && (
                <Dialog open={!!viewingReceiptInvoice} onOpenChange={() => setViewingReceiptInvoice(null)}>
                    <DialogContent className="max-w-3xl bg-white border rounded-2xl p-0 overflow-hidden shadow-2xl">
                        {/* Title Bar */}
                        <div className="bg-[#4C28D5] px-6 py-4 flex items-center justify-between text-white border-b border-indigo-700">
                            <div className="flex items-center gap-2 font-black text-sm uppercase tracking-wider">
                                <FileText className="w-5 h-5 text-indigo-200" /> Rent Receipt <span className="text-indigo-200">#{viewingReceiptInvoice.displayId}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={`/api/receipts/${viewingReceiptInvoice.id}?download=1`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#10B981] hover:bg-[#059669] text-white text-xs font-black rounded-xl transition-all shadow-md"
                                >
                                    <Download className="w-3.5 h-3.5" /> Download PDF
                                </a>
                                <button 
                                    onClick={() => setViewingReceiptInvoice(null)} 
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all"
                                >
                                    <X className="w-3.5 h-3.5" /> Close
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 md:p-8 space-y-6 max-h-[480px] overflow-y-auto">
                            {/* Purple Banner */}
                            <div className="bg-[#6332F6] rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center text-white relative overflow-hidden shadow-md">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight">RentPe</h2>
                                    <p className="text-indigo-200 text-sm font-medium mt-1">Verified PGs & Hostels</p>
                                </div>
                                <div className="my-3 md:my-0 flex justify-center items-center relative z-10">
                                    <span className="inline-flex items-center px-4 py-1.5 bg-white/25 text-white text-sm font-black rounded-xl uppercase tracking-widest border border-white/20 shadow-sm">
                                        Tenant Copy
                                    </span>
                                </div>
                                <div className="text-left md:text-right mt-4 md:mt-0 relative z-10">
                                    <h3 className="text-lg font-black uppercase tracking-widest">RENT RECEIPT</h3>
                                    <p className="text-indigo-200 text-sm font-bold mb-2">#{viewingReceiptInvoice.displayId}</p>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#10B981] text-white text-[10px] font-black uppercase tracking-wider rounded-md">
                                        ✓ PAID
                                    </span>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] mb-2">TENANT DETAILS</p>
                                    <p className="font-black text-[#0F172A] text-base">{viewingReceiptInvoice.tenantName}</p>
                                    <p className="text-xs text-[#64748B] mt-1 font-mono">{viewingReceiptInvoice.tenantDisplayId}</p>
                                    <p className="text-xs text-[#64748B] mt-1">Email: {viewingReceiptInvoice.tenantEmail}</p>
                                    <p className="text-xs text-[#64748B] mt-1">Room: {viewingReceiptInvoice.tenantRoom} ({viewingReceiptInvoice.tenantRoomType || '—'})</p>
                                    {viewingReceiptInvoice.stayFrom && (
                                        <p className="text-xs text-[#64748B] mt-1">Stay from: <span className="font-bold text-[#334155]">{viewingReceiptInvoice.stayFrom}</span></p>
                                    )}
                                </div>
                                <div className="bg-[#F0F9FF] border border-[#E0F2FE] rounded-xl p-5">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[#7DD3FC] mb-2">PROPERTY DETAILS</p>
                                    <p className="font-black text-[#0369A1] text-base">{viewingReceiptInvoice.propertyName}</p>
                                    <p className="text-xs text-[#0284C7] mt-1 leading-relaxed max-w-[200px]">
                                        {viewingReceiptInvoice.propertyAddress}
                                    </p>
                                </div>
                            </div>

                            {/* Payment Summary */}
                            <div>
                                <div className="bg-[#4C28D5] text-white px-4 py-2 rounded-t-xl text-[10px] font-black uppercase tracking-widest">
                                    PAYMENT SUMMARY
                                </div>
                                <div className="border border-[#E2E8F0] border-t-0 rounded-b-xl overflow-hidden text-xs divide-y divide-[#F1F5F9] bg-[#F8FAFC]">
                                    <div className="flex justify-between items-center px-4 py-3 bg-white">
                                        <span className="text-[#64748B]">Period / Month</span>
                                        <span className="font-bold text-[#0F172A]">{viewingReceiptInvoice.month}</span>
                                    </div>
                                    <div className="flex justify-between items-center px-4 py-3 bg-white">
                                        <span className="text-[#64748B]">Invoice ID</span>
                                        <span className="font-mono font-bold text-[#0F172A]">{viewingReceiptInvoice.displayId}</span>
                                    </div>
                                    <div className="flex justify-between items-center px-4 py-3 bg-white">
                                        <span className="text-[#64748B]">Rent Amount</span>
                                        <span className="font-bold text-[#0F172A]">₹{Number(viewingReceiptInvoice.rentAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    {Number(viewingReceiptInvoice.foodAmount) > 0 && (
                                        <div className="flex justify-between items-center px-4 py-3 bg-white">
                                            <span className="text-[#64748B]">Food Charges</span>
                                            <span className="font-bold text-[#0F172A]">₹{Number(viewingReceiptInvoice.foodAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    {Number(viewingReceiptInvoice.creditApplied) > 0 && (
                                        <div className="flex justify-between items-center px-4 py-3 bg-white">
                                            <span className="text-[#64748B]">Credit Applied</span>
                                            <span className="font-bold text-[#D97706]">- ₹{Number(viewingReceiptInvoice.creditApplied).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center px-4 py-3 bg-white">
                                        <span className="text-[#64748B]">Due Date</span>
                                        <span className="font-bold text-[#0F172A]">{viewingReceiptInvoice.dueDate}</span>
                                    </div>
                                    <div className="flex justify-between items-center px-4 py-3 bg-white">
                                        <span className="text-[#64748B]">Paid On</span>
                                        <span className="font-bold text-[#0F172A]">{viewingReceiptInvoice.paidAt}</span>
                                    </div>
                                    <div className="flex justify-between items-center px-4 py-3 bg-white">
                                        <span className="text-[#64748B]">Payment Method</span>
                                        <span className="font-bold text-[#0F172A]">{viewingReceiptInvoice.paymentMethod}</span>
                                    </div>
                                    <div className="flex justify-between items-start px-4 py-3 bg-white">
                                        <span className="text-[#64748B] shrink-0">Payment Reference</span>
                                        <span className="font-mono text-xs text-[#0F172A] text-right break-all max-w-[60%]">
                                            {viewingReceiptInvoice.paymentRef}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Convenience Fee Breakdowns */}
                            <div className="bg-[#EEF2F6] border-t-2 border-[#CBD5E1] px-5 py-4 space-y-2 rounded-xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#475569] mb-2">💼 RentPe Convenience Fee Breakdown</p>
                                <div className="flex justify-between text-xs font-bold text-[#64748B]">
                                    <span>Gross Rent</span>
                                    <span className="text-[#0F172A]">₹{viewingReceiptInvoice.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                                {Number(viewingReceiptInvoice.studentFee) > 0 && (
                                    <>
                                        <div className="flex justify-between text-xs font-bold text-[#64748B]">
                                            <span>RentPe Convenience Fee (Base)</span>
                                            <span className="text-[#4C28D5]">₹{Number(viewingReceiptInvoice.studentFeeBase).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-semibold pl-4 border-l-2 border-indigo-100 text-[#64748B]">
                                            <span>CGST (9%)</span>
                                            <span>₹{Number(viewingReceiptInvoice.studentFeeGstCgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-semibold pl-4 border-l-2 border-indigo-100 text-[#64748B]">
                                            <span>SGST (9%)</span>
                                            <span>₹{Number(viewingReceiptInvoice.studentFeeGstSgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-semibold pl-4 border-l-2 border-indigo-100 text-[#64748B]">
                                            <span>Total GST (18%)</span>
                                            <span>₹{Number(viewingReceiptInvoice.studentFeeGst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </>
                                )}
                                <div className="flex justify-between text-xs border-t border-[#CBD5E1] pt-2 mt-2">
                                    <span className="font-black text-[#4C28D5] text-sm">Total Paid</span>
                                    <span className="font-black text-[#0F172A] text-base">₹{(viewingReceiptInvoice.amount + viewingReceiptInvoice.studentFee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
