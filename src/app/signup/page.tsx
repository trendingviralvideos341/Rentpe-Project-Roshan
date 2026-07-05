"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { signup } from "@/actions/auth";
import { CheckCircle, XCircle, Loader2, Edit2, ShieldCheck, ArrowRight, Check } from "lucide-react";
import { validateEmail, validateName, validatePhone } from "@/lib/validators";
import { useRouter } from "next/navigation";

function getStrength(password: string) {
    const checks = {
        length: password.length >= 8,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password),
    };
    const passed = Object.values(checks).filter(Boolean).length;
    return { checks, passed };
}

const strengthLabel = ["", "Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
const strengthColor = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"];
const strengthText = ["", "text-red-600", "text-orange-600", "text-yellow-600", "text-blue-600", "text-green-600"];

const ROLE_OPTIONS = [
    {
        value: "USER",
        emoji: "🎓",
        label: "Student / Tenant",
        selectedBg: "bg-blue-100 border-blue-500",
        defaultBg: "bg-white border-gray-200",
    },
    {
        value: "OWNER",
        emoji: "🏠",
        label: "Property Owner",
        selectedBg: "bg-blue-100 border-blue-500",
        defaultBg: "bg-white border-gray-200",
    },
];

export default function SignupPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // Form States
    const [role, setRole] = useState("USER");
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    
    const [phoneOtp, setPhoneOtp] = useState(["", "", "", "", "", ""]);
    const [emailOtp, setEmailOtp] = useState(["", "", "", "", "", ""]);
    const [resendCooldown, setResendCooldown] = useState(0);
    const phoneInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const emailInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const [password, setPassword] = useState("");
    const [scrolledToBottom, setScrolledToBottom] = useState(false);
    const [agreedTerms, setAgreedTerms] = useState(false);
    const [agreedMarketing, setAgreedMarketing] = useState(false);
    const [agreedData, setAgreedData] = useState(false);
    
    const termsRef = useRef<HTMLDivElement>(null);
    const { checks, passed } = getStrength(password);

    // Validation States
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    // Handlers
    const handleNextStep1 = async () => {
        setError(null);
        setFieldErrors({});

        const fnErr = validateName(fullName);
        const emErr = validateEmail(email);
        const phErr = validatePhone(`+91${phone}`);
        
        if (fnErr || emErr || phErr) {
            setFieldErrors({ fullName: fnErr, email: emErr, phone: phErr });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, phone: `+91${phone}`, name: fullName }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                setError(data.error || 'Failed to send OTP. Please try again.');
                setLoading(false);
                return;
            }
            
            setStep(2);
            startCooldown();
        } catch (err) {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const startCooldown = () => {
        setResendCooldown(24);
        const timer = setInterval(() => {
            setResendCooldown(prev => {
                if (prev <= 1) { clearInterval(timer); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    const handleOtpChange = (type: 'phone' | 'email', index: number, value: string) => {
        const val = value.replace(/\D/g, "").slice(0, 1);
        const newOtp = type === 'phone' ? [...phoneOtp] : [...emailOtp];
        newOtp[index] = val;
        
        if (type === 'phone') {
            setPhoneOtp(newOtp);
            if (val && index < 5) phoneInputRefs.current[index + 1]?.focus();
        } else {
            setEmailOtp(newOtp);
            if (val && index < 5) emailInputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (type: 'phone' | 'email', index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !e.currentTarget.value && index > 0) {
            const refs = type === 'phone' ? phoneInputRefs : emailInputRefs;
            refs.current[index - 1]?.focus();
        }
    };

    const isPhoneVerified = phoneOtp.join("").length === 6; // Mock UI verification
    const isEmailVerified = emailOtp.join("").length === 6;

    const handleNextStep2 = () => {
        if (isPhoneVerified && isEmailVerified) {
            setStep(3);
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        if (Math.abs(target.scrollHeight - target.clientHeight - target.scrollTop) < 5) {
            setScrolledToBottom(true);
        }
    };

    const handleSubmit = async () => {
        setError(null);
        if (password.length < 8 || !checks.upper || !checks.lower || !checks.number) {
            setError("Please enter a valid password meeting all requirements.");
            return;
        }
        if (!agreedTerms || !agreedData) {
            setError("Please accept all required terms to continue.");
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.set("name", fullName);
            formData.set("email", email);
            formData.set("password", password);
            formData.set("phone", `+91${phone}`);
            formData.set("role", role);
            formData.set("otp", emailOtp.join(""));
            formData.set("phoneOtp", phoneOtp.join(""));
            formData.set("agreed", agreedTerms ? "true" : "false");
            formData.set("marketingAgreed", agreedMarketing ? "true" : "false");
            formData.set("dataSharingAgreed", agreedData ? "true" : "false");
            formData.set("hp", ""); // Anti-bot honeypot

            const result = await signup(formData);
            
            if (result?.error) {
                setError(result.error);
                if (result.error.toLowerCase().includes("otp")) setStep(2);
            } else if (result?.success) {
                setSuccess(true);
                setTimeout(() => router.push("/login?signup=success"), 2000);
            }
        } catch (err: any) {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 px-4">
                <Card className="w-full max-w-lg shadow-xl text-center p-8 border-0">
                    <div className="flex flex-col items-center space-y-4">
                        <CheckCircle className="h-16 w-16 text-green-500" />
                        <h2 className="text-2xl font-bold">Account Created!</h2>
                        <p className="text-muted-foreground">Redirecting to login...</p>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-slate-50">
            {/* Desktop Left Panel */}
            <div className="hidden md:flex md:w-5/12 bg-[#1A103C] text-white flex-col justify-center px-12 lg:px-20 relative overflow-hidden">
                <div className="z-10 space-y-10">
                    <div>
                        <div className="bg-white/10 w-fit p-3 rounded-2xl mb-6">
                            <ShieldCheck className="h-10 w-10 text-green-400" />
                        </div>
                        <h1 className="text-4xl font-bold leading-tight mb-4">The secure way to rent and manage properties.</h1>
                        <p className="text-indigo-200 text-lg">Join RentPe and experience transparent, hassle-free rentals.</p>
                    </div>
                    
                    <div className="space-y-6 pt-4">
                        <div className="flex items-center gap-4">
                            <CheckCircle className="h-6 w-6 text-green-400 shrink-0" />
                            <span className="text-lg">Verified Users & Properties</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <CheckCircle className="h-6 w-6 text-green-400 shrink-0" />
                            <span className="text-lg">Zero Hidden Charges</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <CheckCircle className="h-6 w-6 text-green-400 shrink-0" />
                            <span className="text-lg">Secure Digital Agreements</span>
                        </div>
                    </div>
                </div>
                {/* Decorative circles */}
                <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
            </div>

            {/* Right Panel - Form */}
            <div className="w-full md:w-7/12 flex items-center justify-center p-4 py-8">
                <div className="w-full max-w-[420px] mx-auto bg-white rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                    
                    {/* Progress Indicator */}
                    <div className="flex justify-center gap-2 mb-8">
                        <div className={`h-1.5 rounded-full w-4 transition-colors ${step >= 1 ? (step > 1 ? 'bg-green-500' : 'bg-blue-600') : 'bg-gray-200'}`} />
                        <div className={`h-1.5 rounded-full w-4 transition-colors ${step >= 2 ? (step > 2 ? 'bg-green-500' : 'bg-blue-600') : 'bg-gray-200'}`} />
                        <div className={`h-1.5 rounded-full w-4 transition-colors ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`} />
                    </div>

                    {/* Headers */}
                    <div className="text-center mb-8 space-y-3">
                        <div className="inline-block bg-blue-50 text-blue-700 text-xs font-bold px-4 py-1.5 rounded-full mb-1">
                            {step === 1 && "Who are you?"}
                            {step === 2 && "Verify your details"}
                            {step === 3 && "Almost there!"}
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900">
                            {step === 1 && "Join RentPe"}
                            {step === 2 && "Enter OTPs"}
                            {step === 3 && "Set your password"}
                        </h2>
                        <p className="text-sm text-slate-500">
                            {step === 1 && "Choose how you want to use RentPe"}
                            {step === 2 && "Check your phone and email for codes"}
                            {step === 3 && "Create a secure password for your account"}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-3 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100 flex items-start gap-2">
                            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span className="text-left">{error}</span>
                        </div>
                    )}

                    {/* Step 1 */}
                    {step === 1 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="grid grid-cols-2 gap-3">
                                {ROLE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setRole(opt.value)}
                                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${role === opt.value ? opt.selectedBg : opt.defaultBg} hover:border-blue-300`}
                                    >
                                        <span className="text-2xl mb-2">{opt.emoji}</span>
                                        <span className="text-sm font-semibold text-slate-800">{opt.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className={`relative border rounded-2xl p-3 px-4 ${fieldErrors.fullName ? 'border-red-300 bg-red-50/30' : 'border-gray-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500'}`}>
                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Full name</label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter your full name" 
                                        className="w-full bg-transparent outline-none text-slate-900 font-semibold placeholder:font-normal placeholder:text-slate-300"
                                        value={fullName}
                                        onChange={e => {
                                            setFullName(e.target.value.replace(/[^a-zA-Z\s]/g, ""));
                                            setFieldErrors(p => ({...p, fullName: ""}));
                                        }}
                                    />
                                    {fieldErrors.fullName && <p className="text-[10px] text-red-500 absolute -bottom-4 left-2">{fieldErrors.fullName}</p>}
                                </div>

                                <div className={`relative border rounded-2xl p-3 px-4 ${fieldErrors.phone ? 'border-red-300 bg-red-50/30' : 'border-gray-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500'}`}>
                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Mobile number</label>
                                    <div className="flex items-center gap-2 font-semibold">
                                        <span className="text-slate-500">+91</span>
                                        <input 
                                            type="tel" 
                                            placeholder="98765 43210" 
                                            maxLength={10}
                                            className="w-full bg-transparent outline-none text-slate-900 placeholder:font-normal placeholder:text-slate-300"
                                            value={phone}
                                            onChange={e => {
                                                setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                                                setFieldErrors(p => ({...p, phone: ""}));
                                            }}
                                        />
                                    </div>
                                    {fieldErrors.phone && <p className="text-[10px] text-red-500 absolute -bottom-4 left-2">{fieldErrors.phone}</p>}
                                </div>

                                <div className={`relative border rounded-2xl p-3 px-4 ${fieldErrors.email ? 'border-red-300 bg-red-50/30' : 'border-gray-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500'}`}>
                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Email address</label>
                                    <input 
                                        type="email" 
                                        placeholder="you@example.com" 
                                        className="w-full bg-transparent outline-none text-slate-900 font-semibold placeholder:font-normal placeholder:text-slate-300"
                                        value={email}
                                        onChange={e => {
                                            setEmail(e.target.value);
                                            setFieldErrors(p => ({...p, email: ""}));
                                        }}
                                    />
                                    {fieldErrors.email && <p className="text-[10px] text-red-500 absolute -bottom-4 left-2">{fieldErrors.email}</p>}
                                </div>
                            </div>

                            <Button 
                                onClick={handleNextStep1} 
                                disabled={loading || !fullName || phone.length !== 10 || !email.includes('@')}
                                className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base mt-4 shadow-lg shadow-blue-600/20"
                            >
                                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                                    <>Continue <ArrowRight className="ml-2 h-5 w-5" /></>
                                )}
                            </Button>
                        </div>
                    )}

                    {/* Step 2 */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                            {/* Phone Verification Block */}
                            <div className="border border-gray-200 rounded-2xl p-4 bg-white relative">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Mobile number</p>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-slate-900">+91 {phone}</p>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isPhoneVerified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {isPhoneVerified ? '✓ verified' : 'pending'}
                                            </span>
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => setStep(1)} className="text-blue-600 flex items-center gap-1 text-sm font-semibold hover:text-blue-700">
                                        <Edit2 className="h-3.5 w-3.5" /> Edit
                                    </button>
                                </div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 text-center tracking-wider">Phone OTP</p>
                                <div className="flex justify-center gap-2 mb-2">
                                    {phoneOtp.map((digit, i) => (
                                        <input
                                            key={`p-${i}`}
                                            ref={el => { phoneInputRefs.current[i] = el; }}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={e => handleOtpChange('phone', i, e.target.value)}
                                            onKeyDown={e => handleOtpKeyDown('phone', i, e)}
                                            className={`w-10 h-12 text-center font-bold text-xl rounded-xl border-2 outline-none transition-colors
                                                ${isPhoneVerified ? 'bg-green-50 border-green-300 text-green-700' : 
                                                digit ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 focus:border-blue-400 focus:bg-white'}`}
                                        />
                                    ))}
                                </div>
                                <div className="flex justify-end pr-2">
                                    {isPhoneVerified ? (
                                        <p className="text-[11px] text-green-600 font-bold flex items-center gap-1"><Check className="h-3 w-3"/> Phone verified</p>
                                    ) : (
                                        <p className="text-[11px] text-slate-500">Resend in {resendCooldown}s</p>
                                    )}
                                </div>
                            </div>

                            {/* Email Verification Block */}
                            <div className="border border-gray-200 rounded-2xl p-4 bg-white relative">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Email address</p>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-slate-900 truncate max-w-[180px]">{email}</p>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isEmailVerified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {isEmailVerified ? '✓ verified' : 'pending'}
                                            </span>
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => setStep(1)} className="text-blue-600 flex items-center gap-1 text-sm font-semibold hover:text-blue-700">
                                        <Edit2 className="h-3.5 w-3.5" /> Edit
                                    </button>
                                </div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 text-center tracking-wider">Email OTP</p>
                                <div className="flex justify-center gap-2 mb-2">
                                    {emailOtp.map((digit, i) => (
                                        <input
                                            key={`e-${i}`}
                                            ref={el => { emailInputRefs.current[i] = el; }}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={e => handleOtpChange('email', i, e.target.value)}
                                            onKeyDown={e => handleOtpKeyDown('email', i, e)}
                                            className={`w-10 h-12 text-center font-bold text-xl rounded-xl border-2 outline-none transition-colors
                                                ${isEmailVerified ? 'bg-green-50 border-green-300 text-green-700' : 
                                                digit ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 focus:border-blue-400 focus:bg-white'}`}
                                        />
                                    ))}
                                </div>
                                <div className="flex justify-end pr-2">
                                    {isEmailVerified ? (
                                        <p className="text-[11px] text-green-600 font-bold flex items-center gap-1"><Check className="h-3 w-3"/> Email verified</p>
                                    ) : (
                                        <p className="text-[11px] text-slate-500">Resend email OTP</p>
                                    )}
                                </div>
                            </div>

                            {isPhoneVerified && isEmailVerified ? (
                                <div className="bg-green-100 text-green-800 p-3 rounded-xl flex items-center justify-center font-bold text-sm">
                                    <CheckCircle className="h-4 w-4 mr-2" /> Both verified — you're good to go!
                                </div>
                            ) : (
                                <div className="bg-amber-100 text-amber-800 p-3 rounded-xl flex items-center justify-center font-semibold text-sm">
                                    ⚠️ Both phone and email must be verified to continue
                                </div>
                            )}

                            <Button 
                                type="button"
                                onClick={handleNextStep2} 
                                disabled={!isPhoneVerified || !isEmailVerified}
                                className={`w-full h-14 rounded-2xl font-bold text-base shadow-lg transition-all
                                    ${isPhoneVerified && isEmailVerified ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20' : 'bg-gray-200 text-gray-400'}`}
                            >
                                Verify & Continue <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </div>
                    )}

                    {/* Step 3 */}
                    {step === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                            
                            <div className="border border-gray-200 rounded-2xl p-1 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                                <div className="text-center pt-2 pb-1 text-[10px] uppercase font-bold text-slate-400">Password</div>
                                <input 
                                    type="password" 
                                    placeholder="••••••••" 
                                    className="w-full bg-transparent outline-none text-slate-900 font-bold text-2xl tracking-[0.3em] text-center pb-2 placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-300"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                            </div>
                            
                            {/* Strength indicator */}
                            {password.length > 0 && (
                                <div className="space-y-1.5 -mt-2">
                                    <div className="flex gap-1 h-1">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <div key={i} className={`flex-1 rounded-full ${i <= passed ? strengthColor[passed] : "bg-slate-200"}`} />
                                        ))}
                                    </div>
                                    <p className={`text-xs text-center font-bold ${strengthText[passed]}`}>{strengthLabel[passed]}</p>
                                </div>
                            )}

                            <div className="pt-2">
                                <p className="text-[11px] uppercase font-bold text-slate-400 text-center tracking-wider mb-2">Read Before Continuing</p>
                                
                                <div 
                                    ref={termsRef}
                                    onScroll={handleScroll}
                                    className="h-[120px] overflow-y-auto border border-gray-200 rounded-xl p-3 text-[11px] text-slate-600 leading-relaxed bg-slate-50 scrollbar-thin scrollbar-thumb-slate-300"
                                >
                                    <p className="font-bold text-slate-800 mb-1 text-center">Terms of Service</p>
                                    <p className="mb-2">By creating an account on RentPe, you agree to use this platform only for lawful purposes. You confirm that all information provided is accurate and complete.</p>
                                    
                                    <p className="font-bold text-slate-800 mb-1 text-center mt-3">Privacy Policy</p>
                                    <p className="mb-2">We collect and process your personal data in accordance with our Privacy Policy. This includes your contact details and interaction history on our platform.</p>
                                    
                                    <p className="font-bold text-slate-800 mb-1 text-center mt-3">Refund Policy</p>
                                    <p className="mb-2">Payments made through the platform are subject to the specific terms set by the property owner. RentPe facilitates these transactions securely.</p>
                                    
                                    <p className="font-bold text-slate-800 mb-1 text-center mt-3">Cookie Policy</p>
                                    <p className="pb-4">We use essential cookies to provide our services and optional cookies to improve user experience. You can manage your preferences in settings.</p>
                                </div>
                                <p className="text-[10px] text-center text-slate-400 mt-1.5 flex justify-center items-center gap-1">
                                    <span className="animate-bounce">↓</span> Scroll to read all terms
                                </p>
                            </div>

                            <div className="space-y-3">
                                <label className={`flex items-start gap-3 ${!scrolledToBottom ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} transition-opacity`}>
                                    <input type="checkbox" disabled={!scrolledToBottom} checked={agreedTerms} onChange={e => setAgreedTerms(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed cursor-pointer" />
                                    <span className="text-xs text-slate-600 leading-tight">
                                        I have read and agree to the <span className="text-blue-600 font-medium">Terms of Service</span> and <span className="text-blue-600 font-medium">Privacy Policy</span> (Required)
                                    </span>
                                </label>
                                
                                <label className={`flex items-start gap-3 ${!scrolledToBottom ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} transition-opacity`}>
                                    <input type="checkbox" disabled={!scrolledToBottom} checked={agreedMarketing} onChange={e => setAgreedMarketing(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed cursor-pointer" />
                                    <span className="text-xs text-slate-600 leading-tight">
                                        I consent to receiving property alerts via Email/WhatsApp (Optional)
                                    </span>
                                </label>

                                <label className={`flex items-start gap-3 ${!scrolledToBottom ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} transition-opacity`}>
                                    <input type="checkbox" disabled={!scrolledToBottom} checked={agreedData} onChange={e => setAgreedData(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed cursor-pointer" />
                                    <span className="text-xs text-slate-600 leading-tight">
                                        I consent to RentPe sharing my profile with property owners for bookings (Required)
                                    </span>
                                </label>
                            </div>

                            <Button 
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading || !scrolledToBottom || !agreedTerms || !agreedData || password.length < 8 || !checks.upper || !checks.lower || !checks.number}
                                className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg shadow-blue-600/20"
                            >
                                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "🚀 Create Account"}
                            </Button>
                            {!scrolledToBottom && (
                                <p className="text-[10px] text-center text-slate-400 mt-2">Must scroll and tick required boxes to enable</p>
                            )}
                        </div>
                    )}
                    
                    {step === 1 && (
                        <div className="text-center mt-6 text-sm text-slate-500">
                            Already have an account?{" "}
                            <Link href="/login" className="text-blue-600 font-bold hover:underline">Sign in</Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
