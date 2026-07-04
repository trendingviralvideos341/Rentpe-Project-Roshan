"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    CheckCircle, XCircle, Users, Loader2, Search,
    Eye, Building, ShieldAlert, Phone, Mail, Calendar, Info, AlertTriangle,
    X, Download, FileText, CheckCircle2, TrendingUp, Shield, Building2, IndianRupee, Home,
    Edit2, Save, Plus, Trash2
} from "lucide-react";
import { getTenants, markRentAsPaid, markRentAsUnpaid, blockTenant, unblockTenant, updateTenantProfile } from "@/actions/tenants";
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

function formatMonthLabel(monthStr: string): string {
    if (!monthStr) return "";
    if (monthStr.includes(" ")) return monthStr;
    const parts = monthStr.split("-");
    if (parts.length === 2) {
        const year = parts[0];
        const monthNum = parseInt(parts[1], 10);
        const monthNames = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        ];
        if (monthNum >= 1 && monthNum <= 12) {
            return `${monthNames[monthNum - 1]} ${year}`;
        }
    }
    return monthStr;
}

export default function TenantsPage() {
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState("ALL");
    const [filterProperty, setFilterProperty] = useState("ALL");
    const [filterStatus, setFilterStatus] = useState("ALL");
    
    // Modal drawer state
    const [selectedTenant, setSelectedTenant] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<"profile" | "booking" | "ledger" | "support">("profile");

    // Action notes state
    const [blockNote, setBlockNote] = useState("");
    const [unblockNote, setUnblockNote] = useState("");
    const [ledgerNote, setLedgerNote] = useState<Record<string, string>>({});
    const [actionLoading, setActionLoading] = useState(false);

    // Dialog state for Marking Paid
    const [markingPaidRecord, setMarkingPaidRecord] = useState<any>(null);
    const [overrideMethod, setOverrideMethod] = useState<'CASH' | 'ONLINE'>('CASH');
    const [overrideReason, setOverrideReason] = useState('');

    // Ledger filters
    const [ledgerYear, setLedgerYear] = useState<string>("ALL");
    const [ledgerMonth, setLedgerMonth] = useState<string>("ALL");

    // Dialog state for Viewing Receipt
    const [viewingReceiptInvoice, setViewingReceiptInvoice] = useState<any>(null);
    const [receiptLoading, setReceiptLoading] = useState(false);

    // Dialog state for Marking Unpaid
    const [markingUnpaidRecord, setMarkingUnpaidRecord] = useState<any>(null);
    const [reversalReason, setReversalReason] = useState<'TRANSACTION_FAILURE' | 'OTHER'>('TRANSACTION_FAILURE');
    const [reversalNote, setReversalNote] = useState('');

    // Notice override form state
    const [plannedMoveOut, setPlannedMoveOut] = useState("");
    const [moveOutReason, setMoveOutReason] = useState("");

    // Profile Edit State
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editName, setEditName] = useState("");
    const [editDOB, setEditDOB] = useState("");
    const [editGender, setEditGender] = useState("");
    const [editNationality, setEditNationality] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editOccupationType, setEditOccupationType] = useState("");
    const [editOccupationDetail, setEditOccupationDetail] = useState("");
    const [editStartDate, setEditStartDate] = useState("");
    const [editEmergencyContacts, setEditEmergencyContacts] = useState<any[]>([]);

    // Support ticket and reason validation state for saving edits
    const [showSaveEditDialog, setShowSaveEditDialog] = useState(false);
    const [auditTicketId, setAuditTicketId] = useState("");
    const [auditReason, setAuditReason] = useState("");

    const currentMonth = new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    const todayStr = new Date().toISOString().split("T")[0];

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

    const handleConfirmMarkUnpaid = async () => {
        if (!markingUnpaidRecord) return;
        if (!reversalNote.trim()) {
            toast.error("Please enter a mandatory reversal note.");
            return;
        }
        setActionLoading(true);
        try {
            await markRentAsUnpaid(markingUnpaidRecord.id, reversalReason, reversalNote.trim());
            toast.success("Rent marked as unpaid successfully.");
            setMarkingUnpaidRecord(null);
            setReversalNote("");
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

    const startEditingProfile = () => {
        if (!selectedTenant) return;
        setEditName(selectedTenant.name || "");
        setEditDOB(selectedTenant.booking?.user?.dateOfBirth || "");
        setEditGender(selectedTenant.booking?.user?.gender || "");
        setEditNationality(selectedTenant.booking?.user?.nationality || "Indian");
        setEditPhone(selectedTenant.booking?.user?.phone || selectedTenant.phone || "");
        setEditEmail(selectedTenant.booking?.user?.email || selectedTenant.email || "");
        setEditOccupationType(selectedTenant.booking?.user?.occupationType || "");

        const occDetail = selectedTenant.booking?.user?.occupationType === 'Student'
            ? selectedTenant.booking?.user?.college
            : selectedTenant.booking?.user?.businessName || selectedTenant.booking?.user?.occupationDetail || "";
        setEditOccupationDetail(occDetail);
        setEditStartDate(selectedTenant.startDate || selectedTenant.moveInDate || "");

        const ecRaw = selectedTenant.booking?.user?.emergencyContact;
        let parsedEc = [];
        if (ecRaw) {
            try {
                const parsed = JSON.parse(ecRaw);
                if (Array.isArray(parsed)) {
                    parsedEc = parsed;
                }
            } catch (e) {}
        }
        setEditEmergencyContacts(parsedEc);
        setIsEditingProfile(true);
    };

    const handleSaveProfile = async () => {
        if (!auditTicketId.trim() || !auditReason.trim()) {
            toast.error("Support Ticket ID and Reason for Update are required.");
            return;
        }

        // Validate emergency contacts
        if (editEmergencyContacts.length === 0) {
            toast.error("At least one emergency contact is mandatory.");
            return;
        }

        for (const ec of editEmergencyContacts) {
            if (!ec.name.trim() || !ec.phone.trim() || !ec.relation) {
                toast.error("All emergency contact fields (Name, Relation, Phone) are required.");
                return;
            }
        }

        setActionLoading(true);
        try {
            const data = {
                name: editName,
                phone: editPhone,
                email: editEmail,
                dateOfBirth: editDOB,
                gender: editGender,
                nationality: editNationality,
                occupationType: editOccupationType,
                occupationDetail: editOccupationDetail,
                emergencyContact: JSON.stringify(editEmergencyContacts),
                startDate: editStartDate
            };

            const res = await updateTenantProfile(selectedTenant.id, data, {
                ticketId: auditTicketId,
                reason: auditReason
            });

            if (res?.success) {
                toast.success("Tenant profile updated successfully.");
                setIsEditingProfile(false);
                setShowSaveEditDialog(false);
                setAuditTicketId("");
                setAuditReason("");
                // Refresh tenants & selectedTenant details
                await fetchTenants();
            }
        } catch (e: any) {
            toast.error("Failed to update profile: " + e.message);
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
                <Dialog open={!!selectedTenant} onOpenChange={() => { setSelectedTenant(null); setIsEditingProfile(false); }}>
                    <DialogContent className="max-w-[90vw] md:max-w-7xl bg-white border rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
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
                                { id: "booking", label: "Booking & Stay", icon: Building },
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
                            {activeTab === "profile" && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                        <h4 className="font-black text-slate-900 text-sm">Tenant Demographic Profile</h4>
                                        {!isEditingProfile ? (
                                            <Button
                                                onClick={startEditingProfile}
                                                size="sm"
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl h-8 flex items-center gap-1.5"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" /> Edit Profile
                                            </Button>
                                        ) : (
                                            <div className="flex gap-2">
                                                <Button
                                                    onClick={() => setIsEditingProfile(false)}
                                                    variant="outline"
                                                    size="sm"
                                                    className="font-bold rounded-xl h-8 text-slate-600 border-slate-200"
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    onClick={() => setShowSaveEditDialog(true)}
                                                    size="sm"
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-8 flex items-center gap-1.5"
                                                >
                                                    <Save className="w-3.5 h-3.5" /> Save Changes
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {!isEditingProfile ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                            <div className="space-y-4">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Full Name</p>
                                                    <p className="font-bold text-slate-900">{selectedTenant.name}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Date of Birth</p>
                                                    <p className="font-bold text-slate-900">{selectedTenant.booking?.user?.dateOfBirth || "—"}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Gender</p>
                                                    <p className="font-bold text-slate-900">{selectedTenant.booking?.user?.gender || "—"}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Nationality</p>
                                                    <p className="font-bold text-slate-900">{selectedTenant.booking?.user?.nationality || "Indian"}</p>
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
                                                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Check-in Date</p>
                                                    <p className="font-bold text-slate-900">{selectedTenant.startDate || selectedTenant.moveInDate || "—"}</p>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1"><Phone className="w-3 h-3" /> Registered Phone</p>
                                                    <p className="font-bold text-slate-900">{selectedTenant.booking?.user?.phone || selectedTenant.phone}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1"><Mail className="w-3 h-3" /> Registered Email</p>
                                                    <p className="font-bold text-slate-900">{selectedTenant.booking?.user?.email || selectedTenant.email}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Occupation Status</p>
                                                    <p className="font-bold text-slate-900">{selectedTenant.booking?.user?.occupationType || "—"}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Institution / Company Name</p>
                                                    <p className="font-bold text-slate-900">
                                                        {selectedTenant.booking?.user?.occupationType === 'Student' 
                                                            ? selectedTenant.booking?.user?.college 
                                                            : selectedTenant.booking?.user?.businessName || selectedTenant.booking?.user?.occupationDetail || "—"}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Emergency Contacts</p>
                                                    {(() => {
                                                        const ecRaw = selectedTenant.booking?.user?.emergencyContact;
                                                        if (!ecRaw) return <p className="font-bold text-slate-900">—</p>;
                                                        try {
                                                            const parsed = JSON.parse(ecRaw);
                                                            if (Array.isArray(parsed)) {
                                                                return (
                                                                    <div className="space-y-1.5">
                                                                        {parsed.map((contact, idx) => (
                                                                            <div key={idx} className="bg-slate-50 p-2 rounded border border-slate-100 text-xs">
                                                                                <p className="font-bold text-slate-800">{contact.name} <span className="text-slate-400 font-normal">({contact.relation})</span></p>
                                                                                <p className="text-slate-600 font-mono mt-0.5">{contact.phone}</p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            }
                                                        } catch (e) {}
                                                        return <p className="font-bold text-slate-900">{ecRaw}</p>;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                            <div className="space-y-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Full Name</label>
                                                    <Input
                                                        value={editName}
                                                        onChange={e => setEditName(e.target.value)}
                                                        className="bg-slate-50 border-slate-200 text-xs font-bold text-slate-800"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Date of Birth</label>
                                                    <Input
                                                        type="date"
                                                        value={editDOB}
                                                        onChange={e => setEditDOB(e.target.value)}
                                                        max={todayStr}
                                                        className="bg-slate-50 border-slate-200 text-xs font-bold text-slate-800"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Gender</label>
                                                    <select
                                                        value={editGender}
                                                        onChange={e => setEditGender(e.target.value)}
                                                        className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                    >
                                                        <option value="">Select Gender</option>
                                                        <option value="Male">Male</option>
                                                        <option value="Female">Female</option>
                                                        <option value="Other">Other</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Nationality</label>
                                                    <Input
                                                        value={editNationality}
                                                        onChange={e => setEditNationality(e.target.value)}
                                                        className="bg-slate-50 border-slate-200 text-xs font-bold text-slate-800"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Check-in Date</label>
                                                    <Input
                                                        value={editStartDate}
                                                        onChange={e => setEditStartDate(e.target.value)}
                                                        className="bg-slate-50 border-slate-200 text-xs font-bold text-slate-800"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1"><Phone className="w-3 h-3" /> Registered Phone</label>
                                                    <Input
                                                        value={editPhone}
                                                        onChange={e => setEditPhone(e.target.value)}
                                                        className="bg-slate-50 border-slate-200 text-xs font-bold text-slate-800"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1"><Mail className="w-3 h-3" /> Registered Email</label>
                                                    <Input
                                                        value={editEmail}
                                                        onChange={e => setEditEmail(e.target.value)}
                                                        className="bg-slate-50 border-slate-200 text-xs font-bold text-slate-800"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Occupation Status</label>
                                                    <select
                                                        value={editOccupationType}
                                                        onChange={e => setEditOccupationType(e.target.value)}
                                                        className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                    >
                                                        <option value="">Select Occupation</option>
                                                        <option value="Student">Student</option>
                                                        <option value="Working Professional">Working Professional</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Institution / Company Name</label>
                                                    <Input
                                                        value={editOccupationDetail}
                                                        onChange={e => setEditOccupationDetail(e.target.value)}
                                                        className="bg-slate-50 border-slate-200 text-xs font-bold text-slate-800"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Emergency Contacts</label>
                                                    <div className="space-y-3">
                                                        {editEmergencyContacts.map((contact, idx) => (
                                                            <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2 relative">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditEmergencyContacts(editEmergencyContacts.filter((_, i) => i !== idx))}
                                                                    className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    <div>
                                                                        <label className="text-[8px] font-black text-slate-400 uppercase">Name</label>
                                                                        <Input
                                                                            value={contact.name}
                                                                            onChange={e => {
                                                                                const updated = [...editEmergencyContacts];
                                                                                updated[idx].name = e.target.value;
                                                                                setEditEmergencyContacts(updated);
                                                                            }}
                                                                            className="bg-white border-slate-200 text-[10px] h-8 font-bold"
                                                                            placeholder="Name"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[8px] font-black text-slate-400 uppercase">Relation</label>
                                                                        <select
                                                                            value={contact.relation}
                                                                            onChange={e => {
                                                                                const updated = [...editEmergencyContacts];
                                                                                updated[idx].relation = e.target.value;
                                                                                setEditEmergencyContacts(updated);
                                                                            }}
                                                                            className="w-full border border-slate-200 rounded-lg p-1.5 bg-white text-[10px] h-8 font-bold text-slate-800"
                                                                        >
                                                                            <option value="">Relation</option>
                                                                            <option value="Family">Family</option>
                                                                            <option value="Relatives">Relatives</option>
                                                                            <option value="Friends">Friends</option>
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[8px] font-black text-slate-400 uppercase">Phone</label>
                                                                        <Input
                                                                            value={contact.phone}
                                                                            onChange={e => {
                                                                                const updated = [...editEmergencyContacts];
                                                                                updated[idx].phone = e.target.value;
                                                                                setEditEmergencyContacts(updated);
                                                                            }}
                                                                            className="bg-white border-slate-200 text-[10px] h-8 font-bold"
                                                                            placeholder="Phone"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {editEmergencyContacts.length < 2 && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setEditEmergencyContacts([...editEmergencyContacts, { name: "", relation: "", phone: "" }])}
                                                                className="text-[10px] font-bold w-full rounded-xl border-dashed border-2 flex items-center justify-center gap-1 text-slate-500 border-slate-300 hover:bg-slate-50 h-8"
                                                            >
                                                                <Plus className="w-3 h-3" /> Add Emergency Contact ({editEmergencyContacts.length}/2)
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 2: Booking & Stay */}
                            {activeTab === "booking" && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Property Details</p>
                                            <p className="font-bold text-slate-900">{selectedTenant.property?.name || "—"}</p>
                                            <p className="text-xs text-slate-500">{selectedTenant.property?.address}, {selectedTenant.property?.city}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Property Code / ID</p>
                                            <p className="font-mono text-xs font-bold text-slate-600">{selectedTenant.property?.displayId || "—"}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Assigned Room</p>
                                            <p className="font-bold text-slate-900">{selectedTenant.roomNumber} ({selectedTenant.roomType})</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Booking Reference</p>
                                            <p className="font-mono text-xs font-bold text-slate-600">{selectedTenant.booking?.displayId || "N/A"}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Property Management Contact</p>
                                            {selectedTenant.property?.owner ? (
                                                <div className="bg-slate-50 p-2 rounded border border-slate-100 text-xs">
                                                    <p className="font-bold text-slate-800 flex items-center gap-1.5"><ShieldAlert className="w-3 h-3 text-indigo-500" /> Owner / Manager</p>
                                                    <p className="text-slate-700 mt-1">{selectedTenant.property.owner.name}</p>
                                                    <p className="text-slate-600 font-mono flex items-center gap-1 mt-0.5"><Phone className="w-2.5 h-2.5" /> {selectedTenant.property.owner.phone}</p>
                                                </div>
                                            ) : <p className="font-bold text-slate-900">—</p>}
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Check-in Date</p>
                                            <p className="font-bold text-slate-900">{selectedTenant.startDate || selectedTenant.moveInDate}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Check-out Date</p>
                                            <p className="font-bold text-slate-900">
                                                {selectedTenant.actualMoveOutDate 
                                                    ? new Date(selectedTenant.actualMoveOutDate).toLocaleDateString('en-IN')
                                                    : selectedTenant.expectedMoveOutDate 
                                                        ? `${new Date(selectedTenant.expectedMoveOutDate).toLocaleDateString('en-IN')} (Expected)`
                                                        : <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Active Stay</span>
                                                }
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Monthly Rent</p>
                                            <p className="font-bold text-slate-900">₹{selectedTenant.rentAmount || selectedTenant.rent}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Deposit Amount</p>
                                            <p className="font-bold text-slate-900">₹{selectedTenant.billingProfile?.securityDeposit || "—"}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Food Service</p>
                                            {(() => {
                                                const foodType = selectedTenant.property?.foodType;
                                                const hasOpted = selectedTenant.booking?.foodSelected;
                                                if (foodType === "INCLUDED_IN_RENT") {
                                                    return <span className="inline-flex px-2 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider">Included in Rent</span>;
                                                } else if (foodType === "OPTIONAL") {
                                                    return hasOpted 
                                                        ? <span className="inline-flex px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">Opted (₹{selectedTenant.booking?.foodPriceApplied}/mo)</span>
                                                        : <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">Not Opted</span>;
                                                } else {
                                                    return <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider">Not Available</span>;
                                                }
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: Tenant Payment History (formerly Ledger) */}
                            {activeTab === "ledger" && (
                                <div className="space-y-6">
                                    {/* Header Cards */}
                                    {(() => {
                                        const currentYear = new Date().getFullYear();
                                        const fyStart = new Date(currentYear, 3, 1);
                                        const fyEnd = new Date(currentYear + 1, 2, 31);
                                        const invoices = selectedTenant.billingProfile?.invoices || [];
                                        const invoicePaidFY = invoices
                                            .filter((i: any) => i.status === 'PAID' && i.paidAt && new Date(i.paidAt) >= fyStart && new Date(i.paidAt) <= fyEnd)
                                            .reduce((sum: number, i: any) => sum + i.amount, 0);
                                        const tokenAmount = selectedTenant.booking?.tokenAmount || 0;
                                        const tokenPaidAt = selectedTenant.booking?.tokenPaidAt;
                                        const tokenPaidFY = (tokenPaidAt && new Date(tokenPaidAt) >= fyStart && new Date(tokenPaidAt) <= fyEnd) ? tokenAmount : 0;
                                        const totalPaidFY = invoicePaidFY + tokenPaidFY;

                                        const now = new Date();
                                        const currentInvoice = invoices.find((i: any) => i.dueDate && new Date(i.dueDate).getMonth() === now.getMonth() && new Date(i.dueDate).getFullYear() === now.getFullYear());
                                        const thisMonthStatus = currentInvoice ? currentInvoice.status : "—";

                                        return (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <Card className="border-none shadow-sm bg-indigo-50/50">
                                                    <CardContent className="p-5 space-y-1">
                                                        <TrendingUp className="w-4 h-4 text-indigo-500 mb-2" />
                                                        <p className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">TOTAL PAID (FY)</p>
                                                        <p className="text-xl font-black text-slate-900">₹{totalPaidFY.toLocaleString('en-IN')}</p>
                                                    </CardContent>
                                                </Card>
                                                <Card className="border-none shadow-sm bg-emerald-50/50">
                                                    <CardContent className="p-5 space-y-1">
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mb-2" />
                                                        <p className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">THIS MONTH</p>
                                                        <p className="text-xl font-black text-slate-900">
                                                            {thisMonthStatus === 'PAID' ? 'PAID' : thisMonthStatus === 'PENDING' ? 'PENDING' : '—'}
                                                        </p>
                                                    </CardContent>
                                                </Card>
                                                <Card className="border-none shadow-sm bg-teal-50/50">
                                                    <CardContent className="p-5 space-y-1">
                                                        <Shield className="w-4 h-4 text-teal-500 mb-2" />
                                                        <p className="text-[10px] font-black uppercase text-teal-400 tracking-wider">SECURITY DEPOSIT</p>
                                                        <p className="text-xl font-black text-slate-900 flex items-center gap-1">
                                                            ₹{(selectedTenant.billingProfile?.securityDeposit || 0).toLocaleString('en-IN')}
                                                            <CheckCircle className="w-4 h-4 text-teal-500" />
                                                        </p>
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        );
                                    })()}

                                    {/* Tenant Details Bar */}
                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between text-xs font-bold text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                                                <Building2 className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-slate-900">{selectedTenant.name}</span>
                                        </div>
                                        <div>Booking ID: <span className="text-slate-900">{selectedTenant.booking?.displayId || "—"}</span></div>
                                        <div>Room: <span className="text-slate-900">{selectedTenant.roomNumber} — {selectedTenant.roomType}</span></div>
                                        <div className="text-green-600 uppercase tracking-wider">{selectedTenant.status}</div>
                                        <div>Move-in: <span className="text-slate-900">{selectedTenant.startDate || selectedTenant.moveInDate}</span></div>
                                    </div>

                                    {/* Filters & Ledger Table */}
                                    <Card className="border border-slate-100 shadow-sm overflow-hidden">
                                        <CardContent className="p-0">
                                            <div className="flex flex-wrap items-center justify-between p-4 border-b border-slate-100 bg-white gap-2">
                                                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                                    <IndianRupee className="w-4 h-4 text-indigo-600" /> Complete Payment Ledger
                                                </h4>
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        className="border border-slate-200 rounded-lg p-1.5 bg-slate-50 text-xs font-bold text-slate-700"
                                                        value={ledgerYear}
                                                        onChange={e => setLedgerYear(e.target.value)}
                                                    >
                                                        <option value="ALL">All Years</option>
                                                        <option value="2027">2027</option>
                                                        <option value="2026">2026</option>
                                                        <option value="2025">2025</option>
                                                    </select>
                                                    <select
                                                        className="border border-slate-200 rounded-lg p-1.5 bg-slate-50 text-xs font-bold text-slate-700"
                                                        value={ledgerMonth}
                                                        onChange={e => setLedgerMonth(e.target.value)}
                                                    >
                                                        <option value="ALL">All Months</option>
                                                        <option value="01">Jan</option><option value="02">Feb</option><option value="03">Mar</option>
                                                        <option value="04">Apr</option><option value="05">May</option><option value="06">Jun</option>
                                                        <option value="07">Jul</option><option value="08">Aug</option><option value="09">Sep</option>
                                                        <option value="10">Oct</option><option value="11">Nov</option><option value="12">Dec</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left">
                                                    <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                                                        <tr>
                                                            <th className="p-4">Date</th>
                                                            <th className="p-4">Description</th>
                                                            <th className="p-4">Type</th>
                                                            <th className="p-4">Amount</th>
                                                            <th className="p-4 text-center">Status</th>
                                                            <th className="p-4 text-center">Receipt</th>
                                                            <th className="p-4 text-right">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 text-xs">
                                                        {(() => {
                                                            const filteredRecords = (selectedTenant.rentRecords || []).filter((r: any) => {
                                                                if (ledgerYear !== "ALL" && !r.month.startsWith(ledgerYear)) return false;
                                                                if (ledgerMonth !== "ALL" && !r.month.endsWith(`-${ledgerMonth}`)) return false;
                                                                return true;
                                                            });

                                                            if (filteredRecords.length === 0) {
                                                                return (
                                                                    <tr>
                                                                        <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                                                                            No rent records found.
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            }

                                                            return filteredRecords.map((r: any) => {
                                                                const matchingInvoice = selectedTenant.billingProfile?.invoices?.find((inv: any) => inv.month === r.month);
                                                                const payment = matchingInvoice?.payments?.[0];
                                                                
                                                                const isPaid = r.paid;
                                                                const dateStr = isPaid ? (matchingInvoice?.paidAt ? new Date(matchingInvoice.paidAt).toLocaleDateString('en-IN') : r.paidOn || "—") : "—";
                                                                const desc = `Rent — ${formatMonthLabel(r.month)}`;
                                                                const amount = r.amount;
                                                                
                                                                return (
                                                                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                                                                        <td className="p-4 font-bold text-slate-600 whitespace-nowrap">{dateStr}</td>
                                                                        <td className="p-4">
                                                                            <p className="font-bold text-slate-900">{desc}</p>
                                                                            {/* Admin Audit Notes */}
                                                                            {isPaid && (
                                                                                <div className="mt-1 text-[10px] font-mono whitespace-nowrap">
                                                                                    {matchingInvoice?.paymentMethod === 'ONLINE' || payment ? (
                                                                                        <p className="text-indigo-600 font-bold flex items-center gap-1">
                                                                                            ⚡ ONLINE: Paid on {matchingInvoice?.paidAt ? new Date(matchingInvoice.paidAt).toLocaleString('en-IN') : r.paidOn} via Razorpay (Tx ID: {payment?.razorpayId || matchingInvoice?.paymentRef || 'Verified'})
                                                                                        </p>
                                                                                    ) : (
                                                                                        <p className="text-amber-600 font-bold">
                                                                                            💵 CASH: Direct settlement (Confirmed by {matchingInvoice?.confirmedByName || 'Owner/Admin'})
                                                                                            {r.note && <span className="block text-slate-500 font-normal mt-0.5 font-sans whitespace-normal">Audit details: {r.note}</span>}
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="p-4">
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-indigo-50 text-indigo-700 border-indigo-100">
                                                                                <Home className="w-3 h-3" /> Rent
                                                                            </span>
                                                                        </td>
                                                                        <td className="p-4 font-black text-slate-900 whitespace-nowrap">₹{amount.toLocaleString('en-IN')}</td>
                                                                        <td className="p-4 text-center">
                                                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                                                                isPaid ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-red-100 text-red-700 border-red-200"
                                                                            }`}>
                                                                                {isPaid ? "PAID" : "UNPAID"}
                                                                            </span>
                                                                        </td>
                                                                        <td className="p-4 text-center">
                                                                            {isPaid && matchingInvoice ? (
                                                                                <Button
                                                                                    size="sm"
                                                                                    className="h-7 text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 shadow-none"
                                                                                    onClick={() => handleViewReceipt(matchingInvoice.id)}
                                                                                    disabled={receiptLoading}
                                                                                >
                                                                                    <FileText className="w-3 h-3 mr-1" /> Receipt
                                                                                </Button>
                                                                            ) : (
                                                                                <span className="text-slate-400 font-bold">—</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="p-4 text-right">
                                                                            <div className="flex justify-end gap-2">
                                                                                {isPaid ? (
                                                                                    <Button
                                                                                        size="sm"
                                                                                        disabled={actionLoading}
                                                                                        className="h-7 text-[10px] bg-red-100 hover:bg-red-200 text-red-700 font-bold border-0 shadow-none"
                                                                                        onClick={() => {
                                                                                            setMarkingUnpaidRecord(r);
                                                                                            setReversalReason('TRANSACTION_FAILURE');
                                                                                            setReversalNote('');
                                                                                        }}
                                                                                    >
                                                                                        Unpaid
                                                                                    </Button>
                                                                                ) : (
                                                                                    <Button
                                                                                        size="sm"
                                                                                        disabled={actionLoading}
                                                                                        className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                                                                        onClick={() => {
                                                                                            setMarkingPaidRecord(r);
                                                                                            setOverrideMethod('CASH');
                                                                                            setOverrideReason('');
                                                                                        }}
                                                                                    >
                                                                                        Mark Paid
                                                                                    </Button>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            });
                                                        })()}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </CardContent>
                                    </Card>
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

            {/* Save Profile Edit Dialog (Mandatory Tracking Notes) */}
            {showSaveEditDialog && (
                <Dialog open={showSaveEditDialog} onOpenChange={() => setShowSaveEditDialog(false)}>
                    <DialogContent className="max-w-md bg-white border rounded-2xl p-6 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-indigo-600" /> Save Profile Updates
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-400 font-bold uppercase mt-1">
                                MANDATORY TRACKING NOTE & SUPPORT TICKET ID
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Support Ticket ID (Required)</label>
                                <Input
                                    placeholder="e.g. ticket_10293 or REN-TKT-XXXX"
                                    value={auditTicketId}
                                    onChange={e => setAuditTicketId(e.target.value)}
                                    className="bg-slate-50 border-slate-200 text-xs font-bold text-slate-800"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Reason for Update / Edit Remarks (Required)</label>
                                <textarea
                                    placeholder="Provide a detailed explanation of what is changing and why support initiated this edit..."
                                    value={auditReason}
                                    onChange={e => setAuditReason(e.target.value)}
                                    rows={3}
                                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowSaveEditDialog(false)}
                                className="font-bold border-slate-200 rounded-xl"
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                disabled={actionLoading || !auditTicketId.trim() || !auditReason.trim()}
                                onClick={handleSaveProfile}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                            >
                                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null} Commit Changes
                            </Button>
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
                                Month: {formatMonthLabel(markingPaidRecord.month)} · Rent Amount: ₹{markingPaidRecord.amount}
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
                                        <span className="font-bold text-[#0F172A]">{formatMonthLabel(viewingReceiptInvoice.month)}</span>
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

            {/* Mark Unpaid Reversal Dialog */}
            {markingUnpaidRecord && (
                <Dialog open={!!markingUnpaidRecord} onOpenChange={() => setMarkingUnpaidRecord(null)}>
                    <DialogContent className="max-w-md bg-white border rounded-2xl p-6 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <XCircle className="w-5 h-5 text-red-600" /> Mark Rent Invoice as Unpaid
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-400 font-bold uppercase mt-1">
                                Month: {formatMonthLabel(markingUnpaidRecord.month)} · Rent Amount: ₹{markingUnpaidRecord.amount}
                            </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4 py-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Reversal / Failure Reason</label>
                                <select
                                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                                    value={reversalReason}
                                    onChange={e => setReversalReason(e.target.value as any)}
                                >
                                    <option value="TRANSACTION_FAILURE">❌ Transaction Failure</option>
                                    <option value="OTHER">⚠️ Others (Manual reversal/incorrect record)</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Mandatory Reversal Notes (Required)</label>
                                <Input
                                    placeholder="Enter detailed reason for payment reversal..."
                                    value={reversalNote}
                                    onChange={e => setReversalNote(e.target.value)}
                                    className="bg-slate-50 border-slate-200 text-xs"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setMarkingUnpaidRecord(null)}
                                className="font-bold border-slate-200 rounded-xl"
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                disabled={actionLoading || !reversalNote.trim()}
                                onClick={handleConfirmMarkUnpaid}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
                            >
                                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null} Confirm Reversal
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
