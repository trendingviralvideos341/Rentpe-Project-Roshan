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
                            <p>A Booking Token (₹99–₹499) is a small, refundable fee paid to temporarily reserve a bed while the owner reviews your request. It is held for a maximum of 72 hours.</p>
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
                                        ["Owner rejects your booking request", "100% Full Refund", "3–5 business days"],
                                        ["You cancel within 2 hours of token payment", "100% Full Refund", "3–5 business days"],
                                        ["You cancel after 2 hours but within 24 hours", "50% Refund", "3–5 business days"],
                                        ["You cancel after 24 hours", "No Refund", "—"],
                                        ["Owner confirms but you don't complete KYC in 48h", "Token Forfeited", "—"],
                                        ["RentPe technical error / double charge", "100% Full Refund", "3–5 business days"],
                                    ].map(([scenario, refund, timeline]) => (
                                        <tr key={scenario} className="border-b border-slate-100">
                                            <td className="border border-slate-200 px-4 py-2">{scenario}</td>
                                            <td className={`border border-slate-200 px-4 py-2 font-bold ${refund.includes("Full") ? "text-green-700" : refund.includes("50%") ? "text-yellow-700" : "text-red-600"}`}>{refund}</td>
                                            <td className="border border-slate-200 px-4 py-2 text-muted-foreground">{timeline}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4">2. Security Deposit</h2>
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
                                        ["Normal move-out with no dues", "100% Full Refund", "Within 7 days of move-out"],
                                        ["Minor damages agreed by owner", "Deducted. Balance Refunded", "Within 10 days"],
                                        ["Significant damage / unpaid rent", "Partially / Fully Deducted", "After dispute resolution"],
                                        ["Owner refuses refund without reason", "Escalate to RentPe Dispute — we mediate", "Within 14 days of complaint"],
                                    ].map(([scenario, refund, timeline]) => (
                                        <tr key={scenario} className="border-b border-slate-100">
                                            <td className="border border-slate-200 px-4 py-2">{scenario}</td>
                                            <td className="border border-slate-200 px-4 py-2 font-medium">{refund}</td>
                                            <td className="border border-slate-200 px-4 py-2 text-muted-foreground">{timeline}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">Security deposits are held by the property owner, not RentPe. RentPe acts as a mediator in disputes.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">3. Monthly Rent</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>Monthly rent, once paid, is <strong>non-refundable</strong> unless the property materially fails to match its listing.</li>
                            <li>If you move out mid-month with 30-day notice, the pro-rated amount for unused days may be refunded at the owner&apos;s discretion.</li>
                            <li>Disputes about rent refunds can be raised via our <strong>Support Ticket</strong> system and will be reviewed within 5 business days.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">4. Platform Fee</h2>
                        <p>RentPe&apos;s platform service fee (commission charged to owners) is <strong>non-refundable</strong> once a booking is confirmed. If a booking fails due to a RentPe system error, the fee will be fully refunded.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">5. Refund Process</h2>
                        <ol className="list-decimal pl-5 space-y-2">
                            <li>Raise a support ticket from your dashboard under <strong>Tickets → New Ticket</strong>.</li>
                            <li>Select category <strong>&ldquo;Refund Request&rdquo;</strong> and describe the issue with evidence.</li>
                            <li>Our team reviews within <strong>2 business days</strong>.</li>
                            <li>Approved refunds are processed to the <strong>original payment method</strong>.</li>
                            <li>Bank processing may take an additional 3–7 business days depending on your bank.</li>
                        </ol>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">6. Non-Refundable Items</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Background verification fee (once report is generated)</li>
                            <li>Premium listing fee paid by owners</li>
                            <li>Convenience / gateway charges if processed</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">7. Contact for Refunds</h2>
                        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                            <p><strong>Email:</strong> <a href="mailto:refunds@rentpe.in" className="text-blue-600 underline">refunds@rentpe.in</a></p>
                            <p className="mt-1"><strong>Support:</strong> Dashboard → Support Tickets</p>
                            <p className="mt-1 text-xs text-muted-foreground">Please include your Booking ID and payment reference for faster processing.</p>
                        </div>
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
