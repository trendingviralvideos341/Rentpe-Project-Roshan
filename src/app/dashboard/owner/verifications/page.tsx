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
    const [selectedBooking, setSelectedBooking] = useState<any>(null);
    const [rejectNote, setRejectNote] = useState("");
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const [previewDoc, setPreviewDoc] = useState<any>(null);
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

    // Grouping Logic
    const groupedByBooking = docs.reduce((acc: any, doc: any) => {
        const bId = doc.booking?.id;
        if (!bId) return acc;
        if (!acc[bId]) {
            acc[bId] = {
                booking: doc.booking,
                docs: [],
                pendingCount: 0
            };
        }
        acc[bId].docs.push(doc);
        if (doc.status === "PENDING") acc[bId].pendingCount++;
        return acc;
    }, {});

    const bookingGroups = Object.values(groupedByBooking);
    const pendingGroups = bookingGroups.filter((g: any) => g.pendingCount > 0);
    const reviewedGroups = bookingGroups.filter((g: any) => g.pendingCount === 0);

    const handleVerifyUpdate = async (docId: string, status: 'VERIFIED' | 'REJECTED', note?: string) => {
        try {
            await verifyDocument(docId, status, note);
            toast({
                title: status === 'VERIFIED' ? "Document Verified" : "Reupload Requested",
                description: status === 'VERIFIED' ? "Verification complete." : "Tenant notified for reupload.",
            });
            if (status === 'REJECTED') {
                setRejectTarget(null);
                setRejectNote("");
            }
            fetchDocs();
        } catch (e) {
            toast({
                title: "Action Failed",
                variant: "destructive",
            });
        }
    };

    if (loading) return (
        <div className="p-8 flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground font-medium text-xs tracking-widest uppercase">Fetching Verification Queue...</p>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border shadow-sm">
                <div>
                    <h1 className="text-2xl font-black tracking-tighter text-slate-900 flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl text-white">
                            <Shield className="w-6 h-6" />
                        </div>
                        Customer Doc Verifications
                    </h1>
                    <p className="text-slate-500 mt-1 font-bold text-xs uppercase tracking-tight">Review uploaded identities for onboarded tenants</p>
                </div>
                {docs.length > 0 && (
                    <div className="flex items-center gap-2">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Awaiting Action</p>
                            <p className="text-xl font-black text-indigo-600 leading-none">{docs.filter(d => d.status === "PENDING").length}</p>
                        </div>
                    </div>
                )}
            </div>

            {bookingGroups.length === 0 ? (
                <Card className="border-dashed border-2 bg-slate-50/50">
                    <CardContent className="p-16 text-center">
                        <div className="w-16 h-16 bg-white shadow-inner rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <FileCheck className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Verification Queue Empty</h3>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-tighter mt-1">No new submissions found at this time.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-12">
                    {/* Pending Section */}
                    {pendingGroups.length > 0 && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 px-1">
                                <div className="h-5 w-1.5 bg-amber-500 rounded-full"></div>
                                <h2 className="font-black text-sm text-slate-700 uppercase tracking-widest leading-none">Requires Attention</h2>
                            </div>
                            <div className="space-y-3">
                                {pendingGroups.map((group: any) => (
                                    <BookingRow key={group.booking.id} group={group} onSelect={setSelectedBooking} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Reviewed Section */}
                    {reviewedGroups.length > 0 && (
                        <div className={`space-y-6 ${pendingGroups.length > 0 ? "pt-10 border-t border-slate-100" : ""}`}>
                            <div className="flex items-center gap-2 px-1">
                                <div className="h-5 w-1.5 bg-emerald-500 rounded-full"></div>
                                <h2 className="font-black text-sm text-slate-600 uppercase tracking-widest leading-none">Review History</h2>
                            </div>
                            <div className="space-y-3">
                                {reviewedGroups.map((group: any) => (
                                    <BookingRow key={group.booking.id} group={group} onSelect={setSelectedBooking} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Document Detail Panel (Drill-down) */}
            <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
                <DialogContent className="max-w-[95vw] w-full h-[95vh] overflow-y-auto p-0 border-none rounded-none md:rounded-[2.5rem] bg-slate-50 flex flex-col">
                    {selectedBooking && (
                        <>
                            <div className="p-8 bg-white border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-xl shadow-indigo-100 uppercase">
                                        {selectedBooking.booking.guestName ? selectedBooking.booking.guestName[0] : 'U'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">{selectedBooking.booking.guestName}</h2>
                                            {selectedBooking.docs.length === 4 && selectedBooking.docs.every((d: any) => d.status === "VERIFIED") && (
                                                <Badge className="bg-emerald-100 text-emerald-600 border-none font-black text-[10px] uppercase px-3 py-1">All Verified</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100/50 text-[10px] font-black uppercase tracking-widest">{selectedBooking.booking.propertyName}</span>
                                            <span className="text-slate-400 font-bold text-[11px] uppercase tracking-tighter">Room {selectedBooking.booking.roomAssigned || "TBD"} • #{selectedBooking.booking.displayId}</span>
                                        </div>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="hover:bg-slate-100 rounded-full h-12 w-12" onClick={() => setSelectedBooking(null)}>✕</Button>
                            </div>

                            <div className="p-8 pb-20 flex-1 overflow-y-auto">
                                {/* Responsive grid to prevent squashing */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-8">
                                    {Object.keys(TYPE_LABELS).map((type) => {
                                        const doc = selectedBooking.docs.find((d: any) => d.type === type);
                                        return (
                                            <DocumentDetailCard
                                                key={type}
                                                type={type}
                                                doc={doc}
                                                onVerify={() => handleVerifyUpdate(doc.id, 'VERIFIED')}
                                                onReject={() => setRejectTarget(doc.id)}
                                                onView={() => setPreviewDoc(doc)}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Rejection Modal */}
            <Dialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600 font-black uppercase text-sm tracking-widest">
                            <AlertCircle className="w-5 h-5" />
                            Request Re-upload
                        </DialogTitle>
                        <DialogDescription className="font-bold text-xs">
                            Explain precisely why this document is being rejected. The student will be prompted to re-upload.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea
                            placeholder="e.g., Image is blurry, name does not match, etc..."
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            className="min-h-[100px] border-slate-200 focus:ring-red-500 rounded-xl font-medium"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" className="font-bold text-xs" onClick={() => setRejectTarget(null)}>Cancel</Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 font-black text-xs tracking-widest h-11 px-8 rounded-xl text-white"
                            onClick={() => handleVerifyUpdate(rejectTarget!, 'REJECTED', rejectNote)}
                        >
                            REQUEST REUPLOAD
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Preview Modal */}
            <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
                <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-slate-900 border-none rounded-3xl">
                    <div className="p-6 bg-white/10 backdrop-blur-xl flex justify-between items-center text-white border-b border-white/5">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-indigo-500 rounded-xl text-white">{previewDoc && TYPE_ICONS[previewDoc.type]}</div>
                            <div>
                                <h3 className="font-black text-sm tracking-widest uppercase">{previewDoc && TYPE_LABELS[previewDoc.type]}</h3>
                                <p className="text-[10px] font-bold opacity-50 uppercase tracking-tighter">{previewDoc?.booking?.guestName}</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="hover:bg-white/10 text-white rounded-full" onClick={() => setPreviewDoc(null)}>✕</Button>
                    </div>
                    <div className="flex items-center justify-center p-8 min-h-[400px]">
                        {previewDoc?.fileData?.startsWith("data:image") ? (
                            <img src={previewDoc.fileData} className="max-w-full max-h-[60vh] object-contain rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border-4 border-white/10" />
                        ) : (
                            <div className="text-white/30 text-center font-black uppercase tracking-widest text-xs">
                                <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                No Visual Preview
                            </div>
                        )}
                    </div>
                    <div className="p-6 bg-black/40 border-t border-white/5 flex justify-end">
                        <Button variant="outline" className="text-white border-white/20 hover:bg-white/10 font-bold rounded-xl" onClick={() => setPreviewDoc(null)}>Close Experience</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <style jsx global>{`
                @keyframes pulse-glow {
                    0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
                    70% { box-shadow: 0 0 0 15px rgba(245, 158, 11, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
                }
                @keyframes pulse-glow-emerald {
                    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
                    70% { box-shadow: 0 0 0 15px rgba(16, 185, 129, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                }
                .animate-pulse-glow {
                    animation: pulse-glow 2s infinite;
                }
                .animate-pulse-glow-emerald {
                    animation: pulse-glow-emerald 2s infinite;
                }
            `}</style>
        </div>
    );
}

const SHORT_LABELS: Record<string, string> = {
    ID_PROOF: "Identity",
    ADDRESS_PROOF: "Address",
    COLLEGE_COMPANY: "College/Work",
    SELFIE: "Selfie"
};

function BookingRow({ group, onSelect }: { group: any, onSelect: any }) {
    const isFullyVerified = group.docs.length === 4 && group.docs.every((d: any) => d.status === "VERIFIED");

    return (
        <Card className="border-none shadow-sm hover:shadow-xl transition-all group overflow-hidden bg-white">
            <CardContent className="p-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between p-5 gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 font-black text-xl">
                            {group.booking.guestName ? group.booking.guestName[0].toUpperCase() : 'U'}
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase leading-none">{group.booking.guestName}</h3>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100/50">{group.booking.propertyName}</span>
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">Room {group.booking.roomAssigned || "TBD"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Status indicators (ID, Address, College, Selfie) */}
                    <div className="flex-1 max-w-2xl grid grid-cols-2 sm:grid-cols-4 gap-4 px-0 md:px-10 md:border-x border-slate-50">
                        {Object.keys(SHORT_LABELS).map((type) => {
                            const doc = group.docs.find((d: any) => d.type === type);
                            let colorClass = "text-slate-400 font-bold";
                            let statusLabel = "Missing";

                            if (doc) {
                                if (doc.status === "VERIFIED") {
                                    colorClass = "text-emerald-600 font-black";
                                    statusLabel = "Verified";
                                } else {
                                    colorClass = "text-amber-500 font-black";
                                    statusLabel = "Pending";
                                }
                            }

                            return (
                                <div key={type} className="flex flex-col items-start">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{SHORT_LABELS[type]}</span>
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-2.5 h-2.5 rounded-full bg-current ${colorClass}`}></div>
                                        <span className={`text-[11px] uppercase tracking-tight ${colorClass}`}>{statusLabel}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex items-center">
                        <Button
                            className={`relative h-14 px-10 font-black text-[12px] tracking-widest rounded-2xl transition-all duration-300 ${group.pendingCount > 0
                                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-200 animate-pulse-glow border-b-4 border-amber-700'
                                    : isFullyVerified
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-100 animate-pulse-glow-emerald border-b-4 border-emerald-800'
                                        : 'bg-slate-900 hover:bg-black text-white hover:scale-105 active:scale-95'
                                }`}
                            onClick={() => onSelect(group)}
                        >
                            <Shield className="w-5 h-5 mr-3" />
                            {group.pendingCount > 0 ? 'REVIEW SUBMISSIONS →' : isFullyVerified ? 'ALL VERIFIED ✔' : 'VIEW PORTFOLIO'}
                            {group.pendingCount > 0 && (
                                <span className="absolute -top-3 -right-3 w-8 h-8 bg-red-600 text-[12px] rounded-full flex items-center justify-center border-4 border-white font-black shadow-xl ring-2 ring-red-100">
                                    {group.pendingCount}
                                </span>
                            )}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function DocumentDetailCard({ type, doc, onVerify, onReject, onView }: any) {
    if (!doc) {
        return (
            <Card className="border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center p-10 rounded-[2.5rem] opacity-70 h-full min-h-[350px]">
                <div className="p-5 bg-white rounded-3xl shadow-inner mb-6 border border-slate-100">
                    <div className="text-slate-200">{TYPE_ICONS[type] || <FileText className="w-10 h-10" />}</div>
                </div>
                <h4 className="font-black text-[11px] text-slate-400 uppercase tracking-[0.2em] mb-2 text-center">{TYPE_LABELS[type]}</h4>
                <div className="px-5 py-2 bg-white rounded-full border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center">Not Available</p>
                </div>
            </Card>
        );
    }

    const isVerified = doc.status === "VERIFIED";
    const isRejected = doc.status === "REJECTED";
    const isPending = doc.status === "PENDING";
    const isReuploadPending = doc.status === "PENDING_REUPLOAD";

    return (
        <Card className={`border shadow-sm rounded-[2.5rem] overflow-hidden transition-all duration-500 bg-white group hover:shadow-2xl hover:-translate-y-1 ${isVerified ? 'border-emerald-200 shadow-emerald-50' : 'border-slate-100'}`}>
            <CardContent className="p-0 flex flex-col h-full min-h-[450px]">
                {/* Header matching user's 2nd image */}
                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-5">
                        <div className={`p-4 rounded-2xl transition-all duration-500 shadow-sm ${isVerified ? 'bg-emerald-50 text-emerald-600 ring-4 ring-emerald-50/50' : 'bg-slate-100 text-slate-500'}`}>
                            {TYPE_ICONS[type]}
                        </div>
                        <div>
                            <h4 className="font-black text-sm text-slate-800 uppercase tracking-tighter leading-none">{TYPE_LABELS[type]}</h4>
                            <p className="text-[10px] text-slate-400 font-black mt-2 uppercase tracking-widest opacity-60">Tenant Identity</p>
                        </div>
                    </div>
                </div>

                {/* Actions row: Improved button layout */}
                {!isVerified ? (
                    <div className="flex items-stretch border-b border-slate-50 h-[3.5rem]">
                        <button
                            className="flex-1 bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center gap-2 transition-all group/btn"
                            title="Reject Document"
                            onClick={onReject}
                        >
                            <Trash2 className="w-5 h-5" />
                            <span className="text-[11px] font-black uppercase tracking-widest hidden xl:inline group-hover/btn:scale-110">Reject</span>
                        </button>
                        <button
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 transition-all group/btn"
                            title="Request Re-upload"
                            onClick={onReject}
                        >
                            <RefreshCcw className="w-5 h-5 font-bold" />
                            <span className="text-[11px] font-black uppercase tracking-widest hidden xl:inline group-hover/btn:scale-110">Resend</span>
                        </button>
                        <button
                            className="flex-1 bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center gap-2 transition-all group/btn border-l border-white/10"
                            title="View Full Size"
                            onClick={onView}
                        >
                            <Eye className="w-5 h-5 font-bold" />
                            <span className="text-[11px] font-black uppercase tracking-widest hidden xl:inline group-hover/btn:scale-110">View</span>
                        </button>
                        <button
                            className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-3 transition-all group/btn border-l border-emerald-500 shadow-[inset_0_4px_10px_rgba(0,0,0,0.1)]"
                            onClick={onVerify}
                        >
                            <CheckCircle className="w-5 h-5 font-bold" />
                            <span className="text-[12px] font-black uppercase tracking-widest group-hover/btn:translate-x-1">APPROVE ID</span>
                        </button>
                    </div>
                ) : (
                    <div className="bg-emerald-50 py-4 px-8 flex items-center justify-between border-b border-emerald-100">
                        <div className="flex items-center gap-3 text-emerald-600 font-black text-[11px] uppercase tracking-[0.2em]">
                            <CheckCircle className="w-5 h-5" />
                            Document Verified
                        </div>
                        <button className="text-[11px] font-black text-emerald-400 hover:text-emerald-700 uppercase tracking-widest transition-colors" onClick={onView}>View Proof</button>
                    </div>
                )}

                {/* Image and Status Area */}
                <div className="p-8 bg-slate-50 flex-1 flex flex-col justify-between gap-8">
                    <div className="w-full aspect-[4/3] rounded-[2rem] overflow-hidden border-2 border-slate-200 bg-white shadow-inner relative group/img cursor-pointer transition-transform duration-500 hover:scale-[1.02]" onClick={onView}>
                        {doc.fileData?.startsWith("data:image") ? (
                            <img src={doc.fileData} className="w-full h-full object-contain p-3" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                                <FileText className="w-16 h-16 opacity-10 mb-4" />
                                <span className="text-[11px] font-black uppercase tracking-widest">Digital PDF Document</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="bg-white/95 backdrop-blur-md p-5 rounded-full shadow-2xl scale-75 group-hover/img:scale-100 transition-transform duration-500">
                                <Eye className="w-8 h-8 text-indigo-600" />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-center">
                        {isPending && (
                            <div className="bg-amber-100 text-amber-600 px-8 py-4 rounded-[1.5rem] flex items-center gap-4 shadow-sm border border-amber-200/50">
                                <Clock className="w-5 h-5 animate-pulse" />
                                <span className="text-[11px] font-black uppercase tracking-[0.25em]">Pending Review</span>
                            </div>
                        )}
                        {isReuploadPending && (
                            <div className="bg-rose-100 text-rose-600 px-8 py-4 rounded-[1.5rem] flex items-center gap-4 border border-rose-200/50 shadow-sm">
                                <RefreshCcw className="w-5 h-5 animate-spin-slow" />
                                <span className="text-[11px] font-black uppercase tracking-[0.25em]">Requesting Reupload</span>
                            </div>
                        )}
                        {isVerified && (
                            <div className="bg-emerald-100 text-emerald-600 px-8 py-4 rounded-[1.5rem] flex items-center gap-4 border border-emerald-200/50 shadow-sm animate-in fade-in zoom-in duration-500">
                                <FileCheck className="w-5 h-5" />
                                <span className="text-[11px] font-black uppercase tracking-[0.25em]">Access Verified</span>
                            </div>
                        )}
                    </div>
                </div>

                {isRejected && doc.rejectedNote && (
                    <div className="px-8 pb-8 pt-0">
                        <div className="p-5 bg-rose-50/50 rounded-2xl border border-rose-100/50 shadow-inner">
                            <p className="text-[11px] font-bold text-rose-600 italic leading-snug">Note: "{doc.rejectedNote}"</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Global styles for smooth animations

// Keeping the original VerificationCard logic but refactored into the above structure for the user's specific request
// The user explicitly wants a list of customers first.
