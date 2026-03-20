import { Metadata } from "next";
import Link from "next/link";
import { Shield, ArrowLeft, AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
    title: "Student & Tenant Terms & Conditions | RentPe",
    description: "Read the full Terms and Conditions for Students and Tenants using the RentPe platform.",
};

export default function TenantTermsPage() {
    const lastUpdated = "March 20, 2026";
    const version = "v1.0";

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-indigo-900 text-white py-12 px-6">
                <div className="max-w-4xl mx-auto">
                    <Link href="/" className="inline-flex items-center gap-2 text-indigo-300 hover:text-white transition-colors mb-6 text-sm font-semibold">
                        <ArrowLeft className="w-4 h-4" /> Back to RentPe
                    </Link>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-white/10 rounded-2xl"><Shield className="w-7 h-7 text-indigo-300" /></div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-300">Legal Document</p>
                            <h1 className="text-3xl font-extrabold">Student & Tenant Terms & Conditions</h1>
                        </div>
                    </div>
                    <p className="text-indigo-200 text-sm">Version: {version} &bull; Last Updated: {lastUpdated}</p>
                    <div className="mt-4 bg-amber-500/20 border border-amber-400/30 rounded-xl p-4">
                        <p className="text-amber-200 text-sm font-semibold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            By registering on RentPe, you confirm that you have read, understood, and agreed to these Terms & Conditions.
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">

                {/* Section 1 */}
                <section>
                    <h2 className="text-xl font-black text-slate-900 mb-4 border-l-4 border-indigo-500 pl-4">1. Platform Nature & Scope</h2>
                    <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                        <p><strong>1.1 Marketplace Only.</strong> RentPe is a technology-enabled marketplace platform that connects property owners (PG/hostel operators) with potential tenants/students. RentPe is NOT a property owner, landlord, or lessor of any listed property.</p>
                        <p><strong>1.2 No Direct Control.</strong> RentPe does not own, manage, control, or operate any of the properties listed on the platform. All contractual obligations, including maintenance, service delivery, and dispute resolution, remain between the tenant and the property owner.</p>
                        <p><strong>1.3 Intermediary Status.</strong> RentPe operates as an Information Technology Intermediary under the Information Technology Act, 2000 (as amended) and the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.</p>
                        <p><strong>1.4 Geographic Scope.</strong> The platform currently operates in India and is subject to Indian laws, including the Model Tenancy Act, 2021 (MTA), applicable State Tenancy Acts, and GST Regulations.</p>
                    </div>
                </section>

                {/* Section 2 */}
                <section>
                    <h2 className="text-xl font-black text-slate-900 mb-4 border-l-4 border-indigo-500 pl-4">2. Eligibility & Registration</h2>
                    <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                        <p><strong>2.1 Age Requirement.</strong> You must be at least 18 years of age to register on RentPe. If you are a student below 18, parental or guardian consent is mandatory.</p>
                        <p><strong>2.2 Accurate Information.</strong> You agree to provide accurate, current, and complete information during registration, KYC verification, and the booking process. Providing false information is grounds for immediate account suspension.</p>
                        <p><strong>2.3 One Account Per Person.</strong> Each user is permitted a single account. Creating multiple accounts to circumvent platform restrictions is strictly prohibited and will result in permanent ban.</p>
                        <p><strong>2.4 Mandatory Acceptance.</strong> Acceptance of these Terms is mandatory to create an account. This acceptance is recorded with a timestamp in our system and is legally binding.</p>
                        <p><strong>2.5 KYC Compliance.</strong> You agree to submit valid government-issued identity documents (Aadhaar, Passport, etc.) for KYC verification as required by the property owner or RentPe.</p>
                    </div>
                </section>

                {/* Section 3 */}
                <section>
                    <h2 className="text-xl font-black text-slate-900 mb-4 border-l-4 border-indigo-500 pl-4">3. Booking & Payment Obligations</h2>
                    <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                        <p><strong>3.1 Payment Commitment.</strong> Upon confirming a booking, you are obligated to pay the full booking amount, security deposit, and applicable platform fees as clearly shown in the payment breakdown.</p>
                        <p><strong>3.2 Rent Payment.</strong> Monthly rent must be paid by the due date as agreed with the property owner. Late payment may attract penalties as per the property's terms.</p>
                        <p><strong>3.3 Security Deposit (MTA 2021 Compliant).</strong> A refundable security deposit of 1 to 2 months' rent (as set by the property owner) will be collected at the time of booking:</p>
                        <ul className="ml-6 list-disc space-y-1">
                            <li>Minimum Deposit: 1 month's rent</li>
                            <li>Maximum Deposit: 2 months' rent (as per Model Tenancy Act, 2021 — Section 11 cap for residential premises)</li>
                            <li>The deposit is <strong>fully refundable</strong> subject to Section 7 of these Terms (Deposit Refund Policy)</li>
                        </ul>
                        <p><strong>3.4 Platform Fee.</strong> A non-refundable platform facilitation fee is charged per booking as displayed before payment. This fee covers digital platform services and may vary. Updated fees will be communicated with 7 days' advance notice.</p>
                        <p><strong>3.5 GST Disclosure.</strong> Platform service fees attract 18% GST as per applicable Indian tax law. Accommodation rent at or below ₹20,000/month for stays of 90+ days may be exempt from GST per CBIC Circular No. 228/22/2024-GST (effective July 15, 2024). RentPe will display applicable tax components in your payment breakdown.</p>
                        <p><strong>3.6 Token Amount.</strong> A non-refundable token amount may be required to confirm your room reservation, valid for the duration displayed on the booking screen.</p>
                    </div>
                </section>

                {/* Section 4 */}
                <section>
                    <h2 className="text-xl font-black text-slate-900 mb-4 border-l-4 border-indigo-500 pl-4">4. Tenant Responsibilities</h2>
                    <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                        <p><strong>4.1 Property Care.</strong> You must maintain the property and your assigned room in good condition. You are responsible for any willful damage or damage caused by negligence beyond normal wear and tear.</p>
                        <p><strong>4.2 House Rules.</strong> You must comply with the property-specific rules displayed in the Property Agreement, including but not limited to: visiting hours, food policies, noise restrictions, and common area usage.</p>
                        <p><strong>4.3 No Subletting.</strong> You are strictly prohibited from subletting, transferring, or assigning your accommodation without the written consent of the property owner.</p>
                        <p><strong>4.4 Notice Period.</strong> You must give the required notice period (as specified in the Property Agreement, typically 30 days) before vacating. Failure to do so may result in forfeiture of deposit or additional rent charges.</p>
                        <p><strong>4.5 Prohibited Activities.</strong> The following are strictly prohibited: possession of illegal substances, vandalism, harassment of other residents or staff, unauthorized modifications to the property, and any activity that violates Indian law.</p>
                    </div>
                </section>

                {/* Section 5 */}
                <section>
                    <h2 className="text-xl font-black text-slate-900 mb-4 border-l-4 border-emerald-500 pl-4">5. Property Agreement (Per Booking)</h2>
                    <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                        <p><strong>5.1 Mandatory Agreement.</strong> Before confirming payment for any property booking, you must review and explicitly accept a Property-Specific Agreement that contains the rules, rent, deposit, and refund policy for that property.</p>
                        <p><strong>5.2 Digital Acceptance.</strong> Your digital click of "I Agree to Property Terms" constitutes a valid electronic acceptance under the Information Technology Act, 2000.</p>
                        <p><strong>5.3 Agreement Contents.</strong> The Property Agreement will include: rent amount, security deposit amount and months, notice period required, visitor policies, food timing, move-out procedure, and the specific refund policy of the property.</p>
                    </div>
                </section>

                {/* Section 6 */}
                <section>
                    <h2 className="text-xl font-black text-slate-900 mb-4 border-l-4 border-emerald-500 pl-4">6. Refund & Cancellation Policy</h2>
                    <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                        <p><strong>6.1 Platform Fee.</strong> Platform facilitation fees are strictly non-refundable once a booking is confirmed.</p>
                        <p><strong>6.2 Token Amount.</strong> Token amounts are non-refundable if the tenant cancels after the reservation window expires.</p>
                        <p><strong>6.3 Booking Cancellation.</strong> Cancellation refunds are subject to the Property's cancellation policy as displayed in the Property Agreement at the time of booking.</p>
                    </div>
                </section>

                {/* Section 7 */}
                <section>
                    <h2 className="text-xl font-black text-slate-900 mb-4 border-l-4 border-amber-500 pl-4">7. Security Deposit Refund Policy (MTA 2021)</h2>
                    <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                        <p><strong>7.1 Full Refund Entitlement.</strong> You are entitled to a full refund of your security deposit upon vacating the property, subject to the deductions listed below.</p>
                        <p><strong>7.2 Permitted Deductions Only.</strong> The property owner may deduct from the security deposit ONLY for:</p>
                        <ul className="ml-6 list-disc space-y-1">
                            <li>Documented physical damage to property caused by the tenant (beyond normal wear and tear)</li>
                            <li>Unpaid rent or dues outstanding at the time of vacating</li>
                            <li>Unreturned property keys, cards, or equipment</li>
                        </ul>
                        <p><strong>7.3 Normal Wear & Tear.</strong> Deductions CANNOT be made for normal wear and tear of the property as per established PG industry practices and consumer protection principles under Indian law.</p>
                        <p><strong>7.4 Written Explanation Required.</strong> The property owner MUST provide a written reason for any and all deductions from the security deposit before processing the refund.</p>
                        <p><strong>7.5 Refund Timeline.</strong> The security deposit (or remaining balance after deductions) must be refunded within <strong>30 days</strong> of the tenant vacating and handing over possession of the room/property.</p>
                        <p><strong>7.6 Dispute Escalation.</strong> If you believe a deduction is unjust, you may raise a dispute through RentPe's Resolution Center. RentPe may assist in mediation but is not financially liable for the outcome.</p>
                    </div>
                </section>

                {/* Section 8 */}
                <section>
                    <h2 className="text-xl font-black text-slate-900 mb-4 border-l-4 border-red-500 pl-4">8. Platform Rights & Enforcement</h2>
                    <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                        <p><strong>8.1 Account Suspension.</strong> RentPe reserves the right to suspend or permanently ban user accounts for: providing false information, fraud, repeated policy violations, harassment, or legal violations.</p>
                        <p><strong>8.2 Fee Changes.</strong> RentPe may revise platform fees at any time. Changes will be communicated via email and/or in-app notification at least <strong>7 days</strong> in advance.</p>
                        <p><strong>8.3 Policy Updates.</strong> These Terms may be updated from time to time. Continued use of the platform constitutes acceptance of the updated Terms. Major changes will trigger a re-acceptance prompt.</p>
                        <p><strong>8.4 Data Usage.</strong> By registering, you consent to RentPe processing your personal data as described in our Privacy Policy, including sharing relevant booking details with property owners.</p>
                    </div>
                </section>

                {/* Section 9 */}
                <section>
                    <h2 className="text-xl font-black text-slate-900 mb-4 border-l-4 border-red-500 pl-4">9. Limitation of Liability</h2>
                    <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                        <p><strong>9.1 Platform Not Liable.</strong> RentPe is not liable for: the condition of listed properties, actions of property owners or other tenants, loss of personal belongings, injury, or any indirect/consequential damages arising from the use of the platform.</p>
                        <p><strong>9.2 Dispute Mediation.</strong> RentPe may voluntarily assist in mediating disputes between tenants and owners but bears no legal obligation or financial liability for dispute outcomes.</p>
                        <p><strong>9.3 Force Majeure.</strong> RentPe shall not be liable for delays or failures in performance resulting from acts of nature, government actions, pandemic, or other circumstances beyond its reasonable control.</p>
                    </div>
                </section>

                {/* Section 10 */}
                <section>
                    <h2 className="text-xl font-black text-slate-900 mb-4 border-l-4 border-slate-500 pl-4">10. Governing Law & Dispute Resolution</h2>
                    <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
                        <p><strong>10.1 Governing Law.</strong> These Terms are governed by the laws of India, including the Model Tenancy Act, 2021, the Consumer Protection Act, 2019, the Information Technology Act, 2000, and applicable GST laws.</p>
                        <p><strong>10.2 Jurisdiction.</strong> Any disputes arising from these Terms shall be subject to the jurisdiction of competent courts in Bangalore, Karnataka, India.</p>
                        <p><strong>10.3 Contact.</strong> For queries regarding these Terms, contact: <strong>legal@rentpe.in</strong></p>
                    </div>
                </section>

                {/* Footer note */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
                    <p className="text-center text-sm text-indigo-700 font-semibold">By creating an account on RentPe, you confirm you have read and accepted these Terms & Conditions (Version {version}, updated {lastUpdated}).</p>
                    <p className="text-center text-xs text-slate-500 mt-2">For Owner Terms, see: <Link href="/terms/owner" className="text-indigo-600 underline">Owner Terms & Conditions</Link></p>
                </div>
            </div>
        </div>
    );
}
