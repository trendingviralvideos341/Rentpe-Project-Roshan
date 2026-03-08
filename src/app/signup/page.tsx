"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { signup } from "@/actions/auth";
import { CheckCircle, XCircle } from "lucide-react";
import { validateEmail, validateName, validatePhone } from "@/lib/validators";

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
        sublabel: "Working Professional · Others",
        gradient: "from-blue-600 to-indigo-600",
        selectedBg: "bg-gradient-to-br from-blue-600 to-indigo-600",
        border: "border-blue-500",
        ring: "ring-blue-300",
    },
    {
        value: "OWNER",
        emoji: "🏢",
        label: "Property Owner",
        sublabel: "PG · Hostel · Building Owner",
        gradient: "from-orange-500 to-amber-500",
        selectedBg: "bg-gradient-to-br from-orange-500 to-amber-500",
        border: "border-orange-400",
        ring: "ring-orange-200",
    },
];

export default function SignupPage() {
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [phone, setPhone] = useState("");
    const [role, setRole] = useState("USER");
    const [showPassword, setShowPassword] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const { checks, passed } = getStrength(password);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        // Final validation check before submit
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

        setLoading(true);
        const formData = new FormData();
        formData.set("firstName", firstName);
        formData.set("lastName", lastName);
        formData.set("email", email);
        formData.set("password", password);
        formData.set("phone", `+91${phone}`);
        formData.set("role", role);

        const result = await signup(formData);
        if (result?.error) { setError(result.error); setLoading(false); }
    }

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-muted/30 px-4 py-8">
            <Card className="w-full max-w-md shadow-xl border-0 ring-1 ring-border">
                <div className="h-2 rounded-t-xl bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600" />

                <CardHeader className="space-y-1 pt-6">
                    <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
                    <CardDescription>Enter your details to get started with RentPe</CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-5">
                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200 flex items-start gap-2">
                                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Role Chip Selector */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-foreground">I am joining as:</label>
                            <div className="grid grid-cols-2 gap-3">
                                {ROLE_OPTIONS.map((opt) => {
                                    const isSelected = role === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setRole(opt.value)}
                                            className={`relative flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer
                                                ${isSelected
                                                    ? `${opt.selectedBg} border-transparent text-white shadow-lg scale-[1.02] ring-4 ${opt.ring}`
                                                    : `bg-card border-border hover:border-gray-400 text-foreground hover:shadow-md`
                                                }`}
                                        >
                                            {isSelected && (
                                                <CheckCircle className="absolute top-2 right-2 h-4 w-4 text-white/80" />
                                            )}
                                            <span className="text-3xl leading-none">{opt.emoji}</span>
                                            <span className="font-bold text-sm text-center leading-tight">{opt.label}</span>
                                            <span className={`text-xs text-center leading-tight ${isSelected ? "text-white/70" : "text-muted-foreground"}`}>
                                                {opt.sublabel}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                                🔒 Onboarder &amp; Verifier roles are assigned by Admin only
                            </p>
                        </div>

                        {/* Name row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label htmlFor="firstName" className="text-sm font-medium">First name</label>
                                <Input id="firstName" name="firstName" placeholder="John" required
                                    className={fieldErrors.firstName ? "border-red-400" : ""}
                                    value={firstName} onChange={e => {
                                        const v = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                                        setFirstName(v);
                                        const err = v.length > 0 ? validateName(v) : "";
                                        setFieldErrors(p => { const n = { ...p }; if (err) n.firstName = err; else delete n.firstName; return n; });
                                    }} />
                                {fieldErrors.firstName && <p className="text-xs text-red-500">{fieldErrors.firstName}</p>}
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="lastName" className="text-sm font-medium">Last name</label>
                                <Input id="lastName" name="lastName" placeholder="Doe" required
                                    className={fieldErrors.lastName ? "border-red-400" : ""}
                                    value={lastName} onChange={e => {
                                        const v = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                                        setLastName(v);
                                        const err = v.length > 0 ? validateName(v) : "";
                                        setFieldErrors(p => { const n = { ...p }; if (err) n.lastName = err; else delete n.lastName; return n; });
                                    }} />
                                {fieldErrors.lastName && <p className="text-xs text-red-500">{fieldErrors.lastName}</p>}
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-1">
                            <label htmlFor="email" className="text-sm font-medium">Email</label>
                            <Input id="email" name="email" placeholder="john@example.com" type="email" required
                                className={fieldErrors.email ? "border-red-400" : ""}
                                value={email} onChange={e => {
                                    setEmail(e.target.value);
                                    const err = e.target.value.length > 3 ? validateEmail(e.target.value) : "";
                                    setFieldErrors(p => { const n = { ...p }; if (err) n.email = err; else delete n.email; return n; });
                                }} />
                            {fieldErrors.email && <p className="text-xs text-red-500">{fieldErrors.email}</p>}
                        </div>
                        
                        {/* Phone Number */}
                        <div className="space-y-1">
                            <label htmlFor="phone" className="text-sm font-medium">Mobile Number</label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 bg-muted text-xs font-bold text-muted-foreground select-none">
                                    🇮🇳 +91
                                </span>
                                <Input 
                                    id="phone" 
                                    name="phone" 
                                    placeholder="9876543210" 
                                    type="tel" 
                                    required
                                    maxLength={10}
                                    className={`rounded-l-none ${fieldErrors.phone ? "border-red-400" : ""}`}
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
                        <Button
                            className="w-full bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 hover:from-violet-700 hover:via-purple-700 hover:to-blue-700 text-white font-bold text-base py-5 shadow-lg hover:shadow-xl transition-all"
                            type="submit" disabled={loading}>
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    Creating Account...
                                </span>
                            ) : "🚀 Create My Account"}
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
