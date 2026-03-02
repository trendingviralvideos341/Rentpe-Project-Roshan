"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    CheckCircle, XCircle, Clock, Eye, AlertCircle,
    User, Building2, CreditCard, Calendar, ArrowRight,
    MapPin, Phone, Mail, Trash2, RefreshCcw, Info, FileText, Shield, FileCheck
} from "lucide-react";
import { getPendingDocuments, verifyDocument } from "@/actions/documents";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

const TYPE_LABELS: Record<string, string> = {
    ID_PROOF: "Identity Proof",
    ADDRESS_PROOF: "Address Proof",
    COLLEGE_COMPANY: "College / Company ID",
    SELFIE: "Live Identity Check",
};

const TYPE_ICONS: Record<string, any> = {
    ID_PROOF: <User className="w-4 h-4" />,
    ADDRESS_PROOF: <MapPin className="w-4 h-4" />,
    COLLEGE_COMPANY: <Building2 className="w-4 h-4" />,
    SELFIE: <CheckCircle className="w-4 h-4" />,
};

export default function OwnerVerificationsPage() {
    const [docs, setDocs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewDoc, setPreviewDoc] = useState<any>(null);
    const [rejectNote, setRejectNote] = useState("");
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const { toast } = useToast();

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
            toast({
                title: "Document Verified",
                description: "The tenant's document has been successfully approved.",
            });
            fetchDocs();
        } catch (e) {
            toast({
                title: "Verification Failed",
                description: "There was an error approving the document.",
                variant: "destructive",
            });
        }
    };

    const handleReject = async () => {
        if (!rejectTarget) return;
        if (!rejectNote.trim()) {
            toast({
                title: "Incomplete Request",
                description: "Please provide a reason for rejection.",
                variant: "destructive",
            });
            return;
        }
        try {
            await verifyDocument(rejectTarget, 'REJECTED', rejectNote);
            toast({
                title: "Reupload Requested",
                description: "The tenant will be notified to re-upload the document.",
            });
            setRejectTarget(null);
            setRejectNote("");
            fetchDocs();
        } catch (e) {
            toast({
                title: "Action Failed",
                description: "Failed to request re-upload.",
                variant: "destructive",
            });
        }
    };

    const pending = docs.filter(d => d.status === "PENDING");
    const reviewed = docs.filter(d => d.status !== "PENDING");

    if (loading) return (
        <div className="p-8 flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground font-medium">Fetching verification queue...</p>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border shadow-sm">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                        <Shield className="w-8 h-8 text-primary" />
                        Customer Doc Verifications
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">Manage and verify identity documents for onboarded tenants.</p>
                </div>
                {pending.length > 0 && (
                    <Badge className="bg-amber-100 hover:bg-amber-100 text-amber-700 border-amber-200 px-4 py-1.5 rounded-full text-sm animate-pulse flex items-center gap-2 self-start md:self-center text-amber-600">
                        <Clock className="w-4 h-4" />
                        {pending.length} Pending Action{pending.length > 1 ? "s" : ""}
                    </Badge>
                )}
            </div>

            {docs.length === 0 && (
                <Card className="border-dashed border-2 bg-slate-50/50">
                    <CardContent className="p-16 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileCheck className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">No submissions found</h3>
                        <p className="text-slate-500 max-w-xs mx-auto mt-2">Documents will appear here once tenants complete their onboarding and payment.</p>
                    </CardContent>
                </Card>
            )}

            {/* Pending Section */}
            {pending.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1 text-slate-600 uppercase">
                        <div className="h-6 w-1 bg-amber-500 rounded-full"></div>
                        <h2 className="font-bold text-xl text-slate-800 tracking-tight">Requires Your Review</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {pending.map(doc => (
                            <VerificationCard
                                key={doc.id}
                                doc={doc}
                                onVerify={handleVerify}
                                onReject={(id: string) => setRejectTarget(id)}
                                onView={(doc: any) => setPreviewDoc(doc)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Reviewed Section */}
            {reviewed.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 px-1 text-slate-600 uppercase">
                        <div className="h-6 w-1 bg-green-500 rounded-full"></div>
                        <h2 className="font-bold text-xl text-slate-800 tracking-tight">Recently Reviewed</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {reviewed.map(doc => (
                            <VerificationCard reviewed key={doc.id} doc={doc} onView={(doc: any) => setPreviewDoc(doc)} />
                        ))}
                    </div>
                </div>
            )}

            {/* Rejection Modal */}
            <Dialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertCircle className="w-5 h-5" />
                            Request Re-upload
                        </DialogTitle>
                        <DialogDescription>
                            Explain why this document is being rejected so the tenant can provide a better version.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea
                            placeholder="e.g., Image is blurry, ID is expired, or name does not match..."
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            className="min-h-[100px] border-slate-200 focus:ring-red-500"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRejectTarget(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleReject}>Send Request</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Preview Modal */}
            <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
                <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-slate-900 border-none">
                    <div className="p-4 bg-white/10 backdrop-blur-md flex justify-between items-center text-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/20 rounded-lg text-primary">{previewDoc && TYPE_ICONS[previewDoc.type]}</div>
                            <div>
                                <h3 className="font-bold">{previewDoc && TYPE_LABELS[previewDoc.type]}</h3>
                                <p className="text-[10px] opacity-70 uppercase tracking-widest">{previewDoc?.booking?.guestName}</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="hover:bg-white/10 text-white" onClick={() => setPreviewDoc(null)}>✕</Button>
                    </div>
                    <div className="flex items-center justify-center p-4 min-h-[300px]">
                        {previewDoc?.fileData?.startsWith("data:image") ? (
                            <img src={previewDoc.fileData} className="max-w-full max-h-[70vh] object-contain rounded shadow-2xl" />
                        ) : previewDoc?.fileData?.startsWith("data:application/pdf") ? (
                            <div className="text-center space-y-4">
                                <div className="p-8 bg-white/5 rounded-full inline-block">
                                    <FileText className="w-16 h-16 text-primary/50" />
                                </div>
                                <p className="text-white/70">PDF Document cannot be previewed in full here.</p>
                                <Button asChild className="bg-primary hover:bg-primary/90">
                                    <a href={previewDoc.fileData} download={previewDoc.fileName}>Download to Review</a>
                                </Button>
                            </div>
                        ) : (
                            <div className="text-white/50 italic">No preview available</div>
                        )}
                    </div>
                    <div className="p-4 bg-black/40 border-t border-white/10 flex justify-end">
                        <Button variant="outline" className="text-white border-white/20 hover:bg-white/10" onClick={() => setPreviewDoc(null)}>Close Viewer</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function VerificationCard({ doc, onVerify, onReject, onView, reviewed = false }: { doc: any, onVerify?: any, onReject?: any, onView: any, reviewed?: boolean }) {
    const isVerified = doc.status === "VERIFIED";
    const isRejected = doc.status === "REJECTED";

    return (
        <Card className={`overflow-hidden border-2 transition-all ${isVerified ? "border-green-100 bg-green-50/10" : isRejected ? "border-red-100 bg-red-50/10" : "border-slate-100 hover:border-amber-200 hover:shadow-md shadow-sm"}`}>
            <CardContent className="p-0">
                <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x border-slate-100">
                    <div className="p-5 flex-1 space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl ${isVerified ? 'bg-green-100 text-green-700' : isRejected ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'} shadow-sm`}>
                                    {TYPE_ICONS[doc.type] || <FileText className="w-5 h-5" />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg leading-tight">{TYPE_LABELS[doc.type] || doc.type}</h3>
                                    <div className="flex items-center gap-1.5 text-slate-500 mt-1">
                                        <Badge variant="outline" className="text-[10px] py-0 font-bold uppercase tracking-tighter">
                                            {doc.booking?.displayId}
                                        </Badge>
                                        <span className="text-xs font-medium">{doc.booking?.guestName}</span>
                                    </div>
                                </div>
                            </div>
                            {!reviewed && (
                                <Badge className="bg-amber-500 hover:bg-amber-500 text-white border-none shadow-sm px-2 text-[10px] font-bold">
                                    PENDING
                                </Badge>
                            )}
                            {isVerified && <Badge className="bg-green-600 text-white border-none px-2 text-[10px] font-bold">VERIFIED</Badge>}
                            {isRejected && <Badge className="bg-red-600 text-white border-none px-2 text-[10px] font-bold">REJECTED</Badge>}
                        </div>

                        {/* Customer & Payment Meta */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                            <div className="space-y-1">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Room Allocation</p>
                                <div className="flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                                    <span className="text-xs font-bold text-slate-700">{doc.booking?.roomAssigned || "TBD"}</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Paid Amount</p>
                                <div className="flex items-center gap-1.5">
                                    <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                                    <span className="text-xs font-bold text-slate-700">₹{doc.booking?.amount}</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Method</p>
                                <Badge className="bg-white text-slate-600 border border-slate-200 text-[10px] h-5 shadow-none">
                                    {doc.booking?.paymentMethod || "CASH"}
                                </Badge>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Paid At</p>
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                    <span className="text-xs font-bold text-slate-700">
                                        {doc.booking?.paidAt ? new Date(doc.booking.paidAt).toLocaleDateString() : "--"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {isRejected && doc.rejectedNote && (
                            <div className="flex gap-2 items-start p-3 bg-red-50 rounded-lg border border-red-100 text-red-800 animate-in slide-in-from-top-2">
                                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-xs font-bold uppercase tracking-tight">Rejection Reason</p>
                                    <p className="text-sm font-medium italic opacity-80">{doc.rejectedNote}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-50/30 p-4 md:w-56 flex md:flex-col justify-center items-center gap-3">
                        <Button
                            variant="outline"
                            className="bg-white w-full border-slate-200 hover:bg-slate-800 hover:text-white transition-all shadow-sm font-bold text-xs h-10 group"
                            onClick={() => onView(doc)}
                        >
                            <Eye className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                            View Doc
                        </Button>

                        {!reviewed && (
                            <>
                                <Button
                                    className="bg-green-600 hover:bg-green-700 w-full shadow-lg shadow-green-200 transition-all font-bold text-xs h-10"
                                    onClick={() => onVerify(doc.id)}
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Approve
                                </Button>
                                <Button
                                    variant="outline"
                                    className="border-red-200 text-red-600 hover:bg-red-50 w-full font-bold text-xs h-10 group"
                                    onClick={() => onReject(doc.id)}
                                >
                                    <RefreshCcw className="w-4 h-4 mr-2 group-hover:rotate-180 transition-transform duration-500" />
                                    Reupload
                                </Button>
                            </>
                        )}

                        {isVerified && (
                            <div className="text-center md:mt-4">
                                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-1 opacity-50" />
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verified Ready</p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
