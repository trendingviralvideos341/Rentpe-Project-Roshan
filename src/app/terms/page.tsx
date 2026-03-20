import { Metadata } from "next";
import Link from "next/link";
import { FileText, Shield, Building2, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
    title: "Terms & Conditions | RentPe",
    description: "Legal Terms and Conditions for all RentPe platform users.",
};

export default function TermsIndexPage() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-16">
            <div className="max-w-2xl w-full space-y-8">
                <div className="text-center space-y-3">
                    <div className="inline-flex p-4 bg-indigo-100 rounded-3xl mb-2">
                        <FileText className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h1 className="text-4xl font-extrabold text-slate-900">Legal Terms</h1>
                    <p className="text-slate-500 text-lg">Select your role to read the applicable Terms & Conditions</p>
                    <p className="text-xs text-slate-400">Version v1.0 &bull; Last Updated: March 20, 2026 &bull; Aligned with Model Tenancy Act 2021</p>
                </div>

                <div className="grid gap-5">
                    <Link href="/terms/tenant" className="group block p-6 bg-white rounded-2xl border-2 border-slate-200 hover:border-indigo-400 transition-all hover:shadow-lg">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-100 rounded-xl group-hover:bg-indigo-600 transition-colors">
                                    <Shield className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-slate-900">Student & Tenant Terms</h2>
                                    <p className="text-sm text-slate-500">For students and tenants booking PG/hostel accommodation</p>
                                    <div className="flex gap-2 mt-1.5 flex-wrap">
                                        <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full border border-blue-100">Booking Rights</span>
                                        <span className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-full border border-emerald-100">Deposit Policy</span>
                                        <span className="text-[10px] bg-purple-50 text-purple-600 font-bold px-2 py-0.5 rounded-full border border-purple-100">MTA 2021</span>
                                    </div>
                                </div>
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                        </div>
                    </Link>

                    <Link href="/terms/owner" className="group block p-6 bg-white rounded-2xl border-2 border-slate-200 hover:border-emerald-400 transition-all hover:shadow-lg">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-100 rounded-xl group-hover:bg-emerald-600 transition-colors">
                                    <Building2 className="w-6 h-6 text-emerald-600 group-hover:text-white transition-colors" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-slate-900">Property Owner Terms</h2>
                                    <p className="text-sm text-slate-500">For PG, hostel, and property operators listing on RentPe</p>
                                    <div className="flex gap-2 mt-1.5 flex-wrap">
                                        <span className="text-[10px] bg-amber-50 text-amber-600 font-bold px-2 py-0.5 rounded-full border border-amber-100">Listing Rules</span>
                                        <span className="text-[10px] bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-full border border-red-100">GST Compliance</span>
                                        <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full border border-blue-100">Fee Structure</span>
                                    </div>
                                </div>
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors shrink-0" />
                        </div>
                    </Link>
                </div>

                <p className="text-center text-xs text-slate-400 leading-relaxed">
                    These Terms are aligned with India's Model Tenancy Act 2021, Consumer Protection Act 2019,<br />
                    CBIC GST Circular (July 2024), and IT Act 2000. For queries: <strong>legal@rentpe.in</strong>
                </p>
            </div>
        </div>
    );
}
