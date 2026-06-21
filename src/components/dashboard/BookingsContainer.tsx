"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, RefreshCcw, FileText, ClipboardList, CheckCircle, XCircle, Eye, Search, BedDouble, ShieldCheck, CreditCard, Calendar, Shuffle, AlertTriangle, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import React, { useEffect, useState } from "react";
import { getBookings, approveBooking, rejectBooking as rejectBookingAction, checkInBooking, markBookingPaid, cancelBooking, updateSharingType, ownerCounterSignAgreement, updateMoveInDate, markPhysicalKycVerified } from "@/actions/bookings";
import { getCashPaymentEnabled } from "@/actions/platform";
import { getAvailableRooms } from "@/actions/rooms";
import { getTenantDocuments, verifyDocument } from "@/actions/documents";
import { changeFoodPreference } from "@/actions/food";
import { toast } from "sonner";
import { RoomAllocationModal } from "@/components/dashboard/RoomAllocationModal";
import { PhysicalKycModal } from "@/components/dashboard/PhysicalKycModal";

const TYPE_LABELS: Record<string, string> = {
    ID_PROOF: "🪪 ID Proof", ADDRESS_PROOF: "🏠 Address Proof",
    COLLEGE_COMPANY: "🎓 College / Company", SELFIE: "📸 Current Selfie",
    AADHAAR_FRONT: "🪪 Aadhaar Front", AADHAAR_BACK: "🪪 Aadhaar Back",
    PAN_FRONT: "💳 PAN Front", PAN_BACK: "💳 PAN Back",
    STUDENT_ID: "🎓 Student ID", COMPANY_ID: "🏢 Company ID",
    LIVE_PHOTO: "📸 Current Photo", OTHER: "📎 Other",
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    REQUESTED:                { label: '📥 New Request',       cls: 'bg-red-100 text-red-700 border-red-300' },
    APPLIED:                  { label: '📥 New Request',       cls: 'bg-red-100 text-red-700 border-red-300' },
    PENDING_APPROVAL:         { label: '⏳ Pending Approval',  cls: 'bg-gray-100 text-gray-700 border-gray-300' },
    APPROVED:                 { label: '✅ Approved',           cls: 'bg-green-100 text-green-700 border-green-300' },
    APPROVED_PENDING_TOKEN:   { label: '🔐 Awaiting Token',    cls: 'bg-amber-100 text-amber-700 border-amber-300' },
    ROOM_RESERVED:            { label: '🏠 Token Paid',        cls: 'bg-teal-100 text-teal-700 border-teal-300' },
    PHYSICAL_VERIFIED:        { label: '🪪 ID Verified',       cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    AGREEMENT_PENDING:        { label: '✍️ Student Signed',    cls: 'bg-violet-100 text-violet-700 border-violet-300' },
    PAID:                     { label: '💳 Paid',              cls: 'bg-green-100 text-green-700 border-green-300' },
    CASH_PAID:                { label: '💵 Cash Paid',         cls: 'bg-green-100 text-green-700 border-green-300' },
    BOOKING_CONFIRMED:        { label: '📋 Both Signed',       cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    MOVE_IN_SCHEDULED:        { label: '💳 Final Payment Due', cls: 'bg-blue-100 text-blue-700 border-blue-300' },
    ACTIVE:                   { label: '🏠 Active Tenant',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    CHECKIN_CONFIRMED:        { label: '🏡 Checked In',        cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    CHECKED_OUT:              { label: '🏠 Checked Out',       cls: 'bg-slate-100 text-slate-500 border-slate-300' },
    COMPLETED:                { label: '✅ Stay Completed',    cls: 'bg-slate-100 text-slate-600 border-slate-300' },
    REJECTED:                 { label: '❌ Rejected',           cls: 'bg-red-50 text-red-700 border-red-200' },
    CANCELLED:                { label: '🚫 Cancelled',         cls: 'bg-slate-100 text-slate-600 border-slate-300' },
    EXPIRED:                  { label: '⏰ Expired',            cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

function StatusBadge({ status }: { status: string }) {
    const badge = STATUS_BADGE[status] || { label: status, cls: 'bg-gray-100 text-gray-600 border-gray-300' };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${badge.cls}`}>{badge.label}</span>;
}

// ─── Action Badge Helper ────────────────────────────────────────────────────
function OwnerNextStep({ booking, allowCashPayment }: { booking: any; allowCashPayment: boolean }) {
    const s = booking.status;
    const hasRoom = !!booking.roomAssigned;

    if (['REQUESTED', 'APPLIED', 'PENDING_APPROVAL'].includes(s)) return (
        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full border border-orange-200">
            👆 Approve &amp; Allocate Room
        </span>
    );
    if (s === 'APPROVED' && !hasRoom) return (
        <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-full border border-violet-200">
            🛏 Allocate Room
        </span>
    );
    if (s === 'APPROVED_PENDING_TOKEN') return (
        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-full border border-amber-300">
            ⏳ Awaiting ₹1,000 Token from Student
        </span>
    );
    if (s === 'ROOM_RESERVED') return (
        <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-full border border-teal-200">
            🔍 Physical ID Verify → Check-in
        </span>
    );
    if (s === 'PHYSICAL_VERIFIED') return (
        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
            ✍️ Awaiting Student Agreement Signature
        </span>
    );
    if (hasRoom && ['APPROVED', 'AGREEMENT_PENDING'].includes(s) && s !== 'APPROVED_PENDING_TOKEN') {
        if (allowCashPayment && booking.paymentStatus === 'CASH_PENDING' && booking.paymentMethod === 'CASH') return (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-full border border-amber-300">
                💵 Confirm Cash Token Payment
            </span>
        );
    }
    if (s === 'AGREEMENT_PENDING') return (
        <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-full border border-violet-200">
            ✍️ Countersign Agreement (You)
        </span>
    );
    if (s === 'BOOKING_CONFIRMED') return (
        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
            💳 Awaiting Student Final Payment
        </span>
    );
    if (s === 'MOVE_IN_SCHEDULED') return (
        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-200">
            ⏳ Awaiting Student Final Payment
        </span>
    );
    if (['ACTIVE', 'CHECKIN_CONFIRMED', 'CHECKED_OUT', 'COMPLETED'].includes(s)) return (
        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
            ✅ Managed in Tenants
        </span>
    );
    return null;
}

// ─── BookingDetail (Expanded Panel) ────────────────────────────────────────
function formatDateTime(date: string | Date | null | undefined) {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
    });
}

function BookingDetail({ booking, onRefresh }: { booking: any; onRefresh: () => void }) {
    const [foodEnabled, setFoodEnabled] = useState<boolean>(booking.foodSelected ?? false);
    const [foodChanging, setFoodChanging] = useState(false);

    return (
        <tr>
            <td colSpan={7} className="bg-slate-50 border-b">
                <div className="p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div className="text-xs font-bold uppercase text-purple-700 mb-2">📋 Guest / Onboarding Details</div>
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
                            <div className="text-xs font-bold uppercase text-green-700 mb-2">🏠 Booking & Room Info</div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {[
                                    ["PG / Property", booking.propertyName || "—"],
                                    ["Requested Type", booking.occupancy || "—"],
                                    ["Allocated Room", booking.roomAssigned || "Not Allocated Yet"],
                                    ["Monthly Rent", booking.amount ? `₹${Number(booking.amount).toLocaleString('en-IN')}` : "—"],
                                    ["Security Deposit", booking.depositAmount ? `₹${Number(booking.depositAmount).toLocaleString('en-IN')} (${booking.depositMonths || 2}m)` : "—"],
                                    ["Booking Ref", booking.displayId],
                                ].map(([label, value]) => (
                                    <div key={label} className="bg-white border rounded p-2">
                                        <div className="text-[10px] text-muted-foreground uppercase font-bold">{label}</div>
                                        <div className="text-sm font-medium">{value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Token Payment Info — shown whenever tokenPaidAt is set */}
                            {booking.tokenPaidAt && (
                                <div className="mt-3 p-3 rounded-xl border-2 bg-teal-50 border-teal-200 space-y-2">
                                    <div className="text-xs font-black text-teal-700 uppercase flex items-center gap-2">🔐 Token / Room-Lock Payment</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-white border border-teal-100 rounded p-2">
                                            <div className="text-[10px] text-teal-600 uppercase font-bold">Amount Paid</div>
                                            <div className="text-sm font-black text-teal-800">₹{Number(booking.tokenAmount || 1000).toLocaleString('en-IN')}</div>
                                        </div>
                                        <div className="bg-white border border-teal-100 rounded p-2">
                                            <div className="text-[10px] text-teal-600 uppercase font-bold">Paid On</div>
                                            <div className="text-sm font-medium text-teal-800">
                                                {new Date(booking.tokenPaidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                        </div>
                                        <div className="bg-white border border-teal-100 rounded p-2">
                                            <div className="text-[10px] text-teal-600 uppercase font-bold">Method</div>
                                            <div className="text-sm font-medium text-teal-800">
                                                {booking.paymentMethod === 'CASH' ? '💵 Cash (Owner Confirmed)' : '🌐 Razorpay (Online)'}
                                            </div>
                                        </div>
                                        <div className="bg-white border border-teal-100 rounded p-2">
                                            <div className="text-[10px] text-teal-600 uppercase font-bold">Status</div>
                                            <div className="text-sm font-black text-green-700">✅ PAID & VERIFIED</div>
                                        </div>
                                    </div>
                                    {booking.tokenPaymentId && (
                                        <div className="bg-white border border-teal-100 rounded p-2">
                                            <div className="text-[10px] text-teal-600 uppercase font-bold">Razorpay Payment ID</div>
                                            <div className="text-xs font-mono text-blue-700 break-all">{booking.tokenPaymentId}</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Food Service */}
                            {booking.property?.foodType !== 'NOT_AVAILABLE' && booking.property?.foodType && (
                                <div className="mt-3 p-3 rounded-xl border-2 bg-orange-50 border-orange-200 space-y-2">
                                    <div className="text-xs font-black text-orange-700 uppercase flex items-center gap-2">🍽 Food & Mess Service</div>
                                    {booking.property?.foodType === 'INCLUDED' && (
                                        <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full">✅ Included in Rent</span>
                                    )}
                                    {booking.property?.foodType === 'OPTIONAL' && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-600">{foodEnabled ? '🍽 Food ACTIVE' : '🚫 Food INACTIVE'}</span>
                                            {(booking.status === 'APPROVED' || booking.status === 'CHECKIN_CONFIRMED') && (
                                                <button type="button" disabled={foodChanging}
                                                    onClick={() => {
                                                        const newVal = !foodEnabled;
                                                        toast(`${newVal ? 'Enable' : 'Disable'} food for this tenant?`, {
                                                            action: {
                                                                label: "Confirm",
                                                                onClick: async () => {
                                                                    setFoodChanging(true);
                                                                    const result = await changeFoodPreference(booking.id, newVal, 'Changed by owner');
                                                                    if (result.success) { setFoodEnabled(newVal); toast.success(`Food ${newVal ? 'enabled' : 'disabled'}.`); onRefresh(); }
                                                                    else toast.error(result.error || 'Failed.');
                                                                    setFoodChanging(false);
                                                                }
                                                            }
                                                        });
                                                    }}
                                                    className="text-[10px] px-3 py-1.5 rounded-lg bg-orange-600 text-white font-bold hover:bg-orange-700 disabled:opacity-50">
                                                    {foodChanging ? '...' : foodEnabled ? '🚫 Disable' : '🍽 Enable'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export function BookingsContainer() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [allowCashPayment, setAllowCashPayment] = useState(false);
    const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"ALL" | "NEW_REQUEST" | "ALLOCATE_ROOM" | "STUDENT_PAYS" | "AGREEMENT" | "PHYSICAL_VERIFY" | "CHECKED_IN" | "REJECTED" | "CANCELLED">("ALL");
    const [search, setSearch] = useState("");
    const [dateFilter, setDateFilter] = useState<"ALL" | "7D" | "30D">("7D");
    const [propertyFilter, setPropertyFilter] = useState("ALL");
    const [roomTypeFilter, setRoomTypeFilter] = useState("ALL");

    // Reject modal
    const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
    const [rejectReason, setRejectReason] = useState("");

    // Room Allocation Modal
    const [allocateBooking, setAllocateBooking] = useState<any | null>(null);

    // Physical KYC Modal
    const [kycBooking, setKycBooking] = useState<any | null>(null);

    // Cancel Modal
    const [cancelModal, setCancelModal] = useState<{ id: string; name: string } | null>(null);
    const [cancelReason, setCancelReason] = useState("");

    // Approve Confirm Modal
    const [approveModal, setApproveModal] = useState<any | null>(null);

    // Change Sharing Type — reuse RoomAllocationModal
    const [changeTypeBooking, setChangeTypeBooking] = useState<any | null>(null);

    const handleChangeType = async (bookingId: string, allocationData: any) => {
        try {
            await updateSharingType(bookingId, {
                newOccupancy: allocationData.roomType,
                roomId: allocationData.roomId,
                bedId: allocationData.bedId,
                roomAssigned: `${allocationData.roomAssigned} — Bed ${allocationData.bedNumber}`,
                newAmount: allocationData.amount,
                depositAmount: allocationData.depositAmount,
                depositMonths: allocationData.depositMonths,
            });
            toast.success(`Room type changed to ${allocationData.roomType}! Student has been notified.`);
            setChangeTypeBooking(null);
            fetchData();
        } catch (e: any) {
            toast.error(e.message || "Failed to update sharing type.");
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [b, cashEnabled] = await Promise.all([getBookings(), getCashPaymentEnabled()]);
            setBookings(b);
            setAllowCashPayment(cashEnabled);
        }
        catch (e) { console.error("Failed to fetch bookings:", e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    // ── Handlers ──────────────────────────────────────────────────
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
            await fetchData();
            setAllocateBooking({ ...approved, status: 'APPROVED' });
        } catch { toast.error("Approval failed."); }
    };

    const handleAllocate = async (bookingId: string, allocationData: any) => {
        const requestedOccupancy = allocateBooking?.occupancy;
        const allocatedRoomType = allocationData.roomType;
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
            toast.warning(`⚠️ Room type changed: Student requested "${requestedOccupancy}" but "${allocatedRoomType}" was allocated. Student is notified to contact Building Management if they have concerns.`);
        } else {
            toast.success(`Room ${allocationData.roomAssigned} / Bed ${allocationData.bedNumber} allocated! Student will now see payment CTA.`);
        }
        setAllocateBooking(null);
        await fetchData();
    };

    const handleMarkCashPaid = (bookingId: string) => {
        toast("Mark booking as Cash Paid?", {
            description: "Student must have paid rent + deposit in cash.",
            action: {
                label: "Confirm",
                onClick: async () => {
                    try {
                        await markBookingPaid(bookingId, "CASH");
                        toast.success("Booking marked as Paid. Student can now sign the agreement.");
                        fetchData();
                    } catch { toast.error("Failed to mark as paid."); }
                }
            }
        });
    };

    const handleCheckIn = async (booking: any) => {
        // Opens Physical KYC Modal — actual checkIn called on confirm
        setKycBooking(booking);
    };

    const handleConfirmCheckIn = async () => {
        if (!kycBooking) return;
        await checkInBooking(kycBooking.id);
        const isNewFlow = kycBooking.status === 'ROOM_RESERVED';
        toast.success(isNewFlow
            ? '✅ Physical KYC done! Tenant ID assigned. Student will sign agreement next.'
            : '✅ Student Checked-in! Tenancy is now ACTIVE.');
        setKycBooking(null);
        await fetchData();
    };

    const handleReject = (bookingId: string) => { setRejectReason(""); setRejectModal({ id: bookingId }); };
    const confirmReject = async () => {
        if (!rejectReason.trim()) { toast.error("Enter a rejection reason."); return; }
        try {
            await rejectBookingAction(rejectModal!.id, rejectReason);
            toast.success("Booking Rejected.");
            setRejectModal(null); setRejectReason(""); fetchData();
        } catch { toast.error("Rejection failed."); }
    };

    const handleCancelBooking = (bookingId: string, guestName: string) => {
        setCancelReason("");
        setCancelModal({ id: bookingId, name: guestName });
    };
    const confirmCancel = async () => {
        try {
            await cancelBooking(cancelModal!.id, cancelReason);
            toast.success("Booking cancelled.");
            setCancelModal(null); setCancelReason(""); fetchData();
        } catch { toast.error("Failed to cancel booking."); }
    };

    // ── Filtering ─────────────────────────────────────────────────
    const ACTIVE_STATUSES = ['ACTIVE', 'CHECKIN_CONFIRMED'];
    const STATUS_GROUPS: Record<string, string[]> = {
        ALL: [],
        NEW_REQUEST:     ['APPLIED', 'REQUESTED', 'PENDING_APPROVAL'],
        ALLOCATE_ROOM:   ['APPROVED', 'APPROVED_PENDING_TOKEN', 'ROOM_RESERVED'],
        STUDENT_PAYS:    ['PAID', 'CASH_PAID'],
        AGREEMENT:       ['PHYSICAL_VERIFIED', 'AGREEMENT_PENDING', 'BOOKING_CONFIRMED'],
        PHYSICAL_VERIFY: ['MOVE_IN_SCHEDULED'],
        REJECTED:        ['REJECTED'],
        CANCELLED:       ['CANCELLED', 'EXPIRED'],
    };

    const filteredBookings = bookings.filter(b => {
        // Active tenants are managed in the "Active Tenants" sidebar — hide them from
        // the main onboarding/bookings view.
        if (ACTIVE_STATUSES.includes(b.status)) return false;

        const matchesSearch =
            (b.guestName || "").toLowerCase().includes(search.toLowerCase()) ||
            (b.displayId || "").toLowerCase().includes(search.toLowerCase()) ||
            (b.propertyName || "").toLowerCase().includes(search.toLowerCase());
        if (!matchesSearch) return false;
        if (dateFilter !== "ALL") {
            const diffDays = Math.ceil((Date.now() - new Date(b.createdAt).getTime()) / 86400000);
            if (dateFilter === "7D" && diffDays > 7) return false;
            if (dateFilter === "30D" && diffDays > 30) return false;
        }
        if (propertyFilter !== "ALL" && b.propertyName !== propertyFilter) return false;
        if (roomTypeFilter !== "ALL" && b.occupancy !== roomTypeFilter) return false;

        const group = STATUS_GROUPS[activeTab];
        if (activeTab !== "ALL" && group && !group.includes(b.status)) return false;

        return true;
    });

    // ── Reject capsule — owners/admins reject (not cancel) at any stage ───────
    const RejectCapsule = ({ bookingId }: { bookingId: string }) => (
        <button
            onClick={() => handleReject(bookingId)}
            className="h-8 px-4 rounded-full text-[10px] font-black bg-red-600 hover:bg-red-700 text-white transition-all active:scale-95 shadow-sm uppercase tracking-wide">
            ✕ Reject
        </button>
    );

    const renderActionButtons = (booking: any) => {
        const s = booking.status;
        const hasRoom = !!booking.roomAssigned;

        // Step 1: New request → Approve + Reject
        if (['REQUESTED', 'APPLIED', 'PENDING_APPROVAL'].includes(s)) return (
            <>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 text-[10px] font-bold" onClick={() => handleApprove(booking)}>✓ Approve</Button>
                <button onClick={() => handleReject(booking.id)} className="h-8 px-4 text-[10px] font-black bg-red-600 hover:bg-red-700 text-white rounded-full transition-all active:scale-95 uppercase tracking-wide">✕ Reject</button>
            </>
        );

        // Step 2: Approved but no room → Allocate Room
        if (s === 'APPROVED' && !hasRoom) return (
            <>
                <Button size="sm" className="h-8 text-[10px] bg-violet-600 hover:bg-violet-700 font-bold" onClick={() => setAllocateBooking(booking)}>
                    <BedDouble className="w-3 h-3 mr-1" />Allocate Room
                </Button>
                <RejectCapsule bookingId={booking.id} />
            </>
        );


        // Step 3: Bed allocated, awaiting student ₹1000 token
        if (s === 'APPROVED_PENDING_TOKEN') return (
            <>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-300">
                    ⏳ Awaiting ₹1,000 Token
                </span>
                <RejectCapsule bookingId={booking.id} />
            </>
        );

        // Step 4: Token paid → Physical KYC (NEW FLOW: physical check-in BEFORE agreement)
        if (s === 'ROOM_RESERVED') return (
            <>
                <Button size="sm" className="h-8 text-[10px] bg-teal-600 hover:bg-teal-700 font-bold" onClick={() => handleCheckIn(booking)}>
                    <ShieldCheck className="w-3 h-3 mr-1" />Physical Check-in
                </Button>
                <RejectCapsule bookingId={booking.id} />
            </>
        );

        // Step 5: Physical KYC done → Awaiting student agreement signature
        if (s === 'PHYSICAL_VERIFIED') return (
            <>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                    ✍️ Awaiting Student Agreement
                </span>
                <RejectCapsule bookingId={booking.id} />
            </>
        );

        // Step 6: Student signed → Owner must countersign
        if (s === 'AGREEMENT_PENDING') return (
            <>
                <Button size="sm" className="h-8 text-[10px] bg-violet-600 hover:bg-violet-700 font-bold"
                    onClick={async () => {
                        try {
                            await ownerCounterSignAgreement(booking.id);
                            toast.success('✅ Agreement countersigned! Both parties have now signed.');
                            fetchData();
                        } catch (e: any) { toast.error(e.message || 'Failed to countersign.'); }
                    }}>
                    <ShieldCheck className="w-3 h-3 mr-1" />Countersign Agreement
                </Button>
                <RejectCapsule bookingId={booking.id} />
            </>
        );

        // Step 7: Both signed → final payment (BOOKING_CONFIRMED is now the final step before ACTIVE)
        if (s === 'BOOKING_CONFIRMED') return (
            <>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
                    💳 Awaiting Student Final Payment
                </span>
                {allowCashPayment && (
                    <Button size="sm" className="h-8 text-[10px] bg-amber-600 hover:bg-amber-700 font-bold" onClick={() => handleMarkCashPaid(booking.id)}>
                        <CreditCard className="w-3 h-3 mr-1" />Mark Cash Paid
                    </Button>
                )}
                <RejectCapsule bookingId={booking.id} />
            </>
        );

        // Legacy Step: MOVE_IN_SCHEDULED → final payment
        if (s === 'MOVE_IN_SCHEDULED') return (
            <>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
                    💳 Awaiting Final Payment
                </span>
                {allowCashPayment && (
                    <Button size="sm" className="h-8 text-[10px] bg-amber-600 hover:bg-amber-700 font-bold" onClick={() => handleMarkCashPaid(booking.id)}>
                        <CreditCard className="w-3 h-3 mr-1" />Mark Cash Paid
                    </Button>
                )}
                <RejectCapsule bookingId={booking.id} />
            </>
        );

        return null;
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading bookings...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Bookings</h1>
                    <p className="text-muted-foreground">Approve, allocate rooms, and manage tenant onboarding.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                    <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
                </Button>
            </div>

                {/* ── Onboarding Flow Banner ── */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-4">
                <p className="text-xs font-black text-indigo-700 uppercase tracking-widest mb-2">📋 Onboarding Flow (Industry Standard)</p>
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-600">
                    {[
                        { icon: "📥", label: "Request" },
                        { icon: "→", label: "" },
                        { icon: "✅", label: "Approve" },
                        { icon: "→", label: "" },
                        { icon: "🛏", label: "Allocate" },
                        { icon: "→", label: "" },
                        { icon: "⏳", label: "Token" },
                        { icon: "→", label: "" },
                        { icon: "🔍", label: "Physical KYC" },
                        { icon: "→", label: "" },
                        { icon: "✍️", label: "Agreement" },
                        { icon: "→", label: "" },
                        { icon: "💳", label: "Final Payment" },
                        { icon: "→", label: "" },
                        { icon: "🏠", label: "Active" },
                    ].map((s, i) => s.label ? (
                        <span key={i} className="bg-white border border-indigo-200 px-2 py-1 rounded-full">{s.icon} {s.label}</span>
                    ) : (
                        <span key={i} className="text-indigo-400 font-black text-base">{s.icon}</span>
                    ))}
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input placeholder="Search by name, ID or property..."
                            className="pl-11 h-10 border-slate-200 bg-slate-50/30 focus:bg-white rounded-xl text-sm"
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)}
                        className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none min-w-[160px]">
                        <option value="ALL">All Properties</option>
                        {Array.from(new Set(bookings.map(b => b.propertyName).filter(Boolean))).map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                    <select value={roomTypeFilter} onChange={e => setRoomTypeFilter(e.target.value)}
                        className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none min-w-[140px]">
                        <option value="ALL">All Room Types</option>
                        {Array.from(new Set(bookings.map(b => b.occupancy).filter(Boolean))).map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <div className="flex bg-slate-100/50 p-1 rounded-xl w-fit border border-slate-200">
                        {(["7D", "30D", "ALL"] as const).map(val => (
                            <button key={val} onClick={() => setDateFilter(val)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest ${dateFilter === val ? "bg-purple-600 text-white shadow-md" : "text-slate-500 hover:text-slate-700"}`}>
                                {val === "7D" ? "Last 7 Days" : val === "30D" ? "Last 30 Days" : "All Time"}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {([
                            ['ALL',             `📋 All (${bookings.filter(b => !['ACTIVE','CHECKIN_CONFIRMED'].includes(b.status)).length})`] as const,
                            ['NEW_REQUEST',     `📥 New Request`] as const,
                            ['ALLOCATE_ROOM',   `🛏 Room Allocated`] as const,
                            ['STUDENT_PAYS',    `💳 Token & Payment`] as const,
                            ['AGREEMENT',       `✍️ Agreement`] as const,
                            ['PHYSICAL_VERIFY', `🔍 Physical Verify`] as const,
                            ['REJECTED',        `❌ Rejected`] as const,
                            ['CANCELLED',       `🚫 Cancelled`] as const,
                        ]).map(([t, label]) => (
                            <Button key={t} size="sm" onClick={() => setActiveTab(t as any)}
                                className={`h-7 text-[10px] font-bold transition-all ${activeTab === t ? "bg-purple-600 hover:bg-purple-700 text-white shadow-md" : "bg-white border hover:bg-muted text-foreground"}`}>
                                {label}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Desktop Table */}
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
                            <tbody>
                                {filteredBookings.map(booking => (
                                    <React.Fragment key={booking.id}>
                                        <tr className={`border-b hover:bg-muted/5 transition-colors ${['REQUESTED', 'APPLIED'].includes(booking.status) ? 'bg-red-50/40' : ''}`}>
                                            <td className="p-4">
                                                <div className="font-mono text-xs text-purple-700 font-bold">{booking.displayId}</div>
                                                {booking.tenantDisplayId && (
                                                    <div className="mt-1 inline-flex items-center gap-1 bg-emerald-50 border border-emerald-300 rounded-full px-2 py-0.5">
                                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wide">🪪 Tenant ID</span>
                                                        <span className="text-[10px] font-black text-emerald-800 font-mono">{booking.tenantDisplayId}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="font-semibold text-sm">{booking.guestName}</div>
                                                <div className="text-[10px] text-muted-foreground">{booking.guestEmail}</div>
                                                <div className="text-[10px] text-muted-foreground">{booking.guestPhone}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-medium text-purple-700 text-sm">{booking.propertyName || "—"}</div>
                                                <div className="text-[10px] text-muted-foreground">{booking.occupancy}</div>
                                                {booking.roomAssigned && (
                                                    <div className="text-[10px] font-bold text-indigo-600">🛏 {booking.roomAssigned}</div>
                                                )}
                                            </td>
                                            <td className="p-4 text-xs text-muted-foreground">
                                                {booking.onboardingDate || booking.moveInDate || "—"}
                                                <div className="text-[9px] opacity-60">{new Date(booking.createdAt).toLocaleDateString('en-IN')}</div>
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
                                                {/* Cash pending indicator (APPROVED + student registered intent) */}
                                                {allowCashPayment && booking.paymentStatus === 'CASH_PENDING' && booking.paymentMethod === 'CASH' &&
                                                    !['PAID', 'CASH_PAID', 'MOVE_IN_SCHEDULED'].includes(booking.status) && (
                                                    <div className="mt-1">
                                                        <div className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded px-1.5 py-0.5 inline-block">💵 Cash Pending</div>
                                                    </div>
                                                )}
                                                {(booking.status === 'PAID' || booking.status === 'CASH_PAID' || booking.status === 'MOVE_IN_SCHEDULED') && (
                                                    <div className="mt-1 space-y-0.5">
                                                        {booking.paymentMethod === 'CASH' || booking.status === 'CASH_PAID'
                                                            ? <div className="text-[9px] font-bold text-emerald-700">💵 Cash Payment Recorded</div>
                                                            : booking.paymentId
                                                                ? <div className="text-[9px] font-bold text-blue-700" title={booking.paymentId}>🧾 Txn: {booking.paymentId.slice(0, 14)}…</div>
                                                                : <div className="text-[9px] font-bold text-green-700">💳 Online Payment</div>
                                                        }
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4"><OwnerNextStep booking={booking} allowCashPayment={allowCashPayment} /></td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end items-center gap-2">
                                                    {renderActionButtons(booking)}
                                                    <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                                                        onClick={() => setExpandedBooking(expandedBooking === booking.id ? null : booking.id)}>
                                                        {expandedBooking === booking.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedBooking === booking.id && (
                                            <BookingDetail booking={booking} onRefresh={fetchData} />
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

            {/* ── Room Allocation Modal ── */}
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

            {/* ── Physical KYC Modal ── */}
            {kycBooking && (
                <PhysicalKycModal
                    isOpen={!!kycBooking}
                    onClose={() => setKycBooking(null)}
                    onConfirm={handleConfirmCheckIn}
                    tenantName={kycBooking.guestName}
                />
            )}

            {/* ── Approve Confirm Modal ── */}
            {approveModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
                    <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4 shadow-2xl">
                        <h3 className="font-black text-lg text-green-700">✅ Approve Booking</h3>
                        <p className="text-sm text-muted-foreground">
                            Approve booking for <strong>{approveModal.guestName}</strong>?
                            After approval you will allocate a room.
                        </p>
                        <div className="flex gap-3">
                            <Button className="flex-1 bg-black hover:bg-zinc-900 text-white font-bold" onClick={() => setApproveModal(null)}>Close</Button>
                            <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold" onClick={confirmApprove}>✓ Confirm Approve</Button>
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
                        <p className="text-[11px] text-red-600 font-bold italic bg-red-50 p-2 rounded-lg border border-red-100 italic">
                             ※ Please note: This reason will be sent to the customer to explain the cancellation.
                        </p>
                        <textarea className="w-full border rounded-xl p-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-red-300"
                            placeholder="Provide a reason for cancellation..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => { setCancelModal(null); setCancelReason(""); }}>Back</Button>
                            <Button variant="destructive" className="flex-1" onClick={confirmCancel} disabled={!cancelReason.trim()}>✕ Confirm Cancel</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Reject Modal ── */}
            {rejectModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
                    <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4 shadow-2xl">
                        <h3 className="font-black text-lg">Reject Booking</h3>
                        <p className="text-sm text-muted-foreground">The student will be notified with this reason.</p>
                        <p className="text-[11px] text-red-600 font-bold bg-red-50 p-2 rounded-lg border border-red-100 italic">
                            ※ Please note: You must add a reason in the box below to notify the student.
                        </p>
                        <textarea className="w-full border rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-red-300"
                            placeholder="Reason for rejection..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => { setRejectModal(null); setRejectReason(""); }}>Cancel</Button>
                            <Button variant="destructive" className="flex-1" onClick={confirmReject} disabled={!rejectReason.trim()}>Confirm Reject</Button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Change Room Type Modal (same as Allocate Room) ── */}
            {changeTypeBooking && (
                <RoomAllocationModal
                    isOpen={!!changeTypeBooking}
                    onClose={() => setChangeTypeBooking(null)}
                    onAllocate={data => handleChangeType(changeTypeBooking.id, data)}
                    booking={{
                        id: changeTypeBooking.id,
                        propertyId: changeTypeBooking.propertyId,
                        occupancy: changeTypeBooking.occupancy || "Double Sharing",
                        guestName: changeTypeBooking.guestName,
                    }}
                    property={{
                        id: changeTypeBooking.propertyId,
                        depositMonths: changeTypeBooking.property?.depositMonths || 2,
                        foodAvailable: changeTypeBooking.property?.foodType === 'OPTIONAL',
                        foodCharge: changeTypeBooking.property?.foodPricePerMonth,
                    }}
                />
            )}
        </div>
    );
}
