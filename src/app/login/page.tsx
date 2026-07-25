"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { login, resendVerificationEmail } from "@/actions/auth";
import { toast } from "sonner";
import { XCircle } from "lucide-react";

export default function LoginPage() {
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [require2FA, setRequire2FA] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [twoFactorCode, setTwoFactorCode] = useState("");
    const [verifying2FA, setVerifying2FA] = useState(false);

    async function handleLoginAction(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.set("email", email);
            formData.set("password", password);

            const result = await login(formData);

            if (result?.require2FA) {
                setUserId(result.userId);
                setRequire2FA(true);
                setLoading(false);
            } else if (result?.error) {
                setError(result.error);
                setLoading(false);
            } else {
                // Success (redirect handled by server action or similar)
            }
        } catch (err: any) {
            console.error("Login error:", err);
            // Catch Next.js server action errors which often happen on 429 rate limit or network failure
            setError("Too many requests or network error. Please wait a moment and try again.");
            setLoading(false);
        }
    }

    async function handle2FAVerify(e: React.FormEvent) {
        e.preventDefault();
        if (!userId) return;
        setVerifying2FA(true);
        setError(null);

        const { verify2FALogin } = await import("@/actions/auth");
        const result = await verify2FALogin(userId, twoFactorCode);

        if (result?.error) {
            setError(result.error);
            setVerifying2FA(false);
        } else if (result?.redirect) {
            window.location.href = result.redirect;
        }
    }

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-muted/30 px-4">
            <Card className="w-full max-w-md shadow-xl border-0 ring-1 ring-border">
                {/* Gradient accent bar */}
                <div className="h-2 rounded-t-xl bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600" />

                <CardHeader className="space-y-1 pt-6">
                    <CardTitle className="text-2xl font-bold">
                        {require2FA ? "Security Verification" : "Welcome back"}
                    </CardTitle>
                    <CardDescription>
                        {require2FA
                            ? "Enter the 6-digit code from your authenticator app"
                            : "Enter your credentials to sign in to your account"}
                    </CardDescription>
                </CardHeader>

                {!require2FA ? (
                    <form onSubmit={handleLoginAction}>
                        <CardContent className="space-y-4">
                            {error && (
                                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200 flex flex-col gap-2">
                                    <div className="flex items-start gap-2">
                                        <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                    {error.toLowerCase().includes("verified") && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="h-auto p-0 text-xs text-red-700 font-bold hover:bg-transparent hover:underline self-start ml-6"
                                            onClick={async () => {
                                                const loadingToast = toast.loading("Sending fresh link...");
                                                const result = await resendVerificationEmail(email);
                                                if (result.success) {
                                                    toast.success(result.message, { id: loadingToast });
                                                } else {
                                                    toast.error(result.error || "Failed to resend.", { id: loadingToast });
                                                }
                                            }}
                                        >
                                            Resend Verification Link →
                                        </Button>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-medium">Email</label>
                                <Input
                                    id="email"
                                    name="email"
                                    placeholder="owner@rentpe.com"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="password" className="text-sm font-medium">Password</label>
                                    <Link href="/auth/forgot-password" className="text-xs text-purple-600 hover:underline font-semibold">Forgot password?</Link>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter your password"
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="pr-12"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xl hover:scale-125 transition-transform"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? "🐵" : "🙈"}
                                    </button>
                                </div>
                            </div>
                        </CardContent>

                        <CardFooter className="flex flex-col space-y-4">
                            <Button
                                className="w-full bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 text-white font-bold py-5 shadow-lg"
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? "Signing In..." : "🔑 Sign In"}
                            </Button>
                            <div className="text-center text-sm text-muted-foreground">
                                Don&apos;t have an account? <Link href="/signup" className="text-purple-600 font-semibold hover:underline">Sign up</Link>
                            </div>
                        </CardFooter>
                    </form>
                ) : (
                    <form onSubmit={handle2FAVerify}>
                        <CardContent className="space-y-4">
                            {error && (
                                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200 flex items-start gap-2">
                                    <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label htmlFor="2fa-code" className="text-sm font-medium">Authentication Code</label>
                                <Input
                                    id="2fa-code"
                                    placeholder="000000"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={6}
                                    required
                                    value={twoFactorCode}
                                    onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                                    className="text-center text-2xl tracking-[0.5em] font-mono py-6"
                                />
                            </div>
                            <p className="text-xs text-center text-muted-foreground">
                                Open your 2FA app to see the code.
                            </p>
                        </CardContent>

                        <CardFooter className="flex flex-col space-y-4">
                            <Button
                                className="w-full bg-black text-white font-bold py-5 shadow-lg hover:bg-gray-800"
                                type="submit"
                                disabled={verifying2FA}
                            >
                                {verifying2FA ? "Verifying..." : "🛡️ Verify & Login"}
                            </Button>
                            <button
                                type="button"
                                onClick={() => setRequire2FA(false)}
                                className="text-sm text-muted-foreground hover:text-primary transition-colors"
                            >
                                ← Back to login
                            </button>
                        </CardFooter>
                    </form>
                )}
            </Card>
        </div>
    );
}
