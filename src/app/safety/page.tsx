import Link from "next/link";
import { Shield, AlertTriangle, CheckCircle, Info } from "lucide-react";

export const metadata = {
    title: "Platform Safety & Disclaimer | RentPe",
    description: "Important safety guidelines and platform role disclaimers for Owners and Tenants on RentPe.",
};

export default function SafetyPage() {
    return (
        <div className="min-h-screen bg-muted/20">
            <div className="max-w-4xl mx-auto px-4 py-12">
                <div className="mb-10 text-center">
                    <div className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-4">Security</div>
                    <h1 className="text-4xl font-black text-slate-900 mb-3">Platform Safety & Disclaimer</h1>
                    <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
                        Your safety is our priority. While we implement robust verification systems, staying informed and cautious is essential for a secure rental experience.
                    </p>
                </div>

                <div className="grid gap-8">
                    {/* Disclaimer Section */}
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 md:p-8">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 mb-3">Intermediary Role Disclaimer</h2>
                                <p className="text-slate-700 leading-relaxed text-sm">
                                    RentPe Technologies Private Limited acts strictly as an <strong>intermediary platform</strong> connecting property owners with potential tenants. We do not own, manage, or operate any property listed on our site.
                                </p>
                                <p className="text-slate-700 leading-relaxed text-sm mt-3 italic">
                                    A contract for the rental of a property is directly between the Property Owner and the Tenant. RentPe is not a party to such contracts and disclaims all liability arising from or related to any such agreements.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Safety Guidelines */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                    <Shield className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-slate-900">For Tenants</h3>
                            </div>
                            <ul className="space-y-3 text-sm text-slate-600">
                                <li className="flex gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                    <span>Always visit the property in person before paying any large deposits.</span>
                                </li>
                                <li className="flex gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                    <span>Verify the owner's original ID and property ownership documents.</span>
                                </li>
                                <li className="flex gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                    <span>Request a formal receipt or rent agreement for all payments made.</span>
                                </li>
                            </ul>
                        </div>

                        <div className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                                    <Shield className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-slate-900">For Owners</h3>
                            </div>
                            <ul className="space-y-3 text-sm text-slate-600">
                                <li className="flex gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                    <span>Conduct your own background checks on potential tenants.</span>
                                </li>
                                <li className="flex gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                    <span>Verify official identity documents provided during the booking process.</span>
                                </li>
                                <li className="flex gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                    <span>Ensure you have signed a legally binding rental/license agreement.</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Fraud Prevention */}
                    <div className="bg-slate-900 text-white rounded-2xl p-6 md:p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <Info className="w-6 h-6 text-blue-400" />
                            <h2 className="text-xl font-bold">Fraud Prevention Guidance</h2>
                        </div>
                        <div className="grid md:grid-cols-3 gap-6 text-sm">
                            <div className="space-y-2">
                                <p className="font-bold text-blue-400">Avoid "Wire" Transfers</p>
                                <p className="text-slate-300">Never send money via direct bank transfer to someone you haven't met. Use RentPe's secure portal for booking tokens.</p>
                            </div>
                            <div className="space-y-2">
                                <p className="font-bold text-blue-400">Suspicious Listings</p>
                                <p className="text-slate-300">Report listings that look "too good to be true" or where the owner refuses a physical visit.</p>
                            </div>
                            <div className="space-y-2">
                                <p className="font-bold text-blue-400">Off-Platform Deals</p>
                                <p className="text-slate-300">Avoid transacting off-platform to save on fees. Off-platform deals are not protected by our Refund Policy.</p>
                            </div>
                        </div>
                    </div>

                    <div className="text-center text-xs text-muted-foreground mt-4">
                        <p>If you encounter any suspicious activity, please report it immediately to <a href="mailto:safety@rentpe.in" className="text-blue-600 underline">safety@rentpe.in</a>.</p>
                    </div>
                </div>

                <div className="mt-12 pt-6 border-t flex flex-wrap justify-center gap-6 text-xs text-muted-foreground">
                    <Link href="/terms" className="hover:text-blue-600 transition-colors">Terms of Service</Link>
                    <Link href="/privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</Link>
                    <Link href="/refund" className="hover:text-blue-600 transition-colors">Refund Policy</Link>
                </div>
            </div>
        </div>
    );
}
