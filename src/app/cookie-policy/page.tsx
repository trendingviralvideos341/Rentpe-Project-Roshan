import Link from "next/link";

export const metadata = {
    title: "Cookie Policy | RentPe",
    description: "Learn about how RentPe uses cookies for authentication, security, and analytics.",
};

export default function CookiePolicyPage() {
    return (
        <div className="min-h-screen bg-muted/20">
            <div className="max-w-4xl mx-auto px-4 py-12">
                <div className="mb-10">
                    <div className="inline-block bg-yellow-100 text-yellow-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-4">Legal</div>
                    <h1 className="text-4xl font-black text-slate-900 mb-3">Cookie Policy</h1>
                    <p className="text-muted-foreground text-sm">Effective Date: 08 March 2026 &nbsp;·&nbsp; Last Updated: 08 March 2026</p>
                </div>

                <div className="space-y-10 text-slate-700 leading-relaxed text-sm">

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">What Are Cookies?</h2>
                        <p>Cookies are small text files stored on your device when you visit a website. They help websites remember your preferences, keep you logged in, and improve the overall experience.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">Cookies We Use</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-100">
                                        <th className="border border-slate-200 px-4 py-2 text-left font-bold">Cookie Name</th>
                                        <th className="border border-slate-200 px-4 py-2 text-left font-bold">Type</th>
                                        <th className="border border-slate-200 px-4 py-2 text-left font-bold">Purpose</th>
                                        <th className="border border-slate-200 px-4 py-2 text-left font-bold">Duration</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        ["rentpe_session", "Essential", "Keeps you logged in. HttpOnly, Secure.", "24 hours"],
                                        ["csrf_token", "Essential", "Protects against cross-site request forgery attacks.", "Session"],
                                        ["ph_posthog", "Analytics", "PostHog analytics — anonymized usage data.", "1 year"],
                                        ["rentpe_pref", "Functional", "Remembers your city, dark mode, and filter preferences.", "30 days"],
                                        ["razorpay_*", "Payment", "Razorpay payment session for checkout.", "Session"],
                                    ].map(([name, type, purpose, duration]) => (
                                        <tr key={name} className="border-b border-slate-100">
                                            <td className="border border-slate-200 px-4 py-2 font-mono text-xs">{name}</td>
                                            <td className={`border border-slate-200 px-4 py-2 font-bold text-xs ${
                                                type === "Essential" ? "text-green-700" :
                                                type === "Analytics" ? "text-blue-700" :
                                                type === "Payment" ? "text-orange-700" : "text-purple-700"
                                            }`}>{type}</td>
                                            <td className="border border-slate-200 px-4 py-2">{purpose}</td>
                                            <td className="border border-slate-200 px-4 py-2 text-muted-foreground">{duration}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">Cookie Categories</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            {[
                                { color: "green", type: "Essential", desc: "Required for the platform to function. Cannot be disabled. Includes session authentication and CSRF protection." },
                                { color: "purple", type: "Functional", desc: "Remember your preferences like city selection, dark mode, and search filters. Can be disabled without affecting core functionality." },
                                { color: "blue", type: "Analytics", desc: "Help us understand how users interact with our platform so we can improve it. All data is anonymized." },
                                { color: "orange", type: "Payment", desc: "Set by Razorpay during checkout. Required for processing payments securely. Managed by Razorpay Privacy Policy." },
                            ].map(({ color, type, desc }) => (
                                <div key={type} className={`bg-${color}-50 border border-${color}-100 rounded-xl p-4`}>
                                    <p className={`font-bold text-${color}-800 mb-1`}>{type}</p>
                                    <p className="text-xs text-muted-foreground">{desc}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">Third-Party Cookies</h2>
                        <p>Some cookies are set by trusted third-party services we use:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li><strong>Razorpay:</strong> Payment processing — <a href="https://razorpay.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Razorpay Privacy Policy</a></li>
                            <li><strong>PostHog:</strong> Analytics (self-hosted, GDPR compliant) — anonymized user behavior</li>
                            <li><strong>Google Maps:</strong> Property location maps — <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google Privacy Policy</a></li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">Managing Cookies</h2>
                        <p className="mb-2">You can manage cookies in your browser settings. Note that disabling essential cookies will prevent you from logging in and using the platform.</p>
                        <div className="grid md:grid-cols-3 gap-3">
                            {[
                                { browser: "Chrome", url: "chrome://settings/cookies" },
                                { browser: "Firefox", url: "about:preferences#privacy" },
                                { browser: "Safari", url: "Safari → Preferences → Privacy" },
                            ].map(({ browser, url }) => (
                                <div key={browser} className="bg-slate-50 border rounded-lg p-3 text-xs">
                                    <p className="font-bold">{browser}</p>
                                    <p className="text-muted-foreground mt-1">{url}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">Changes to This Policy</h2>
                        <p>We may update this Cookie Policy from time to time. The &ldquo;Last Updated&rdquo; date at the top will reflect the latest changes.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">Contact</h2>
                        <p>Questions about our cookie practices? Email: <a href="mailto:privacy@rentpe.in" className="text-blue-600 underline">privacy@rentpe.in</a></p>
                    </section>

                </div>

                <div className="mt-12 pt-6 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <Link href="/terms" className="hover:text-blue-600 transition-colors">Terms of Service</Link>
                    <Link href="/privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</Link>
                    <Link href="/refund" className="hover:text-blue-600 transition-colors">Refund Policy</Link>
                    <Link href="/tenant-agreement" className="hover:text-blue-600 transition-colors">Tenant Agreement</Link>
                </div>
            </div>
        </div>
    );
}
