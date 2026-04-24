"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Users, Search, RefreshCcw, Calendar, Building2,
    CreditCard, Tag, User, Mail, Phone, Clock,
    ChevronDown, ChevronUp, FileText, ClipboardList, CheckCircle, XCircle, AlertCircle, Eye,
    BedDouble, ShieldCheck
} from "lucide-react";
import { 
    getAdminBookings, 
    approveBooking, 
    rejectBooking as rejectBookingAction, 
    markBookingPaid, 
    checkInBooking,
    cancelBooking
} from "@/actions/bookings";
import { getAvailableRooms } from "@/actions/rooms";
import { getTenantDocuments, verifyDocument } from "@/actions/documents";
import { RoomAllocationModal } from "@/components/dashboard/RoomAllocationModal";
import { PhysicalKycModal } from "@/components/dashboard/PhysicalKycModal";
import { toast } from "sonner";
import React from "react";

const TYPE_LABELS: Record<string, string> = {
    ID_PROOF: "🪪 ID Proof",
    ADDRESS_PROOF: "🏠 Address Proof",
    COLLEGE_COMPANY: "🎓 College / Company",
    SELFIE: "📸 Current Selfie",
    AADHAAR_FRONT: "🪪 Aadhaar Front",
    AADHAAR_BACK: "🪪 Aadhaar Back",
    PAN_FRONT: "💳 PAN Front",
    PAN_BACK: "💳 PAN Back",
    STUDENT_ID: "🎓 Student ID",
    COMPANY_ID: "🏢 Company ID",
    LIVE_PHOTO: "📸 Current Photo",
    OTHER: "📎 Other",
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    REQUESTED:                { label: '📥 New Request',       cls: 'bg-red-100 text-red-700 border-red-300' },
    APPLIED:                  { label: '📥 New Request',       cls: 'bg-red-100 text-red-700 border-red-300' },
    PENDING_APPROVAL:         { label: '⏳ Pending Approval',  cls: 'bg-gray-100 text-gray-700 border-gray-300' },
    APPROVED:                 { label: '🛏 Room Allocation',   cls: 'bg-violet-100 text-violet-700 border-violet-300' },
    ROOM_RESERVED:            { label: '💳 Awaiting Payment',  cls: 'bg-amber-100 text-amber-700 border-amber-300' },
    AGREEMENT_PENDING:        { label: '✍️ Sign Agreement',   cls: 'bg-violet-100 text-violet-700 border-violet-300' },
    PAID:                     { label: '💳 Paid',              cls: 'bg-green-100 text-green-700 border-green-300' },
    CASH_PAID:                { label: '💵 Cash Paid',         cls: 'bg-green-100 text-green-700 border-green-300' },
    BOOKING_CONFIRMED:        { label: '✍️ Agreement Signed',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    MOVE_IN_SCHEDULED:        { label: '📅 Move-in Set',       cls: 'bg-teal-100 text-teal-700 border-teal-300' },
    ACTIVE:                   { label: '🏠 Active Tenant',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    CHECKIN_CONFIRMED:        { label: '🏡 Checked In',        cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    CHECKED_OUT:              { label: '🏠 Checked Out',       cls: 'bg-slate-100 text-slate-500 border-slate-300' },
    COMPLETED:                { label: '✅ Stay Completed',    cls: 'bg-slate-100 text-slate-600 border-slate-300' },
    REJECTED:                 { label: '❌ Rejected',           cls: 'bg-red-50 text-red-700 border-red-200' },
    CANCELLED:                { label: '🚫 Cancelled',         cls: 'bg-slate-100 text-slate-600 border-slate-300' },
    EXPIRED:                  { label: '⏰ Expired',            cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

function BookingNextStep({ booking }: { booking: any }) {
    const s = booking.status;
    const hasRoom = !!booking.roomAssigned;

    if (['REQUESTED', 'APPLIED', 'PENDING_APPROVAL'].includes(s)) return (
        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full border border-orange-200">
            👆 Approve & Allocate Room
        </span>
    );
    if (s === 'APPROVED' && !hasRoom) return (
        <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-full border border-violet-200">
            🛏 Allocate Room
        </span>
    );
    if (hasRoom && ['APPROVED', 'ROOM_RESERVED', 'AGREEMENT_PENDING'].includes(s)) return (
        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-200">
            ⏳ Awaiting Student Payment
        </span>
    );
    if (['PAID', 'CASH_PAID'].includes(s)) return (
        <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-full border border-violet-200">
            ✍️ Awaiting Agreement Signing
        </span>
    );
    if (['BOOKING_CONFIRMED', 'MOVE_IN_SCHEDULED'].includes(s)) return (
        <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-full border border-teal-200">
            🔍 Verify Physical ID → Check-in
        </span>
    );
    if (['ACTIVE', 'CHECKIN_CONFIRMED', 'CHECKED_OUT', 'COMPLETED'].includes(s)) return (
        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
            ✅ Managed in Tenants
        </span>
    );
    return null;
}

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
                                <button 
                                    className="w-full py-3 text-xs font-black bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-full transition-all active:scale-95 shadow-sm uppercase tracking-widest"
                                    onClick={() => setPreviewDoc(null)}
                                >
                                    CLOSE
                                </button>
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
    const [filterStatus, setFilterStatus] = useState<"ALL" | "NEW_REQUEST" | "ALLOCATE_ROOM" | "STUDENT_PAYS" | "AGREEMENT" | "PHYSICAL_VERIFY" | "CHECKED_IN" | "REJECTED" | "CANCELLED">("ALL");
    const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
    const [dateFilter, setDateFilter] = useState<"ALL" | "7D" | "30D">("7D");
    const [propertyFilter, setPropertyFilter] = useState("ALL");
    const [roomTypeFilter, setRoomTypeFilter] = useState("ALL");
    const [paymentFilter, setPaymentFilter] = useState("ALL");
    const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [cancelModal, setCancelModal] = useState<{ id: string; name: string } | null>(null);
    const [cancelReason, setCancelReason] = useState("");
    const [allocateBooking, setAllocateBooking] = useState<any | null>(null);
    const [kycBooking, setKycBooking] = useState<any | null>(null);
    const [approveModal, setApproveModal] = useState<any | null>(null);

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

    const handleApprove = (booking: any) => {
        setApproveModal(booking);
    };

    const confirmApprove = async () => {
        if (!approveModal) return;
        try {
            await approveBooking(approveModal.id, {});
            toast.success("Booking Approved. Now allocate a room.");
            const approved = approveModal;
            setApproveModal(null);
            await fetchBookings();
            setAllocateBooking({ ...approved, status: 'APPROVED' });
        } catch { toast.error("Approval failed."); }
    };

    const handleAllocate = async (bookingId: string, allocationData: any) => {
        const requestedOccupancy = allocateBooking?.occupancy;
        const allocatedRoomType = allocationData.roomType;
        try {
            await approveBooking(bookingId, {
                roomId: allocationData.roomId,
                bedId: allocationData.bedId,
                occupancy: allocationData.roomType,
                roomAssigned: `${allocationData.roomAssigned} — Bed ${allocationData.bedNumber}`,
                amount: allocationData.amount,
                depositAmount: allocationData.depositAmount,
                depositMonths: allocationData.depositMonths,
                foodSelected: allocationData.foodSelected,
            });
            if (allocatedRoomType && requestedOccupancy &&
                allocatedRoomType.toLowerCase() !== requestedOccupancy.toLowerCase()) {
                toast.warning(`⚠️ Room type changed: Student requested "${requestedOccupancy}" but "${allocatedRoomType}" was allocated.`);
            } else {
                toast.success(`Room ${allocationData.roomAssigned} / Bed ${allocationData.bedNumber} allocated!`);
            }
            setAllocateBooking(null);
            await fetchBookings();
        } catch {
            toast.error("Allocation failed.");
        }
    };

    const handleReject = (bookingId: string) => {
        setRejectReason("");
        setRejectModal({ id: bookingId });
    };

    const confirmReject = async () => {
        if (!rejectReason.trim()) { toast.error("Enter a rejection reason."); return; }
        try {
            await rejectBookingAction(rejectModal!.id, rejectReason);
            toast.success("Booking Rejected.");
            setRejectModal(null);
            setRejectReason("");
            fetchBookings();
        } catch { toast.error("Rejection failed."); }
    };

    const handleCancel = (bookingId: string, guestName: string) => {
        setCancelReason("");
        setCancelModal({ id: bookingId, name: guestName });
    };

    const confirmCancel = async () => {
        try {
            await cancelBooking(cancelModal!.id, cancelReason);
            toast.success("Booking cancelled.");
            setCancelModal(null); setCancelReason(""); fetchBookings();
        } catch { toast.error("Failed to cancel booking."); }
    };

    const handleMarkCashPaid = (bookingId: string) => {
        toast("Mark booking as Cash Paid?", {
            description: "Admin override — reservation will be confirmed.",
            action: {
                label: "Confirm",
                onClick: async () => {
                    try {
                        await markBookingPaid(bookingId, "CASH");
                        toast.success("Booking marked as Paid.");
                        fetchBookings();
                    } catch { toast.error("Failed to mark as paid."); }
                }
            }
        });
    };

    const handleCheckIn = (booking: any) => {
        setKycBooking(booking);
    };

    const confirmCheckIn = async () => {
        if (!kycBooking) return;
        try {
            await checkInBooking(kycBooking.id);
            toast.success("Student Checked-in.");
            setKycBooking(null);
            await fetchBookings();
        } catch (e: any) { toast.error(e.message || "Check-in failed."); }
    };

    const STATUS_GROUPS: Record<string, string[]> = {
        ALL:             [],
        NEW_REQUEST:     ["APPLIED", "REQUESTED", "PENDING_APPROVAL"],
        ALLOCATE_ROOM:   ["APPROVED", "ROOM_RESERVED"],
        STUDENT_PAYS:    ["PAID", "CASH_PAID"],
        AGREEMENT:       ["AGREEMENT_PENDING"],
        PHYSICAL_VERIFY: ["MOVE_IN_SCHEDULED"],
        CHECKED_IN:      ["ACTIVE", "CHECKIN_CONFIRMED", "BOOKING_CONFIRMED"],
        REJECTED:        ["REJECTED"],
        CANCELLED:       ["CANCELLED", "EXPIRED"],
    };

    const filtered = bookings.filter(b => {
        const matchesSearch =
            (b.guestName || "").toLowerCase().includes(search.toLowerCase()) ||
            (b.displayId || "").toLowerCase().includes(search.toLowerCase()) ||
            (b.propertyName || "").toLowerCase().includes(search.toLowerCase());

        const group = STATUS_GROUPS[filterStatus];
        const matchesStatus = filterStatus === "ALL" || (group && group.includes(b.status));
        
        // Date Logic
        if (dateFilter !== "ALL") {
            const date = new Date(b.createdAt);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - date.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (dateFilter === "7D" && diffDays > 7) return false;
            if (dateFilter === "30D" && diffDays > 30) return false;
        }

        // Multi-Filters
        if (propertyFilter !== "ALL" && b.propertyName !== propertyFilter) return false;
        if (roomTypeFilter !== "ALL" && b.occupancy !== roomTypeFilter) return false;
        if (paymentFilter !== "ALL" && (b.paymentMethod || "Online") !== paymentFilter) return false;

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

            {/* Unified Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[280px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by name, room, or ID..."
                            className="pl-11 h-10 border-slate-200 bg-slate-50/30 focus:bg-white rounded-xl text-sm transition-all shadow-none"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <select
                        value={propertyFilter}
                        onChange={(e) => setPropertyFilter(e.target.value)}
                        className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-w-[160px]"
                    >
                        <option value="ALL">All Properties (PGs)</option>
                        {Array.from(new Set(bookings.map(b => b.propertyName).filter(Boolean))).map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>

                    <select
                        value={roomTypeFilter}
                        onChange={(e) => setRoomTypeFilter(e.target.value)}
                        className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-w-[140px]"
                    >
                        <option value="ALL">All Room Types</option>
                        {Array.from(new Set(bookings.map(b => b.occupancy).filter(Boolean))).map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>

                    <select
                        value={paymentFilter}
                        onChange={(e) => setPaymentFilter(e.target.value)}
                        className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-w-[140px]"
                    >
                        <option value="ALL">All Payments</option>
                        {Array.from(new Set(bookings.map(b => b.paymentMethod || "Online").filter(Boolean))).map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <div className="flex bg-slate-100/50 p-1 rounded-xl w-fit border border-slate-200">
                        {([
                            ["7D", "Last 7 Days"],
                            ["30D", "Last 30 Days"],
                            ["ALL", "Lifetime"],
                        ] as const).map(([val, label]) => (
                            <button
                                key={val}
                                onClick={() => setDateFilter(val)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest ${
                                    dateFilter === val
                                        ? "bg-indigo-600 text-white shadow-md"
                                        : "text-slate-500 hover:text-slate-700"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        {([
                            ["ALL",             "📋 All"],
                            ["NEW_REQUEST",     "📥 New Request"],
                            ["ALLOCATE_ROOM",   "🛏 Allocate Room"],
                            ["STUDENT_PAYS",    "💳 Student Pays"],
                            ["AGREEMENT",       "✍️ Agreement Signed"],
                            ["PHYSICAL_VERIFY", "🔍 Physical ID Verify"],
                            ["CHECKED_IN",      "✅ Checked In"],
                            ["REJECTED",        "❌ Rejected"],
                            ["CANCELLED",       "🚫 Cancelled"],
                        ] as const).map(([t, label]) => (
                            <Button key={t} size="sm" onClick={() => setFilterStatus(t)}
                                className={`h-7 text-[10px] font-bold transition-all ${filterStatus === t
                                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
                                    : "bg-white border hover:bg-muted text-foreground"}`}>
                                {label}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="p-20 text-center animate-pulse text-muted-foreground">Loading bookings...</div>
            ) : (
                <>
                    {/* ── Mobile Cards ── */}
                    <div className="md:hidden space-y-3">
                        {filtered.length === 0 ? (
                            <p className="text-center text-muted-foreground py-12">No bookings found.</p>
                        ) : filtered.map(booking => (
                            <div key={booking.id} className={`bg-white border rounded-2xl p-4 shadow-sm space-y-3 ${
                                booking.status === 'APPLIED' || booking.status === 'REQUESTED' ? 'border-l-4 border-l-red-400' : ''}`}>
                                <div className="flex justify-between items-start gap-2">
                                    <div>
                                        <p className="font-black text-sm text-slate-900">{booking.guestName}</p>
                                        <p className="text-[10px] font-mono text-slate-400">{booking.displayId}</p>
                                    </div>
                                    <StatusBadge status={booking.status} />
                                </div>
                                <div className="text-xs text-slate-600 space-y-1">
                                    <p>🏠 <span className="font-bold">{booking.propertyName}</span></p>
                                    <p>🛏 {booking.occupancy} · {booking.roomAssigned || "Not Allocated"}</p>
                                    <p>📅 {new Date(booking.createdAt).toLocaleDateString('en-IN')}</p>
                                    <p>📧 {booking.guestEmail}</p>
                                </div>
                                <div className="flex gap-2 flex-wrap pt-1">
                                    {(booking.status === 'APPLIED' || booking.status === 'REQUESTED') && (
                                        <>
                                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs flex-1" onClick={() => handleApprove(booking)}>✓ Approve</Button>
                                            <Button size="sm" variant="destructive" className="text-xs flex-1" onClick={() => handleReject(booking.id)}>✕ Reject</Button>
                                        </>
                                    )}
                                    {booking.status === 'APPROVED' && !booking.roomAssigned && (
                                        <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-xs flex-1" onClick={() => setAllocateBooking(booking)}>🛏 Allocate Room</Button>
                                    )}
                                    {(booking.status === 'APPROVED' || booking.status === 'ROOM_RESERVED') && booking.roomAssigned && (
                                        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-xs flex-1" onClick={() => handleMarkCashPaid(booking.id)}>💵 Cash Paid</Button>
                                    )}
                                    {(booking.status === 'BOOKING_CONFIRMED' || booking.status === 'MOVE_IN_SCHEDULED') && (
                                        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-xs flex-1" onClick={() => handleCheckIn(booking)}>🚀 Check-in</Button>
                                    )}
                                    <Button variant="outline" size="sm" className="text-xs"
                                        onClick={() => setExpandedBooking(expandedBooking === booking.id ? null : booking.id)}>
                                        {expandedBooking === booking.id ? "▲ Hide" : "▼ Details"}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Desktop Table ── */}
                    <div className="hidden md:block">
                        <Card className="rounded-2xl shadow-sm border-slate-200 overflow-hidden">
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-left">
                                                <th className="p-4">Booking ID</th>
                                                <th className="p-4">Guest</th>
                                                <th className="p-4">Property / Room</th>
                                                <th className="p-4">Move-in</th>
                                                <th className="p-4">Status</th>
                                                <th className="p-4">Next Step</th>
                                                <th className="p-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filtered.length === 0 ? (
                                                <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">No bookings found.</td></tr>
                                            ) : (
                                                filtered.map(booking => (
                                                    <React.Fragment key={booking.id}>
                                                        <tr className={`hover:bg-slate-50/50 transition-colors ${
                                                            booking.status === 'APPLIED' || booking.status === 'REQUESTED' ? 'bg-red-50/20' : ''}`}>
                                                            <td className="p-4 font-mono text-xs font-bold text-slate-900">{booking.displayId}</td>
                                                            <td className="p-4">
                                                                <div className="font-bold text-slate-900">{booking.guestName}</div>
                                                                <div className="text-[10px] text-slate-400">{booking.guestEmail}</div>
                                                                <div className="text-[10px] text-slate-400">{booking.guestPhone}</div>
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="font-bold text-indigo-700">{booking.propertyName}</div>
                                                                <div className="text-[10px] text-slate-400 font-bold">{booking.occupancy}</div>
                                                                <div className="text-[10px] text-slate-400 mt-1">{booking.roomAssigned || "Not Allocated"}</div>
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="text-xs font-bold text-slate-700">{booking.onboardingDate || "Not Set"}</div>
                                                                <div className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">📅 {new Date(booking.createdAt).toLocaleDateString()}</div>
                                                            </td>
                                                            <td className="p-4">
                                                                <StatusBadge status={booking.status} />
                                                                {booking.status === 'REJECTED' && booking.rejectionReason && (
                                                                    <div className="text-[9px] text-red-600 font-bold mt-1 max-w-[120px] leading-tight break-words">
                                                                        Reason: {booking.rejectionReason}
                                                                    </div>
                                                                )}
                                                                {booking.status === 'CANCELLED' && booking.cancelReason && (
                                                                    <div className="text-[9px] text-slate-500 font-bold mt-1 max-w-[120px] leading-tight break-words">
                                                                        Reason: {booking.cancelReason}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-4">
                                                                <BookingNextStep booking={booking} />
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="flex justify-end gap-1">
                                                                    {(() => {
                                                                        const s = booking.status;
                                                                        const hasRoom = !!booking.roomAssigned;

                                                                        // Step 1: New request
                                                                        if (['REQUESTED', 'APPLIED', 'PENDING_APPROVAL'].includes(s)) return (
                                                                            <>
                                                                                <Button size="sm" className="bg-green-600 hover:bg-green-700 h-7 text-[10px] font-bold" onClick={() => handleApprove(booking)}>✓ Approve</Button>
                                                                                <Button size="sm" variant="destructive" className="h-7 text-[10px] font-bold" onClick={() => handleReject(booking.id)}>✕ Reject</Button>
                                                                            </>
                                                                        );

                                                                        // Step 2: Approved but no room → Open Details to allocate
                                                                        if (s === 'APPROVED' && !hasRoom) return (
                                                                            <>
                                                                                <Button size="sm" className="h-7 text-[10px] bg-violet-600 hover:bg-violet-700 font-bold flex items-center gap-1" onClick={() => setAllocateBooking(booking)}>
                                                                                    <BedDouble className="h-3 w-3" /> Allocate Room
                                                                                </Button>
                                                                                <button onClick={() => handleReject(booking.id)} className="h-7 px-4 text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center gap-1 transition-all active:scale-95 uppercase tracking-wide">✕ Reject</button>
                                                                            </>
                                                                        );

                                                                        // Step 3: Room allocated, awaiting payment
                                                                        if (hasRoom && ['APPROVED', 'ROOM_RESERVED', 'AGREEMENT_PENDING'].includes(s)) return (
                                                                            <>
                                                                                <Button size="sm" className="h-7 text-[10px] bg-orange-500 hover:bg-orange-600 font-bold flex items-center gap-1" onClick={() => handleMarkCashPaid(booking.id)}>
                                                                                    <CreditCard className="h-3 w-3" /> Cash Paid
                                                                                </Button>
                                                                                <button onClick={() => handleReject(booking.id)} className="h-7 px-4 text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center gap-1 transition-all active:scale-95 uppercase tracking-wide">✕ Reject</button>
                                                                            </>
                                                                        );

                                                                        // Step 4: Agreement signed
                                                                        if (['BOOKING_CONFIRMED', 'MOVE_IN_SCHEDULED'].includes(s)) return (
                                                                            <>
                                                                                <Button size="sm" className="h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700 font-bold flex items-center gap-1" onClick={() => handleCheckIn(booking.id)}>
                                                                                    <ShieldCheck className="h-3 w-3" /> Check-in
                                                                                </Button>
                                                                                <button onClick={() => handleReject(booking.id)} className="h-7 px-4 text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center gap-1 transition-all active:scale-95 uppercase tracking-wide">✕ Reject</button>
                                                                            </>
                                                                        );

                                                                        // Awaiting Agreement
                                                                        if (['PAID', 'CASH_PAID'].includes(s)) return (
                                                                            <>
                                                                                <span className="text-[9px] font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded border border-violet-100">✍️ Awaiting Signing</span>
                                                                                <button onClick={() => handleReject(booking.id)} className="h-7 px-4 text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center gap-1 transition-all active:scale-95 uppercase tracking-wide">✕ Reject</button>
                                                                            </>
                                                                        );

                                                                        return null;
                                                                    })()}
                                                                    <Button variant="outline" size="sm" className="h-7 w-7 p-0 rounded-lg hover:border-indigo-500 hover:text-indigo-600 transition-colors"
                                                                        onClick={() => setExpandedBooking(expandedBooking === booking.id ? null : booking.id)}>
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
                                                                defaultTab={booking.status === 'APPROVED_KYC_PENDING' ? 'documents' : 'onboarding'}
                                                            />
                                                        )}
                                                    </React.Fragment>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Reject Modal ── */}
                    {rejectModal && (
                        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
                            <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4 shadow-2xl">
                                <h3 className="font-black text-lg text-slate-900">Reject Booking</h3>
                                <p className="text-sm text-muted-foreground">Owner and tenant will be notified with this reason.</p>
                                <textarea
                                    className="w-full border rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-red-300"
                                    placeholder="Reason for rejection..."
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                />
                                <div className="flex gap-3">
                                    <Button variant="outline" className="flex-1" onClick={() => { setRejectModal(null); setRejectReason(""); }}>Cancel</Button>
                                    <Button variant="destructive" className="flex-1" onClick={confirmReject} disabled={!rejectReason.trim()}>Confirm Reject</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Cancel Modal ── */}
                    {cancelModal && (
                        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
                            <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4 shadow-2xl">
                                <h3 className="font-black text-lg text-red-700">Cancel Booking</h3>
                                <p className="text-sm text-muted-foreground">Cancel booking for <strong>{cancelModal.name}</strong>? This cannot be undone.</p>
                                <p className="text-[11px] text-red-600 font-bold bg-red-50 p-2 rounded-lg border border-red-100 italic">
                                    ※ Please note: This reason will be sent to the customer to explain the cancellation.
                                </p>
                                <textarea
                                    className="w-full border rounded-xl p-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-red-300"
                                    placeholder="Provide a reason for cancellation..."
                                    value={cancelReason}
                                    onChange={e => setCancelReason(e.target.value)}
                                />
                                <div className="flex gap-3">
                                    <Button variant="outline" className="flex-1" onClick={() => { setCancelModal(null); setCancelReason(""); }}>Back</Button>
                                    <Button variant="destructive" className="flex-1" onClick={confirmCancel} disabled={!cancelReason.trim()}>✕ Confirm Cancel</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Room Allocation Modal */}
                    {allocateBooking && (
                        <RoomAllocationModal
                            isOpen={!!allocateBooking}
                            onClose={() => setAllocateBooking(null)}
                            onAllocate={data => handleAllocate(allocateBooking.id, data)}
                            booking={{
                                id: allocateBooking.id,
                                propertyId: allocateBooking.propertyId,
                                occupancy: allocateBooking.occupancy || "Double Sharing",
                                guestName: allocateBooking.guestName,
                            }}
                            property={{
                                id: allocateBooking.propertyId,
                                depositMonths: allocateBooking.property?.depositMonths || 2,
                                foodAvailable: allocateBooking.property?.foodType === 'OPTIONAL',
                                foodCharge: allocateBooking.property?.foodPricePerMonth,
                            }}
                        />
                    )}

                    {/* Physical KYC Modal */}
                    {kycBooking && (
                        <PhysicalKycModal
                            isOpen={!!kycBooking}
                            onClose={() => setKycBooking(null)}
                            onConfirm={confirmCheckIn}
                            tenantName={kycBooking.guestName}
                        />
                    )}

                    {/* Approve Confirm Modal */}
                    {approveModal && (
                        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
                            <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4 shadow-2xl">
                                <h3 className="font-black text-lg text-green-700">✅ Approve Booking</h3>
                                <p className="text-sm text-muted-foreground">
                                    Approve booking for <strong>{approveModal.guestName}</strong>?
                                    After approval you will allocate a room.
                                </p>
                                <div className="flex gap-3">
                                    <Button variant="outline" className="flex-1" onClick={() => setApproveModal(null)}>Close</Button>
                                    <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold" onClick={confirmApprove}>✓ Confirm Approve</Button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
