"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Lock, Eye, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { executePasswordReset } from "@/actions/password-reset";

import { Suspense } from "react";

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState("");

    // If no token is present in the URL, show an error immediately
    if (!token) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
                <Card className="w-full max-w-md border-none shadow-xl text-center p-8 space-y-4">
                    <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
                    <h2 className="text-xl font-bold text-slate-800">Invalid Reset Link</h2>
                    <p className="text-slate-600">This password reset link is missing or invalid. Please request a new one.</p>
                    <Link href="/forgot-password">
                        <Button className="mt-4 w-full bg-blue-600">Request New Link</Button>
                    </Link>
                </Card>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setIsLoading(true);
        try {
            const res = await executePasswordReset(token, password);
            if (res.success) {
                setIsSuccess(true);
                // Optionally redirect to login after a few seconds
                setTimeout(() => router.push("/login"), 3000);
            } else {
                setError(res.error || "Failed to reset password.");
            }
        } catch (e) {
            setError("An unexpected error occurred. The link might have expired.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
                <Card className="w-full max-w-md border-none shadow-xl text-center p-8 space-y-6">
                    <div className="flex justify-center">
                        <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="h-10 w-10 text-green-600" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold mb-2">Password Reset!</h2>
                        <p className="text-slate-600">Your password has been changed successfully. You will be redirected to the login page momentarily.</p>
                    </div>
                    <Link href="/login">
                        <Button className="w-full h-11 bg-blue-600">Go to Login</Button>
                    </Link>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
            <Link href="/" className="flex items-center gap-2 mb-8 hover:opacity-80 transition-opacity">
                <div className="bg-blue-600 p-2 rounded-xl">
                    <Building2 className="h-6 w-6 text-white" />
                </div>
                <span className="text-2xl font-black tracking-tighter bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
                    RentPe.
                </span>
            </Link>

            <Card className="w-full max-w-md border-none shadow-xl">
                <CardHeader className="space-y-2 pb-6">
                    <CardTitle className="text-2xl font-bold text-center">Create New Password</CardTitle>
                    <CardDescription className="text-center">
                        Your new password must be at least 6 characters long.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-semibold flex items-center gap-2">
                                <Lock className="h-4 w-4" /> New Password
                            </label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter new password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="h-11 pr-10"
                                    disabled={isLoading}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Confirm New Password</label>
                            <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Confirm new password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="h-11"
                                disabled={isLoading}
                                required
                            />
                        </div>

                        <Button
                            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold mt-2"
                            type="submit"
                            disabled={isLoading}
                        >
                            {isLoading ? "Resetting Password..." : "Secure My Account"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <ResetPasswordForm />
        </Suspense>
    );
}
