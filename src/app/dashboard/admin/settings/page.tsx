"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getPlatformSettings, updatePlatformSettings } from "@/actions/platform";
import { getCurrentUser } from "@/actions/auth";
import { setup2FA, confirm2FA, disable2FA } from "@/actions/2fa";
import { Settings, Shield, Globe, Bell, Database, CheckCircle, AlertTriangle, Key } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState<any>(null);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // 2FA Setup State
    const [is2FALoading, setIs2FALoading] = useState(false);
    const [twoFactorStep, setTwoFactorStep] = useState<'IDLE' | 'SETUP' | 'VERIFY'>('IDLE');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [secret, setSecret] = useState<string | null>(null);
    const [verificationCode, setVerificationCode] = useState("");
    const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const [sData, uData] = await Promise.all([
                    getPlatformSettings(),
                    getCurrentUser()
                ]);
                setSettings(sData);
                setUser(uData);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    async function handleStart2FASetup() {
        setIs2FALoading(true);
        setTwoFactorError(null);
        try {
            const res = await setup2FA();
            setQrCode(res.qrCode);
            setSecret(res.secret);
            setTwoFactorStep('SETUP');
        } catch (e: any) {
            setTwoFactorError(e.message || "Failed to start 2FA setup");
        } finally {
            setIs2FALoading(false);
        }
    }

    async function handleConfirm2FA() {
        if (!verificationCode) return;
        setIs2FALoading(true);
        setTwoFactorError(null);
        try {
            const res = await confirm2FA(verificationCode);
            if (res.error) {
                setTwoFactorError(res.error);
            } else {
                setTwoFactorStep('IDLE');
                setUser({ ...user, twoFactorEnabled: true });
                setVerificationCode("");
            }
        } catch (e: any) {
            setTwoFactorError(e.message || "Validation failed");
        } finally {
            setIs2FALoading(false);
        }
    }

    async function handleDisable2FA() {
        if (!verificationCode) {
            setTwoFactorStep('VERIFY'); // Prompt for code to disable
            return;
        }
        setIs2FALoading(true);
        setTwoFactorError(null);
        try {
            const res = await disable2FA(verificationCode);
            if (res.error) {
                setTwoFactorError(res.error);
            } else {
                setTwoFactorStep('IDLE');
                setUser({ ...user, twoFactorEnabled: false });
                setVerificationCode("");
            }
        } catch (e: any) {
            setTwoFactorError(e.message || "Failed to disable 2FA");
        } finally {
            setIs2FALoading(false);
        }
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading settings...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Platform Settings</h1>
                <p className="text-muted-foreground">Configure system-wide settings and preferences.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 pb-20">
                {/* General & Fee cards as before... */}
                {/* [Keep existing cards...] */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Globe className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">General</CardTitle>
                                <CardDescription>Platform name, branding, and display</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium block mb-1">Platform Name</label>
                            <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" value="RentPe" disabled />
                        </div>
                        <div>
                            <label className="text-sm font-medium block mb-1">Support Email</label>
                            <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" value="support@rentpe.in" disabled />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-lg">
                                <Settings className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Fee Configuration</CardTitle>
                                <CardDescription>Current platform fee structure</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-sm text-muted-foreground">Fees Enabled</span>
                            <span className={`text-sm font-bold ${settings?.feesEnabled ? 'text-green-600' : 'text-red-600'}`}>
                                {settings?.feesEnabled ? 'Yes' : 'No'}
                            </span>
                        </div>
                        <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => window.location.href = '/dashboard/admin/platform-fees'}>
                            Manage Fees →
                        </Button>
                    </CardContent>
                </Card>

                {/* New Two-Factor Authentication Card */}
                <Card className={user?.twoFactorEnabled ? "border-green-200 bg-green-50/20" : "border-amber-200 bg-amber-50/20"}>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${user?.twoFactorEnabled ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
                                    <Shield className={`h-5 w-5 ${user?.twoFactorEnabled ? 'text-green-600' : 'text-amber-600'}`} />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Two-Factor Authentication</CardTitle>
                                    <CardDescription>Secure your admin account with TOTP</CardDescription>
                                </div>
                            </div>
                            {user?.twoFactorEnabled && (
                                <div className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full border border-green-200">
                                    <CheckCircle className="h-3 w-3" /> ENABLED
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {twoFactorStep === 'IDLE' && (
                            <>
                                <p className="text-sm text-muted-foreground italic">
                                    {user?.twoFactorEnabled 
                                        ? "Your account is protected with 2FA. We recommend keeping this enabled."
                                        : "Enhance your account security by requiring a code from your phone whenever you log in."}
                                </p>
                                {user?.twoFactorEnabled ? (
                                    <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setTwoFactorStep('VERIFY')}>
                                        Disable 2FA
                                    </Button>
                                ) : (
                                    <Button className="w-full bg-black text-white" onClick={handleStart2FASetup} disabled={is2FALoading}>
                                        {is2FALoading ? "Initializing..." : "🛡️ Enable 2FA Now"}
                                    </Button>
                                )}
                            </>
                        )}

                        {twoFactorStep === 'SETUP' && (
                            <div className="space-y-4 text-center">
                                <p className="text-sm font-medium">1. Scan this QR Code with your Google Authenticator or Authy app</p>
                                {qrCode && (
                                    <div className="bg-white p-4 inline-block rounded-xl border-2 border-dashed border-gray-200">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={qrCode} alt="2FA QR Code" className="mx-auto" />
                                    </div>
                                )}
                                <p className="text-[10px] text-muted-foreground font-mono bg-white p-2 border rounded">
                                    Secret: {secret}
                                </p>
                                <div className="pt-2">
                                    <Button className="w-full" onClick={() => setTwoFactorStep('VERIFY')}>Next: Verify Code →</Button>
                                </div>
                            </div>
                        )}

                        {(twoFactorStep === 'VERIFY') && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">
                                        {user?.twoFactorEnabled ? "Enter code to disable 2FA" : "2. Enter the 6-digit code from your app"}
                                    </label>
                                    <Input 
                                        placeholder="000000" 
                                        maxLength={6} 
                                        value={verificationCode}
                                        onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                                        className="text-center text-xl font-mono tracking-widest"
                                    />
                                    {twoFactorError && <p className="text-xs text-red-600 font-medium">{twoFactorError}</p>}
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" className="flex-1" onClick={() => setTwoFactorStep('IDLE')}>Cancel</Button>
                                    <Button 
                                        className={`flex-1 ${user?.twoFactorEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
                                        onClick={user?.twoFactorEnabled ? handleDisable2FA : handleConfirm2FA}
                                        disabled={is2FALoading || verificationCode.length !== 6}
                                    >
                                        {is2FALoading ? "Verifying..." : user?.twoFactorEnabled ? "Confirm Disable" : "Verify & Enable"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Database */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 rounded-lg">
                                <Database className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Data & Storage</CardTitle>
                                <CardDescription>Configuration and audit logs</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-sm text-muted-foreground">Database</span>
                            <span className="text-sm font-medium">SQLite (Prisma)</span>
                        </div>
                        <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => window.location.href = '/dashboard/admin/data-management'}>
                            Data Management →
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
