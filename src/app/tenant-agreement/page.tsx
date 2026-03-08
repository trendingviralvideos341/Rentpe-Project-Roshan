import Link from "next/link";

export const metadata = {
    title: "Tenant Agreement | RentPe",
    description: "Standard Tenant–Owner accommodation agreement template used on the RentPe platform.",
};

export default function TenantAgreementPage() {
    return (
        <div className="min-h-screen bg-muted/20">
            <div className="max-w-4xl mx-auto px-4 py-12">
                <div className="mb-10">
                    <div className="inline-block bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-4">Legal</div>
                    <h1 className="text-4xl font-black text-slate-900 mb-3">Tenant Accommodation Agreement</h1>
                    <p className="text-muted-foreground text-sm">Template version: v1.0 · Effective: 08 March 2026</p>
                    <div className="mt-4 bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm text-purple-800">
                        <strong>Note:</strong> This is the standard accommodation agreement template used on the RentPe platform between property owners and tenants. A digitally signed copy is generated at the time of booking confirmation and shared with both parties via email.
                    </div>
                </div>

                <div className="space-y-10 text-slate-700 leading-relaxed text-sm">

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">Parties to this Agreement</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                <p className="font-bold text-blue-800 mb-2">Party A — Licensor (Owner)</p>
                                <p>Name: [Owner Full Name]</p>
                                <p>Property: [Property Name, Address, City]</p>
                                <p>Contact: [Owner Phone]</p>
                                <p>PAN / Aadhaar: [Verified on RentPe]</p>
                            </div>
                            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                                <p className="font-bold text-green-800 mb-2">Party B — Licensee (Tenant)</p>
                                <p>Name: [Tenant Full Name]</p>
                                <p>ID: [RentPe Tenant ID]</p>
                                <p>Contact: [Tenant Phone]</p>
                                <p>KYC: [Verified on RentPe]</p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">1. License to Occupy</h2>
                        <p>The Owner (Party A) grants the Tenant (Party B) a revocable, non-exclusive <strong>license to occupy</strong> the specified room/bed at the property address for the duration specified in the booking. This is a <strong>leave and license agreement</strong> and does not create a tenancy or leasehold interest under the Transfer of Property Act, 1882.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">2. Term of Agreement</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Move-In Date:</strong> As confirmed by the RentPe platform</li>
                            <li><strong>Minimum Stay:</strong> As agreed (typically 1 month minimum)</li>
                            <li><strong>Notice to Vacate:</strong> 30 calendar days written notice required from either party</li>
                            <li>Agreement auto-renews monthly unless terminated with notice</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">3. Rent & Payments</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Monthly Rent:</strong> As listed on the RentPe property page</li>
                            <li><strong>Due Date:</strong> 5th of every calendar month</li>
                            <li><strong>Payment Method:</strong> Via RentPe platform (UPI / Card / NetBanking)</li>
                            <li><strong>Late Fee:</strong> ₹100/day after 5-day grace period</li>
                            <li>Rent receipts/invoices are generated automatically on the RentPe platform</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">4. Security Deposit</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Typically 1–2 months rent as specified in the listing</li>
                            <li>Refundable within 7 days of move-out subject to property inspection</li>
                            <li>Deductions may be made for unpaid dues or property damage beyond normal wear and tear</li>
                            <li>Owner must provide itemised deduction statement if returning less than full deposit</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">5. Inclusions</h2>
                        <p>Services included in monthly rent are as specified on the property listing and may include:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1 columns-2">
                            <li>Furnished bed & storage</li>
                            <li>WiFi (if included)</li>
                            <li>Meals (if included)</li>
                            <li>Electricity (if included)</li>
                            <li>Water supply</li>
                            <li>Common area housekeeping</li>
                            <li>Security / CCTV</li>
                            <li>Laundry (if included)</li>
                        </ul>
                        <p className="mt-2 text-xs text-muted-foreground">Any additional charges beyond what is listed must be agreed in writing through the RentPe platform.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">6. Tenant Obligations</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Maintain the room in clean, hygienic condition</li>
                            <li>Not sublet or share the accommodation without owner&apos;s consent</li>
                            <li>Not cause damage to property, furniture, or shared facilities</li>
                            <li>Comply with property timings, visitor policies, and house rules</li>
                            <li>Not engage in illegal activities on the premises</li>
                            <li>Vacate peacefully on the agreed date after providing notice</li>
                            <li>Allow the owner/staff access for maintenance with reasonable notice</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">7. Owner Obligations</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Provide accommodation as described and listed on RentPe</li>
                            <li>Maintain premises in a safe, habitable condition</li>
                            <li>Address maintenance requests within a reasonable timeframe</li>
                            <li>Not enter the tenant&apos;s room without prior notice (except emergencies)</li>
                            <li>Provide official rent receipts for all payments received</li>
                            <li>Return security deposit within 7 days of move-out</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">8. Termination</h2>
                        <p>Either party may terminate this agreement with <strong>30 days written notice</strong> communicated through the RentPe platform. Immediate termination (with no notice) is allowed if:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>The tenant engages in illegal or seriously disruptive behaviour</li>
                            <li>The owner makes the property uninhabitable</li>
                            <li>Either party breaches any material term of this agreement</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">9. Dispute Resolution</h2>
                        <p>In case of disputes, both parties agree to first attempt resolution through RentPe&apos;s dispute mediation system. If unresolved, disputes shall be referred to arbitration in Bengaluru under the Arbitration and Conciliation Act, 1996.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">10. Governing Law</h2>
                        <p>This agreement is governed by the laws of India. Courts in Bengaluru, Karnataka shall have exclusive jurisdiction.</p>
                    </section>

                    <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-6 text-center">
                        <p className="font-bold text-slate-700 mb-1">✍️ Digital Agreement Execution</p>
                        <p className="text-sm text-muted-foreground">Both parties digitally accept this agreement through the RentPe platform at the time of booking confirmation. A timestamped copy is stored and accessible from each party&apos;s dashboard.</p>
                    </div>

                </div>

                <div className="mt-12 pt-6 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <Link href="/terms" className="hover:text-blue-600 transition-colors">Terms of Service</Link>
                    <Link href="/privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</Link>
                    <Link href="/refund" className="hover:text-blue-600 transition-colors">Refund Policy</Link>
                </div>
            </div>
        </div>
    );
}
