"use client";

import { useEffect, useState, useCallback } from "react";
import { getMyOnboardings } from "@/actions/onboarding";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function OnboarderSubmissionsPage() {
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try { setRecords(await getMyOnboardings()); }
        catch { }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    if (loading) return <div className="p-20 text-center animate-pulse">Loading submissions...</div>;

    const statusColors: Record<string, string> = {
        PENDING_ONBOARDING: "bg-amber-100 text-amber-700",
        PENDING_VERIFICATION: "bg-indigo-100 text-indigo-700",
        VERIFIED: "bg-green-100 text-green-700",
        REJECTED: "bg-red-100 text-red-700",
    };
    const statusLabels: Record<string, string> = {
        PENDING_ONBOARDING: "⏳ Pending Onboarding",
        PENDING_VERIFICATION: "🔍 In Verification",
        VERIFIED: "✅ Verified",
        REJECTED: "❌ Rejected",
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/dashboard/onboarder"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button></Link>
                <div>
                    <h1 className="text-3xl font-bold">My Submissions</h1>
                    <p className="text-muted-foreground">All onboarding records you have worked on</p>
                </div>
            </div>

            {records.length === 0 ? (
                <Card className="p-12 text-center text-muted-foreground text-lg">No submissions yet. Start with a <Link href="/dashboard/onboarder/new" className="text-purple-600 underline">New Field Visit</Link>.</Card>
            ) : (
                <div className="space-y-3">
                    {records.map(r => (
                        <Card key={r.id} className="p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold">{r.displayId}</span>
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColors[r.status] || "bg-gray-100"}`}>
                                            {statusLabels[r.status] || r.status}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.source === "TEAM_VISIT" ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-600"}`}>
                                            {r.source === "TEAM_VISIT" ? "🏃 Field Visit" : "📝 Self-Submitted"}
                                        </span>
                                    </div>
                                    <p className="text-sm"><span className="font-medium">{r.ownerName}</span> — {r.buildingName}</p>
                                    <p className="text-xs text-muted-foreground">{r.address}, {r.city} {r.pincode}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">📞 {r.ownerPhone} · 📧 {r.ownerEmail}</p>
                                </div>
                                <div className="text-right text-xs text-muted-foreground shrink-0">
                                    <p>Created: {new Date(r.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                                    {r.onboardedAt && <p>Onboarded: {new Date(r.onboardedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>}
                                    {r.verifiedAt && <p>Verified: {new Date(r.verifiedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>}
                                </div>
                            </div>

                            {/* Audit trail */}
                            {r.auditTrail && JSON.parse(r.auditTrail).length > 0 && (
                                <div className="mt-3 pt-3 border-t space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground">🕒 Audit Trail</p>
                                    {JSON.parse(r.auditTrail).map((entry: any, i: number) => (
                                        <div key={i} className="flex gap-2 text-xs">
                                            <div className="w-2 h-2 rounded-full bg-purple-400 mt-1 shrink-0" />
                                            <div>
                                                <span className="font-semibold">{entry.status}</span> — {entry.actorName}
                                                {entry.note && <span className="italic text-muted-foreground"> · {entry.note}</span>}
                                                <span className="text-muted-foreground ml-1">({new Date(entry.timestamp).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })})</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {r.rejectedReason && (
                                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                                    ❌ Rejection reason: {r.rejectedReason}
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
