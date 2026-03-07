'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileCheck, AlertCircle, Trash2, Eye, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface StudentKYCUploaderProps {
    bookingId: string;
    existingDocs?: any[];
    onUploadSuccess?: () => void;
}

export function StudentKYCUploader({ bookingId, existingDocs = [], onUploadSuccess }: StudentKYCUploaderProps) {
    const [uploading, setUploading] = useState<string | null>(null);

    const docTypes = [
        { key: 'AADHAAR_FRONT', label: 'Aadhaar Card (Front)', desc: 'Clear photo of the front side', required: true },
        { key: 'AADHAAR_BACK', label: 'Aadhaar Card (Back)', desc: 'Clear photo of the back side', required: true },
        { key: 'PAN_FRONT', label: 'PAN Card (Front)', desc: 'Front side for identity verification', required: true },
        { key: 'PAN_BACK', label: 'PAN Card (Back)', desc: 'Back side (Optional)', required: false },
        { key: 'STUDENT_ID', label: 'Student ID / University ID', desc: 'Current academic year only', required: true },
        { key: 'COMPANY_ID', label: 'Company ID / Offer Letter', desc: 'Working professionals only', required: true },
        { key: 'LIVE_PHOTO', label: 'Live Photo / Selfie', desc: 'Clear selfie or live photo for identity match', required: true },
        { key: 'OTHER', label: 'Others (If Any)', desc: 'Any additional supporting document', required: false },
    ];


    const handleUpload = async (file: File, type: string) => {
        if (file.size > 5 * 1024 * 1024) return toast.error("File size must be less than 5MB");

        setUploading(type);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();

            if (res.ok && data.url) {
                // Call server action to link doc to booking
                const linkRes = await fetch('/api/booking/document', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bookingId, url: data.url, type, fileName: file.name })
                });

                if (linkRes.ok) {
                    toast.success(`${type.replace('_', ' ')} uploaded!`);
                    onUploadSuccess?.();
                }
            }
        } catch (e) {
            toast.error("Upload failed");
        } finally {
            setUploading(null);
        }
    };

    return (
        <Card className="border-indigo-100 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-indigo-50/50 border-b border-indigo-100">
                <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="h-5 w-5 text-indigo-600" />
                    <span className="text-xs font-bold text-indigo-700 uppercase">Secure KYC Verification</span>
                </div>
                <CardTitle className="text-xl font-bold">Document Verification</CardTitle>
                <CardDescription>
                    Please upload clear photos or PDFs of the following documents to confirm your booking.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {docTypes.map((doc) => {
                        const existing = existingDocs.find(d => d.type === doc.key);
                        const isVerified = existing?.status === 'VERIFIED';
                        const isRejected = existing?.status === 'REJECTED';

                        return (
                            <div key={doc.key} className={`
                                border-2 rounded-xl p-4 flex flex-col justify-between transition-all h-full
                                ${isVerified ? 'border-green-100 bg-green-50/30' :
                                    isRejected ? 'border-red-100 bg-red-50/30' :
                                        'border-slate-100 hover:border-indigo-200 bg-slate-50/30'}
                            `}>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-sm text-slate-800">{doc.label}</h4>
                                            {doc.required ? (
                                                <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">Required</span>
                                            ) : (
                                                <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">Optional</span>
                                            )}
                                        </div>
                                        {isVerified && <FileCheck className="h-4 w-4 text-green-600" />}
                                        {isRejected && <AlertCircle className="h-4 w-4 text-red-600" />}
                                    </div>
                                    <p className="text-[10px] text-slate-500 mb-4">{doc.desc}</p>
                                </div>

                                <div className="space-y-2 mt-auto">
                                    {existing ? (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between bg-white border rounded-lg p-2 shadow-sm text-[10px]">
                                                <span className="truncate max-w-[100px] font-medium">{existing.fileName || 'Document'}</span>
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                                                        <a href={existing.fileData} target="_blank"><Eye className="h-3 w-3" /></a>
                                                    </Button>
                                                </div>
                                            </div>
                                            {isRejected && (
                                                <p className="text-[9px] text-red-600 font-bold bg-white p-1.5 rounded border border-red-100">
                                                    Reason: {existing.rejectedNote || "Invalid document"}
                                                </p>
                                            )}
                                            {!isVerified && (
                                                <label className="w-full">
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], doc.key)}
                                                        disabled={!!uploading}
                                                    />
                                                    <Button variant="outline" size="sm" className="w-full text-[10px] h-8 font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                                                        {uploading === doc.key ? "Uploading..." : "Replace"}
                                                    </Button>
                                                </label>
                                            )}
                                        </div>
                                    ) : (
                                        <label className="w-full">
                                            <input
                                                type="file"
                                                className="hidden"
                                                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], doc.key)}
                                                disabled={!!uploading}
                                            />
                                            <Button variant="outline" size="sm" className="w-full h-10 border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold">
                                                {uploading === doc.key ? "Uploading..." : "Upload File"}
                                            </Button>
                                        </label>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-3 items-start">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-800 leading-relaxed">
                        <strong>Security Note:</strong> All documents are encrypted and only accessible by verified platform admins for identity purposes. Please ensure files are clear and readable to avoid rejection.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
