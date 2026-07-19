"use client";

import { useState, useEffect, useCallback } from "react";

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
import { AdminAgreementsContainer } from "@/components/admin/AdminAgreementsContainer";

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
    const [mainTab, setMainTab] = useState<"kyc" | "agreements">("kyc");

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


                            <TenantPhysicalKycTab />
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
