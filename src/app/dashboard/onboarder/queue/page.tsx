"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getPendingOnboardingQueue, acceptOnboarding, rejectByOnboarder } from "@/actions/onboarding";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Upload } from "lucide-react";

type OnboardingRecord = Awaited<ReturnType<typeof getPendingOnboardingQueue>>[number];

export default function OnboarderQueuePage() {
    const [queue, setQueue] = useState<OnboardingRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);
    const [rejectId, setRejectId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [docUploads, setDocUploads] = useState<Record<string, any>>({});

    const load = useCallback(async () => {
        setLoading(true);
        try { setQueue(await getPendingOnboardingQueue()); }
        catch { }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    async function toBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function handleFileUpload(recordId: string, field: string, file: File) {
        const data = await toBase64(file);
        setDocUploads(prev => ({
            ...prev,
            [recordId]: { ...(prev[recordId] || {}), [`${field}Data`]: data, [`${field}Name`]: file.name }
        }));
    }

    async function handleAdditionalPhotos(recordId: string, files: FileList) {
        const existing = JSON.parse(docUploads[recordId]?.additionalPhotos || "[]");
        const newPhotos = await Promise.all(
            Array.from(files).map(async f => ({ name: f.name, data: await toBase64(f) }))
        );
        setDocUploads(prev => ({
            ...prev,
            [recordId]: { ...(prev[recordId] || {}), additionalPhotos: JSON.stringify([...existing, ...newPhotos]) }
        }));
    }

    async function handleAccept(id: string) {
        setProcessing(id);
        try {
            const uploads = docUploads[id] || {};
            await acceptOnboarding(id, uploads);
            await load();
        } catch (e: any) { alert(e.message); }
        finally { setProcessing(null); }
    }

    async function handleReject(id: string) {
        if (!rejectReason.trim()) { alert("Please enter a rejection reason."); return; }
        setProcessing(id);
        try {
            await rejectByOnboarder(id, rejectReason);
            setRejectId(null); setRejectReason("");
            await load();
        } catch (e: any) { alert(e.message); }
        finally { setProcessing(null); }
    }

    if (loading) return <div className="p-20 text-center animate-pulse">Loading queue...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Pending Onboarding Queue</h1>
                <p className="text-muted-foreground">Self-submitted owner requests awaiting your review &amp; completion</p>
            </div>

            {queue.length === 0 ? (
                <Card className="p-12 text-center text-muted-foreground text-lg">
                    🎉 No pending requests — queue is empty!
                </Card>
            ) : (
                <div className="space-y-4">
                    {queue.map(r => (
                        <Card key={r.id} className="overflow-hidden">
                            {/* Header row */}
                            <div className="p-5 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition"
                                onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-base">{r.displayId}</span>
                                        <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-semibold">⏳ Pending</span>
                                    </div>
                                    <p className="text-sm mt-0.5"><span className="font-medium">{r.ownerName}</span> — {r.buildingName}, {r.city}</p>
                                    <p className="text-xs text-muted-foreground">Submitted: {new Date(r.createdAt).toLocaleString("en-IN")}</p>
                                </div>
                                {expanded === r.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </div>

                            {/* Expanded */}
                            {expanded === r.id && (
                                <div className="border-t px-5 pb-5 space-y-5">
                                    {/* Owner info */}
                                    <div className="grid md:grid-cols-2 gap-4 mt-4">
                                        {[
                                            ["Owner Name", r.ownerName],
                                            ["Email", r.ownerEmail],
                                            ["Phone", r.ownerPhone],
                                            ["Building", r.buildingName],
                                            ["Address", r.address],
                                            ["City", r.city],
                                            ["Pincode", r.pincode],
                                            ["Country", r.country],
                                            ["PG Licence #", r.pgLicenceNumber || "—"],
                                            ["Notes", r.notes || "—"],
                                        ].map(([label, value]) => (
                                            <div key={label}>
                                                <p className="text-xs text-muted-foreground">{label}</p>
                                                <p className="font-medium text-sm">{value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Document uploads */}
                                    <div className="space-y-3">
                                        <h3 className="font-semibold text-sm">📎 Upload Documents (required to forward to Verification)</h3>
                                        <div className="grid md:grid-cols-3 gap-3">
                                            {[
                                                { field: "idProof", label: "🪪 ID Proof (Aadhaar / PAN)" },
                                                { field: "pgLicence", label: "📄 PG / Hostel Licence" },
                                                { field: "buildingImage", label: "🏠 Building Front Photo" },
                                            ].map(({ field, label }) => {
                                                const uploaded = docUploads[r.id]?.[`${field}Name`];
                                                return (
                                                    <label key={field} className={`cursor-pointer border-2 border-dashed rounded-lg p-3 flex flex-col items-center gap-1 transition hover:border-purple-400 text-center ${uploaded ? "border-green-400 bg-green-50" : "border-border"}`}>
                                                        <Upload className="h-5 w-5 text-muted-foreground" />
                                                        <span className="text-xs font-medium">{label}</span>
                                                        {uploaded ? <span className="text-xs text-green-600 truncate max-w-full">{uploaded}</span> : <span className="text-xs text-muted-foreground">Click to upload</span>}
                                                        <input type="file" className="hidden" accept="image/*,application/pdf"
                                                            onChange={e => { if (e.target.files?.[0]) handleFileUpload(r.id, field, e.target.files[0]); }} />
                                                    </label>
                                                );
                                            })}
                                        </div>

                                        {/* Additional photos */}
                                        <label className="cursor-pointer border-2 border-dashed rounded-lg p-3 flex items-center gap-3 hover:border-purple-400 transition">
                                            <Upload className="h-5 w-5 text-muted-foreground" />
                                            <div>
                                                <p className="text-sm font-medium">📷 Additional Photos</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {docUploads[r.id]?.additionalPhotos
                                                        ? `${JSON.parse(docUploads[r.id].additionalPhotos).length} photo(s) selected`
                                                        : "Click to upload multiple photos"}
                                                </p>
                                            </div>
                                            <input type="file" className="hidden" multiple accept="image/*"
                                                onChange={e => { if (e.target.files) handleAdditionalPhotos(r.id, e.target.files); }} />
                                        </label>
                                    </div>

                                    {/* Audit trail */}
                                    <AuditTrail trailJson={r.auditTrail} />

                                    {/* Actions */}
                                    {rejectId === r.id ? (
                                        <div className="space-y-2">
                                            <Input placeholder="Reason for rejection..." value={rejectReason}
                                                onChange={e => setRejectReason(e.target.value)} />
                                            <div className="flex gap-2">
                                                <Button variant="destructive" disabled={processing === r.id}
                                                    onClick={() => handleReject(r.id)}>
                                                    {processing === r.id ? "Rejecting..." : "Confirm Reject"}
                                                </Button>
                                                <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-3 pt-2">
                                            <Button
                                                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 gap-2"
                                                disabled={processing === r.id}
                                                onClick={() => handleAccept(r.id)}>
                                                <CheckCircle2 className="h-4 w-4" />
                                                {processing === r.id ? "Forwarding..." : "Accept & Forward to Verification"}
                                            </Button>
                                            <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 gap-2"
                                                onClick={() => setRejectId(r.id)}>
                                                <XCircle className="h-4 w-4" /> Reject
                                            </Button>
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

function AuditTrail({ trailJson }: { trailJson: string }) {
    const trail = JSON.parse(trailJson || "[]");
    if (trail.length === 0) return null;
    return (
        <div className="space-y-2">
            <h3 className="text-sm font-semibold">🕒 Audit Trail</h3>
            <div className="relative pl-4 space-y-3">
                {trail.map((entry: any, i: number) => (
                    <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-purple-500 mt-1 shrink-0" />
                            {i < trail.length - 1 && <div className="w-0.5 flex-1 bg-purple-200 mt-1" />}
                        </div>
                        <div>
                            <p className="text-xs font-semibold">{entry.status}</p>
                            <p className="text-xs text-muted-foreground">{entry.actorName}</p>
                            {entry.note && <p className="text-xs italic text-muted-foreground">{entry.note}</p>}
                            <p className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleString("en-IN")}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
