'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MapPin, FileText, Clock, ShieldCheck, CheckCircle, Phone, AlertTriangle } from "lucide-react";

interface StudentKYCUploaderProps {
    bookingId: string;
    existingDocs?: any[];
    onUploadSuccess?: () => void;
}

/**
 * Pending Note 1 — KYC Online Upload BYPASSED.
 * Students are directed to bring physical documents at check-in.
 * No digital uploads are accepted or stored for KYC via this route.
 * Physical verification is handled by staff on-site.
 */
export function StudentKYCUploader({ bookingId }: StudentKYCUploaderProps) {
    const documents = [
        { icon: "🪪", label: "Government-Issued Photo ID", desc: "Aadhaar Card / Passport / Voter ID / Driving License", note: "Original + 1 photocopy" },
        { icon: "🏠", label: "Address Proof", desc: "Aadhaar Card / Utility Bill / Bank Statement", note: "Original + 1 photocopy" },
        { icon: "🎓", label: "College / Company Proof", desc: "College ID / Offer Letter / Employee ID card", note: "Original + 1 photocopy" },
        { icon: "📸", label: "Passport-Size Photographs", desc: "2 recent passport-size colour photos", note: "White background preferred" },
    ];

    return (
        <Card className="border-2 border-amber-300 shadow-md overflow-hidden bg-amber-50/30">
            {/* Header */}
            <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-5">
                <div className="flex items-center gap-3 mb-1">
                    <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        <MapPin className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-black text-white">Physical Document Check-In</CardTitle>
                        <CardDescription className="text-amber-100 text-xs font-medium mt-0.5">
                            No online uploads required — bring originals to the property
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-5 space-y-5">
                {/* Main Notice */}
                <div className="bg-white border-2 border-amber-300 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                        <p className="text-sm font-black text-amber-900 uppercase tracking-wide">
                            Online KYC Upload Not Required
                        </p>
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed font-medium">
                        RentPe verifies your identity <strong>in person at check-in</strong>. You do <strong>not</strong> need to
                        upload any documents online. Simply bring the originals listed below when you physically
                        arrive at the property to complete your verification.
                    </p>
                </div>

                {/* Documents to Bring */}
                <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                        📋 Documents to Bring at Check-In
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                        {documents.map((doc, i) => (
                            <div
                                key={i}
                                className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-sm"
                            >
                                <span className="text-xl shrink-0 mt-0.5">{doc.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-800">{doc.label}</p>
                                    <p className="text-xs text-muted-foreground">{doc.desc}</p>
                                    <span className="inline-block mt-1 text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                        {doc.note}
                                    </span>
                                </div>
                                <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-1" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* What Happens at Check-In */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-blue-600 shrink-0" />
                        <p className="text-xs font-black text-blue-800 uppercase tracking-wide">What Happens at Check-In</p>
                    </div>
                    <ul className="space-y-1.5 text-xs text-blue-800 font-medium">
                        <li className="flex items-start gap-2"><span className="shrink-0">1️⃣</span> Our staff will inspect your original documents on-site</li>
                        <li className="flex items-start gap-2"><span className="shrink-0">2️⃣</span> A photocopy will be collected and filed for records</li>
                        <li className="flex items-start gap-2"><span className="shrink-0">3️⃣</span> Your Tenant ID will be activated on the spot</li>
                        <li className="flex items-start gap-2"><span className="shrink-0">4️⃣</span> You can sign the rental agreement immediately after</li>
                    </ul>
                </div>

                {/* Security Note */}
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-3">
                    <ShieldCheck className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[11px] font-black text-green-800">Your Data is Safer This Way</p>
                        <p className="text-[10px] text-green-700 leading-relaxed mt-0.5">
                            Physical verification eliminates the risk of document fraud, phishing, and data breaches
                            associated with online uploads. Your documents are never stored on our servers.
                        </p>
                    </div>
                </div>

                {/* Support */}
                <div className="flex items-center gap-2 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span>Questions? Contact your property manager or reach RentPe support at <strong className="text-slate-700">help@rentpe.in</strong></span>
                </div>

                {/* Booking ref */}
                <p className="text-[9px] text-slate-400 font-mono text-right">Ref: {bookingId}</p>
            </CardContent>
        </Card>
    );
}
