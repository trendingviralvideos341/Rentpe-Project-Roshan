"use client";

import { useState } from "react";
import { VerificationsContainer } from "@/components/dashboard/VerificationsContainer";
import { AgreementsContainer } from "@/components/dashboard/AgreementsContainer";
import { ShieldCheck, FileSignature } from "lucide-react";

export default function TenantKYCAndAgreementPage() {
    const [activeTab, setActiveTab] = useState<"kyc" | "agreements">("kyc");

    return (
        <div className="min-h-screen bg-slate-50/50">
            <div className="p-4 md:p-8 space-y-6">
                {/* Large Full-Width Tabs */}
                <div className="bg-white p-2 md:p-3 rounded-2xl sm:rounded-full border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-2 w-full max-w-6xl mx-auto">
                    <button
                        onClick={() => setActiveTab("kyc")}
                        className={`flex-1 py-4 px-6 text-sm md:text-base font-black rounded-xl sm:rounded-full transition-all duration-300 flex items-center justify-center gap-3 ${
                            activeTab === "kyc"
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-[1.02]"
                                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        }`}
                    >
                        <ShieldCheck className="w-5 h-5 md:w-6 md:h-6" />
                        KYC & Document Verifications
                    </button>
                    <button
                        onClick={() => setActiveTab("agreements")}
                        className={`flex-1 py-4 px-6 text-sm md:text-base font-black rounded-xl sm:rounded-full transition-all duration-300 flex items-center justify-center gap-3 ${
                            activeTab === "agreements"
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-[1.02]"
                                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        }`}
                    >
                        <FileSignature className="w-5 h-5 md:w-6 md:h-6" />
                        Agreements (L&L)
                    </button>
                </div>

                {/* Tab Content */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {activeTab === "kyc" && <VerificationsContainer />}
                    {activeTab === "agreements" && <div className="-mx-4 md:-mx-8"><AgreementsContainer /></div>}
                </div>
            </div>
        </div>
    );
}
