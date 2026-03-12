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
                        <h2 className="text-xl font-bold text-slate-900 mb-3">1. Introduction</h2>
                        <p>RentPe (&ldquo;Platform,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;) is an online marketplace operated by <strong>RentPe Technologies Private Limited</strong>. RentPe connects property owners (&ldquo;Owners&rdquo;) with students and working professionals (&ldquo;Tenants&rdquo;) seeking accommodation across India. We act as an intermediary and are not a party to any rental agreement between Owners and Tenants.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">2. User Eligibility</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Owners</strong>: Must be at least 18 years of age and legally authorized to list the property.</li>
                            <li><strong>Students/Tenants</strong>: Must be at least 18 years of age. Users under 18 may use the platform only with the involvement and consent of a parent or legal guardian.</li>
                            <li>By registering, you warrant that all information provided is accurate, current, and complete.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">3. Account Registration</h2>
                        <p>To access certain features, you must register for an account. You agree to provide accurate information and keep it updated. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">4. Property Listing Rules</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>All listings must be accurate, non-misleading, and represent the actual condition of the property.</li>
                            <li>Owners must have valid legal rights to lease or license the premises.</li>
                            <li>Fake listings, bait-and-switch pricing, or misrepresentation of amenities is strictly prohibited.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">5. Booking Process</h2>
                        <p>Bookings are subject to Owner approval. A booking token may be required to reserve a unit. RentPe facilitates the communication and payment but does not guarantee the availability or quality of any property.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">6. Platform Role Disclaimer</h2>
                        <p className="bg-amber-50 border-l-4 border-amber-400 p-4 italic">
                            RentPe is a marketplace. We do not own, manage, or operate any listed properties. Any rental agreement is strictly between the Owner and the Tenant. RentPe is not responsible for the conduct of any user or the condition of any property.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">7. Prohibited Activities</h2>
                        <p className="mb-2">You agree not to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Post fraudulent or illegal content.</li>
                            <li>Circumvent the platform to avoid paying service fees.</li>
                            <li>Harass or discriminate against other users.</li>
                            <li>Attempt to disrupt the platform's security or integrity.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">8. Account Suspension</h2>
                        <p>We reserve the right to suspend or terminate accounts that violate these terms, engage in suspicious activity, or receive repeated complaints from other users.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">9. Limitation of Liability</h2>
                        <p>To the maximum extent permitted by law, RentPe shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform or any property booked through it.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">10. Contact Information</h2>
                        <p>For legal inquiries, contact <a href="mailto:legal@rentpe.in" className="text-blue-600 underline">legal@rentpe.in</a>.</p>
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
