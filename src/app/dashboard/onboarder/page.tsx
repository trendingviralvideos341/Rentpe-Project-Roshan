"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllOnboardings, getPendingOnboardingQueue } from "@/actions/onboarding";
import { getSession } from "@/lib/auth";
import { ClipboardList, Clock, CheckCircle2, XCircle, UserCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function OnboarderOverviewPage() {
    const [records, setRecords] = useState<any[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [agent, setAgent] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const all = await getAllOnboardings();
            setRecords(all);
            const pending = await getPendingOnboardingQueue();
            setPendingCount(pending.length);
        } catch (e) { /* ignore */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const stats = [
        { label: "Pending Queue", value: pendingCount, icon: Clock, color: "text-amber-500" },
        { label: "In Verification", value: records.filter(r => r.status === "PENDING_VERIFICATION").length, icon: ClipboardList, color: "text-blue-500" },
        { label: "Verified", value: records.filter(r => r.status === "VERIFIED").length, icon: CheckCircle2, color: "text-green-500" },
        { label: "Rejected", value: records.filter(r => r.status === "REJECTED").length, icon: XCircle, color: "text-red-500" },
    ];

    if (loading) return <div className="p-20 text-center animate-pulse">Loading...</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold">Onboarding Team</h1>
                    <p className="text-muted-foreground mt-1">Manage owner onboarding requests and field visits</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/dashboard/onboarder/queue">
                        <Button variant="outline">📋 View Queue</Button>
                    </Link>
                    <Link href="/dashboard/onboarder/new">
                        <Button className="bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:from-violet-700 hover:to-blue-700">
                            ➕ New Field Visit
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                {stats.map((s) => {
                    const Icon = s.icon;
                    return (
                        <Card key={s.label}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
                                <Icon className={`h-4 w-4 ${s.color}`} />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Recent Submissions */}
            <div>
                <h2 className="text-lg font-semibold mb-3">Recent Submissions</h2>
                {records.length === 0 ? (
                    <Card className="p-8 text-center text-muted-foreground">No onboarding submissions yet.</Card>
                ) : (
                    <div className="space-y-3">
                        {records.slice(0, 6).map((r) => (
                            <Card key={r.id} className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="font-semibold">{r.displayId} — {r.ownerName}</p>
                                    <p className="text-sm text-muted-foreground">{r.buildingName} · {r.city}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(r.createdAt).toLocaleString("en-IN")}</p>
                                </div>
                                <StatusBadge status={r.status} />
                            </Card>
                        ))}
                        {records.length > 6 && (
                            <Link href="/dashboard/onboarder/submissions" className="text-sm text-purple-600 hover:underline">
                                View all {records.length} submissions →
                            </Link>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        PENDING_ONBOARDING: "bg-amber-100 text-amber-700",
        ACCEPTED_BY_ONBOARDER: "bg-blue-100 text-blue-700",
        PENDING_VERIFICATION: "bg-indigo-100 text-indigo-700",
        VERIFIED: "bg-green-100 text-green-700",
        REJECTED: "bg-red-100 text-red-700",
    };
    const labels: Record<string, string> = {
        PENDING_ONBOARDING: "⏳ Pending",
        ACCEPTED_BY_ONBOARDER: "✅ Accepted",
        PENDING_VERIFICATION: "🔍 In Verification",
        VERIFIED: "✅ Verified",
        REJECTED: "❌ Rejected",
    };
    return (
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${map[status] || "bg-gray-100 text-gray-700"}`}>
            {labels[status] || status}
        </span>
    );
}
