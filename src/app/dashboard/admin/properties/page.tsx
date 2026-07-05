"use client";

import { useState, useEffect, useCallback } from "react";
import { 
    getAllPropertiesForAdmin, 
    getAdminPropertyStatusCounts, 
    exemptPropertyFee, 
    rejectProperty, 
    requestPropertyCorrections,
    startPropertyVerification,
    verifyPropertyDocuments,
    requirePropertyPayment,
    activateProperty,
    rollbackPropertyStatus,
    logCorrectionView
} from "@/actions/admin";
import { requestBankDetails, manualMakePropertyLive, getPlatformVerifiers, assignPropertyToVerifier } from "@/actions/properties";
import { getCurrentUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { 
    Building, RefreshCcw, Eye, CheckCircle, XCircle, AlertTriangle, 
    FileText, Check, CreditCard, Trash2, DollarSign,
    MapPin, User as UserIcon, Calendar, ArrowRight, ShieldOff, Shield
} from "lucide-react";
import Link from "next/link";

const STATUS_TABS = [
    { key: "PENDING_VERIFICATION",   label: "Pending Applications",  icon: FileText,      color: "bg-blue-600" },
    { key: "VERIFYING_DOCUMENTS",    label: "Pending Verification",  icon: Eye,           color: "bg-purple-600" },
    { key: "NEEDS_CORRECTION",       label: "Needs Correction",      icon: AlertTriangle, color: "bg-amber-500" },
    { key: "VERIFIED_SUCCESSFULLY",  label: "Verified Successfully", icon: Check,         color: "bg-teal-600" },
    { key: "AWAITING_BANK_DETAILS",  label: "Awaiting Bank Details", icon: FileText,      color: "bg-purple-600" },
    { key: "BANK_DETAILS_SUBMITTED", label: "Bank Submitted",        icon: CreditCard,    color: "bg-purple-600" },
    { key: "APPROVED_PENDING_PAYMENT",label: "Pending Payment",      icon: CreditCard,    color: "bg-orange-500" },
    { key: "APPROVED_PAYMENT_VERIFIED",label: "Payment Received",    icon: DollarSign,    color: "bg-cyan-600" },
    { key: "LIVE",                   label: "Live Properties",       icon: Building,      color: "bg-green-600" },
    { key: "SUSPENDED",              label: "Suspended",             icon: ShieldOff,     color: "bg-slate-600" },
    { key: "REJECTED",               label: "Rejected Applications", icon: Trash2,        color: "bg-red-600" },
];

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string, color: string }> = {
        PENDING_VERIFICATION: { label: "APPLICATION PENDING", color: "bg-blue-50 text-blue-600 border-blue-200" },
        VERIFYING_DOCUMENTS: { label: "VERIFYING DOCUMENTS", color: "bg-purple-50 text-purple-600 border-purple-200" },
        NEEDS_CORRECTION: { label: "NEEDS CORRECTION", color: "bg-amber-50 text-amber-600 border-amber-200" },
        VERIFIED_SUCCESSFULLY: { label: "VERIFIED SUCCESSFULLY", color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
        AWAITING_BANK_DETAILS: { label: "AWAITING BANK DETAILS", color: "bg-orange-50 text-orange-600 border-orange-200 animate-pulse" },
        BANK_DETAILS_SUBMITTED: { label: "BANK DETAILS SUBMITTED", color: "bg-purple-50 text-purple-600 border-purple-200" },
        APPROVED_PENDING_PAYMENT: { label: "PENDING PAYMENT", color: "bg-orange-50 text-orange-600 border-orange-200" },
        LIVE: { label: "LIVE & ACTIVE", color: "bg-green-50 text-green-600 border-green-200" },
        REJECTED: { label: "REJECTED", color: "bg-red-50 text-red-600 border-red-200" },
        SUSPENDED: { label: "SUSPENDED", color: "bg-slate-50 text-slate-600 border-slate-200" },
    };
    const cfg = map[status] || { label: status, color: "bg-gray-50 text-gray-600 border-gray-200" };
    
    return (
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${cfg.color}`}>
            {cfg.label}
        </span>
    );
}

export default function AdminPropertiesPage() {
    const [properties, setProperties] = useState<any[]>([]);
    const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
    const [filter, setFilter] = useState("PENDING_VERIFICATION");
    const [loading, setLoading] = useState(true);
    const [actionModal, setActionModal] = useState<{ type: "reject" | "correction" | "approve" | "verify" | "payment" | "rollback" | "view_correction" | "request_bank" | "make_live"; prop: any } | null>(null);
    const [actionReason, setActionReason] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [searchQ, setSearchQ] = useState("");
    
    // Staff assignment state
    const [verifiers, setVerifiers] = useState<any[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [props, counts] = await Promise.all([
                getAllPropertiesForAdmin(filter),
                getAdminPropertyStatusCounts(),
            ]);
            setProperties(props as any[]);
            setStatusCounts(counts);
        } catch {
            toast.error("Failed to load properties");
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        async function loadInitialData() {
            try {
                const [user, team] = await Promise.all([
                    getCurrentUser(),
                    getPlatformVerifiers()
                ]);
                setCurrentUser(user);
                setVerifiers(team);
            } catch (err) {
                console.error("Failed to load platform team data", err);
            }
        }
        loadInitialData();
    }, []);

    const handleAction = async () => {
        if (!actionModal) return;
        setActionLoading(true);
        try {
            const propId = actionModal.prop.id;
            const propName = actionModal.prop.name;

            if (actionModal.type === "approve") {
                // If in PENDING, move to REVIEW
                if (actionModal.prop.status === 'PENDING_VERIFICATION') {
                    await startPropertyVerification(propId);
                    toast.success(`"${propName}" moved to Verifying Documents stage`);
                } else if (actionModal.prop.status === 'APPROVED_PENDING_PAYMENT') {
                    // Final live approval
                    await activateProperty(propId, "Approved via admin properties queue");
                    toast.success(`"${propName}" is now LIVE!`);
                }
            } else if (actionModal.type === "verify") {
                await verifyPropertyDocuments(propId);
                toast.success(`"${propName}" verified successfully!`);
            } else if (actionModal.type === "payment") {
                await requirePropertyPayment(propId);
                toast.success(`Onboarding payment requested for "${propName}"`);
            } else if (actionModal.type === "request_bank") {
                await requestBankDetails(propId);
                toast.success(`Requested Bank Details for "${propName}"`);
            } else if (actionModal.type === "make_live") {
                await manualMakePropertyLive(propId);
                toast.success(`"${propName}" is now LIVE!`);
            } else if (actionModal.type === "reject") {
                if (!actionReason.trim()) throw new Error("Reason required");
                await rejectProperty(propId, actionReason);
                toast.success("Property rejected & owner notified");
            } else if (actionModal.type === "correction") {
                if (!actionReason.trim()) throw new Error("Correction notes required");
                await requestPropertyCorrections(propId, actionReason);
                toast.success("Owner notified to make corrections");
            } else if (actionModal.type === "rollback") {
                if (!actionReason.trim()) throw new Error("Rollback reason required");
                await rollbackPropertyStatus(propId, actionReason);
                toast.success(`"${propName}" rolled back successfully`);
            }

            setActionModal(null);
            setActionReason("");
            fetchData();
        } catch (e: any) {
            toast.error(e.message || "Action failed");
        } finally {
            setActionLoading(false);
        }
    };

    const filtered = properties.filter((p: any) => {
        const matchesSearch = !searchQ || p.id === searchQ || p.name?.toLowerCase().includes(searchQ.toLowerCase()) ||
            p.city?.toLowerCase().includes(searchQ.toLowerCase()) ||
            p.owner?.name?.toLowerCase().includes(searchQ.toLowerCase());
        
        if (!matchesSearch) return false;
        
        if (assigneeFilter === "ALL") return true;
        if (assigneeFilter === "UNASSIGNED") return !p.assignedAdminId;
        if (assigneeFilter === "ME") return p.assignedAdminId === currentUser?.id;
        return p.assignedAdminId === assigneeFilter;
    });

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Building className="h-8 w-8 text-blue-600" /> Property Management
                    </h1>
                    <p className="text-sm font-medium text-slate-500">Audit, Verify and Approve platform inventory in real-time.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={fetchData} disabled={loading} className="rounded-full shadow-sm bg-white border-slate-200">
                        <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Sync Database
                    </Button>
                </div>
            </div>

            {/* Quick Stats — Neubrutalist Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
                {([
                    { key: "PENDING_VERIFICATION",    label: "Applications",    color: "text-blue-600",    border: "border-blue-600",    bg: "bg-blue-50/50" },
                    { key: "VERIFYING_DOCUMENTS",     label: "Verification",    color: "text-purple-600",  border: "border-purple-600",  bg: "bg-purple-50/50" },
                    { key: "NEEDS_CORRECTION",        label: "Corrections",     color: "text-amber-600",   border: "border-amber-500",   bg: "bg-amber-50/50" },
                    { key: "AWAITING_BANK_DETAILS",   label: "Awaiting Bank",   color: "text-indigo-600",  border: "border-indigo-600",  bg: "bg-indigo-50/50" },
                    { key: "BANK_DETAILS_SUBMITTED",  label: "Bank Submitted",  color: "text-violet-600",  border: "border-violet-600",  bg: "bg-violet-50/50" },
                    { key: "APPROVED_PENDING_PAYMENT",label: "Payments",        color: "text-orange-600",  border: "border-orange-500",  bg: "bg-orange-50/50" },
                    { key: "LIVE",                   label: "Live Inventory",  color: "text-emerald-600", border: "border-emerald-600", bg: "bg-emerald-50/50" },
                    { key: "REJECTED",                label: "Rejected",        color: "text-red-600",     border: "border-red-600",     bg: "bg-red-50/50" },
                ] as const).map((s) => (
                    <button
                        key={s.key}
                        onClick={() => setFilter(s.key)}
                        className={`p-4 rounded-2xl border-[3px] border-slate-950 flex flex-col gap-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${s.bg} ${
                            filter === s.key ? "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-y-1 bg-white ring-4 ring-indigo-50" : "shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        }`}
                    >
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-60 leading-tight">{s.label}</span>
                        <span className={`text-2xl font-black ${s.color}`}>{statusCounts[s.key] || 0}</span>
                    </button>
                ))}
            </div>

            {/* Stage Tabs - Scrollable */}
            <div className="relative">
                <div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 mask-fade-right">
                    {STATUS_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = filter === tab.key;
                        const count = statusCounts[tab.key] || 0;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setFilter(tab.key)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black transition-all whitespace-nowrap shadow-sm border-2 ${
                                    isActive 
                                        ? "bg-blue-600 border-blue-600 text-white shadow-blue-200 ring-4 ring-blue-50" 
                                        : "bg-white border-slate-100 text-slate-500 hover:border-blue-200 hover:text-blue-600"
                                }`}
                            >
                                <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                                {tab.label}
                                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[9px] ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Search and Filtering Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <div className="flex-1 max-w-md relative group">
                    <input 
                        type="text" 
                        placeholder="Search by ID, Name, City or Owner..."
                        className="w-full h-12 bg-white border-2 border-slate-200 rounded-2xl px-5 text-sm font-medium focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 transition-all shadow-sm"
                        value={searchQ}
                        onChange={(e) => setSearchQ(e.target.value)}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                        🔍
                    </div>
                </div>

                <div className="relative">
                    <select
                        value={assigneeFilter}
                        onChange={(e) => setAssigneeFilter(e.target.value)}
                        className="h-12 bg-white border-2 border-slate-200 rounded-2xl pl-4 pr-10 text-xs font-black uppercase tracking-wider focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 transition-all cursor-pointer appearance-none"
                    >
                        <option value="ALL">📋 All Assignments</option>
                        <option value="ME">👤 Assigned to Me</option>
                        <option value="UNASSIGNED">⚪ Unassigned Tasks</option>
                        {verifiers.map((v) => (
                            <option key={v.id} value={v.id}>👥 {v.name || v.email}</option>
                        ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                        ▼
                    </div>
                </div>
            </div>

            {/* Application List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-32 bg-slate-100 rounded-3xl animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 py-20 text-center space-y-3">
                        <div className="p-4 bg-slate-50 rounded-full w-fit mx-auto">
                            <CheckCircle className="h-10 w-10 text-slate-200" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Queue is empty</p>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">No properties match local filter</p>
                        </div>
                    </div>
                ) : (
                    filtered.map((prop: any) => (
                        <Card key={prop.id} className="rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all group overflow-hidden bg-white">
                            <CardContent className="p-0">
                                <div className="flex flex-col md:flex-row items-stretch min-h-[140px]">
                                    {/* Thumbnail */}
                                    <div className="md:w-48 bg-slate-50 relative shrink-0">
                                        {prop.images ? (
                                            <img 
                                                src={JSON.parse(prop.images)[0]} 
                                                alt="Property" 
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Building className="h-8 w-8 text-slate-200" />
                                            </div>
                                        )}
                                        <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-md text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md border border-white/20">
                                            {prop.propertyType}
                                        </div>
                                    </div>

                                    {/* Info Middle */}
                                    <div className="flex-1 p-5 md:p-6 flex flex-col justify-between gap-4">
                                        <div className="space-y-2">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <div className="space-y-0.5">
                                                    <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none">{prop.name}</h3>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{prop.displayId}</p>
                                                </div>
                                                <StatusBadge status={prop.status} />
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-500 italic text-sm font-medium">
                                                <MapPin className="h-3.5 w-3.5 text-blue-600" /> {prop.city}, {prop.address}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-50">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                                                    <UserIcon className="h-4 w-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Owner</span>
                                                    <span className="text-xs font-bold text-slate-700">{prop.owner?.name}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold">
                                                    {prop.rooms?.length || 0}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Inventory</span>
                                                    <span className="text-xs font-bold text-slate-700">{prop.rooms?.length || 0} Room(s) Listed</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                                                    <Calendar className="h-4 w-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Submitted</span>
                                                    <span className="text-xs font-bold text-slate-700">{new Date(prop.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                                                    <Shield className="h-4 w-4 text-purple-600" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Assignee</span>
                                                    <select
                                                        className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none cursor-pointer border-none p-0 focus:ring-0 max-w-[120px]"
                                                        value={prop.assignedAdminId || ""}
                                                        onChange={async (e) => {
                                                            const val = e.target.value || null;
                                                            try {
                                                                await assignPropertyToVerifier(prop.id, val);
                                                                toast.success("Assignment updated successfully!");
                                                                fetchData();
                                                            } catch {
                                                                toast.error("Failed to update assignment");
                                                            }
                                                        }}
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {verifiers.map((v) => (
                                                            <option key={v.id} value={v.id}>{v.name || v.email}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions Right */}
                                    <div className="md:w-56 bg-gradient-to-b from-slate-50 to-white p-4 border-l border-slate-100 flex flex-col gap-2 justify-center">
                                        <Link href={`/dashboard/admin/properties/${prop.id}`}>
                                            <Button className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm shadow-indigo-200">
                                                <Eye className="h-3.5 w-3.5 mr-1.5" /> Details
                                            </Button>
                                        </Link>

                                        {prop.status === 'NEEDS_CORRECTION' && (
                                            <>
                                                <Button 
                                                    className="w-full h-9 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-sm shadow-amber-100"
                                                    onClick={async () => {
                                                        await logCorrectionView(prop.id);
                                                        setActionModal({ type: "view_correction", prop });
                                                    }}
                                                >
                                                    Corrections Details
                                                </Button>
                                                <Button 
                                                    className="w-full h-9 bg-slate-700 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-[9px] rounded-xl"
                                                    onClick={() => setActionModal({ type: "rollback", prop })}
                                                >
                                                    Move Back
                                                </Button>
                                            </>
                                        )}

                                        {prop.status === 'PENDING_VERIFICATION' && (
                                            <Button 
                                                className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-sm shadow-blue-100"
                                                onClick={() => setActionModal({ type: "approve", prop })}
                                            >
                                                Approve Application <ArrowRight className="h-3 w-3 ml-1.5" />
                                            </Button>
                                        )}

                                        {prop.status === 'VERIFYING_DOCUMENTS' && (
                                            <>
                                                {prop.adminNotes && (
                                                    <Button 
                                                        className="w-full h-9 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl animate-pulse shadow-lg shadow-amber-100"
                                                        onClick={async () => {
                                                            await logCorrectionView(prop.id);
                                                            setActionModal({ type: "view_correction", prop });
                                                        }}
                                                    >
                                                        Correction Details
                                                    </Button>
                                                )}
                                                <Button 
                                                    className="w-full h-9 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-sm shadow-purple-100"
                                                    onClick={() => setActionModal({ type: "verify", prop })}
                                                >
                                                    Mark Verified <CheckCircle className="h-3 w-3 ml-1.5" />
                                                </Button>
                                            </>
                                        )}

                                        {prop.status === 'VERIFIED_SUCCESSFULLY' && (
                                            <>
                                                <Button 
                                                    className="w-full h-9 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-sm shadow-purple-100"
                                                    onClick={() => setActionModal({ type: "request_bank", prop })}
                                                >
                                                    Request Bank Details <CreditCard className="h-3 w-3 ml-1.5" />
                                                </Button>
                                                <Button 
                                                    className="w-full h-9 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-sm shadow-orange-100"
                                                    onClick={() => setActionModal({ type: "payment", prop })}
                                                >
                                                    Request Payment (Legacy) <CreditCard className="h-3 w-3 ml-1.5" />
                                                </Button>
                                            </>
                                        )}

                                        {prop.status === 'BANK_DETAILS_SUBMITTED' && (
                                            <Button 
                                                className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-sm shadow-emerald-100"
                                                onClick={() => setActionModal({ type: "make_live", prop })}
                                            >
                                                Review Bank & Make Live <CheckCircle className="h-3 w-3 ml-1.5" />
                                            </Button>
                                        )}

                                        {prop.status === 'APPROVED_PENDING_PAYMENT' && (
                                            <Button 
                                                className="w-full h-9 bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-sm shadow-green-100"
                                                onClick={() => setActionModal({ type: "approve", prop })}
                                            >
                                                Verify & Make Live <CheckCircle className="h-3 w-3 ml-1.5" />
                                            </Button>
                                        )}

                                        {prop.status === 'APPROVED_PAYMENT_VERIFIED' && (
                                            <Button 
                                                className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-sm shadow-emerald-100"
                                                onClick={() => setActionModal({ type: "approve", prop })}
                                            >
                                                Activate & Make Live <CheckCircle className="h-3 w-3 ml-1.5" />
                                            </Button>
                                        )}

                                        {['PENDING_VERIFICATION', 'VERIFYING_DOCUMENTS', 'VERIFIED_SUCCESSFULLY'].includes(prop.status) && (
                                            <Button 
                                                className="w-full h-9 bg-rose-500 hover:bg-rose-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-sm shadow-rose-100" 
                                                onClick={() => setActionModal({ type: "correction", prop })}
                                            >
                                                Request Correction
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Modal */}
            {actionModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActionModal(null)}>
                    <Card className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-3">
                                {actionModal.type === 'approve' && <CheckCircle className="h-6 w-6 text-emerald-500" />}
                                {actionModal.type === 'verify' && <CheckCircle className="h-6 w-6 text-purple-500" />}
                                {actionModal.type === 'correction' && <AlertTriangle className="h-6 w-6 text-orange-500" />}
                                {actionModal.type === 'view_correction' && <FileText className="h-6 w-6 text-orange-500" />}
                                {actionModal.type === 'rollback' && <RefreshCcw className="h-6 w-6 text-slate-500" />}
                                {actionModal.type === 'reject' && <Trash2 className="h-6 w-6 text-red-500" />}
                                {actionModal.type === 'make_live' && <CheckCircle className="h-6 w-6 text-emerald-500" />}
                                {actionModal.type === 'request_bank' && <FileText className="h-6 w-6 text-purple-500" />}
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                                    {actionModal.type === 'approve' ? (actionModal.prop.status === 'APPROVED_PENDING_PAYMENT' ? 'Final Activation' : 'Approve Submission') : 
                                     actionModal.type === 'verify' ? 'Confirm Verification' :
                                     actionModal.type === 'make_live' ? 'Verify Bank & Make Live' :
                                     actionModal.type === 'request_bank' ? 'Request Bank Details' :
                                     actionModal.type === 'correction' ? 'Request Correction' :
                                     actionModal.type === 'view_correction' ? 'Correction Details' :
                                     actionModal.type === 'rollback' ? 'Rollback Status' :
                                     actionModal.type === 'reject' ? 'Reject Submission' : 'Confirmation'}
                                </h3>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl">
                                <p className="text-sm font-bold text-slate-700">{actionModal.prop.name}</p>
                                <p className="text-xs text-slate-400 font-medium">ID: {actionModal.prop.displayId}</p>
                            </div>

                            {actionModal.type !== 'view_correction' && (
                                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
                                    <p className="text-sm text-amber-800 font-medium leading-relaxed">
                                        ⚠️ You are taking action on this property in the <strong className="font-bold bg-amber-100 px-1 rounded uppercase tracking-wider">{actionModal.prop.status.replace(/_/g, ' ')}</strong> stage. 
                                        Please make sure you have verified all the documents and details correctly before confirming.
                                    </p>
                                </div>
                            )}

                            {(actionModal.type === 'reject' || actionModal.type === 'correction' || actionModal.type === 'rollback') && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Reason / Note <span className="text-red-500">*</span></label>
                                    <textarea 
                                        className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-50 transition-all min-h-[100px]"
                                        placeholder={
                                            actionModal.type === 'reject' ? "Why is this property being rejected?" : 
                                            actionModal.type === 'rollback' ? "Why are you rolling back this property status?" :
                                            "What details need to be updated by the owner?"
                                        }
                                        value={actionReason}
                                        onChange={e => setActionReason(e.target.value)}
                                    />
                                </div>
                            )}

                            {actionModal.type === 'view_correction' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Active Correction Notes</label>
                                    <div className="w-full bg-orange-50 border-2 border-orange-100 rounded-2xl p-4 text-sm font-bold text-orange-900 min-h-[100px]">
                                        {actionModal.prop.adminNotes || "No correction notes found."}
                                    </div>
                                </div>
                            )}

                            {actionModal.type === 'make_live' && (
                                <div className="space-y-3">
                                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                                        <p className="text-xs text-purple-600 font-bold uppercase tracking-wider mb-1">Bank Account</p>
                                        <p className="text-sm font-mono font-black text-slate-900">{actionModal.prop.bankAccountNo}</p>
                                    </div>
                                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                                        <p className="text-xs text-purple-600 font-bold uppercase tracking-wider mb-1">IFSC Code</p>
                                        <p className="text-sm font-mono font-black text-slate-900 uppercase">{actionModal.prop.bankIfsc}</p>
                                    </div>
                                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                                        <p className="text-xs text-purple-600 font-bold uppercase tracking-wider mb-1">Beneficiary Name</p>
                                        <p className="text-sm font-black text-slate-900">{actionModal.prop.bankName}</p>
                                    </div>
                                    {actionModal.prop.cancelChequeUrl && (
                                        <div className="mt-4">
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Cancelled Cheque Photo</p>
                                            <a href={actionModal.prop.cancelChequeUrl} target="_blank" rel="noopener noreferrer">
                                                <img src={actionModal.prop.cancelChequeUrl} alt="Cancelled Cheque" className="w-full h-40 object-cover rounded-xl border-2 border-slate-200 shadow-sm" />
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <Button 
                                    className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] bg-slate-900 hover:bg-black text-white shadow-lg active:scale-[0.98] transition-all"
                                    onClick={() => { setActionModal(null); setActionReason(""); }}
                                >
                                    {actionModal.type === 'view_correction' ? "Close" : "Cancel"}
                                </Button>
                                {actionModal.type !== 'view_correction' && (
                                    <Button 
                                        disabled={actionLoading || ((actionModal.type === 'reject' || actionModal.type === 'correction' || actionModal.type === 'rollback') && !actionReason.trim())}
                                        className={`flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] ${
                                            actionModal.type === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                                            actionModal.type === 'rollback' ? 'bg-slate-600 hover:bg-slate-700' :
                                            actionModal.type === 'correction' ? 'bg-orange-600 hover:bg-orange-700' :
                                            'bg-blue-600 hover:bg-blue-700'
                                        } text-white shadow-lg active:scale-[0.98] transition-all`}
                                        onClick={handleAction}
                                    >
                                        {actionLoading ? "Processing..." : "Confirm Action"}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>
            )}
            {/* Custom Global Scrollbar Styles */}
            <style dangerouslySetInnerHTML={{__html: `
                .no-scrollbar::-webkit-scrollbar {
                    display: none !important;
                }
                .no-scrollbar {
                    -ms-overflow-style: none !important;
                    scrollbar-width: none !important;
                }
            `}} />
        </div>
    );
}
