"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Upload, CheckCircle, Clock, XCircle, AlertTriangle } from "lucide-react";
import { getBookings } from "@/actions/bookings";
import { uploadTenantDocument, getTenantDocuments } from "@/actions/documents";

const DOC_TYPES = [
    { key: "ID_PROOF", label: "ID Proof", desc: "Aadhaar / PAN / Passport", icon: "🪪" },
    { key: "ADDRESS_PROOF", label: "Address Proof", desc: "Utility bill / Bank statement", icon: "🏠" },
    { key: "COLLEGE_COMPANY", label: "College / Company", desc: "ID card / Offer letter", icon: "🎓" },
    { key: "SELFIE", label: "Live Selfie", desc: "Take a live photo for verification", icon: "📸", isCamera: true },
];

const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5 MB

// estimate file size (handles base64, files, or URLs roughly)
function getFileSize(data: string | File): number {
    if (!data) return 0;
    if (data instanceof File) return data.size;
    if (data.startsWith('data:')) {
        const base = data.includes(",") ? data.split(",")[1] : data;
        return Math.floor((base.length * 3) / 4);
    }
    // For Cloudinary URLs, we don't have the size locally, 
    // but in this UI we primarily care about the new upload.
    // We'll return 0 for URLs to avoid breaking calculations, 
    // as previously it was return wrong values anyway.
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
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    useEffect(() => {
        const load = async () => {
            try {
                const bookings = await getBookings();
                const paid = bookings.find((b: any) => b.status === "PAID" || b.paymentStatus === "PAID");
                if (paid) {
                    setBooking(paid);
                    const docs = await getTenantDocuments(paid.id);
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

    // ── Storage calculation ──────────────────────────────
    const usedBytes = documents.reduce((sum, d) => sum + getFileSize(d.fileData || ""), 0);
    const remainingBytes = MAX_TOTAL_BYTES - usedBytes;
    const usedPercent = Math.min(100, (usedBytes / MAX_TOTAL_BYTES) * 100);
    const isNearLimit = usedPercent >= 80;
    const isAtLimit = remainingBytes <= 0;

    const getDocStatus = (type: string) => documents.find(d => d.type === type);

    const checkAndUpload = async (type: string, fileData: string | File, fileName: string) => {
        if (!booking) return;
        setUploadError(null);

        const newFileBytes = getFileSize(fileData);

        // Find existing doc of this type to subtract its size (it will be replaced)
        const existingDoc = getDocStatus(type);
        const existingBytes = existingDoc ? getFileSize(existingDoc.fileData || "") : 0;
        const projectedUsed = usedBytes - existingBytes + newFileBytes;

        if (projectedUsed > MAX_TOTAL_BYTES) {
            const overBy = formatMB(projectedUsed - MAX_TOTAL_BYTES);
            setUploadError(
                `❌ Upload exceeds the 5 MB combined limit by ${overBy} MB. Please compress your file and try again.`
            );
            setUploading(null);
            return;
        }

        await uploadTenantDocument({ bookingId: booking.id, type, fileData, fileName });
        const docs = await getTenantDocuments(booking.id);
        setDocuments(docs);
        setUploading(null);
    };

    const handleFileUpload = async (type: string, file: File) => {
        setUploading(type);
        setUploadError(null);
        try {
            await checkAndUpload(type, file, file.name);
        } catch {
            setUploadError("Upload failed. Please try again.");
            setUploading(null);
        }
    };

    const startCamera = async () => {
        setCameraActive(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch {
            alert("Camera access denied. Please allow camera access.");
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
            stream?.getTracks().forEach(t => t.stop());
            setCameraActive(false);

            setUploading("SELFIE");
            await checkAndUpload("SELFIE", file, "selfie.jpg");
        }, "image/jpeg", 0.75);
    };

    if (loading) return <div className="p-8 text-center animate-pulse">Loading...</div>;

    if (!booking) return (
        <div className="p-8 text-center">
            <div className="text-4xl mb-4">📋</div>
            <h2 className="text-xl font-bold mb-2">No Active Booking</h2>
            <p className="text-muted-foreground">Document upload is available after your booking payment is confirmed.</p>
        </div>
    );

    const allVerified = DOC_TYPES.every(dt => getDocStatus(dt.key)?.status === "VERIFIED");

    return (
        <div className="container mx-auto max-w-3xl py-8 px-4 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Document Verification</h1>
                <p className="text-muted-foreground">Upload your documents for verification. Booking: <strong>{booking.displayId}</strong></p>
            </div>

            {allVerified && (
                <div className="bg-green-50 border border-green-300 rounded-lg p-4 flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <div>
                        <p className="font-bold text-green-800">All Documents Verified! ✅</p>
                        <p className="text-sm text-green-700">Your verification is complete. Welcome to your new home!</p>
                    </div>
                </div>
            )}

            {/* ── Storage Meter ─────────────────────────────── */}
            <div className={`rounded-xl border-2 p-4 space-y-2 ${isAtLimit ? "border-red-500 bg-red-50" : isNearLimit ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-gray-50"}`}>
                <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700">📦 Combined Upload Storage</span>
                    <span className={`text-sm font-bold ${isAtLimit ? "text-red-600" : isNearLimit ? "text-orange-600" : "text-gray-600"}`}>
                        {formatMB(usedBytes)} MB used of 5.00 MB
                    </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                        className={`h-3 rounded-full transition-all duration-500 ${isAtLimit ? "bg-red-600" : isNearLimit ? "bg-orange-500" : "bg-green-500"}`}
                        style={{ width: `${usedPercent}%` }}
                    />
                </div>

                {/* Remaining label — always red */}
                <p className="text-sm font-bold text-red-600">
                    {isAtLimit
                        ? "⛔ Storage full! You cannot upload more documents."
                        : `🔴 Remaining: ${formatMB(remainingBytes)} MB`}
                </p>

                {/* Compression tip */}
                <div className="flex items-start gap-2 mt-1 p-2 bg-red-100 border border-red-200 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-700">
                        <strong>Tip:</strong> If your files are too large, reduce their size by compressing them before uploading.
                        Use free tools like{" "}
                        <a href="https://compressjpeg.com" target="_blank" rel="noopener noreferrer" className="underline font-bold">compressjpeg.com</a>
                        {" "}(images) or{" "}
                        <a href="https://www.ilovepdf.com/compress_pdf" target="_blank" rel="noopener noreferrer" className="underline font-bold">ilovepdf.com</a>
                        {" "}(PDFs) to reduce file size before uploading.
                    </p>
                </div>
            </div>

            {/* Upload error */}
            {uploadError && (
                <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3 flex items-start gap-2">
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-red-700">{uploadError}</p>
                        <p className="text-xs text-red-600 mt-1">
                            Compress your file using the tools above and try again.
                        </p>
                    </div>
                </div>
            )}

            {/* Document Cards */}
            <div className="grid gap-4">
                {DOC_TYPES.map((dt) => {
                    const doc = getDocStatus(dt.key);
                    const isUploading = uploading === dt.key;
                    const docBytes = doc ? getFileSize(doc.fileData || "") : 0;

                    return (
                        <Card key={dt.key} className={`border-2 ${doc?.status === "VERIFIED" ? "border-green-300 bg-green-50/30" : doc?.status === "REJECTED" ? "border-red-300 bg-red-50/30" : doc ? "border-blue-200" : "border-dashed"}`}>
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1">
                                        <span className="text-2xl">{dt.icon}</span>
                                        <div className="flex-1">
                                            <h3 className="font-bold">{dt.label}</h3>
                                            <p className="text-sm text-muted-foreground">{dt.desc}</p>
                                            {doc && (
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    Size: <span className="font-medium">{formatMB(docBytes)} MB</span>
                                                </p>
                                            )}
                                            {doc?.status === "REJECTED" && doc.rejectedNote && (
                                                <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-700">
                                                    ❌ Rejected: {doc.rejectedNote}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                                        {doc?.status === "VERIFIED" && <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded"><CheckCircle className="h-3 w-3" /> Verified</span>}
                                        {doc?.status === "PENDING" && <span className="flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded"><Clock className="h-3 w-3" /> Pending Review</span>}
                                        {doc?.status === "REJECTED" && <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded"><XCircle className="h-3 w-3" /> Rejected</span>}
                                        {!doc && <span className="text-xs text-muted-foreground">Not uploaded</span>}

                                        {doc?.status !== "VERIFIED" && (
                                            dt.isCamera ? (
                                                <Button size="sm" className="h-8 text-xs" onClick={startCamera} disabled={isUploading || cameraActive || isAtLimit}>
                                                    <Camera className="h-3 w-3 mr-1" /> {doc ? "Retake" : "Take Selfie"}
                                                </Button>
                                            ) : (
                                                <>
                                                    <input
                                                        type="file"
                                                        accept="image/*,application/pdf"
                                                        className="hidden"
                                                        ref={el => { fileInputRefs.current[dt.key] = el; }}
                                                        onChange={e => { if (e.target.files?.[0]) handleFileUpload(dt.key, e.target.files[0]); }}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 text-xs"
                                                        onClick={() => fileInputRefs.current[dt.key]?.click()}
                                                        disabled={isUploading || isAtLimit}
                                                        title={isAtLimit ? "Storage full — compress existing files first" : ""}
                                                    >
                                                        <Upload className="h-3 w-3 mr-1" />
                                                        {isUploading ? "Uploading..." : doc ? "Re-upload" : "Upload"}
                                                    </Button>
                                                </>
                                            )
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Camera Modal */}
            {cameraActive && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
                        <h2 className="text-xl font-bold text-center">📸 Take Your Live Selfie</h2>
                        <p className="text-sm text-center text-muted-foreground">Look directly at the camera and click Capture.</p>
                        <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg border" />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="flex gap-3">
                            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={captureSelfie}>📸 Capture</Button>
                            <Button variant="outline" className="flex-1" onClick={() => {
                                const stream = videoRef.current?.srcObject as MediaStream;
                                stream?.getTracks().forEach(t => t.stop());
                                setCameraActive(false);
                            }}>Cancel</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
