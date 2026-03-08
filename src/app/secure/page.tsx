import { Shield, Lock, Eye, CheckCircle, Smartphone } from "lucide-react";

export const metadata = {
    title: "Security Practices | RentPe",
    description: "Learn how RentPe protects your data with industry-leading security practices, encryption, and proactive monitoring.",
};

export default function SecurityPage() {
    const features = [
        {
            icon: <Lock className="h-8 w-8 text-violet-600" />,
            title: "Advanced Encryption",
            description: "All sensitive data, including passwords and personal documents, is encrypted using industry-standard AES-256 and stored securely."
        },
        {
            icon: <Shield className="h-8 w-8 text-blue-600" />,
            title: "Secure Infrastructure",
            description: "Hosted on enterprise-grade cloud servers with multi-layered firewalls, DDoS protection, and continuous security monitoring."
        },
        {
            icon: <Smartphone className="h-8 w-8 text-purple-600" />,
            title: "Two-Factor Auth (2FA)",
            description: "Administrator and Owner accounts are secured with mandatory 2FA to prevent unauthorized access even if credentials are compromised."
        },
        {
            icon: <Eye className="h-8 w-8 text-emerald-600" />,
            title: "Proactive Auditing",
            description: "Every sensitive action is logged in our immutable audit trail. We perform regular internal security reviews and vulnerability scans."
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 py-16 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 bg-violet-100 text-violet-700 font-bold px-4 py-1.5 rounded-full text-sm mb-6">
                        <Shield className="h-4 w-4" />
                        Trust & Safety
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-6">Security at RentPe</h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Your trust is our most valuable asset. We employ military-grade security to ensure your data and transactions are safe.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
                    {features.map((f, i) => (
                        <div key={i} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                            <div className="mb-4">{f.icon}</div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">{f.title}</h3>
                            <p className="text-slate-600 leading-relaxed text-sm">{f.description}</p>
                        </div>
                    ))}
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-[2rem] p-10 md:p-16 relative overflow-hidden shadow-2xl">
                    <div className="relative z-10">
                        <h2 className="text-3xl font-bold mb-6">Data Privacy Compliance</h2>
                        <div className="space-y-4 text-slate-300">
                            <p className="flex items-start gap-3">
                                <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-1" />
                                <span>Compliant with the <strong>Digital Personal Data Protection (DPDP) Act, 2023</strong>.</span>
                            </p>
                            <p className="flex items-start gap-3">
                                <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-1" />
                                <span>No secondary use of data — your info is used strictly for RentPe services.</span>
                            </p>
                            <p className="flex items-start gap-3">
                                <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-1" />
                                <span>Zero storage of sensitive financial credentials; all handled by Razorpay.</span>
                            </p>
                        </div>
                    </div>
                    <div className="absolute -right-20 -bottom-20 opacity-10">
                        <Shield className="h-80 w-80" />
                    </div>
                </div>

                <div className="mt-16 text-center text-sm text-slate-500">
                    Questions about our security? Contact us at <a href="mailto:security@rentpe.in" className="text-violet-600 font-semibold underline">security@rentpe.in</a>
                </div>
            </div>
        </div>
    );
}
