"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import { getPendingDocuments, verifyDocument } from "@/actions/documents";

const TYPE_LABELS: Record<string, string> = {
    ID_PROOF: "🪪 ID Proof",
    ADDRESS_PROOF: "🏠 Address Proof",
    COLLEGE_COMPANY: "🎓 College / Company",
    SELFIE: "📸 Live Selfie",
};

export default function OwnerVerificationsPage() {
    const [docs, setDocs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewDoc, setPreviewDoc] = useState<any>(null);
    const [rejectNote, setRejectNote] = useState("");
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);

    const fetchDocs = async () => {
        setLoading(true);
        try {
            const data = await getPendingDocuments();
            setDocs(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDocs(); }, []);

    const handleVerify = async (docId: string) => {
        try {
            await verifyDocument(docId, 'VERIFIED');
            fetchDocs();
        } catch (e) {
            alert("Failed to verify.");
        }
    };

    const handleReject = async (docId: string) => {
        if (!rejectNote.trim()) { alert("Please enter a rejection reason."); return; }
        try {
            await verifyDocument(docId, 'REJECTED', rejectNote);
            setRejectTarget(null);
            setRejectNote("");
            fetchDocs();
        } catch (e) {
            alert("Failed to reject.");
        }
    };

    const pending = docs.filter(d => d.status === "PENDING");
    const reviewed = docs.filter(d => d.status !== "PENDING");

    if (loading) return <div className="p-8 text-center animate-pulse">Loading documents...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Document Verifications</h1>
                <p className="text-muted-foreground">Review and verify tenant documents.</p>
            </div>

            {pending.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 font-medium">
                    ⏳ {pending.length} document{pending.length > 1 ? "s" : ""} awaiting review
                </div>
            )}

            {docs.length === 0 && (
                <Card><CardContent className="p-8 text-center text-muted-foreground">No documents submitted yet.</CardContent></Card>
            )}

            {/* Pending */}
            {pending.length > 0 && (
                <div className="space-y-3">
                    <h2 className="font-bold text-lg">⏳ Pending Review</h2>
                    {pending.map(doc => (
                        <Card key={doc.id} className="border-amber-200">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div>
                                        <div className="font-bold">{TYPE_LABELS[doc.type] || doc.type}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {doc.booking?.guestName} — {doc.booking?.displayId} — {doc.booking?.propertyName}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            Uploaded: {new Date(doc.uploadedAt).toLocaleString()}
                                        </div>
                                        {doc.fileName && <div className="text-xs text-blue-600 mt-1">📎 {doc.fileName}</div>}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setPreviewDoc(doc)}>
                                            <Eye className="h-3 w-3 mr-1" /> View
                                        </Button>
                                        <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleVerify(doc.id)}>
                                            <CheckCircle className="h-3 w-3 mr-1" /> Verify
                                        </Button>
                                        {rejectTarget === doc.id ? (
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    className="border rounded px-2 py-1 text-xs w-48"
                                                    placeholder="Rejection reason..."
                                                    value={rejectNote}
                                                    onChange={e => setRejectNote(e.target.value)}
                                                />
                                                <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => handleReject(doc.id)}>Confirm</Button>
                                                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setRejectTarget(null); setRejectNote(""); }}>Cancel</Button>
                                            </div>
                                        ) : (
                                            <Button size="sm" variant="outline" className="h-8 text-xs border-red-300 text-red-600" onClick={() => setRejectTarget(doc.id)}>
                                                <XCircle className="h-3 w-3 mr-1" /> Reject
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Reviewed */}
            {reviewed.length > 0 && (
                <div className="space-y-3">
                    <h2 className="font-bold text-lg">✅ Reviewed</h2>
                    {reviewed.map(doc => (
                        <Card key={doc.id} className={`${doc.status === "VERIFIED" ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30"}`}>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-bold">{TYPE_LABELS[doc.type] || doc.type}</div>
                                        <div className="text-sm text-muted-foreground">{doc.booking?.guestName} — {doc.booking?.displayId}</div>
                                        {doc.rejectedNote && <div className="text-xs text-red-600 mt-1">Reason: {doc.rejectedNote}</div>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {doc.status === "VERIFIED"
                                            ? <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded"><CheckCircle className="h-3 w-3" /> Verified</span>
                                            : <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded"><XCircle className="h-3 w-3" /> Rejected</span>
                                        }
                                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setPreviewDoc(doc)}>
                                            <Eye className="h-3 w-3 mr-1" /> View
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Document Preview Modal */}
            {previewDoc && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold">{TYPE_LABELS[previewDoc.type] || previewDoc.type}</h2>
                            <Button variant="ghost" onClick={() => setPreviewDoc(null)}>✕</Button>
                        </div>
                        <p className="text-sm text-muted-foreground">{previewDoc.booking?.guestName} — {previewDoc.booking?.displayId}</p>
                        {previewDoc.fileData?.startsWith("data:image") ? (
                            <img src={previewDoc.fileData} alt="Document" className="w-full rounded-lg border max-h-96 object-contain" />
                        ) : previewDoc.fileData?.startsWith("data:application/pdf") ? (
                            <div className="p-4 bg-muted rounded text-center text-sm text-muted-foreground">
                                📄 PDF document — <a href={previewDoc.fileData} download={previewDoc.fileName} className="text-blue-600 underline">Download to view</a>
                            </div>
                        ) : (
                            <div className="p-4 bg-muted rounded text-center text-sm text-muted-foreground">Preview not available</div>
                        )}
                        <Button className="w-full" onClick={() => setPreviewDoc(null)}>Close</Button>
                    </div>
                </div>
            )}
        </div>
    );
}
