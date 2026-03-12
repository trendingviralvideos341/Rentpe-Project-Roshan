import Link from "next/link";

export const metadata = {
    title: "Refund & Cancellation Policy | RentPe",
    description: "RentPe's refund and cancellation policy for booking tokens, rent payments, and security deposits.",
};

export default function RefundPage() {
    return (
        <div className="min-h-screen bg-muted/20">
            <div className="max-w-4xl mx-auto px-4 py-12">
                <div className="mb-10">
                    <div className="inline-block bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-4">Legal</div>
                    <h1 className="text-4xl font-black text-slate-900 mb-3">Refund & Cancellation Policy</h1>
                    <p className="text-muted-foreground text-sm">Effective Date: 08 March 2026 &nbsp;·&nbsp; Last Updated: 08 March 2026</p>
                    <p className="text-sm text-muted-foreground mt-2">
                        We want every RentPe experience to be smooth. This policy explains when and how refunds are processed for booking tokens, rent payments, and security deposits.
                    </p>
                </div>

                <div className="space-y-10 text-slate-700 leading-relaxed text-sm">

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4">1. Booking Token (Seat Hold Fee)</h2>
                        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-4 text-sm">
                            <p className="font-bold text-orange-800 mb-1">⚡ What is a Booking Token?</p>
                            <p>A Booking Token (₹99-₹499) is a small, refundable fee paid to temporarily reserve a bed while the owner reviews your request. It is held for a maximum of 48 hours.</p>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-100">
                                        <th className="border border-slate-200 px-4 py-2 text-left font-bold">Scenario</th>
                                        <th className="border border-slate-200 px-4 py-2 text-left font-bold">Refund</th>
                                        <th className="border border-slate-200 px-4 py-2 text-left font-bold">Timeline</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        ["Owner rejects your booking request", "100% Full Refund", "3-5 business days"],
                                        ["You cancel within 2 hours of token payment", "100% Full Refund", "3-5 business days"],
                                        ["You cancel after 2 hours but within 24 hours", "50% Refund", "3-5 business days"],
                                        ["You cancel after 24 hours", "No Refund", "-"],
                                        ["Owner confirms but you don't complete KYC in 48h", "Token Forfeited", "-"],
                                        ["RentPe technical error / double charge", "100% Full Refund", "3-5 business days"],
                                    ].map(([scenario, refund, timeline]) => (
                                        <tr key={scenario} className="border-b border-slate-100">
                                            <td className="border border-slate-200 px-4 py-2">{scenario}</td>
                                            <td className={`border border-slate-200 px-4 py-2 font-bold ${refund.includes("Full") ? "text-green-700" : refund.includes("50%") ? "text-yellow-700" : "text-red-700"}`}>
                                                {refund}
                                            </td>
                                            <td className="border border-slate-200 px-4 py-2 text-muted-foreground">{timeline}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">2. Refund Eligibility</h2>
                        <p>Refunds are processed under the following specific conditions:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-2">
                            <li><strong>Owner Rejection</strong>: If the Owner rejects your booking request, 100% of the booking token (excluding convenience fees) will be refunded.</li>
                            <li><strong>Property Misrepresentation</strong>: If the property is significantly different from the listing or unavailable upon move-in, a full refund of the token may be initiated after verification by the RentPe team.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">3. Non-Refundable Items</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Platform Service Fees</strong>: Fees charged for the use of our marketplace are non-refundable once the booking request is processed.</li>
                            <li><strong>Tenant Cancellation</strong>: Booking tokens are generally non-refundable if the Tenant decides not to move in for personal reasons.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">4. Owner Cancellation Policy</h2>
                        <p>Owners who cancel a confirmed booking without valid cause may be subject to penalties, including a deduction from future payouts and potential account suspension to maintain platform trust.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">5. Refund Processing Time</h2>
                        <p>Approved refunds are processed via the original payment method (Razorpay) and typically reflect in your account within <strong>5-7 business days</strong>.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">6. Dispute Resolution</h2>
                        <p>In case of any disagreement between the Tenant and Owner regarding refunds, RentPe acts as a neutral mediator. Our decision based on evidence (photos, messages) shall be final and binding.</p>
                    </section>

                </div>

                <div className="mt-12 pt-6 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <Link href="/terms" className="hover:text-blue-600 transition-colors">Terms of Service</Link>
                    <Link href="/privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</Link>
                    <Link href="/tenant-agreement" className="hover:text-blue-600 transition-colors">Tenant Agreement</Link>
                </div>
            </div>
        </div>
    );
}
