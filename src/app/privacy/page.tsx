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
                    <p className="text-muted-foreground text-sm">Effective Date: 08 March 2026 &nbsp;·&nbsp; Last Updated: 08 March 2026</p>
                    <p className="text-sm text-muted-foreground mt-2">
                        This Privacy Policy explains how RentPe Technologies Private Limited collects, uses, shares, and protects your personal data in compliance with the <strong>Digital Personal Data Protection Act, 2023 (DPDPA)</strong> and the <strong>Information Technology Act, 2000</strong>.
                    </p>
                </div>

                <div className="space-y-10 text-slate-700 leading-relaxed text-sm">

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">1. What Data We Collect</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-100">
                                        <th className="border border-slate-200 px-4 py-2 text-left font-bold">Category</th>
                                        <th className="border border-slate-200 px-4 py-2 text-left font-bold">Data Points</th>
                                        <th className="border border-slate-200 px-4 py-2 text-left font-bold">Purpose</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        ["Identity", "Name, email, phone, date of birth, gender, photo", "Account creation, KYC, communication"],
                                        ["Identity Documents", "Aadhaar, PAN, Passport, Driving Licence", "KYC verification (mandatory for booking)"],
                                        ["Financial", "Bank account details, UPI ID, payment history", "Owner payouts, refund processing"],
                                        ["Location", "City, area, property coordinates", "Search, discovery, onboarding"],
                                        ["Device & Usage", "IP address, browser type, device ID, pages visited", "Security, fraud detection, analytics"],
                                        ["Communication", "Support ticket content, chat messages", "Customer service"],
                                        ["Booking Data", "Property visited, booking dates, move-in/out records", "Service delivery, dispute resolution"],
                                    ].map(([category, data, purpose]) => (
                                        <tr key={category} className="border-b border-slate-100">
                                            <td className="border border-slate-200 px-4 py-2 font-medium">{category}</td>
                                            <td className="border border-slate-200 px-4 py-2 text-muted-foreground">{data}</td>
                                            <td className="border border-slate-200 px-4 py-2">{purpose}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">2. Legal Basis for Processing</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Consent:</strong> You consent to processing at signup by accepting these terms.</li>
                            <li><strong>Contract:</strong> We process data to deliver the services you request (bookings, payments).</li>
                            <li><strong>Legal Obligation:</strong> KYC processing is required under RBI and Indian law.</li>
                            <li><strong>Legitimate Interests:</strong> Fraud detection, platform security, and analytics.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">3. How We Use Your Data</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>To create and manage your account</li>
                            <li>To process bookings, payments, and payouts</li>
                            <li>To verify your identity (KYC)</li>
                            <li>To provide customer support</li>
                            <li>To send transactional communications (booking confirmation, invoices, OTPs)</li>
                            <li>To prevent fraud, abuse, and unauthorized access</li>
                            <li>To improve our platform through analytics</li>
                            <li>To comply with legal and regulatory requirements</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">4. Who We Share Data With</h2>
                        <p className="mb-2">We do <strong>not</strong> sell your personal data. We share it only with:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Payment Processors:</strong> Razorpay — for payment processing (PCI-DSS compliant)</li>
                            <li><strong>KYC Partners:</strong> Aadhaar/DigiLocker verification services</li>
                            <li><strong>Cloud Infrastructure:</strong> AWS / Vercel — servers and storage</li>
                            <li><strong>Email / SMS:</strong> Resend, Fast2SMS — for transactional communications</li>
                            <li><strong>Analytics:</strong> PostHog — anonymized usage analytics</li>
                            <li><strong>Law Enforcement:</strong> When required by valid legal order from Indian courts</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">5. Data Storage & Localization</h2>
                        <p>All personal data of Indian users is stored on servers located in <strong>India</strong> in compliance with DPDPA data localization requirements. Identity documents are encrypted at rest using AES-256.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">6. Data Retention</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-100">
                                        <th className="border border-slate-200 px-4 py-2 text-left font-bold">Data Type</th>
                                        <th className="border border-slate-200 px-4 py-2 text-left font-bold">Retention Period</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        ["Account data", "Until account deletion + 3 years"],
                                        ["Financial records", "7 years (GST/Tax compliance)"],
                                        ["KYC documents", "5 years post move-out"],
                                        ["Booking records", "5 years"],
                                        ["Support tickets", "2 years"],
                                        ["Login logs", "90 days rolling"],
                                        ["Analytics data", "2 years (anonymized after 6 months)"],
                                    ].map(([type, period]) => (
                                        <tr key={type} className="border-b border-slate-100">
                                            <td className="border border-slate-200 px-4 py-2">{type}</td>
                                            <td className="border border-slate-200 px-4 py-2 font-medium">{period}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">7. Your Rights (DPDPA 2023)</h2>
                        <p className="mb-2">Under the Digital Personal Data Protection Act, 2023, you have the right to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Access:</strong> Request a copy of your personal data we hold</li>
                            <li><strong>Correction:</strong> Request correction of inaccurate personal data</li>
                            <li><strong>Erasure:</strong> Request deletion of your account and data (subject to legal hold)</li>
                            <li><strong>Consent Withdrawal:</strong> Withdraw consent at any time (may affect ability to use the platform)</li>
                            <li><strong>Grievance Redressal:</strong> Lodge a complaint with our Grievance Officer</li>
                            <li><strong>Nomination:</strong> Nominate a person to exercise rights on your behalf</li>
                        </ul>
                        <p className="mt-2">To exercise these rights, email: <a href="mailto:privacy@rentpe.in" className="text-blue-600 underline">privacy@rentpe.in</a> with subject &ldquo;Data Rights Request&rdquo;. We will respond within 30 days.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">8. Cookies</h2>
                        <p>We use cookies for authentication, security, and analytics. See our <Link href="/cookie-policy" className="text-blue-600 underline">Cookie Policy</Link> for full details.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">9. Security</h2>
                        <p>We implement industry-standard security measures including:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>TLS 1.3 encryption for all data in transit</li>
                            <li>AES-256 encryption for sensitive data at rest</li>
                            <li>HttpOnly, Secure, SameSite cookies for session management</li>
                            <li>bcrypt password hashing with cost factor 12</li>
                            <li>Role-Based Access Control (RBAC) with least-privilege principle</li>
                            <li>Regular security audits and penetration testing</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">10. Children&apos;s Privacy</h2>
                        <p>RentPe is not intended for users under the age of 18. We do not knowingly collect data from minors. If we discover such data, it will be deleted immediately.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">11. Changes to This Policy</h2>
                        <p>We may update this Privacy Policy. We will notify registered users via email for material changes. Continued use of RentPe after the update constitutes acceptance.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">12. Grievance Officer</h2>
                        <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-1">
                            <p><strong>Name:</strong> Roshan (Data Protection Officer / Grievance Officer)</p>
                            <p><strong>Email:</strong> <a href="mailto:privacy@rentpe.in" className="text-blue-600 underline">privacy@rentpe.in</a></p>
                            <p><strong>Address:</strong> 123 Startup Hub, Koramangala, Bengaluru, Karnataka – 560034</p>
                            <p><strong>Response Time:</strong> 30 days</p>
                        </div>
                    </section>

                </div>

                <div className="mt-12 pt-6 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <Link href="/terms" className="hover:text-blue-600 transition-colors">Terms of Service</Link>
                    <Link href="/refund" className="hover:text-blue-600 transition-colors">Refund Policy</Link>
                    <Link href="/cookie-policy" className="hover:text-blue-600 transition-colors">Cookie Policy</Link>
                </div>
            </div>
        </div>
    );
}
