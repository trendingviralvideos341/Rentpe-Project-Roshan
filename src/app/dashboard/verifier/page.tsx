"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPendingVerifications, getAllVerifications } from "@/actions/onboarding";
import { Clock, CheckCircle2, XCircle, ClipboardList } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function VerifierOverviewPage() {
    const [all, setAll] = useState<any[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const allRecs = await getAllVerifications();
            setAll(allRecs);
            const pending = await getPendingVerifications();
            setPendingCount(pending.length);
        } catch { }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const stats = [
        { label: "Pending Review", value: pendingCount, icon: Clock, color: "text-amber-500" },
        { label: "In Queue", value: all.filter(r => r.status === "PENDING_VERIFICATION").length, icon: ClipboardList, color: "text-blue-500" },
        { label: "Verified", value: all.filter(r => r.status === "VERIFIED").length, icon: CheckCircle2, color: "text-green-500" },
        { label: "Rejected", value: all.filter(r => r.status === "REJECTED").length, icon: XCircle, color: "text-red-500" },
    ];

    if (loading) return <div className="p-20 text-center animate-pulse">Loading...</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold">Verification Team</h1>
                    <p className="text-muted-foreground mt-1">Review and verify owner onboarding submissions</p>
                </div>
                <Link href="/dashboard/verifier/reviews">
                    <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 gap-2">
                        📋 Review Queue {pendingCount > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{pendingCount}</span>}
                    </Button>
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                {stats.map(s => {
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

            <div>
                <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
                {all.length === 0 ? (
                    <Card className="p-8 text-center text-muted-foreground">No records yet.</Card>
                ) : (
                    <div className="space-y-3">
                        {all.slice(0, 8).map(r => {
                            const sc: Record<string, string> = { PENDING_VERIFICATION: "bg-indigo-100 text-indigo-700", VERIFIED: "bg-green-100 text-green-700", REJECTED: "bg-red-100 text-red-700" };
                            const sl: Record<string, string> = { PENDING_VERIFICATION: "🔍 Pending", VERIFIED: "✅ Verified", REJECTED: "❌ Rejected" };
                            return (
                                <Card key={r.id} className="p-4 flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold">{r.displayId} — {r.ownerName}</p>
                                        <p className="text-sm text-muted-foreground">{r.buildingName} · {r.city}</p>
                                        <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString("en-IN")}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${sc[r.status] || "bg-gray-100"}`}>
                                        {sl[r.status] || r.status}
                                    </span>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
