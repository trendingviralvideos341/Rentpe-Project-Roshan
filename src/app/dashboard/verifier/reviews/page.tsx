"use client";

import { useEffect, useState, useCallback } from "react";
import { getPendingVerifications, verifyOnboarding, rejectByVerifier, getAllVerifications } from "@/actions/onboarding";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, FileText, Image as ImageIcon, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function VerifierReviewsPage() {
    const [pending, setPending] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);
    const [rejectId, setRejectId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [editFields, setEditFields] = useState<Record<string, Record<string, string>>>({});
    const [tab, setTab] = useState<"pending" | "all">("pending");
    const [allRecords, setAllRecords] = useState<any[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setPending(await getPendingVerifications());
            setAllRecords(await getAllVerifications());
        } catch { }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    function getEdits(id: string) {
        return editFields[id] || {};
    }

    function setEdit(id: string, field: string, value: string) {
        setEditFields(prev => ({
            ...prev,
            [id]: { ...(prev[id] || {}), [field]: value }
        }));
    }

    async function handleVerify(id: string) {
        setProcessing(id);
        try {
            const edits = getEdits(id);
            const nonEmpty = Object.fromEntries(Object.entries(edits).filter(([, v]) => v.trim()));
            await verifyOnboarding(id, Object.keys(nonEmpty).length > 0 ? nonEmpty : undefined);
            await load();
        } catch (e: any) { alert(e.message); }
        finally { setProcessing(null); }
    }

    async function handleReject(id: string) {
        if (!rejectReason.trim()) { alert("Enter rejection reason."); return; }
        setProcessing(id);
        try {
            await rejectByVerifier(id, rejectReason);
            setRejectId(null); setRejectReason("");
            await load();
        } catch (e: any) { alert(e.message); }
        finally { setProcessing(null); }
    }

    if (loading) return <div className="p-20 text-center animate-pulse">Loading reviews...</div>;

    const records = tab === "pending" ? pending : allRecords;
    const statusColors: Record<string, string> = {
        PENDING_VERIFICATION: "bg-indigo-100 text-indigo-700",
        VERIFIED: "bg-green-100 text-green-700",
        REJECTED: "bg-red-100 text-red-700",
        PENDING_ONBOARDING: "bg-amber-100 text-amber-700",
    };
    const statusLabels: Record<string, string> = {
        PENDING_VERIFICATION: "🔍 Pending",
        VERIFIED: "✅ Verified",
        REJECTED: "❌ Rejected",
        PENDING_ONBOARDING: "⏳ Awaiting Onboarder",
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/dashboard/verifier"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button></Link>
                <div>
                    <h1 className="text-3xl font-bold">Verification Reviews</h1>
                    <p className="text-muted-foreground">Review owner submissions, verify documents, correct details</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                {[
                    { key: "pending" as const, label: `🔍 Pending (${pending.length})` },
                    { key: "all" as const, label: `📋 All Records (${allRecords.length})` },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition border-2 ${tab === t.key ? "border-purple-500 bg-purple-50 text-purple-700" : "border-border hover:bg-muted"}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {records.length === 0 ? (
                <Card className="p-12 text-center text-muted-foreground text-lg">
                    {tab === "pending" ? "🎉 No pending reviews — queue is clear!" : "No records found."}
                </Card>
            ) : (
                <div className="space-y-4">
                    {records.map(r => (
                        <Card key={r.id} className="overflow-hidden">
                            <div className="p-5 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition"
                                onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold">{r.displayId}</span>
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColors[r.status] || "bg-gray-100"}`}>
                                            {statusLabels[r.status] || r.status}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.source === "TEAM_VISIT" ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-600"}`}>
                                            {r.source === "TEAM_VISIT" ? "🏃 Field Visit" : "📝 Self-Submitted"}
                                        </span>
                                    </div>
                                    <p className="text-sm mt-0.5"><span className="font-medium">{r.ownerName}</span> — {r.buildingName}, {r.city}</p>
                                    <p className="text-xs text-muted-foreground">Submitted: {new Date(r.createdAt).toLocaleString("en-IN")}</p>
                                </div>
                                {expanded === r.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </div>

                            {expanded === r.id && (
                                <div className="border-t px-5 pb-5 space-y-5">
                                    {/* Info + editable fields */}
                                    <div className="grid md:grid-cols-2 gap-4 mt-4">
                                        {[
                                            { key: "ownerName", label: "Owner Name" },
                                            { key: "ownerEmail", label: "Email" },
                                            { key: "ownerPhone", label: "Phone" },
                                            { key: "buildingName", label: "Building" },
                                            { key: "address", label: "Address" },
                                            { key: "city", label: "City" },
                                            { key: "pincode", label: "Pincode" },
                                            { key: "country", label: "Country" },
                                            { key: "pgLicenceNumber", label: "PG Licence #" },
                                            { key: "notes", label: "Notes" },
                                        ].map(({ key, label }) => (
                                            <div key={key}>
                                                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                                                {r.status === "PENDING_VERIFICATION" ? (
                                                    <Input
                                                        value={getEdits(r.id)[key] ?? (r as any)[key] ?? ""}
                                                        onChange={e => setEdit(r.id, key, e.target.value)}
                                                        className="text-sm"
                                                    />
                                                ) : (
                                                    <p className="font-medium text-sm">{(r as any)[key] || "—"}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Documents preview */}
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold">📎 Uploaded Documents</h3>
                                        <div className="grid md:grid-cols-3 gap-3">
                                            {[
                                                { name: r.idProofName, data: r.idProofData, label: "🪪 ID Proof" },
                                                { name: r.pgLicenceName, data: r.pgLicenceData, label: "📄 PG Licence" },
                                                { name: r.buildingImageName, data: r.buildingImageData, label: "🏠 Building Photo" },
                                            ].map(doc => (
                                                <div key={doc.label} className={`border rounded-lg p-3 text-center ${doc.data ? "border-green-300 bg-green-50" : "border-border bg-muted/30"}`}>
                                                    {doc.data ? (
                                                        <>
                                                            {doc.data.startsWith("data:image") ? (
                                                                <img src={doc.data} alt={doc.label} className="w-full h-28 object-cover rounded mb-2" />
                                                            ) : (
                                                                <div className="h-28 flex items-center justify-center"><FileText className="h-10 w-10 text-green-500" /></div>
                                                            )}
                                                            <p className="text-xs font-medium">{doc.label}</p>
                                                            <p className="text-xs text-muted-foreground truncate">{doc.name}</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="h-28 flex items-center justify-center"><ImageIcon className="h-10 w-10 text-muted-foreground/40" /></div>
                                                            <p className="text-xs text-muted-foreground">{doc.label} — Not uploaded</p>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Additional photos */}
                                        {(() => {
                                            const photos = JSON.parse(r.additionalPhotos || "[]");
                                            if (photos.length === 0) return null;
                                            return (
                                                <div>
                                                    <p className="text-xs font-semibold mb-2">📷 Additional Photos ({photos.length})</p>
                                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                                        {photos.map((p: any, i: number) => (
                                                            <img key={i} src={p.data} alt={p.name} className="h-24 rounded-lg border shrink-0" />
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Audit trail */}
                                    {(() => {
                                        const trail = JSON.parse(r.auditTrail || "[]");
                                        if (trail.length === 0) return null;
                                        return (
                                            <div className="space-y-2">
                                                <h3 className="text-sm font-semibold">🕒 Audit Trail</h3>
                                                <div className="pl-3 space-y-2">
                                                    {trail.map((entry: any, i: number) => (
                                                        <div key={i} className="flex gap-2 text-xs">
                                                            <div className="flex flex-col items-center">
                                                                <div className="w-2.5 h-2.5 rounded-full bg-purple-500 mt-0.5 shrink-0" />
                                                                {i < trail.length - 1 && <div className="w-0.5 flex-1 bg-purple-200 mt-0.5" />}
                                                            </div>
                                                            <div>
                                                                <span className="font-semibold">{entry.status}</span> — {entry.actorName}
                                                                {entry.note && <span className="italic text-muted-foreground"> · {entry.note}</span>}
                                                                <p className="text-muted-foreground">{new Date(entry.timestamp).toLocaleString("en-IN")}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Actions (only for pending) */}
                                    {r.status === "PENDING_VERIFICATION" && (
                                        <>
                                            {rejectId === r.id ? (
                                                <div className="space-y-2">
                                                    <Input placeholder="Rejection reason..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                                                    <div className="flex gap-2">
                                                        <Button variant="destructive" disabled={processing === r.id} onClick={() => handleReject(r.id)}>
                                                            {processing === r.id ? "Rejecting..." : "Confirm Reject"}
                                                        </Button>
                                                        <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex gap-3 pt-2">
                                                    <Button className="bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 gap-2"
                                                        disabled={processing === r.id} onClick={() => handleVerify(r.id)}>
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        {processing === r.id ? "Verifying..." : "✅ Verify & Approve"}
                                                    </Button>
                                                    <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 gap-2"
                                                        onClick={() => setRejectId(r.id)}>
                                                        <XCircle className="h-4 w-4" /> Reject
                                                    </Button>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {r.rejectedReason && (
                                        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                                            ❌ {r.rejectedReason}
                                        </div>
                                    )}
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
