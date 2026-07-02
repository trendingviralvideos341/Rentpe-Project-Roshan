import { Bug, Mail, Target, Award, Terminal } from "lucide-react";

export const metadata = {
    title: "Bug Bounty Program | RentPe",
    description: "Join the RentPe Bug Bounty program. Report vulnerabilities responsibly and help us build a safer marketplace for everyone.",
};

export default function BugBountyPage() {
    return (
        <div className="min-h-screen bg-slate-50 py-16 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="mb-16">
                    <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 font-bold px-4 py-1.5 rounded-full text-sm mb-6 uppercase tracking-wider">
                        <Bug className="h-4 w-4" />
                        Security Researchers
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-6">Responsible Disclosure</h1>
                    <p className="text-lg text-slate-700 leading-relaxed md:w-3/4">
                        We value the security community. If you have found a security vulnerability in our platform, we invite you to report it to us in a responsible manner. 
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                    <div className="bg-white p-6 rounded-2xl border shadow-sm">
                        <Target className="h-8 w-8 text-red-600 mb-4" />
                        <h3 className="font-bold text-slate-900 mb-2">Scope</h3>
                        <p className="text-xs text-slate-600">*.rentpe.in (Production), API endpoints, and our official mobile applications.</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border shadow-sm">
                        <Terminal className="h-8 w-8 text-slate-700 mb-4" />
                        <h3 className="font-bold text-slate-900 mb-2">Eligibility</h3>
                        <p className="text-xs text-slate-600">Individuals who find a vulnerability and report it without causing harm or data loss.</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border shadow-sm">
                        <Award className="h-8 w-8 text-amber-500 mb-4" />
                        <h3 className="font-bold text-slate-900 mb-2">Rewards</h3>
                        <p className="text-xs text-slate-600">Hall of Fame recognition, exclusive swags, and recommendation for high-criticality bugs.</p>
                    </div>
                </div>

                <div className="space-y-12">
                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                            <span className="bg-slate-900 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm">1</span>
                            Guidelines
                        </h2>
                        <ul className="list-disc pl-11 space-y-3 text-sm text-slate-700">
                            <li>Do not attempt to access user data or disrupt live services.</li>
                            <li>Do not use automated scanners that generate high-volume traffic.</li>
                            <li>Provide a clear Proof of Concept (PoC) with steps to reproduce.</li>
                            <li>Give us a reasonable timeframe to respond and fix the issue before public disclosure.</li>
                        </ul>
                    </section>

                    <section className="bg-blue-600 rounded-[2.5rem] p-10 md:p-14 text-white">
                        <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                            <Mail className="h-8 w-8" />
                            How to Report
                        </h2>
                        <p className="mb-8 text-blue-100 italic">
                            Email your findings to <span className="font-bold text-white underline">security@rentpe.in</span> with the subject line [BUG BOUNTY].
                        </p>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                            <h4 className="font-bold mb-2">Include in your report:</h4>
                            <ul className="text-sm space-y-2 opacity-90">
                                <li>• Summary of the vulnerability</li>
                                <li>• Impact assessment (CVSS if possible)</li>
                                <li>• Detailed steps to reproduce / PoC</li>
                                <li>• Your name and desired handle for Hall of Fame</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">Out of Scope</h2>
                        <p className="text-sm text-slate-600 mb-4">The following types of issues are currently out of scope for rewards:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-500">
                            <div className="bg-slate-100 p-3 rounded-lg">• Clickjacking on pages with no sensitive actions</div>
                            <div className="bg-slate-100 p-3 rounded-lg">• Missing SPF/DKIM/DMARC records</div>
                            <div className="bg-slate-100 p-3 rounded-lg">• Self-XSS or Social Engineering</div>
                            <div className="bg-slate-100 p-3 rounded-lg">• Open redirects (non-critical)</div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
