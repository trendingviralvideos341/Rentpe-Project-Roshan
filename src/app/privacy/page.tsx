import Link from "next/link";

export const metadata = {
    title: "Privacy Policy | RentPe",
    description: "Learn how RentPe collects, uses, stores, and protects your personal data in compliance with India's Digital Personal Data Protection Act, 2023.",
};

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-muted/20">
            <div className="max-w-4xl mx-auto px-4 py-12">
                <div className="mb-10">
                    <div className="inline-block bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-4">Legal</div>
                    <h1 className="text-4xl font-black text-slate-900 mb-3">Privacy Policy</h1>
                    <p className="text-muted-foreground text-sm">Effective Date: 12 March 2026 &nbsp;·&nbsp; Last Updated: 12 March 2026</p>
                    <p className="text-sm text-muted-foreground mt-2">
                        This Privacy Policy explains how RentPe Technologies Private Limited collects, uses, shares, and protects your personal data in compliance with the <strong>Digital Personal Data Protection Act, 2023 (DPDPA)</strong> and the <strong>Information Technology Act, 2000</strong>.
                    </p>
                </div>

                <div className="space-y-10 text-slate-700 leading-relaxed text-sm">

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">1. Information Collected</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Personal Details</strong>: Name, email, mobile number, and city.</li>
                            <li><strong>Identity Documents</strong>: Government-issued IDs (Aadhaar/PAN) for KYC verification.</li>
                            <li><strong>Location Data</strong>: Property location for listings and search optimization.</li>
                            <li><strong>Usage Data</strong>: Device information, IP addresses, and browsing behavior.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">2. Purpose of Data Usage</h2>
                        <p>We use your data to facilitate bookings, verify identities, process payments, and improve platform security. Specifically, we use it to:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Verify owner authority to list properties.</li>
                            <li>Enable tenants to request and confirm bookings.</li>
                            <li>Send transactional notifications (OTP, booking alerts).</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">3. Data Sharing Between Users</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li><strong>Tenant to Owner</strong>: When a tenant requests a booking, their verified profile (excluding sensitive document numbers) is shared with the Owner to facilitate background checks.</li>
                            <li><strong>Owner to Tenant</strong>: Property details and verified owner business profiles are shared with potential tenants to build trust and facilitate bookings.</li>
                            <li><strong>RentPe Business</strong>: Owner profiles are shared with our business verification team to ensure listing authenticity.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">4. Security Measures</h2>
                        <p>We employ end-to-end encryption (TLS) for data in transit and AES-256 for sensitive documents at rest. Access is restricted via Role-Based Access Control (RBAC) to ensure only authorized personnel can view sensitive data.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">5. Cookies</h2>
                        <p>We use essential cookies to maintain user sessions and security. Non-essential cookies for analytics are optional and can be managed in your browser settings. For more details, see our <Link href="/cookie-policy" className="text-blue-600 underline">Cookie Policy</Link>.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">6. Grievance Redressal</h2>
                        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                            <p><strong>Grievance Officer</strong>: Roshan</p>
                            <p><strong>Email</strong>: <a href="mailto:privacy@rentpe.in" className="text-blue-600 underline">privacy@rentpe.in</a></p>
                            <p className="mt-2 text-xs text-muted-foreground">We aim to respond to all queries and grievances within 30 days.</p>
                        </div>
                    </section>

                </div>

                <div className="mt-12 pt-6 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <Link href="/terms" className="hover:text-blue-600 transition-colors">Terms of Service</Link>
                    <Link href="/refund" className="hover:text-blue-600 transition-colors">Refund Policy</Link>
                    <Link href="/safety" className="hover:text-blue-600 transition-colors">Safety Disclaimer</Link>
                </div>
            </div>
        </div>
    );
}
