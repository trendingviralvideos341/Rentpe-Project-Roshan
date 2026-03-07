"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { requestPasswordReset } from "@/actions/password-reset";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!email) {
            setError("Please enter your email address.");
            return;
        }

        setIsLoading(true);
        try {
            const res = await requestPasswordReset(email);
            if (res.success) {
                setIsSubmitted(true);
            } else {
                setError(res.error || "Failed to request password reset.");
            }
        } catch (e) {
            setError("An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

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
                {!isSubmitted ? (
                    <>
                        <CardHeader className="space-y-2 pb-6">
                            <CardTitle className="text-2xl font-bold text-center">Forgot Password?</CardTitle>
                            <CardDescription className="text-center">
                                Enter the email address associated with your account and we'll send you a secure link to reset your password.
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
                                        <Mail className="h-4 w-4" /> Email Address
                                    </label>
                                    <Input
                                        type="email"
                                        placeholder="Enter your registered email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="h-11"
                                        disabled={isLoading}
                                    />
                                </div>
                                <Button
                                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold"
                                    type="submit"
                                    disabled={isLoading}
                                >
                                    {isLoading ? "Sending Link..." : "Send Reset Link"}
                                </Button>
                            </form>
                        </CardContent>
                        <CardFooter className="flex justify-center border-t p-6">
                            <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                <ArrowLeft className="h-4 w-4" /> Back to Login
                            </Link>
                        </CardFooter>
                    </>
                ) : (
                    <div className="p-8 text-center space-y-6">
                        <div className="flex justify-center">
                            <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="h-10 w-10 text-green-600" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold mb-2">Check your email</h2>
                            <p className="text-slate-600">
                                We've sent a secure password reset link to <strong>{email}</strong>.
                                <br /><br />
                                <span className="text-xs text-amber-600 font-medium p-2 bg-amber-50 rounded">
                                    🚨 MVP Note: Since email is disabled, please check your Terminal/Server Console to click the link.
                                </span>
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            className="w-full h-11"
                            onClick={() => setIsSubmitted(false)}
                        >
                            Try another email
                        </Button>
                        <Link href="/login" className="block text-sm font-medium text-blue-600 hover:text-blue-800">
                            Return to Login
                        </Link>
                    </div>
                )}
            </Card>
        </div>
    );
}
