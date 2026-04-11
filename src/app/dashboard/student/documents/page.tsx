"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Upload, CheckCircle, Clock, XCircle, AlertTriangle, Eye, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getBookings } from "@/actions/bookings";
import { uploadTenantDocument, getTenantDocuments } from "@/actions/documents";
import { useResumableUpload } from "@/hooks/useResumableUpload";
import { ResilienceIndicator } from "@/components/ui/ResilienceIndicator";

// ── Document types required by Indian Government (Police Verification Standard) ──
const DOC_TYPES = [
    {
        key: "ID_PROOF",
        label: "Identity Proof",
        desc: "Aadhaar Card / Passport / Voter ID / Driving License",
        icon: "🪪",
        required: true,
        hint: "Must be a government-issued photo ID. Aadhaar is preferred for Indian nationals.",
    },
    {
        key: "ADDRESS_PROOF",
        label: "Address Proof",
        desc: "Aadhaar / Utility Bill / Bank Statement",
        icon: "🏠",
        required: true,
        hint: "Must show your permanent home address. Aadhaar covers both ID and address proof.",
    },
    {
        key: "COLLEGE_COMPANY",
        label: "College / Company Proof",
        desc: "College ID card / Offer Letter / Employee ID",
        icon: "🎓",
        required: true,
        hint: "Required to verify your student or professional status.",
    },
    {
        key: "RENT_AGREEMENT",
        label: "Signed Rental Agreement",
        desc: "Your signed copy of the accommodation agreement",
        icon: "📄",
        required: true,
        hint: "Legally required for police verification (India, Section 144 CrPC). Your agreement will be provided by RentPe after booking confirmation.",
    },
    {
        key: "SELFIE",
        label: "Current Photo (Selfie)",
        desc: "Live photo for identity verification",
        icon: "📸",
        required: true,
        isCamera: true,
        hint: "Take a clear, well-lit photo. No sunglasses or caps.",
    },
    {
        key: "PASSPORT_VISA",
        label: "Passport & Visa (Foreign Nationals Only)",
        desc: "Valid Passport + Indian Visa copy",
        icon: "🛂",
        required: false,
        foreignOnly: true,
        hint: "Mandatory for non-Indian nationals as per Foreigners Registration Office (FRO) rules and Section 5 of the Registration of Foreigners Act, 1939.",
    },
];

const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5 MB

// Active booking statuses where KYC upload is applicable
const KYC_STATUSES = [
    "PAID", "CASH_PAID", "ROOM_RESERVED", "KYC_PENDING",
    "KYC_REJECTED", "AGREEMENT_PENDING", "BOOKING_CONFIRMED",
    "APPROVED_PENDING_TOKEN", "APPROVED_PAYMENT_PENDING",
];

function getFileSize(data: string | File): number {
    if (!data) return 0;
    if (data instanceof File) return data.size;
    if (data.startsWith("data:")) {
        const base = data.includes(",") ? data.split(",")[1] : data;
        return Math.floor((base.length * 3) / 4);
    }
    return 0;
}

function formatMB(bytes: number): string {
    return (bytes / (1024 * 1024)).toFixed(2);
}

export default function StudentDocumentsPage() {
    const [booking, setBooking] = useState<any>(null);
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState<string | null>(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [showForeignDocs, setShowForeignDocs] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const { status: uploadStatus, progress: uploadProgress, uploadFile } = useResumableUpload();

    useEffect(() => {
        const load = async () => {
            try {
                const bookings = await getBookings();
                const active = bookings.find((b: any) =>
                    KYC_STATUSES.includes(b.status) || KYC_STATUSES.includes(b.paymentStatus)
                );
                if (active) {
                    setBooking(active);
                    const docs = await getTenantDocuments(active.id);
                    setDocuments(docs);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const usedBytes = documents.reduce((sum, d) => sum + getFileSize(d.fileData || ""), 0);
    const remainingBytes = MAX_TOTAL_BYTES - usedBytes;
    const usedPercent = Math.min(100, (usedBytes / MAX_TOTAL_BYTES) * 100);
    const isNearLimit = usedPercent >= 80;
    const isAtLimit = remainingBytes <= 0;

    const getDocStatus = (type: string) => documents.find((d) => d.type === type);

    const checkAndUpload = async (type: string, fileData: string | File, fileName: string) => {
        if (!booking) return;
        setUploadError(null);

        const newFileBytes = getFileSize(fileData);
        const existingDoc = getDocStatus(type);
        const existingBytes = existingDoc ? getFileSize(existingDoc.fileData || "") : 0;
        const projectedUsed = usedBytes - existingBytes + newFileBytes;

        if (projectedUsed > MAX_TOTAL_BYTES) {
            const overBy = formatMB(projectedUsed - MAX_TOTAL_BYTES);
            setUploadError(`Upload exceeds the 5 MB combined limit by ${overBy} MB. Please compress your file and try again.`);
            setUploading(null);
            return;
        }

        const result = await uploadFile(fileData as File);
        await uploadTenantDocument({ bookingId: booking.id, type, fileData: result.url, fileName });
        const docs = await getTenantDocuments(booking.id);
        setDocuments(docs);
        setUploading(null);
    };

    const handleFileUpload = async (type: string, file: File) => {
        setUploading(type);
        setUploadError(null);
        const toastId = toast.loading(`Uploading ${type.replace(/_/g, " ")}...`);
        try {
            await checkAndUpload(type, file, file.name);
            toast.success("Document uploaded successfully!", { id: toastId });
        } catch (error: any) {
            const msg = error.message || "Upload failed. Please try again.";
            setUploadError(msg);
            toast.error(msg, { id: toastId });
            setUploading(null);
        }
    };

    const startCamera = async () => {
        setCameraActive(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch {
            toast.error("Camera access denied. Please allow camera access in your browser settings.");
            setCameraActive(false);
        }
    };

    const captureSelfie = async () => {
        if (!canvasRef.current || !videoRef.current || !booking) return;
        const canvas = canvasRef.current;
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);

        canvas.toBlob(async (blob) => {
            if (!blob) return;
            const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
            const stream = videoRef.current?.srcObject as MediaStream;
            stream?.getTracks().forEach((t) => t.stop());
            setCameraActive(false);
            setUploading("SELFIE");
            const toastId = toast.loading("Uploading selfie...");
            try {
                await checkAndUpload("SELFIE", file, "selfie.jpg");
                toast.success("Selfie uploaded!", { id: toastId });
            } catch (error: any) {
                toast.error(error.message || "Selfie upload failed.", { id: toastId });
                setUploading(null);
            }
        }, "image/jpeg", 0.75);
    };

    if (loading) return <div className="p-8 text-center animate-pulse text-slate-500">Loading your documents...</div>;

    if (!booking) return (
        <div className="p-8 text-center space-y-3">
            <div className="text-5xl">📋</div>
            <h2 className="text-xl font-bold">No Active Booking</h2>
            <p className="text-muted-foreground text-sm">Document upload is available once your booking is in progress. Come back here after your booking is confirmed to upload your KYC documents.</p>
        </div>
    );

    const requiredDocs = DOC_TYPES.filter((dt) => dt.required && !dt.foreignOnly);
    const allRequiredVerified = requiredDocs.every((dt) => getDocStatus(dt.key)?.status === "VERIFIED");
    const hasRejected = DOC_TYPES.some((dt) => getDocStatus(dt.key)?.status === "REJECTED");
    const visibleDocs = DOC_TYPES.filter((dt) => !dt.foreignOnly || showForeignDocs);

    return (
        <div className="container mx-auto max-w-3xl py-8 px-4 space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold">KYC Document Verification</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Booking: <strong>{booking.displayId}</strong> — Status: <span className="font-semibold text-indigo-600">{booking.status}</span>
                    </p>
                </div>
                <ResilienceIndicator status={uploadStatus} progress={uploadProgress.percent} />
            </div>

            {/* Legal notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                    <p className="font-bold mb-1">⚖️ Legal Requirement — Section 144 CrPC (India)</p>
                    <p>Property owners are legally required to submit your identity details for police verification. Your documents are stored securely and shared only with your property owner and the RentPe verification team. Failure to submit can delay your check-in.</p>
                </div>
            </div>

            {/* All verified banner */}
            {allRequiredVerified && (
                <div className="bg-green-50 border border-green-300 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
                    <div>
                        <p className="font-bold text-green-800">✅ KYC Verification Complete!</p>
                        <p className="text-sm text-green-700">All required documents have been verified. Your stay is fully compliant.</p>
                    </div>
                </div>
            )}

            {/* Rejected banner */}
            {hasRejected && (
                <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4 flex items-center gap-3">
                    <XCircle className="h-6 w-6 text-red-600 shrink-0" />
                    <div>
                        <p className="font-bold text-red-800">⚠️ Action Required — Document Rejected</p>
                        <p className="text-sm text-red-700">One or more documents were rejected. See the rejection reason below and re-upload immediately.</p>
                    </div>
                </div>
            )}

            {/* Storage Meter */}
            <div className={`rounded-xl border-2 p-4 space-y-2 ${isAtLimit ? "border-red-500 bg-red-50" : isNearLimit ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-gray-50"}`}>
                <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700">📦 Combined Upload Storage</span>
                    <span className={`text-sm font-bold ${isAtLimit ? "text-red-600" : isNearLimit ? "text-orange-600" : "text-gray-600"}`}>
                        {formatMB(usedBytes)} MB of 5.00 MB used
                    </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                        className={`h-3 rounded-full transition-all duration-500 ${isAtLimit ? "bg-red-600" : isNearLimit ? "bg-orange-500" : "bg-green-500"}`}
                        style={{ width: `${usedPercent}%` }}
                    />
                </div>
                <p className="text-sm font-bold text-red-600">
                    {isAtLimit ? "⛔ Storage full! You cannot upload more documents." : `🔴 Remaining: ${formatMB(remainingBytes)} MB`}
                </p>
                <div className="flex items-start gap-2 p-2 bg-red-100 border border-red-200 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-700">
                        <strong>Tip:</strong> Compress large files before uploading.{" "}
                        <a href="https://compressjpeg.com" target="_blank" rel="noopener noreferrer" className="underline font-bold">compressjpeg.com</a>
                        {" "}(images) or{" "}
                        <a href="https://www.ilovepdf.com/compress_pdf" target="_blank" rel="noopener noreferrer" className="underline font-bold">ilovepdf.com</a>
                        {" "}(PDFs).
                    </p>
                </div>
            </div>

            {/* Upload error */}
            {uploadError && (
                <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3 flex items-start gap-2">
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-red-700">❌ {uploadError}</p>
                        <p className="text-xs text-red-600 mt-1">Compress your file and try again.</p>
                    </div>
                </div>
            )}

            {/* Document Cards */}
            <div className="grid gap-4">
                {visibleDocs.map((dt) => {
                    const doc = getDocStatus(dt.key);
                    const isUploading = uploading === dt.key;
                    const isRejected = doc?.status === "REJECTED";
                    const isVerified = doc?.status === "VERIFIED";
                    const isPending = doc?.status === "PENDING";

                    return (
                        <Card
                            key={dt.key}
                            className={`border-2 transition-all ${
                                isVerified ? "border-green-300 bg-green-50/30" :
                                isRejected ? "border-red-400 bg-red-50/30" :
                                isPending ? "border-blue-200 bg-blue-50/20" :
                                "border-dashed border-gray-300 bg-white"
                            }`}
                        >
                            <CardContent className="p-5">
                                <div className="flex items-start gap-4">
                                    <span className="text-2xl shrink-0 mt-0.5">{dt.icon}</span>
                                    <div className="flex-1 min-w-0">

                                        {/* Title + status row */}
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <h3 className="font-bold text-slate-800">{dt.label}</h3>
                                            {dt.required && !dt.foreignOnly && (
                                                <span className="text-[9px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded uppercase tracking-wider">Required</span>
                                            )}
                                            {dt.foreignOnly && (
                                                <span className="text-[9px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded uppercase tracking-wider">Foreign Nationals</span>
                                            )}
                                            <span className="ml-auto">
                                                {isVerified && <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded"><CheckCircle className="h-3 w-3" /> Verified</span>}
                                                {isPending && <span className="flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded"><Clock className="h-3 w-3" /> Under Review</span>}
                                                {isRejected && <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded"><XCircle className="h-3 w-3" /> Rejected</span>}
                                                {!doc && <span className="text-xs text-muted-foreground">Not uploaded</span>}
                                            </span>
                                        </div>

                                        <p className="text-sm text-muted-foreground">{dt.desc}</p>
                                        <p className="text-xs text-slate-400 mt-0.5 italic">{dt.hint}</p>

                                        {/* Rejection reason */}
                                        {isRejected && doc?.rejectedNote && (
                                            <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded-lg">
                                                <p className="text-xs font-bold text-red-700 mb-1">❌ Rejection Reason:</p>
                                                <p className="text-xs text-red-600">{doc.rejectedNote}</p>
                                                <p className="text-xs text-red-500 mt-1 font-semibold">→ Re-upload the correct document using the button below.</p>
                                            </div>
                                        )}

                                        {/* Action row */}
                                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                                            {/* Preview uploaded doc */}
                                            {doc?.fileData && doc.fileData.startsWith("http") && (
                                                <a href={doc.fileData} target="_blank" rel="noopener noreferrer">
                                                    <Button size="sm" variant="ghost" className="h-8 text-xs text-slate-600 border border-slate-200">
                                                        <Eye className="h-3 w-3 mr-1" /> View
                                                    </Button>
                                                </a>
                                            )}

                                            {/* Upload / Re-upload / Camera */}
                                            {!isVerified && (
                                                dt.isCamera ? (
                                                    <Button
                                                        size="sm"
                                                        className={`h-8 text-xs ${isRejected ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
                                                        onClick={startCamera}
                                                        disabled={isUploading || cameraActive || isAtLimit}
                                                    >
                                                        <Camera className="h-3 w-3 mr-1" />
                                                        {isRejected ? "Re-take Selfie ↗" : doc ? "Retake" : "Take Selfie"}
                                                    </Button>
                                                ) : (
                                                    <>
                                                        <input
                                                            type="file"
                                                            accept="image/*,application/pdf"
                                                            className="hidden"
                                                            ref={(el) => { fileInputRefs.current[dt.key] = el; }}
                                                            onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(dt.key, e.target.files[0]); }}
                                                        />
                                                        <Button
                                                            size="sm"
                                                            variant={isRejected ? "default" : "outline"}
                                                            className={`h-8 text-xs ${isRejected ? "bg-red-600 hover:bg-red-700 text-white border-0" : ""}`}
                                                            onClick={() => fileInputRefs.current[dt.key]?.click()}
                                                            disabled={isUploading || isAtLimit}
                                                            title={isAtLimit ? "Storage full — compress existing files first" : ""}
                                                        >
                                                            {isUploading ? (
                                                                <><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Uploading...</>
                                                            ) : isRejected ? (
                                                                <><Upload className="h-3 w-3 mr-1" /> Re-upload ↗</>
                                                            ) : doc ? (
                                                                <><Upload className="h-3 w-3 mr-1" /> Replace</>
                                                            ) : (
                                                                <><Upload className="h-3 w-3 mr-1" /> Upload</>
                                                            )}
                                                        </Button>
                                                    </>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Foreign nationals toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                    <p className="text-sm font-bold text-slate-700">🛂 Are you a foreign national?</p>
                    <p className="text-xs text-slate-500 mt-0.5">Enable to see and upload Passport & Visa (mandatory by Indian law for foreigners)</p>
                </div>
                <Button
                    size="sm"
                    variant={showForeignDocs ? "default" : "outline"}
                    onClick={() => setShowForeignDocs(!showForeignDocs)}
                    className="text-xs shrink-0"
                >
                    {showForeignDocs ? "✓ Enabled" : "Enable"}
                </Button>
            </div>

            {/* Camera Modal */}
            {cameraActive && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
                        <h2 className="text-xl font-bold text-center">📸 Take Your Selfie</h2>
                        <p className="text-sm text-center text-muted-foreground">Look directly at camera. Good lighting, no cap or sunglasses.</p>
                        <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg border" />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="flex gap-3">
                            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={captureSelfie}>
                                📸 Capture
                            </Button>
                            <button
                                onClick={() => {
                                    const stream = videoRef.current?.srcObject as MediaStream;
                                    stream?.getTracks().forEach((t) => t.stop());
                                    setCameraActive(false);
                                }}
                                className="flex-1 py-3 text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-all active:scale-95 uppercase tracking-widest"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
