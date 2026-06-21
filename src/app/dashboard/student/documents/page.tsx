"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    MapPin, ShieldCheck, CheckCircle, Clock,
    FileText, Phone, AlertTriangle, ChevronRight
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Pending Note 1 — IMPLEMENTED.
 * KYC online document upload is BYPASSED.
 * Students are directed to bring physical documents at check-in.
 * No sensitive documents are collected or stored digitally via this page.
 *
 * Legal basis:
 *  - DPDPA 2023 (India) — data minimisation principle
 *  - Section 144 CrPC — property owner submits police verification docs in-person
 *  - PCI-DSS equivalent best practice — don't store what you don't need
 */

const CHECKIN_DOCS = [
    {
        icon: "🪪",
        label: "Government-Issued Photo ID",
        accepted: ["Aadhaar Card", "Passport", "Voter ID", "Driving Licence"],
        note: "Original + 1 self-attested photocopy",
        required: true,
    },
    {
        icon: "🏠",
        label: "Address Proof",
        accepted: ["Aadhaar Card", "Utility Bill (recent)", "Bank Passbook / Statement"],
        note: "Aadhaar covers both ID & Address — bring one copy",
        required: true,
    },
    {
        icon: "🎓",
        label: "College / Company Proof",
        accepted: ["College ID Card", "Bonafide Certificate", "Offer Letter", "Employee ID"],
        note: "Original + 1 photocopy",
        required: true,
    },
    {
        icon: "📸",
        label: "Passport-Size Photographs",
        accepted: ["2 recent colour photos", "White / light background"],
        note: "Taken within the last 3 months",
        required: true,
    },
    {
        icon: "🛂",
        label: "Passport & Visa (Foreign Nationals Only)",
        accepted: ["Valid Passport", "Valid Indian Visa (copy)"],
        note: "Mandatory under Foreigners Registration Office (FRO) rules",
        required: false,
    },
];

const CHECKIN_STEPS = [
    { step: "01", title: "Book & Pay Token", desc: "Complete your booking and pay the ₹1,000 token online to reserve your bed." },
    { step: "02", title: "Physically Visit the Property", desc: "Arrive at the PG / hostel with all original documents listed below." },
    { step: "03", title: "Staff Verifies Your Documents", desc: "Our on-site team inspects originals, collects a photocopy, and logs your check-in." },
    { step: "04", title: "Tenant ID Activated", desc: "Your Tenant ID is instantly activated on the platform — no waiting." },
    { step: "05", title: "Sign the Rental Agreement", desc: "Sign the digital agreement from your dashboard immediately after check-in." },
];

export default function StudentDocumentsPage() {
    return (
        <div className="container mx-auto max-w-3xl py-8 px-4 space-y-6">

            {/* ── Page Header ── */}
            <div className="space-y-1">
                <h1 className="text-3xl font-black text-slate-900">KYC Verification</h1>
                <p className="text-sm text-muted-foreground">
                    Identity verification is done <strong>in-person at check-in</strong> — no online uploads required.
                </p>
            </div>

            {/* ── Hero Notice ── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-6 text-white shadow-xl">
                <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                <div className="relative z-10 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                            <MapPin className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-white/70">Pending Note 1 — Active</p>
                            <h2 className="text-xl font-black">Bring Documents in Person</h2>
                        </div>
                    </div>
                    <p className="text-sm text-white/90 leading-relaxed font-medium">
                        You are <strong>not required to upload any documents online</strong>. RentPe verifies your
                        identity <strong>face-to-face at the property</strong> when you physically check in.
                        This protects your sensitive data and eliminates online fraud risks.
                    </p>
                    <div className="flex items-center gap-2 bg-white/15 border border-white/20 rounded-xl p-3">
                        <ShieldCheck className="h-4 w-4 text-white shrink-0" />
                        <p className="text-xs font-bold text-white">
                            Zero documents stored online. Your privacy is protected by design.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Why Physical Verification ── */}
            <Card className="border-none shadow-md">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-black flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-indigo-600" />
                        Why Physical Verification?
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { emoji: "🔐", title: "Zero Data Breach Risk", desc: "No document photos stored on our servers — eliminates hacking & leak risk entirely." },
                        { emoji: "🚫", title: "Anti-Phishing", desc: "Online upload pages are prime phishing targets. We remove that attack vector completely." },
                        { emoji: "⚖️", title: "DPDPA 2023 Compliant", desc: "India's Digital Personal Data Protection Act requires data minimisation — we collect only what we must." },
                    ].map((item) => (
                        <div key={item.title} className="bg-slate-50 rounded-xl p-4 space-y-1.5 border border-slate-100">
                            <span className="text-2xl">{item.emoji}</span>
                            <p className="text-sm font-black text-slate-800">{item.title}</p>
                            <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* ── Check-In Process ── */}
            <Card className="border-none shadow-md">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-black flex items-center gap-2">
                        <Clock className="h-5 w-5 text-violet-600" />
                        Check-In Process (Step by Step)
                    </CardTitle>
                    <CardDescription>What to expect when you arrive at the property</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {CHECKIN_STEPS.map((s, i) => (
                        <div key={i} className="flex items-start gap-4">
                            <div className="h-9 w-9 rounded-xl bg-violet-100 text-violet-700 font-black text-sm flex items-center justify-center shrink-0">
                                {s.step}
                            </div>
                            <div className="flex-1 pt-1">
                                <p className="text-sm font-black text-slate-800">{s.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
                            </div>
                            {i < CHECKIN_STEPS.length - 1 && (
                                <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 mt-2" />
                            )}
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* ── Documents to Bring ── */}
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">
                    📋 Documents to Bring at Check-In
                </p>
                <div className="space-y-3">
                    {CHECKIN_DOCS.map((doc, i) => (
                        <Card key={i} className={`border-2 shadow-sm ${doc.required ? "border-slate-200" : "border-dashed border-slate-200"}`}>
                            <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                    <span className="text-2xl shrink-0 mt-0.5">{doc.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <h3 className="font-black text-sm text-slate-800">{doc.label}</h3>
                                            {doc.required ? (
                                                <span className="text-[9px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded uppercase">Required</span>
                                            ) : (
                                                <span className="text-[9px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded uppercase">If Applicable</span>
                                            )}
                                        </div>
                                        <ul className="space-y-0.5 mb-2">
                                            {doc.accepted.map((a) => (
                                                <li key={a} className="flex items-center gap-1.5 text-xs text-slate-600">
                                                    <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                                                    {a}
                                                </li>
                                            ))}
                                        </ul>
                                        <span className="inline-block text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                                            📌 {doc.note}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* ── Legal Notice ── */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                    <p className="font-bold mb-1">⚖️ Legal Requirement — Section 144 CrPC (India)</p>
                    <p className="text-xs leading-relaxed">
                        Property owners are legally required to submit tenant identity details for police verification.
                        This is fulfilled <strong>in-person at check-in</strong> by our staff — you do not need to
                        submit anything online. Bringing original documents ensures your check-in is smooth and compliant.
                    </p>
                </div>
            </div>

            {/* ── CTA ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button asChild className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black h-12 rounded-2xl">
                    <Link href="/dashboard/student">← Back to Dashboard</Link>
                </Button>
                <Button asChild variant="outline" className="h-12 rounded-2xl border-2 font-bold">
                    <Link href="/dashboard/student/bookings">View My Bookings</Link>
                </Button>
            </div>

            {/* ── Support ── */}
            <div className="flex items-center gap-2 text-xs text-slate-400 border-t border-slate-100 pt-4">
                <Phone className="h-3 w-3 shrink-0" />
                <span>
                    Need help? Contact your property manager or email{" "}
                    <strong className="text-slate-600">help@rentpe.in</strong>
                </span>
            </div>
        </div>
    );
}
