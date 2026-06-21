"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    CheckCircle, XCircle, Clock, Eye, AlertCircle,
    User, Building2, CreditCard, Calendar, FileText,
    MapPin, Trash2, RefreshCcw, Info, Shield, FileCheck, Camera, ShieldCheck, Upload, Search, ClipboardList
} from "lucide-react";
import { getPendingDocuments, verifyDocument } from "@/actions/documents";
import { getPhysicalKycBookings, markPhysicalKycVerified } from "@/actions/bookings";
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

function formatDateTime(date: string | Date | null | undefined) {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
    });
}

// ─── Physical KYC Log Card ────────────────────────────────────────────────────
function PhysicalKycCard({ booking, onMarkVerified }: { booking: any; onMarkVerified: (id: string) => void }) {
    const isVerified = !!booking.kycVerified;
    const tenantId = booking.tenant?.displayId || null;
    const verifierName = booking.kycVerifier?.name || '—';
    const verifierRole = booking.kycVerifier?.role || '';
    const verifiedAt = booking.kycVerifiedAt;

    return (
        <div className={`rounded-2xl border-2 p-4 transition-all duration-300 ${isVerified
            ? 'bg-green-50 border-green-200 shadow-sm shadow-green-100'
            : 'bg-red-50 border-red-200 shadow-sm shadow-red-100'
            }`}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                {/* Left: Student Info */}
                <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-lg shrink-0 ${isVerified ? 'bg-green-600' : 'bg-red-500'}`}>
                        {booking.guestName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 text-sm">{booking.guestName}</span>
                            {tenantId && (
                                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                                    {tenantId}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[11px] text-slate-600 font-medium flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {booking.property?.name || booking.propertyName}
                            </span>
                            {booking.room?.roomNumber && (
                                <span className="text-[11px] text-slate-600 font-medium">
                                    · Room {booking.room.roomNumber}
                                </span>
                            )}
                            {booking.roomAssigned && !booking.room?.roomNumber && (
                                <span className="text-[11px] text-slate-600 font-medium">
                                    · Room {booking.roomAssigned}
                                </span>
                            )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                            Booking ID: {booking.displayId}
                        </div>
                    </div>
                </div>

                {/* Right: Badge + Action */}
                <div className="flex flex-col items-end gap-2">
                    {isVerified ? (
                        <span className="flex items-center gap-1.5 bg-green-600 text-white text-[11px] font-black px-3 py-1.5 rounded-full shadow-md shadow-green-200">
                            <CheckCircle className="w-3.5 h-3.5" /> ✅ VERIFIED
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 bg-red-500 text-white text-[11px] font-black px-3 py-1.5 rounded-full shadow-md shadow-red-200 animate-pulse">
                            <XCircle className="w-3.5 h-3.5" /> ❌ NOT VERIFIED
                        </span>
                    )}
                    {!isVerified && (
                        <Button
                            size="sm"
                            className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl px-3 shadow-sm"
                            onClick={() => onMarkVerified(booking.id)}
                        >
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Mark as Verified
                        </Button>
                    )}
                </div>
            </div>

            {/* Verified By Footer */}
            <div className={`mt-3 pt-3 border-t flex items-center gap-2 flex-wrap ${isVerified ? 'border-green-200' : 'border-red-200'}`}>
                {isVerified ? (
                    <>
                        <Shield className={`w-3.5 h-3.5 ${isVerified ? 'text-green-600' : 'text-red-500'}`} />
                        <span className={`text-[11px] font-bold ${isVerified ? 'text-green-700' : 'text-red-600'}`}>
                            Verified by: <span className="font-black">{verifierName}</span>
                            {verifierRole ? ` (${verifierRole === 'OWNER' ? 'Owner' : verifierRole === 'STAFF' ? 'Staff' : 'Admin'})` : ''}
                            {' '}on {formatDateTime(verifiedAt)}
                        </span>
                    </>
                ) : (
                    <>
                        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-[11px] font-bold text-red-600">
                            Awaiting physical document verification at check-in
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Main Container ───────────────────────────────────────────────────────────
export function VerificationsContainer() {
    const [activeTab, setActiveTab] = useState<'documents' | 'physical'>('documents');

    // Document Verification state
    const [docs, setDocs] = useState<any[]>([]);
    const [docsLoading, setDocsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [dateFilter, setDateFilter] = useState<"ALL" | "7D" | "30D">("7D");
    const [propertyFilter, setPropertyFilter] = useState("ALL");
    const [roomTypeFilter, setRoomTypeFilter] = useState("ALL");
    const [paymentFilter, setPaymentFilter] = useState("ALL");
    const [selectedBooking, setSelectedBooking] = useState<any>(null);
    const [rejectNote, setRejectNote] = useState("");
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const [previewDoc, setPreviewDoc] = useState<any>(null);

    // Physical KYC Log state
    const [kycBookings, setKycBookings] = useState<any[]>([]);
    const [kycLoading, setKycLoading] = useState(false);
    const [kycSearch, setKycSearch] = useState("");

    const fetchDocs = async () => {
        setDocsLoading(true);
        try {
            const data = await getPendingDocuments();
            setDocs(data);
        } catch (e) {
            console.error(e);
        } finally {
            setDocsLoading(false);
        }
    };

    const fetchKycBookings = async () => {
        setKycLoading(true);
        try {
            const data = await getPhysicalKycBookings();
            setKycBookings(data);
        } catch (e) {
            console.error(e);
        } finally {
            setKycLoading(false);
        }
    };

    useEffect(() => { fetchDocs(); }, []);

    useEffect(() => {
        if (activeTab === 'physical') fetchKycBookings();
    }, [activeTab]);

    const handleMarkVerified = async (bookingId: string) => {
        try {
            await markPhysicalKycVerified(bookingId);
            toast.success("✅ Physical KYC Verified", {
                description: "Student marked as physically verified. Audit log saved.",
            });
            fetchKycBookings();
        } catch (e) {
            toast.error("Verification failed. Try again.");
        }
    };

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

    const filteredKycBookings = kycBookings.filter(b => {
        const q = kycSearch.toLowerCase();
        return (
            b.guestName?.toLowerCase().includes(q) ||
            b.displayId?.toLowerCase().includes(q) ||
            b.propertyName?.toLowerCase().includes(q) ||
            b.tenant?.displayId?.toLowerCase().includes(q) ||
            b.property?.name?.toLowerCase().includes(q)
        );
    });

    const verifiedKyc = filteredKycBookings.filter(b => b.kycVerified);
    const unverifiedKyc = filteredKycBookings.filter(b => !b.kycVerified);

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

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-10">
            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border shadow-sm">
                <div>
                    <h1 className="text-2xl font-black tracking-tighter text-slate-900 flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl text-white">
                            <Shield className="w-6 h-6" />
                        </div>
                        Verification Center
                    </h1>
                    <p className="text-slate-500 mt-1 font-bold text-xs uppercase tracking-tight">Document reviews & physical KYC status</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline" size="sm"
                        onClick={() => activeTab === 'documents' ? fetchDocs() : fetchKycBookings()}
                        className="rounded-xl border-slate-200 font-bold uppercase text-[10px] tracking-widest h-9"
                    >
                        <RefreshCcw className="w-3 h-3 mr-2" /> Refresh
                    </Button>
                </div>
            </div>

            {/* ── Physical KYC Bypass Notice ── */}
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 flex gap-3 text-amber-900 shadow-sm">
                <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-wider">Student Online KYC Bypassed (Physical Check-in Active)</p>
                    <p className="text-xs text-amber-700 leading-relaxed font-medium">
                        Student online uploads are bypassed. Students bring physical documents (ID proof, address proof) at check-in.
                        Use the Physical KYC Log tab to track verification status for all students.
                    </p>
                </div>
            </div>

            {/* ── Tab Switcher ── */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 w-fit">
                <button
                    onClick={() => setActiveTab('documents')}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${activeTab === 'documents'
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <FileText className="w-3.5 h-3.5" />
                    Document Verification
                    {docs.filter(d => d.status === 'PENDING').length > 0 && (
                        <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                            {docs.filter(d => d.status === 'PENDING').length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('physical')}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${activeTab === 'physical'
                        ? 'bg-white text-green-700 shadow-sm border border-slate-200'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Physical KYC Log
                    {kycBookings.length > 0 && unverifiedKyc.length > 0 && (
                        <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                            {kycBookings.filter(b => !b.kycVerified).length}
                        </span>
                    )}
                </button>
            </div>

            {/* ═══════════════════════════════════════════════════════
                TAB 1: DOCUMENT VERIFICATION
            ═══════════════════════════════════════════════════════ */}
            {activeTab === 'documents' && (
                <div className="space-y-6">
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
                            <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)}
                                className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-w-[160px]">
                                <option value="ALL">All Properties (PGs)</option>
                                {Array.from(new Set(docs.map(d => d.booking?.propertyName).filter(Boolean))).map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                            <select value={roomTypeFilter} onChange={(e) => setRoomTypeFilter(e.target.value)}
                                className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-w-[140px]">
                                <option value="ALL">All Room Types</option>
                                {Array.from(new Set(docs.map(d => d.booking?.occupancy).filter(Boolean))).map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}
                                className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-w-[140px]">
                                <option value="ALL">All Payments</option>
                                {Array.from(new Set(docs.map(d => d.booking?.paymentMethod || "Online").filter(Boolean))).map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                            <div className="flex bg-slate-100/50 p-1 rounded-xl w-fit border border-slate-200">
                                {(([["7D", "Last 7 Days"], ["30D", "Last 30 Days"], ["ALL", "Lifetime"]] as const)).map(([val, label]) => (
                                    <button key={val} onClick={() => setDateFilter(val)}
                                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest ${dateFilter === val ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-700"}`}>
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

                    {docsLoading ? (
                        <div className="p-8 flex flex-col items-center justify-center min-h-[300px] space-y-4">
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-muted-foreground font-medium text-xs tracking-widest uppercase">Fetching Verification Queue...</p>
                        </div>
                    ) : docs.length === 0 ? (
                        <Card className="border-dashed border-2 bg-slate-50/50">
                            <CardContent className="p-16 text-center">
                                <div className="w-16 h-16 bg-white shadow-inner rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                    <FileCheck className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Verification Queue Empty</h3>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-tighter mt-1">No document submissions found.</p>
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
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                TAB 2: PHYSICAL KYC LOG
            ═══════════════════════════════════════════════════════ */}
            {activeTab === 'physical' && (
                <div className="space-y-6">
                    {/* Search bar */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search by student name, booking ID, tenant ID or property..."
                                className="pl-11 h-10 border-slate-200 bg-slate-50/30 focus:bg-white rounded-xl text-sm"
                                value={kycSearch}
                                onChange={(e) => setKycSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                <span className="text-[11px] font-bold text-slate-600">{verifiedKyc.length} Verified</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                                <span className="text-[11px] font-bold text-slate-600">{unverifiedKyc.length} Pending Verification</span>
                            </div>
                        </div>
                    </div>

                    {kycLoading ? (
                        <div className="p-8 flex flex-col items-center justify-center min-h-[300px] space-y-4">
                            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-muted-foreground font-medium text-xs tracking-widest uppercase">Loading Physical KYC Log...</p>
                        </div>
                    ) : kycBookings.length === 0 ? (
                        <Card className="border-dashed border-2 bg-slate-50/50">
                            <CardContent className="p-16 text-center">
                                <div className="w-16 h-16 bg-white shadow-inner rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                    <ShieldCheck className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">No Records Found</h3>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-tighter mt-1">No active bookings pending or completed physical KYC.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-8">
                            {/* ── Pending Verification (red) — always at bottom, shown first for priority ── */}
                            {unverifiedKyc.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-3 mb-4 px-1">
                                        <div className="p-2 rounded-lg bg-red-500 text-white shadow-sm">
                                            <XCircle className="w-4 h-4" />
                                        </div>
                                        <h2 className="text-sm font-black tracking-[0.2em] uppercase text-red-600">
                                            ❌ NOT VERIFIED — Pending Physical Check ({unverifiedKyc.length})
                                        </h2>
                                    </div>
                                    <div className="space-y-3">
                                        {unverifiedKyc.map(b => (
                                            <PhysicalKycCard key={b.id} booking={b} onMarkVerified={handleMarkVerified} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── Verified (green) — sorted by kycVerifiedAt desc ── */}
                            {verifiedKyc.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-3 mb-4 px-1">
                                        <div className="p-2 rounded-lg bg-green-600 text-white shadow-sm">
                                            <CheckCircle className="w-4 h-4" />
                                        </div>
                                        <h2 className="text-sm font-black tracking-[0.2em] uppercase text-green-700">
                                            ✅ PHYSICALLY VERIFIED ({verifiedKyc.length})
                                        </h2>
                                    </div>
                                    <div className="space-y-3">
                                        {verifiedKyc.map(b => (
                                            <PhysicalKycCard key={b.id} booking={b} onMarkVerified={handleMarkVerified} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Document Detail Dialog ── */}
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
                                    <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-indigo-600 to-violet-700 text-white flex items-center justify-center text-3xl font-black shadow-2xl shadow-indigo-200 uppercase transform -rotate-3">
                                        {selectedBooking.booking.guestName ? selectedBooking.booking.guestName[0] : 'U'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-4">
                                            <h2 className="text-3xl font-black text-slate-910 tracking-tighter uppercase leading-none">{selectedBooking.booking.guestName}</h2>
                                            {selectedBooking.docs.length === 4 && selectedBooking.docs.every((d: any) => d.status === "VERIFIED") && (
                                                <div className="bg-emerald-500 text-white font-black text-[10px] uppercase px-4 py-1.5 rounded-full shadow-lg shadow-emerald-100 border-2 border-emerald-400">
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
                                <Button variant="ghost" size="icon"
                                    className="hover:bg-rose-50 hover:text-rose-500 rounded-2xl h-14 w-14 transition-all duration-300 group"
                                    onClick={() => setSelectedBooking(null)}>
                                    <XCircle className="w-8 h-8 group-hover:rotate-90 transition-transform" />
                                </Button>
                            </div>
                            <div className="flex-1 overflow-y-auto bg-slate-50/50">
                                <div className="p-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-7xl mx-auto">
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
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Reject Dialog ── */}
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
                        <Button variant="ghost" onClick={() => setRejectTarget(null)} className="rounded-xl">Cancel</Button>
                        <Button variant="destructive" className="rounded-xl font-bold"
                            onClick={() => rejectTarget && handleVerifyUpdate(rejectTarget, 'REJECTED', rejectNote)}>
                            Reject Document
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Image Preview Dialog ── */}
            {previewDoc && (
                <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
                    <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-2xl">
                        <div className="sr-only">
                            <DialogTitle>Document Preview</DialogTitle>
                            <DialogDescription>Preview uploaded document</DialogDescription>
                        </div>
                        <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 rounded-xl">{TYPE_ICONS[previewDoc.type] || <FileText className="w-4 h-4" />}</div>
                                <div>
                                    <p className="font-black text-sm text-slate-900">{TYPE_LABELS[previewDoc.type] || previewDoc.type}</p>
                                    <p className="text-[10px] text-muted-foreground">{previewDoc.fileName}</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="rounded-xl hover:bg-red-50 hover:text-red-500" onClick={() => setPreviewDoc(null)}>
                                <XCircle className="w-5 h-5" />
                            </Button>
                        </div>
                        <div className="p-6 flex items-center justify-center min-h-[400px] bg-slate-50">
                            {previewDoc.fileData?.includes('pdf') ? (
                                <iframe src={previewDoc.fileData} className="w-full h-[500px] rounded-xl border border-slate-200" />
                            ) : (
                                <img src={previewDoc.fileData} alt="Document" className="max-w-full max-h-[500px] rounded-xl border border-slate-200 shadow-lg object-contain" />
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}

// ─── Document Row Card (compact summary) ─────────────────────────────────────
function DocumentRowCard({ group, onViewPortfolio, onZoom }: {
    group: { booking: any; docs: any[]; overallStatus: string };
    onViewPortfolio: () => void;
    onZoom: (doc: any) => void;
}) {
    const { booking, docs, overallStatus } = group;
    const statusConfig: any = {
        PENDING: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700 border-amber-200', label: '⏳ Pending Review' },
        VERIFIED: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: '✅ All Verified' },
        REJECTED: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700 border-red-200', label: '❌ Has Rejected' }
    };
    const cfg = statusConfig[overallStatus] || statusConfig.PENDING;

    return (
        <div className={`rounded-2xl border-2 p-4 ${cfg.bg} ${cfg.border} transition-all`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-black text-sm">
                        {booking?.guestName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                        <p className="font-black text-sm text-slate-900">{booking?.guestName}</p>
                        <p className="text-[11px] text-slate-500 font-medium">{booking?.propertyName} · Room {booking?.roomAssigned || 'TBD'}</p>
                        <p className="text-[10px] text-slate-400">ID: {booking?.displayId}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-full border uppercase tracking-wider ${cfg.badge}`}>{cfg.label}</span>
                    <div className="flex gap-1">
                        {docs.slice(0, 4).map(doc => (
                            <div key={doc.id} title={TYPE_LABELS[doc.type]} onClick={() => onZoom(doc)}
                                className={`w-7 h-7 rounded-lg cursor-pointer flex items-center justify-center text-xs border transition-all hover:scale-110 ${doc.status === 'VERIFIED' ? 'bg-emerald-100 border-emerald-300 text-emerald-600' : doc.status === 'REJECTED' ? 'bg-red-100 border-red-300 text-red-500' : 'bg-amber-100 border-amber-300 text-amber-600'}`}>
                                {doc.status === 'VERIFIED' ? '✓' : doc.status === 'REJECTED' ? '✗' : '?'}
                            </div>
                        ))}
                    </div>
                    <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl font-bold border-slate-200 hover:border-indigo-300 hover:text-indigo-700" onClick={onViewPortfolio}>
                        <Eye className="w-3 h-3 mr-1" /> Review All
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Document Detail Card ─────────────────────────────────────────────────────
function DocumentDetailCard({ type, doc, onVerify, onReject, onView }: {
    type: string;
    doc: any;
    onVerify: () => void;
    onReject: () => void;
    onView: () => void;
}) {
    const config = TYPE_CONFIG[type] || { label: type, desc: 'Document', icon: <FileText className="w-5 h-5" />, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', borderClass: 'border-slate-200' };

    if (!doc) {
        return (
            <div className={`rounded-2xl border-2 border-dashed p-6 ${config.bgClass} ${config.borderClass} opacity-50`}>
                <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-xl bg-white border ${config.borderClass} ${config.colorClass}`}>{config.icon}</div>
                    <div>
                        <p className={`font-black text-sm ${config.colorClass}`}>{config.label}</p>
                        <p className="text-slate-400 text-xs">{config.desc}</p>
                    </div>
                </div>
                <p className="text-slate-400 text-xs font-bold text-center py-4 uppercase tracking-widest">Not Uploaded</p>
            </div>
        );
    }

    const statusBadge: any = {
        VERIFIED: { class: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: '✅ Verified' },
        REJECTED: { class: 'bg-red-100 text-red-700 border-red-200', label: '❌ Rejected' },
        PENDING: { class: 'bg-amber-100 text-amber-700 border-amber-200', label: '⏳ Pending' }
    };
    const badge = statusBadge[doc.status] || statusBadge.PENDING;

    return (
        <div className={`rounded-2xl border-2 p-5 ${config.bgClass} ${config.borderClass} transition-all hover:shadow-md`}>
            <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-white border ${config.borderClass} ${config.colorClass}`}>{config.icon}</div>
                    <div>
                        <p className={`font-black text-sm ${config.colorClass}`}>{config.label}</p>
                        <p className="text-slate-400 text-xs">{config.desc}</p>
                    </div>
                </div>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wider ${badge.class}`}>{badge.label}</span>
            </div>

            {doc.fileData && (
                <div className="mb-4 rounded-xl overflow-hidden border border-white/50 bg-white/80 cursor-pointer group" onClick={onView}>
                    <img src={doc.fileData} alt={config.label}
                        className="w-full h-40 object-cover transition-transform group-hover:scale-105" />
                    <div className="p-2 text-center">
                        <p className="text-[10px] text-slate-400 font-bold">{doc.fileName || 'Document'}</p>
                    </div>
                </div>
            )}

            {doc.status !== 'VERIFIED' && (
                <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold" onClick={onVerify}>
                        <CheckCircle className="w-3 h-3 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold" onClick={onReject}>
                        <XCircle className="w-3 h-3 mr-1" /> Decline
                    </Button>
                </div>
            )}
            {doc.status === 'VERIFIED' && doc.verifiedAt && (
                <p className="text-[10px] text-emerald-600 font-bold text-center">
                    Verified on {new Date(doc.verifiedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
            )}
            {doc.rejectedNote && (
                <p className="text-[10px] text-red-600 font-bold mt-2 bg-red-50 p-2 rounded-lg border border-red-100">
                    Reason: {doc.rejectedNote}
                </p>
            )}
        </div>
    );
}
