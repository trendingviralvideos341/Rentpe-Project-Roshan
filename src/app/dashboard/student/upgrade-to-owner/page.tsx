'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { requestOwnerUpgrade } from '@/actions/roleUpgrade';
import {
    ShieldCheck, FileText, Building, CheckCircle,
    ChevronRight, ChevronLeft, Loader2, Home, Zap,
    Hash, MessageSquare, ArrowRight, Lock
} from 'lucide-react';

// ─── Step Indicator ───────────────────────────────────────────────────────────
const STEPS = [
    { id: 1, label: 'Verify Identity', icon: Lock },
    { id: 2, label: 'KYC Check', icon: ShieldCheck },
    { id: 3, label: 'Business Intent', icon: Building },
    { id: 4, label: 'Confirm & Submit', icon: CheckCircle },
];

export default function UpgradeToOwnerPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [isPending, startTransition] = useTransition();

    // Step 1 state
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);

    // Step 3 state
    const [reason, setReason] = useState('');
    const [propertyType, setPropertyType] = useState('PG');
    const [estimatedRooms, setEstimatedRooms] = useState(1);

    // Final submit
    const handleSendOtp = () => {
        setOtpSent(true);
        toast.success('OTP sent to your registered phone number!');
    };

    const handleVerifyOtp = () => {
        if (otp !== '123456') {
            toast.error('Invalid OTP. For testing, use 123456.');
            return;
        }
        setOtpVerified(true);
        toast.success('Phone verified! Proceeding to KYC check.');
        setTimeout(() => setStep(2), 800);
    };

    const handleSubmit = () => {
        if (!reason.trim()) {
            toast.error('Please provide your reason for upgrading.');
            return;
        }
        startTransition(async () => {
            try {
                const result = await requestOwnerUpgrade(reason, propertyType, estimatedRooms);
                if (result?.error) {
                    toast.error(result.error);
                    return;
                }
                toast.success('Upgrade request submitted! Admin will review within 24-48 hours.');
                setTimeout(() => router.push('/dashboard/student'), 2000);
            } catch (err: any) {
                toast.error(err.message || 'Something went wrong. Please try again.');
            }
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 mb-4 shadow-lg shadow-indigo-200">
                        <Home className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900">Upgrade to Property Owner</h1>
                    <p className="text-slate-500 mt-2 text-sm">List your PG and start earning — verified in 24-48 hours</p>
                </div>

                {/* Step Progress Bar */}
                <div className="flex items-center justify-between mb-8 px-2">
                    {STEPS.map((s, idx) => {
                        const Icon = s.icon;
                        const isActive = step === s.id;
                        const isDone = step > s.id;
                        return (
                            <div key={s.id} className="flex items-center flex-1">
                                <div className="flex flex-col items-center">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all font-bold text-sm ${
                                        isDone ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                                        : isActive ? 'bg-white border-indigo-600 text-indigo-600 shadow-md'
                                        : 'bg-white border-slate-200 text-slate-400'
                                    }`}>
                                        {isDone ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                                    </div>
                                    <span className={`mt-1.5 text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-indigo-600' : isDone ? 'text-indigo-500' : 'text-slate-400'}`}>
                                        {s.label}
                                    </span>
                                </div>
                                {idx < STEPS.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-2 mb-5 transition-all ${isDone ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Card */}
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">

                    {/* ── Step 1: Identity Verification ── */}
                    {step === 1 && (
                        <div className="p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                    <Lock className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900">Identity Verification</h2>
                                    <p className="text-xs text-slate-500">We need to verify your phone before granting Owner access</p>
                                </div>
                            </div>

                            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-6">
                                <p className="text-sm text-indigo-800 font-medium">
                                    📱 An OTP will be sent to your registered phone number to confirm your identity.
                                </p>
                            </div>

                            {!otpSent ? (
                                <button
                                    onClick={handleSendOtp}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    <Zap className="h-5 w-5" />
                                    Send OTP to My Phone
                                </button>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 block">
                                            Enter 6-Digit OTP
                                        </label>
                                        <input
                                            type="text"
                                            value={otp}
                                            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            placeholder="• • • • • •"
                                            maxLength={6}
                                            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3.5 text-center text-2xl font-black tracking-widest focus:outline-none focus:border-indigo-500 transition-all"
                                        />
                                        <p className="text-xs text-slate-400 mt-1.5 text-center">For testing, use: <span className="font-black text-slate-600">123456</span></p>
                                    </div>
                                    <button
                                        onClick={handleVerifyOtp}
                                        disabled={otp.length < 6}
                                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black rounded-xl transition-all shadow-lg shadow-indigo-200 disabled:shadow-none hover:-translate-y-0.5 active:translate-y-0"
                                    >
                                        <ShieldCheck className="h-5 w-5" />
                                        Verify & Continue
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Step 2: KYC Check ── */}
                    {step === 2 && (
                        <div className="p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900">KYC Verification</h2>
                                    <p className="text-xs text-slate-500">Government ID verification is mandatory for property listing</p>
                                </div>
                            </div>

                            {/* Auto-skip if KYC already done (production: check from DB) */}
                            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-200">
                                    <CheckCircle className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-emerald-900">✓ KYC Already Verified</p>
                                    <p className="text-xs text-emerald-700 mt-0.5">
                                        Your Aadhaar and PAN documents are already verified on file. No re-submission needed.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex items-center gap-2 px-6 py-3 border-2 border-slate-200 text-slate-700 font-black rounded-xl hover:bg-slate-50 transition-all"
                                >
                                    <ChevronLeft className="h-4 w-4" /> Back
                                </button>
                                <button
                                    onClick={() => setStep(3)}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all shadow-lg shadow-indigo-200 hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    Continue <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Business Intent ── */}
                    {step === 3 && (
                        <div className="p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                                    <Building className="h-5 w-5 text-purple-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900">Business Intent</h2>
                                    <p className="text-xs text-slate-500">Tell us about what you plan to list on RentPe</p>
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                                        <MessageSquare className="h-3.5 w-3.5 text-purple-500" />
                                        Why do you want to list on RentPe? <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={reason}
                                        onChange={e => setReason(e.target.value)}
                                        placeholder="e.g. I own a 10-room PG in Koramangala and want to manage bookings, payments, and tenants digitally instead of manually..."
                                        rows={4}
                                        className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-indigo-500 transition-all"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">{reason.length}/500 characters</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                                            <Building className="h-3.5 w-3.5 text-purple-500" />
                                            Property Type
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={propertyType}
                                                onChange={e => setPropertyType(e.target.value)}
                                                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold appearance-none focus:outline-none focus:border-indigo-500 transition-all bg-white cursor-pointer"
                                            >
                                                <option value="PG">PG (Paying Guest)</option>
                                                <option value="HOSTEL">Hostel</option>
                                                <option value="FLAT">Flat / Apartment</option>
                                                <option value="OTHER">Other</option>
                                            </select>
                                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none rotate-90" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                                            <Hash className="h-3.5 w-3.5 text-purple-500" />
                                            Estimated Rooms
                                        </label>
                                        <input
                                            type="number"
                                            value={estimatedRooms}
                                            onChange={e => setEstimatedRooms(Math.max(1, parseInt(e.target.value) || 1))}
                                            min={1}
                                            max={500}
                                            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-indigo-500 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setStep(2)}
                                    className="flex items-center gap-2 px-6 py-3 border-2 border-slate-200 text-slate-700 font-black rounded-xl hover:bg-slate-50 transition-all"
                                >
                                    <ChevronLeft className="h-4 w-4" /> Back
                                </button>
                                <button
                                    onClick={() => {
                                        if (!reason.trim()) { toast.error('Please explain why you want to upgrade.'); return; }
                                        setStep(4);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all shadow-lg shadow-indigo-200 hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    Review Summary <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 4: Confirmation ── */}
                    {step === 4 && (
                        <div className="p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0">
                                    <CheckCircle className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900">Review & Submit</h2>
                                    <p className="text-xs text-slate-500">Confirm your details before submitting</p>
                                </div>
                            </div>

                            <div className="space-y-3 mb-8">
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Lock className="h-3.5 w-3.5 text-indigo-500" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Identity</span>
                                    </div>
                                    <p className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
                                        <CheckCircle className="h-4 w-4" /> Phone Verified
                                    </p>
                                </div>

                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">KYC</span>
                                    </div>
                                    <p className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
                                        <CheckCircle className="h-4 w-4" /> Already Verified
                                    </p>
                                </div>

                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Building className="h-3.5 w-3.5 text-indigo-500" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Business Intent</span>
                                    </div>
                                    <div className="space-y-1 text-sm">
                                        <p><span className="font-black text-slate-500">Type:</span> <span className="font-bold text-slate-900">{propertyType}</span></p>
                                        <p><span className="font-black text-slate-500">Rooms:</span> <span className="font-bold text-slate-900">~{estimatedRooms}</span></p>
                                        <p className="text-slate-700 mt-2 italic text-xs leading-relaxed">"{reason}"</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                                <p className="text-xs text-amber-800">
                                    <span className="font-black">⏱️ Review Timeline:</span> Our team reviews requests within 24-48 hours. You'll receive a notification once approved.
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(3)}
                                    className="flex items-center gap-2 px-6 py-3 border-2 border-slate-200 text-slate-700 font-black rounded-xl hover:bg-slate-50 transition-all"
                                    disabled={isPending}
                                >
                                    <ChevronLeft className="h-4 w-4" /> Back
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={isPending}
                                    className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black rounded-xl transition-all shadow-lg shadow-indigo-200 hover:-translate-y-0.5 active:translate-y-0 disabled:shadow-none"
                                >
                                    {isPending ? (
                                        <><Loader2 className="h-5 w-5 animate-spin" /> Submitting...</>
                                    ) : (
                                        <><ArrowRight className="h-5 w-5" /> Submit Upgrade Request</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer note */}
                <p className="text-center text-xs text-slate-400 mt-6">
                    By submitting, you agree to the <span className="text-indigo-600 font-bold cursor-pointer hover:underline">RentPe Owner Terms of Service</span>
                </p>
            </div>
        </div>
    );
}
