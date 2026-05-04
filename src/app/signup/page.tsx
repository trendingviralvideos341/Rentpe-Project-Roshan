"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { signup } from "@/actions/auth";
import { CheckCircle, XCircle, Loader2, Info } from "lucide-react";
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
        sublabel1: "Working Professional",
        sublabel2: "Others",
        gradient: "from-blue-600 to-indigo-600",
        selectedBg: "bg-gradient-to-br from-blue-600 to-indigo-600",
        border: "border-blue-500",
        ring: "ring-blue-300",
    },
    {
        value: "OWNER",
        emoji: "🏢",
        label: "Property Owner",
        sublabel1: "PG / Hostel / Coliving",
        sublabel2: "Building Owner",
        gradient: "from-orange-500 to-amber-500",
        selectedBg: "bg-gradient-to-br from-orange-500 to-amber-500",
        border: "border-orange-400",
        ring: "ring-orange-200",
    },
];

export default function SignupPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [middleName, setMiddleName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [phone, setPhone] = useState("");
    const [role, setRole] = useState("USER");
    const [showPassword, setShowPassword] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [otpStep, setOtpStep] = useState(false);
    const [otp, setOtp] = useState("");
    const [otpError, setOtpError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [resendCooldown, setResendCooldown] = useState(0); // seconds remaining;

    const { checks, passed } = getStrength(password);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        // Validation
        const fnErr = validateName(firstName);
        const lnErr = validateName(lastName);
        const emErr = validateEmail(email);
        const phErr = validatePhone(`+91${phone}`);
        if (fnErr || lnErr || emErr || phErr) {
            setFieldErrors({ firstName: fnErr, lastName: lnErr, email: emErr, phone: phErr });
            return;
        }

        if (password.length < 8) { setError("Password must be at least 8 characters long."); return; }
        if (!checks.upper || !checks.lower || !checks.number) {
            setError("Password must include uppercase, lowercase and a number.");
            return;
        }
        if (!agreed) {
            setError("Please agree to the Terms of Service and Privacy Policy to continue.");
            return;
        }

        setLoading(true);
        try {
            if (!otpStep) {
                // Step 1 — Send OTP to email
                const fullName = [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(" ");
                const res = await fetch('/api/auth/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, name: fullName }),
                });
                const data = await res.json();
                if (!res.ok || data.error) {
                    setError(data.error || 'Failed to send OTP. Please try again.');
                    setLoading(false);
                    return;
                }
                setOtpStep(true);
                setLoading(false);
                // Start resend cooldown (60s)
                setResendCooldown(60);
                const timer = setInterval(() => {
                    setResendCooldown(prev => {
                        if (prev <= 1) { clearInterval(timer); return 0; }
                        return prev - 1;
                    });
                }, 1000);
                return;
            }

            const fullName = [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(" ");
            const formData = new FormData();
            formData.set("name", fullName);
            formData.set("email", email);
            formData.set("password", password);
            formData.set("phone", `+91${phone}`);
            formData.set("role", role);
            formData.set("otp", otp);
            formData.set("agreed", agreed ? "true" : "false");
            
            // Honeypot field
            const formObj = e.target as HTMLFormElement;
            const hpValue = (formObj.elements.namedItem("hp") as HTMLInputElement)?.value;
            if (hpValue) formData.set("hp", hpValue);

            const result = await signup(formData);
            
            if (result?.error) {
                // If it's an OTP error, show it near the OTP field
                if (result.error.toLowerCase().includes("otp")) {
                    setOtpError(result.error);
                } else {
                    setError(result.error);
                }
            } else if (result?.success) {
                setSuccess(true);
                // Redirect after a short delay so they see the success message
                setTimeout(() => {
                    router.push("/login?signup=success");
                }, 2000);
            }
        } catch (err: any) {
            console.error("Signup error:", err);
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    if (success) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-muted/30 px-4 py-8">
                <Card className="w-full max-w-lg shadow-xl border-0 ring-1 ring-border text-center p-8">
                    <div className="flex flex-col items-center space-y-4">
                        <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="h-12 w-12 text-green-600" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-green-700">Registration Successful!</CardTitle>
                        <CardDescription className="text-lg">
                            Welcome to RentPe, <strong>{firstName}</strong>! Your account is verified and ready to use.
                        </CardDescription>
                        <p className="text-muted-foreground">Redirecting you to login...</p>
                        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-muted/30 px-4 py-8">
            <Card className="w-full max-w-lg shadow-xl border-0 ring-1 ring-border">
                <div className="h-2 rounded-t-xl bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600" />

                <CardHeader className="space-y-1 pt-6 text-center">
                    <CardTitle className="text-3xl font-bold">Create an account</CardTitle>
                    <CardDescription>Enter your details to get started with RentPe</CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    {/* Honeypot Bot Protection */}
                    <input type="text" name="hp" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
                    
                    <CardContent className="space-y-5">
                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200 flex items-start gap-2">
                                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                {error}
                            </div>
                        )}

                        {otpStep && (
                            <div className="bg-violet-50 border border-violet-200 rounded-xl p-5 space-y-3 animate-in fade-in zoom-in duration-300">
                                <h3 className="text-sm font-bold text-violet-900 border-b border-violet-100 pb-2 flex items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white text-[10px]">OTP</span>
                                    Verify your email address
                                </h3>
                                <p className="text-xs text-violet-700">A 6-digit verification code has been sent to <strong>{email}</strong></p>

                                {/* 🚧 Dev/Testing hint — remove when going live */}
                                {process.env.NODE_ENV !== 'production' && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-800 font-medium">
                                        🚧 Testing mode — use OTP: <span className="font-black tracking-widest">123456</span>
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <Input
                                        placeholder="Enter 6-digit OTP"
                                        className={`text-center text-lg tracking-[0.5em] font-black ${otpError ? "border-red-400" : "border-violet-300 focus:ring-violet-400"}`}
                                        value={otp}
                                        maxLength={6}
                                        onChange={e => {
                                            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                                            setOtp(v);
                                            setOtpError(null);
                                        }}
                                    />
                                    {otpError && <p className="text-[10px] text-red-500 text-center font-semibold">{otpError}</p>}
                                </div>
                                <p className="text-[10px] text-muted-foreground text-center">
                                    Didn&apos;t receive the code?{" "}
                                    {resendCooldown > 0 ? (
                                        <span className="text-violet-400">Resend in {resendCooldown}s</span>
                                    ) : (
                                        <button
                                            type="button"
                                            className="text-violet-600 font-bold hover:underline"
                                            onClick={async () => {
                                                const fullName = [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(" ");
                                                const res = await fetch('/api/auth/send-otp', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ email, name: fullName }),
                                                });
                                                const data = await res.json();
                                                if (data.error) { setOtpError(data.error); return; }
                                                setOtpError(null);
                                                setResendCooldown(60);
                                                const timer = setInterval(() => {
                                                    setResendCooldown(prev => {
                                                        if (prev <= 1) { clearInterval(timer); return 0; }
                                                        return prev - 1;
                                                    });
                                                }, 1000);
                                            }}
                                        >Resend OTP</button>
                                    )}
                                </p>
                            </div>
                        )}

                        {/* Role Chip Selector */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-foreground block text-center w-full bg-muted/50 py-1.5 rounded-lg border border-border/50 shadow-sm">
                                I am joining as:
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {ROLE_OPTIONS.map((opt) => {
                                    const isSelected = role === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            suppressHydrationWarning
                                            onClick={() => {
                                                setRole(opt.value);
                                                setAgreed(false);
                                            }}
                                            className={`relative flex flex-col items-center justify-center gap-1 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer min-h-[110px]
                                                ${isSelected
                                                    ? `${opt.selectedBg} border-transparent text-white shadow-lg scale-[1.02] ring-4 ${opt.ring}`
                                                    : `bg-card border-border hover:border-gray-400 text-foreground hover:shadow-md`
                                                }`}
                                        >
                                            {isSelected && (
                                                <CheckCircle className="absolute top-2 right-2 h-4 w-4 text-white/80" />
                                            )}
                                            <span className="text-3xl leading-none">{opt.emoji}</span>
                                            <span className="font-bold text-sm text-center leading-tight mt-1">{opt.label}</span>
                                            <span className={`text-[11px] text-center leading-tight ${isSelected ? "text-white/70" : "text-muted-foreground"}`}>
                                                {opt.sublabel1}
                                            </span>
                                            <span className={`text-[11px] text-center leading-tight ${isSelected ? "text-white/60" : "text-muted-foreground/70"}`}>
                                                {opt.sublabel2}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex gap-3 items-center">
                                <Info className="h-4 w-4 text-blue-600 shrink-0" />
                                <p className="text-[10px] text-blue-800 italic leading-relaxed">
                                    {role === "OWNER"
                                        ? "Legal Eligibility: By registering as an Owner, you confirm you are 18+ and have full legal authority to list and manage rental accommodations."
                                        : "Legal Eligibility: By registering as a Student/Tenant, you confirm you are 18+ or have express guardian consent to book accommodation."}
                                </p>
                            </div>
                        </div>

                        {/* Name — First / Middle / Last */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Full Name</label>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <Input id="firstName" placeholder="First name" required
                                        className={fieldErrors.firstName ? "border-red-400" : ""}
                                        value={firstName} onChange={e => {
                                            const v = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                                            setFirstName(v);
                                            const err = v.length > 0 ? validateName(v) : "";
                                            setFieldErrors(p => { const n = { ...p }; if (err) n.firstName = err; else delete n.firstName; return n; });
                                        }} />
                                    {fieldErrors.firstName && <p className="text-[10px] text-red-500">{fieldErrors.firstName}</p>}
                                    <p className="text-[10px] text-muted-foreground text-center">First</p>
                                </div>
                                <div className="space-y-1">
                                    <Input placeholder="Middle name"
                                        value={middleName} onChange={e => {
                                            const v = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                                            setMiddleName(v);
                                        }} />
                                    <p className="text-[10px] text-muted-foreground text-center">Middle <span className="opacity-60">(optional)</span></p>
                                </div>
                                <div className="space-y-1">
                                    <Input placeholder="Last name" required
                                        className={fieldErrors.lastName ? "border-red-400" : ""}
                                        value={lastName} onChange={e => {
                                            const v = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                                            setLastName(v);
                                            const err = v.length > 0 ? validateName(v) : "";
                                            setFieldErrors(p => { const n = { ...p }; if (err) n.lastName = err; else delete n.lastName; return n; });
                                        }} />
                                    {fieldErrors.lastName && <p className="text-[10px] text-red-500">{fieldErrors.lastName}</p>}
                                    <p className="text-[10px] text-muted-foreground text-center">Last</p>
                                </div>
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-1">
                            <label htmlFor="email" className="text-sm font-medium">Email</label>
                            <Input id="email" placeholder="john@example.com" type="email" required
                                className={fieldErrors.email ? "border-red-400" : ""}
                                value={email} onChange={e => {
                                    setEmail(e.target.value);
                                    const err = e.target.value.length > 3 ? validateEmail(e.target.value) : "";
                                    setFieldErrors(p => { const n = { ...p }; if (err) n.email = err; else delete n.email; return n; });
                                }} />
                            {fieldErrors.email && <p className="text-xs text-red-500">{fieldErrors.email}</p>}
                        </div>

                        {/* Mobile Number */}
                        <div className="space-y-1">
                            <label htmlFor="phone" className="text-sm font-medium">Mobile Number</label>
                            <div className="flex rounded-lg border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0">
                                <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-muted border-r border-input text-sm font-semibold text-foreground select-none whitespace-nowrap shrink-0">
                                    <span className="text-muted-foreground font-bold">+91</span>
                                </span>
                                <input
                                    id="phone"
                                    name="phone"
                                    placeholder="98765 43210"
                                    type="tel"
                                    required
                                    maxLength={10}
                                    suppressHydrationWarning
                                    className={`flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground ${fieldErrors.phone ? "border-red-400" : ""}`}
                                    value={phone}
                                    onChange={e => {
                                        const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                                        setPhone(v);
                                        const err = v.length === 10 ? validatePhone(`+91${v}`) : "";
                                        setFieldErrors(p => {
                                            const n = { ...p };
                                            if (err) n.phone = err; else delete n.phone;
                                            return n;
                                        });
                                    }}
                                />
                            </div>
                            {fieldErrors.phone && <p className="text-xs text-red-500">{fieldErrors.phone}</p>}
                            <p className="text-[10px] text-muted-foreground italic">Standard Indian 10-digit mobile number</p>
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-medium">Password</label>
                            <div className="relative">
                                <Input
                                    id="password" name="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Min. 8 chars, A-Z, 0-9…" required
                                    value={password} onChange={e => setPassword(e.target.value)} className="pr-12"
                                />
                                <button type="button" onClick={() => setShowPassword(v => !v)}
                                    title={showPassword ? "Hide password" : "Show password"}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xl leading-none select-none hover:scale-125 transition-transform duration-200"
                                    tabIndex={-1}>
                                    {showPassword ? "🐵" : "🙈"}
                                </button>
                            </div>

                            {password.length > 0 && (
                                <div className="space-y-2 pt-1">
                                    <div className="flex gap-1 h-1.5">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <div key={i}
                                                className={`flex-1 rounded-full transition-all duration-300 ${i <= passed ? strengthColor[passed] : "bg-muted"}`}
                                            />
                                        ))}
                                    </div>
                                    <p className={`text-xs font-semibold ${strengthText[passed]}`}>{strengthLabel[passed]}</p>
                                    <div className="grid grid-cols-2 gap-1 text-xs">
                                        {([
                                            ["8+ characters", checks.length],
                                            ["Uppercase (A-Z)", checks.upper],
                                            ["Lowercase (a-z)", checks.lower],
                                            ["Number (0-9)", checks.number],
                                            ["Special character", checks.special],
                                        ] as [string, boolean][]).map(([label, ok]) => (
                                            <div key={label} className={`flex items-center gap-1 ${ok ? "text-green-600" : "text-muted-foreground"}`}>
                                                {ok ? <CheckCircle className="h-3 w-3 shrink-0" /> : <XCircle className="h-3 w-3 shrink-0" />}
                                                {label}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>

                    <CardFooter className="flex flex-col space-y-4">
                        {/* ⚖️ Granular Consent (DPDP Act Compliance) */}
                        <div className="space-y-3 pt-2">
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    name="agreed"
                                    suppressHydrationWarning
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                                    required
                                    checked={agreed}
                                    onChange={e => setAgreed(e.target.checked)}
                                />
                                <span className="text-xs text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors uppercase tracking-wider font-bold">
                                    I AGREE TO THE{" "}
                                    <Link
                                        href={role === "OWNER" ? "/terms/owner" : "/terms/tenant"}
                                        target="_blank"
                                        className="text-violet-600 underline"
                                    >
                                        {role === "OWNER" ? "OWNER TERMS" : "TENANT TERMS"}
                                    </Link>{" "}
                                    AND{" "}
                                    <Link href="/privacy" target="_blank" className="text-violet-600 underline">PRIVACY POLICY</Link>
                                    {" "}(REQUIRED)
                                </span>
                            </label>

                            <label className="flex items-start gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    name="marketingAgreed"
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                                />
                                <span className="text-xs text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
                                    {role === "OWNER" 
                                        ? "I consent to receiving leads, platform updates, and business marketing via Email/SMS/WhatsApp. (Optional)"
                                        : "I consent to receiving property alerts, offers, and marketing updates via Email/SMS/WhatsApp. (Optional)"}
                                </span>
                            </label>

                            <label className="flex items-start gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    name="dataSharingAgreed"
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                                />
                                <span className="text-xs text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
                                    {role === "OWNER"
                                        ? "I consent to RentPe sharing my verified owner profile and property details with potential tenants and RentPe Business for booking management and trust verification. (Required)"
                                        : "I consent to RentPe sharing my verified tenant profile with property owners for faster background checks and booking reliability. (Required)"}
                                </span>
                            </label>
                        </div>
                        <Button
                            className="w-full bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 hover:from-violet-700 hover:via-purple-700 hover:to-blue-700 text-white font-bold text-base py-5 shadow-lg hover:shadow-xl transition-all"
                            type="submit" disabled={loading}>
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    {otpStep ? "Verifying..." : "Sending OTP..."}
                                </span>
                            ) : (
                                <span>{otpStep ? "✅ Verify & Create Account" : "🚀 Get Started & Send OTP"}</span>
                            )}
                        </Button>
                        <div className="text-center text-sm text-muted-foreground">
                            Already have an account?{" "}
                            <Link href="/login" className="text-purple-600 font-semibold hover:underline">Sign in</Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
