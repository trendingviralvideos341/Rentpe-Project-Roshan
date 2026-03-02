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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
                <DialogContent className="max-w-[95vw] w-full h-[95vh] overflow-hidden p-0 border-none rounded-none md:rounded-[3rem] bg-slate-50 flex flex-col shadow-2xl">
                    {selectedBooking && (
                        <>
                            {/* Pro Header */}
                            <div className="p-8 bg-white border-b border-slate-100 flex justify-between items-center sticky top-0 z-20 shadow-sm">
                                <div className="flex items-center gap-8">
                                    <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-indigo-600 to-violet-700 text-white flex items-center justify-center text-3xl font-black shadow-2xl shadow-indigo-200 uppercase transform -rotate-3 transition-transform duration-700 group-hover:rotate-0">
                                        {selectedBooking.booking.guestName ? selectedBooking.booking.guestName[0] : 'U'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-4">
                                            <h2 className="text-3xl font-black text-slate-910 tracking-tighter uppercase leading-none">{selectedBooking.booking.guestName}</h2>
                                            {selectedBooking.docs.length === 4 && selectedBooking.docs.every((d: any) => d.status === "VERIFIED") && (
                                                <div className="bg-emerald-500 text-white font-black text-[10px] uppercase px-4 py-1.5 rounded-full shadow-lg shadow-emerald-100 border-2 border-emerald-400 animate-bounce-subtle">
                                                    Fully Verified ✔
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 mt-3">
                                            <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100/50 text-[11px] font-black uppercase tracking-widest shadow-sm">{selectedBooking.booking.propertyName}</span>
                                            <div className="h-1 w-1 rounded-full bg-slate-300"></div>
                                            <span className="text-slate-600 font-black text-[12px] uppercase tracking-tighter bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">Room {selectedBooking.booking.roomAssigned || "TBD"}</span>
                                            <span className="text-slate-400 font-bold text-[11px] uppercase tracking-widest opacity-60">ID: #{selectedBooking.booking.displayId}</span>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="hover:bg-rose-50 hover:text-rose-500 rounded-2xl h-14 w-14 transition-all duration-300 group"
                                    onClick={() => setSelectedBooking(null)}
                                >
                                    <XCircle className="w-8 h-8 group-hover:rotate-90 transition-transform" />
                                </Button>
                            </div>

                            <div className="flex-1 overflow-y-auto bg-slate-50/50">
                                <Tabs defaultValue="ID_PROOF" className="h-full flex flex-col">
                                    <div className="bg-white border-b border-slate-100 px-10">
                                        <TabsList className="flex gap-8 bg-transparent h-16 p-0 border-none">
                                            {Object.keys(TYPE_LABELS).map((type) => {
                                                const doc = selectedBooking.docs.find((d: any) => d.type === type);
                                                const isDone = doc?.status === "VERIFIED";
                                                const isPending = doc?.status === "PENDING";

                                                return (
                                                    <TabsTrigger
                                                        key={type}
                                                        value={type}
                                                        className="relative h-full px-2 bg-transparent border-b-4 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent rounded-none font-black text-[11px] uppercase tracking-widest transition-all gap-2"
                                                    >
                                                        {TYPE_LABELS[type]}
                                                        {isDone && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                                                        {isPending && <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />}
                                                    </TabsTrigger>
                                                );
                                            })}
                                        </TabsList>
                                    </div>

                                    <div className="p-10 flex-1">
                                        <div className="max-w-4xl mx-auto h-full">
                                            {Object.keys(TYPE_LABELS).map((type) => (
                                                <TabsContent key={type} value={type} className="m-0 h-full mt-0 focus-visible:ring-0">
                                                    {(() => {
                                                        const doc = selectedBooking.docs.find((d: any) => d.type === type);
                                                        return (
                                                            <DocumentDetailCard
                                                                type={type}
                                                                doc={doc}
                                                                onVerify={() => handleVerifyUpdate(doc.id, 'VERIFIED')}
                                                                onReject={() => setRejectTarget(doc.id)}
                                                                onView={() => setPreviewDoc(doc)}
                                                            />
                                                        );
                                                    })()}
                                                </TabsContent>
                                            ))}
                                        </div>
                                    </div>
                                </Tabs>
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
                    70% { box-shadow: 0 0 0 20px rgba(245, 158, 11, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
                }
                @keyframes pulse-glow-emerald {
                    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
                    70% { box-shadow: 0 0 0 20px rgba(16, 185, 129, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                }
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
                .animate-pulse-glow { animation: pulse-glow 2s infinite; }
                .animate-pulse-glow-emerald { animation: pulse-glow-emerald 2s infinite; }
                .animate-bounce-subtle { animation: bounce-subtle 3s infinite ease-in-out; }
                .glass-card { background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px); }
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
        <Card className="border-none shadow-md hover:shadow-2xl transition-all duration-500 group overflow-hidden bg-white rounded-[2rem] border-l-[6px] border-slate-100 hover:border-indigo-500">
            <CardContent className="p-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between p-7 gap-8">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-slate-50 flex items-center justify-center text-slate-310 border-2 border-slate-100 font-black text-2xl shadow-inner group-hover:bg-indigo-50 group-hover:text-indigo-400 group-hover:border-indigo-100 transition-all duration-500">
                            {group.booking.guestName ? group.booking.guestName[0].toUpperCase() : 'U'}
                        </div>
                        <div>
                            <h3 className="font-black text-slate-910 text-xl tracking-tighter uppercase leading-none group-hover:text-indigo-600 transition-colors uppercase letter-spacing-tight">{group.booking.guestName}</h3>
                            <div className="flex items-center gap-4 mt-3">
                                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-[0.2em] bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100/50 shadow-sm">{group.booking.propertyName}</span>
                                <div className="h-1 w-1 rounded-full bg-slate-200"></div>
                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-tighter bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 shadow-inner">Room {group.booking.roomAssigned || "TBD"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Status indicators (High Contrast Pills) */}
                    <div className="flex-1 max-w-2xl grid grid-cols-2 lg:grid-cols-4 gap-3 px-0 lg:px-8 lg:border-x border-slate-50">
                        {Object.keys(SHORT_LABELS).map((type) => {
                            const doc = group.docs.find((d: any) => d.type === type);
                            let bgClass = "bg-slate-100/80 border-slate-200";
                            let textClass = "text-slate-500";
                            let dotClass = "bg-slate-300";
                            let statusLabel = "Missing";

                            if (doc) {
                                if (doc.status === "VERIFIED") {
                                    bgClass = "bg-emerald-50 border-emerald-100";
                                    textClass = "text-emerald-700 font-bold";
                                    dotClass = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]";
                                    statusLabel = "Verified";
                                } else {
                                    bgClass = "bg-orange-50 border-orange-100";
                                    textClass = "text-orange-700 font-bold";
                                    dotClass = "bg-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]";
                                    statusLabel = "Pending";
                                }
                            }

                            return (
                                <div key={type} className="flex flex-col items-start gap-1">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">{SHORT_LABELS[type]}</span>
                                    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border ${bgClass} shadow-sm transition-all duration-300 w-full min-w-0`}>
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`}></div>
                                        <span className={`text-[9px] font-black uppercase tracking-tight truncate ${textClass}`}>{statusLabel}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex items-center">
                        <Button
                            className={`relative h-16 px-12 font-black text-[13px] uppercase tracking-widest rounded-2xl transition-all duration-500 hover:scale-105 active:scale-95 ${group.pendingCount > 0
                                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-2xl shadow-orange-200 animate-pulse-glow border-b-[6px] border-orange-700'
                                : isFullyVerified
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xl shadow-emerald-200 animate-pulse-glow-emerald border-b-[6px] border-emerald-800'
                                    : 'bg-slate-900 hover:bg-black text-white hover:shadow-2xl border-b-[6px] border-black'
                                }`}
                            onClick={() => onSelect(group)}
                        >
                            <Shield className="w-5 h-5 mr-4" />
                            {group.pendingCount > 0 ? 'REVIEW SUBMISSIONS →' : isFullyVerified ? 'ALL VERIFIED ✔' : 'VIEW PORTFOLIO'}
                            {group.pendingCount > 0 && (
                                <span className="absolute -top-4 -right-4 w-10 h-10 bg-red-600 text-[14px] rounded-full flex items-center justify-center border-4 border-white font-black shadow-2xl ring-4 ring-red-50 animate-in zoom-in duration-500">
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
            <Card className="border-4 border-dashed border-slate-200 bg-slate-50/50 flex flex-row items-center justify-between p-12 rounded-[3rem] opacity-70 group hover:opacity-100 transition-all duration-500 border-spacing-4">
                <div className="flex items-center gap-10">
                    <div className="p-8 bg-white rounded-[2.5rem] shadow-2xl border-2 border-slate-100 transform -rotate-3 group-hover:rotate-0 transition-transform duration-500">
                        <div className="text-slate-300">{TYPE_ICONS[type] || <FileText className="w-12 h-12" />}</div>
                    </div>
                    <div>
                        <h4 className="font-black text-xl text-slate-800 uppercase tracking-tighter mb-2">{TYPE_LABELS[type]}</h4>
                        <div className="flex items-center gap-3">
                            <Badge className="bg-slate-200 text-slate-600 font-black text-[10px] uppercase px-4 py-1 border-none shadow-sm">NOT UPLOADED YET</Badge>
                            <p className="text-[11px] font-bold text-slate-400 italic">Tenant has not submitted this proof.</p>
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-slate-200/50 rounded-3xl">
                    <AlertCircle className="w-8 h-8 text-slate-300" />
                </div>
            </Card>
        );
    }

    const isVerified = doc.status === "VERIFIED";
    const isRejected = doc.status === "REJECTED";
    const isPending = doc.status === "PENDING";
    const isReuploadPending = doc.status === "PENDING_REUPLOAD";

    return (
        <Card className={`border-2 shadow-xl rounded-[2.5rem] overflow-hidden transition-all duration-700 bg-white group hover:shadow-2xl ${isVerified ? 'border-emerald-200 ring-4 ring-emerald-50/20' : 'border-slate-100'}`}>
            <CardContent className="p-0">
                <div className="flex flex-col lg:flex-row min-h-[400px]">
                    {/* Left: Huge Preview Area */}
                    <div className="w-full lg:w-[45%] relative bg-slate-900 overflow-hidden cursor-zoom-in group/img" onClick={onView}>
                        {doc.fileData?.startsWith("data:image") ? (
                            <img src={doc.fileData} className="w-full h-full object-contain p-4 group-hover/img:scale-105 transition-all duration-700" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                                <FileText className="w-16 h-16 opacity-20 mb-4" />
                                <span className="font-black uppercase tracking-widest text-[10px] opacity-30 text-white">Digital Document</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60"></div>
                        <div className="absolute bottom-4 left-6 flex items-center gap-3">
                            <div className="bg-white/10 backdrop-blur-md p-2 rounded-lg border border-white/20">
                                <Eye className="w-4 h-4 text-white" />
                            </div>
                            <p className="text-white text-[10px] font-bold uppercase tracking-widest">Click to Expand</p>
                        </div>
                    </div>

                    {/* Right: Info and Actions */}
                    <div className="flex-1 p-8 flex flex-col justify-between bg-white">
                        <div className="space-y-6">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`p-4 rounded-2xl ${isVerified ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                        {TYPE_ICONS[type]}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-xl text-slate-900 tracking-tight uppercase leading-none">{TYPE_LABELS[type]}</h4>
                                        <div className="flex items-center gap-2 mt-2">
                                            <Badge className="bg-slate-100 text-slate-500 border-none font-bold text-[9px] uppercase px-2 py-0.5">Verification Point</Badge>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {isVerified && <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[9px] uppercase px-3 py-1.5 rounded-lg">VERIFIED ✓</Badge>}
                                    {isPending && <Badge className="bg-orange-100 text-orange-700 border-none font-black text-[9px] uppercase px-3 py-1.5 rounded-lg">PENDING</Badge>}
                                    {isRejected && <Badge className="bg-rose-100 text-rose-700 border-none font-black text-[9px] uppercase px-3 py-1.5 rounded-lg">REJECTED</Badge>}
                                </div>
                            </div>

                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Info className="w-3.5 h-3.5" />
                                    Review Requirements
                                </h5>
                                <ul className="space-y-2">
                                    {['Check Name Details', 'Validity Date', 'Photo matched'].map(check => (
                                        <li key={check} className="flex items-center gap-2.5 text-[11px] font-bold text-slate-600">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>
                                            {check}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {isRejected && doc.rejectedNote && (
                                <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                                    <p className="text-[11px] font-bold text-rose-700 leading-relaxed italic">"{doc.rejectedNote}"</p>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        {!isVerified ? (
                            <div className="flex items-center gap-3 pt-6">
                                <Button
                                    variant="outline"
                                    className="h-12 flex-1 rounded-xl border-2 border-slate-100 text-rose-600 hover:bg-rose-50 font-black text-[10px] uppercase tracking-widest"
                                    onClick={onReject}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Reject
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-12 flex-1 rounded-xl border-2 border-slate-100 text-indigo-600 hover:bg-indigo-50 font-black text-[10px] uppercase tracking-widest"
                                    onClick={onReject}
                                >
                                    <RefreshCcw className="w-4 h-4 mr-2" />
                                    Resend
                                </Button>
                                <Button
                                    className="h-12 flex-[1.5] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-100"
                                    onClick={onVerify}
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Approve Document
                                </Button>
                            </div>
                        ) : (
                            <div className="pt-6">
                                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <FileCheck className="w-5 h-5 text-emerald-500" />
                                        <span className="text-[11px] font-black text-emerald-700 uppercase">Trusted and Verified</span>
                                    </div>
                                    <Button variant="ghost" size="sm" className="text-emerald-500 hover:text-emerald-700 font-bold text-[10px] uppercase" onClick={onView}>View Proof</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// Global styles for smooth animations

// Keeping the original VerificationCard logic but refactored into the above structure for the user's specific request
// The user explicitly wants a list of customers first.
