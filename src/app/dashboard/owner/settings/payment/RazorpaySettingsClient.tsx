"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { updateOwnerRazorpayAccount } from "@/actions/platform";

export default function RazorpaySettingsClient({ initialAccountId }: { initialAccountId: string | null }) {
    const [accountId, setAccountId] = useState(initialAccountId || "");
    const [saving, setSaving] = useState(false);
    const [connected, setConnected] = useState(!!initialAccountId);

    const handleConnectDummy = async () => {
        setSaving(true);
        try {
            // DUMMY INTEGRATION: In a real app, this would be a Razorpay OAuth redirect
            const dummyId = "acc_" + Math.random().toString(36).substr(2, 9);
            await updateOwnerRazorpayAccount(dummyId);
            setAccountId(dummyId);
            setConnected(true);
            alert("✅ Successfully connected to Razorpay (DUMMY MODE)");
        } catch (e: any) {
            alert("Failed to connect: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm("Are you sure you want to disconnect? You won't receive automatic payouts.")) return;
        setSaving(true);
        try {
            await updateOwnerRazorpayAccount(null);
            setAccountId("");
            setConnected(false);
        } catch (e: any) {
            alert("Failed to disconnect: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h1 className="text-3xl font-bold">Payment Settings</h1>
                <p className="text-muted-foreground">Configure how you receive rent payments via Razorpay Route.</p>
            </div>

            <Card className={connected ? "border-green-200" : "border-indigo-200"}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <img src="https://razorpay.com/favicon.png" className="w-6 h-6" alt="Razorpay" />
                        Razorpay Route Configuration
                    </CardTitle>
                    <CardDescription>
                        Directly transfer rent to your bank account with automated fee deduction.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {connected ? (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-green-100 p-2 rounded-full">
                                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-green-800 text-lg">Account Connected</h3>
                                    <p className="text-sm text-green-700 font-mono">ID: {accountId}</p>
                                </div>
                            </div>
                            <div className="text-sm text-green-700 bg-white/50 p-3 rounded-md">
                                <p><strong>DUMMY MODE ACTIVE:</strong> Use this placeholder to test the bank routing logic. In production, this account ID is verified by Razorpay.</p>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" size="sm" className="bg-white border-green-300 text-green-700">
                                    <ExternalLink className="w-4 h-4 mr-2" /> View Dashboard
                                </Button>
                                <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleDisconnect} disabled={saving}>
                                    Disconnect Account
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="border rounded-lg p-4 space-y-2">
                                    <ShieldCheck className="w-6 h-6 text-indigo-600" />
                                    <h4 className="font-bold">Safe & Secure</h4>
                                    <p className="text-xs text-muted-foreground">Your bank details are never stored on our servers. Razorpay handles everything.</p>
                                </div>
                                <div className="border rounded-lg p-4 space-y-2">
                                    <ExternalLink className="w-6 h-6 text-indigo-600" />
                                    <h4 className="font-bold">Instant Payouts</h4>
                                    <p className="text-xs text-muted-foreground">Rent is split automatically. You get your share within 24 hours.</p>
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                                <p className="text-xs text-amber-800">
                                    <strong>Important:</strong> You must have a verified Razorpay Merchant account to use Route.
                                    RentPe will deduct a flat platform fee per transaction as per the latest terms.
                                </p>
                            </div>

                            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-lg font-bold" onClick={handleConnectDummy} disabled={saving}>
                                {saving ? "Connecting..." : "Connect your Razorpay Account (Dummy)"}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="bg-slate-50 p-4 rounded-lg border border-dashed border-slate-300">
                <h4 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-tight">Technical Note for Dev</h4>
                <p className="text-xs text-slate-600 leading-relaxed italic">
                   DUMMY INTEGRATION: This page currently simulates the Razorpay Route onboarding.
                   To finalize: Integrate Razorpay OAuth or Account API here to get the real merchant account ID.
                   File: src/app/dashboard/owner/settings/payment/RazorpaySettingsClient.tsx
                </p>
            </div>
        </div>
    );
}
