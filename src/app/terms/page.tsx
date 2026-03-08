import Link from "next/link";

export const metadata = {
    title: "Terms of Service | RentPe",
    description: "Read the Terms of Service for using the RentPe platform, your rights, obligations, and the rules that govern our marketplace.",
};

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-muted/20">
            <div className="max-w-4xl mx-auto px-4 py-12">
                {/* Header */}
                <div className="mb-10">
                    <div className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-4">Legal</div>
                    <h1 className="text-4xl font-black text-slate-900 mb-3">Terms of Service</h1>
                    <p className="text-muted-foreground text-sm">Effective Date: 08 March 2026 &nbsp;·&nbsp; Last Updated: 08 March 2026</p>
                    <p className="text-sm text-muted-foreground mt-2">
                        By accessing or using RentPe, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.
                    </p>
                </div>

                <div className="space-y-10 text-slate-700 leading-relaxed text-sm">

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">1. About RentPe</h2>
                        <p>RentPe (&ldquo;Platform,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;) is an online marketplace operated by <strong>RentPe Technologies Private Limited</strong>, a company incorporated under the Companies Act, 2013, with its registered office at 123 Startup Hub, Koramangala, Bengaluru, Karnataka – 560034, India.</p>
                        <p className="mt-2">RentPe connects property owners (&ldquo;Owners&rdquo;) with students and working professionals (&ldquo;Tenants&rdquo;) seeking accommodation across India. We act as an intermediary and are not a party to any rental agreement between Owners and Tenants.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">2. Eligibility</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>You must be at least 18 years of age to use RentPe.</li>
                            <li>You must be legally capable of entering into binding contracts under Indian law.</li>
                            <li>You must not be banned or suspended from the platform previously.</li>
                            <li>By registering, you warrant that all information provided is accurate, current, and complete.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">3. User Accounts</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
                            <li>You are responsible for all activities that occur under your account.</li>
                            <li>You must immediately notify us at <a href="mailto:support@rentpe.in" className="text-blue-600 underline">support@rentpe.in</a> of any unauthorized use.</li>
                            <li>One person may not maintain more than one account. Duplicate accounts will be terminated.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">4. Platform Rules — Tenants</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>You must complete KYC verification before confirming a booking.</li>
                            <li>You must not provide false information in your profile or booking form.</li>
                            <li>You must use the platform for genuine accommodation searches only.</li>
                            <li>You must pay the booking token to reserve a bed. Token is subject to our <Link href="/refund" className="text-blue-600 underline">Refund Policy</Link>.</li>
                            <li>You must respect property rules and other residents.</li>
                            <li>Reviews must be honest. False or defamatory reviews may result in account suspension.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">5. Platform Rules — Property Owners</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>All listings must be accurate, up-to-date, and legally owned or authorized for listing.</li>
                            <li>Owners must not list properties that are fraudulent, occupied, or not available.</li>
                            <li>Owners must complete their KYC and property document verification.</li>
                            <li>Owners must honour confirmed bookings. Frequent cancellations may lead to delisting.</li>
                            <li>Owners must not solicit payments outside the RentPe platform.</li>
                            <li>Owners agree to RentPe&apos;s commission structure as configured and may change with notice.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">6. Prohibited Conduct</h2>
                        <p className="mb-2">You must not:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Engage in fraudulent activity, misrepresentation, or impersonation.</li>
                            <li>Use bots, scrapers, or automated tools to extract data.</li>
                            <li>Post illegal, offensive, defamatory, or harmful content.</li>
                            <li>Circumvent the platform to transact directly to avoid fees.</li>
                            <li>Attempt to hack, reverse-engineer, or disrupt the platform.</li>
                            <li>Harass, threaten, or discriminate against any user.</li>
                        </ul>
                        <p className="mt-2">Violations may result in immediate account suspension and legal action under applicable Indian law.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">7. Payments & Fees</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>All payments are processed through our payment partner, Razorpay.</li>
                            <li>Platform fees and commissions are described at the time of transaction.</li>
                            <li>GST at 18% is applicable on platform service fees.</li>
                            <li>Payouts to Owners are processed weekly after deducting platform commissions.</li>
                            <li>RentPe uses Razorpay&apos;s secure payment infrastructure and does not store card data.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">8. Disclaimers & Limitation of Liability</h2>
                        <p>RentPe is an intermediary platform. We do not own, manage, or inspect any listed property. We are not responsible for:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>The condition or quality of listed properties.</li>
                            <li>Disputes between Tenants and Owners.</li>
                            <li>Loss or damage arising from a booking or stay.</li>
                            <li>Force majeure events beyond our control.</li>
                        </ul>
                        <p className="mt-2">Our maximum liability to you for any claim shall not exceed the platform fee you paid for the transaction in dispute.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">9. Intellectual Property</h2>
                        <p>All content on RentPe — including logo, brand, UI design, copy, and software — is owned by RentPe Technologies Private Limited. You may not copy, reproduce, or use any part without prior written consent.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">10. Governing Law & Dispute Resolution</h2>
                        <p>These Terms are governed by the laws of India. Any dispute arising shall be subject to the exclusive jurisdiction of courts in Bengaluru, Karnataka. We encourage resolution through our internal dispute process before legal action.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">11. Changes to Terms</h2>
                        <p>We may update these Terms at any time. Continued use of the platform after the update constitutes acceptance of the new Terms. We will notify registered users of material changes via email.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">12. Grievance Officer</h2>
                        <p>As required under the Information Technology Act, 2000 and its rules:</p>
                        <div className="mt-2 bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-1">
                            <p><strong>Name:</strong> Roshan (Grievance Officer, RentPe)</p>
                            <p><strong>Email:</strong> <a href="mailto:grievance@rentpe.in" className="text-blue-600 underline">grievance@rentpe.in</a></p>
                            <p><strong>Response Time:</strong> Within 30 days of receipt of complaint</p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">13. Contact</h2>
                        <p>For questions about these Terms, email us at <a href="mailto:legal@rentpe.in" className="text-blue-600 underline">legal@rentpe.in</a></p>
                    </section>

                </div>

                {/* Footer nav */}
                <div className="mt-12 pt-6 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <Link href="/privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</Link>
                    <Link href="/refund" className="hover:text-blue-600 transition-colors">Refund Policy</Link>
                    <Link href="/tenant-agreement" className="hover:text-blue-600 transition-colors">Tenant Agreement</Link>
                    <Link href="/cookie-policy" className="hover:text-blue-600 transition-colors">Cookie Policy</Link>
                </div>
            </div>
        </div>
    );
}
