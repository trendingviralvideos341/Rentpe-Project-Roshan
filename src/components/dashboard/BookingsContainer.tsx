"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, RefreshCcw, FileText, ClipboardList, CheckCircle, XCircle, Eye, AlertCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBookings, approveBooking, rejectBooking as rejectBookingAction, checkInBooking, markBookingPaid } from "@/actions/bookings";
import { getAvailableRooms } from "@/actions/rooms";
import { getTenantDocuments, verifyDocument } from "@/actions/documents";
import { changeFoodPreference, getFoodPreferenceHistory } from "@/actions/food";
import { toast } from "sonner";


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
    REQUESTED:                { label: '🔴 New Request',       cls: 'bg-red-100 text-red-700 border-red-300' },
    APPLIED:                  { label: '🔴 New Request',       cls: 'bg-red-100 text-red-700 border-red-300' },
    PENDING_APPROVAL:         { label: '⏳ Pending Approval',  cls: 'bg-gray-100 text-gray-700 border-gray-300' },
    APPROVED_PENDING_TOKEN:   { label: '💜 Token Pending',     cls: 'bg-purple-100 text-purple-700 border-purple-300' },
    KYC_PENDING:              { label: '📝 KYC Pending',       cls: 'bg-blue-100 text-blue-700 border-blue-300' },
    APPROVED_KYC_PENDING:     { label: '📝 KYC Pending',       cls: 'bg-blue-100 text-blue-700 border-blue-300' },
    KYC_FAILED:               { label: '❌ KYC Failed',         cls: 'bg-red-100 text-red-800 border-red-300' },
    APPROVED_PAYMENT_PENDING: { label: '💳 Payment Pending',   cls: 'bg-amber-100 text-amber-700 border-amber-300' },
    APPROVED:                 { label: '✅ Approved',           cls: 'bg-green-100 text-green-700 border-green-300' },
    AGREEMENT_PENDING:        { label: '✍️ Sign Agreement',    cls: 'bg-violet-100 text-violet-700 border-violet-300' },
    PAID:                     { label: '✅ Paid',               cls: 'bg-green-100 text-green-700 border-green-300' },
    CASH_PAID:                { label: '💵 Cash Paid',         cls: 'bg-green-100 text-green-700 border-green-300' },
    MOVE_IN_SCHEDULED:        { label: '📅 Move-in Set',       cls: 'bg-teal-100 text-teal-700 border-teal-300' },
    ACTIVE:                   { label: '🏠 Active Tenant',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    CHECKIN_CONFIRMED:        { label: '🏡 Checked In',        cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    BOOKING_CONFIRMED:        { label: '🏡 Confirmed',         cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    CHECKED_OUT:              { label: '🏠 Checked Out',       cls: 'bg-slate-100 text-slate-500 border-slate-300' },
    REJECTED:                 { label: '❌ Rejected',           cls: 'bg-gray-100 text-gray-600 border-gray-300' },
    CANCELLED:                { label: '🚫 Cancelled',         cls: 'bg-slate-100 text-slate-600 border-slate-300' },
    EXPIRED:                  { label: '⏰ Expired',            cls: 'bg-gray-100 text-gray-500 border-gray-200' },
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
    // Section 5 & 7B — Food toggle state (owner can set/change food per tenant)
    const [foodEnabled, setFoodEnabled] = useState<boolean>(booking.foodSelected ?? false);
    const [foodChanging, setFoodChanging] = useState(false);

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

    const contactInfo = booking.status === "APPROVED" || booking.status === "CHECKIN_CONFIRMED";

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

                                {/* ── Section 5 & 7B — Food Service Panel ── */}
                                {booking.property?.foodType !== 'NOT_AVAILABLE' && booking.property?.foodType && (
                                    <div className="mt-3 p-3 rounded-xl border-2 bg-orange-50 border-orange-200 space-y-2">
                                        <div className="text-xs font-black text-orange-700 uppercase flex items-center gap-2">🍽 Food & Mess Service</div>
                                        {booking.property?.foodType === 'INCLUDED' && (
                                            <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full">✅ Included in Rent — Always Active</span>
                                        )}
                                        {booking.property?.foodType === 'OPTIONAL' && (
                                            <div className="space-y-2">
                                                <p className="text-[10px] text-slate-500">Monthly charge: <strong>₹{booking.property?.foodPricePerMonth?.toLocaleString()}/mo</strong></p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-slate-600">
                                                        {foodEnabled ? '🍽 Food ACTIVE' : '🚫 Food INACTIVE'}
                                                    </span>
                                                    {/* Toggle for REQUESTED bookings (pre-approval) */}
                                                    {booking.status === 'REQUESTED' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setFoodEnabled(!foodEnabled)}
                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                                foodEnabled ? 'bg-green-500' : 'bg-slate-300'
                                                            }`}
                                                        >
                                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                                                foodEnabled ? 'translate-x-6' : 'translate-x-1'
                                                            }`} />
                                                        </button>
                                                    )}
                                                    {/* Change button for already-approved bookings */}
                                                    {(booking.status === 'APPROVED' || booking.status === 'CHECKIN_CONFIRMED') && (
                                                        <button
                                                            type="button"
                                                            disabled={foodChanging}
                                                            onClick={() => {
                                                                const newVal = !foodEnabled;
                                                                toast(`${newVal ? 'Enable' : 'Disable'} food service for this tenant?`, {
                                                                    description: "Applies from the next billing cycle.",
                                                                    action: {
                                                                        label: "Confirm",
                                                                        onClick: async () => {
                                                                            setFoodChanging(true);
                                                                            const result = await changeFoodPreference(booking.id, newVal, 'Changed by owner');
                                                                            if (result.success) {
                                                                                setFoodEnabled(newVal);
                                                                                toast.success(`Food ${newVal ? 'enabled' : 'disabled'}. Effective from ${result.effectiveFrom}`);
                                                                                onRefresh();
                                                                            } else {
                                                                                toast.error(result.error || 'Failed to change food preference.');
                                                                            }
                                                                            setFoodChanging(false);
                                                                        }
                                                                    }
                                                                });
                                                            }}
                                                            className="text-[10px] px-3 py-1.5 rounded-lg bg-orange-600 text-white font-bold hover:bg-orange-700 disabled:opacity-50"
                                                        >
                                                            {foodChanging ? '...' : foodEnabled ? '🚫 Disable Food' : '🍽 Enable Food'}
                                                        </button>
                                                    )}
                                                </div>
                                                {booking.status === 'REQUESTED' && (
                                                    <p className="text-[10px] text-orange-600 italic">
                                                        Toggle food on/off before approving. {foodEnabled ? `(+₹${booking.property?.foodPricePerMonth?.toLocaleString()}/mo will be charged)` : '(No food charge)'}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

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
                                                            <button 
                                                                className="px-4 py-1 text-[10px] font-black bg-red-600 hover:bg-red-700 text-white rounded-full transition-all active:scale-95 shadow-md border border-red-700 uppercase tracking-widest" 
                                                                onClick={() => { setRejectTarget(null); setRejectNote(""); }}
                                                            >
                                                                CANCEL
                                                            </button>
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
                                <button 
                                    className="w-full py-4 text-xs font-black bg-slate-950 hover:bg-black text-white rounded-xl transition-all active:scale-95 shadow-lg border border-slate-800 uppercase tracking-widest" 
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

export function BookingsContainer() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
    const [expandedTab, setExpandedTab] = useState<"onboarding" | "documents">("onboarding");
    const [activeTab, setActiveTab] = useState<"ALL" | "PENDING" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED">("ALL");
    const [search, setSearch] = useState("");
    const [dateFilter, setDateFilter] = useState<"ALL" | "7D" | "30D">("7D");
    const [propertyFilter, setPropertyFilter] = useState("ALL");
    const [roomTypeFilter, setRoomTypeFilter] = useState("ALL");
    const [paymentFilter, setPaymentFilter] = useState("ALL");
    const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
    const [rejectReason, setRejectReason] = useState("");
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

    const handleCheckIn = (bookingId: string) => {
        toast("Confirm Check-in?", {
            description: "This activates tenancy and starts the billing cycle.",
            action: {
                label: "Confirm",
                onClick: async () => {
                    try {
                        await checkInBooking(bookingId);
                        toast.success("Student Checked-in. Tenancy is now ACTIVE.");
                        fetchData();
                    } catch (e: any) { toast.error(e.message || "Check-in failed."); }
                }
            }
        });
    };

    const handleApprove = (booking: any) => {
        toast(`Approve booking for ${booking.guestName}?`, {
            description: `Property: ${booking.propertyName}`,
            action: {
                label: "Approve",
                onClick: async () => {
                    try {
                        await approveBooking(booking.id, {});
                        toast.success("Booking Approved.");
                        fetchData();
                    } catch { toast.error("Approval failed."); }
                }
            }
        });
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
            fetchData();
        } catch { toast.error("Rejection failed."); }
    };

    const handleMarkCashPaid = (bookingId: string) => {
        toast("Mark booking as Cash Paid?", {
            description: "This confirms the reservation.",
            action: {
                label: "Confirm",
                onClick: async () => {
                    try {
                        await markBookingPaid(bookingId, "CASH");
                        toast.success("Booking marked as Paid.");
                        fetchData();
                    } catch { toast.error("Failed to mark as paid."); }
                }
            }
        });
    };

    const filteredBookings = bookings.filter(b => {
        const matchesSearch = 
            (b.guestName || "").toLowerCase().includes(search.toLowerCase()) ||
            (b.displayId || "").toLowerCase().includes(search.toLowerCase()) ||
            (b.propertyName || "").toLowerCase().includes(search.toLowerCase());
            
        if (!matchesSearch) return false;

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

        if (activeTab === "PENDING") return ["REQUESTED", "APPLIED", "PENDING_APPROVAL"].includes(b.status);
        if (activeTab === "APPROVED") return ["APPROVED", "APPROVED_PENDING_TOKEN", "KYC_PENDING", "APPROVED_KYC_PENDING", "APPROVED_PAYMENT_PENDING", "AGREEMENT_PENDING"].includes(b.status);
        if (activeTab === "PAID") return ["PAID", "CASH_PAID", "MOVE_IN_SCHEDULED", "CHECKIN_CONFIRMED", "BOOKING_CONFIRMED", "ACTIVE", "CHECKED_OUT"].includes(b.status);
        if (activeTab === "REJECTED") return b.status === "REJECTED" || b.status === "KYC_FAILED";
        if (activeTab === "CANCELLED") return b.status === "CANCELLED" || b.status === "EXPIRED";
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
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                        <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
                    </Button>
                </div>
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
                                        ? "bg-purple-600 text-white shadow-md"
                                        : "text-slate-500 hover:text-slate-700"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        {(["ALL", "PENDING", "APPROVED", "PAID", "REJECTED", "CANCELLED"] as const).map(t => (
                            <Button
                                key={t}
                                size="sm"
                                onClick={() => setActiveTab(t)}
                                className={`h-7 text-[10px] font-bold transition-all ${activeTab === t
                                    ? "bg-purple-600 hover:bg-purple-700 text-white shadow-md"
                                    : "bg-white border hover:bg-muted text-foreground"}`}
                            >
                                {t === "ALL" ? `📋 All`
                                    : t === "PENDING" ? `🔴 New`
                                        : t === "APPROVED" ? `⏳ Approved`
                                            : t === "PAID" ? `✅ Paid`
                                                : t === "REJECTED" ? `❌ No`
                                                    : `🚫 Out`}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Mobile Cards ── */}
            <div className="md:hidden space-y-3">
                {filteredBookings.length === 0 ? (
                    <p className="text-center text-muted-foreground py-12">No bookings found.</p>
                ) : filteredBookings.map(booking => (
                    <div key={booking.id} className={`bg-white border rounded-2xl p-4 shadow-sm space-y-3 ${["REQUESTED", "APPLIED"].includes(booking.status) ? "border-l-4 border-l-red-400" : ""}`}>
                        <div className="flex justify-between items-start gap-2">
                            <div>
                                <p className="font-black text-sm">{booking.guestName}</p>
                                <p className="text-[10px] font-mono text-slate-400">{booking.displayId}</p>
                            </div>
                            <StatusBadge status={booking.status} />
                        </div>
                        <div className="text-xs text-slate-600 space-y-1">
                            <p>🏠 <span className="font-bold">{booking.propertyName}</span></p>
                            <p>🛏 {booking.occupancy} · {booking.roomAssigned || "Not Allocated"}</p>
                            <p>📅 {new Date(booking.createdAt).toLocaleDateString('en-IN')}</p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {(booking.status === "REQUESTED" || booking.status === "APPLIED") && (
                                <>
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs flex-1" onClick={() => handleApprove(booking)}>✓ Approve</Button>
                                    <Button size="sm" variant="destructive" className="text-xs flex-1" onClick={() => handleReject(booking.id)}>✕ Reject</Button>
                                </>
                            )}
                            {booking.status === "APPROVED" && (
                                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-xs flex-1" onClick={() => handleMarkCashPaid(booking.id)}>💵 Cash Paid</Button>
                            )}
                            {(booking.status === "PAID" || booking.status === "CASH_PAID" || booking.status === "MOVE_IN_SCHEDULED") && (
                                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-xs flex-1" onClick={() => handleCheckIn(booking.id)}>🚀 Check-in</Button>
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
                    <CardContent className="p-0 text-sm md:text-base">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-left">
                                        <th className="p-4">Booking ID</th>
                                        <th className="p-4">Guest Name</th>
                                        <th className="p-4">PG Requested</th>
                                        <th className="p-4">Room</th>
                                        <th className="p-4">Requested On</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredBookings.map((booking) => (
                                        <React.Fragment key={booking.id}>
                                            <tr className="border-b hover:bg-muted/5">
                                                <td className="p-4 font-medium">{booking.displayId}</td>
                                                <td className="p-4">
                                                    <div className="font-medium">{booking.guestName}</div>
                                                    <div className="text-[10px] text-muted-foreground">{booking.guestEmail}</div>
                                                    <div className="text-[10px] text-muted-foreground">{booking.guestPhone}</div>
                                                </td>
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
                                                    <StatusBadge status={booking.status} />
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {(booking.status === "REQUESTED" || booking.status === "APPLIED") && (
                                                            <>
                                                                <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 text-[10px] font-bold" onClick={() => handleApprove(booking)}>✓ Approve</Button>
                                                                <Button size="sm" variant="destructive" className="h-8 text-[10px] font-bold" onClick={() => handleReject(booking.id)}>Reject</Button>
                                                            </>
                                                        )}
                                                        {booking.status === "APPROVED" && (
                                                            <Button size="sm" className="h-8 text-[10px] bg-orange-500 hover:bg-orange-600 font-bold" onClick={() => handleMarkCashPaid(booking.id)}>💵 Cash Paid</Button>
                                                        )}
                                                        {(booking.status === "PAID" || booking.status === "CASH_PAID" || booking.status === "MOVE_IN_SCHEDULED") && (
                                                            <Button size="sm" className="h-8 text-[10px] bg-indigo-600 hover:bg-indigo-700 font-bold" onClick={() => handleCheckIn(booking.id)}>🚀 Check-in</Button>
                                                        )}
                                                        <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                                                            onClick={() => setExpandedBooking(expandedBooking === booking.id ? null : booking.id)}>
                                                            {expandedBooking === booking.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedBooking === booking.id && (
                                                <BookingDetail booking={booking} rooms={rooms} onRefresh={fetchData} />
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

            {/* ── Reject Modal ── */}
            {rejectModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
                    <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4 shadow-2xl">
                        <h3 className="font-black text-lg">Reject Booking</h3>
                        <p className="text-sm text-muted-foreground">The student will be notified with this reason.</p>
                        <textarea
                            className="w-full border rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-red-300"
                            placeholder="Reason for rejection..."
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                        />
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => { setRejectModal(null); setRejectReason(""); }}>Cancel</Button>
                            <Button variant="destructive" className="flex-1" onClick={confirmReject}>Confirm Reject</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
