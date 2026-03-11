"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Users, Search, RefreshCcw, Calendar, Building2,
    CreditCard, Tag, User, Mail, Phone, Clock,
    ChevronDown, ChevronUp, FileText, ClipboardList, CheckCircle, XCircle, AlertCircle, Eye
} from "lucide-react";
import { 
    getAdminBookings, 
    approveBooking, 
    rejectBooking as rejectBookingAction, 
    markBookingPaid, 
    checkInBooking 
} from "@/actions/bookings";
import { getAvailableRooms } from "@/actions/rooms";
import { getTenantDocuments, verifyDocument } from "@/actions/documents";
import { toast } from "sonner";
import React from "react";

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

const PAYMENT_STATUS_COLORS: Record<string, string> = {
    'UNPAID': 'text-red-600 font-bold',
    'PAID': 'text-green-600 font-bold',
    'PARTIAL': 'text-amber-600 font-bold',
};

function StatusBadge({ status }: { status: string }) {
    const badge = STATUS_BADGE[status] || { label: status, cls: 'bg-gray-100 text-gray-600 border-gray-300' };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${badge.cls}`}>{badge.label}</span>;
}

// ── Booking Detail Component (Expanded Row) ──
function AdminBookingDetail({ booking, rooms, onRefresh, defaultTab = "onboarding" }: { booking: any; rooms: any[]; onRefresh: () => void; defaultTab?: "onboarding" | "documents" }) {
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
        try { 
            await verifyDocument(docId, "VERIFIED"); 
            fetchDocs(); 
            toast.success("Document Verified (Admin Override)"); 
        } catch { toast.error("Failed to verify."); }
    };

    const handleReject = async (docId: string) => {
        if (!rejectNote.trim()) { toast.error("Enter rejection reason."); return; }
        try {
            await verifyDocument(docId, "REJECTED", rejectNote);
            setRejectTarget(null); setRejectNote(""); fetchDocs();
            toast.success("Document Rejected (Admin Override)");
        } catch { toast.error("Failed to reject."); }
    };

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
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-t text-sm font-semibold border-b-2 transition-colors ${tab === "onboarding" ? "border-indigo-600 text-indigo-700 bg-indigo-50" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                        >
                            <ClipboardList className="h-4 w-4" /> Onboarding Details
                        </button>
                        <button
                            onClick={() => { setTab("documents"); fetchDocs(); }}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-t text-sm font-semibold border-b-2 transition-colors ${tab === "documents" ? "border-blue-600 text-blue-700 bg-blue-50" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                        >
                            <FileText className="h-4 w-4" /> Verify Documents
                            {pendingDocs.length > 0 && tab === "documents" && (
                                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse ml-1">{pendingDocs.length}</span>
                            )}
                        </button>
                    </div>

                    {/* ── ONBOARDING TAB ── */}
                    {tab === "onboarding" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <div className="text-xs font-bold uppercase text-indigo-700 mb-2">📋 Customer Identity</div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    {[
                                        ["Full Name", booking.guestName],
                                        ["Email", booking.guestEmail || "—"],
                                        ["Phone", booking.guestPhone || "—"],
                                        ["Occupation", booking.occupationType ? `${booking.occupationType} - ${booking.occupationDetail || ""}` : "—"],
                                        ["Move-in Date", booking.onboardingDate || booking.moveInDate || "—"],
                                        ["Address", booking.guestAddress ? `${booking.guestAddress}, ${booking.guestCity} - ${booking.guestPincode}` : "—"],
                                    ].map(([label, value]) => (
                                        <div key={label} className="bg-white border rounded p-2">
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold">{label}</div>
                                            <div className="text-sm font-medium">{value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-xs font-bold uppercase text-green-700 mb-2">🏠 Property & Transaction</div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    {[
                                        ["Property Name", booking.propertyName || "—"],
                                        ["Occupancy", booking.occupancy || "—"],
                                        ["Allocated Room", booking.roomAssigned || "Not Allocated"],
                                        ["Booking Price", `₹${booking.amount}` || "—"],
                                        ["Method", booking.paymentMethod || "Online"],
                                        ["Transaction ID", booking.paymentId || "—"],
                                    ].map(([label, value]) => (
                                        <div key={label} className="bg-white border rounded p-2">
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold">{label}</div>
                                            <div className="text-sm font-medium">{value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── DOCUMENTS TAB ── */}
                    {tab === "documents" && (
                        <div className="space-y-3">
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
                                                            <input className="border rounded px-2 py-1 text-xs w-36" placeholder="Reason..." value={rejectNote} onChange={e => setRejectNote(e.target.value)} />
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {verifiedDocs.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="text-xs font-bold text-green-700 uppercase">✅ Verified</div>
                                        {verifiedDocs.map(doc => (
                                            <div key={doc.id} className="bg-green-50 border border-green-200 rounded p-2 flex items-center justify-between">
                                                <div className="text-sm font-medium">{TYPE_LABELS[doc.type] || doc.type}</div>
                                                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-green-700 hover:bg-green-100" onClick={() => setPreviewDoc(doc)}>View</Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {rejectedDocs.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="text-xs font-bold text-red-700 uppercase">❌ Rejected</div>
                                        {rejectedDocs.map(doc => (
                                            <div key={doc.id} className="bg-red-100 border border-red-200 rounded p-2 flex items-center justify-between">
                                                <div className="text-sm font-medium">{TYPE_LABELS[doc.type] || doc.type}</div>
                                                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-red-700 hover:bg-red-100" onClick={() => setPreviewDoc(doc)}>View</Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {docs.length === 0 && !docsLoading && (
                                <div className="text-center text-sm text-muted-foreground py-4 bg-white border rounded italic">No documents uploaded yet.</div>
                            )}
                        </div>
                    )}

                    {/* Preview Modal (Simplified) */}
                    {previewDoc && (
                        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setPreviewDoc(null)}>
                            <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
                                <div className="flex justify-between items-center border-b pb-2">
                                    <h2 className="font-bold">{TYPE_LABELS[previewDoc.type] || "Document Preview"}</h2>
                                    <XCircle className="h-5 w-5 cursor-pointer text-muted-foreground" onClick={() => setPreviewDoc(null)} />
                                </div>
                                {previewDoc.fileData?.startsWith("data:image") ? (
                                    <img src={previewDoc.fileData} alt="Doc" className="w-full rounded border max-h-80 object-contain" />
                                ) : (
                                    <div className="h-40 flex items-center justify-center bg-muted rounded text-xs">Preview unavailable</div>
                                )}
                                <Button className="w-full h-8 text-xs" variant="secondary" onClick={() => setPreviewDoc(null)}>Close</Button>
                            </div>
                        </div>
                    )}
                </div>
            </td>
        </tr>
    );
}

export default function AdminBookingsPage() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("ALL");
    const [expandedBooking, setExpandedBooking] = useState<string | null>(null);

    const fetchBookings = useCallback(async () => {
        setLoading(true);
        try {
            const [bookingData, roomData] = await Promise.all([getAdminBookings(), getAvailableRooms()]);
            setBookings(bookingData);
            setRooms(roomData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    const handleApprove = async (booking: any) => {
        if (!confirm(`[ADMIN OVERRIDE] Approve booking for ${booking.guestName} at ${booking.propertyName}?`)) return;
        try {
            await approveBooking(booking.id, {});
            toast.success("Booking Approved successfully.");
            fetchBookings();
        } catch { toast.error("Approval failed. Please try again."); }
    };

    const handleReject = async (bookingId: string) => {
        const reason = prompt("[ADMIN OVERRIDE] Reason for rejecting this booking:");
        if (!reason) return;
        try {
            await rejectBookingAction(bookingId, reason);
            toast.success("Booking Rejected.");
            fetchBookings();
        } catch { toast.error("Rejection failed."); }
    };

    const handleMarkCashPaid = async (bookingId: string) => {
        if (!confirm("[ADMIN OVERRIDE] Confirm: Mark this booking as PAID via Cash? (Reservation will be confirmed)")) return;
        try {
            await markBookingPaid(bookingId, "CASH");
            toast.success("Booking marked as Paid. Reservation confirmed.");
            fetchBookings();
        } catch { toast.error("Failed to mark as paid."); }
    };

    const handleCheckIn = async (bookingId: string) => {
        if (!confirm("[ADMIN OVERRIDE] Confirm Check-in: Has the student formally moved in? This creates the Tenant record and starts billing.")) return;
        try {
            await checkInBooking(bookingId);
            toast.success("Student Checked-in successfully.");
            fetchBookings();
        } catch (e: any) {
            toast.error(e.message || "Check-in failed.");
        }
    };

    const filtered = bookings.filter(b => {
        const matchesSearch =
            (b.guestName || "").toLowerCase().includes(search.toLowerCase()) ||
            (b.displayId || "").toLowerCase().includes(search.toLowerCase()) ||
            (b.propertyName || "").toLowerCase().includes(search.toLowerCase());
        const matchesStatus = filterStatus === "ALL" || b.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Customer Bookings</h1>
                    <p className="text-muted-foreground">Monitor all booking requests across the platform.</p>
                </div>
                <Button variant="outline" onClick={fetchBookings}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            <div className="flex gap-4 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by ID, Customer Name, or PG..."
                        className="pl-9 h-11 rounded-xl shadow-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="h-11 border rounded-xl px-4 text-sm bg-background shadow-sm"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING_APPROVAL">Pending Approval</option>
                    <option value="APPROVED_KYC_PENDING">KYC Verification</option>
                    <option value="APPROVED_PAYMENT_PENDING">Awaiting Payment</option>
                    <option value="PAID">Paid (Reserved)</option>
                    <option value="CHECKED_IN">Checked-in</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="CANCELLED">Cancelled</option>
                </select>
            </div>

            {loading ? (
                <div className="p-20 text-center animate-pulse text-muted-foreground">Loading all bookings...</div>
            ) : (
                <Card className="rounded-2xl shadow-sm border-slate-200 overflow-hidden">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-left">
                                        <th className="p-4">Booking ID</th>
                                        <th className="p-4">Guest Info</th>
                                        <th className="p-4">Property</th>
                                        <th className="p-4">Allocated</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">No bookings found.</td></tr>
                                    ) : (
                                        filtered.map(booking => (
                                            <React.Fragment key={booking.id}>
                                                <tr className={`hover:bg-slate-50/50 transition-colors ${booking.status === "PENDING_APPROVAL" ? "bg-red-50/30" : ""}`}>
                                                    <td className="p-4 font-mono text-xs font-bold text-slate-900">{booking.displayId}</td>
                                                    <td className="p-4">
                                                        <div className="font-bold text-slate-900">{booking.guestName}</div>
                                                        <div className="text-[10px] text-slate-400">{booking.guestEmail}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-bold text-indigo-700">{booking.propertyName}</div>
                                                        <div className="text-[10px] text-slate-400">{booking.occupancy}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="text-xs font-medium text-slate-700">{booking.roomAssigned || "Not Allocated"}</div>
                                                        <div className="text-[10px] text-slate-400">In: {booking.moveInDate}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <StatusBadge status={booking.status} />
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex justify-end gap-1">
                                                            {booking.status === "PENDING_APPROVAL" && (
                                                                <>
                                                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 h-7 text-[10px] font-bold" onClick={() => handleApprove(booking)}>✓ Approve</Button>
                                                                    <Button size="sm" variant="destructive" className="h-7 text-[10px] font-bold" onClick={() => handleReject(booking.id)}>Reject</Button>
                                                                </>
                                                            )}
                                                            {(booking.status === "APPROVED_PAYMENT_PENDING" || booking.status === "APPROVED") && booking.paymentMethod === "CASH" && (
                                                                <Button size="sm" className="h-7 text-[10px] bg-orange-500 hover:bg-orange-600 font-bold" onClick={() => handleMarkCashPaid(booking.id)}>
                                                                    💵 Mark Cash Paid
                                                                </Button>
                                                            )}
                                                            {(booking.status === "PAID" || booking.status === "CASH_PAID") && (
                                                                <Button size="sm" className="h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700 font-bold" onClick={() => handleCheckIn(booking.id)}>
                                                                    🚀 Check-in
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="outline" size="sm" className="h-7 w-7 p-0 rounded-lg hover:border-indigo-500 hover:text-indigo-600 transition-colors"
                                                                onClick={() => setExpandedBooking(expandedBooking === booking.id ? null : booking.id)}
                                                            >
                                                                {expandedBooking === booking.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {expandedBooking === booking.id && (
                                                    <AdminBookingDetail 
                                                        booking={booking} 
                                                        rooms={rooms} 
                                                        onRefresh={fetchBookings} 
                                                        defaultTab={booking.status === "APPROVED_KYC_PENDING" ? "documents" : "onboarding"}
                                                    />
                                                )}
                                            </React.Fragment>
                                        )))
                                    }
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
