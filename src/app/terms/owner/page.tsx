import { Metadata } from "next";
import Link from "next/link";
import { Building2, ArrowLeft, AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
    title: "Property Owner Terms & Conditions | RentPe",
    description: "Read the full Terms and Conditions for Property Owners listing on the RentPe platform.",
};

export default function OwnerTermsPage() {
    const lastUpdated = "March 20, 2026";
    const version = "v1.0";

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-emerald-900 text-white py-12 px-6">
                <div className="max-w-4xl mx-auto">
                    <Link href="/" className="inline-flex items-center gap-2 text-emerald-300 hover:text-white transition-colors mb-6 text-sm font-semibold">
                        <ArrowLeft className="w-4 h-4" /> Back to RentPe
                    </Link>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-white/10 rounded-2xl"><Building2 className="w-7 h-7 text-emerald-300" /></div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Legal Document</p>
                            <h1 className="text-3xl font-extrabold">Property Owner Terms & Conditions</h1>
                        </div>
                    </div>
                    <p className="text-emerald-200 text-sm">Version: {version} &bull; Last Updated: {lastUpdated}</p>
                    <div className="mt-4 bg-amber-500/20 border border-amber-400/30 rounded-xl p-4">
                        <p className="text-amber-200 text-sm font-semibold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            By listing a property on RentPe, you confirm that you have read, understood, and agreed to these Terms & Conditions.
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">

                {/* Section 1 */}
                <section>
                    <h2 className="text-xl font-black text-slate-900 mb-4 border-l-4 border-emerald-500 pl-4">1. Platform Role & Owner Relationship</h2>
                    <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                        <p><strong>1.1 Marketplace Model.</strong> RentPe operates as a technology marketplace. You, as the property owner (PG/hostel operator), are an independent service provider. RentPe is not your employee, agent, or co-owner of your property.</p>
                        <p><strong>1.2 Listing as Advertisement.</strong> Your property listing on RentPe constitutes an advertisement/offer for accommodation services. All commitments made in the listing are your sole responsibility.</p>
                        <p><strong>1.3 Independent Operator.</strong> You are fully responsible for the management, maintenance, safety, and legal compliance of your property, including obtaining all necessary licences and permits under applicable local/state laws.</p>
                        <p><strong>1.4 Non-Exclusivity.</strong> Listing on RentPe does not restrict you from listing on other platforms, and RentPe may list competing properties in your area.</p>
                    </div>
                </section>

                {/* Section 2 */}
                <section>
                    <h2 className="text-xl font-black text-slate-900 mb-4 border-l-4 border-emerald-500 pl-4">2. Listing Requirements & Accuracy</h2>
                    <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                        <p><strong>2.1 Truthful Listings.</strong> All information provided in your property listing must be accurate, complete, and current. Misrepresentation of property details (photos, amenities, pricing, location) is a breach of these Terms and may result in immediate de-listing.</p>
                        <p><strong>2.2 No Duplicate/Fake Listings.</strong> You are prohibited from creating duplicate, fictitious, or fraudulent property listings. Each property must be a real, distinct property under your lawful ownership or management authority.</p>
                        <p><strong>2.3 Mandatory Documents.</strong> You must upload valid, government-recognized documents to list a property:</p>
                        <ul className="ml-6 list-disc space-y-1">
                            <li>Aadhaar Card (Front & Back) — identity verification</li>
                            <li>PAN Card — tax compliance</li>
                            <li>Trade Licence / GOVT Permit — required for commercial PG operations</li>
                            <li>Current Photograph — identity confirmation</li>
                            <li>Property photographs — building exterior, rooms, common areas, parking</li>
                        </ul>
                        <p><strong>2.4 Licence Compliance.</strong> Operating a PG/hostel in India typically requires Municipal Trade Licence, Fire NOC (buildings with more than 15 residents in many states), and compliance with local building regulations. You represent and warrant that your property has all required clearances.</p>
                        <p><strong>2.5 GST Registration.</strong> If your annual aggregate turnover from PG services exceeds ₹20 lakh (₹10 lakh for special category states), you are required to register under GST as per the CGST Act, 2017. For short-stay accommodation (under 90 days or rent over ₹20,000/month), GST at 12% may apply. You are solely responsible for your GST compliance.</p>
                    </div>
                </section>

                {/* Section 3 */}
                <section>
                    <h2 className="text-xl font-black text-slate-900 mb-4 border-l-4 border-emerald-500 pl-4">3. Security Deposit Rules (MTA 2021 Compliant)</h2>
                    <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                        <p><strong>3.1 Deposit Cap.</strong> In accordance with the Model Tenancy Act, 2021 (Section 11), the security deposit for residential premises shall not exceed <strong>two months' rent</strong>. RentPe enforces this cap: you may set deposit at 1 month or 2 months only.</p>
                        <p><strong>3.2 Mandatory Selection.</strong> When assigning a room to a tenant, you MUST select the deposit multiplier (1 month or 2 months). This cannot be skipped.</p>
                        <p><strong>3.3 Permitted Deductions Only.</strong> You may deduct from the security deposit ONLY for the following, with written documentation:</p>
                        <ul className="ml-6 list-disc space-y-1">
                            <li>Physical damage to the property caused by the tenant (beyond normal wear and tear)</li>
                            <li>Unpaid rent or dues outstanding at the time of vacating</li>
                            <li>Unreturned or damaged property assets (furniture, equipment, keys)</li>
                        </ul>
                        <p><strong>3.4 No Wear & Tear Deductions.</strong> You are expressly prohibited from deducting for normal wear and tear, which includes: fading of paint, minor scuffs, worn carpets from normal use, or minor tarnishing. This is consistent with established Indian consumer protection principles.</p>
                        <p><strong>3.5 Refund Obligation.</strong> The security deposit (or balance after valid deductions) MUST be refunded within <strong>30 days</strong> of the tenant vacating and handing over possession.</p>
                        <p><strong>3.6 Written Deductions.</strong> For any deduction from the deposit, you must provide the tenant with a written itemized breakdown through the RentPe platform, specifying the amount and reason for each deduction.</p>
                        <p><strong>3.7 Dispute Risk.</strong> Failure to follow these deposit rules may result in RentPe-mediated disputes, platform penalties, or legal action by the tenant under consumer protection laws.</p>
                    </div>
                </section>

                {/* Section 4 */}
                <section>
                    <h2 className="text-xl font-black text-slate-900 mb-4 border-l-4 border-emerald-500 pl-4">4. Booking Obligations</h2>
                    <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                        <p><strong>4.1 Honor Confirmed Bookings.</strong> Once a booking is confirmed and payment is received through RentPe, you are obligated to honor the booking and provide the accommodation as listed.</p>
                        <p><strong>4.2 No Arbitrary Cancellations.</strong> Cancelling confirmed bookings to take a higher-paying tenant is a serious violation of these Terms and may result in account suspension and financial penalties.</p>
                        <p><strong>4.3 Property Standards.</strong> The accommodation provided must meet the standards shown in the listing photos and description. Misrepresentation is grounds for dispute and de-listing.</p>
                    </div>
                </section>

                {/* Section 5 */}
                <section>
                    <h2 className="text-xl font-black text-slate-900 mb-4 border-l-4 border-amber-500 pl-4">5. Platform Fees & Revenue Sharing</h2>
                    <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                        <p><strong>5.1 Onboarding Fee.</strong> A one-time onboarding/activation fee is charged when your property is approved and listed on RentPe. The current fee is displayed during the onboarding process.</p>
                        <p><strong>5.2 Rent Commission Fee.</strong> A monthly platform facilitation fee is deducted from the rent amount received by you, as shown in the Revenue & Fees panel. For example: if the student pays ₹5,000 rent and the Owner Fee is ₹9, you receive ₹4,991.</p>
                        <p><strong>5.3 Fee Transparency.</strong> All fees are shown clearly in your Revenue & Fees admin panel with live previews. Platform fee may vary from time to time. Updated charges will be communicated at least <strong>7 days in advance</strong> via email and in-app notification.</p>
                        <p><strong>5.4 GST on Platform Fees.</strong> Platform service fees (commissions) attract 18% GST, which is RentPe's obligation to collect and remit to the government. This is separate from your own GST obligations on rental income.</p>
                        <p><strong>5.5 Payout Schedule.</strong> Revenue will be disbursed to your registered bank account as per RentPe's payout schedule displayed in your dashboard.</p>
                    </div>
                </section>

                {/* Section 6 */}
                <section>
                    <h2 className="text-xl font-black text-slate-900 mb-4 border-l-4 border-red-500 pl-4">6. Prohibited Activities</h2>
                    <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                        <p><strong>6.1 The following are strictly prohibited:</strong></p>
                        <ul className="ml-6 list-disc space-y-1">
                            <li>Listing properties you do not own or are not authorized to let</li>
                            <li>Charging tenants undisclosed fees outside the RentPe platform</li>
                            <li>Discriminating against tenants on the basis of gender, religion, caste, or nationality (as prohibited under Indian law)</li>
                            <li>Sharing tenant personal data with third parties without consent</li>
                            <li>Attempting to move transactions off-platform to avoid fees</li>
                            <li>Creating fake reviews or engaging in manipulation of the review system</li>
                            <li>Operating the property in violation of applicable laws</li>
                        </ul>
                    </div>
                </section>

                {/* Section 7 */}
                <section>
                    <h2 className="text-xl font-black text-slate-900 mb-4 border-l-4 border-red-500 pl-4">7. Platform Rights & Enforcement</h2>
                    <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                        <p><strong>7.1 Verification.</strong> RentPe reserves the right to verify the authenticity of all uploaded documents and property details, including conducting physical inspections.</p>
                        <p><strong>7.2 Suspension & Removal.</strong> RentPe may suspend, de-list, or permanently ban your account and listings for: fraudulent listings, document fraud, breach of these Terms, repeated tenant complaints, or any legal violation.</p>
                        <p><strong>7.3 No Guarantee.</strong> RentPe does not guarantee a minimum number of bookings or a specific revenue level for your property.</p>
                        <p><strong>7.4 Platform Modifications.</strong> RentPe may at any time modify the platform features, fee structure, or listing requirements. Material changes will be communicated in advance.</p>
                        <p><strong>7.5 Audit Rights.</strong> RentPe may audit listing information and booking data for compliance purposes. All activities on the platform are logged in our audit system.</p>
                    </div>
                </section>

                {/* Section 8 */}
                <section>
                    <h2 className="text-xl font-black text-slate-900 mb-4 border-l-4 border-slate-500 pl-4">8. Indemnification & Liability</h2>
                    <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                        <p><strong>8.1 Owner Indemnifies Platform.</strong> You agree to indemnify and hold harmless RentPe, its directors, officers, and employees from any claims, damages, or losses arising from: inaccurate listings, failure to honor bookings, deposit disputes, property-related accidents or damage, or your violations of Indian law.</p>
                        <p><strong>8.2 Platform Not Liable for Tenants.</strong> RentPe is not liable for the actions of tenants, including non-payment of rent, property damage, or antisocial behavior beyond facilitation of bookings.</p>
                    </div>
                </section>

                {/* Section 9 */}
                <section>
                    <h2 className="text-xl font-black text-slate-900 mb-4 border-l-4 border-slate-500 pl-4">9. Governing Law</h2>
                    <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                        <p><strong>9.1</strong> These Terms are governed by Indian law, including the Model Tenancy Act, 2021, the Consumer Protection Act, 2019, the CGST Act, 2017, and applicable State legislation.</p>
                        <p><strong>9.2 Contact:</strong> <strong>legal@rentpe.in</strong></p>
                    </div>
                </section>

                {/* Footer note */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6">
                    <p className="text-center text-sm text-emerald-700 font-semibold">By listing a property on RentPe, you confirm you have read and accepted these Owner Terms & Conditions (Version {version}, updated {lastUpdated}).</p>
                    <p className="text-center text-xs text-slate-500 mt-2">For Student/Tenant Terms, see: <Link href="/terms/tenant" className="text-emerald-600 underline">Tenant Terms & Conditions</Link></p>
                </div>
            </div>
        </div>
    );
}
