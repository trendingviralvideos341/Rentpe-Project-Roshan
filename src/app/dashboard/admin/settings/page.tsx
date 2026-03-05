"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { getPlatformSettings, updatePlatformSettings } from "@/actions/platform";
import { Settings, Shield, Globe, Bell, Database } from "lucide-react";

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const data = await getPlatformSettings();
                setSettings(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading settings...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Platform Settings</h1>
                <p className="text-muted-foreground">Configure system-wide settings and preferences.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* General */}
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
                        <p className="text-xs text-muted-foreground">Contact the development team to modify these values.</p>
                    </CardContent>
                </Card>

                {/* Fees Summary */}
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
                        {settings ? (
                            <>
                                <div className="flex justify-between items-center py-2 border-b">
                                    <span className="text-sm text-muted-foreground">Fees Enabled</span>
                                    <span className={`text-sm font-bold ${settings.feesEnabled ? 'text-green-600' : 'text-red-600'}`}>
                                        {settings.feesEnabled ? 'Yes' : 'No'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b">
                                    <span className="text-sm text-muted-foreground">Customer (Student) Fee</span>
                                    <span className="text-sm font-mono text-blue-700 font-bold">₹{settings.studentRentFeeFlat || 9} flat / rent</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b">
                                    <span className="text-sm text-muted-foreground">Owner Rent Fee</span>
                                    <span className="text-sm font-mono text-orange-700 font-bold">₹{settings.ownerRentFeeFlat || 9} flat / rent</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b">
                                    <span className="text-sm text-muted-foreground">Owner Onboarding Fee</span>
                                    <span className="text-sm font-mono text-green-700 font-bold">₹{settings.ownerOnboardingFeeFlat || 99} once / PG</span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-sm text-muted-foreground">Wallet Balance</span>
                                    <span className="text-sm font-mono font-bold">₹{settings.platformWalletBalance?.toLocaleString() || '0'}</span>
                                </div>
                                <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => window.location.href = '/dashboard/admin/platform-fees'}>
                                    Manage Fees →
                                </Button>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">Unable to load fee settings.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Security */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-500/10 rounded-lg">
                                <Shield className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Security</CardTitle>
                                <CardDescription>Authentication and access control</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-sm text-muted-foreground">Auth Method</span>
                            <span className="text-sm font-medium">Email + Password (JWT)</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-sm text-muted-foreground">Session Duration</span>
                            <span className="text-sm font-mono">7 days</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-sm text-muted-foreground">User Roles</span>
                            <span className="text-sm">USER, OWNER, ADMIN, ONBOARDER, VERIFIER</span>
                        </div>
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
                                <CardDescription>Database and storage configuration</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-sm text-muted-foreground">Database</span>
                            <span className="text-sm font-medium">SQLite (Prisma ORM)</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-sm text-muted-foreground">Max Upload Size</span>
                            <span className="text-sm font-mono">5 MB</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-sm text-muted-foreground">Audit Logging</span>
                            <span className="text-sm font-medium text-green-600">Enabled</span>
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
