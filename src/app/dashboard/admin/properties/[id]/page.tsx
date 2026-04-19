"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    getPropertyByIdForAdmin,
    exemptPropertyFee,
    rejectProperty,
    requestPropertyCorrections,
    startPropertyVerification,
    verifyPropertyDocuments,
    requirePropertyPayment,
    activateProperty,
    suspendProperty,
    moveToReview
} from "@/actions/admin";
import { verifyDocument } from "@/actions/adminPhase2";
import { requestDocumentReupload, togglePropertyDocumentVerification } from "@/actions/properties";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
    ArrowLeft, Building2, User, Phone, Mail, MapPin, RefreshCcw,
    CheckCircle, XCircle, AlertCircle, Image as ImageIcon, Eye, BedDouble,
    FileText, Shield, ShieldCheck, X, ZoomIn, RotateCcw, ChevronLeft, ChevronRight
} from "lucide-react";
import Link from "next/link";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: string) {
    const map: Record<string, string> = {
        LIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
        APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
        PENDING_VERIFICATION: "bg-amber-100 text-amber-800 border-amber-200",
        VERIFYING_DOCUMENTS: "bg-blue-100 text-blue-800 border-blue-200",
        REJECTED: "bg-red-100 text-red-800 border-red-200",
        NEEDS_CORRECTION: "bg-orange-100 text-orange-800 border-orange-200",
        SUSPENDED: "bg-slate-100 text-slate-700 border-slate-200",
        VERIFIED_SUCCESSFULLY: "bg-teal-100 text-teal-800 border-teal-200",
        APPROVED_PENDING_PAYMENT: "bg-purple-100 text-purple-800 border-purple-200",
        APPROVED_PAYMENT_VERIFIED: "bg-cyan-100 text-cyan-800 border-cyan-200",
    };
    return map[status] || "bg-gray-100 text-gray-700 border-gray-200";
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

// ─── Single Image Card ────────────────────────────────────────────────────────

function ImageCard({
    url,
    label,
    docKey,
    isVerified,
    isReuploadRequired,
    reuploadReason,
    onZoom,
    onVerify,
    onUnverify,
    onReupload,
}: {
    url: string;
    label: string;
    docKey: string;
    isVerified: boolean;
    isReuploadRequired?: boolean;
    reuploadReason?: string;
    onZoom: () => void;
    onVerify: () => void;
    onUnverify: () => void;
    onReupload: () => void;
}) {
    const [verifyLoading, setVerifyLoading] = useState(false);

    const handleVerify = async () => {
        setVerifyLoading(true);
        await onVerify();
        setVerifyLoading(false);
    };
    const handleUnverify = async () => {
        setVerifyLoading(true);
        await onUnverify();
        setVerifyLoading(false);
    };

    return (
        <div className="space-y-2">
            {/* Image */}
            <div
                className={`relative group rounded-2xl overflow-hidden bg-slate-100 aspect-square border-2 transition-all duration-200 cursor-zoom-in ${
                    isReuploadRequired 
                        ? "border-red-500 shadow-red-100 shadow-lg ring-4 ring-red-50" 
                        : isVerified 
                            ? "border-emerald-400 shadow-emerald-100 shadow-md" 
                            : "border-orange-300 shadow-orange-50"
                }`}
                onClick={onZoom}
            >
                <img src={url} alt={label} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />

                {/* Status Badge */}
                {isReuploadRequired ? (
                    <div className="absolute top-2 right-2 h-6 w-6 bg-red-600 animate-pulse rounded-full flex items-center justify-center shadow-md border-2 border-white z-10" title="Reupload Requested">
                        <AlertCircle className="h-3.5 w-3.5 text-white" />
                    </div>
                ) : isVerified ? (
                    <div className="absolute top-2 right-2 h-6 w-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-md border-2 border-white z-10">
                        <CheckCircle className="h-3.5 w-3.5 text-white" />
                    </div>
                ) : (
                    <div className="absolute top-2 right-2 h-6 w-6 bg-orange-500 rounded-full flex items-center justify-center shadow-md border-2 border-white z-10">
                        <AlertCircle className="h-3.5 w-3.5 text-white" />
                    </div>
                )}

                {/* Reupload Reason Banner */}
                {isReuploadRequired && reuploadReason && (
                    <div className="absolute bottom-0 left-0 right-0 bg-red-600/90 backdrop-blur-md text-white px-2 py-1.5 z-40 flex flex-col border-t border-red-500/50">
                        <span className="text-[7px] font-black uppercase tracking-widest text-red-100 mb-0.5">Reupload Reason</span>
                        <span className="text-[9px] font-medium leading-tight truncate">{reuploadReason}</span>
                    </div>
                )}

                {!isReuploadRequired && (
                    <>
                        {/* Hover overlay with zoom icon */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-3 py-2 flex items-center gap-1.5 shadow-lg">
                                <ZoomIn className="h-4 w-4 text-slate-800" />
                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Zoom</span>
                            </div>
                        </div>

                        {/* Label chip */}
                        <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-md">
                            {label}
                        </div>
                    </>
                )}
            </div>


        </div>
    );
}

// ─── Doc Section ──────────────────────────────────────────────────────────────

function DocSection({
    label, desc, photos, category, isLegal, required, singleKey,
    verifiedDocs, adminNotes, onVerifyDoc, onUnverifyDoc, onOpenViewer,
}: {
    label: string; desc: string; photos: string[];
    category: string; isLegal: boolean; required: number;
    singleKey?: boolean;
    verifiedDocs: string[];
    adminNotes?: string | null;
    onVerifyDoc: (docKey: string, label: string, isPhoto: boolean) => Promise<void>;
    onUnverifyDoc: (docKey: string, label: string) => Promise<void>;
    onOpenViewer: (url: string, label: string, docKey: string, isPhoto: boolean, reuploadMode?: boolean) => void;
}) {
    if (photos.length === 0) return null;

    const getDocKey = (i: number) => singleKey ? category : `${category}-${i}`;

    const verifiedCount = photos.filter((_, i) => verifiedDocs.includes(getDocKey(i))).length;

    // A section is only "All Verified" if every slot is verified AND none has a pending reupload
    const hasAnyReupload = photos.some((_, i) => adminNotes?.includes(`[REUPLOAD:${getDocKey(i)}]`));
    const allVerified = verifiedCount === photos.length && !hasAnyReupload;

    return (
        <Card className={`border-2 shadow-sm rounded-3xl overflow-hidden bg-white ${isLegal ? "border-indigo-100" : "border-slate-100"}`}>
            <div className={`p-4 border-b flex items-center justify-between ${isLegal ? "bg-indigo-50/60" : "bg-slate-50/60"}`}>
                <div>
                    <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm">
                        {isLegal ? <Shield className="h-4 w-4 text-indigo-500" /> : <ImageIcon className="h-4 w-4 text-slate-400" />}
                        {label}
                        {isLegal && <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[8px] font-black uppercase">Legal</Badge>}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">{desc} · {photos.length}/{required} uploaded</p>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border ${
                    allVerified ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200"
                }`}>
                    {allVerified ? <><CheckCircle className="h-3.5 w-3.5" /> All Verified</> : <>{verifiedCount}/{photos.length} Verified</>}
                </div>
            </div>
            <CardContent className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {photos.map((url, i) => {
                        const docKey = getDocKey(i);
                        const cardLabel = isLegal ? label : `${label} ${i + 1}`;
                        const isVerified = verifiedDocs.includes(docKey);
                        
                        const reuploadLine = adminNotes?.split('\n').find((l: string) => l.startsWith(`[REUPLOAD:${docKey}]`));
                        const isReuploadRequired = !!reuploadLine;
                        const reuploadReason = reuploadLine ? reuploadLine.replace(`[REUPLOAD:${docKey}]`, '').trim() : '';

                        return (
                            <ImageCard
                                key={i}
                                url={url}
                                label={cardLabel}
                                docKey={docKey}
                                isVerified={isVerified}
                                isReuploadRequired={isReuploadRequired}
                                reuploadReason={reuploadReason}
                                onZoom={() => onOpenViewer(url, cardLabel, docKey, !isLegal, false)}
                                onVerify={() => onVerifyDoc(docKey, cardLabel, !isLegal)}
                                onUnverify={() => onUnverifyDoc(docKey, cardLabel)}
                                onReupload={() => onOpenViewer(url, cardLabel, docKey, !isLegal, true)}
                            />
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPropertyDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [property, setProperty] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionModal, setActionModal] = useState<{ type: string } | null>(null);
    const [reason, setReason] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<"overview" | "verification">("verification");
    const [verifiedDocs, setVerifiedDocs] = useState<string[]>([]);

    // Viewer state
    const [viewer, setViewer] = useState<{
        url: string; label: string; docKey: string; isPhoto: boolean; reuploadMode: boolean;
    } | null>(null);
    const [reuploadNote, setReuploadNote] = useState("");
    const [auditLoading, setAuditLoading] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [carouselIdx, setCarouselIdx] = useState(0);

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
    const handleZoomReset = () => setZoomLevel(1);

    const fetchProperty = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getPropertyByIdForAdmin(id);
            setProperty(data);
            if (data) {
                try { setVerifiedDocs(JSON.parse(data.verifiedDocs || "[]")); }
                catch { setVerifiedDocs([]); }
            }
        } catch { toast.error("Failed to load property"); }
        finally { setLoading(false); }
    }, [id]);

    useEffect(() => { fetchProperty(); }, [fetchProperty]);

    // Per-image verify (tracks individual image keys)
    const handleVerifyDoc = async (docKey: string, label: string, isPhoto: boolean) => {
        if (!property) return;
        try {
            if (isPhoto) {
                await togglePropertyDocumentVerification(property.id, docKey, true);
            } else {
                await verifyDocument(property.id, docKey);
            }
            setVerifiedDocs(prev => [...new Set([...prev, docKey])]);
            toast.success(`${label} verified ✓`);
        } catch { toast.error("Verify failed"); }
    };

    const handleUnverifyDoc = async (docKey: string, label: string) => {
        if (!property) return;
        try {
            await togglePropertyDocumentVerification(property.id, docKey, false);
            setVerifiedDocs(prev => prev.filter(d => d !== docKey));
            toast.success(`${label} unverified`);
        } catch { toast.error("Unverify failed"); }
    };

    const openViewer = (url: string, label: string, docKey: string, isPhoto: boolean, reuploadMode = false) => {
        setViewer({ url, label, docKey, isPhoto, reuploadMode });
        setReuploadNote("");
        setZoomLevel(1);
    };

    const handleViewerVerify = async () => {
        if (!viewer || !property) return;
        setAuditLoading(true);
        try {
            if (viewer.isPhoto) {
                await togglePropertyDocumentVerification(property.id, viewer.docKey, true);
            } else {
                await verifyDocument(property.id, viewer.docKey);
            }
            setVerifiedDocs(prev => [...new Set([...prev, viewer.docKey])]);
            toast.success(`${viewer.label} verified ✓`);
            setViewer(null);
        } catch { toast.error("Verify failed"); }
        finally { setAuditLoading(false); }
    };

    const handleViewerUnverify = async () => {
        if (!viewer || !property) return;
        setAuditLoading(true);
        try {
            await togglePropertyDocumentVerification(property.id, viewer.docKey, false);
            setVerifiedDocs(prev => prev.filter(d => d !== viewer.docKey));
            toast.success(`${viewer.label} unverified`);
            setViewer(null);
        } catch { toast.error("Unverify failed"); }
        finally { setAuditLoading(false); }
    };

    const handleViewerReupload = async () => {
        if (!viewer || !property || !reuploadNote.trim()) {
            toast.error("Please provide a reason");
            return;
        }
        setAuditLoading(true);
        try {
            await requestDocumentReupload(property.id, viewer.docKey, reuploadNote);
            setVerifiedDocs(prev => prev.filter(d => d !== viewer.docKey));
            toast.success("Re-upload requested — owner notified");
            setViewer(null);
            setReuploadNote("");
            fetchProperty();
        } catch { toast.error("Reupload request failed"); }
        finally { setAuditLoading(false); }
    };

    const handleAction = async () => {
        if (!property || !actionModal) return;
        const needsReason = ["reject", "correction", "suspend", "approve"].includes(actionModal.type);
        if (needsReason && !reason.trim()) { toast.error("Please provide a reason"); return; }
        setActionLoading(true);
        try {
            switch (actionModal.type) {
                case "start_review": await startPropertyVerification(property.id); toast.success("Moved to Document Verification"); break;
                case "verify_docs": await verifyPropertyDocuments(property.id); toast.success("Docs verified ✅"); break;
                case "request_payment": await requirePropertyPayment(property.id); toast.success("Owner notified to pay"); break;
                case "approve": await exemptPropertyFee(property.id, reason); toast.success("Fee exempted — property is LIVE 🎉"); break;
                case "activate": await activateProperty(property.id); toast.success("Property is now LIVE 🚀"); break;
                case "move_back": await moveToReview(property.id); toast.success("Moved back to Verifying Documents"); break;
                case "reject": await rejectProperty(property.id, reason); toast.success("Rejected — owner notified"); break;
                case "correction": await requestPropertyCorrections(property.id, reason); toast.success("Correction request sent"); break;
                case "suspend": await suspendProperty(property.id, reason); toast.success("Property suspended"); break;
            }
            setActionModal(null); setReason(""); fetchProperty();
        } catch (e: any) { toast.error(e.message || "Action failed"); }
        finally { setActionLoading(false); }
    };

    if (loading) return (
        <div className="space-y-4 p-8">
            {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
    );

    if (!property) return (
        <div className="flex flex-col items-center justify-center py-32 text-center">
            <Building2 className="h-12 w-12 text-slate-300 mb-4" />
            <p className="font-bold text-slate-600">Property not found</p>
            <Link href="/dashboard/admin/property-approval"><Button variant="outline" className="mt-4">← Back</Button></Link>
        </div>
    );

    const p = property;

    const aadhaarPhotos = parsePhotos(p.aadhaarProof);
    const panPhotos = parsePhotos(p.panProof);
    const licencePhotos = parsePhotos(p.pgLicenceUrl);
    const livePhoto = p.livePhotoUrl ? [p.livePhotoUrl] : [];
    const buildingPhotos = parsePhotos(p.buildingPhotos);
    const commonAreaPhotos = parsePhotos(p.commonAreaPhotos);
    const roomsPhotos = parsePhotos(p.roomsAndBathroomPhotos);
    const amenitiesPhotos = parsePhotos(p.amenitiesPhotos);
    const parkingPhotos = parsePhotos(p.parkingPhotos);

    const mandatoryDocs = ["aadhaarProof-0", "aadhaarProof-1", "panProof-0", "panProof-1", "pgLicenceUrl-0", "pgLicenceUrl-1", "livePhotoUrl"];
    const verifiedCount = mandatoryDocs.filter(d => verifiedDocs.includes(d)).length;

    const STAGES = [
        { key: ["PENDING_VERIFICATION", "UNDER_REVIEW", "CORRECTED"], label: "Submitted", short: "1" },
        { key: ["VERIFYING_DOCUMENTS", "NEEDS_CORRECTION"], label: "Verifying Docs", short: "2" },
        { key: ["VERIFIED_SUCCESSFULLY"], label: "Docs Verified", short: "3" },
        { key: ["APPROVED_PENDING_PAYMENT"], label: "Pending Payment", short: "4" },
        { key: ["APPROVED_PAYMENT_VERIFIED"], label: "Payment Confirmed", short: "5" },
        { key: ["APPROVED", "LIVE"], label: "Live", short: "6" },
    ];
    const activeIdx = STAGES.findIndex(s => s.key.includes(p.status));

    const docSections = [
        { label: "Owner Aadhaar", desc: "Government ID - Aadhaar Card", photos: aadhaarPhotos, category: "aadhaarProof", isLegal: true, required: 2 },
        { label: "Owner PAN Card", desc: "PAN Card", photos: panPhotos, category: "panProof", isLegal: true, required: 2 },
        { label: "PG / Property License", desc: "Business license", photos: licencePhotos, category: "pgLicenceUrl", isLegal: true, required: 2 },
        { label: "Identity Check (Selfie)", desc: "Live selfie verification", photos: livePhoto, category: "livePhotoUrl", isLegal: true, required: 1, singleKey: true },
        { label: "Building Photos", desc: "Exterior property photos", photos: buildingPhotos, category: "buildingPhotos", isLegal: false, required: 4 },
        { label: "Common Area", desc: "Hallway, lobby, shared spaces", photos: commonAreaPhotos, category: "commonAreaPhotos", isLegal: false, required: 4 },
        { label: "Rooms & Bathrooms", desc: "Individual room photos", photos: roomsPhotos, category: "roomsAndBathroomPhotos", isLegal: false, required: 4 },
        { label: "Amenities", desc: "Amenity and facility photos", photos: amenitiesPhotos, category: "amenitiesPhotos", isLegal: false, required: 4 },
        { label: "Parking Area", desc: "Parking facility", photos: parkingPhotos, category: "parkingPhotos", isLegal: false, required: 2 },
    ].filter(s => s.photos.length > 0);

    return (
        <div className="space-y-6 pb-40 p-4 md:p-8 bg-slate-50/30">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/admin/property-approval">
                        <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-slate-200">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-slate-900">{p.name}</h1>
                            <Badge className={`border text-[10px] font-black uppercase px-2 ${statusColor(p.status)}`}>
                                {p.status.replace(/_/g, " ")}
                            </Badge>
                        </div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{p.displayId} · {p.city}</p>
                    </div>
                </div>
                <Button variant="outline" onClick={fetchProperty} disabled={loading}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Sync
                </Button>
            </div>

            {/* Pipeline Progress */}
            <Card className="border-0 shadow-md rounded-3xl bg-gradient-to-br from-white to-slate-50/80 overflow-hidden">
                <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Application Pipeline</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                        activeIdx === -1 ? 'bg-slate-50 text-slate-400 border-slate-200' :
                        activeIdx === STAGES.length - 1 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        'bg-indigo-50 text-indigo-700 border-indigo-200'
                    }`}>Stage {activeIdx + 1} of {STAGES.length}</span>
                </div>
                <CardContent className="p-6">
                    <div className="flex items-center gap-0 overflow-x-auto pb-2">
                        {STAGES.map((stage, i) => {
                            const isLastStage = i === STAGES.length - 1;
                            const isPropertyLive = p.status === 'LIVE' || p.status === 'APPROVED';
                            const done = activeIdx >= 0 && (i < activeIdx || (i === activeIdx && isLastStage && isPropertyLive));
                            const active = i === activeIdx && !(isLastStage && isPropertyLive);
                            return (
                                <div key={i} className="flex items-center flex-1 min-w-0">
                                    <div className="flex flex-col items-center flex-shrink-0">
                                        {/* Circle */}
                                        <div className={`relative h-10 w-10 rounded-full flex items-center justify-center text-[12px] font-black transition-all duration-300 ${
                                            done
                                                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                                                : active
                                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-300 ring-4 ring-indigo-100'
                                                    : 'bg-white text-slate-300 border-2 border-slate-200'
                                        }`}>
                                            {done ? <CheckCircle className="h-5 w-5" /> : (
                                                <span>{stage.short}</span>
                                            )}
                                            {active && (
                                                <span className="absolute inset-0 rounded-full ring-4 ring-indigo-400/30 animate-ping" />
                                            )}
                                        </div>
                                        {/* Label */}
                                        <p className={`text-[9px] font-black uppercase tracking-tight mt-2 text-center whitespace-nowrap transition-colors ${
                                            active ? 'text-indigo-700' : done ? 'text-emerald-600' : 'text-slate-300'
                                        }`}>{stage.label}</p>
                                        {active && (
                                            <span className="mt-1 h-1 w-1 bg-indigo-500 rounded-full animate-bounce" />
                                        )}
                                    </div>
                                    {/* Connector */}
                                    {i < STAGES.length - 1 && (
                                        <div className="flex-1 h-[3px] mx-2 mb-5 rounded-full overflow-hidden bg-slate-100">
                                            <div className={`h-full rounded-full transition-all duration-500 ${
                                                i < activeIdx ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 w-full' : 'w-0'
                                            }`} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {p.status === "VERIFYING_DOCUMENTS" && (
                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-4 bg-indigo-50/50 -mx-6 -mb-6 px-6 pb-4">
                            <p className="text-xs text-indigo-600 font-bold italic">Click photos above to audit & verify each legal document individually.</p>
                            <span className="text-sm font-black text-indigo-900 bg-indigo-100 px-3 py-1 rounded-xl border border-indigo-200 shrink-0">{verifiedCount}/{mandatoryDocs.length} Verified</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Tabs */}
            <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                <button
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-200 ${
                        activeTab === "overview"
                            ? "bg-indigo-600 shadow-md shadow-indigo-200 text-white border border-indigo-700"
                            : "bg-white shadow-md text-slate-900 border border-slate-200"
                    }`}
                    onClick={() => setActiveTab("overview")}
                >
                    <Building2 className="h-3.5 w-3.5" />
                    Property Overview
                </button>
                <button
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-200 ${
                        activeTab === "verification"
                            ? "bg-indigo-600 shadow-md shadow-indigo-200 text-white border border-indigo-700"
                            : "bg-white shadow-md text-slate-900 border border-slate-200"
                    }`}
                    onClick={() => setActiveTab("verification")}
                >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verification Documents
                    {verifiedDocs.length > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tabular-nums ${
                            activeTab === "verification"
                                ? "bg-white/20 text-white"
                                : "bg-indigo-100 text-indigo-700"
                        }`}>
                            {verifiedDocs.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Overview Tab */}
            {activeTab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                        <Card className="border shadow-sm rounded-3xl bg-white">
                            <CardContent className="p-6 space-y-4">
                                <h3 className="font-black text-slate-800 flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-indigo-600" /> General Information
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {[
                                        ["Gender Type", p.genderType || "COED"],
                                        ["Food Type", p.foodType?.replace(/_/g, " ") || "N/A"],
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
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Location</p>
                                    <p className="text-sm font-bold flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-400" />{p.address}, {p.city}</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Verified Images Carousel */}
                        {(() => {
                            const verifiedImages: { url: string; label: string }[] = [];
                            docSections.filter(sec => !sec.isLegal).forEach(sec => {
                                sec.photos.forEach((url, i) => {
                                    const key = `${sec.category}-${i}`;
                                    if (verifiedDocs.includes(key)) {
                                        verifiedImages.push({ url, label: sec.isLegal ? sec.label : `${sec.label} ${i + 1}` });
                                    }
                                });
                            });
                            if (verifiedImages.length === 0) return null;
                            const safeIdx = carouselIdx % verifiedImages.length;
                            const current = verifiedImages[safeIdx];
                            return (
                                <Card className="border shadow-sm rounded-3xl bg-white overflow-hidden">
                                    <div className="p-4 border-b bg-emerald-50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                                            <h3 className="font-black text-emerald-800 text-sm uppercase tracking-widest">Verified Documents</h3>
                                        </div>
                                        <span className="text-xs font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-full">
                                            {safeIdx + 1} / {verifiedImages.length}
                                        </span>
                                    </div>
                                    <div className="relative bg-slate-100 aspect-video flex items-center justify-center overflow-hidden">
                                        <img
                                            key={safeIdx}
                                            src={current.url}
                                            alt={current.label}
                                            className="max-h-full max-w-full object-contain transition-all duration-300"
                                        />
                                        {/* Nav Arrows */}
                                        <button
                                            onClick={() => setCarouselIdx(prev => (prev - 1 + verifiedImages.length) % verifiedImages.length)}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-white active:scale-95 transition-all"
                                        >
                                            <ChevronLeft className="h-5 w-5 text-slate-700" />
                                        </button>
                                        <button
                                            onClick={() => setCarouselIdx(prev => (prev + 1) % verifiedImages.length)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-white active:scale-95 transition-all"
                                        >
                                            <ChevronRight className="h-5 w-5 text-slate-700" />
                                        </button>
                                        {/* Label Chip */}
                                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full">
                                            {current.label}
                                        </div>
                                    </div>
                                    {/* Dots */}
                                    <div className="flex items-center justify-center gap-1.5 p-3">
                                        {verifiedImages.map((_, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setCarouselIdx(i)}
                                                className={`rounded-full transition-all ${
                                                    i === safeIdx
                                                        ? "h-2 w-6 bg-emerald-500"
                                                        : "h-2 w-2 bg-slate-200 hover:bg-slate-300"
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </Card>
                            );
                        })()}
                    </div>

                    <div className="space-y-4">
                        {/* Owner */}
                        <Card className="border shadow-sm rounded-3xl bg-white border-t-4 border-t-indigo-500">
                            <CardContent className="p-6 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-14 w-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl">
                                        {p.owner?.name?.[0]?.toUpperCase() || "O"}
                                    </div>
                                    <div>
                                        <p className="text-lg font-black text-slate-900">{p.owner?.name}</p>
                                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Platform Partner</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-slate-600"><Mail className="h-4 w-4 text-slate-400" />{p.owner?.email}</div>
                                    <div className="flex items-center gap-2 text-sm text-slate-600"><Phone className="h-4 w-4 text-slate-400" />{p.owner?.phone}</div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Workflow Actions */}
                        <Card className="border shadow-sm rounded-3xl bg-white sticky top-4">
                            <CardContent className="p-5 space-y-2.5">
                                <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-widest mb-3">Workflow Actions</h3>

                                {["PENDING_VERIFICATION", "UNDER_REVIEW", "CORRECTED"].includes(p.status) && (
                                    <Button className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-[0.98] text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all"
                                        onClick={() => setActionModal({ type: "start_review" })}>
                                        <ShieldCheck className="h-4 w-4 mr-2" /> Start Document Review
                                    </Button>
                                )}
                                {p.status === "VERIFYING_DOCUMENTS" && (
                                    <Button className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all"
                                        onClick={() => setActionModal({ type: "verify_docs" })}>
                                        <CheckCircle className="h-4 w-4 mr-2" /> Mark Docs Verified
                                    </Button>
                                )}
                                {p.status === "VERIFIED_SUCCESSFULLY" && (
                                    <div className="space-y-2.5">
                                        <Button className="w-full h-11 bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all"
                                            onClick={() => setActionModal({ type: "request_payment" })}>
                                            <FileText className="h-4 w-4 mr-2" /> Request Payment
                                        </Button>
                                        <Button className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all"
                                            onClick={() => setActionModal({ type: "approve" })}>
                                            <CheckCircle className="h-4 w-4 mr-2" /> Exempt Fee & Make Live
                                        </Button>
                                    </div>
                                )}
                                {p.status === "APPROVED_PENDING_PAYMENT" && (
                                    <Button className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all"
                                        onClick={() => setActionModal({ type: "approve" })}>
                                        <CheckCircle className="h-4 w-4 mr-2" /> Exempt Fee & Make Live
                                    </Button>
                                )}
                                {p.status === "APPROVED_PAYMENT_VERIFIED" && (
                                    <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black uppercase tracking-widest text-[11px] rounded-2xl transition-all"
                                        onClick={() => setActionModal({ type: "activate" })}>
                                        <CheckCircle className="h-4 w-4 mr-2" /> Activate & Make Live 🚀
                                    </Button>
                                )}
                                {["APPROVED", "LIVE"].includes(p.status) && (
                                    <Button variant="outline" className="w-full h-11 border-red-200 text-red-600 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-red-50 active:scale-[0.98] transition-all"
                                        onClick={() => setActionModal({ type: "suspend" })}>
                                        <XCircle className="h-4 w-4 mr-2" /> Suspend Property
                                    </Button>
                                )}
                                {p.status === "SUSPENDED" && (
                                    <Button className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all"
                                        onClick={() => setActionModal({ type: "activate" })}>
                                        <CheckCircle className="h-4 w-4 mr-2" /> Reinstate Property
                                    </Button>
                                )}
                                {!["APPROVED", "LIVE", "SUSPENDED"].includes(p.status) && (
                                    <div className="pt-1 space-y-2 border-t border-slate-100">
                                        <Button className="w-full h-10 bg-slate-700 hover:bg-slate-800 active:scale-[0.98] text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all"
                                            onClick={() => setActionModal({ type: "move_back" })}>
                                            <RotateCcw className="h-4 w-4 mr-2" /> Move Back Step
                                        </Button>
                                        <Button variant="outline" className="w-full h-10 border-orange-200 text-orange-600 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-orange-50 active:scale-[0.98] transition-all"
                                            onClick={() => setActionModal({ type: "correction" })}>
                                            <AlertCircle className="h-4 w-4 mr-2" /> Needs Correction
                                        </Button>
                                        <Button className="w-full h-10 bg-red-600 hover:bg-red-700 active:bg-red-800 active:scale-[0.98] text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all shadow-md"
                                            onClick={() => setActionModal({ type: "reject" })}>
                                            <XCircle className="h-4 w-4 mr-2" /> Reject Application
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* Verification Tab */}
            {activeTab === "verification" && (
                <div className="space-y-5">
                    <div className="flex items-center justify-between">
                        <h2 className="font-black text-slate-800 flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-indigo-600" /> Uploaded Documents for Verification
                        </h2>
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
                            {verifiedDocs.length} item{verifiedDocs.length !== 1 ? "s" : ""} verified
                        </span>
                    </div>

                    {docSections.map(section => (
                        <DocSection
                            key={section.category}
                            {...section}
                            verifiedDocs={verifiedDocs}
                            adminNotes={p.adminNotes}
                            onVerifyDoc={handleVerifyDoc}
                            onUnverifyDoc={handleUnverifyDoc}
                            onOpenViewer={openViewer}
                        />
                    ))}
                </div>
            )}

            {/* ── DOCUMENT VIEWER / AUDIT DIALOG ── */}
            {viewer && (() => {
                const isVerified = verifiedDocs.includes(viewer.docKey);
                return (
                    <div
                        className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-0 md:p-8"
                        onClick={() => { if (!auditLoading) { setViewer(null); setReuploadNote(""); } }}
                    >
                        <div
                            className="bg-white w-full h-full md:h-auto md:max-w-4xl md:rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="px-6 py-4 border-b flex items-center justify-between bg-white">
                                <div className="flex items-center gap-3">
                                    {isVerified && (
                                        <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center">
                                            <CheckCircle className="h-5 w-5 text-white" />
                                        </div>
                                    )}
                                    <div>
                                        <Badge className={`mb-0.5 text-[9px] font-black uppercase ${isVerified ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-indigo-100 text-indigo-700 border-indigo-200"}`}>
                                            {isVerified ? "Verified" : "Pending Verification"}
                                        </Badge>
                                        <h3 className="text-xl font-black text-slate-900">{viewer.label}</h3>
                                    </div>
                                </div>
                            </div>

                                    <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center p-4 md:p-8 min-h-[40vh] relative">
                                        <img
                                            src={viewer.url}
                                            alt={viewer.label}
                                            style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.25s cubic-bezier(.22,.68,0,1.2)', transformOrigin: 'center' }}
                                            className="max-w-full max-h-[65vh] object-contain rounded-2xl border-4 border-white/10"
                                        />

                                        {/* Zoom controls — floating bottom center */}
                                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/10">
                                            <button
                                                onClick={handleZoomOut}
                                                disabled={zoomLevel <= 0.5}
                                                className="h-7 w-7 rounded-full flex items-center justify-center text-white hover:bg-white/20 disabled:opacity-30 transition-colors"
                                                title="Zoom out"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                                                    <circle cx="9" cy="9" r="6" stroke="white" strokeWidth="1.8"/>
                                                    <path d="M6.5 9h5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                                                    <path d="M13.5 13.5L17 17" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                                                </svg>
                                            </button>

                                            <button
                                                onClick={handleZoomReset}
                                                className="h-6 px-2 rounded-full text-white/70 hover:text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-colors"
                                                title="Reset zoom"
                                            >
                                                {Math.round(zoomLevel * 100)}%
                                            </button>

                                            <button
                                                onClick={handleZoomIn}
                                                disabled={zoomLevel >= 3}
                                                className="h-7 w-7 rounded-full flex items-center justify-center text-white hover:bg-white/20 disabled:opacity-30 transition-colors"
                                                title="Zoom in"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                                                    <circle cx="9" cy="9" r="6" stroke="white" strokeWidth="1.8"/>
                                                    <path d="M9 6.5v5M6.5 9h5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                                                    <path d="M13.5 13.5L17 17" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="p-6 border-t bg-white">
                                        {viewer.reuploadMode ? (
                                            <div className="p-6 space-y-4 animate-in slide-in-from-bottom-2 bg-slate-50/50 rounded-[32px] border-2 border-slate-100">
                                                <p className="text-xs font-black text-orange-600 uppercase tracking-widest px-2">Reason for Re-upload Request</p>
                                                <textarea
                                                    className="w-full border-2 border-slate-100 rounded-[24px] p-4 text-sm font-medium focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 transition-all min-h-[100px] shadow-sm"
                                                    placeholder="e.g. Image is blurry, document expired, name mismatch…"
                                                    value={reuploadNote}
                                                    onChange={e => setReuploadNote(e.target.value)}
                                                    autoFocus
                                                />
                                                <div className="flex gap-3">
                                                    <button
                                                        className="flex-1 h-12 rounded-full border-2 border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                                                        onClick={() => setViewer(prev => prev ? { ...prev, reuploadMode: false } : null)}
                                                    >← Back</button>
                                                    <button
                                                        disabled={auditLoading || !reuploadNote.trim()}
                                                        className="flex-[2] h-12 rounded-full bg-orange-500 hover:bg-orange-600 active:scale-95 active:shadow-inner disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-orange-200"
                                                        onClick={handleViewerReupload}
                                                    >{auditLoading ? "Sending…" : "Confirm Re-upload Request"}</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center gap-4 py-2 px-4">
                                            
                                                {/* REJECT */}
                                                <button
                                                    disabled={auditLoading}
                                                    onClick={handleViewerUnverify}
                                                    className="flex-1 h-12 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 active:scale-95 text-white flex items-center justify-center gap-2 px-6 transition-all shadow-lg shadow-red-100 group disabled:opacity-50"
                                                >
                                                    <XCircle className="h-5 w-5" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Reject</span>
                                                </button>

                                                {/* APPROVE / UNVERIFY */}
                                                <button
                                                    disabled={auditLoading}
                                                    onClick={isVerified ? handleViewerUnverify : handleViewerVerify}
                                                    className={`flex-1 h-12 rounded-full flex items-center justify-center gap-2 px-6 transition-all active:scale-95 shadow-lg group disabled:opacity-50 ${
                                                        isVerified
                                                            ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100"
                                                            : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-100"
                                                    }`}
                                                >
                                                    {isVerified ? <RotateCcw className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                                        {auditLoading ? "…" : isVerified ? "Unverify" : "Approve"}
                                                    </span>
                                                </button>

                                                {/* REUPLOAD */}
                                                <button
                                                    disabled={auditLoading}
                                                    onClick={() => setViewer(prev => prev ? { ...prev, reuploadMode: true } : null)}
                                                    className="flex-1 h-12 rounded-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 active:scale-95 text-white flex items-center justify-center gap-2 px-6 transition-all shadow-lg shadow-orange-100 group disabled:opacity-50"
                                                >
                                                    <RefreshCcw className="h-5 w-5" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-center truncate">Reupload</span>
                                                </button>

                                                {/* CLOSE */}
                                                <button
                                                    onClick={() => { setViewer(null); setReuploadNote(""); setZoomLevel(1); }}
                                                    className="flex-1 h-12 rounded-full bg-slate-900 hover:bg-black active:scale-95 text-white flex items-center justify-center gap-2 px-6 transition-all shadow-lg shadow-slate-200 group"
                                                >
                                                    <X className="h-5 w-5" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Close</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── ACTION MODAL ── */}
            {actionModal && (() => {
                const cfg: Record<string, { title: string; color: string; needsReason: boolean; placeholder?: string; warning?: string }> = {
                    start_review:    { title: "Start Document Review", color: "bg-blue-600 hover:bg-blue-700", needsReason: false, warning: "Moves property to Verifying Documents stage." },
                    verify_docs:     { title: "Mark Documents Verified", color: "bg-indigo-600 hover:bg-indigo-700", needsReason: false, warning: "Status → Verified Successfully." },
                    request_payment: { title: "Request Onboarding Payment", color: "bg-purple-600 hover:bg-purple-700", needsReason: false, warning: "Owner will be notified to pay the onboarding fee." },
                    approve:         { title: "Exempt Fee & Make Live", color: "bg-emerald-600 hover:bg-emerald-700", needsReason: true, placeholder: "Reason for fee exemption (required)", warning: "Property goes LIVE immediately. Fee waived." },
                    activate:        { title: "Activate — Make Property Live", color: "bg-emerald-600 hover:bg-emerald-700", needsReason: false, warning: "Property will go LIVE on the platform." },
                    move_back:       { title: "Move Back to Review", color: "bg-slate-700 hover:bg-slate-800", needsReason: true, placeholder: "Reason for moving application back...", warning: "Moves property back to previous verification stage." },
                    reject:          { title: "Reject Application", color: "bg-indigo-600 hover:bg-indigo-700", needsReason: true, placeholder: "Why is this being rejected?" },
                    correction:      { title: "Request Corrections", color: "bg-orange-600 hover:bg-orange-700", needsReason: true, placeholder: "What needs correction?" },
                    suspend:         { title: "Suspend Property", color: "bg-red-700 hover:bg-red-800", needsReason: true, placeholder: "Reason for suspension (visible to owner)?" },
                };
                const c = cfg[actionModal.type];
                return (
                    <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => { setActionModal(null); setReason(""); }}>
                        <Card className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                            <div className="p-6 space-y-4">
                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{c.title}</h3>
                                <p className="text-sm font-medium text-slate-500">Acting on: <strong className="text-slate-900">{p.name}</strong></p>
                                {c.warning && (
                                    <div className="p-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[11px] font-bold text-slate-600">{c.warning}</div>
                                )}
                                
                                {c.needsReason && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Reason / Note <span className="text-red-500">*</span></label>
                                        <textarea
                                            className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 transition-all min-h-[110px] resize-none"
                                            placeholder={c.placeholder || "Provide mandatory notes for this action..."}
                                            value={reason}
                                            onChange={e => setReason(e.target.value)}
                                        />
                                    </div>
                                )}

                                <div className="flex gap-3 pt-2">
                                    <Button 
                                        className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-[11px] bg-slate-900 hover:bg-black text-white shadow-lg active:scale-[0.98] transition-all"
                                        onClick={() => { setActionModal(null); setReason(""); }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        disabled={actionLoading || (c.needsReason && !reason.trim())}
                                        className={`flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-[11px] ${c.color} text-white shadow-lg active:scale-[0.98] transition-all`}
                                        onClick={handleAction}
                                    >{actionLoading ? "Processing..." : "Confirm"}</Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                );
            })()}
        </div>
    );
}
