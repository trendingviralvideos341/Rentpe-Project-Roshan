"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Key, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { joinStaffTeam } from "@/actions/staff";
import { toast } from "sonner";

function JoinTeamContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!token) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Card className="max-w-md w-full border-red-200 bg-red-50">
                    <CardContent className="pt-6 text-center space-y-4">
                        <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                        <h2 className="text-xl font-bold text-red-700">Invalid Invitation Link</h2>
                        <p className="text-sm text-red-600">The invitation link you followed is missing a valid security token. Please ask your team administrator for a new invite.</p>
                        <Button variant="outline" onClick={() => router.push("/")} className="w-full">Go to Home</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            const res = await joinStaffTeam(token, password);
            if (res.success) {
                setSuccess(true);
                toast.success("Account activated! Redirecting to login...");
                setTimeout(() => router.push("/login"), 3000);
            } else {
                setError(res.error || "Failed to activate account.");
            }
        } catch (err: any) {
            setError(err.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Card className="max-w-md w-full border-green-200 animate-in zoom-in-95 duration-500">
                    <CardContent className="pt-8 text-center space-y-6">
                        <div className="relative">
                            <div className="absolute inset-0 bg-green-200 blur-2xl opacity-20 animate-pulse rounded-full" />
                            <CheckCircle className="h-16 w-16 text-green-500 mx-auto relative z-10" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-green-800 tracking-tight">Welcome to the Team!</h2>
                            <p className="text-sm text-green-700 font-medium">Your account has been successfully set up. You can now log in using your email and the password you just created.</p>
                        </div>
                        <Button className="w-full bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100" onClick={() => router.push("/login")}>
                            Proceed to Login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-[80vh] px-4">
            <Card className="max-w-lg w-full border-2 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-purple-500 to-primary" />
                <CardHeader className="space-y-1 pt-8">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                        <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-3xl font-black tracking-tight">Join Your Team</CardTitle>
                    <CardDescription className="text-base">
                        You've been invited to join an organization on RentPe. Create a secure password to activate your dashboard.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pb-8">
                    <form onSubmit={handleJoin} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-bold flex items-center gap-2">
                                <Key className="h-4 w-4" /> Create New Password
                            </label>
                            <Input 
                                type="password" 
                                placeholder="••••••••" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-12 focus-visible:ring-primary border-muted-foreground/20"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold">Confirm Your Password</label>
                            <Input 
                                type="password" 
                                placeholder="••••••••" 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="h-12 focus-visible:ring-primary border-muted-foreground/20"
                                required
                            />
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-top-1">
                                <AlertCircle className="h-4 w-4 inline mr-2" />
                                {error}
                            </div>
                        )}

                        <Button 
                            disabled={loading} 
                            type="submit" 
                            className="w-full h-12 text-lg font-black tracking-wide shadow-xl transition-all active:scale-95"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                    Activating Account...
                                </>
                            ) : (
                                "Activate Staff Account"
                            )}
                        </Button>
                        <p className="text-center text-xs text-muted-foreground">
                            By joining, you agree to our terms of service and security policies.
                        </p>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

export default function JoinTeamPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-[80vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <JoinTeamContent />
        </Suspense>
    );
}
