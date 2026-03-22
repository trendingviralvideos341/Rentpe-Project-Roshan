"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, ScrollText, AlertTriangle, ShieldCheck, ChevronDown, Landmark, FileText } from "lucide-react";

interface LegalTermsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAccept: () => void;
    type: "GENERAL_TERMS" | "ONBOARDING_FEE";
    feeAmount?: number | null;
}

export function LegalTermsModal({ isOpen, onClose, onAccept, type, feeAmount }: LegalTermsModalProps) {
    const [scrolledToBottom, setScrolledToBottom] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setScrolledToBottom(false);
        }
    }, [isOpen]);

    function handleScroll() {
        const el = scrollRef.current;
        if (!el) return;
        // Tight threshold: user must be within 15px of bottom
        const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 15;
        if (isAtBottom) setScrolledToBottom(true);
    }

    const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden border-0 shadow-2xl">
                {/* Header */}
                <DialogHeader className={`px-6 pt-5 pb-4 shrink-0 ${type === 'GENERAL_TERMS' ? 'bg-slate-900 text-white' : 'bg-emerald-950 text-white'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl border ${type === 'GENERAL_TERMS' ? 'bg-indigo-500/20 border-indigo-400/30' : 'bg-emerald-500/20 border-emerald-400/30'}`}>
                            {type === 'GENERAL_TERMS' ? <ScrollText className="w-5 h-5 text-indigo-300" /> : <Landmark className="w-5 h-5 text-emerald-300" />}
                        </div>
                        <div>
                            <DialogTitle className="text-base font-extrabold tracking-tight">
                                {type === "GENERAL_TERMS" ? "Property Listing Terms" : "Fee Acknowledgment"}
                            </DialogTitle>
                            <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest font-black">RentPe · {today}</p>
                        </div>
                    </div>
                </DialogHeader>

                {/* Content */}
                <div 
                    ref={scrollRef} 
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto bg-white px-6 py-6 space-y-6 text-[12px] text-slate-600 leading-relaxed scrollbar-thin scrollbar-thumb-slate-200"
                >
                    {type === "GENERAL_TERMS" ? (
                        <>
                            <section className="space-y-2">
                                <h4 className="font-black text-slate-900 border-l-3 border-indigo-500 pl-2 uppercase text-[10px] tracking-widest">1. Accuracy & Transparency</h4>
                                <p>You represent that all property details, photos, and descriptions are 100% accurate. Misrepresentation of location, amenities, or room condition is a breach of platform policy and grounds for immediate de-listing.</p>
                            </section>

                            <section className="space-y-2">
                                <h4 className="font-black text-slate-900 border-l-3 border-indigo-500 pl-2 uppercase text-[10px] tracking-widest">2. Document Integrity</h4>
                                <p>You must provide valid, government-recognized KYC (Aadhaar, PAN) and property licences. Any attempt to upload fraudulent or expired documents will result in a permanent ban and reporting to authorities if required.</p>
                            </section>

                            <section className="space-y-2">
                                <h4 className="font-black text-slate-900 border-l-3 border-indigo-500 pl-2 uppercase text-[10px] tracking-widest">3. Security Deposit (MTA 2021)</h4>
                                <p>In compliance with the <strong>Model Tenancy Act 2021</strong>, security deposits are capped at a maximum of <strong>two months' rent</strong>. Deductions are permitted only for documented physical damage (not wear & tear) or unpaid dues.</p>
                            </section>

                            <section className="space-y-2">
                                <h4 className="font-black text-slate-900 border-l-3 border-indigo-500 pl-2 uppercase text-[10px] tracking-widest">4. Booking Obligations</h4>
                                <p>Once a student pays the token/reservation fee via RentPe, the room is locked. You are obligated to honor the booking. Arbitrary cancellations to take off-platform tenants will attract penalties.</p>
                            </section>

                            <section className="space-y-2">
                                <h4 className="font-black text-slate-900 border-l-3 border-indigo-500 pl-2 uppercase text-[10px] tracking-widest">5. Performance & Reviews</h4>
                                <p>Your property ranking is influenced by verification status, response time, and student reviews. Continued negative feedback regarding maintenance or service may lead to re-audit.</p>
                            </section>
                        </>
                    ) : (
                        <>
                            <div className="bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-5 text-center space-y-2">
                                <div className="text-3xl font-black text-emerald-700">₹{feeAmount || '90'}</div>
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">One-Time Onboarding Fee</p>
                            </div>

                            <section className="space-y-2 pt-2">
                                <h4 className="font-black text-slate-900 border-l-3 border-emerald-500 pl-2 uppercase text-[10px] tracking-widest">1. Purely Service-Based Fee</h4>
                                <p>This fee covers the costs of digital processing, document verification, and initial technical setup of your property profile on the RentPe marketplace.</p>
                            </section>

                            <section className="space-y-2">
                                <h4 className="font-black text-slate-900 border-l-3 border-emerald-500 pl-2 uppercase text-[10px] tracking-widest">2. Non-Refundable Nature</h4>
                                <p>The onboarding fee is strictly <strong>non-refundable</strong>. Once verification is initiated, the fee cannot be reversed even if you choose to de-list the property later.</p>
                            </section>

                            <section className="space-y-2">
                                <h4 className="font-black text-slate-900 border-l-3 border-emerald-500 pl-2 uppercase text-[10px] tracking-widest">3. Verification Result</h4>
                                <p>Payment of the fee does not guarantee "Verified" status. Approval is contingent upon the accuracy of your documents and property inspection. Failed verifications due to wrong/fraudulent data will not be refunded.</p>
                            </section>

                            <section className="space-y-2">
                                <h4 className="font-black text-slate-900 border-l-3 border-emerald-500 pl-2 uppercase text-[10px] tracking-widest">4. Tax Compliance</h4>
                                <p>The fee includes all applicable taxes (GST @ 18%). Tax invoices can be downloaded from your Finance panel after payment.</p>
                            </section>
                        </>
                    )}

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
                        <div className="flex gap-3">
                            <ShieldCheck className={`w-4 h-4 shrink-0 mt-0.5 ${type === 'GENERAL_TERMS' ? 'text-indigo-600' : 'text-emerald-600'}`} />
                            <p className="text-[10px] font-medium text-slate-500 leading-tight">
                                By accepting, you confirm your legal binding to these terms under the Information Technology Act, 2000.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0 flex flex-col gap-3">
                    {!scrolledToBottom && (
                        <p className="text-center text-[10px] text-amber-600 font-bold flex items-center justify-center gap-1.5 animate-pulse">
                            <ChevronDown className="w-3.5 h-3.5" /> Please scroll to read the full {type === 'GENERAL_TERMS' ? 'terms' : 'fee policy'}
                        </p>
                    )}
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl h-11 font-bold border-slate-200">
                            Cancel
                        </Button>
                        <Button 
                            onClick={onAccept} 
                            disabled={!scrolledToBottom}
                            className={`flex-1 rounded-xl h-11 font-black text-xs uppercase tracking-[0.1em] text-white shadow-lg transition-all active:scale-[0.98] ${
                                type === 'GENERAL_TERMS' 
                                    ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' 
                                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'
                            }`}
                        >
                            <CheckCircle className="w-4 h-4 mr-2" /> I Read & Accept
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
