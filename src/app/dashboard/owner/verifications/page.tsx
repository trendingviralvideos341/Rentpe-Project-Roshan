"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    CheckCircle, XCircle, Clock, Eye, AlertCircle,
    User, Building2, CreditCard, Calendar, ArrowRight,
    MapPin, Phone, Mail, Trash2, RefreshCcw, Info, FileText, Shield, FileCheck, Camera, ShieldCheck, Upload, Search
} from "lucide-react";
import { getPendingDocuments, verifyDocument } from "@/actions/documents";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";

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
    const [search, setSearch] = useState("");
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

    const filteredDocs = docs.filter(doc => {
        const query = search.toLowerCase();
        return (
            doc.booking?.guestName?.toLowerCase().includes(query) ||
            doc.booking?.displayId?.toLowerCase().includes(query) ||
            doc.booking?.propertyName?.toLowerCase().includes(query)
        );
    });

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
                        Owner Verification Center
                    </h1>
                    <p className="text-slate-500 mt-1 font-bold text-xs uppercase tracking-tight">Status-based review of student identity documents</p>
                </div>
                {docs.length > 0 && (
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Pending</p>
                            <p className="text-xl font-black text-indigo-600 leading-none">{docs.filter(d => d.status === "PENDING").length}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchDocs} disabled={loading} className="rounded-xl border-slate-200 font-bold uppercase text-[10px] tracking-widest">
                            <RefreshCcw className={`w-3 h-3 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                        </Button>
                    </div>
                )}
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-2xl border shadow-sm sticky top-0 z-10">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search by customer name, PG or ID..."
                        className="pl-11 h-12 border-slate-100 bg-slate-50/50 focus:bg-white rounded-xl font-medium text-sm transition-all"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {docs.length === 0 ? (
                <Card className="border-dashed border-2 bg-slate-50/50">
                    <CardContent className="p-16 text-center">
                        <div className="w-16 h-16 bg-white shadow-inner rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <FileCheck className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Verification Queue Empty</h3>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-tighter mt-1">No submissions found at this time.</p>
                    </CardContent>
                </Card>
            ) : filteredDocs.length === 0 ? (
                <Card className="border-slate-100">
                    <CardContent className="p-12 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                        No matches found for "{search}"
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-12">
                    {['PENDING', 'VERIFIED', 'REJECTED'].map((status) => {
                        // Group by booking ID within each section based on high-priority status
                        const groupedByBooking: Record<string, { booking: any, docs: any[], overallStatus: string }> = {};

                        filteredDocs.forEach(doc => {
                            const bid = doc.booking?.id || 'unknown';
                            if (!groupedByBooking[bid]) {
                                groupedByBooking[bid] = { booking: doc.booking, docs: [], overallStatus: 'VERIFIED' };
                            }
                            groupedByBooking[bid].docs.push(doc);
                        });

                        // Calculate overall status for each group: Rejected > Pending > Verified
                        Object.values(groupedByBooking).forEach(group => {
                            if (group.docs.some(d => d.status === 'REJECTED')) group.overallStatus = 'REJECTED';
                            else if (group.docs.some(d => d.status === 'PENDING')) group.overallStatus = 'PENDING';
                        });

                        const groupsInStatus = Object.values(groupedByBooking).filter(g => g.overallStatus === status);
                        if (groupsInStatus.length === 0) return null;

                        const STATUS_MAP: any = {
                            PENDING: { label: "PENDING DOCUMENTS", color: "text-red-600", bg: "bg-red-500", icon: <Clock className="w-4 h-4" /> },
                            VERIFIED: { label: "VERIFIED DOCUMENTS", color: "text-emerald-600", bg: "bg-emerald-500", icon: <CheckCircle className="w-4 h-4" /> },
                            REJECTED: { label: "REJECTED DOCUMENTS", color: "text-slate-500", bg: "bg-slate-400", icon: <XCircle className="w-4 h-4" /> }
                        };
                        const config = STATUS_MAP[status];

                        return (
                            <div key={status} className="animate-in fade-in slide-in-from-bottom-5 duration-500">
                                <div className="flex items-center gap-3 mb-6 px-2">
                                    <div className={`p-2 rounded-lg ${config.bg} text-white shadow-lg shadow-indigo-100`}>
                                        {config.icon}
                                    </div>
                                    <h2 className={`text-sm font-black tracking-[0.2em] uppercase ${config.color}`}>
                                        {config.label} ({groupsInStatus.length})
                                    </h2>
                                </div>
                                <div className="space-y-4">
                                    {groupsInStatus.map((group: any) => (
                                        <DocumentRowCard
                                            key={group.booking.id}
                                            group={group}
                                            onViewPortfolio={() => setSelectedBooking({ booking: group.booking, docs: group.docs })}
                                            onVerifyAll={() => {/* Future optimization: verify all */ }}
                                            onZoom={(doc: any) => setPreviewDoc(doc)}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Document Detail Panel (Drill-down) */}
            <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
                <DialogContent className="!fixed !inset-0 !translate-x-0 !translate-y-0 !max-w-none !w-screen !h-screen !m-0 !rounded-none bg-white flex flex-col !shadow-none !border-none z-[100] !p-0">
                    <div className="sr-only">
                        <DialogTitle>Document Verification Details</DialogTitle>
                        <DialogDescription>Review and verify tenant uploaded documents</DialogDescription>
                    </div>
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
                                <div className="p-8 flex-1 overflow-y-auto">
                                    <div className="w-full h-full">
                                        <div id="unique-verification-grid" className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-7xl mx-auto">
                                            {Object.keys(TYPE_LABELS).map((type) => {
                                                const doc = selectedBooking.docs.find((d: any) => d.type === type);
                                                return (
                                                    <DocumentDetailCard
                                                        key={type}
                                                        type={type}
                                                        doc={doc}
                                                        onVerify={() => handleVerifyUpdate(doc?.id, 'VERIFIED')}
                                                        onReject={() => setRejectTarget(doc?.id)}
                                                        onView={() => doc && setPreviewDoc(doc)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
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
                                <DialogTitle className="font-black text-sm tracking-widest uppercase text-white">
                                    {previewDoc && TYPE_LABELS[previewDoc.type]}
                                </DialogTitle>
                                <DialogDescription className="text-[10px] font-bold opacity-50 uppercase tracking-tighter text-white/70">
                                    Document preview for {previewDoc?.booking?.guestName}
                                </DialogDescription>
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

function DocumentRowCard({ group, onViewPortfolio, onZoom }: any) {
    const { booking, docs, overallStatus } = group;
    const verifiedDocs = docs.filter((d: any) => d.status === "VERIFIED");
    const verifiedPercentage = Math.round((verifiedDocs.length / 4) * 100);
    const isFullyVerified = verifiedPercentage === 100;

    const getStatusDetails = (type: string) => {
        const doc = docs.find((d: any) => d.type === type);
        if (!doc) return { color: 'bg-slate-100', label: 'Missing', icon: <div className="w-1.5 h-1.5 rounded-full bg-slate-300" /> };
        if (doc.status === 'VERIFIED') return { color: 'bg-emerald-500', label: 'Verified', icon: <CheckCircle className="w-2.5 h-2.5 text-white" /> };
        if (doc.status === 'REJECTED') return { color: 'bg-rose-500', label: 'Rejected', icon: <XCircle className="w-2.5 h-2.5 text-white" /> };
        return { color: 'bg-amber-500', label: 'Pending', icon: <Clock className="w-2.5 h-2.5 text-white" /> };
    };

    const docTypes = ['ID_PROOF', 'ADDRESS_PROOF', 'COLLEGE_COMPANY', 'SELFIE'];

    return (
        <Card className="border-none shadow-md hover:shadow-xl transition-all duration-300 group overflow-hidden bg-white rounded-2xl border-l-4 border-slate-100 hover:border-indigo-500 transform hover:-translate-y-1">
            <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-6 flex-1 min-w-[400px]">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 flex items-center justify-center text-xl font-black text-slate-400 shadow-inner group-hover:scale-110 transition-transform group-hover:text-indigo-500 group-hover:border-indigo-100">
                            {booking?.guestName ? booking.guestName[0].toUpperCase() : 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 truncate">
                                <h3 className="font-black text-slate-900 text-base tracking-tight uppercase truncate group-hover:text-indigo-600 transition-colors">{booking?.guestName}</h3>
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">#{booking?.displayId}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 mb-1">
                                <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                                    <MapPin className="w-3.5 h-3.5 opacity-50" /> {booking?.propertyName}
                                </span>
                                <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                                    <Phone className="w-3.5 h-3.5 opacity-50" /> {booking?.guestPhone}
                                </span>
                            </div>
                        </div>

                        {/* Status Summary Dots */}
                        <div className="flex items-center gap-3 px-6 border-x border-slate-100">
                            {docTypes.map(type => {
                                const status = getStatusDetails(type);
                                const config = TYPE_CONFIG[type];
                                return (
                                    <div key={type} className="flex flex-col items-center gap-1.5 group/dot cursor-help relative" title={`${config.label}: ${status.label}`}>
                                        <div className={`w-8 h-8 rounded-xl ${status.color} flex items-center justify-center shadow-sm transition-all hover:scale-110 hover:shadow-md`}>
                                            {status.icon}
                                        </div>
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{config.label.split(' ')[0]}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                        <Button
                            variant="outline"
                            className="h-11 px-6 rounded-xl border-slate-200 text-slate-700 font-bold uppercase text-[11px] tracking-widest hover:bg-slate-50 transition-all hover:border-indigo-200 hover:text-indigo-600 flex items-center gap-3 group/btn shadow-sm active:scale-95"
                            onClick={onViewPortfolio}
                        >
                            <FileText className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" /> View Documents
                        </Button>

                        <div className="flex items-center gap-3">
                            {isFullyVerified ? (
                                <Badge className="h-11 px-6 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] bg-emerald-500 text-white border-none shadow-lg shadow-emerald-100 animate-in zoom-in duration-500">
                                    100% Verified
                                </Badge>
                            ) : (
                                <Badge className={`h-11 px-6 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg animate-in zoom-in duration-500 flex items-center gap-2 border-none ${verifiedPercentage >= 75 ? 'bg-indigo-600 text-white shadow-indigo-100' :
                                        verifiedPercentage >= 50 ? 'bg-indigo-500 text-white shadow-indigo-100' :
                                            verifiedPercentage >= 25 ? 'bg-indigo-400 text-white shadow-indigo-100' :
                                                'bg-slate-400 text-white shadow-slate-100'
                                    }`}>
                                    <Shield className="w-3.5 h-3.5" /> {verifiedPercentage}% Verified
                                </Badge>
                            )}

                            {!isFullyVerified && (
                                <Button
                                    className={`h-11 w-11 p-0 rounded-xl ${overallStatus === 'REJECTED' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white shadow-lg transition-all active:scale-90 flex items-center justify-center`}
                                    title="Review & Verify Submissions"
                                    onClick={onViewPortfolio}
                                >
                                    <ShieldCheck className="w-5 h-5" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

const TYPE_CONFIG: any = {
    ID_PROOF: { label: 'Identity Proof', desc: 'Aadhaar, PAN or Voter ID', icon: <FileText className="w-5 h-5" />, colorClass: 'text-indigo-600', bgClass: 'bg-indigo-50', borderClass: 'border-indigo-200' },
    ADDRESS_PROOF: { label: 'Address Proof', desc: 'Electricity Bill or Rent Agreement', icon: <MapPin className="w-5 h-5" />, colorClass: 'text-orange-600', bgClass: 'bg-orange-50', borderClass: 'border-orange-200' },
    COLLEGE_COMPANY: { label: 'College / Work', desc: 'ID Card or Offer Letter', icon: <Building2 className="w-5 h-5" />, colorClass: 'text-purple-600', bgClass: 'bg-purple-50', borderClass: 'border-purple-200' },
    SELFIE: { label: 'Live Selfie', desc: 'Real-time Identity Check', icon: <Camera className="w-5 h-5" />, colorClass: 'text-cyan-600', bgClass: 'bg-cyan-50', borderClass: 'border-cyan-200' }
};

function DocumentDetailCard({ type, doc, onVerify, onReject, onView }: any) {
    const config = TYPE_CONFIG[type];
    const isVerified = doc?.status === "VERIFIED";
    const isRejected = doc?.status === "REJECTED";

    return (
        <div className={`border-2 ${config.borderClass} transition-all rounded-[2rem] p-6 flex flex-col justify-between shadow-xl bg-white group hover:shadow-2xl relative overflow-hidden ${isVerified ? 'ring-2 ring-emerald-500 ring-offset-4' : ''}`}>
            <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 ${config.bgClass} rounded-2xl ${config.colorClass} shadow-inner`}>{config.icon}</div>
                <div>
                    <h4 className="font-black text-lg tracking-tight text-slate-900 uppercase">{config.label}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{config.desc}</p>
                </div>
                {isVerified && (
                    <div className="ml-auto bg-emerald-500 text-white p-2 rounded-xl shadow-lg shadow-emerald-100">
                        <CheckCircle className="w-5 h-5" />
                    </div>
                )}
            </div>

            {doc ? (
                <div className="relative group/doc h-64 sm:h-80 rounded-[1.5rem] overflow-hidden border-2 border-slate-100 bg-slate-950 shadow-inner">
                    {doc.fileData?.startsWith("data:image") ? (
                        <img src={doc.fileData} className="w-full h-full object-contain p-2 group-hover/doc:scale-105 transition-all duration-700" title="Click for Full Resolution" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                            <FileText className="w-16 h-16 opacity-20 mb-4" />
                            <span className="font-black uppercase tracking-widest text-[10px] opacity-30 text-white text-center px-10">Document Preview Not Available</span>
                        </div>
                    )}

                    {/* Admin Overlays exactly as per Image 2 logic */}
                    <div className="absolute inset-x-0 bottom-0 bg-white/95 border-t border-slate-200 flex opacity-0 group-hover/doc:opacity-100 transition-all duration-300 divide-x shadow-2xl translate-y-2 group-hover/doc:translate-y-0">
                        {!isVerified && (
                            <>
                                <button
                                    onClick={(e) => { e.preventDefault(); onVerify(); }}
                                    className="flex-1 py-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase transition-colors hover:bg-emerald-50 text-emerald-700 tracking-widest"
                                >
                                    <ShieldCheck className="w-4 h-4" /> Verify Doc
                                </button>
                                <button
                                    onClick={(e) => { e.preventDefault(); onReject(); }}
                                    className="flex-1 py-4 hover:bg-rose-50 text-rose-700 flex items-center justify-center gap-2 text-[10px] font-black uppercase transition-colors tracking-widest"
                                >
                                    <RefreshCcw className="w-4 h-4" /> Reupload
                                </button>
                            </>
                        )}
                        <button
                            onClick={(e) => { e.preventDefault(); onView(); }}
                            className="flex-1 py-4 hover:bg-slate-50 text-slate-600 flex items-center justify-center gap-2 text-[10px] font-black uppercase transition-colors tracking-widest"
                        >
                            <Eye className="w-4 h-4" /> View Full
                        </button>
                    </div>

                    {isRejected && doc.rejectedNote && (
                        <div className="absolute top-4 left-4 right-4 bg-rose-600/90 backdrop-blur-md p-3 rounded-xl border border-white/20 shadow-2xl">
                            <p className="text-[10px] font-black text-white leading-relaxed uppercase tracking-tighter italic flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                "{doc.rejectedNote}"
                            </p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="h-64 sm:h-80 border-4 border-dashed border-slate-100 rounded-[1.5rem] flex flex-col items-center justify-center bg-slate-50 opacity-40">
                    <div className="p-6 bg-white rounded-3xl shadow-sm border border-slate-100 mb-4">
                        <Upload className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Awaiting Upload</p>
                </div>
            )}
        </div>
    );
}

// Global styles for smooth animations

// Keeping the original VerificationCard logic but refactored into the above structure for the user's specific request
// The user explicitly wants a list of customers first.
