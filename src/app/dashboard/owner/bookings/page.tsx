"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, RefreshCcw, FileText, ClipboardList, CheckCircle, XCircle, Eye, AlertCircle } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBookings, approveBooking, rejectBooking as rejectBookingAction, markBookingPaid, checkInBooking, markTokenCashPaid, verifyKycAndProceed, markKycFailed, cancelBooking } from "@/actions/bookings";
import { getAvailableRooms } from "@/actions/rooms";
import { getTenantDocuments, verifyDocument } from "@/actions/documents";
import { toast } from "sonner";


const TYPE_LABELS: Record<string, string> = {
    ID_PROOF: "🪪 ID Proof",
    ADDRESS_PROOF: "🏠 Address Proof",
    COLLEGE_COMPANY: "🎓 College / Company",
    SELFIE: "📸 Live Selfie",
    AADHAAR_FRONT: "🪪 Aadhaar Front",
    AADHAAR_BACK: "🪪 Aadhaar Back",
    PAN_FRONT: "💳 PAN Front",
    PAN_BACK: "💳 PAN Back",
    STUDENT_ID: "🎓 Student ID",
    COMPANY_ID: "🏢 Company ID",
    LIVE_PHOTO: "📸 Live Photo",
    OTHER: "📎 Other",
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    PENDING_APPROVAL:       { label: '🔴 New Request',        cls: 'bg-red-100 text-red-700 border-red-300' },
    WAITLISTED:             { label: '📋 Waitlisted',          cls: 'bg-blue-100 text-blue-700 border-blue-300' },
    APPROVED_PENDING_TOKEN: { label: '💳 Awaiting Token Pay', cls: 'bg-purple-100 text-purple-700 border-purple-300' },
    TOKEN_PAID:             { label: '💰 Token Paid',          cls: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
    ROOM_RESERVED:          { label: '🏠 Room Reserved',       cls: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
    KYC_PENDING:            { label: '📄 KYC Pending',         cls: 'bg-amber-100 text-amber-700 border-amber-300' },
    KYC_VERIFIED:           { label: '✅ KYC Verified',        cls: 'bg-teal-100 text-teal-700 border-teal-300' },
    KYC_FAILED:             { label: '❌ KYC Failed',          cls: 'bg-rose-100 text-rose-700 border-rose-300' },
    AGREEMENT_PENDING:      { label: '✍️ Agreement Pending',   cls: 'bg-violet-100 text-violet-700 border-violet-300' },
    BOOKING_CONFIRMED:      { label: '✅ Confirmed',           cls: 'bg-green-100 text-green-700 border-green-300' },
    CHECKED_IN:             { label: '🏡 Checked In',          cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    APPROVED_KYC_PENDING:   { label: '📄 KYC Pending',         cls: 'bg-amber-100 text-amber-700 border-amber-300' },
    APPROVED_PAYMENT_PENDING:{ label: '💳 Payment Pending',    cls: 'bg-purple-100 text-purple-700 border-purple-300' },
    PAID:                   { label: '✅ Paid',                cls: 'bg-green-100 text-green-700 border-green-300' },
    CASH_PAID:              { label: '✅ Cash Paid',           cls: 'bg-green-100 text-green-700 border-green-300' },
    REJECTED:               { label: '❌ Rejected',            cls: 'bg-gray-100 text-gray-600 border-gray-300' },
    CANCELLED:              { label: '🚫 Cancelled',           cls: 'bg-slate-100 text-slate-600 border-slate-300' },
    EXPIRED:                { label: '⏰ Expired',             cls: 'bg-orange-100 text-orange-700 border-orange-300' },
};

function StatusBadge({ status }: { status: string }) {
    const badge = STATUS_BADGE[status] || { label: status, cls: 'bg-gray-100 text-gray-600 border-gray-300' };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${badge.cls}`}>{badge.label}</span>;
}


// Per-booking expandable section with Onboarding + Documents tabs
function BookingDetail({ booking, rooms, onRefresh, defaultTab = "onboarding" }: { booking: any; rooms: any[]; onRefresh: () => void; defaultTab?: "onboarding" | "documents" }) {
    const [tab, setTab] = useState<"onboarding" | "documents">(defaultTab);
    const [docs, setDocs] = useState<any[]>([]);
    const [docsLoading, setDocsLoading] = useState(false);
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const [rejectNote, setRejectNote] = useState("");
    const [previewDoc, setPreviewDoc] = useState<any>(null);

    const fetchDocs = async () => {
        setDocsLoading(true);
        try {
            const d = await getTenantDocuments(booking.id);
            setDocs(d);
        } catch { } finally { setDocsLoading(false); }
    };

    useEffect(() => {
        if (tab === "documents") fetchDocs();
    }, [tab]);

    const handleVerify = async (docId: string) => {
        try { await verifyDocument(docId, "VERIFIED"); fetchDocs(); toast.success("Document Verified"); }
        catch { toast.error("Failed to verify."); }
    };

    const handleReject = async (docId: string) => {
        if (!rejectNote.trim()) { toast.error("Enter rejection reason."); return; }
        try {
            await verifyDocument(docId, "REJECTED", rejectNote);
            setRejectTarget(null); setRejectNote(""); fetchDocs();
            toast.success("Document Rejected");
        } catch { toast.error("Failed to reject."); }
    };


    const room = rooms.find(r => booking.roomAssigned?.includes(r.roomNumber));
    const contactInfo = booking.status === "APPROVED_PAYMENT_PENDING" || booking.status === "PAID" || booking.status === "CASH_PAID";

    const pendingDocs = docs.filter(d => d.status === "PENDING");
    const verifiedDocs = docs.filter(d => d.status === "VERIFIED");
    const rejectedDocs = docs.filter(d => d.status === "REJECTED");

    return (
        <tr>
            <td colSpan={7} className="bg-slate-50 border-b">
                <div className="p-4 space-y-3">
                    {/* Tab switcher */}
                    <div className="flex gap-2 border-b pb-2">
                        <button
                            onClick={() => setTab("onboarding")}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-t text-sm font-semibold border-b-2 transition-colors ${tab === "onboarding" ? "border-purple-600 text-purple-700 bg-purple-50" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                        >
                            <ClipboardList className="h-4 w-4" /> Onboarding
                        </button>
                        <button
                            onClick={() => { setTab("documents"); fetchDocs(); }}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-t text-sm font-semibold border-b-2 transition-colors ${tab === "documents" ? "border-blue-600 text-blue-700 bg-blue-50" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                        >
                            <FileText className="h-4 w-4" /> Verify Documents
                            {pendingDocs.length > 0 && tab === "documents" && (
                                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">{pendingDocs.length}</span>
                            )}
                        </button>
                    </div>

                    {/* ── ONBOARDING TAB ── */}
                    {tab === "onboarding" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Guest Details */}
                            <div className="space-y-2">
                                <div className="text-xs font-bold uppercase text-purple-700 mb-2">📋 Guest / Onboarding Details</div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    {[
                                        ["Full Name", booking.guestName],
                                        ["Email", booking.guestEmail || "—"],
                                        ["Phone", booking.guestPhone || "—"],
                                        ["Occupation", booking.occupationType ? `${booking.occupationType} - ${booking.occupationDetail || ""}` : "—"],
                                        ["Move-in Date", booking.onboardingDate || booking.moveInDate || "—"],
                                        ["Address", booking.guestAddress ? `${booking.guestAddress}, ${booking.guestCity} - ${booking.guestPincode}, ${booking.guestCountry}` : "—"],
                                    ].map(([label, value]) => (
                                        <div key={label} className="bg-white border rounded p-2">
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold">{label}</div>
                                            <div className="text-sm font-medium">{value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Room + PG */}
                            <div className="space-y-2">
                                <div className="text-xs font-bold uppercase text-green-700 mb-2">🏠 Booking & Room Info</div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    {[
                                        ["PG / Property", booking.propertyName || "—"],
                                        ["Requested Room Type", booking.occupancy || "—"],
                                        ["Allocated Room", booking.roomAssigned || "Not Allocated"],
                                        ["Rent Amount", booking.amount || "—"],
                                        ["Payment Method", booking.paymentMethod || "Online"],
                                        ["Booking Ref", booking.displayId],
                                    ].map(([label, value]) => (
                                        <div key={label} className="bg-white border rounded p-2">
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold">{label}</div>
                                            <div className="text-sm font-medium">{value}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Contact management notice */}
                                {contactInfo && (
                                    <div className="mt-2 bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm">
                                        <div className="font-bold text-amber-800 mb-1">📞 Management Contact (for student)</div>
                                        <div className="text-amber-700 text-xs space-y-0.5">
                                            <div>Name: <strong>{booking.guestName}</strong></div>
                                            <div>Email: <strong>{booking.guestEmail || "—"}</strong></div>
                                            <div>Phone: <strong>{booking.guestPhone || "—"}</strong></div>
                                            <div>Address: <strong>{booking.guestAddress ? `${booking.guestAddress}, ${booking.guestCity}` : "—"}</strong></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── DOCUMENTS TAB ── */}
                    {tab === "documents" && (
                        <div className="space-y-3">
                            {/* Pending docs - red alert */}
                            {pendingDocs.length > 0 && (
                                <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3">
                                    <div className="text-red-700 font-bold text-sm mb-2">🔴 {pendingDocs.length} Document{pendingDocs.length > 1 ? "s" : ""} Pending Review</div>
                                    <div className="space-y-2">
                                        {pendingDocs.map(doc => (
                                            <div key={doc.id} className="bg-white border border-red-200 rounded p-2 flex items-center justify-between gap-2 flex-wrap">
                                                <div>
                                                    <div className="font-semibold text-sm">{TYPE_LABELS[doc.type] || doc.type}</div>
                                                    <div className="text-[10px] text-muted-foreground">{doc.fileName} • {new Date(doc.uploadedAt).toLocaleString()}</div>
                                                </div>
                                                <div className="flex gap-1.5 items-center flex-wrap">
                                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPreviewDoc(doc)}><Eye className="h-3 w-3 mr-1" />View</Button>
                                                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleVerify(doc.id)}><CheckCircle className="h-3 w-3 mr-1" />Approve</Button>
                                                    {rejectTarget === doc.id ? (
                                                        <div className="flex gap-1 items-center">
                                                            <input className="border rounded px-2 py-1 text-xs w-36" placeholder="Reason for rejection..." value={rejectNote} onChange={e => setRejectNote(e.target.value)} />
                                                            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleReject(doc.id)}>Reject</Button>
                                                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setRejectTarget(null); setRejectNote(""); }}>✕</Button>
                                                        </div>
                                                    ) : (
                                                        <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-600" onClick={() => setRejectTarget(doc.id)}><XCircle className="h-3 w-3 mr-1" />Decline</Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Verified docs */}
                            {verifiedDocs.length > 0 && (
                                <div className="space-y-1">
                                    <div className="text-xs font-bold text-green-700">✅ Verified Documents</div>
                                    {verifiedDocs.map(doc => (
                                        <div key={doc.id} className="bg-green-50 border border-green-200 rounded p-2 flex items-center justify-between">
                                            <div>
                                                <span className="font-medium text-sm">{TYPE_LABELS[doc.type] || doc.type}</span>
                                                <span className="text-[10px] text-muted-foreground ml-2">{doc.fileName}</span>
                                            </div>
                                            <div className="flex gap-1.5">
                                                <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded">✅ Approved</span>
                                                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setPreviewDoc(doc)}>View</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Rejected docs */}
                            {rejectedDocs.length > 0 && (
                                <div className="space-y-1">
                                    <div className="text-xs font-bold text-red-700">❌ Rejected — Awaiting Re-upload from Student</div>
                                    {rejectedDocs.map(doc => (
                                        <div key={doc.id} className="bg-red-50 border border-red-300 rounded p-2 flex items-center justify-between">
                                            <div>
                                                <span className="font-medium text-sm">{TYPE_LABELS[doc.type] || doc.type}</span>
                                                {doc.rejectedNote && <div className="text-[10px] text-red-600">Reason: {doc.rejectedNote}</div>}
                                            </div>
                                            <div className="flex gap-1.5">
                                                <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded">🔴 Rejected</span>
                                                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setPreviewDoc(doc)}>View</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {docs.length === 0 && !docsLoading && (
                                <div className="text-center text-sm text-muted-foreground py-4 bg-white border rounded">No documents uploaded yet by student.</div>
                            )}


                        </div>
                    )}

                    {/* Document Preview Modal */}
                    {previewDoc && (
                        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreviewDoc(null)}>
                            <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4" onClick={e => e.stopPropagation()}>
                                <div className="flex justify-between items-center">
                                    <h2 className="text-lg font-bold">{TYPE_LABELS[previewDoc.type] || previewDoc.type}</h2>
                                    <Button variant="ghost" size="sm" onClick={() => setPreviewDoc(null)}>✕</Button>
                                </div>
                                <div className={`text-xs font-bold px-2 py-1 rounded w-fit ${previewDoc.status === "VERIFIED" ? "bg-green-100 text-green-700" : previewDoc.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                                    {previewDoc.status}
                                    {previewDoc.rejectedNote && ` — ${previewDoc.rejectedNote}`}
                                </div>
                                {previewDoc.fileData?.startsWith("data:image") ? (
                                    <img src={previewDoc.fileData} alt="Document" className="w-full rounded-lg border max-h-96 object-contain" />
                                ) : previewDoc.fileData?.startsWith("data:application/pdf") ? (
                                    <div className="p-4 bg-muted rounded text-center text-sm">
                                        📄 PDF — <a href={previewDoc.fileData} download={previewDoc.fileName} className="text-blue-600 underline">Download</a>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-muted rounded text-center text-sm text-muted-foreground">Preview not available</div>
                                )}
                                <Button className="w-full" onClick={() => setPreviewDoc(null)}>Close</Button>
                            </div>
                        </div>
                    )}
                </div>
            </td>
        </tr>
    );
}

export default function BookingsPage() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
    const [expandedTab, setExpandedTab] = useState<"onboarding" | "documents">("onboarding");
    const [activeTab, setActiveTab] = useState<"ALL" | "PENDING" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED">("ALL");
    const router = useRouter();

    const fetchData = async () => {
        setLoading(true);
        try {
            const [bookingData, roomData] = await Promise.all([getBookings(), getAvailableRooms()]);
            setBookings(bookingData);
            setRooms(roomData);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleCheckIn = async (bookingId: string) => {
        if (!confirm("Confirm Check-in: Has the student formally moved in? \n\nThis will activate their tenancy and start the billing cycle.")) return;
        try {
            await checkInBooking(bookingId);
            toast.success("Student Checked-in successfully. Tenancy is now ACTIVE.");
            fetchData();
        } catch (e: any) {
            toast.error(e.message || "Check-in failed.");
        }
    };

    const handleApprove = async (booking: any) => {
        if (!confirm(`Approve booking for ${booking.guestName} at ${booking.propertyName}? \n\nRoom allocation and detailed onboarding can be done in the Onboarding section after approval.`)) return;
        try {
            await approveBooking(booking.id, {});
            toast.success("Booking Approved successfully.");
            fetchData();
        } catch { toast.error("Approval failed. Please try again."); }
    };

    const handleReject = async (bookingId: string) => {
        const reason = prompt("Reason for rejecting this booking (required):");
        if (!reason) return;
        try {
            await rejectBookingAction(bookingId, reason);
            toast.success("Booking Rejected.");
            fetchData();
        } catch { toast.error("Rejection failed."); }
    };

    const handleMarkCashPaid = async (bookingId: string) => {
        if (!confirm("Confirm: Mark this booking as PAID via Cash? This will also create the Tenant record.")) return;
        try {
            await markBookingPaid(bookingId, "CASH");
            toast.success("Booking marked as Paid and Tenant created.");
            fetchData();
        } catch { toast.error("Failed to mark as paid."); }
    };

    const pendingCount = bookings.filter(b => b.status === "PENDING_APPROVAL").length;

    const filteredBookings = bookings.filter(b => {
        if (activeTab === "PENDING") return b.status === "PENDING_APPROVAL";
        if (activeTab === "APPROVED") return b.status === "APPROVED_KYC_PENDING" || b.status === "APPROVED_PAYMENT_PENDING" || b.status === "APPROVED";
        if (activeTab === "PAID") return b.status === "PAID" || b.status === "CASH_PAID";
        if (activeTab === "REJECTED") return b.status === "REJECTED";
        if (activeTab === "CANCELLED") return b.status === "CANCELLED";
        return true;
    });

    if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading bookings...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Bookings</h1>
                    <p className="text-muted-foreground">Manage requests, onboarding and document verification.</p>
                </div>
                <div className="flex items-center gap-3">
                    {pendingCount > 0 && (
                        <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                            🔴 {pendingCount} New
                        </span>
                    )}
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                        <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
                    </Button>
                </div>
            </div>

            {/* 🔴 Red Alert: KYC Pending Bookings */}
            {bookings.filter(b => b.status === "APPROVED_KYC_PENDING").length > 0 && (
                <div className="flex items-center gap-3 bg-red-50 border-2 border-red-400 rounded-xl px-5 py-4 animate-pulse-slow shadow-md">
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                    <div className="flex-1">
                        <p className="font-bold text-red-700 text-sm">
                            🔴 {bookings.filter(b => b.status === "APPROVED_KYC_PENDING").length} Booking{bookings.filter(b => b.status === "APPROVED_KYC_PENDING").length > 1 ? "s" : ""} Awaiting KYC Verification
                        </p>
                        <p className="text-red-600 text-xs mt-0.5">Student documents have been submitted and are waiting for your review.</p>
                    </div>
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white font-bold shrink-0" onClick={() => router.push('/dashboard/owner/verifications')}>
                        Verify KYC Now →
                    </Button>
                </div>
            )}

            {/* Filter tabs */}
            <div className="flex gap-2 flex-wrap">
                {(["ALL", "PENDING", "APPROVED", "PAID", "REJECTED", "CANCELLED"] as const).map(t => (
                    <Button
                        key={t}
                        size="sm"
                        onClick={() => setActiveTab(t)}
                        className={activeTab === t
                            ? t === "PENDING" ? "bg-red-600 hover:bg-red-700 text-white"
                                : t === "APPROVED" ? "bg-amber-500 hover:bg-amber-600 text-white"
                                    : t === "PAID" ? "bg-green-600 hover:bg-green-700 text-white"
                                        : t === "REJECTED" ? "bg-gray-600 hover:bg-gray-700 text-white"
                                            : t === "CANCELLED" ? "bg-slate-600 hover:bg-slate-700 text-white"
                                                : "bg-purple-600 hover:bg-purple-700 text-white"
                            : "bg-white border hover:bg-muted text-foreground"}
                    >
                        {t === "ALL" ? `📋 All (${bookings.length})`
                            : t === "PENDING" ? `🔴 New (${bookings.filter(b => b.status === "PENDING_APPROVAL").length})`
                                : t === "APPROVED" ? `⏳ Onboarding (${bookings.filter(b => b.status === "APPROVED_KYC_PENDING" || b.status === "APPROVED_PAYMENT_PENDING" || b.status === "APPROVED").length})`
                                    : t === "PAID" ? `✅ Paid (${bookings.filter(b => b.status === "PAID" || b.status === "CASH_PAID").length})`
                                        : t === "REJECTED" ? `❌ Rejected (${bookings.filter(b => b.status === "REJECTED").length})`
                                            : `🚫 Cancelled (${bookings.filter(b => b.status === "CANCELLED").length})`}
                    </Button>
                ))}
            </div>

            <Card>
                <CardContent className="p-0 text-sm md:text-base">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted border-b">
                                <tr>
                                    <th className="p-4 text-left font-medium">Booking ID</th>
                                    <th className="p-4 text-left font-medium">Guest Name</th>
                                    <th className="p-4 text-left font-medium">PG Requested</th>
                                    <th className="p-4 text-left font-medium">Room</th>
                                    <th className="p-4 text-left font-medium">Requested On</th>
                                    <th className="p-4 text-left font-medium">Status</th>
                                    <th className="p-4 text-left font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBookings.map((booking) => (
                                    <React.Fragment key={booking.id}>
                                        <tr className={`border-b hover:bg-muted/5 ${booking.status === "PENDING_APPROVAL" ? "bg-red-50/50" : ""}`}>
                                            <td className="p-4 font-medium">{booking.displayId}</td>
                                            <td className="p-4">
                                                <div className="font-medium">{booking.guestName}</div>
                                                {booking.guestEmail && <div className="text-[10px] text-muted-foreground">{booking.guestEmail}</div>}
                                                {booking.guestPhone && <div className="text-[10px] text-muted-foreground">{booking.guestPhone}</div>}
                                                {(booking as any).occupationType && <div className="text-[10px] text-blue-600 font-medium">{(booking as any).occupationType}</div>}
                                            </td>
                                            {/* PG Name column */}
                                            <td className="p-4">
                                                <div className="font-medium text-purple-700">{booking.propertyName || "—"}</div>
                                                <div className="text-[10px] text-muted-foreground">{booking.occupancy}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <span>{booking.roomAssigned || "Not Allocated"}</span>
                                                    {booking.onboardingDate && <span className="text-[10px] text-blue-600">📅 {booking.onboardingDate}</span>}
                                                </div>
                                            </td>
                                            <td className="p-4 text-muted-foreground text-xs italic">
                                                {new Date(booking.createdAt).toLocaleString()}
                                            </td>
                                            <td className="p-4">
                                                {booking.status === "PENDING_APPROVAL" && <span className="px-2 py-1 rounded text-[10px] font-bold bg-red-100 text-red-800">🔴 NEW</span>}
                                                {booking.status === "APPROVED_KYC_PENDING" && (
                                                    <span className="px-2 py-1 rounded text-[10px] font-bold bg-blue-100 text-blue-800">📝 KYC PENDING</span>
                                                )}
                                                {(booking.status === "APPROVED_PAYMENT_PENDING" || booking.status === "APPROVED") && (
                                                    <div className="space-y-1">
                                                        <span className="px-2 py-1 rounded text-[10px] font-bold bg-amber-100 text-amber-800">⏳ AWAITING PAYMENT</span>
                                                        {booking.paymentMethod === "CASH" && (
                                                            <div className="text-[10px] text-orange-700 font-bold bg-orange-50 px-2 py-1 rounded border border-orange-200">💵 Cash Pending</div>
                                                        )}
                                                    </div>
                                                )}
                                                {(booking.status === "PAID" || booking.status === "CASH_PAID") && (
                                                    <div>
                                                        <span className="px-2 py-1 rounded text-[10px] font-bold bg-blue-100 text-blue-800">🅿️ PAID (RESERVED)</span>
                                                        <div className="text-[10px] text-muted-foreground mt-1">Awaiting Check-in</div>
                                                    </div>
                                                )}
                                                {booking.status === "CHECKED_IN" && (
                                                    <div>
                                                        <span className="px-2 py-1 rounded text-[10px] font-bold bg-green-100 text-green-800">🏠 CHECKED-IN</span>
                                                        <div className="text-[10px] text-muted-foreground mt-1">Tenancy Active</div>
                                                    </div>
                                                )}
                                                {booking.status === "REJECTED" && <span className="px-2 py-1 rounded text-[10px] font-bold bg-gray-100 text-gray-800">❌ REJECTED</span>}
                                                {booking.status === "CANCELLED" && <span className="px-2 py-1 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">🚫 Cancelled by User</span>}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex gap-2">
                                                        {booking.status === "PENDING_APPROVAL" && (
                                                            <>
                                                                <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 text-xs" onClick={() => handleApprove(booking)}>✓ Approve</Button>
                                                                <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => handleReject(booking.id)}>Reject</Button>
                                                            </>
                                                        )}
                                                        {booking.status === "APPROVED_KYC_PENDING" && (
                                                            <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 font-bold" onClick={() => router.push('/dashboard/owner/doc-verification')}>
                                                                📎 Verify KYC
                                                            </Button>
                                                        )}
                                                        {(booking.status === "APPROVED_PAYMENT_PENDING" || booking.status === "APPROVED") && (
                                                            <Button size="sm" variant="outline" className="h-8 text-xs border-amber-500 text-amber-700" onClick={() => setExpandedBooking(booking.id)}>
                                                                ⏳ Payment Wait
                                                            </Button>
                                                        )}
                                                        {(booking.status === "PAID" || booking.status === "CASH_PAID") && (
                                                            <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 font-bold" onClick={() => handleCheckIn(booking.id)}>
                                                                🚀 Confirm Check-in
                                                            </Button>
                                                        )}
                                                        {/* Expand/collapse detail rows */}
                                                        <Button
                                                            variant="outline" size="sm" className="h-8 w-8 p-0"
                                                            onClick={() => { setExpandedTab("onboarding"); setExpandedBooking(expandedBooking === booking.id ? null : booking.id); }}
                                                        >
                                                            {expandedBooking === booking.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                    {(booking.status === "APPROVED_PAYMENT_PENDING" || booking.status === "APPROVED") && booking.paymentMethod === "CASH" && (
                                                        <Button size="sm" className="h-8 text-xs bg-orange-500 hover:bg-orange-600 font-bold" onClick={() => handleMarkCashPaid(booking.id)}>
                                                            ✅ Mark Cash Paid
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {/* Expandable detail row */}
                                        {expandedBooking === booking.id && (
                                            <BookingDetail key={`detail-${booking.id}-${expandedTab}`} booking={booking} rooms={rooms} onRefresh={fetchData} defaultTab={expandedTab} />
                                        )}
                                    </React.Fragment>
                                ))}
                                {filteredBookings.length === 0 && (
                                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No bookings found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
