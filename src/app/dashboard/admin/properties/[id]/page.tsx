"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
    getPropertyByIdForAdmin, 
    exemptPropertyFee, 
    rejectProperty, 
    requestPropertyCorrections 
} from "@/actions/admin";
import { 
    verifyDocument, 
    rejectDocument 
} from "@/actions/adminPhase2";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
    ArrowLeft, Building2, User, Phone, Mail, MapPin, Star, RefreshCcw,
    CheckCircle, XCircle, AlertCircle, Image as ImageIcon, Eye, BedDouble,
    FileText, Shield, Calendar, Home, ExternalLink, ShieldCheck, X
} from "lucide-react";
import Link from "next/link";

function statusColor(status: string) {
    const map: Record<string, string> = {
        APPROVED: "bg-green-100 text-green-800 border-green-200",
        PENDING_VERIFICATION: "bg-amber-100 text-amber-800 border-amber-200",
        VERIFYING_DOCUMENTS: "bg-blue-100 text-blue-800 border-blue-200",
        REJECTED: "bg-red-100 text-red-800 border-red-200",
        NEEDS_CORRECTION: "bg-orange-100 text-orange-800 border-orange-200",
        SUSPENDED: "bg-slate-100 text-slate-700 border-slate-200",
        VERIFIED_SUCCESSFULLY: "bg-emerald-100 text-emerald-800 border-emerald-200",
        APPROVED_PENDING_PAYMENT: "bg-purple-100 text-purple-800 border-purple-200",
    };
    return map[status] || "bg-gray-100 text-gray-700 border-gray-200";
}

function PhotoBox({ 
    label, 
    urls, 
    slotsCount = 1, 
    docType,
    verifiedDocs = [],
    onAudit
}: { 
    label: string; 
    urls: string[]; 
    slotsCount?: number; 
    docType?: string;
    verifiedDocs?: string[];
    onAudit?: (url: string, label: string, type: string) => void;
}) {
    const [lightbox, setLightbox] = useState<string | null>(null);
    const isDocVerified = docType ? verifiedDocs.includes(docType) : false;

    return (
        <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 px-1">
                <ImageIcon className="h-3 w-3" /> {label} <span className="text-slate-300 ml-1">({urls.length}/{slotsCount})</span>
                {isDocVerified && <span className="text-emerald-500 flex items-center gap-1 ml-auto text-[9px]"><ShieldCheck className="h-3 w-3" /> Verified</span>}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {Array.from({ length: slotsCount }).map((_, i) => {
                    const url = urls[i];
                    return (
                        <div key={i} className="aspect-square relative">
                            {url ? (
                                <button
                                    className={`w-full h-full rounded-2xl overflow-hidden border-2 transition-all group shadow-sm hover:shadow-md bg-white ${isDocVerified ? "border-emerald-200" : "border-indigo-100 hover:border-indigo-400"}`}
                                    onClick={() => {
                                        if (docType && onAudit) {
                                            onAudit(url, `${label} ${i + 1}`, docType);
                                        } else {
                                            setLightbox(url);
                                        }
                                    }}
                                >
                                    <img src={url} alt={`${label} ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                        <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    {isDocVerified && (
                                        <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                                            <CheckCircle className="h-3 w-3" />
                                        </div>
                                    )}
                                    <div className="absolute bottom-2 left-2 bg-black/40 backdrop-blur-sm text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-md border border-white/20">
                                        {label} {i + 1}
                                    </div>
                                </button>
                            ) : (
                                <div className="w-full h-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center p-2 text-center group">
                                    <ImageIcon className="h-6 w-6 text-slate-300 mb-1 group-hover:text-slate-400 transition-colors" />
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{label} {i + 1}</span>
                                    <span className="text-[7px] font-bold text-slate-300 uppercase tracking-tighter">Not Uploaded</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {lightbox && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setLightbox(null)}>
                    <img src={lightbox} alt="Preview" className="max-w-full max-h-full rounded-2xl shadow-2xl border-4 border-white/10" />
                    <button className="absolute top-6 right-6 text-white bg-black/50 hover:bg-black/70 rounded-full p-3 transition-colors" onClick={() => setLightbox(null)}>
                        <XCircle className="h-6 w-6" />
                    </button>
                    {/* Simplified status overlay */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white text-sm font-bold">
                        {label} - Preview Mode
                    </div>
                </div>
            )}
        </div>
    );
}

function parsePhotos(raw?: string | null): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
        if (typeof parsed === "string") return [parsed];
    } catch { }
    if (typeof raw === "string" && raw.startsWith("http")) return [raw];
    return [];
}

export default function AdminPropertyDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [property, setProperty] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionModal, setActionModal] = useState<{ type: "reject" | "correction" | "approve" } | null>(null);
    const [reason, setReason] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    // Audit System State
    const [viewerDoc, setViewerDoc] = useState<{ url: string; label: string; type: string } | null>(null);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditRejectNote, setAuditRejectNote] = useState("");
    const [isAuditRejecting, setIsAuditRejecting] = useState(false);
    const [verifiedDocs, setVerifiedDocs] = useState<string[]>([]);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getPropertyByIdForAdmin(id);
            setProperty(data);
            try {
                setVerifiedDocs(JSON.parse(data.verifiedDocs || "[]"));
            } catch {
                setVerifiedDocs([]);
            }
        } catch {
            toast.error("Failed to load property details");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetch(); }, [fetch]);

    const handleAction = async () => {
        if (!property || !actionModal) return;
        if (actionModal.type !== "approve" && !reason.trim()) {
            toast.error("Please provide a reason");
            return;
        }
        setActionLoading(true);
        try {
            if (actionModal.type === "approve") {
                await exemptPropertyFee(property.id, "Admin approved from property review page");
                toast.success(`"${property.name}" is now LIVE!`);
            } else if (actionModal.type === "reject") {
                await rejectProperty(property.id, reason);
                toast.success("Property rejected & owner notified.");
            } else {
                await requestPropertyCorrections(property.id, reason);
                toast.success("Correction request sent to owner.");
            }
            setActionModal(null);
            setReason("");
            fetch();
        } catch (e: any) {
            toast.error(e.message || "Action failed");
        } finally {
            setActionLoading(false);
        }
    };

    const handleAuditVerify = async () => {
        if (!viewerDoc || !property) return;
        setAuditLoading(true);
        try {
            await verifyDocument(property.id, viewerDoc.type);
            toast.success(`${viewerDoc.label} marked as Verified`);
            
            // Optimistic Update
            setVerifiedDocs(prev => [...new Set([...prev, viewerDoc.type])]);
            setViewerDoc(null);
        } catch {
            toast.error("Failed to verify document");
        } finally {
            setAuditLoading(false);
        }
    };

    const handleAuditReject = async () => {
        if (!viewerDoc || !property || !auditRejectNote.trim()) {
            toast.error("Please provide a reason for rejection");
            return;
        }
        setAuditLoading(true);
        try {
            await rejectDocument(property.id, viewerDoc.type, auditRejectNote);
            toast.success(`Document rejected and note sent to owner`);
            
            // Optimistic Update
            setVerifiedDocs(prev => prev.filter(d => d !== viewerDoc.type));
            setViewerDoc(null);
            setIsAuditRejecting(false);
            setAuditRejectNote("");
        } catch {
            toast.error("Failed to reject document");
        } finally {
            setAuditLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4 pb-24 p-8">
                <div className="h-10 w-64 bg-slate-100 rounded-xl animate-pulse" />
                <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
                <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
            </div>
        );
    }

    if (!property) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-center">
                <Building2 className="h-12 w-12 text-slate-300 mb-4" />
                <p className="font-bold text-slate-600 text-lg">Property not found</p>
                <Link href="/dashboard/admin/properties">
                    <Button variant="outline" className="mt-4">← Back to Queue</Button>
                </Link>
            </div>
        );
    }

    const p = property;
    const isLive = p.status === "APPROVED";

    // Photos
    const heroImages = parsePhotos(p.images);
    const buildingPhotos = parsePhotos(p.buildingPhotos);
    const interiorPhotos = parsePhotos(p.interiorPhotos);
    const commonAreaPhotos = parsePhotos(p.commonAreaPhotos);
    const amenitiesPhotos = parsePhotos(p.amenitiesPhotos);
    const roomsPhotos = parsePhotos(p.roomsPhotos);
    const roomsAndBathroomPhotos = parsePhotos(p.roomsAndBathroomPhotos);
    const exteriorPhotos = parsePhotos(p.exteriorPhotos);
    const parkingPhotos = parsePhotos(p.parkingPhotos);
    const washroomPhotos = parsePhotos(p.washroomPhotos);
    const hallPhotos = parsePhotos(p.hallPhotos);
    const lobbyPhotos = parsePhotos(p.lobbyPhotos);
    const livePhoto = p.livePhotoUrl ? [p.livePhotoUrl] : [];
    const aadhaarPhotos = parsePhotos(p.aadhaarProof);
    const panPhotos = parsePhotos(p.panProof);
    const licencePhotos = parsePhotos(p.pgLicenceUrl);

    const allPhotosCount = [heroImages, buildingPhotos, interiorPhotos, commonAreaPhotos,
        amenitiesPhotos, roomsPhotos, roomsAndBathroomPhotos, exteriorPhotos, parkingPhotos, washroomPhotos,
        hallPhotos, lobbyPhotos, livePhoto, aadhaarPhotos, panPhotos, licencePhotos].reduce((s, a) => s + a.length, 0);

    const bedStats = (p.rooms || []).reduce((acc: any, r: any) => {
        acc.total += (r.beds || []).length;
        acc.available += (r.beds || []).filter((b: any) => b.status === "AVAILABLE").length;
        return acc;
    }, { total: 0, available: 0 });

    const amenities = (() => {
        try { return JSON.parse(p.amenities || "[]"); } catch { return []; }
    })();

    const mandatoryDocs = ["AADHAAR", "PAN", "PG_LICENCE", "LIVE_PHOTO"];
    const verifiedCount = mandatoryDocs.filter(d => verifiedDocs.includes(d)).length;

    return (
        <div className="space-y-6 pb-40 p-4 md:p-8 bg-slate-50/30">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/admin/properties">
                        <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-slate-200">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{p.name}</h1>
                            <Badge className={`border text-[10px] font-black uppercase tracking-widest px-2 ${statusColor(p.status)}`}>
                                {p.status.replace(/_/g, " ")}
                            </Badge>
                        </div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{p.displayId} · {p.propertyType} · {p.city}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className="bg-white border-slate-200 shadow-sm" onClick={fetch}>
                        <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Sync
                    </Button>
                </div>
            </div>

            {/* Verification Progress Stepper */}
            {p.status === "VERIFYING_DOCUMENTS" && (
                <Card className="border-2 border-indigo-100 bg-indigo-50/50 shadow-sm rounded-3xl overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-1">
                                <h3 className="font-black text-indigo-900 flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5" /> Document Verification Baseline
                                </h3>
                                <p className="text-xs text-indigo-600 font-medium italic">Audit individual legal documents before finalizing the verification stage.</p>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="flex -space-x-2">
                                    {mandatoryDocs.map((d, i) => (
                                        <div key={i} className={`h-10 w-10 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${verifiedDocs.includes(d) ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                                            {verifiedDocs.includes(d) ? <CheckCircle className="h-5 w-5" /> : <Shield className="h-4 w-4" />}
                                        </div>
                                    ))}
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-black text-indigo-900 leading-none">{verifiedCount}/{mandatoryDocs.length}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Verified</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column — Assets & Documentation */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* Visual Asset Review */}
                    <Card className="border shadow-sm rounded-3xl overflow-hidden bg-white">
                        <div className="p-5 border-b bg-slate-50/50">
                            <h3 className="font-black text-slate-800 flex items-center gap-2">
                                <ImageIcon className="h-5 w-5 text-blue-600" /> Photo & Document Review
                            </h3>
                        </div>
                        <CardContent className="p-6 space-y-10">
                            {/* 1. Legal Documentation - Priority */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">1. Required Legal Proofs</span>
                                    <div className="h-[2px] flex-1 bg-slate-100 rounded-full" />
                                </div>
                                <PhotoBox label="Owner Aadhaar" urls={aadhaarPhotos} slotsCount={2} docType="AADHAAR" verifiedDocs={verifiedDocs} onAudit={(url, label, type) => setViewerDoc({ url, label, type })} />
                                <PhotoBox label="Owner PAN" urls={panPhotos} slotsCount={2} docType="PAN" verifiedDocs={verifiedDocs} onAudit={(url, label, type) => setViewerDoc({ url, label, type })} />
                                <PhotoBox label="PG / Property License" urls={licencePhotos} slotsCount={2} docType="PG_LICENCE" verifiedDocs={verifiedDocs} onAudit={(url, label, type) => setViewerDoc({ url, label, type })} />
                                <PhotoBox label="Verified Identity Check (Selfie)" urls={livePhoto} slotsCount={1} docType="LIVE_PHOTO" verifiedDocs={verifiedDocs} onAudit={(url, label, type) => setViewerDoc({ url, label, type })} />
                            </div>

                            {/* 2. Property Assets */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">2. Physical Property Assets</span>
                                    <div className="h-[2px] flex-1 bg-slate-100 rounded-full" />
                                </div>
                                <PhotoBox label="Building Exterior" urls={buildingPhotos} slotsCount={4} />
                                <PhotoBox label="Common Area / Lounge" urls={commonAreaPhotos} slotsCount={4} />
                                <PhotoBox label="Rooms & Bathrooms" urls={roomsAndBathroomPhotos} slotsCount={4} />
                                <PhotoBox label="Amenities Photos" urls={amenitiesPhotos} slotsCount={4} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Property Details */}
                    <Card className="border shadow-sm rounded-3xl overflow-hidden bg-white">
                        <CardContent className="p-6 space-y-6">
                            <h3 className="font-black text-slate-800 flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-indigo-600" /> General Information
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {[
                                    ["Gender Type", p.genderType || "COED"],
                                    ["Food Type", p.foodType?.replace(/_/g, " ") || "NOT AVAILABLE"],
                                    ["Food Price", p.foodPricePerMonth ? `₹${p.foodPricePerMonth}` : "N/A"],
                                    ["Notice Period", p.noticePeriod ? `${p.noticePeriod} days` : "—"],
                                    ["PG License", p.licenseNumber || "N/A"],
                                    ["RERA ID", p.reraId || "N/A"],
                                ].map(([l, v]) => (
                                    <div key={l} className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{l}</p>
                                        <p className="text-xs font-bold text-slate-800">{v as string}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-slate-900 rounded-2xl p-4 text-white">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Location Strategy</p>
                                <p className="text-sm font-bold flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-400" /> {p.address}, {p.city}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column — Summary & Actions */}
                <div className="space-y-6">
                    {/* Owner Highlight */}
                    <Card className="border shadow-sm rounded-3xl overflow-hidden bg-white border-t-4 border-t-indigo-500">
                        <CardContent className="p-6 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-14 w-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl">
                                    {p.owner?.name?.[0]?.toUpperCase() || "O"}
                                </div>
                                <div>
                                    <p className="text-lg font-black text-slate-900 leading-none">{p.owner?.name}</p>
                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">Platform Partner</p>
                                </div>
                            </div>
                            <div className="space-y-2 pt-2">
                                <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                    <Mail className="h-4 w-4 text-slate-400" /> {p.owner?.email}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                    <Phone className="h-4 w-4 text-slate-400" /> {p.owner?.phone}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Global Actions */}
                    <Card className="border shadow-sm rounded-3xl overflow-hidden bg-white sticky top-4">
                        <CardContent className="p-6 space-y-3">
                            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-2">Workflow Actions</h3>
                            
                            {!isLive && (
                                <Button 
                                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-lg shadow-emerald-100"
                                    onClick={() => setActionModal({ type: "approve" })}
                                >
                                    <CheckCircle className="h-4 w-4 mr-2" /> Make Live
                                </Button>
                            )}
                            
                            <Button 
                                variant="outline" 
                                className="w-full h-11 border-orange-200 text-orange-600 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-orange-50"
                                onClick={() => setActionModal({ type: "correction" })}
                            >
                                <AlertCircle className="h-4 w-4 mr-2" /> Needs Correction
                            </Button>

                            <Button 
                                variant="destructive" 
                                className="w-full h-11 font-black uppercase tracking-widest text-[10px] rounded-2xl"
                                onClick={() => setActionModal({ type: "reject" })}
                            >
                                <XCircle className="h-4 w-4 mr-2" /> Reject Application
                            </Button>

                            <div className="pt-4 border-t border-slate-50">
                                <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                    <span>Last Sync</span>
                                    <span>{new Date(p.updatedAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* --- DIALOGS --- */}

            {/* 1. DOCUMENT AUDIT DIALOG (THE ZOOM MODAL) */}
            {viewerDoc && (
                <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-0 md:p-8" onClick={() => { if (!auditLoading) setViewerDoc(null); }}>
                    <div className="bg-white w-full h-full md:h-auto md:max-w-4xl md:rounded-[32px] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="p-6 border-b flex items-center justify-between bg-white relative z-10">
                            <div>
                                <Badge className="mb-1 bg-indigo-100 text-indigo-700 border-indigo-200 text-[9px] font-black uppercase tracking-widest">Legal Document Audit</Badge>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">{viewerDoc.label}</h3>
                            </div>
                            <button 
                                onClick={() => setViewerDoc(null)} 
                                className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors"
                            >
                                <X className="h-6 w-6 text-slate-400" />
                            </button>
                        </div>

                        {/* Modal Image Body */}
                        <div className="flex-1 overflow-auto bg-slate-200/50 flex items-center justify-center p-4 md:p-8 min-h-[40vh]">
                            <img 
                                src={viewerDoc.url} 
                                alt={viewerDoc.label} 
                                className="max-w-full max-h-[65vh] object-contain rounded-2xl shadow-xl border-4 border-white"
                            />
                        </div>

                        {/* Modal Actions Footer */}
                        <div className="p-6 border-t bg-white">
                            {verifiedDocs.includes(viewerDoc.type) ? (
                                <div className="flex items-center justify-center gap-3 p-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl text-emerald-700 font-black uppercase tracking-widest text-sm">
                                    <CheckCircle className="h-6 w-6" /> This Document is Verified
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {isAuditRejecting ? (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                                            <p className="text-xs font-black text-rose-600 uppercase tracking-widest px-1">Reason for Rejection</p>
                                            <textarea 
                                                className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-50 transition-all min-h-[100px]"
                                                placeholder="e.g. Image is blurry, name mismatch, etc."
                                                value={auditRejectNote}
                                                onChange={e => setAuditRejectNote(e.target.value)}
                                            />
                                            <div className="flex gap-3">
                                                <Button variant="ghost" className="flex-1 rounded-2xl h-12 font-bold text-slate-500" onClick={() => setIsAuditRejecting(false)}>Back</Button>
                                                <Button 
                                                    disabled={auditLoading || !auditRejectNote.trim()}
                                                    className="flex-[2] bg-rose-600 hover:bg-rose-700 text-white rounded-2xl h-12 font-black uppercase tracking-widest text-[11px] shadow-lg shadow-rose-100"
                                                    onClick={handleAuditReject}
                                                >
                                                    {auditLoading ? "Rejecting..." : "Confirm Rejection"}
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <Button 
                                                disabled={auditLoading}
                                                className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest text-[12px] shadow-lg shadow-emerald-100"
                                                onClick={handleAuditVerify}
                                            >
                                                {auditLoading ? "Processing..." : "Approve & Mark Verified"}
                                            </Button>
                                            <Button 
                                                disabled={auditLoading}
                                                variant="outline"
                                                className="flex-1 h-14 border-2 border-rose-200 text-rose-600 rounded-2xl font-black uppercase tracking-widest text-[12px] hover:bg-rose-50 hover:border-rose-300"
                                                onClick={() => setIsAuditRejecting(true)}
                                            >
                                                Reject Document
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 2. GLOBAL ACTION MODAL (APPROVE/REJECT/CORRECTION) */}
            {actionModal && (
                <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActionModal(null)}>
                    <Card className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-6 space-y-4">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                {actionModal.type === "approve" ? <CheckCircle className="h-6 w-6 text-emerald-500" /> : <AlertCircle className="h-6 w-6 text-orange-500" />}
                                {actionModal.type === "approve" ? "Final Activation" : actionModal.type === "reject" ? "Reject Application" : "Request Corrections"}
                            </h3>

                            <p className="text-sm font-medium text-slate-600">You are performing this action on <strong className="text-slate-900">{p.name}</strong>.</p>

                            {actionModal.type !== "approve" && (
                                <textarea 
                                    className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 transition-all min-h-[120px]"
                                    placeholder={actionModal.type === "reject" ? "Why is this application being rejected?" : "What specific details need correction?"}
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                />
                            )}

                            {actionModal.type === "approve" && (
                                <div className="p-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl text-[11px] font-bold text-emerald-700 leading-relaxed">
                                    This will mark the property as LIVE and ACTIVE on the platform. All documents are assumed to be audited.
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <Button variant="ghost" className="flex-1 h-12 rounded-2xl font-bold text-slate-400" onClick={() => setActionModal(null)}>Cancel</Button>
                                <Button 
                                    disabled={actionLoading}
                                    className={`flex-[2] h-12 rounded-2xl font-black uppercase tracking-widest text-[11px] ${
                                        actionModal.type === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' :
                                        actionModal.type === 'reject' ? 'bg-rose-600 hover:bg-rose-700' :
                                        'bg-orange-600 hover:bg-orange-700'
                                    } text-white shadow-lg`}
                                    onClick={handleAction}
                                >
                                    {actionLoading ? "Processing..." : "Confirm Action"}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
