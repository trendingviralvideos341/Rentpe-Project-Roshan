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
import { Shield, CheckCircle, XCircle, Eye, Clock, FileCheck, User, RefreshCcw, X, ZoomIn, Search, Building2, CreditCard, Camera, FileText, MapPin, Phone, ShieldCheck, Upload, AlertCircle, Info, FileSignature } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { AdminAgreementsContainer } from "@/components/admin/AdminAgreementsContainer";

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

function TenantPhysicalKycTab() {
    const [kycBookings, setKycBookings] = useState<any[]>([]);
    const [kycLoading, setKycLoading] = useState(true);
    const [kycSearch, setKycSearch] = useState("");

    const fetchKyc = async () => {
        setKycLoading(true);
        try { const data = await getPhysicalKycBookings(); setKycBookings(data); }
        catch { toast.error("Failed to load Physical KYC log"); }
        finally { setKycLoading(false); }
    };

    useEffect(() => { fetchKyc(); }, []);

    const handleMarkKycVerified = async (bookingId: string) => {
        try {
            await markPhysicalKycVerified(bookingId);
            toast.success("✅ Physical KYC Verified", { description: "Audit log saved." });
            fetchKyc();
        } catch { toast.error("Verification failed."); }
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
    );
}

// ── MAIN PAGE ─────────────────────────────────────────────────

export default function AdminVerificationsPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialKycTab = searchParams.get("tab") === "tenant" ? "tenant" : "owner";
    
    // Main Tabs State
    const [mainTab, setMainTab] = useState<"kyc" | "agreements">("kyc");
    // KYC Sub-Tabs State
    const [activeKycTab, setActiveKycTab] = useState(initialKycTab);

    const switchKycTab = (tab: string) => {
        setActiveKycTab(tab);
        router.replace(`/dashboard/admin/verifications?tab=${tab}`, { scroll: false });
    };

    return (
        <div className="min-h-screen bg-slate-50/50">
            <div className="p-4 md:p-8 space-y-6">
                
                {/* Large Full-Width Tabs */}
                <div className="bg-white p-1 md:p-1.5 rounded-2xl sm:rounded-full border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center w-full relative">
                    <button
                        onClick={() => setMainTab("kyc")}
                        className={`flex-1 w-full py-2 md:py-2.5 px-4 text-sm md:text-base font-black rounded-xl sm:rounded-full transition-all duration-300 flex items-center justify-center gap-3 ${
                            mainTab === "kyc"
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                        }`}
                    >
                        <ShieldCheck className="w-5 h-5 md:w-6 md:h-6" />
                        KYC & Document Verifications
                    </button>
                    
                    {/* Separator Line */}
                    <div className="hidden sm:block w-px h-6 bg-slate-200 mx-2 shrink-0" />
                    <div className="sm:hidden h-px w-full bg-slate-200 my-2 shrink-0" />

                    <button
                        onClick={() => setMainTab("agreements")}
                        className={`flex-1 w-full py-2 md:py-2.5 px-4 text-sm md:text-base font-black rounded-xl sm:rounded-full transition-all duration-300 flex items-center justify-center gap-3 ${
                            mainTab === "agreements"
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                        }`}
                    >
                        <FileSignature className="w-5 h-5 md:w-6 md:h-6" />
                        Agreements (L&L)
                    </button>
                </div>

                {/* Tab Content */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {mainTab === "kyc" && (
                        <div className="space-y-4 md:space-y-6 pb-20 md:pb-8">


                            <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
                                {[
                                    { id: "owner", label: "🏠 Owner KYC Queue" },
                                    { id: "tenant", label: "🎓 Tenant Physical KYC" },
                                ].map(t => (
                                    <button key={t.id} onClick={() => switchKycTab(t.id)}
                                        className={`px-5 py-2 rounded-lg text-xs font-black transition-all uppercase tracking-wider ${activeKycTab === t.id ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-700"}`}>
                                        {t.label}
                                    </button>
                                ))}
                            </div>

                            {activeKycTab === "owner" ? <OwnerKYCTab /> : <TenantPhysicalKycTab />}
                        </div>
                    )}

                    {mainTab === "agreements" && (
                        <div className="-mx-4 md:-mx-8">
                            <AdminAgreementsContainer />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
