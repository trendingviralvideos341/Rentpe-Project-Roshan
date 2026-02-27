"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    FileCheck, Search, RefreshCcw, Eye, CheckCircle, XCircle,
    Clock, AlertCircle, User, Phone, Mail, Building2, MapPin,
    ArrowLeft, ChevronRight, Download
} from "lucide-react";
import { getPendingDocuments, verifyDocument } from "@/actions/documents";

const TYPE_LABELS: Record<string, string> = {
    ID_PROOF: "🪪 ID Proof (Aadhaar/Voter)",
    ADDRESS_PROOF: "🏠 Address Proof (Electricity/GAS)",
    COLLEGE_COMPANY: "🎓 College / Company ID",
    SELFIE: "📸 Live Selfie",
};

export default function AdminDocVerificationPage() {
    const [docs, setDocs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [previewDoc, setPreviewDoc] = useState<any>(null);
    const [rejectNote, setRejectNote] = useState("");
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);

    const fetchDocs = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getPendingDocuments();
            setDocs(data);
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDocs();
    }, [fetchDocs]);

    const handleVerify = async (docId: string) => {
        setProcessing(docId);
        try {
            await verifyDocument(docId, 'VERIFIED');
            await fetchDocs();
        } catch (e: any) {
            alert(e.message || "Failed to verify document.");
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (docId: string) => {
        if (!rejectNote.trim()) { alert("Please enter a rejection reason."); return; }
        setProcessing(docId);
        try {
            await verifyDocument(docId, 'REJECTED', rejectNote);
            setRejectTarget(null);
            setRejectNote("");
            await fetchDocs();
        } catch (e: any) {
            alert(e.message || "Failed to reject document.");
        } finally {
            setProcessing(null);
        }
    };

    const filtered = docs.filter(doc => {
        const query = search.toLowerCase();
        return (
            doc.booking?.guestName?.toLowerCase().includes(query) ||
            doc.booking?.displayId?.toLowerCase().includes(query) ||
            doc.booking?.propertyName?.toLowerCase().includes(query)
        );
    });

    const pendingCount = docs.filter(d => d.status === "PENDING").length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        Customer Doc Verification
                        {pendingCount > 0 && (
                            <span className="text-sm bg-red-100 text-red-600 px-3 py-1 rounded-full animate-pulse border border-red-200">
                                {pendingCount} PENDING
                            </span>
                        )}
                    </h1>
                    <p className="text-muted-foreground">Detailed review of all documents uploaded by customers.</p>
                </div>
                <Button variant="outline" onClick={fetchDocs} disabled={loading}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by customer name, PG or ID..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="p-20 text-center animate-pulse text-muted-foreground uppercase tracking-widest font-bold">
                    🔍 Scanning all documents...
                </div>
            ) : filtered.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                        No documents found. Check your search or wait for new uploads.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6">
                    {/* Group by Status: PENDING first */}
                    {['PENDING', 'VERIFIED', 'REJECTED'].map(status => {
                        const docsInStatus = filtered.filter(d => d.status === status);
                        if (docsInStatus.length === 0) return null;

                        return (
                            <div key={status} className="space-y-3">
                                <h2 className={`font-bold text-lg flex items-center gap-2 ${status === 'PENDING' ? 'text-red-600' : status === 'VERIFIED' ? 'text-green-600' : 'text-gray-500'}`}>
                                    {status === 'PENDING' ? <Clock className="h-5 w-5" /> : status === 'VERIFIED' ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                                    {status} DOCUMENTS
                                </h2>
                                <div className="grid gap-4">
                                    {docsInStatus.map(doc => (
                                        <Card key={doc.id} className={`overflow-hidden border-2 ${status === 'PENDING' ? 'border-red-100 shadow-sm' : ''}`}>
                                            <CardContent className="p-0">
                                                <div className="p-4 flex flex-wrap items-center justify-between gap-6">
                                                    <div className="flex-1 min-w-[300px] flex items-start gap-4">
                                                        <div className={`mt-1 p-2 rounded-lg ${status === 'PENDING' ? 'bg-red-50' : 'bg-muted'}`}>
                                                            <FileCheck className={`h-6 w-6 ${status === 'PENDING' ? 'text-red-500' : 'text-muted-foreground'}`} />
                                                        </div>
                                                        <div className="space-y-1 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-bold text-lg leading-none">{doc.booking?.guestName}</p>
                                                                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded">{doc.booking?.displayId}</span>
                                                            </div>
                                                            <p className="text-sm font-semibold text-primary/80">{TYPE_LABELS[doc.type] || doc.type}</p>
                                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                                <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {doc.booking?.propertyName}</span>
                                                                <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {doc.booking?.guestEmail}</span>
                                                                <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {doc.booking?.guestPhone}</span>
                                                            </div>
                                                            {doc.rejectedNote && (
                                                                <p className="text-xs text-red-600 bg-red-50 p-1.5 rounded border border-red-100 mt-2 font-medium italic">
                                                                    Reason: {doc.rejectedNote}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <Button size="sm" variant="outline" className="h-9 hover:bg-muted" onClick={() => setPreviewDoc(doc)}>
                                                            <Eye className="h-3.5 w-3.5 mr-2" /> View Details
                                                        </Button>

                                                        {status === 'PENDING' && (
                                                            <>
                                                                <Button
                                                                    size="sm"
                                                                    className="h-9 bg-green-600 hover:bg-green-700 text-white font-bold px-4"
                                                                    onClick={() => handleVerify(doc.id)}
                                                                    disabled={processing === doc.id}
                                                                >
                                                                    {processing === doc.id ? 'Processing...' : <><CheckCircle className="h-4 w-4 mr-2" /> Verify</>}
                                                                </Button>

                                                                {rejectTarget === doc.id ? (
                                                                    <div className="flex items-center gap-2 bg-red-50 p-1 rounded-lg border border-red-200">
                                                                        <Input
                                                                            placeholder="Why reject?"
                                                                            className="h-8 text-xs w-48 bg-white"
                                                                            value={rejectNote}
                                                                            onChange={(e) => setRejectNote(e.target.value)}
                                                                        />
                                                                        <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => handleReject(doc.id)}>Confirm</Button>
                                                                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setRejectTarget(null); setRejectNote(""); }}>Cancel</Button>
                                                                    </div>
                                                                ) : (
                                                                    <Button size="sm" variant="outline" className="h-9 border-red-300 text-red-600 font-bold px-4" onClick={() => setRejectTarget(doc.id)}>
                                                                        <XCircle className="h-4 w-4 mr-2" /> Reject
                                                                    </Button>
                                                                )}
                                                            </>
                                                        )}

                                                        {(status === 'VERIFIED' || status === 'REJECTED') && (
                                                            <span className={`px-4 py-1.5 rounded-full text-xs font-bold border ${status === 'VERIFIED' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                                {status}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Document Details Modal */}
            {previewDoc && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col max-w-4xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <div>
                                <h2 className="text-xl font-bold">{TYPE_LABELS[previewDoc.type] || previewDoc.type}</h2>
                                <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                                    <Clock className="h-3 w-3" /> Submitted at {new Date(previewDoc.uploadedAt).toLocaleString()}
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setPreviewDoc(null)}>✕</Button>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Preview Area */}
                            <div className="flex-1 bg-gray-100 dark:bg-gray-800 p-6 flex items-center justify-center overflow-auto">
                                {previewDoc.fileData?.startsWith("data:image") ? (
                                    <img src={previewDoc.fileData} alt="Document" className="max-w-full max-h-full object-contain rounded shadow-lg" />
                                ) : previewDoc.fileData?.startsWith("data:application/pdf") ? (
                                    <iframe src={previewDoc.fileData} className="w-full h-full rounded shadow-lg" title="PDF Preview" />
                                ) : (
                                    <div className="p-12 text-center text-muted-foreground bg-white rounded-xl shadow">
                                        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
                                        <p>No visual preview available for this file type.</p>
                                        <p className="text-xs mt-2">{previewDoc.fileName || 'document.file'}</p>
                                    </div>
                                )}
                            </div>

                            {/* Details Sidebar */}
                            <div className="w-80 border-l bg-muted/30 p-6 space-y-6 overflow-auto">
                                <div className="space-y-4">
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Customer Details</p>
                                    <div className="space-y-3">
                                        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border space-y-2">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase">
                                                    {previewDoc.booking?.guestName?.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm truncate">{previewDoc.booking?.guestName}</p>
                                                    <p className="text-[10px] text-muted-foreground">ID: {previewDoc.booking?.displayId}</p>
                                                </div>
                                            </div>
                                            <div className="pt-2 border-t space-y-1.5 text-xs text-muted-foreground">
                                                <p className="flex items-center gap-2"><Phone className="h-3 w-3" /> {previewDoc.booking?.guestPhone}</p>
                                                <p className="flex items-center gap-2"><Mail className="h-3 w-3" /> {previewDoc.booking?.guestEmail}</p>
                                                <p className="flex items-center gap-2 text-foreground font-medium"><Building2 className="h-3 w-3" /> {previewDoc.booking?.propertyName}</p>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border space-y-2">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Booking Context</p>
                                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                <div className="bg-muted p-1.5 rounded">
                                                    <p className="text-muted-foreground">Room</p>
                                                    <p className="font-bold">{previewDoc.booking?.roomAssigned || 'TBD'}</p>
                                                </div>
                                                <div className="bg-muted p-1.5 rounded">
                                                    <p className="text-muted-foreground">Occupancy</p>
                                                    <p className="font-bold">{previewDoc.booking?.occupancy}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Button className="w-full bg-blue-600 hover:bg-blue-700" asChild>
                                        <a href={previewDoc.fileData} download={previewDoc.fileName || 'document'}>
                                            <Download className="h-4 w-4 mr-2" /> Download Full File
                                        </a>
                                    </Button>
                                    {previewDoc.status === 'PENDING' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={() => { handleVerify(previewDoc.id); setPreviewDoc(null); }}>
                                                Approve
                                            </Button>
                                            <Button variant="outline" className="border-red-600 text-red-700 hover:bg-red-50" onClick={() => setRejectTarget(previewDoc.id)}>
                                                Reject
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <Button variant="ghost" className="w-full text-xs" onClick={() => setPreviewDoc(null)}>Close Panel</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
