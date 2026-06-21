"use client";

import { useState, useEffect, useCallback } from "react";
import { getKYCQueue, verifyDocument as verifyOwnerDoc, rejectDocument } from "@/actions/adminPhase2";
import { getPendingDocuments, verifyDocument as verifyTenantDoc } from "@/actions/documents";
import { getPhysicalKycBookings, markPhysicalKycVerified } from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Shield, CheckCircle, XCircle, Eye, Clock, FileCheck, User, RefreshCcw, X, ZoomIn, Search, Building2, CreditCard, Camera, FileText, MapPin, Phone, ShieldCheck, Upload, AlertCircle, Info } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

// ── KYC OWNER SECTION ─────────────────────────────────────────

const KYC_FILTER_TABS = [
    { key: "ALL", label: "All Docs" }, { key: "PENDING", label: "⏳ Pending" },
    { key: "VERIFIED", label: "✅ Verified" }, { key: "AADHAAR", label: "Aadhaar" },
    { key: "PAN", label: "PAN Card" }, { key: "PG_LICENCE", label: "PG Licence" },
    { key: "LIVE_PHOTO", label: "Live Photo" },
];

interface DocItem {
    id: string; propertyId: string; propertyName: string; propertyDisplayId?: string;
    city: string; docType: string; docLabel: string; docUrl: string; isVerified: boolean;
    owner: { id: string; name?: string; email?: string; phone?: string; displayId?: string }; submittedAt: string;
}

function OwnerKYCTab() {
    const [data, setData] = useState<{ queue: DocItem[]; stats: { pending: number; verified: number; total: number } } | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("ALL");
    const [rejectTarget, setRejectTarget] = useState<DocItem | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [viewerDoc, setViewerDoc] = useState<DocItem | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try { const result = await getKYCQueue(filter); setData(result); }
        catch { toast.error("Failed to load KYC queue"); }
        finally { setLoading(false); }
    }, [filter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleVerify = async (item: DocItem) => {
        setActionLoading(item.id);
        try { await verifyOwnerDoc(item.propertyId, item.docType); toast.success(`${item.docLabel} verified!`); fetchData(); }
        catch { toast.error("Verification failed"); }
        finally { setActionLoading(null); }
    };

    const handleReject = async () => {
        if (!rejectTarget || !rejectReason.trim()) { toast.error("Please provide a reason"); return; }
        setActionLoading(rejectTarget.id);
        try {
            await rejectDocument(rejectTarget.propertyId, rejectTarget.docType, rejectReason);
            toast.success("Document rejected & owner notified"); setRejectTarget(null); setRejectReason(""); fetchData();
        } catch { toast.error("Rejection failed"); }
        finally { setActionLoading(null); }
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "⏳ Pending", value: data?.stats.pending ?? "—", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
                    { label: "✅ Verified", value: data?.stats.verified ?? "—", color: "text-green-600", bg: "bg-green-50 border-green-200" },
                    { label: "📋 Total", value: data?.stats.total ?? "—", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
                    { label: "🔁 Queue", value: loading ? "..." : "LIVE", color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
                ].map(card => (
                    <Card key={card.label} className={`border ${card.bg}`}><CardContent className="p-4">
                        <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
                        <p className="text-xs text-muted-foreground font-semibold mt-1">{card.label}</p>
                    </CardContent></Card>
                ))}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {KYC_FILTER_TABS.map(tab => (
                    <button key={tab.key} onClick={() => setFilter(tab.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${filter === tab.key ? "bg-indigo-600 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"}`}>
                        {tab.label}
                    </button>
                ))}
            </div>
            {loading ? (
                <div className="grid gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}</div>
            ) : data?.queue.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed rounded-xl">
                    <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
                    <p className="font-bold text-slate-700">All clear! No documents in this filter.</p>
                </div>
            ) : (
                <>
                    <div className="md:hidden space-y-3">
                        {data?.queue.map(item => (
                            <Card key={item.id} className={`border-l-4 ${item.isVerified ? "border-l-green-400" : "border-l-amber-400"}`}>
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div><p className="font-bold text-sm text-slate-900 truncate max-w-[180px]">{item.propertyName}</p>
                                            <p className="text-xs text-muted-foreground">{item.city} · {item.propertyDisplayId}</p></div>
                                        <Badge className={item.isVerified ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>{item.isVerified ? "Verified" : "Pending"}</Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-600">
                                        <FileCheck className="h-3.5 w-3.5" /><span className="font-semibold">{item.docLabel}</span>
                                        <span>·</span><User className="h-3.5 w-3.5" /><span className="truncate">{item.owner?.name || "Owner"}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setViewerDoc(item)}><Eye className="h-3.5 w-3.5 mr-1" />View</Button>
                                        {!item.isVerified && (<>
                                            <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-xs" disabled={actionLoading === item.id} onClick={() => handleVerify(item)}><CheckCircle className="h-3.5 w-3.5 mr-1" />Verify</Button>
                                            <Button size="sm" variant="destructive" className="flex-1 text-xs" onClick={() => setRejectTarget(item)}><XCircle className="h-3.5 w-3.5 mr-1" />Reject</Button>
                                        </>)}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <div className="hidden md:block bg-white rounded-2xl border shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b">
                                <tr>{["Property", "Owner", "Document", "City", "Status", "Submitted", "Actions"].map(h => (
                                    <th key={h} className="text-left px-4 py-3 text-xs font-black uppercase text-slate-500">{h}</th>
                                ))}</tr>
                            </thead>
                            <tbody className="divide-y">
                                {data?.queue.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3"><p className="font-semibold text-slate-900 truncate max-w-[160px]">{item.propertyName}</p><p className="text-xs text-muted-foreground">{item.propertyDisplayId}</p></td>
                                        <td className="px-4 py-3"><p className="font-medium">{item.owner?.name || "—"}</p><p className="text-xs text-muted-foreground">{item.owner?.email}</p></td>
                                        <td className="px-4 py-3"><span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">{item.docLabel}</span></td>
                                        <td className="px-4 py-3 text-slate-600">{item.city}</td>
                                        <td className="px-4 py-3"><Badge className={item.isVerified ? "bg-green-100 text-green-800 border-0" : "bg-amber-100 text-amber-800 border-0"}>{item.isVerified ? "✅ Verified" : "⏳ Pending"}</Badge></td>
                                        <td className="px-4 py-3 text-xs text-slate-500">{new Date(item.submittedAt).toLocaleDateString('en-IN')}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" onClick={() => setViewerDoc(item)}><Eye className="h-3.5 w-3.5" /></Button>
                                                {!item.isVerified && (<>
                                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs" disabled={actionLoading === item.id} onClick={() => handleVerify(item)}>✅ Verify</Button>
                                                    <Button size="sm" variant="destructive" className="text-xs" onClick={() => setRejectTarget(item)}>❌ Reject</Button>
                                                </>)}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {viewerDoc && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-0 md:p-6" onClick={() => setViewerDoc(null)}>
                    <div className="bg-white w-full h-full md:h-auto md:max-w-3xl md:rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b bg-slate-50">
                            <div><h3 className="font-black text-slate-900">{viewerDoc.docLabel}</h3><p className="text-xs text-muted-foreground">{viewerDoc.propertyName}</p></div>
                            <button onClick={() => setViewerDoc(null)} className="p-2 rounded-full hover:bg-slate-200"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100 min-h-[300px]">
                            {viewerDoc.docUrl.match(/\.(jpg|jpeg|png|webp|gif)/i) ? (
                                <img src={viewerDoc.docUrl} alt={viewerDoc.docLabel} className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg" />
                            ) : (
                                <div className="text-center space-y-3"><FileCheck className="h-16 w-16 text-indigo-400 mx-auto" />
                                    <a href={viewerDoc.docUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold underline flex items-center gap-2 justify-center"><ZoomIn className="h-4 w-4" />Open Document</a>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t bg-white flex flex-col sm:flex-row gap-3">
                            {!viewerDoc.isVerified ? (<>
                                <Button className="flex-1 bg-green-600 hover:bg-green-700" disabled={actionLoading === viewerDoc.id} onClick={() => { handleVerify(viewerDoc); setViewerDoc(null); }}><CheckCircle className="h-4 w-4 mr-2" />Approve</Button>
                                <Button variant="destructive" className="flex-1" onClick={() => { setRejectTarget(viewerDoc); setViewerDoc(null); }}><XCircle className="h-4 w-4 mr-2" />Reject</Button>
                            </>) : (<div className="flex-1 flex items-center gap-2 text-green-700 font-bold"><CheckCircle className="h-5 w-5" />Verified</div>)}
                        </div>
                    </div>
                </div>
            )}

            {rejectTarget && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-6">
                    <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 space-y-4">
                        <h3 className="font-black text-lg text-slate-900 flex items-center gap-2"><XCircle className="h-5 w-5 text-red-500" />Reject Document</h3>
                        <p className="text-sm text-muted-foreground">Rejecting <strong>{rejectTarget.docLabel}</strong> for <strong>{rejectTarget.propertyName}</strong>. Owner will be notified.</p>
                        <textarea className="w-full border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300" rows={3} placeholder="Reason for rejection..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>Cancel</Button>
                            <Button variant="destructive" className="flex-1" disabled={!rejectReason.trim() || actionLoading === rejectTarget.id} onClick={handleReject}>Reject & Notify Owner</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── TENANT DOC VERIFICATION SECTION ──────────────────────────

const TYPE_LABELS: Record<string, string> = {
    AADHAAR_FRONT: "Aadhaar (Front)", AADHAAR_BACK: "Aadhaar (Back)", PAN_FRONT: "PAN Card (Front)",
    PAN_BACK: "PAN Card (Back)", STUDENT_ID: "Student / University ID", COMPANY_ID: "Company ID / Offer Letter",
    LIVE_PHOTO: "Current Photo", OTHER: "Other Documents", ID_PROOF: "Identity Proof",
    ADDRESS_PROOF: "Address Proof", COLLEGE_COMPANY: "College / Company ID", SELFIE: "Current Identity Check",
};

const TYPE_CONFIG: any = {
    AADHAAR_FRONT: { label: 'Aadhaar Front', icon: <User className="w-5 h-5" />, colorClass: 'text-blue-600', bgClass: 'bg-blue-50', borderClass: 'border-blue-200' },
    AADHAAR_BACK: { label: 'Aadhaar Back', icon: <User className="w-5 h-5" />, colorClass: 'text-blue-500', bgClass: 'bg-blue-50', borderClass: 'border-blue-200' },
    PAN_FRONT: { label: 'PAN Card Front', icon: <CreditCard className="w-5 h-5" />, colorClass: 'text-green-600', bgClass: 'bg-green-50', borderClass: 'border-green-200' },
    PAN_BACK: { label: 'PAN Card Back', icon: <CreditCard className="w-5 h-5" />, colorClass: 'text-green-500', bgClass: 'bg-green-50', borderClass: 'border-green-200' },
    STUDENT_ID: { label: 'Student ID', icon: <Building2 className="w-5 h-5" />, colorClass: 'text-purple-600', bgClass: 'bg-purple-50', borderClass: 'border-purple-200' },
    COMPANY_ID: { label: 'Company ID', icon: <Building2 className="w-5 h-5" />, colorClass: 'text-orange-600', bgClass: 'bg-orange-50', borderClass: 'border-orange-200' },
    LIVE_PHOTO: { label: 'Current Photo', icon: <Camera className="w-5 h-5" />, colorClass: 'text-cyan-600', bgClass: 'bg-cyan-50', borderClass: 'border-cyan-200' },
    OTHER: { label: 'Other Documents', icon: <FileText className="w-5 h-5" />, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', borderClass: 'border-slate-200' },
    ID_PROOF: { label: 'Identity Proof', icon: <FileText className="w-5 h-5" />, colorClass: 'text-indigo-600', bgClass: 'bg-indigo-50', borderClass: 'border-indigo-200' },
    ADDRESS_PROOF: { label: 'Address Proof', icon: <MapPin className="w-5 h-5" />, colorClass: 'text-orange-600', bgClass: 'bg-orange-50', borderClass: 'border-orange-200' },
    COLLEGE_COMPANY: { label: 'College / Work', icon: <Building2 className="w-5 h-5" />, colorClass: 'text-purple-600', bgClass: 'bg-purple-50', borderClass: 'border-purple-200' },
    SELFIE: { label: 'Current Selfie', icon: <Camera className="w-5 h-5" />, colorClass: 'text-cyan-600', bgClass: 'bg-cyan-50', borderClass: 'border-cyan-200' },
};

// ── Physical KYC Log Card ─────────────────────────────────────────────────────
function formatDT(date: string | Date | null | undefined) {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
    });
}

function PhysicalKycCard({ booking, onMarkVerified }: { booking: any; onMarkVerified: (id: string) => void }) {
    const isVerified = !!booking.kycVerified;
    const tenantId = booking.tenant?.displayId || null;
    const verifierName = booking.kycVerifier?.name || '—';
    const verifierRole = booking.kycVerifier?.role || '';

    return (
        <div className={`rounded-2xl border-2 p-4 transition-all duration-300 ${
            isVerified ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200'
        }`}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-base shrink-0 ${
                        isVerified ? 'bg-green-600' : 'bg-red-500'
                    }`}>
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
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            <span className="text-[11px] text-slate-600 font-medium">
                                {booking.property?.name || booking.propertyName}
                            </span>
                            {(booking.room?.roomNumber || booking.roomAssigned) && (
                                <span className="text-[11px] text-slate-600 font-medium">
                                    · Room {booking.room?.roomNumber || booking.roomAssigned}
                                </span>
                            )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">Booking: {booking.displayId}</div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    {isVerified ? (
                        <span className="flex items-center gap-1.5 bg-green-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-md">
                            <CheckCircle className="w-3.5 h-3.5" /> ✅ VERIFIED
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 bg-red-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-md animate-pulse">
                            <XCircle className="w-3.5 h-3.5" /> ❌ NOT VERIFIED
                        </span>
                    )}
                    {!isVerified && (
                        <Button size="sm"
                            className="h-7 text-[10px] bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl px-3"
                            onClick={() => onMarkVerified(booking.id)}
                        >
                            <ShieldCheck className="w-3 h-3 mr-1" /> Mark Verified
                        </Button>
                    )}
                </div>
            </div>
            <div className={`mt-3 pt-3 border-t flex items-center gap-2 flex-wrap ${
                isVerified ? 'border-green-200' : 'border-red-200'
            }`}>
                <Shield className={`w-3.5 h-3.5 ${isVerified ? 'text-green-600' : 'text-red-500'}`} />
                {isVerified ? (
                    <span className="text-[11px] font-bold text-green-700">
                        Verified by: <span className="font-black">{verifierName}</span>
                        {verifierRole ? ` (${verifierRole === 'OWNER' ? 'Owner' : verifierRole === 'STAFF' ? 'Staff' : 'Admin'})` : ''}
                        {' · '}{formatDT(booking.kycVerifiedAt)}
                    </span>
                ) : (
                    <span className="text-[11px] font-bold text-red-600">
                        Awaiting physical verification at check-in
                    </span>
                )}
            </div>
        </div>
    );
}

function TenantDocsTab() {
    const [subTab, setSubTab] = useState<'online' | 'physical'>('online');
    // Online Docs state
    const [docs, setDocs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [dateFilter, setDateFilter] = useState<"ALL" | "7D" | "30D">("7D");
    const [selectedBooking, setSelectedBooking] = useState<any>(null);
    const [rejectNote, setRejectNote] = useState("");
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const [previewDoc, setPreviewDoc] = useState<any>(null);
    // Physical KYC state
    const [kycBookings, setKycBookings] = useState<any[]>([]);
    const [kycLoading, setKycLoading] = useState(false);
    const [kycSearch, setKycSearch] = useState("");

    const fetchDocs = async () => {
        setLoading(true);
        try { const data = await getPendingDocuments(); setDocs(data); }
        catch { toast.error("Failed to load documents"); }
        finally { setLoading(false); }
    };

    const fetchKyc = async () => {
        setKycLoading(true);
        try { const data = await getPhysicalKycBookings(); setKycBookings(data); }
        catch { toast.error("Failed to load Physical KYC log"); }
        finally { setKycLoading(false); }
    };

    useEffect(() => { fetchDocs(); }, []);
    useEffect(() => { if (subTab === 'physical') fetchKyc(); }, [subTab]);

    const handleMarkKycVerified = async (bookingId: string) => {
        try {
            await markPhysicalKycVerified(bookingId);
            toast.success("✅ Physical KYC Verified", { description: "Audit log saved." });
            fetchKyc();
        } catch { toast.error("Verification failed."); }
    };

    const handleVerifyUpdate = async (docId: string, status: 'VERIFIED' | 'REJECTED', note?: string) => {
        try {
            await verifyTenantDoc(docId, status, note);
            toast.success(status === 'VERIFIED' ? "Document Verified" : "Reupload Requested");
            if (status === 'REJECTED') { setRejectTarget(null); setRejectNote(""); }
            fetchDocs();
        } catch { toast.error("Action Failed"); }
    };

    const filteredDocs = docs.filter(doc => {
        if (dateFilter !== "ALL") {
            const diff = (Date.now() - new Date(doc.createdAt || doc.updatedAt).getTime()) / 86400000;
            if (dateFilter === "7D" && diff > 7) return false;
            if (dateFilter === "30D" && diff > 30) return false;
        }
        const q = search.toLowerCase();
        return doc.booking?.guestName?.toLowerCase().includes(q) || doc.booking?.displayId?.toLowerCase().includes(q) || doc.booking?.propertyName?.toLowerCase().includes(q);
    });

    const statusGroups = ['PENDING', 'VERIFIED', 'REJECTED'];
    const STATUS_MAP: any = {
        PENDING: { label: "PENDING DOCUMENTS", color: "text-red-600", bg: "bg-red-500", icon: <Clock className="w-4 h-4" /> },
        VERIFIED: { label: "VERIFIED DOCUMENTS", color: "text-emerald-600", bg: "bg-emerald-500", icon: <CheckCircle className="w-4 h-4" /> },
        REJECTED: { label: "REJECTED DOCUMENTS", color: "text-slate-500", bg: "bg-slate-400", icon: <XCircle className="w-4 h-4" /> },
    };

    const filteredKyc = kycBookings.filter(b => {
        const q = kycSearch.toLowerCase();
        return (
            b.guestName?.toLowerCase().includes(q) ||
            b.displayId?.toLowerCase().includes(q) ||
            b.propertyName?.toLowerCase().includes(q) ||
            b.tenant?.displayId?.toLowerCase().includes(q) ||
            b.property?.name?.toLowerCase().includes(q)
        );
    });
    const verifiedKyc = filteredKyc.filter(b => b.kycVerified);
    const unverifiedKyc = filteredKyc.filter(b => !b.kycVerified);

    return (
        <div className="space-y-4">
            {/* Sub-tab switcher */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 w-fit">
                <button onClick={() => setSubTab('online')}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                        subTab === 'online' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    <FileText className="w-3.5 h-3.5" /> Online Docs
                </button>
                <button onClick={() => setSubTab('physical')}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                        subTab === 'physical' ? 'bg-white text-green-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    <ShieldCheck className="w-3.5 h-3.5" /> Physical KYC Log
                    {kycBookings.filter(b => !b.kycVerified).length > 0 && (
                        <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                            {kycBookings.filter(b => !b.kycVerified).length}
                        </span>
                    )}
                </button>
            </div>

            {/* ── ONLINE DOCS ── */}
            {subTab === 'online' && (
            <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-3">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="Search by name, booking ID, property..." className="pl-11 rounded-xl" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
                        {(["7D", "30D", "ALL"] as const).map(val => (
                            <button key={val} onClick={() => setDateFilter(val)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest ${dateFilter === val ? "bg-indigo-600 text-white shadow-md" : "text-slate-500"}`}>
                                {val === "7D" ? "Last 7 Days" : val === "30D" ? "Last 30 Days" : "Lifetime"}
                            </button>
                        ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchDocs} disabled={loading} className="rounded-xl text-xs">
                        <RefreshCcw className={`h-3 w-3 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="grid gap-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
            ) : docs.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed rounded-xl"><FileCheck className="h-10 w-10 text-slate-300 mx-auto mb-3" /><p className="font-bold text-slate-500">No submissions found.</p></div>
            ) : (
                <div className="space-y-8">
                    {statusGroups.map(status => {
                        const grouped: Record<string, { booking: any; docs: any[]; overallStatus: string }> = {};
                        filteredDocs.forEach(doc => {
                            const bid = doc.booking?.id || 'unknown';
                            if (!grouped[bid]) grouped[bid] = { booking: doc.booking, docs: [], overallStatus: 'VERIFIED' };
                            grouped[bid].docs.push(doc);
                        });
                        Object.values(grouped).forEach(g => {
                            if (g.docs.some(d => d.status === 'REJECTED')) g.overallStatus = 'REJECTED';
                            else if (g.docs.some(d => d.status === 'PENDING')) g.overallStatus = 'PENDING';
                        });
                        const groups = Object.values(grouped).filter(g => g.overallStatus === status);
                        if (groups.length === 0) return null;
                        const cfg = STATUS_MAP[status];
                        return (
                            <div key={status}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`p-2 rounded-lg ${cfg.bg} text-white`}>{cfg.icon}</div>
                                    <h2 className={`text-sm font-black tracking-widest uppercase ${cfg.color}`}>{cfg.label} ({groups.length})</h2>
                                </div>
                                <div className="space-y-3">
                                    {groups.map((group: any) => {
                                        const uploadedTypes = [...new Set(group.docs.map((d: any) => d.type))] as string[];
                                        const getStatus = (type: string) => {
                                            const doc = group.docs.find((d: any) => d.type === type);
                                            if (!doc) return { color: 'bg-slate-100', icon: <div className="w-1.5 h-1.5 rounded-full bg-slate-300" /> };
                                            if (doc.status === 'VERIFIED') return { color: 'bg-emerald-500', icon: <CheckCircle className="w-2.5 h-2.5 text-white" /> };
                                            if (doc.status === 'REJECTED') return { color: 'bg-rose-500', icon: <XCircle className="w-2.5 h-2.5 text-white" /> };
                                            return { color: 'bg-amber-500', icon: <Clock className="w-2.5 h-2.5 text-white" /> };
                                        };
                                        return (
                                            <Card key={group.booking?.id} className="border-none shadow-md hover:shadow-xl transition-all bg-white rounded-2xl">
                                                <CardContent className="p-5">
                                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 rounded-2xl bg-slate-100 border flex items-center justify-center font-black text-slate-400 text-lg">
                                                                {group.booking?.guestName?.[0] || 'U'}
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-slate-900">{group.booking?.guestName}</p>
                                                                <p className="text-xs text-slate-500 flex items-center gap-2">
                                                                    <MapPin className="w-3 h-3" />{group.booking?.propertyName}
                                                                    <Phone className="w-3 h-3 ml-2" />{group.booking?.guestPhone}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2 px-4 border-x border-slate-100">
                                                                {uploadedTypes.map(type => {
                                                                    const s = getStatus(type);
                                                                    const c = TYPE_CONFIG[type];
                                                                    return (
                                                                        <div key={type} className="flex flex-col items-center gap-1" title={`${c?.label}: ${s.color}`}>
                                                                            <div className={`w-7 h-7 rounded-xl ${s.color} flex items-center justify-center`}>{s.icon}</div>
                                                                            <span className="text-[8px] font-black text-slate-400 uppercase">{c?.label?.split(' ')[0] || type}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                        <Button variant="outline" onClick={() => setSelectedBooking({ booking: group.booking, docs: group.docs })} className="rounded-xl text-xs">
                                                            <FileText className="w-4 h-4 mr-2" />View Documents
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Document Detail Dialog */}
            <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
                <DialogContent className="!fixed !inset-0 !max-w-none !w-screen !h-screen !m-0 !rounded-none z-[100] !p-0 flex flex-col">
                    <div className="sr-only"><DialogTitle>Document Verification Details</DialogTitle><DialogDescription>Review tenants uploaded documents</DialogDescription></div>
                    {selectedBooking && (<>
                        <div className="p-6 border-b flex justify-between items-center bg-white sticky top-0 z-20 shadow-sm">
                            <div><h2 className="text-2xl font-black">{selectedBooking.booking.guestName}</h2>
                                <p className="text-sm text-slate-500">{selectedBooking.booking.propertyName} · Room {selectedBooking.booking.roomAssigned || "TBD"}</p></div>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedBooking(null)} className="rounded-2xl h-12 w-12"><XCircle className="w-7 h-7" /></Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                                {Object.keys(TYPE_LABELS).map(type => {
                                    const doc = selectedBooking.docs.find((d: any) => d.type === type);
                                    const cfg = TYPE_CONFIG[type] || { label: type, icon: <FileText className="w-5 h-5" />, colorClass: 'text-slate-600', bgClass: 'bg-slate-50', borderClass: 'border-slate-200' };
                                    const isVerified = doc?.status === "VERIFIED"; const isRejected = doc?.status === "REJECTED";
                                    return (
                                        <div key={type} className={`border-2 ${cfg.borderClass} rounded-3xl p-5 bg-white shadow-md ${isVerified ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`}>
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className={`p-2 ${cfg.bgClass} rounded-xl ${cfg.colorClass}`}>{cfg.icon}</div>
                                                <div><h4 className="font-black text-slate-900 uppercase text-sm">{cfg.label}</h4></div>
                                                {isVerified && <div className="ml-auto bg-emerald-500 text-white p-1.5 rounded-xl"><CheckCircle className="w-4 h-4" /></div>}
                                            </div>
                                            {doc ? (
                                                <div className="relative group h-48 rounded-2xl overflow-hidden border bg-slate-950">
                                                    {doc.fileData?.startsWith("data:image") ? <img src={doc.fileData} className="w-full h-full object-contain p-1" alt="Doc" /> : <div className="w-full h-full flex items-center justify-center text-slate-500"><FileText className="w-12 h-12 opacity-20" /></div>}
                                                    <div className="absolute inset-x-0 bottom-0 bg-white/95 border-t flex opacity-0 group-hover:opacity-100 transition-all divide-x">
                                                        {!isVerified && (<>
                                                            <button onClick={() => handleVerifyUpdate(doc.id, 'VERIFIED')} className="flex-1 py-3 flex items-center justify-center gap-1 text-[10px] font-black uppercase hover:bg-emerald-50 text-emerald-700"><ShieldCheck className="w-3.5 h-3.5" />Verify</button>
                                                            <button onClick={() => setRejectTarget(doc.id)} className="flex-1 py-3 flex items-center justify-center gap-1 text-[10px] font-black uppercase hover:bg-rose-50 text-rose-700"><RefreshCcw className="w-3.5 h-3.5" />Reupload</button>
                                                        </>)}
                                                        <button onClick={() => setPreviewDoc(doc)} className="flex-1 py-3 flex items-center justify-center gap-1 text-[10px] font-black uppercase hover:bg-slate-50 text-slate-600"><Eye className="w-3.5 h-3.5" />View</button>
                                                    </div>
                                                    {isRejected && doc.rejectedNote && <div className="absolute top-2 left-2 right-2 bg-rose-600/90 p-2 rounded-xl"><p className="text-[10px] font-black text-white">{doc.rejectedNote}</p></div>}
                                                </div>
                                            ) : <div className="h-48 border-4 border-dashed border-slate-100 rounded-2xl flex items-center justify-center bg-slate-50 opacity-40"><Upload className="w-8 h-8 text-slate-300" /></div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>)}
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600 font-black text-sm uppercase"><AlertCircle className="w-5 h-5" />Request Re-upload</DialogTitle>
                        <DialogDescription className="font-bold text-xs">Provide a clear reason. The tenant will be prompted to re-upload.</DialogDescription></DialogHeader>
                    <div className="py-4"><Textarea placeholder="e.g., Image is blurry, wrong document type..." value={rejectNote} onChange={e => setRejectNote(e.target.value)} className="min-h-[100px] rounded-xl" /></div>
                    <DialogFooter className="gap-3">
                        <button onClick={() => setRejectTarget(null)} className="px-6 py-2.5 text-xs font-black bg-indigo-100 text-indigo-800 rounded-full">CANCEL</button>
                        <button className="bg-red-600 text-white font-black text-xs px-8 py-2.5 rounded-full" onClick={() => handleVerifyUpdate(rejectTarget!, 'REJECTED', rejectNote)}>REQUEST REUPLOAD</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            </div>
            )} {/* end subTab === 'online' */}

            {/* ── PHYSICAL KYC LOG ── */}
            {subTab === 'physical' && (
            <div className="space-y-6">
                {/* Search + stats bar */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by student name, booking ID, tenant ID or property..."
                            className="pl-11 h-10 border-slate-200 bg-slate-50/30 focus:bg-white rounded-xl text-sm"
                            value={kycSearch}
                            onChange={e => setKycSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-6 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <span className="text-[11px] font-bold text-slate-600">{verifiedKyc.length} Verified</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-[11px] font-bold text-slate-600">{unverifiedKyc.length} Pending</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchKyc} disabled={kycLoading} className="ml-auto rounded-xl text-xs">
                            <RefreshCcw className={`h-3 w-3 mr-2 ${kycLoading ? 'animate-spin' : ''}`} />Refresh
                        </Button>
                    </div>
                </div>

                {kycLoading ? (
                    <div className="flex flex-col items-center justify-center min-h-[280px] gap-4">
                        <div className="w-11 h-11 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Physical KYC Log...</p>
                    </div>
                ) : kycBookings.length === 0 ? (
                    <div className="py-20 text-center border-2 border-dashed rounded-xl">
                        <ShieldCheck className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                        <p className="font-bold text-slate-500">No active bookings found for Physical KYC.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Unverified first — high priority */}
                        {unverifiedKyc.length > 0 && (
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-lg bg-red-500 text-white shadow-sm">
                                        <XCircle className="w-4 h-4" />
                                    </div>
                                    <h2 className="text-sm font-black tracking-widest uppercase text-red-600">
                                        ❌ NOT VERIFIED — Pending Check ({unverifiedKyc.length})
                                    </h2>
                                </div>
                                <div className="space-y-3">
                                    {unverifiedKyc.map(b => (
                                        <PhysicalKycCard key={b.id} booking={b} onMarkVerified={handleMarkKycVerified} />
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* Verified — sorted latest first from server */}
                        {verifiedKyc.length > 0 && (
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-lg bg-green-600 text-white shadow-sm">
                                        <CheckCircle className="w-4 h-4" />
                                    </div>
                                    <h2 className="text-sm font-black tracking-widest uppercase text-green-700">
                                        ✅ PHYSICALLY VERIFIED ({verifiedKyc.length})
                                    </h2>
                                </div>
                                <div className="space-y-3">
                                    {verifiedKyc.map(b => (
                                        <PhysicalKycCard key={b.id} booking={b} onMarkVerified={handleMarkKycVerified} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            )} {/* end subTab === 'physical' */}
        </div>
    );
}

// ── MAIN PAGE ─────────────────────────────────────────────────

export default function AdminVerificationsPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialTab = searchParams.get("tab") === "tenant" ? "tenant" : "owner";
    const [activeTab, setActiveTab] = useState(initialTab);

    const switchTab = (tab: string) => {
        setActiveTab(tab);
        router.replace(`/dashboard/admin/verifications?tab=${tab}`, { scroll: false });
    };

    return (
        <div className="space-y-4 md:space-y-6 pb-20 md:pb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
                        <Shield className="h-7 w-7 text-indigo-600" /> Verification Centre
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Owner KYC & Tenant Document Verification</p>
                </div>
            </div>

            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 flex gap-3 text-amber-900 shadow-sm">
                <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-wider">Student Online KYC Bypassed (Physical Check-in Active)</p>
                    <p className="text-xs text-amber-700 leading-relaxed font-medium">
                        Student online KYC document uploads are disabled. Students are instructed to bring their physical documents directly to the property at check-in. Verification Center queues represent documents uploaded by property owners/partners or other tenants. Property staff can upload scanned copies on behalf of tenants during onboarding.
                    </p>
                </div>
            </div>

            <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
                {[
                    { id: "owner", label: "🏠 Owner KYC Queue" },
                    { id: "tenant", label: "🎓 Tenant Docs" },
                ].map(t => (
                    <button key={t.id} onClick={() => switchTab(t.id)}
                        className={`px-5 py-2 rounded-lg text-xs font-black transition-all uppercase tracking-wider ${activeTab === t.id ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-700"}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === "owner" ? <OwnerKYCTab /> : <TenantDocsTab />}
        </div>
    );
}
