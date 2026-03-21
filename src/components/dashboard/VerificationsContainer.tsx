"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    CheckCircle, XCircle, Clock, Eye, AlertCircle,
    User, Building2, CreditCard, Calendar, ArrowRight,
    MapPin, Phone, Mail, Trash2, RefreshCcw, Info, FileText, Shield, FileCheck, Camera, ShieldCheck, Upload, Search
} from "lucide-react";
import { getPendingDocuments, verifyDocument } from "@/actions/documents";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

const TYPE_LABELS: Record<string, string> = {
    AADHAAR_FRONT: "Aadhaar (Front)",
    AADHAAR_BACK: "Aadhaar (Back)",
    PAN_FRONT: "PAN Card (Front)",
    PAN_BACK: "PAN Card (Back)",
    STUDENT_ID: "Student / University ID",
    COMPANY_ID: "Company ID / Offer Letter",
    LIVE_PHOTO: "Current Photo",
    OTHER: "Other Documents",
    ID_PROOF: "Identity Proof",
    ADDRESS_PROOF: "Address Proof",
    COLLEGE_COMPANY: "College / Company ID",
    SELFIE: "Current Identity Check",
};

const TYPE_ICONS: Record<string, any> = {
    AADHAAR_FRONT: <User className="w-4 h-4" />,
    AADHAAR_BACK: <User className="w-4 h-4" />,
    PAN_FRONT: <CreditCard className="w-4 h-4" />,
    PAN_BACK: <CreditCard className="w-4 h-4" />,
    STUDENT_ID: <Building2 className="w-4 h-4" />,
    COMPANY_ID: <Building2 className="w-4 h-4" />,
    LIVE_PHOTO: <Camera className="w-4 h-4" />,
    OTHER: <FileText className="w-4 h-4" />,
    ID_PROOF: <User className="w-4 h-4" />,
    ADDRESS_PROOF: <MapPin className="w-4 h-4" />,
    COLLEGE_COMPANY: <Building2 className="w-4 h-4" />,
    SELFIE: <CheckCircle className="w-4 h-4" />,
};

const TYPE_CONFIG: any = {
    AADHAAR_FRONT: { label: 'Aadhaar Front', desc: 'Front side of Aadhaar card', icon: <User className="w-5 h-5" />, colorClass: 'text-blue-600', bgClass: 'bg-blue-50', borderClass: 'border-blue-200' },
    AADHAAR_BACK: { label: 'Aadhaar Back', desc: 'Back side of Aadhaar card', icon: <User className="w-5 h-5" />, colorClass: 'text-blue-500', bgClass: 'bg-blue-50', borderClass: 'border-blue-200' },
    PAN_FRONT: { label: 'PAN Card Front', desc: 'Front side of PAN card', icon: <CreditCard className="w-5 h-5" />, colorClass: 'text-green-600', bgClass: 'bg-green-50', borderClass: 'border-green-200' },
    PAN_BACK: { label: 'PAN Card Back', desc: 'Back side of PAN card (Optional)', icon: <CreditCard className="w-5 h-5" />, colorClass: 'text-green-500', bgClass: 'bg-green-50', borderClass: 'border-green-200' },
    STUDENT_ID: { label: 'Student / University ID', desc: 'Current academic year', icon: <Building2 className="w-5 h-5" />, colorClass: 'text-purple-600', bgClass: 'bg-purple-50', borderClass: 'border-purple-200' },
    COMPANY_ID: { label: 'Company ID / Offer Letter', desc: 'For working professionals', icon: <Building2 className="w-5 h-5" />, colorClass: 'text-orange-600', bgClass: 'bg-orange-50', borderClass: 'border-orange-200' },
    LIVE_PHOTO: { label: 'Current Photo', desc: 'User identity verification', icon: <Camera className="w-5 h-5" />, colorClass: 'text-cyan-600', bgClass: 'bg-cyan-50', borderClass: 'border-cyan-200' },
    OTHER: { label: 'Other Documents', desc: 'Any additional document (Optional)', icon: <FileText className="w-5 h-5" />, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', borderClass: 'border-slate-200' },
    ID_PROOF: { label: 'Identity Proof', desc: 'Aadhaar, PAN or Voter ID', icon: <FileText className="w-5 h-5" />, colorClass: 'text-indigo-600', bgClass: 'bg-indigo-50', borderClass: 'border-indigo-200' },
    ADDRESS_PROOF: { label: 'Address Proof', desc: 'Electricity Bill or Rent Agreement', icon: <MapPin className="w-5 h-5" />, colorClass: 'text-orange-600', bgClass: 'bg-orange-50', borderClass: 'border-orange-200' },
    COLLEGE_COMPANY: { label: 'College / Work', desc: 'ID Card or Offer Letter', icon: <Building2 className="w-5 h-5" />, colorClass: 'text-purple-600', bgClass: 'bg-purple-50', borderClass: 'border-purple-200' },
    SELFIE: { label: 'Current Selfie', desc: 'User identity verification', icon: <Camera className="w-5 h-5" />, colorClass: 'text-cyan-600', bgClass: 'bg-cyan-50', borderClass: 'border-cyan-200' },
};

export function VerificationsContainer() {
    const [docs, setDocs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [dateFilter, setDateFilter] = useState<"ALL" | "7D" | "30D">("7D");
    const [propertyFilter, setPropertyFilter] = useState("ALL");
    const [roomTypeFilter, setRoomTypeFilter] = useState("ALL");
    const [paymentFilter, setPaymentFilter] = useState("ALL");
    const [selectedBooking, setSelectedBooking] = useState<any>(null);
    const [rejectNote, setRejectNote] = useState("");
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const [previewDoc, setPreviewDoc] = useState<any>(null);

    const fetchDocs = async () => {
        setLoading(true);
        try {
            const data = await getPendingDocuments();
            setDocs(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDocs(); }, []);

    const filteredDocs = docs.filter(doc => {
        if (dateFilter !== "ALL") {
            const date = new Date(doc.createdAt || doc.updatedAt);
            const now = new Date();
            const diffDays = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);
            if (dateFilter === "7D" && diffDays > 7) return false;
            if (dateFilter === "30D" && diffDays > 30) return false;
        }

        if (propertyFilter !== "ALL" && doc.booking?.propertyName !== propertyFilter) return false;
        if (roomTypeFilter !== "ALL" && doc.booking?.occupancy !== roomTypeFilter) return false;
        if (paymentFilter !== "ALL" && (doc.booking?.paymentMethod || "Online") !== paymentFilter) return false;

        const query = search.toLowerCase();
        return (
            doc.booking?.guestName?.toLowerCase().includes(query) ||
            doc.booking?.displayId?.toLowerCase().includes(query) ||
            doc.booking?.propertyName?.toLowerCase().includes(query) ||
            doc.booking?.guestPhone?.toLowerCase().includes(query) ||
            doc.booking?.roomAssigned?.toLowerCase().includes(query)
        );
    });

    const handleVerifyUpdate = async (docId: string, status: 'VERIFIED' | 'REJECTED', note?: string) => {
        try {
            await verifyDocument(docId, status, note);
            toast.success(status === 'VERIFIED' ? "Document Verified" : "Reupload Requested", {
                description: status === 'VERIFIED' ? "Verification complete." : "Tenant notified for reupload.",
            });
            if (status === 'REJECTED') {
                setRejectTarget(null);
                setRejectNote("");
            }
            fetchDocs();
        } catch (e) {
            toast.error("Action Failed");
        }
    };
    if (loading) return (
        <div className="p-8 flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground font-medium text-xs tracking-widest uppercase">Fetching Verification Queue...</p>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border shadow-sm">
                <div>
                    <h1 className="text-2xl font-black tracking-tighter text-slate-900 flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl text-white">
                            <Shield className="w-6 h-6" />
                        </div>
                        Verification Center
                    </h1>
                    <p className="text-slate-500 mt-1 font-bold text-xs uppercase tracking-tight">Status-based review of student identity documents</p>
                </div>
                {docs.length > 0 && (
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Pending</p>
                            <p className="text-xl font-black text-indigo-600 leading-none">{docs.filter(d => d.status === "PENDING").length}</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={fetchDocs} disabled={loading} className="rounded-xl border-slate-200 font-bold uppercase text-[10px] tracking-widest h-9">
                                <RefreshCcw className={`w-3 h-3 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[280px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by name, room, or ID..."
                            className="pl-11 h-10 border-slate-200 bg-slate-50/30 focus:bg-white rounded-xl text-sm transition-all shadow-none"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <select
                        value={propertyFilter}
                        onChange={(e) => setPropertyFilter(e.target.value)}
                        className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-w-[160px]"
                    >
                        <option value="ALL">All Properties (PGs)</option>
                        {Array.from(new Set(docs.map(d => d.booking?.propertyName).filter(Boolean))).map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>

                    <select
                        value={roomTypeFilter}
                        onChange={(e) => setRoomTypeFilter(e.target.value)}
                        className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-w-[140px]"
                    >
                        <option value="ALL">All Room Types</option>
                        {Array.from(new Set(docs.map(d => d.booking?.occupancy).filter(Boolean))).map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>

                    <select
                        value={paymentFilter}
                        onChange={(e) => setPaymentFilter(e.target.value)}
                        className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-w-[140px]"
                    >
                        <option value="ALL">All Payments</option>
                        {Array.from(new Set(docs.map(d => d.booking?.paymentMethod || "Online").filter(Boolean))).map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <div className="flex bg-slate-100/50 p-1 rounded-xl w-fit border border-slate-200">
                        {([
                            ["7D", "Last 7 Days"],
                            ["30D", "Last 30 Days"],
                            ["ALL", "Lifetime"],
                        ] as const).map(([val, label]) => (
                            <button
                                key={val}
                                onClick={() => setDateFilter(val)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest ${
                                    dateFilter === val
                                        ? "bg-indigo-600 text-white shadow-md"
                                        : "text-slate-500 hover:text-slate-700"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                        Verification Queue
                    </div>
                </div>
            </div>

            {docs.length === 0 ? (
                <Card className="border-dashed border-2 bg-slate-50/50">
                    <CardContent className="p-16 text-center">
                        <div className="w-16 h-16 bg-white shadow-inner rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <FileCheck className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Verification Queue Empty</h3>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-tighter mt-1">No submissions found at this time.</p>
                    </CardContent>
                </Card>
            ) : filteredDocs.length === 0 ? (
                <Card className="border-slate-100">
                    <CardContent className="p-12 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                        No matches found for &quot;{search}&quot;
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-12">
                    {['PENDING', 'VERIFIED', 'REJECTED'].map((status) => {
                        const groupedByBooking: Record<string, { booking: any, docs: any[], overallStatus: string }> = {};

                        filteredDocs.forEach(doc => {
                            const bid = doc.booking?.id || 'unknown';
                            if (!groupedByBooking[bid]) {
                                groupedByBooking[bid] = { booking: doc.booking, docs: [], overallStatus: 'VERIFIED' };
                            }
                            groupedByBooking[bid].docs.push(doc);
                        });

                        Object.values(groupedByBooking).forEach(group => {
                            if (group.docs.some(d => d.status === 'REJECTED')) group.overallStatus = 'REJECTED';
                            else if (group.docs.some(d => d.status === 'PENDING')) group.overallStatus = 'PENDING';
                        });

                        const groupsInStatus = Object.values(groupedByBooking).filter(g => g.overallStatus === status);
                        if (groupsInStatus.length === 0) return null;

                        const STATUS_MAP: any = {
                            PENDING: { label: "PENDING DOCUMENTS", color: "text-red-600", bg: "bg-red-500", icon: <Clock className="w-4 h-4" /> },
                            VERIFIED: { label: "VERIFIED DOCUMENTS", color: "text-emerald-600", bg: "bg-emerald-500", icon: <CheckCircle className="w-4 h-4" /> },
                            REJECTED: { label: "REJECTED DOCUMENTS", color: "text-slate-500", bg: "bg-slate-400", icon: <XCircle className="w-4 h-4" /> }
                        };
                        const config = STATUS_MAP[status];

                        return (
                            <div key={status} className="animate-in fade-in slide-in-from-bottom-5 duration-500">
                                <div className="flex items-center gap-3 mb-6 px-2">
                                    <div className={`p-2 rounded-lg ${config.bg} text-white shadow-lg shadow-indigo-100`}>
                                        {config.icon}
                                    </div>
                                    <h2 className={`text-sm font-black tracking-[0.2em] uppercase ${config.color}`}>
                                        {config.label} ({groupsInStatus.length})
                                    </h2>
                                </div>
                                <div className="space-y-4">
                                    {groupsInStatus.map((group: any) => (
                                        <DocumentRowCard
                                            key={group.booking.id}
                                            group={group}
                                            onViewPortfolio={() => setSelectedBooking({ booking: group.booking, docs: group.docs })}
                                            onZoom={(doc: any) => setPreviewDoc(doc)}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
                <DialogContent className="!fixed !inset-0 !translate-x-0 !translate-y-0 !max-w-none !w-screen !h-screen !m-0 !rounded-none bg-white flex flex-col !shadow-none !border-none z-[100] !p-0">
                    <div className="sr-only">
                        <DialogTitle>Document Verification Details</DialogTitle>
                        <DialogDescription>Review and verify tenant uploaded documents</DialogDescription>
                    </div>
                    {selectedBooking && (
                        <>
                            <div className="p-8 bg-white border-b border-slate-100 flex justify-between items-center sticky top-0 z-20 shadow-sm">
                                <div className="flex items-center gap-8">
                                    <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-indigo-600 to-violet-700 text-white flex items-center justify-center text-3xl font-black shadow-2xl shadow-indigo-200 uppercase transform -rotate-3 transition-transform duration-700 group-hover:rotate-0">
                                        {selectedBooking.booking.guestName ? selectedBooking.booking.guestName[0] : 'U'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-4">
                                            <h2 className="text-3xl font-black text-slate-910 tracking-tighter uppercase leading-none">{selectedBooking.booking.guestName}</h2>
                                            {selectedBooking.docs.length === 4 && selectedBooking.docs.every((d: any) => d.status === "VERIFIED") && (
                                                <div className="bg-emerald-500 text-white font-black text-[10px] uppercase px-4 py-1.5 rounded-full shadow-lg shadow-emerald-100 border-2 border-emerald-400 animate-bounce-subtle">
                                                    Fully Verified ✔
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 mt-3">
                                            <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100/50 text-[11px] font-black uppercase tracking-widest shadow-sm">{selectedBooking.booking.propertyName}</span>
                                            <div className="h-1 w-1 rounded-full bg-slate-300"></div>
                                            <span className="text-slate-600 font-black text-[12px] uppercase tracking-tighter bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">Room {selectedBooking.booking.roomAssigned || "TBD"}</span>
                                            <span className="text-slate-400 font-bold text-[11px] uppercase tracking-widest opacity-60">ID: #{selectedBooking.booking.displayId}</span>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="hover:bg-rose-50 hover:text-rose-500 rounded-2xl h-14 w-14 transition-all duration-300 group"
                                    onClick={() => setSelectedBooking(null)}
                                >
                                    <XCircle className="w-8 h-8 group-hover:rotate-90 transition-transform" />
                                </Button>
                            </div>

                            <div className="flex-1 overflow-y-auto bg-slate-50/50">
                                <div className="p-8 flex-1 overflow-y-auto">
                                    <div className="w-full h-full">
                                        <div id="unique-verification-grid" className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-7xl mx-auto">
                                            {Object.keys(TYPE_LABELS).map((type) => {
                                                const doc = selectedBooking.docs.find((d: any) => d.type === type);
                                                return (
                                                    <DocumentDetailCard
                                                        key={type}
                                                        type={type}
                                                        doc={doc}
                                                        onVerify={() => handleVerifyUpdate(doc?.id, 'VERIFIED')}
                                                        onReject={() => setRejectTarget(doc?.id)}
                                                        onView={() => doc && setPreviewDoc(doc)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600 font-black uppercase text-sm tracking-widest">
                            <AlertCircle className="w-5 h-5" />
                            Request Re-upload
                        </DialogTitle>
                        <DialogDescription className="font-bold text-xs">
                            Explain precisely why this document is being rejected. The student will be prompted to re-upload.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea
                            placeholder="e.g., Image is blurry, name does not match, etc..."
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            className="min-h-[100px] border-slate-200 focus:ring-red-500 rounded-xl font-medium"
                        />
                    </div>
                    <DialogFooter>
                        <button 
                            className="px-6 py-2 text-xs font-black bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-full transition-all active:scale-95 shadow-sm uppercase tracking-widest" 
                            onClick={() => setRejectTarget(null)}
                        >
                            CANCEL
                        </button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 font-black text-xs tracking-widest h-11 px-8 rounded-xl text-white"
                            onClick={() => handleVerifyUpdate(rejectTarget!, 'REJECTED', rejectNote)}
                        >
                            REQUEST REUPLOAD
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
                <DialogContent className="!fixed !inset-0 !translate-x-0 !translate-y-0 !max-w-none !w-screen !h-screen !m-0 !rounded-none bg-slate-950 flex flex-col md:flex-row !shadow-none !border-none z-[110] !p-0">
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                        <div className="p-6 bg-white/5 backdrop-blur-3xl flex justify-between items-center text-white border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-6">
                                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">{previewDoc && TYPE_ICONS[previewDoc.type]}</div>
                                <div>
                                    <DialogTitle className="font-black text-lg tracking-[0.15em] uppercase text-white leading-tight">
                                        {previewDoc && TYPE_LABELS[previewDoc.type]}
                                    </DialogTitle>
                                    <DialogDescription className="text-[11px] font-black opacity-40 uppercase tracking-[0.1em] text-white transition-opacity group-hover:opacity-100">
                                        Full Document View • {previewDoc?.booking?.guestName}
                                    </DialogDescription>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="md:hidden hover:bg-rose-500/20 hover:text-rose-500 text-white/50 rounded-2xl h-12 w-12 transition-all"
                                onClick={() => setPreviewDoc(null)}
                            >
                                <XCircle className="w-8 h-8" />
                            </Button>
                        </div>

                        <div className="flex-1 flex items-center justify-center p-4 min-h-0 bg-black/40 overflow-auto">
                            {previewDoc?.fileData?.startsWith("data:image") ? (
                                <img
                                    src={previewDoc.fileData}
                                    className="max-w-[95vw] max-h-[85vh] object-contain rounded-2xl shadow-[0_0_100px_rgba(30,58,138,0.2)] animate-in zoom-in duration-500"
                                    alt="Document"
                                />
                            ) : (
                                <div className="text-white/30 text-center font-black uppercase tracking-widest text-xs">
                                    <FileText className="w-24 h-24 mx-auto mb-6 opacity-10" />
                                    No Visual Data Found
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="w-full md:w-96 bg-slate-900 border-l border-white/10 flex flex-col h-[50vh] md:h-screen shrink-0">
                        <div className="p-6 border-b border-white/10 shrink-0 flex items-center justify-between">
                            <h3 className="text-white font-black uppercase tracking-[0.2em] text-sm flex items-center gap-3">
                                <Clock className="w-4 h-4 text-indigo-400" />
                                History
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                            {(() => {
                                if (!previewDoc) return null;
                                let trail = [];
                                try { trail = JSON.parse(previewDoc.auditTrail || '[]'); } catch (e) { }
                                if (trail.length === 0) return null;
                                return trail.map((event: any, index: number) => (
                                    <div key={index} className="flex gap-4">
                                        <div className="pt-1">
                                            <div className="text-[11px] font-black uppercase tracking-widest text-indigo-400">{event.actionType || event.action}</div>
                                            <p className="text-[11px] text-white/60 mb-1">{event.description || event.details}</p>
                                            <span className="text-[9px] text-white/40">{new Date(event.createdAt || event.timestamp).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                        <div className="p-6 border-t border-white/10">
                            <button 
                                className="w-full py-4 text-xs font-black bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-full transition-all active:scale-95 shadow-sm uppercase tracking-widest" 
                                onClick={() => setPreviewDoc(null)}
                            >
                                CLOSE PREVIEW
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <style jsx global>{`
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
                .animate-bounce-subtle { animation: bounce-subtle 3s infinite ease-in-out; }
            `}</style>
        </div>
    );
}

function DocumentRowCard({ group, onViewPortfolio, onZoom }: any) {
    const { booking, docs } = group;
    const uploadedTypes = [...new Set(docs.map((d: any) => d.type))] as string[];
    const docTypes = uploadedTypes.length > 0 ? uploadedTypes : ['AADHAAR_FRONT', 'AADHAAR_BACK', 'PAN_FRONT', 'STUDENT_ID', 'COMPANY_ID', 'LIVE_PHOTO'];
    const totalDocs = docTypes.length;
    const verifiedDocs = docs.filter((d: any) => d.status === "VERIFIED");
    const verifiedPercentage = totalDocs > 0 ? Math.round((verifiedDocs.length / totalDocs) * 100) : 0;

    const getStatusDetails = (type: string) => {
        const doc = docs.find((d: any) => d.type === type);
        if (!doc) return { color: 'bg-slate-200 border-2 border-dashed border-slate-300', icon: <div className="w-1.5 h-1.5 rounded-full bg-slate-400" /> };
        if (doc.status === 'VERIFIED') return { color: 'bg-emerald-500', icon: <CheckCircle className="w-2.5 h-2.5 text-white" /> };
        if (doc.status === 'REJECTED') return { color: 'bg-rose-500', icon: <XCircle className="w-2.5 h-2.5 text-white" /> };
        return { color: 'bg-amber-400 animate-pulse', icon: <Clock className="w-2.5 h-2.5 text-white" /> };
    };

    return (
        <Card className="border-none shadow-md hover:shadow-xl transition-all duration-300 group overflow-hidden bg-white rounded-2xl border-l-4 border-slate-100 hover:border-indigo-500 transform hover:-translate-y-1">
            <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-6 flex-1 min-w-[400px]">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 flex items-center justify-center text-xl font-black text-slate-400 shadow-inner group-hover:scale-110 transition-transform group-hover:text-indigo-500 group-hover:border-indigo-100">
                            {booking?.guestName ? booking.guestName[0].toUpperCase() : 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 truncate">
                                <h3 className="font-black text-slate-900 text-base tracking-tight uppercase truncate group-hover:text-indigo-600 transition-colors">{booking?.guestName}</h3>
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">#{booking?.displayId}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 mb-1 text-[11px] font-bold text-slate-500 uppercase">
                                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 opacity-50" /> {booking?.propertyName}</span>
                                <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 opacity-50" /> {booking?.guestPhone}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 px-6 border-x border-slate-100">
                            {docTypes.map(type => {
                                const status = getStatusDetails(type);
                                return (
                                    <div key={type} className="flex flex-col items-center gap-1.5">
                                        <div className={`w-8 h-8 rounded-xl ${status.color} flex items-center justify-center shadow-sm transition-all hover:scale-110 hover:shadow-md`}>
                                            {status.icon}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                        <Button
                            variant="outline"
                            className="h-11 px-6 rounded-xl border-slate-200 text-slate-700 font-bold uppercase text-[11px] tracking-widest hover:bg-slate-50 transition-all hover:border-indigo-200 hover:text-indigo-600 flex items-center gap-3 group/btn shadow-sm active:scale-95"
                            onClick={onViewPortfolio}
                        >
                            <FileText className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" /> View Documents
                        </Button>
                        <Badge className={`h-11 px-6 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg flex items-center gap-2 border-none bg-indigo-600 text-white shadow-indigo-100`}>
                            <Shield className="w-3.5 h-3.5" /> {verifiedPercentage}% Verified
                        </Badge>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function DocumentDetailCard({ type, doc, onVerify, onReject, onView }: any) {
    const config = TYPE_CONFIG[type];
    const isVerified = doc?.status === "VERIFIED";
    const isRejected = doc?.status === "REJECTED";

    return (
        <div className={`border-2 ${config.borderClass} transition-all rounded-[2rem] p-6 flex flex-col justify-between shadow-xl bg-white group hover:shadow-2xl relative overflow-hidden ${isVerified ? 'ring-2 ring-emerald-500 ring-offset-4' : ''}`}>
            <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 ${config.bgClass} rounded-2xl ${config.colorClass} shadow-inner`}>{config.icon}</div>
                <div>
                    <h4 className="font-black text-lg tracking-tight text-slate-900 uppercase">{config.label}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{config.desc}</p>
                </div>
                {isVerified && (
                    <div className="ml-auto bg-emerald-500 text-white p-2 rounded-xl shadow-lg shadow-emerald-100">
                        <CheckCircle className="w-5 h-5" />
                    </div>
                )}
            </div>

            {doc ? (
                <div className="relative group/doc h-64 sm:h-80 rounded-[1.5rem] overflow-hidden border-2 border-slate-100 bg-slate-950 shadow-inner">
                    {doc.fileData?.startsWith("data:image") ? (
                        <img src={doc.fileData} className="w-full h-full object-contain p-2 group-hover/doc:scale-105 transition-all duration-700" title="Click for Full Resolution" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                            <FileText className="w-16 h-16 opacity-20 mb-4" />
                            <span className="font-black uppercase tracking-widest text-[10px] opacity-30 text-white text-center px-10">Document Preview Not Available</span>
                        </div>
                    )}

                    <div className="absolute inset-x-0 bottom-0 bg-white/95 border-t border-slate-200 flex opacity-0 group-hover/doc:opacity-100 transition-all duration-300 divide-x shadow-2xl translate-y-2 group-hover/doc:translate-y-0">
                        {!isVerified && (
                            <>
                                <button
                                    onClick={(e) => { e.preventDefault(); onVerify(); }}
                                    className="flex-1 py-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase transition-colors hover:bg-emerald-50 text-emerald-700 tracking-widest"
                                >
                                    <ShieldCheck className="w-4 h-4" /> Verify
                                </button>
                                <button
                                    onClick={(e) => { e.preventDefault(); onReject(); }}
                                    className="flex-1 py-4 hover:bg-rose-50 text-rose-700 flex items-center justify-center gap-2 text-[10px] font-black uppercase transition-colors tracking-widest"
                                >
                                    <RefreshCcw className="w-4 h-4" /> Reupload
                                </button>
                            </>
                        )}
                        <button
                            onClick={(e) => { e.preventDefault(); onView(); }}
                            className="flex-1 py-4 hover:bg-slate-50 text-slate-600 flex items-center justify-center gap-2 text-[10px] font-black uppercase transition-colors tracking-widest"
                        >
                            <Eye className="w-4 h-4" /> View Full
                        </button>
                    </div>

                    {isRejected && doc.rejectedNote && (
                        <div className="absolute top-4 left-4 right-4 bg-rose-600/90 backdrop-blur-md p-3 rounded-xl border border-white/20 shadow-2xl">
                            <p className="text-[10px] font-black text-white leading-relaxed uppercase tracking-tighter italic flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                &quot;{doc.rejectedNote}&quot;
                            </p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="h-64 sm:h-80 border-4 border-dashed border-slate-100 rounded-[1.5rem] flex flex-col items-center justify-center bg-slate-50 opacity-40">
                    <div className="p-6 bg-white rounded-3xl shadow-sm border border-slate-100 mb-4">
                        <Upload className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Awaiting Upload</p>
                </div>
            )}
        </div>
    );
}
