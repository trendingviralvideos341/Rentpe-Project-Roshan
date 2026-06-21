"use client";

import { useState } from "react";
import { updateOwnerRazorpayAccount } from "@/actions/platform";
import {
    CheckCircle2, AlertCircle, ExternalLink, Zap, ShieldCheck,
    RefreshCcw, Building2, IndianRupee, Clock, ChevronRight,
    Info, XCircle, ArrowRight, Banknote, RotateCcw, Lock
} from "lucide-react";

const STEPS = [
    { id: 1, label: "Verify Business" },
    { id: 2, label: "Bank Details" },
    { id: 3, label: "Confirm & Connect" },
];

function StepBar({ current }: { current: number }) {
    return (
        <div className="flex items-center gap-0 mb-8">
            {STEPS.map((step, i) => (
                <div key={step.id} className="flex items-center flex-1 last:flex-none">
                    <div className={`flex items-center gap-2 ${current >= step.id ? "text-indigo-700" : "text-gray-400"}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${current > step.id ? "bg-indigo-600 border-indigo-600 text-white" : current === step.id ? "border-indigo-600 text-indigo-600 bg-indigo-50" : "border-gray-300 text-gray-400 bg-white"}`}>
                            {current > step.id ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                        </div>
                        <span className={`text-xs font-semibold hidden sm:block ${current >= step.id ? "text-indigo-700" : "text-gray-400"}`}>{step.label}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-3 transition-all ${current > step.id ? "bg-indigo-500" : "bg-gray-200"}`} />
                    )}
                </div>
            ))}
        </div>
    );
}

function StatCard({ icon, label, value, sub, color = "indigo" }: { icon: React.ReactNode, label: string, value: string, sub?: string, color?: string }) {
    const colors: Record<string, string> = {
        indigo: "bg-indigo-50 border-indigo-100 text-indigo-700",
        green: "bg-green-50 border-green-100 text-green-700",
        amber: "bg-amber-50 border-amber-100 text-amber-700",
        violet: "bg-violet-50 border-violet-100 text-violet-700",
    };
    return (
        <div className={`rounded-xl border p-4 ${colors[color]}`}>
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</span>
            </div>
            <p className="text-xl font-black">{value}</p>
            {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
        </div>
    );
}

export default function RazorpaySettingsClient({ initialAccountId }: { initialAccountId: string | null }) {
    const [connected, setConnected] = useState(!!initialAccountId);
    const [accountId, setAccountId] = useState(initialAccountId || "");
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Dummy form state (real fields, dummy submission)
    const [form, setForm] = useState({
        businessName: "",
        gstNumber: "",
        panNumber: "",
        bankAccountNo: "",
        bankIfsc: "",
        accountHolderName: "",
        bankName: "",
    });

    const handleField = (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleConnect = async () => {
        setSaving(true);
        try {
            // DUMMY: In production this would be a Razorpay Route OAuth redirect
            // Real: GET https://auth.razorpay.com/authorize?client_id=...&response_type=code&...
            await new Promise(r => setTimeout(r, 1800)); // simulate API call delay
            const dummyId = "acc_" + Math.random().toString(36).substr(2, 14).toUpperCase();
            await updateOwnerRazorpayAccount(dummyId);
            setAccountId(dummyId);
            setConnected(true);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 4000);
        } catch (e: any) {
            alert("Connection failed: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDisconnect = async () => {
        setDisconnecting(true);
        try {
            await updateOwnerRazorpayAccount(null);
            setAccountId("");
            setConnected(false);
            setStep(1);
            setShowDisconnectConfirm(false);
        } catch (e: any) {
            alert("Failed to disconnect: " + e.message);
        } finally {
            setDisconnecting(false);
        }
    };

    return (
        <div className="max-w-3xl space-y-6">
            {/* ─── Header ─── */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Payment Settings</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Configure how you receive rent, deposits & refunds via Razorpay Route.
                    </p>
                </div>
                <a
                    href="https://razorpay.com/docs/route/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-all"
                >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Razorpay Docs
                </a>
            </div>

            {/* ─── Success Banner ─── */}
            {showSuccess && (
                <div className="bg-green-600 text-white px-5 py-4 rounded-xl flex items-center gap-3 shadow-lg animate-in slide-in-from-top-2">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <div>
                        <p className="font-bold text-sm">Account Connected Successfully!</p>
                        <p className="text-xs text-green-100">Rent payments will now be split and sent to your bank automatically.</p>
                    </div>
                </div>
            )}

            {/* ─── CONNECTED STATE ─── */}
            {connected ? (
                <div className="space-y-5">
                    {/* Status Card */}
                    <div className="rounded-2xl border-2 border-green-200 bg-white shadow-sm overflow-hidden">
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4 flex items-center gap-3">
                            <div className="bg-white/20 rounded-full p-2">
                                <CheckCircle2 className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-white font-bold text-sm">Razorpay Route — Active</p>
                                <p className="text-green-100 text-xs">Automatic payouts enabled</p>
                            </div>
                            <div className="ml-auto">
                                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide">
                                    DUMMY MODE
                                </span>
                            </div>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 font-medium">Razorpay Account ID</span>
                                <code className="text-xs font-mono bg-gray-100 px-3 py-1 rounded-lg text-gray-700">{accountId}</code>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 font-medium">Payout Schedule</span>
                                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">T+1 Business Day</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 font-medium">Auto-Refund on Rejection</span>
                                <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Enabled</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 font-medium">Platform Fee Deduction</span>
                                <span className="text-xs font-semibold text-gray-700">Auto (per transaction)</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard icon={<IndianRupee className="w-4 h-4" />} label="Total Received" value="₹—" sub="Connect live to see" color="green" />
                        <StatCard icon={<Clock className="w-4 h-4" />} label="Next Payout" value="T+1 Day" sub="After confirmation" color="indigo" />
                        <StatCard icon={<RotateCcw className="w-4 h-4" />} label="Auto Refunds" value="0" sub="This month" color="amber" />
                        <StatCard icon={<Zap className="w-4 h-4" />} label="Success Rate" value="—" sub="Dummy mode" color="violet" />
                    </div>

                    {/* Refund Policy Card */}
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <RotateCcw className="w-4 h-4 text-blue-600" />
                            <p className="text-sm font-bold text-blue-800">Auto-Refund Policy (Note 6)</p>
                        </div>
                        <ul className="text-xs text-blue-700 space-y-1 pl-6">
                            <li>• If <strong>you or the admin</strong> rejects a booking after the student paid the ₹1,000 token — the token is <strong>automatically refunded</strong> to the student via Razorpay.</li>
                            <li>• If <strong>the student</strong> cancels — the token fee is <strong>non-refundable</strong> (as communicated during checkout).</li>
                            <li>• Refunds are deducted from your Razorpay unsettled balance (may go negative, recovered from next payout).</li>
                        </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3">
                        <a
                            href="https://dashboard.razorpay.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm"
                        >
                            <ExternalLink className="w-4 h-4" />
                            View Razorpay Dashboard
                        </a>
                        <button
                            onClick={() => setShowDisconnectConfirm(true)}
                            className="flex items-center gap-2 border border-red-200 text-red-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-50 transition-all"
                        >
                            <XCircle className="w-4 h-4" />
                            Disconnect Account
                        </button>
                    </div>

                    {/* Disconnect Confirm */}
                    {showDisconnectConfirm && (
                        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                                <p className="font-bold text-red-800 text-sm">Confirm Disconnection</p>
                            </div>
                            <p className="text-xs text-red-700">Disconnecting will stop automatic payouts. All future rent collections will require manual bank transfers by the RentPe admin team. Auto-refunds will also be disabled.</p>
                            <div className="flex gap-3">
                                <button onClick={handleDisconnect} disabled={disconnecting} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-all">
                                    {disconnecting ? "Disconnecting..." : "Yes, Disconnect"}
                                </button>
                                <button onClick={() => setShowDisconnectConfirm(false)} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-all">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            ) : (
                /* ─── NOT CONNECTED STATE ─── */
                <div className="space-y-5">
                    {/* Why Connect Banner */}
                    <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 text-white p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-white/20 rounded-xl p-2.5">
                                <Zap className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="font-black text-lg">Get Paid Instantly</h2>
                                <p className="text-indigo-200 text-xs">Connect your bank account to receive rent automatically</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-4">
                            {[
                                { icon: <Zap className="w-4 h-4" />, label: "T+1 Payout", sub: "Next business day" },
                                { icon: <ShieldCheck className="w-4 h-4" />, label: "Bank-grade Security", sub: "256-bit encrypted" },
                                { icon: <RotateCcw className="w-4 h-4" />, label: "Auto Refunds", sub: "Zero manual effort" },
                            ].map(f => (
                                <div key={f.label} className="bg-white/10 rounded-xl p-3 text-center">
                                    <div className="flex justify-center mb-1 text-indigo-200">{f.icon}</div>
                                    <p className="text-xs font-bold">{f.label}</p>
                                    <p className="text-[10px] text-indigo-300">{f.sub}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Step Card */}
                    <div className="rounded-2xl border bg-white shadow-sm p-6">
                        <StepBar current={step} />

                        {/* Step 1: Business Verification */}
                        {step === 1 && (
                            <div className="space-y-4">
                                <div>
                                    <h3 className="font-black text-gray-900 text-base">Business Verification</h3>
                                    <p className="text-xs text-gray-500 mt-1">Required by RBI for payment processing. Your data is encrypted and never shared.</p>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-700">Business / PG Name <span className="text-red-500">*</span></label>
                                        <input name="businessName" value={form.businessName} onChange={handleField} placeholder="e.g. Sharma PG Homes" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-all" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-700">GST Number (if applicable)</label>
                                        <input name="gstNumber" value={form.gstNumber} onChange={handleField} placeholder="27AAACT2727Q1ZW" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-all uppercase" />
                                    </div>
                                    <div className="sm:col-span-2 space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-700">PAN Number <span className="text-red-500">*</span></label>
                                        <input name="panNumber" value={form.panNumber} onChange={handleField} placeholder="ABCDE1234F" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-all uppercase" />
                                        <p className="text-[10px] text-gray-400">PAN is required by Razorpay for merchant KYC as per RBI mandate.</p>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => setStep(2)}
                                        disabled={!form.businessName.trim() || !form.panNumber.trim()}
                                        className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                                    >
                                        Next: Bank Details <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Bank Details */}
                        {step === 2 && (
                            <div className="space-y-4">
                                <div>
                                    <h3 className="font-black text-gray-900 text-base">Bank Account Details</h3>
                                    <p className="text-xs text-gray-500 mt-1">Payments will be deposited directly to this account after fee deduction.</p>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-700">Account Holder Name <span className="text-red-500">*</span></label>
                                        <input name="accountHolderName" value={form.accountHolderName} onChange={handleField} placeholder="Full name as on bank account" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-all" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-700">Bank Name <span className="text-red-500">*</span></label>
                                        <input name="bankName" value={form.bankName} onChange={handleField} placeholder="e.g. HDFC Bank" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-all" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-700">Account Number <span className="text-red-500">*</span></label>
                                        <input name="bankAccountNo" value={form.bankAccountNo} onChange={handleField} placeholder="Enter bank account number" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-all" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-700">IFSC Code <span className="text-red-500">*</span></label>
                                        <input name="bankIfsc" value={form.bankIfsc} onChange={handleField} placeholder="HDFC0001234" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-all uppercase" />
                                    </div>
                                </div>
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                                    <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-800">Your bank details are <strong>never stored</strong> on RentPe's servers. They are transmitted directly to Razorpay's encrypted vault via PCI-DSS compliant APIs.</p>
                                </div>
                                <div className="flex justify-between">
                                    <button onClick={() => setStep(1)} className="flex items-center gap-2 border border-gray-300 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all">
                                        ← Back
                                    </button>
                                    <button
                                        onClick={() => setStep(3)}
                                        disabled={!form.bankAccountNo.trim() || !form.bankIfsc.trim() || !form.accountHolderName.trim()}
                                        className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                                    >
                                        Review & Confirm <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Confirm & Connect */}
                        {step === 3 && (
                            <div className="space-y-4">
                                <div>
                                    <h3 className="font-black text-gray-900 text-base">Review & Connect</h3>
                                    <p className="text-xs text-gray-500 mt-1">Please confirm your details before connecting.</p>
                                </div>

                                <div className="rounded-xl border bg-gray-50 p-4 space-y-3 text-sm">
                                    {[
                                        ["Business Name", form.businessName],
                                        ["PAN Number", form.panNumber.toUpperCase()],
                                        ["Account Holder", form.accountHolderName],
                                        ["Bank Name", form.bankName],
                                        ["Account No", `****${form.bankAccountNo.slice(-4)}`],
                                        ["IFSC Code", form.bankIfsc.toUpperCase()],
                                    ].map(([label, value]) => (
                                        <div key={label} className="flex justify-between items-center border-b last:border-0 pb-2 last:pb-0">
                                            <span className="text-gray-500 text-xs">{label}</span>
                                            <span className="font-semibold text-gray-800 text-xs font-mono">{value || "—"}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
                                    <p className="text-xs font-bold text-indigo-800 flex items-center gap-2"><Info className="w-3.5 h-3.5" /> Fee Structure</p>
                                    <div className="text-xs text-indigo-700 space-y-1">
                                        <div className="flex justify-between"><span>Razorpay Gateway Fee</span><span className="font-bold">~2% + GST</span></div>
                                        <div className="flex justify-between"><span>RentPe Platform Fee</span><span className="font-bold">As per your plan</span></div>
                                        <div className="flex justify-between border-t border-indigo-200 pt-1 mt-1"><span>You Receive (Net)</span><span className="font-black text-indigo-900">After both deductions</span></div>
                                    </div>
                                </div>

                                <div className="flex justify-between">
                                    <button onClick={() => setStep(2)} className="flex items-center gap-2 border border-gray-300 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all">
                                        ← Back
                                    </button>
                                    <button
                                        onClick={handleConnect}
                                        disabled={saving}
                                        className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg disabled:opacity-60 transition-all"
                                    >
                                        {saving ? (
                                            <><RefreshCcw className="w-4 h-4 animate-spin" /> Connecting...</>
                                        ) : (
                                            <><Zap className="w-4 h-4" /> Connect & Activate</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Feature List */}
                    <div className="grid sm:grid-cols-3 gap-3">
                        {[
                            { icon: <Banknote className="w-4 h-4 text-green-600" />, title: "Instant Bank Transfer", desc: "Rent goes directly to your account the next business day." },
                            { icon: <RotateCcw className="w-4 h-4 text-blue-600" />, title: "Zero Manual Refunds", desc: "Rejected bookings auto-refund students. You don't lift a finger." },
                            { icon: <Building2 className="w-4 h-4 text-violet-600" />, title: "Multi-Property Support", desc: "One account handles payouts from all your listed PGs." },
                        ].map(f => (
                            <div key={f.title} className="border rounded-xl p-4 bg-white space-y-1.5 hover:shadow-sm transition-all">
                                <div className="bg-gray-50 w-8 h-8 rounded-lg flex items-center justify-center">{f.icon}</div>
                                <p className="text-sm font-bold text-gray-900">{f.title}</p>
                                <p className="text-xs text-gray-500">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Dev Note (Collapsible) ─── */}
            <details className="rounded-xl border border-dashed border-slate-300 bg-slate-50 group">
                <summary className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide cursor-pointer flex items-center gap-2">
                    <Info className="w-3.5 h-3.5" /> Developer Note (Click to expand)
                    <ChevronRight className="w-3.5 h-3.5 ml-auto group-open:rotate-90 transition-transform" />
                </summary>
                <div className="px-4 pb-4 text-xs text-slate-600 space-y-1 leading-relaxed border-t border-dashed border-slate-200 pt-3">
                    <p><strong>DUMMY MODE:</strong> This UI simulates the full Razorpay Route onboarding flow.</p>
                    <p>To go live: Replace <code className="bg-slate-200 px-1 rounded">handleConnect</code> with a Razorpay OAuth redirect:</p>
                    <code className="block bg-slate-200 px-2 py-1 rounded text-[10px] mt-1">GET https://auth.razorpay.com/authorize?client_id=&#123;CLIENT_ID&#125;&response_type=code&redirect_uri=&#123;CALLBACK&#125;</code>
                    <p className="mt-2">Refund API call in <code className="bg-slate-200 px-1 rounded">rejectBooking</code>: uncomment the <code className="bg-slate-200 px-1 rounded">razorpay.payments.refund()</code> block and pass <code className="bg-slate-200 px-1 rounded">reverse_all: 1</code>.</p>
                    <p>File: <code className="bg-slate-200 px-1 rounded">src/app/dashboard/owner/settings/payment/RazorpaySettingsClient.tsx</code></p>
                </div>
            </details>
        </div>
    );
}
