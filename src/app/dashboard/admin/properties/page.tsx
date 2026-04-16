"use client";

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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { 
    Building, RefreshCcw, Eye, CheckCircle, XCircle, AlertTriangle, 
    Phone, Mail, FileText, Check, CreditCard, Ban, Trash2, 
    MapPin, User as UserIcon, Calendar, ArrowRight
} from "lucide-react";
import Link from "next/link";

const STATUS_TABS = [
    { key: "PENDING_VERIFICATION", label: "Approve Applications", icon: FileText, color: "bg-blue-600" },
    { key: "VERIFYING_DOCUMENTS", label: "Verifying Documents", icon: Eye, color: "bg-purple-600" },
    { key: "NEEDS_CORRECTION", label: "Needs Correction", icon: AlertTriangle, color: "bg-amber-500" },
    { key: "VERIFIED_SUCCESSFULLY", label: "Verified Successfully", icon: Check, color: "bg-orange-500" },
    { key: "APPROVED_PENDING_PAYMENT", label: "Pending Payment", icon: CreditCard, color: "bg-orange-600" },
    { key: "APPROVED", label: "Live Properties", icon: Building, color: "bg-green-600" },
    { key: "REJECTED", label: "Rejected", icon: Trash2, color: "bg-red-600" },
];

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string, color: string }> = {
        PENDING_VERIFICATION: { label: "APPLICATION PENDING", color: "bg-blue-50 text-blue-600 border-blue-200" },
        VERIFYING_DOCUMENTS: { label: "VERIFYING DOCUMENTS", color: "bg-purple-50 text-purple-600 border-purple-200" },
        NEEDS_CORRECTION: { label: "NEEDS CORRECTION", color: "bg-amber-50 text-amber-600 border-amber-200" },
        VERIFIED_SUCCESSFULLY: { label: "VERIFIED SUCCESSFULLY", color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
        APPROVED_PENDING_PAYMENT: { label: "PENDING PAYMENT", color: "bg-orange-50 text-orange-600 border-orange-200" },
        APPROVED: { label: "LIVE & ACTIVE", color: "bg-green-50 text-green-600 border-green-200" },
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
    const [actionModal, setActionModal] = useState<{ type: "reject" | "correction" | "approve" | "verify" | "payment" | "rollback" | "view_correction"; prop: any } | null>(null);
    const [actionReason, setActionReason] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [searchQ, setSearchQ] = useState("");

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

    const filtered = properties.filter(p =>
        !searchQ || p.id === searchQ || p.name?.toLowerCase().includes(searchQ.toLowerCase()) ||
        p.city?.toLowerCase().includes(searchQ.toLowerCase()) ||
        p.owner?.name?.toLowerCase().includes(searchQ.toLowerCase())
    );

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

            {/* Quick Stats - Premium Style */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Pending Verification", count: statusCounts['PENDING_VERIFICATION'] || 0, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
                    { label: "Live Properties", count: statusCounts['APPROVED'] || 0, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
                    { label: "Needs Correction", count: statusCounts['NEEDS_CORRECTION'] || 0, color: "text-orange-600", bg: "bg-orange-50 border-orange-100" },
                    { label: "Rejected/Suspended", count: (statusCounts['REJECTED'] || 0) + (statusCounts['SUSPENDED'] || 0), color: "text-red-600", bg: "bg-red-50 border-red-100" },
                ].map((s, i) => (
                    <div key={i} className={`p-5 rounded-2xl border-2 shadow-sm ${s.bg} flex flex-col gap-1 hover:scale-[1.02] transition-transform cursor-default`}>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{s.label}</span>
                        <span className={`text-2xl font-black ${s.color}`}>{s.count}</span>
                    </div>
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

            {/* Search Bar */}
            <div className="max-w-md relative group">
                <input 
                    type="text" 
                    placeholder="Search by ID, Name, City or Owner..."
                    className="w-full h-12 bg-white border-2 border-slate-200 rounded-2xl px-5 text-sm font-medium focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all shadow-sm"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                    🔍
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
                    filtered.map((prop) => (
                        <Card key={prop.id} className="rounded-3xl border shadow-sm hover:shadow-xl transition-all group overflow-hidden bg-white">
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
                                        </div>
                                    </div>

                                    {/* Actions Right */}
                                    <div className="md:w-64 bg-slate-50/50 p-5 md:p-6 border-l border-slate-100 flex flex-col gap-2 justify-center">
                                        <Link href={`/dashboard/admin/properties/${prop.id}`}>
                                            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-full border-none">
                                                <Eye className="h-4 w-4 mr-2" /> Details
                                            </Button>
                                        </Link>

                                        {prop.status === 'NEEDS_CORRECTION' && (
                                            <>
                                                <Button 
                                                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-widest text-[10px] rounded-full"
                                                    onClick={async () => {
                                                        await logCorrectionView(prop.id);
                                                        setActionModal({ type: "view_correction", prop });
                                                    }}
                                                >
                                                    Needs Corrections Details
                                                </Button>
                                                <Button 
                                                    className="w-full bg-slate-600 hover:bg-slate-700 text-white font-black uppercase tracking-widest text-[10px] rounded-full"
                                                    onClick={() => setActionModal({ type: "rollback", prop })}
                                                >
                                                    Move Back
                                                </Button>
                                            </>
                                        )}

                                        {/* State Machine Action */}
                                        {prop.status === 'PENDING_VERIFICATION' && (
                                            <Button 
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px]"
                                                onClick={() => setActionModal({ type: "approve", prop })}
                                            >
                                                Approve Application <ArrowRight className="h-3.5 w-3.5 ml-2" />
                                            </Button>
                                        )}

                                        {prop.status === 'VERIFYING_DOCUMENTS' && (
                                            <>
                                                {prop.adminNotes && (
                                                    <Button 
                                                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-widest text-[10px] rounded-full animate-pulse shadow-lg shadow-orange-100"
                                                        onClick={async () => {
                                                            await logCorrectionView(prop.id);
                                                            setActionModal({ type: "view_correction", prop });
                                                        }}
                                                    >
                                                        Correction Details
                                                    </Button>
                                                )}
                                                <Button 
                                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-widest text-[10px] rounded-full"
                                                    onClick={() => setActionModal({ type: "verify", prop })}
                                                >
                                                    Mark Verified <CheckCircle className="h-3.5 w-3.5 ml-2" />
                                                </Button>
                                            </>
                                        )}

                                        {prop.status === 'VERIFIED_SUCCESSFULLY' && (
                                            <Button 
                                                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-widest text-[10px]"
                                                onClick={() => setActionModal({ type: "payment", prop })}
                                            >
                                                Request Payment <CreditCard className="h-3.5 w-3.5 ml-2" />
                                            </Button>
                                        )}

                                        {prop.status === 'APPROVED_PENDING_PAYMENT' && (
                                            <Button 
                                                className="w-full bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest text-[10px]"
                                                onClick={() => setActionModal({ type: "approve", prop })}
                                            >
                                                Verify & Make Live <CheckCircle className="h-3.5 w-3.5 ml-2" />
                                            </Button>
                                        )}

                                        {['PENDING_VERIFICATION', 'VERIFYING_DOCUMENTS', 'VERIFIED_SUCCESSFULLY'].includes(prop.status) && (
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                <Button size="sm" variant="outline" className="text-[9px] border-orange-200 text-orange-600 font-black uppercase tracking-widest px-0" onClick={() => setActionModal({ type: "correction", prop })}>
                                                    Correction
                                                </Button>
                                                <Button size="sm" variant="destructive" className="text-[9px] font-black uppercase tracking-widest px-0" onClick={() => setActionModal({ type: "reject", prop })}>
                                                    Reject
                                                </Button>
                                            </div>
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
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                                    {actionModal.type === 'approve' ? (actionModal.prop.status === 'APPROVED_PENDING_PAYMENT' ? 'Final Activation' : 'Approve Submission') : 
                                     actionModal.type === 'verify' ? 'Confirm Verification' :
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
        </div>
    );
}
