"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getBookings, cancelBooking, signAgreement, completeVacate } from "@/actions/bookings";
import { getPersistentNotifications, markNotificationRead } from "@/actions/notifications";
import { getTenantDocuments, uploadTenantDocument } from "@/actions/documents";
import { changeFoodPreference } from "@/actions/food";
import { getPendingRentInvoice } from "@/actions/rent";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCcw, FileText, BedDouble, Calendar, CreditCard, CheckCircle, XCircle, UploadCloud, ChevronDown, ChevronUp, AlertTriangle, Phone, Mail, User, History, Shield, Building2, Download, Star, Lock, X, Clock, MapPin, Utensils, Ticket, Bell } from "lucide-react";
import { getStudentPaymentHistory } from "@/actions/payments";
import RentReceipt from "@/components/bookings/RentReceipt";
import { SubmitReviewModal } from "@/components/reviews/SubmitReviewModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateInvoicePDF } from "@/utils/invoiceGenerator";
import { BookingTimeline } from "@/components/ui/BookingTimeline";
import { StudentKYCUploader } from "@/components/booking/StudentKYCUploader";
import { PropertyAgreementModal } from "@/components/booking/PropertyAgreementModal";
import { DocumentViewerModal, type DocumentViewerDoc } from "@/components/booking/DocumentViewerModal";
import { BookingFeeBreakdown } from "@/components/booking/BookingFeeBreakdown";
import { toast } from "sonner";
import { getStudentProfile, updateStudentProfile } from "@/actions/student";
import { Badge } from "@/components/ui/badge";
import { MyDepositSection } from "@/components/deposit/MyDepositSection";
import { requestSelfServiceOTP, verifyAndUpdateSelfService } from "@/actions/tenants";
import { Edit2, AlertCircle } from "lucide-react";

const TYPE_LABELS: Record<string, any> = {
    ID_PROOF: "ID Proof",
    ADDRESS_PROOF: "Address Proof",
    COLLEGE_COMPANY: "College / Company Letter",
    SELFIE: "Current Selfie",
};
const DOC_TYPES = ["ID_PROOF", "ADDRESS_PROOF", "COLLEGE_COMPANY", "SELFIE"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Formats any occupancy string to "Three Sharing (3)" style
function formatOccupancy(occupancy: string): string {
    if (!occupancy) return '';
    const o = occupancy.toLowerCase().trim();
    if (o.includes('single') || o === '1' || o === '1 sharing') return 'Single Sharing (1)';
    if (o.includes('double') || o === '2' || o === '2 sharing') return 'Double Sharing (2)';
    if (o.includes('three') || o.includes('triple') || o === '3' || o === '3 sharing') return 'Three Sharing (3)';
    if (o.includes('four') || o === '4' || o === '4 sharing') return 'Four Sharing (4)';
    if (o.includes('five') || o === '5' || o === '5 sharing') return 'Five Sharing (5)';
    if (o.includes('six') || o === '6' || o === '6 sharing') return 'Six Sharing (6)';
    if (o.includes('studio')) return 'Studio';
    return occupancy;
}

// ── Alert Banner ──
function AlertBanner({ type, message, actionLabel, onAction }: { type: 'error' | 'warning' | 'info' | 'brand'; message: string; actionLabel?: string; onAction?: () => void }) {
    const bgColor = type === 'error' ? 'bg-rose-50 border-rose-200'
        : type === 'warning' ? 'bg-amber-50 border-amber-200'
        : type === 'brand' ? 'bg-indigo-50 border-indigo-200 shadow-indigo-100/50'
        : 'bg-blue-50 border-blue-200';
        
    const textColor = type === 'error' ? 'text-rose-800'
        : type === 'warning' ? 'text-amber-800'
        : type === 'brand' ? 'text-indigo-900 font-bold'
        : 'text-blue-800';
        
    const Icon = type === 'brand' ? CreditCard : type === 'error' ? AlertTriangle : type === 'warning' ? AlertTriangle : Shield;

    return (
        <div className={`flex items-center justify-between p-4 rounded-xl border-2 shadow-md mb-4 animate-in fade-in slide-in-from-top-2 duration-500 transition-all ${bgColor} ${textColor}`}>
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${type === 'brand' ? 'bg-indigo-100/80 text-indigo-700' : type === 'error' ? 'bg-rose-100 text-rose-700' : type === 'warning' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-500">Action Required</p>
                    <p className="text-xs font-bold mt-0.5">{message}</p>
                </div>
            </div>
            {actionLabel && (
                <Button size="sm" onClick={onAction} className={`rounded-xl px-4 py-2 font-black transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                    type === 'brand' ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200' :
                    type === 'error' ? 'bg-rose-600 hover:bg-rose-700 text-white' : 
                    type === 'warning' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 
                    'bg-blue-600 hover:bg-blue-700 text-white'
                } text-xs ml-4 shrink-0`}>
                    {actionLabel}
                </Button>
            )}
        </div>
    );
}

// ── Token Payment Countdown Banner (Note 4) ──────────────────────────────────
// Live ticking countdown. Turns red in last 6 hours. Auto-hides when paid.
function TokenCountdownBanner({
    deadline,
    bookingId,
    roomAssigned,
    tokenAmount = 1000,
}: {
    deadline: string | Date;
    bookingId: string;
    roomAssigned: string;
    tokenAmount?: number;
}) {
    const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0, expired: false });
    const router = typeof window !== 'undefined' ? undefined : null; // SSR guard handled below

    function calcRemaining() {
        const diffMs = new Date(deadline).getTime() - Date.now();
        if (diffMs <= 0) return { h: 0, m: 0, s: 0, expired: true };
        const totalSec = Math.floor(diffMs / 1000);
        return {
            h: Math.floor(totalSec / 3600),
            m: Math.floor((totalSec % 3600) / 60),
            s: totalSec % 60,
            expired: false,
        };
    }

    useEffect(() => {
        setTimeLeft(calcRemaining());
        const id = setInterval(() => setTimeLeft(calcRemaining()), 1000);
        return () => clearInterval(id);
    }, [deadline]);

    const totalHoursLeft = timeLeft.h + timeLeft.m / 60;
    const isCritical = totalHoursLeft < 6;
    const isWarning = totalHoursLeft < 24;

    if (timeLeft.expired) {
        return (
            <div className="w-full bg-red-100 border-2 border-red-500 rounded-2xl p-4 text-center">
                <p className="text-sm font-black text-red-700">⛔ Payment window expired. Your booking is being cancelled automatically.</p>
            </div>
        );
    }

    return (
        <div
            className={`w-full rounded-2xl p-5 space-y-4 border-2 ${
                isCritical
                    ? 'bg-gradient-to-br from-red-50 to-rose-100 border-red-500 shadow-lg shadow-red-200'
                    : isWarning
                    ? 'bg-gradient-to-br from-amber-50 to-orange-100 border-orange-400'
                    : 'bg-gradient-to-br from-amber-50 to-orange-50 border-orange-400'
            }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <Lock className={`h-4 w-4 ${isCritical ? 'text-red-600' : 'text-orange-700'}`} />
                    <span className={`text-sm font-black ${isCritical ? 'text-red-800' : 'text-orange-800'}`}>
                        🔒 Pay Token to Reserve Bed - {isCritical ? '⚠️ URGENT' : 'Time Limited'}
                    </span>
                </div>
                {isCritical && (
                    <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full animate-pulse">
                        🚨 CRITICAL
                    </span>
                )}
            </div>

            {/* Live Countdown Clock */}
            <div
                className={`flex items-center justify-center gap-3 rounded-xl py-4 border-2 ${
                    isCritical ? 'bg-red-50 border-red-300' : 'bg-white/80 border-orange-200'
                }`}
            >
                <Clock className={`h-5 w-5 ${isCritical ? 'text-red-500 animate-spin' : 'text-orange-500'}`} style={{ animationDuration: '2s' }} />
                {/* Hours */}
                <div className="text-center">
                    <div className={`text-3xl font-black tabular-nums ${ isCritical ? 'text-red-700' : 'text-orange-800'}`}>
                        {String(timeLeft.h).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">HRS</div>
                </div>
                <span className={`text-2xl font-black ${isCritical ? 'text-red-500 animate-pulse' : 'text-orange-400'}`}>:</span>
                {/* Minutes */}
                <div className="text-center">
                    <div className={`text-3xl font-black tabular-nums ${ isCritical ? 'text-red-700' : 'text-orange-800'}`}>
                        {String(timeLeft.m).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">MIN</div>
                </div>
                <span className={`text-2xl font-black ${isCritical ? 'text-red-500 animate-pulse' : 'text-orange-400'}`}>:</span>
                {/* Seconds */}
                <div className="text-center">
                    <div className={`text-3xl font-black tabular-nums ${ isCritical ? 'text-red-700 animate-pulse' : 'text-orange-700'}`}>
                        {String(timeLeft.s).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">SEC</div>
                </div>
            </div>

            {/* Room & amount info */}
            <div className={`rounded-xl p-3 border flex justify-between items-center ${
                isCritical ? 'bg-white/80 border-red-200' : 'bg-white/80 border-orange-200'
            }`}>
                <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Room Allocated</span>
                    <p className="text-xs font-black text-slate-800">{roomAssigned}</p>
                </div>
                <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Token Amount</span>
                    <p className="text-sm font-black text-slate-900">₹{tokenAmount.toLocaleString()}</p>
                </div>
            </div>

            {/* Warning text */}
            <p className={`text-[11px] font-bold text-center ${ isCritical ? 'text-red-700' : 'text-orange-700'}`}>
                {isCritical
                    ? '⚠️ Less than 6 hours left! If not paid in time, your booking will be auto-cancelled and the bed released.'
                    : '⏰ Your bed is temporarily held. Pay the token before the countdown ends to confirm your reservation.'}
            </p>

            {/* CTA */}
            <a href={`/secure/payment?id=${bookingId}&type=token`}>
                <Button
                    className={`w-full font-black h-12 rounded-2xl text-white shadow-md ${
                        isCritical
                            ? 'bg-red-600 hover:bg-red-700 shadow-red-300 animate-pulse'
                            : 'bg-orange-500 hover:bg-orange-600 shadow-orange-200'
                    }`}
                >
                    💳 Pay ₹{tokenAmount.toLocaleString()} Token Now
                </Button>
            </a>
        </div>
    );
}

// ── Section 6A & 7A - Food Management (Student) ──
function FoodToggleSection({ booking, onRefresh }: { booking: any; onRefresh: () => void }) {
    const [foodEnabled, setFoodEnabled] = useState<boolean>(booking.foodSelected ?? false);
    const [changing, setChanging] = useState(false);
    const [lastChanged, setLastChanged] = useState<string | null>(null);

    const handleToggle = async () => {
        const newVal = !foodEnabled;
        const label = newVal ? 'enable' : 'disable';
        toast(`${label === 'enable' ? '🍴 Enable' : '🚫 Disable'} food service?`, {
            description: 'Change takes effect from the 1st of next month.',
            action: {
                label: 'Confirm',
                onClick: async () => {
                    setChanging(true);
                    const result = await changeFoodPreference(booking.id, newVal);
                    if (result.success) {
                        setFoodEnabled(newVal);
                        setLastChanged(result.effectiveFrom || '');
                        toast.success(`Food service ${label}d successfully!`);
                        await onRefresh();
                    } else {
                        toast.error(result.error || 'Failed to change food preference.');
                    }
                    setChanging(false);
                },
            },
        });
    };

    return (
        <div className="mt-3 p-3 rounded-xl border-2 bg-orange-50 border-orange-200 space-y-2">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-black text-orange-700">🍴 Food Service (Optional)</p>
                    <p className="text-[10px] text-orange-600">
                        ₹{booking.property?.foodPricePerMonth?.toLocaleString()}/month
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${foodEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {foodEnabled ? '✅ Active' : '🚫 Inactive'}
                    </span>
                    <button
                        type="button"
                        disabled={changing}
                        onClick={handleToggle}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${foodEnabled ? 'bg-green-500' : 'bg-slate-300'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${foodEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>
            {lastChanged && (
                <p className="text-[10px] text-orange-600 italic font-bold animate-in fade-in duration-300">
                    ✅ Change saved! Effective from: {lastChanged}
                </p>
            )}
            <p className="text-[10px] text-slate-400">Changes apply from the 1st of next month.</p>
        </div>
    );
}

// ── Booking Card Component ──
function BookingCard({ 
    booking, 
    router, 
    fetchData, 
    setSigningBooking, 
    setSelectedBooking, 
    setViewingDoc, 
    setExpandedDocs, 
    expandedDocs,
    setDismissedSharingAlert,
    dismissedSharingAlert,
    handleCancel,
    cancellingId,
    isActiveStay = false
}: any) {
    const isKycPending = booking.status === 'KYC_PENDING' || booking.status === 'APPROVED_KYC_PENDING' || booking.status === 'KYC_FAILED';
    const isCashPending = booking.paymentStatus === 'CASH_PENDING' && booking.paymentMethod === 'CASH' && booking.status === 'APPROVED';
    const isTokenPending = booking.status === 'APPROVED_PENDING_TOKEN';
    const isTokenPaid = booking.status === 'ROOM_RESERVED';
    const isPhysicalVerified = booking.status === 'PHYSICAL_VERIFIED'; // NEW: KYC done, Tenant ID assigned, ready to sign agreement
    const isFinalPaymentPending = booking.status === 'MOVE_IN_SCHEDULED' || booking.status === 'BOOKING_CONFIRMED';
    const isPaymentPending = isTokenPending || (booking.status === 'APPROVED' || booking.status === 'APPROVED_KYC_PENDING' || booking.status === 'KYC_PENDING') && !!booking.roomAssigned && !isCashPending;
    const isAgreementPending = booking.status === 'AGREEMENT_PENDING';
    const isApproved = isKycPending || isPaymentPending || isAgreementPending || isCashPending || isTokenPending || isTokenPaid || isPhysicalVerified;
    const isCheckedIn = booking.status === 'CHECKED_IN' || booking.status === 'ACTIVE' || booking.status === 'CHECKIN_CONFIRMED';
    const isPaid = (booking.status === 'PAID' || booking.status === 'CASH_PAID') && !isCheckedIn;
    const isActive = booking.status === 'ACTIVE' || booking.status === 'CHECKED_IN' || booking.status === 'CHECKIN_CONFIRMED';
    const isVacating = booking.status === 'VACATING';
    const isCompleted = booking.status === 'COMPLETED' || booking.status === 'CHECKED_OUT';
    const isCancelled = booking.status === 'CANCELLED' || booking.status === 'EXPIRED';
    const hasPendingAmount = (isPaid || isPaymentPending) && booking.pendingAmount && parseFloat(booking.pendingAmount) > 0;
    // tenantId is populated on the booking after physical check-in
    const tenantDisplayId = booking.tenantDisplayId || booking.tenant?.displayId || null;
    const userDisplayId = booking.userDisplayId || null;
    const [showVacatedModal, setShowVacatedModal] = useState(false);

    return (
        <Card key={booking.id} className={`${isActiveStay ? "border-emerald-500 border-2 shadow-lg shadow-emerald-100/50" : isApproved ? "border-green-400 border-2" : isPaid ? "border-blue-300 border-2" : hasPendingAmount ? "border-red-400 border-2" : isCancelled ? "border-gray-300 opacity-70" : ""}`}>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1"><Building2 className="h-3 w-3" /> Property</div>
                        <CardTitle className="flex items-center gap-2">{booking.propertyName}</CardTitle>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mt-2"><User className="h-3 w-3" /> Guest: <span className="text-foreground font-bold">{booking.guestName}</span></div>
                        <CardDescription className="mt-1">
                            Ref: {booking.displayId} &bull; {new Date(booking.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                            {booking.occupancy && (
                                <span className="ml-2 inline-flex items-center gap-1 bg-violet-100 text-violet-700 border border-violet-200 text-[10px] font-black px-2 py-0.5 rounded-full">
                                    🛏️ {formatOccupancy(booking.occupancy)}
                                </span>
                            )}
                        </CardDescription>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : isVacating ? 'bg-orange-100 text-orange-700 border-orange-300' : isCompleted ? 'bg-slate-100 text-slate-600 border-slate-300' : isCancelled ? 'bg-gray-100 text-gray-500 border-gray-300' : isPaid ? 'bg-blue-100 text-blue-700 border-blue-300' : isApproved ? 'bg-violet-100 text-violet-700 border-violet-300' : 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                            {booking.status.replace(/_/g, ' ')}
                        </span>
                        {isCompleted && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500">
                                    🏠 Vacated{booking.updatedAt ? ` • ${new Date(booking.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                                </span>
                                <button
                                    onClick={() => setShowVacatedModal(true)}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition-all shadow-md shadow-indigo-200"
                                >
                                    <FileText className="h-3.5 w-3.5" /> View Details
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* ── Status Badge ── */}
                {!isCompleted && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">Stage:</span>
                    {(booking.status === "APPLIED" || booking.status === "PENDING_APPROVAL") && <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded">Waiting for Approval</span>}
                    {isKycPending && <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded">KYC - Bring Docs at Check-In</span>}
                    {isTokenPending && <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded animate-pulse">Token Payment Pending</span>}
                    {isTokenPaid && !isPhysicalVerified && <span className="bg-teal-100 text-teal-800 text-xs font-bold px-2 py-1 rounded">Token Paid - Visit Property with Docs</span>}
                    {isPhysicalVerified && <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded animate-pulse">ID Verified - Sign Agreement Now</span>}
                    {isPaymentPending && !isTokenPending && <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded">Payment Pending</span>}
                    {isAgreementPending && <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded">Signed - Awaiting Owner Countersign</span>}
                    {isFinalPaymentPending && <span className="bg-red-100 text-red-800 text-xs font-black px-2 py-1 rounded animate-pulse">Final Payment Due - Pay Now</span>}
                    {isPaid && !booking.agreementSigned && <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded">Sign Agreement</span>}
                    {isPaid && booking.agreementSigned && <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded">Ready for Move-in</span>}
                    {isCheckedIn && <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">Checked-in & Active</span>}
                </div>
                )}
                {/* ── Permanent ID Badges (show after physical KYC and beyond) ── */}
                {(isPhysicalVerified || isAgreementPending || isFinalPaymentPending || isPaid || isCheckedIn || isActive || isCompleted) && (tenantDisplayId || booking.displayId) && (
                    <div className="flex flex-wrap gap-2">
                        {booking.displayId && (
                            <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black px-2.5 py-1 rounded-full font-mono">
                                🔖 Booking: {booking.displayId}
                            </span>
                        )}
                        {tenantDisplayId && (
                            <span className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full font-mono">
                                🪪 Tenant ID: {tenantDisplayId}
                            </span>
                        )}
                    </div>
                )}

                {/* ── Payment Cards ── */}
                {isTokenPending && booking.roomAssigned && (
                    <TokenCountdownBanner
                        deadline={booking.tokenDeadline || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()}
                        bookingId={booking.id}
                        roomAssigned={booking.roomAssigned}
                        tokenAmount={booking.tokenAmount || 1000}
                    />
                )}

                {isTokenPaid && (
                    <div className="space-y-3">
                        <div className="w-full bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-4 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-black text-green-800">✅ Token Payment Confirmed</p>
                                <p className="text-xs text-green-700 mt-0.5">₹1,000 paid on {booking.paidAt ? new Date(booking.paidAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'N/A'}</p>
                            </div>
                            <Button size="sm" variant="outline" className="border-green-400 text-green-700 hover:bg-green-100 font-black text-xs" onClick={() => {
                                setViewingDoc({ type: 'token', data: {
                                    bookingDisplayId: booking.displayId,
                                    tenantName: booking.guestName,
                                    tenantEmail: booking.guestEmail || undefined,
                                    propertyName: booking.propertyName,
                                    roomAssigned: booking.roomAssigned || '-',
                                    tokenAmount: 1000,
                                    paidAt: booking.paidAt ? new Date(booking.paidAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '-',
                                    paymentMethod: booking.paymentMethod || 'Online',
                                    paymentId: booking.paymentId || undefined,
                                }});
                            }}>
                                <FileText className="h-3 w-3 mr-1" /> View Receipt
                            </Button>
                        </div>
                        {/* ROOM_RESERVED → Physical Check-In Pending (agreement locked until owner confirms physical checkin) */}
                        {!booking.tenantId && isTokenPaid && (
                            <div className="w-full bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-400 rounded-2xl p-5 space-y-3">
                                <div className="flex items-center gap-2 text-sm font-black text-amber-800">
                                    <Lock className="h-4 w-4" />
                                    🏠 Physical Check-In Pending
                                </div>
                                <p className="text-xs text-amber-700 font-medium">Your token is paid and bed is reserved. To proceed, you must <strong>physically visit {booking.propertyName}</strong> and complete your in-person check-in.</p>
                                <div className="bg-amber-100/60 rounded-xl p-3 text-[11px] text-amber-900 font-bold border border-amber-300 space-y-1">
                                    <p>📌 Physically visit <strong>{booking.propertyName}</strong> to check in.</p>
                                    <p className="font-medium text-amber-700">Once the owner or their team confirms your physical check-in, your rental agreement will be automatically unlocked for signing.</p>
                                </div>
                                <div className="flex items-center gap-2 bg-white/80 border-2 border-amber-300 rounded-xl p-3">
                                    <Lock className="h-4 w-4 text-amber-500 shrink-0" />
                                    <p className="text-[11px] font-black text-amber-700">Agreement is locked until physical check-in is confirmed by the owner.</p>
                                </div>
                            </div>
                        )}
                        {/* PHYSICAL_VERIFIED - Tenant ID assigned, agreement unlocked, prompt to sign */}
                        {isPhysicalVerified && !booking.agreementSigned && (
                            <div className="w-full bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-500 rounded-2xl p-5 space-y-3 animate-pulse">
                                <div className="flex items-center gap-2 text-sm font-black text-emerald-800">
                                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping mr-1"></span>
                                    ✅ Physical Check-In Confirmed - Sign Your Agreement
                                </div>
                                <p className="text-xs text-emerald-700 font-medium">Your physical check-in at <strong>{booking.propertyName}</strong> has been confirmed by the owner! Your Tenant ID is now assigned. Sign the rental agreement to complete onboarding.</p>
                                {tenantDisplayId && (
                                    <div className="flex items-center gap-2 bg-white/80 border border-emerald-200 rounded-xl p-3">
                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Your Tenant ID:</span>
                                        <span className="font-mono font-black text-emerald-900 text-sm">{tenantDisplayId}</span>
                                    </div>
                                )}
                                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black h-12 rounded-2xl" onClick={() => setSigningBooking(booking)}>
                                    ✍️ Sign Agreement Now
                                </Button>
                            </div>
                        )}
                        {booking.agreementSigned && (
                            <div className="w-full bg-purple-50 border-2 border-purple-300 rounded-2xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-black text-purple-800">✍️ Agreement Signed</p>
                                        <p className="text-xs text-purple-600 mt-0.5">Waiting for owner countersignature.</p>
                                    </div>
                                    <Button size="sm" variant="outline" className="border-purple-400 text-purple-700 hover:bg-purple-100 font-black text-xs shrink-0" onClick={() => {
                                        setViewingDoc({ type: 'agreement', data: {
                                            agreementId: booking.agreementId || `AGT-${booking.displayId}`,
                                            bookingDisplayId: booking.displayId,
                                            tenantName: booking.guestName,
                                            tenantEmail: booking.guestEmail || undefined,
                                            propertyName: booking.propertyName,
                                            propertyAddress: booking.propertyAddress || '',
                                            propertyCity: booking.propertyCity || '',
                                            roomAssigned: booking.roomAssigned || '-',
                                            occupancy: booking.occupancy || '',
                                            monthlyRent: Number(booking.amount || 0),
                                            depositAmount: Number(booking.depositAmount || 0),
                                            depositMonths: Number(booking.depositMonths || 1),
                                            moveInDate: booking.onboardingDate || booking.moveInDate || '-',
                                            signedAt: booking.agreementSignedAt ? new Date(booking.agreementSignedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-',
                                            signedIp: booking.agreementSignedIp || undefined,
                                            signedDevice: booking.agreementSignedDevice || undefined,
                                            agreementVersion: booking.agreementVersion || 'v1.0-2026',
                                            tenantDisplayId: tenantDisplayId || undefined,
                                            userDisplayId: userDisplayId || undefined,
                                            propertyDisplayId: booking.propertyDisplayId || undefined,
                                        }});
                                    }}>
                                        <FileText className="h-3 w-3 mr-1" /> View Agreement
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {isFinalPaymentPending && (
                    <div className="w-full bg-gradient-to-br from-indigo-50/60 via-violet-50/40 to-white border-2 border-indigo-200 rounded-3xl p-6 space-y-4 shadow-md shadow-indigo-50/30 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-100/40">
                        <div className="flex items-center gap-2">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping shrink-0" />
                            <p className="text-sm font-black text-indigo-900 uppercase tracking-wider">⚡ Final Payment Due - Action Required</p>
                        </div>
                        <p className="text-xs text-slate-600 font-medium">Agreement confirmed! Pay the joining balance to activate your stay at <strong>{booking.propertyName}</strong>.</p>
                        {/* Physical presence notice */}
                        <div className="bg-white border border-indigo-100 rounded-2xl p-4 space-y-1.5 shadow-sm">
                            <p className="text-[11px] font-black text-indigo-900 uppercase tracking-widest flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-indigo-600" /> Important - Physical Presence Required
                            </p>
                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                To complete your joining, you must be <strong>physically present at the PG address</strong> when making this payment. Our staff will verify your identity on-site.
                                This step prevents fraud and ensures your booking is secure.
                            </p>
                            {booking.propertyAddress && (
                                <p className="text-[11px] font-bold text-slate-700 mt-1.5 pt-1.5 border-t border-slate-50">📌 Address: {booking.propertyAddress}{booking.propertyCity ? `, ${booking.propertyCity}` : ''}</p>
                            )}
                        </div>
                        {(() => {
                            const rentAmount = Number(booking.amount || 0);
                            const depositAmount = Number(booking.depositAmount || 0);
                            
                            let moveInDateObj = new Date();
                            if (booking.onboardingDate) {
                                const d = new Date(booking.onboardingDate);
                                if (!isNaN(d.getTime())) moveInDateObj = d;
                            } else if (booking.moveInDate) {
                                const d = new Date(booking.moveInDate);
                                if (!isNaN(d.getTime())) moveInDateObj = d;
                            }
                            
                            const daysInThisMonth = new Date(moveInDateObj.getFullYear(), moveInDateObj.getMonth() + 1, 0).getDate();
                            const daysRemaining = daysInThisMonth - moveInDateObj.getDate() + 1;
                            const dailyRate = Math.round((rentAmount / daysInThisMonth) * 100) / 100;
                            const proratedRent = Math.round(dailyRate * daysRemaining);
                            const isFirstOfMonth = moveInDateObj.getDate() === 1;
                            const effectiveRent = isFirstOfMonth ? rentAmount : proratedRent;
                            const monthName = moveInDateObj.toLocaleString('en-IN', { month: 'long' });
                            const lastDayLabel = `${daysInThisMonth} ${monthName}`;
                            const moveInLabel  = `${moveInDateObj.getDate()} ${monthName}`;
                            
                            const subtotal = effectiveRent + depositAmount;
                            const balance = Math.max(0, subtotal - 1000);
                            
                            return (
                                <div className="space-y-2 text-sm bg-white/80 rounded-2xl p-5 border border-indigo-100">
                                    <div className="flex justify-between items-start text-slate-600">
                                        <div>
                                            <span className="font-semibold">🏠 Rent - {isFirstOfMonth ? monthName : `${moveInLabel} to ${lastDayLabel}`}</span>
                                            {!isFirstOfMonth && (
                                                <p className="text-[10px] text-slate-400 mt-0.5">
                                                    {daysRemaining} days �- ₹{dailyRate.toFixed(0)}/day (₹{rentAmount.toLocaleString('en-IN')}/mo)
                                                </p>
                                            )}
                                        </div>
                                        <span className="font-black text-slate-800">₹{effectiveRent.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                        <span className="font-semibold text-emerald-700">🛡️ Security Deposit ({(booking as any).depositMonths || 2}m)</span>
                                        <span className="font-black text-emerald-700">₹{depositAmount.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t border-dashed border-slate-200 font-bold text-slate-500">
                                        <span>Subtotal</span>
                                        <span className="font-bold text-slate-700">₹{subtotal.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between text-indigo-600 font-bold">
                                        <span>🎟️ Token Paid Already</span>
                                        <span>- ₹1,000</span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t border-indigo-200 font-black text-indigo-900 text-base">
                                        <span>💰 Balance Due</span>
                                        <span className="text-lg text-indigo-700">₹{balance.toLocaleString('en-IN')}</span>
                                    </div>
                                    {booking.agreementSigned ? (
                                        <Button className="w-full mt-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-black h-12 rounded-2xl text-base shadow-lg shadow-indigo-200/50 transition-all active:scale-[0.99]" onClick={() => router.push(`/secure/payment?id=${booking.id}`)}>
                                            💳 Pay ₹{balance.toLocaleString('en-IN')} Now
                                        </Button>
                                    ) : (
                                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                                            <p className="text-xs font-bold text-amber-800 flex items-start gap-1">
                                                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                                                <span>Mandatory: Please review and verify the final physically signed agreement uploaded by the property management before making this payment.</span>
                                            </p>
                                            <Button 
                                                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-10 rounded-xl text-sm"
                                                onClick={() => router.push('/dashboard/student/agreements')}
                                            >
                                                Verify Uploaded Agreement
                                            </Button>
                                        </div>
                                    )}
                                    <p className="text-[10px] text-center text-slate-400 pt-1.5">⚠️ Visit {booking.propertyName} in person to complete check-in</p>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {isPaymentPending && !isTokenPending && !isFinalPaymentPending && booking.roomAssigned && (
                    <div className="w-full bg-slate-50 border-2 border-slate-300 rounded-2xl p-5 space-y-4">
                        <p className="text-sm font-black text-slate-800">💳 Payment Due</p>
                        <div className="flex justify-between font-bold"><span>Total Amount</span><span>₹{(Number(booking.amount || 0) + Number(booking.depositAmount || 0)).toLocaleString('en-IN')}</span></div>
                        <Button className="w-full bg-slate-900 text-white font-black h-12 rounded-2xl" onClick={() => router.push(`/secure/payment?id=${booking.id}`)}>💳 Pay Now</Button>
                    </div>
                )}

                {(isPaymentPending || isPaid || isApproved) && booking.roomAssigned && (
                    <div className="rounded-2xl border-2 p-4 bg-indigo-50 border-indigo-300 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-black text-indigo-800"><BedDouble className="h-4 w-4" /> 🏠 Allocated Room</div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white p-3 rounded-xl text-center"><p className="text-[10px] font-black text-slate-500 uppercase">Room No.</p><p className="text-sm font-black text-indigo-900">{booking.roomAssigned.split(' - ')[0].trim()}</p></div>
                            <div className="bg-white p-3 rounded-xl text-center"><p className="text-[10px] font-black text-slate-500 uppercase">Type</p><p className="text-sm font-black text-indigo-900">{booking.occupancy}</p></div>
                            <div className="bg-white p-3 rounded-xl text-center"><p className="text-[10px] font-black text-slate-500 uppercase">Bed</p><p className="text-sm font-black text-indigo-900">{booking.roomAssigned.includes(' - ') ? booking.roomAssigned.split(' - ')[1]?.replace('Bed ', '').trim() : '-'}</p></div>
                        </div>
                    </div>
                )}

                {!isCancelled && !isCompleted && booking.status !== "REJECTED" && (
                    <div className="py-4 border-y border-slate-100 my-4 bg-slate-50/50 rounded-xl px-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Booking Progress</p>
                        <BookingTimeline booking={booking} />
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2">
                    {(isPaid || isCheckedIn || isActive || isVacating || isCompleted) && (
                        <Button variant="outline" size="sm" className="text-xs h-8 rounded-full" onClick={() => setSelectedBooking(booking)}><FileText className="h-3.5 w-3.5 mr-1" /> Rent Receipt</Button>
                    )}
                    {booking.tokenPaidAt && (isTokenPaid || isPhysicalVerified || isAgreementPending || isPaid || isCheckedIn || isActive || isVacating || isCompleted) && (
                        <Button variant="outline" size="sm" className="text-xs h-8 rounded-full border-green-300 text-green-700 hover:bg-green-50" onClick={() => {
                            setViewingDoc({ type: 'token', data: {
                                bookingDisplayId: booking.displayId,
                                tenantName: booking.guestName,
                                tenantEmail: booking.guestEmail || undefined,
                                propertyName: booking.propertyName,
                                roomAssigned: booking.roomAssigned || '-',
                                tokenAmount: booking.tokenAmount || 1000,
                                paidAt: booking.tokenPaidAt ? new Date(booking.tokenPaidAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '-',
                                paymentMethod: booking.paymentMethod || 'Online',
                                paymentId: booking.tokenPaymentId || undefined,
                            }});
                        }}><FileText className="h-3.5 w-3.5 mr-1" /> Token Receipt</Button>
                    )}
                    {booking.agreementSigned && (
                        <Button variant="outline" size="sm" className="text-xs h-8 rounded-full border-purple-300 text-purple-700 hover:bg-purple-50" onClick={() => {
                            setViewingDoc({ type: 'agreement', data: {
                                agreementId: booking.agreementId || `AGT-${booking.displayId}`,
                                bookingDisplayId: booking.displayId,
                                tenantName: booking.guestName,
                                tenantEmail: booking.guestEmail || undefined,
                                propertyName: booking.propertyName,
                                propertyAddress: booking.propertyAddress || '',
                                propertyCity: booking.propertyCity || '',
                                roomAssigned: booking.roomAssigned || '-',
                                occupancy: booking.occupancy || '',
                                monthlyRent: Number(booking.amount || 0),
                                depositAmount: Number(booking.depositAmount || 0),
                                depositMonths: Number(booking.depositMonths || 1),
                                moveInDate: booking.onboardingDate || booking.moveInDate || '-',
                                signedAt: booking.agreementSignedAt ? new Date(booking.agreementSignedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-',
                                signedIp: booking.agreementSignedIp || undefined,
                                signedDevice: booking.agreementSignedDevice || undefined,
                                agreementVersion: booking.agreementVersion || 'v1.0-2026',
                                tenantDisplayId: tenantDisplayId || undefined,
                                userDisplayId: userDisplayId || undefined,
                                propertyDisplayId: booking.propertyDisplayId || undefined,
                            }});
                        }}><FileText className="h-3.5 w-3.5 mr-1" /> View Agreement</Button>
                    )}
                    {(isActive || isCheckedIn || isCompleted) && booking.paidAt && (
                        <Button variant="outline" size="sm" className="text-xs h-8 rounded-full border-indigo-300 text-indigo-700 hover:bg-indigo-50" onClick={() => {
                            setViewingDoc({ type: 'payment', data: {
                                bookingDisplayId: booking.displayId,
                                tenantName: booking.guestName,
                                tenantEmail: booking.guestEmail || undefined,
                                propertyName: booking.propertyName,
                                roomAssigned: booking.roomAssigned || '-',
                                monthlyRent: Number(booking.amount || 0),
                                depositAmount: Number(booking.depositAmount || 0),
                                depositMonths: Number(booking.depositMonths || 1),
                                tokenAlreadyPaid: 1000,
                                finalAmountPaid: Math.max(0, Number(booking.amount || 0) + Number(booking.depositAmount || 0) - 1000),
                                paidAt: booking.paidAt ? new Date(booking.paidAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '-',
                                paymentMethod: booking.paymentMethod || 'Online',
                                paymentId: booking.paymentId || undefined,
                            }});
                        }}><FileText className="h-3.5 w-3.5 mr-1" /> Payment Receipt</Button>
                    )}
                    {!booking.agreementSigned && (isAgreementPending || (isPaid && !booking.agreementSigned)) && (
                        <Button size="sm" className="h-8 px-3 text-xs bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-full" onClick={() => setSigningBooking(booking)}>✍️ Sign Agreement</Button>
                    )}

                    {!isActive && !isVacating && !isCompleted && !isCancelled && booking.status !== 'REJECTED' && (
                        <button onClick={() => handleCancel(booking.id)} disabled={cancellingId === booking.id} className="h-8 px-4 text-[10px] font-black bg-red-600 text-white rounded-full uppercase tracking-wider">{cancellingId === booking.id ? '...' : '✖ Cancel'}</button>
                    )}
                </div>

                {expandedDocs === booking.id && (
                    <div className="mt-4 p-4 bg-amber-50 rounded-2xl border-2 border-dashed border-amber-300 space-y-3 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">📋</span>
                            <div>
                                <p className="text-sm font-black text-amber-900">No Online Upload Required</p>
                                <p className="text-xs text-amber-700">KYC is verified in-person when you visit the property.</p>
                            </div>
                        </div>
                        <div className="bg-white border border-amber-200 rounded-xl p-3 space-y-1.5">
                            <p className="text-[11px] font-black text-slate-600 uppercase tracking-wider">📌 Bring These at Check-In:</p>
                            {['🪪 Government Photo ID (Aadhaar / Passport / Voter ID)', '🏠 Address Proof (Aadhaar / Utility Bill)', '🎓 College ID / Offer Letter / Employee ID', '📸 2 Passport-size Photographs'].map((item) => (
                                <p key={item} className="text-xs text-slate-600 flex items-start gap-1.5">
                                    <CheckCircle className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                                    {item}
                                </p>
                            ))}
                        </div>
                        <p className="text-[10px] text-amber-600 font-medium text-center">Our staff will verify your originals on-site and activate your Tenant ID instantly.</p>
                    </div>
                )}

                {/* ── Vacated / Completed: View Details Modal ── */}
                {showVacatedModal && isCompleted && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                                <div>
                                    <h2 className="font-black text-slate-900 text-lg">Past Booking Details</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">{booking.propertyName} • {booking.displayId}</p>
                                </div>
                                <button onClick={() => setShowVacatedModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                                    <X className="h-5 w-5 text-slate-500" />
                                </button>
                            </div>

                            <div className="overflow-y-auto flex-1 p-5 space-y-5">
                                {/* Vacated status chip */}
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 border border-slate-300 text-xs font-black px-3 py-1.5 rounded-full">
                                        🏠 Vacated{booking.updatedAt ? ` • ${new Date(booking.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                                    </span>
                                </div>

                                {/* Booking Progress Timeline */}
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Booking Progress</p>
                                    <BookingTimeline booking={booking} vacated={true} />
                                </div>

                                {/* Documents */}
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Documents</p>
                                    <div className="flex flex-wrap gap-2">
                                        {(isPaid || isCheckedIn || isActive || isVacating || isCompleted) && (
                                            <Button variant="outline" size="sm" className="text-xs h-8 rounded-full" onClick={() => { setShowVacatedModal(false); setSelectedBooking(booking); }}>
                                                <FileText className="h-3.5 w-3.5 mr-1" /> Rent Receipt
                                            </Button>
                                        )}
                                        {booking.tokenPaidAt && (
                                            <Button variant="outline" size="sm" className="text-xs h-8 rounded-full border-green-300 text-green-700 hover:bg-green-50" onClick={() => {
                                                setShowVacatedModal(false);
                                                setViewingDoc({ type: 'token', data: {
                                                    bookingDisplayId: booking.displayId,
                                                    tenantName: booking.guestName,
                                                    tenantEmail: booking.guestEmail || undefined,
                                                    propertyName: booking.propertyName,
                                                    roomAssigned: booking.roomAssigned || '-',
                                                    tokenAmount: booking.tokenAmount || 1000,
                                                    paidAt: booking.tokenPaidAt ? new Date(booking.tokenPaidAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '-',
                                                    paymentMethod: booking.paymentMethod || 'Online',
                                                    paymentId: booking.tokenPaymentId || undefined,
                                                }});
                                            }}><FileText className="h-3.5 w-3.5 mr-1" /> Token Receipt</Button>
                                        )}
                                        {booking.agreementSigned && (
                                            <Button variant="outline" size="sm" className="text-xs h-8 rounded-full border-purple-300 text-purple-700 hover:bg-purple-50" onClick={() => {
                                                setShowVacatedModal(false);
                                                setViewingDoc({ type: 'agreement', data: {
                                                    agreementId: booking.agreementId || `AGT-${booking.displayId}`,
                                                    bookingDisplayId: booking.displayId,
                                                    tenantName: booking.guestName,
                                                    tenantEmail: booking.guestEmail || undefined,
                                                    propertyName: booking.propertyName,
                                                    propertyAddress: booking.propertyAddress || '',
                                                    propertyCity: booking.propertyCity || '',
                                                    roomAssigned: booking.roomAssigned || '-',
                                                    occupancy: booking.occupancy || '',
                                                    monthlyRent: Number(booking.amount || 0),
                                                    depositAmount: Number(booking.depositAmount || 0),
                                                    depositMonths: Number(booking.depositMonths || 1),
                                                    moveInDate: booking.onboardingDate || booking.moveInDate || '-',
                                                    signedAt: booking.agreementSignedAt ? new Date(booking.agreementSignedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-',
                                                    signedIp: booking.agreementSignedIp || undefined,
                                                    signedDevice: booking.agreementSignedDevice || undefined,
                                                    agreementVersion: booking.agreementVersion || 'v1.0-2026',
                                                    tenantDisplayId: tenantDisplayId || undefined,
                                                    userDisplayId: userDisplayId || undefined,
                                                    propertyDisplayId: booking.propertyDisplayId || undefined,
                                                }});
                                            }}><FileText className="h-3.5 w-3.5 mr-1" /> View Agreement</Button>
                                        )}
                                        {booking.paidAt && (
                                            <Button variant="outline" size="sm" className="text-xs h-8 rounded-full border-indigo-300 text-indigo-700 hover:bg-indigo-50" onClick={() => {
                                                setShowVacatedModal(false);
                                                setViewingDoc({ type: 'payment', data: {
                                                    bookingDisplayId: booking.displayId,
                                                    tenantName: booking.guestName,
                                                    tenantEmail: booking.guestEmail || undefined,
                                                    propertyName: booking.propertyName,
                                                    roomAssigned: booking.roomAssigned || '-',
                                                    monthlyRent: Number(booking.amount || 0),
                                                    depositAmount: Number(booking.depositAmount || 0),
                                                    depositMonths: Number(booking.depositMonths || 1),
                                                    tokenAlreadyPaid: 1000,
                                                    finalAmountPaid: Math.max(0, Number(booking.amount || 0) + Number(booking.depositAmount || 0) - 1000),
                                                    paidAt: booking.paidAt ? new Date(booking.paidAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '-',
                                                    paymentMethod: booking.paymentMethod || 'Online',
                                                    paymentId: booking.paymentId || undefined,
                                                }});
                                            }}><FileText className="h-3.5 w-3.5 mr-1" /> Payment Receipt</Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t border-slate-100 shrink-0">
                                <button onClick={() => setShowVacatedModal(false)} className="w-full py-3 bg-slate-100 text-slate-700 font-black text-sm rounded-2xl hover:bg-slate-200 transition-all">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function StudentDashboardPage() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
    const [reviewBooking, setReviewBooking] = useState<any | null>(null);
    const [expandedDocs, setExpandedDocs] = useState<string | null>(null);
    const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
    const [signingBooking, setSigningBooking] = useState<any | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [profile, setProfile] = useState<any>(null);
    const [vacatingId, setVacatingId] = useState<string | null>(null);
    const [upgradeRequest, setUpgradeRequest] = useState<any | null | undefined>(undefined);
    const [dismissedSharingAlert, setDismissedSharingAlert] = useState<string | null>(null);
    const [roomAllocNotifs, setRoomAllocNotifs] = useState<any[]>([]);
    const [viewingDoc, setViewingDoc] = useState<DocumentViewerDoc | null>(null);
    const [pendingRent, setPendingRent] = useState<any | null>(null);
    const [rentBannerDismissed, setRentBannerDismissed] = useState(false);

    // Profile Edit State
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profileForm, setProfileForm] = useState<any>({});
    const [savingProfile, setSavingProfile] = useState(false);

    const [cancelModal, setCancelModal] = useState<{ id: string; name: string } | null>(null);
    const [cancelReason, setCancelReason] = useState("");

    // Self-Service Email/Phone Edit State
    const [selfServiceModal, setSelfServiceModal] = useState<{
        open: boolean;
        type: 'email' | 'phone';
        step: 'send_old_otp' | 'verify_old_otp' | 'enter_new_target' | 'verify_new_otp';
        oldTarget: string;
        newTarget: string;
        oldOtpInput: string;
        newOtpInput: string;
        loading: boolean;
        errorMessage: string;
    } | null>(null);

    const searchParams = useSearchParams();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('bookings');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) {
            setActiveTab(tab);
        } else if (bookings.some((b: any) => ['ACTIVE', 'CHECKED_IN', 'CHECKIN_CONFIRMED'].includes(b.status))) {
            setActiveTab('active-stay');
        } else {
            setActiveTab('bookings');
        }
    }, [searchParams, bookings]);

    const onTabChange = (value: string) => {
        setActiveTab(value);
        router.push(`/dashboard/student?tab=${value}`);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const [bData, pData, profData, notifData, rentData] = await Promise.all([
                getBookings(),
                getStudentPaymentHistory(),
                getStudentProfile(),
                getPersistentNotifications(),
                getPendingRentInvoice(),
            ]);
            setBookings(bData);
            setPaymentHistory(pData);
            setProfile(profData);
            if (profData) {
                let contacts = [{ name: '', relation: '', phone: '' }, { name: '', relation: '', phone: '' }];
                try {
                    if (profData.emergencyContact) {
                        const parsed = JSON.parse(profData.emergencyContact);
                        if (Array.isArray(parsed)) {
                            if (parsed[0]) contacts[0] = { name: parsed[0].name || '', relation: parsed[0].relation || '', phone: parsed[0].phone || '' };
                            if (parsed[1]) contacts[1] = { name: parsed[1].name || '', relation: parsed[1].relation || '', phone: parsed[1].phone || '' };
                        }
                    }
                } catch (e) {
                    contacts[0] = { name: profData.emergencyContact || '', relation: 'Family', phone: '' };
                }

                setProfileForm({
                    dateOfBirth: profData.dateOfBirth || '',
                    gender: profData.gender || '',
                    nationality: profData.nationality || 'Indian',
                    nationalityOther: profData.nationality && profData.nationality !== 'Indian' ? profData.nationality : '',
                    emergencyContacts: contacts,
                    occupationType: profData.occupationType === 'Student' || profData.occupationType === 'Working Professional' ? profData.occupationType : (profData.occupationType ? 'Others' : ''),
                    occupationOther: profData.occupationType !== 'Student' && profData.occupationType !== 'Working Professional' ? profData.occupationType : '',
                    occupationDetail: profData.occupationDetail || ''
                });
            }
            setRoomAllocNotifs((notifData as any[]).filter((n: any) => n.category === 'ROOM_ALLOCATED'));
            setPendingRent(rentData);
            // Reset banner dismiss on every full refresh so it re-appears if still unpaid
            setRentBannerDismissed(false);
        } catch (e) {
            console.error(e);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSaveProfile = async () => {
        // Strict Validation
        if (!profileForm.dateOfBirth || !profileForm.gender || !profileForm.occupationType || !profileForm.occupationDetail) {
            toast.error("Please fill in all mandatory fields before saving.");
            return;
        }
        if (profileForm.nationality === 'Others' && !profileForm.nationalityOther) {
            toast.error("Please specify your nationality.");
            return;
        }
        if (profileForm.occupationType === 'Others' && !profileForm.occupationOther) {
            toast.error("Please specify your occupation.");
            return;
        }

        // Validate emergency contacts (Primary is mandatory, secondary is optional but must be complete if any field is filled)
        const contact1 = profileForm.emergencyContacts?.[0];
        if (!contact1 || !contact1.name || !contact1.relation || !contact1.phone) {
            toast.error("Please fill in all primary emergency contact details (Name, Relation, Phone).");
            return;
        }

        const contact2 = profileForm.emergencyContacts?.[1];
        if (contact2 && (contact2.name || contact2.relation || contact2.phone)) {
            if (!contact2.name || !contact2.relation || !contact2.phone) {
                toast.error("Please complete all details for the second emergency contact or leave it blank.");
                return;
            }
        }

        setSavingProfile(true);
        const toastId = toast.loading("Saving profile details...");
        try {
            const finalNationality = profileForm.nationality === 'Others' ? profileForm.nationalityOther : profileForm.nationality;
            const finalOccupation = profileForm.occupationType === 'Others' ? profileForm.occupationOther : profileForm.occupationType;
            const finalEmergency = JSON.stringify(profileForm.emergencyContacts.filter((c: any) => c.name && c.relation && c.phone));
            
            await updateStudentProfile({
                dateOfBirth: profileForm.dateOfBirth,
                gender: profileForm.gender,
                nationality: finalNationality,
                emergencyContact: finalEmergency,
                occupationType: finalOccupation,
                occupationDetail: profileForm.occupationDetail
            });
            toast.success("Profile updated successfully!", { id: toastId });
            setIsEditingProfile(false);
            await fetchData();
        } catch (e) {
            toast.error("Failed to update profile", { id: toastId });
        } finally {
            setSavingProfile(false);
        }
    };

    const handleStartSelfServiceChange = (type: 'email' | 'phone') => {
        if (!profile) return;
        const currentTarget = type === 'email' ? profile.email : profile.phone;
        setSelfServiceModal({
            open: true,
            type,
            step: 'send_old_otp',
            oldTarget: currentTarget || '',
            newTarget: '',
            oldOtpInput: '',
            newOtpInput: '',
            loading: false,
            errorMessage: ''
        });
    };

    const handleSendOldOTP = async () => {
        if (!selfServiceModal) return;
        setSelfServiceModal(prev => prev ? { ...prev, loading: true, errorMessage: '' } : null);
        try {
            const res = await requestSelfServiceOTP(selfServiceModal.type, selfServiceModal.oldTarget, 'old');
            if (res && 'error' in res) throw new Error(res.error);
            toast.success(`Mock OTP sent to old ${selfServiceModal.type}`);
            setSelfServiceModal(prev => prev ? { ...prev, step: 'verify_old_otp' } : null);
        } catch (e: any) {
            setSelfServiceModal(prev => prev ? { ...prev, errorMessage: e.message } : null);
        } finally {
            setSelfServiceModal(prev => prev ? { ...prev, loading: false } : null);
        }
    };

    const handleVerifyOldOTP = () => {
        if (!selfServiceModal) return;
        if (selfServiceModal.oldOtpInput !== '123456') {
            setSelfServiceModal(prev => prev ? { ...prev, errorMessage: "Invalid mock OTP. Enter '123456'." } : null);
            return;
        }
        setSelfServiceModal(prev => prev ? { ...prev, step: 'enter_new_target', errorMessage: '' } : null);
    };

    const handleSendNewOTP = async () => {
        if (!selfServiceModal) return;
        if (!selfServiceModal.newTarget.trim()) {
            setSelfServiceModal(prev => prev ? { ...prev, errorMessage: `Please enter new ${selfServiceModal.type}` } : null);
            return;
        }
        if (selfServiceModal.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(selfServiceModal.newTarget)) {
            setSelfServiceModal(prev => prev ? { ...prev, errorMessage: 'Invalid email address syntax' } : null);
            return;
        }
        if (selfServiceModal.type === 'phone' && !/^\+91[6-9]\d{9}$/.test(selfServiceModal.newTarget)) {
            setSelfServiceModal(prev => prev ? { ...prev, errorMessage: 'Phone number must start with +91 followed by a valid 10-digit number (e.g. +919876543210)' } : null);
            return;
        }

        setSelfServiceModal(prev => prev ? { ...prev, loading: true, errorMessage: '' } : null);
        try {
            const res = await requestSelfServiceOTP(selfServiceModal.type, selfServiceModal.newTarget, 'new');
            if (res && 'error' in res) throw new Error(res.error);
            toast.success(`Mock OTP sent to new ${selfServiceModal.type}`);
            setSelfServiceModal(prev => prev ? { ...prev, step: 'verify_new_otp' } : null);
        } catch (e: any) {
            setSelfServiceModal(prev => prev ? { ...prev, errorMessage: e.message } : null);
        } finally {
            setSelfServiceModal(prev => prev ? { ...prev, loading: false } : null);
        }
    };

    const handleVerifyAndSaveNewOTP = async () => {
        if (!selfServiceModal) return;
        if (selfServiceModal.newOtpInput !== '123456') {
            setSelfServiceModal(prev => prev ? { ...prev, errorMessage: "Invalid mock OTP. Enter '123456'." } : null);
            return;
        }
        setSelfServiceModal(prev => prev ? { ...prev, loading: true, errorMessage: '' } : null);
        try {
            const res = await verifyAndUpdateSelfService(
                selfServiceModal.type,
                selfServiceModal.oldOtpInput,
                selfServiceModal.newTarget,
                selfServiceModal.newOtpInput
            );
            if (res && 'error' in res) throw new Error(res.error);
            toast.success(`${selfServiceModal.type === 'email' ? 'Email' : 'Phone'} updated successfully!`);
            const savedType = selfServiceModal.type;
            setSelfServiceModal(null);
            await fetchData();
            if (savedType === 'email') {
                toast("Login Credentials Updated", {
                    description: "Your login email has changed. Please use your new email next time you log in.",
                    duration: 10000
                });
            }
        } catch (e: any) {
            setSelfServiceModal(prev => prev ? { ...prev, errorMessage: e.message } : null);
        } finally {
            setSelfServiceModal(prev => prev ? { ...prev, loading: false } : null);
        }
    };

    const handleCancel = (bookingId: string, propertyName: string) => {
        setCancelReason("");
        setCancelModal({ id: bookingId, name: propertyName });
    };

    const confirmCancelStudent = async () => {
        if (!cancelModal) return;
        setCancellingId(cancelModal.id);
        try {
            await cancelBooking(cancelModal.id, cancelReason);
            toast.success("Booking cancelled successfully.");
            setCancelModal(null);
            setCancelReason("");
            await fetchData();
        } catch (e: any) {
            toast.error(e.message || "Failed to cancel booking.");
        } finally {
            setCancellingId(null);
        }
    };

    const handleDownloadReceipt = (payment: any) => {
        try {
            const userName = bookings[0]?.guestName || "User";
            generateInvoicePDF({
                invoiceId: payment.id || Math.random().toString(36).substring(2, 10).toUpperCase(),
                date: new Date(payment.date).toLocaleDateString("en-IN"),
                description: payment.description,
                month: new Date(payment.date).toLocaleString("en-IN", { month: 'long', year: 'numeric' }),
                amount: payment.amount,
                tenantName: userName,
                paymentMethod: "Online / Validated",
            });
        } catch (e: any) {
            console.error("PDF GEN ERROR:", e);
            toast.error("Failed to generate PDF. Please try again.");
        }
    };

    if (loading) return <div className="p-20 text-center animate-pulse">Loading bookings...</div>;
    if (error) return (
        <div className="p-8 text-center text-red-500">
            <p>Failed to load data. Please ensure you are logged in.</p>
            <Button variant="outline" className="mt-4" onClick={fetchData}>Retry</Button>
        </div>
    );

    return (
        <div className="container mx-auto py-6 px-4 max-w-4xl space-y-8 pb-24 md:pb-12">


            {/* Main Tabs Segment */}
            <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
                <TabsList className="flex w-full mb-4 p-1.5 bg-slate-100 rounded-2xl h-auto gap-0">
                    <TabsTrigger value="active-stay" className="flex-1 font-bold py-3 text-sm whitespace-nowrap rounded-xl relative data-[state=active]:bg-gradient-to-br data-[state=active]:from-violet-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-violet-200 data-[state=inactive]:after:content-[''] data-[state=inactive]:after:absolute data-[state=inactive]:after:right-0 data-[state=inactive]:after:top-[20%] data-[state=inactive]:after:h-[60%] data-[state=inactive]:after:w-px data-[state=inactive]:after:bg-slate-300">
                        <Building2 className="h-4 w-4 mr-2 hidden sm:block" /> Active Stay
                    </TabsTrigger>
                    <TabsTrigger value="bookings" className="flex-1 font-bold py-3 text-sm whitespace-nowrap rounded-xl relative data-[state=active]:bg-gradient-to-br data-[state=active]:from-violet-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-violet-200 data-[state=inactive]:after:content-[''] data-[state=inactive]:after:absolute data-[state=inactive]:after:right-0 data-[state=inactive]:after:top-[20%] data-[state=inactive]:after:h-[60%] data-[state=inactive]:after:w-px data-[state=inactive]:after:bg-slate-300">
                        <Calendar className="h-4 w-4 mr-2 hidden sm:block" /> Bookings & Status
                    </TabsTrigger>
                    <TabsTrigger value="profile" className="flex-1 font-bold py-3 text-sm whitespace-nowrap rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-violet-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-violet-200">
                        <User className="h-4 w-4 mr-2 hidden sm:block" /> My Profile
                    </TabsTrigger>
                </TabsList>

                {/* ── Active Stay Tab Content ── */}
                <TabsContent value="active-stay" className="space-y-6 pt-4">
                    {(() => {
                        const activeStay = bookings.find((b: any) => ['ACTIVE', 'CHECKED_IN', 'CHECKIN_CONFIRMED'].includes(b.status));
                        if (!activeStay) {
                            return (
                                <Card className="border-2 border-dashed p-12 text-center space-y-4">
                                    <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-2xl">🏠</div>
                                    <div>
                                        <p className="font-bold text-slate-800">No active stay details found</p>
                                        <p className="text-xs text-muted-foreground">Complete your onboarding bookings to activate your stay details.</p>
                                    </div>
                                </Card>
                            );
                        }
                        return (
                            <div className="space-y-6">
                                <BookingCard 
                                    booking={activeStay} 
                                    isActiveStay={true}
                                    router={router}
                                    fetchData={fetchData}
                                    setSigningBooking={setSigningBooking}
                                    setSelectedBooking={setSelectedBooking}
                                    setViewingDoc={setViewingDoc}
                                    setExpandedDocs={setExpandedDocs}
                                    expandedDocs={expandedDocs}
                                    setDismissedSharingAlert={setDismissedSharingAlert}
                                    dismissedSharingAlert={dismissedSharingAlert}
                                    handleCancel={handleCancel}
                                    cancellingId={cancellingId}
                                />
                                <MyDepositSection />
                            </div>
                        );
                    })()}
                </TabsContent>

                {/* ── Bookings & Onboarding Tab Content ── */}
                <TabsContent value="bookings" className="space-y-6 pt-4">
                    {(() => {
                        const otherBookings = bookings
                            .filter((b: any) => !['ACTIVE', 'CHECKED_IN', 'CHECKIN_CONFIRMED'].includes(b.status))
                            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                        return (
                            <div className="space-y-6">
                                {/* Sharing Change Alerts */}
                                {bookings.some((b: any) => b.originalOccupancy && b.originalOccupancy !== b.occupancy && dismissedSharingAlert !== b.id) && 
                                    bookings.filter((b: any) => b.originalOccupancy && b.originalOccupancy !== b.occupancy && dismissedSharingAlert !== b.id).map((b: any) => (
                                    <div key={`sharing-alert-${b.id}`} className="bg-red-50 border-2 border-red-400 rounded-2xl p-4 flex items-start justify-between gap-3 animate-in slide-in-from-top-2 duration-300">
                                        <div className="flex items-start gap-3">
                                            <span className="text-2xl mt-0.5">⚠️</span>
                                            <div>
                                                <p className="font-black text-red-800 text-sm">Your Sharing Type Was Changed</p>
                                                <p className="text-red-700 text-xs mt-1">You applied for <strong>{b.originalOccupancy}</strong> but management assigned <strong>{b.occupancy}</strong> at <strong>{b.propertyName}</strong>.</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setDismissedSharingAlert(b.id)} className="text-red-400 hover:text-red-600 shrink-0 mt-0.5">
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>
                                ))}

                                {/* Room Allocation Notifications */}
                                {roomAllocNotifs.map((n: any) => (
                                    <div key={`room-alloc-${n.id}`} className="bg-red-50 border-2 border-red-500 rounded-2xl p-4 flex items-start justify-between gap-3 animate-in slide-in-from-top-2 duration-300">
                                        <div className="flex items-start gap-3">
                                            <span className="text-2xl mt-0.5">🏠</span>
                                            <div>
                                                <p className="font-black text-red-800 text-sm">Room / Bed Update</p>
                                                <p className="text-red-700 text-xs mt-1">{n.message}</p>
                                            </div>
                                        </div>
                                        <button onClick={async () => { await markNotificationRead(n.id); setRoomAllocNotifs(prev => prev.filter(x => x.id !== n.id)); }} className="text-red-400 hover:text-red-600 shrink-0 mt-0.5">
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>
                                ))}

                                {/* Onboarding / Other Bookings List */}
                                {otherBookings.length > 0 ? (
                                    <div className="space-y-4">
                                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 px-1">Booking Checklist & History</h2>
                                        {otherBookings.map((booking: any) => (
                                            <BookingCard 
                                                key={booking.id} 
                                                booking={booking}
                                                router={router}
                                                fetchData={fetchData}
                                                setSigningBooking={setSigningBooking}
                                                setSelectedBooking={setSelectedBooking}
                                                setViewingDoc={setViewingDoc}
                                                setExpandedDocs={setExpandedDocs}
                                                expandedDocs={expandedDocs}
                                                setDismissedSharingAlert={setDismissedSharingAlert}
                                                dismissedSharingAlert={dismissedSharingAlert}
                                                handleCancel={handleCancel}
                                                cancellingId={cancellingId}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <Card className="border-2 border-dashed">
                                        <CardContent className="p-12 text-center space-y-4">
                                            <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-2xl">🔎</div>
                                            <div className="space-y-1">
                                                <p className="font-bold text-slate-800">No pending bookings</p>
                                                <p className="text-xs text-muted-foreground">Discover verified student housing across India with RentPe.</p>
                                            </div>
                                            <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold" asChild>
                                                <Link href="/search">Find PG</Link>
                                            </Button>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        );
                    })()}
                </TabsContent>

                {/* ── Profile Tab Content ── */}
                <TabsContent value="profile" className="space-y-6 pt-0">
                    {(() => {
                        const isProfileLocked = !!profile?.dateOfBirth;
                        return (
                            isEditingProfile ? (
                                <Card className="border-2 border-slate-100 shadow-sm bg-white overflow-hidden rounded-3xl rounded-t-none">
                                    <CardHeader className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white p-5 md:p-6 relative shadow-md rounded-t-none">
                                        <div className="flex items-center gap-4">
                                            <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white shadow-inner shadow-white/20">
                                                <User className="h-8 w-8 md:h-10 md:w-10" />
                                            </div>
                                            <div className="flex flex-col">
                                                <CardTitle className="text-xl md:text-3xl font-black drop-shadow-md tracking-tight">Edit Profile</CardTitle>
                                                <span className="text-white/90 font-bold text-[10px] mt-1 bg-black/20 backdrop-blur-sm px-2.5 py-1 rounded-md w-fit uppercase tracking-wider">
                                                    CUSTOMER ACCOUNT
                                                </span>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-6 md:p-8 space-y-6 bg-slate-50">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Column 1: Demographics & Occupation */}
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Demographics & Occupation</h4>
                                        <div>
                                            <label className="text-xs font-black text-slate-600 block mb-1">Date of Birth</label>
                                            <input type="date" disabled={isProfileLocked} max={new Date().toISOString().split("T")[0]} value={profileForm.dateOfBirth || ''} onChange={e => setProfileForm({...profileForm, dateOfBirth: e.target.value})} className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-slate-600 block mb-1">Gender</label>
                                            <select disabled={isProfileLocked} value={profileForm.gender || ''} onChange={e => setProfileForm({...profileForm, gender: e.target.value})} className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed">
                                                <option value="">Select Gender</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-slate-600 block mb-1">Nationality</label>
                                            <select disabled={isProfileLocked} value={profileForm.nationality || ''} onChange={e => setProfileForm({...profileForm, nationality: e.target.value})} className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed">
                                                <option value="Indian">Indian</option>
                                                <option value="Others">Others</option>
                                            </select>
                                        </div>
                                        {profileForm.nationality === 'Others' && (
                                            <div>
                                                <label className="text-xs font-black text-slate-600 block mb-1">Specify Nationality</label>
                                                <input type="text" disabled={isProfileLocked} value={profileForm.nationalityOther || ''} onChange={e => setProfileForm({...profileForm, nationalityOther: e.target.value})} placeholder="e.g. American" className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed" />
                                            </div>
                                        )}
                                        <div>
                                            <label className="text-xs font-black text-slate-600 block mb-1">Occupation Status</label>
                                            <select disabled={isProfileLocked} value={profileForm.occupationType || ''} onChange={e => setProfileForm({...profileForm, occupationType: e.target.value})} className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed">
                                                <option value="">Select</option>
                                                <option value="Student">Student</option>
                                                <option value="Working Professional">Working Professional</option>
                                                <option value="Others">Others</option>
                                            </select>
                                        </div>
                                        {profileForm.occupationType === 'Others' && (
                                            <div>
                                                <label className="text-xs font-black text-slate-600 block mb-1">Specify Occupation</label>
                                                <input type="text" disabled={isProfileLocked} value={profileForm.occupationOther || ''} onChange={e => setProfileForm({...profileForm, occupationOther: e.target.value})} placeholder="e.g. Freelancer" className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed" />
                                            </div>
                                        )}
                                        <div>
                                            <label className="text-xs font-black text-slate-600 block mb-1">Institution / Company Name</label>
                                            <input type="text" disabled={isProfileLocked} value={profileForm.occupationDetail || ''} onChange={e => setProfileForm({...profileForm, occupationDetail: e.target.value})} placeholder="e.g. Delhi University" className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed" />
                                        </div>

                                        {/* Credentials Change Section inside Edit Profile Mode */}
                                        <div className="border-t border-slate-200 pt-4 mt-2 space-y-4">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Login & Contact Credentials</h4>
                                            <div>
                                                <label className="text-xs font-black text-slate-600 block mb-1">Official Email</label>
                                                <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                                                    <span className="text-sm font-bold text-slate-800">{profile?.email || '-'}</span>
                                                    <Button 
                                                        type="button" 
                                                        onClick={() => handleStartSelfServiceChange('email')}
                                                        className="h-8 bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 font-bold px-3 py-1 rounded-lg text-xs"
                                                    >
                                                        Change Email
                                                    </Button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-black text-slate-600 block mb-1">Registered Phone</label>
                                                <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                                                    <span className="text-sm font-bold text-slate-800">{profile?.phone || '-'}</span>
                                                    <Button 
                                                        type="button" 
                                                        onClick={() => handleStartSelfServiceChange('phone')}
                                                        className="h-8 bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 font-bold px-3 py-1 rounded-lg text-xs"
                                                    >
                                                        Change Phone
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 2: Emergency Contacts */}
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Emergency Contacts (Max 2)</h4>
                                        
                                        {/* Contact 1 */}
                                        <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                                            <p className="text-xs font-black text-indigo-600 uppercase tracking-wider">Primary Contact (Mandatory)</p>
                                            <div>
                                                <label className="text-[11px] font-bold text-slate-500 block mb-1">Full Name</label>
                                                <input type="text" value={profileForm.emergencyContacts?.[0]?.name || ''} onChange={e => {
                                                    const updated = [...(profileForm.emergencyContacts || [])];
                                                    updated[0] = { ...updated[0], name: e.target.value };
                                                    setProfileForm({ ...profileForm, emergencyContacts: updated });
                                                }} placeholder="Contact name" className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 outline-none animate-none" />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-bold text-slate-500 block mb-1">Relation</label>
                                                <select value={profileForm.emergencyContacts?.[0]?.relation || ''} onChange={e => {
                                                    const updated = [...(profileForm.emergencyContacts || [])];
                                                    updated[0] = { ...updated[0], relation: e.target.value };
                                                    setProfileForm({ ...profileForm, emergencyContacts: updated });
                                                }} className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 outline-none">
                                                    <option value="">Select Relation</option>
                                                    <option value="Family">Family</option>
                                                    <option value="Relatives">Relatives</option>
                                                    <option value="Friends">Friends</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-bold text-slate-500 block mb-1">Phone Number</label>
                                                <input type="tel" value={profileForm.emergencyContacts?.[0]?.phone || ''} onChange={e => {
                                                    const updated = [...(profileForm.emergencyContacts || [])];
                                                    updated[0] = { ...updated[0], phone: e.target.value };
                                                    setProfileForm({ ...profileForm, emergencyContacts: updated });
                                                }} placeholder="Phone number" className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 outline-none" />
                                            </div>
                                        </div>

                                        {/* Contact 2 */}
                                        <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                                            <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Secondary Contact (Optional)</p>
                                            <div>
                                                <label className="text-[11px] font-bold text-slate-500 block mb-1">Full Name</label>
                                                <input type="text" value={profileForm.emergencyContacts?.[1]?.name || ''} onChange={e => {
                                                    const updated = [...(profileForm.emergencyContacts || [])];
                                                    updated[1] = { ...updated[1], name: e.target.value };
                                                    setProfileForm({ ...profileForm, emergencyContacts: updated });
                                                }} placeholder="Contact name" className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 outline-none animate-none" />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-bold text-slate-500 block mb-1">Relation</label>
                                                <select value={profileForm.emergencyContacts?.[1]?.relation || ''} onChange={e => {
                                                    const updated = [...(profileForm.emergencyContacts || [])];
                                                    updated[1] = { ...updated[1], relation: e.target.value };
                                                    setProfileForm({ ...profileForm, emergencyContacts: updated });
                                                }} className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 outline-none">
                                                    <option value="">Select Relation</option>
                                                    <option value="Family">Family</option>
                                                    <option value="Relatives">Relatives</option>
                                                    <option value="Friends">Friends</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-bold text-slate-500 block mb-1">Phone Number</label>
                                                <input type="tel" value={profileForm.emergencyContacts?.[1]?.phone || ''} onChange={e => {
                                                    const updated = [...(profileForm.emergencyContacts || [])];
                                                    updated[1] = { ...updated[1], phone: e.target.value };
                                                    setProfileForm({ ...profileForm, emergencyContacts: updated });
                                                }} placeholder="Phone number" className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 outline-none" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-4 border-t border-slate-200">
                                    <Button onClick={() => setIsEditingProfile(false)} variant="outline" className="font-bold border-2 rounded-xl">Cancel</Button>
                                    <Button onClick={handleSaveProfile} disabled={savingProfile} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl px-8 shadow-md">
                                        {savingProfile ? "Saving..." : "Save Profile"}
                                    </Button>
                                </div>
                            </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-4">
                                    {/* Hero row */}
                                    <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-b-2xl rounded-t-none p-5 flex items-center gap-4 relative">
                                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                                            <User className="h-8 w-8 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-white">{profile?.name}</h2>
                                            <p className="text-white/70 text-xs">Student / Tenant</p>
                                            <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full mt-1 inline-block font-mono">
                                                {profile?.permanentId || profile?.displayId || "RP-U-XXXXXX"}
                                            </span>
                                        </div>
                                        <Button size="sm" variant="outline" onClick={() => setIsEditingProfile(true)} className="absolute top-4 right-4 bg-white/10 border-white/30 text-white text-xs hover:bg-white/20">
                                            Edit profile
                                        </Button>
                                    </div>

                                    {/* 2-col row */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Personal info card */}
                                        <div className="bg-white border rounded-xl p-4 space-y-3">
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Personal info</p>
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div><p className="text-xs text-slate-400">Date of birth</p><p className="font-medium">{profile?.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString('en-GB') : profile?.dob || "—"}</p></div>
                                                <div><p className="text-xs text-slate-400">Gender</p><p className="font-medium">{profile?.gender || "—"}</p></div>
                                                <div><p className="text-xs text-slate-400">Nationality</p><p className="font-medium">{profile?.nationality || "Indian"}</p></div>
                                                <div><p className="text-xs text-slate-400">Occupation</p><p className="font-medium">{profile?.occupationType || "Student"}</p></div>
                                            </div>
                                            <div><p className="text-xs text-slate-400">Institution / company</p><p className="text-sm font-medium">{profile?.occupationDetail || profile?.institution || "—"}</p></div>
                                        </div>

                                        {/* Current stay card */}
                                        {profile?.activeTenant ? (
                                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                                                <p className="text-xs font-black text-blue-400 uppercase tracking-widest">Current stay</p>
                                                <div className="text-sm font-bold text-blue-900">{profile?.activeTenant?.property?.name || profile?.activeTenant?.booking?.propertyName || "Property Name Unavailable"}</div>
                                                <div className="text-xs text-blue-700">{profile?.activeTenant?.property?.address || profile?.activeTenant?.booking?.propertyAddress || "Address Unavailable"}</div>
                                                <div className="flex gap-2 mt-2">
                                                    <Badge variant="outline" className="bg-white text-blue-700 border-blue-200 font-mono text-[10px] font-black">{profile?.activeTenant?.displayId}</Badge>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="border-2 border-dashed rounded-xl p-6 text-center text-slate-400">
                                                <p className="text-sm">No active stay</p>
                                                <p className="text-xs mt-1">Book a PG to see stay details</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* 3-col row */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Contact */}
                                        <div className="bg-white border rounded-xl p-4">
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Contact</p>
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-2">
                                                    <Mail className="h-4 w-4 text-blue-500 shrink-0" />
                                                    <div className="min-w-0 flex-1"><p className="text-xs text-slate-400">Email</p><p className="text-sm font-medium truncate">{profile?.email}</p></div>
                                                </div>
                                                <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-2">
                                                    <Phone className="h-4 w-4 text-blue-500 shrink-0" />
                                                    <div className="min-w-0 flex-1"><p className="text-xs text-slate-400">Mobile</p><p className="text-sm font-medium truncate">{profile?.phone}</p></div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Emergency contact */}
                                        <div className="bg-white border rounded-xl p-4">
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Emergency contact</p>
                                            {profile?.emergencyContact ? (
                                                <div>
                                                    <div className="text-sm font-medium">{(() => {
                                                        try {
                                                            const parsed = JSON.parse(profile.emergencyContact);
                                                            return Array.isArray(parsed) && parsed.length > 0 ? parsed[0].name : profile.emergencyContact;
                                                        } catch(e) {
                                                            return profile.emergencyContact;
                                                        }
                                                    })()}</div>
                                                    <div className="text-xs text-slate-500 mt-1 font-mono">{(() => {
                                                        try {
                                                            const parsed = JSON.parse(profile.emergencyContact);
                                                            return Array.isArray(parsed) && parsed.length > 0 ? parsed[0].phone : '';
                                                        } catch(e) {
                                                            return '';
                                                        }
                                                    })()}</div>
                                                </div>
                                            ) : (
                                                <div className="border-2 border-dashed rounded-lg p-4 text-center text-slate-400">
                                                    <p className="text-xs">Add emergency contact</p>
                                                    <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={() => setIsEditingProfile(true)}>Add</Button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Security */}
                                        <div className="bg-white border rounded-xl p-4">
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Security</p>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                                    <span className="text-sm flex items-center gap-2 text-slate-700"><Lock className="h-4 w-4" />Password</span>
                                                    <Button size="sm" variant="ghost" className="text-xs text-blue-600 font-bold hover:text-blue-700 h-auto p-0"
                                                        onClick={async () => {
                                                            const fd = new FormData(); fd.append('email', profile?.email);
                                                            const { forgotPassword } = await import("@/actions/auth");
                                                            const result = await forgotPassword(fd);
                                                            if (result.success) toast.success("Reset link sent to your email");
                                                            else toast.error(result.error || "Failed to send reset link");
                                                        }}>Change</Button>
                                                </div>
                                                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                                    <span className="text-sm flex items-center gap-2 text-slate-700"><Mail className="h-4 w-4" />Email</span>
                                                    <span className="text-xs text-green-600 flex items-center gap-1 font-bold"><CheckCircle className="h-3 w-3" />Verified</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2">
                                                    <span className="text-sm flex items-center gap-2 text-slate-700"><Phone className="h-4 w-4" />Phone</span>
                                                    <span className="text-xs text-green-600 flex items-center gap-1 font-bold"><CheckCircle className="h-3 w-3" />Verified</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        );
                    })()}
                </TabsContent>
            </Tabs>

            {/* Modals */}
            {reviewBooking && <SubmitReviewModal booking={reviewBooking} isOpen={!!reviewBooking} onClose={() => setReviewBooking(null)} />}
            {selectedBooking && <RentReceipt booking={selectedBooking} onClose={() => setSelectedBooking(null)} />}
            <DocumentViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />
            
            <PropertyAgreementModal
                isOpen={!!signingBooking}
                onClose={() => setSigningBooking(null)}
                onAccept={async (deviceInfo) => {
                    const toastId = toast.loading("Signing...");
                    try {
                        await signAgreement(signingBooking.id, {
                            agreementId: `AGT-${signingBooking.displayId}-${Date.now()}`,
                            signedDevice: deviceInfo.userAgent,
                            moveInDate: (deviceInfo as any).moveInDate
                        });
                        toast.success("Agreement signed! 🎉 Owner will now countersign.", { id: toastId });
                        await fetchData();
                        setSigningBooking(null);
                    } catch (e: any) { toast.error(e.message, { id: toastId }); }
                }}
                property={{
                    id: signingBooking?.propertyId || signingBooking?.id || '',
                    name: signingBooking?.propertyName || '',
                    address: signingBooking?.propertyAddress || '',
                    city: signingBooking?.propertyCity || '',
                    displayId: signingBooking?.propertyDisplayId || null,
                }}
                room={{
                    roomNumber: signingBooking?.roomAssigned || '',
                    type: signingBooking?.occupancy || 'SINGLE',
                    price: Number(signingBooking?.amount || 0),
                    depositMonths: Number(signingBooking?.depositMonths || 2)
                }}
                tenant={{
                    name: signingBooking?.guestName || '',
                    email: signingBooking?.guestEmail || undefined,
                    userId: signingBooking?.userDisplayId || profile?.displayId || null,
                    tenantId: signingBooking?.tenantDisplayId || signingBooking?.tenant?.displayId || null,
                }}
                moveInDate={signingBooking?.onboardingDate || signingBooking?.moveInDate || ''}
                depositAmount={Number(signingBooking?.depositAmount || 0)}
                platformFee={0}
                bookingDisplayId={signingBooking?.displayId || null}
            />



            {/* Self-Service Credentials Edit Modal */}
            {selfServiceModal && selfServiceModal.open && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-3xl p-8 space-y-6 shadow-2xl relative overflow-hidden scale-in duration-300">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-xl text-slate-900">
                                Change Registered {selfServiceModal.type === 'email' ? 'Email' : 'Phone'}
                            </h3>
                            <button 
                                onClick={() => setSelfServiceModal(null)} 
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Error Alert */}
                        {selfServiceModal.errorMessage && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-red-800 text-xs font-bold">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{selfServiceModal.errorMessage}</span>
                            </div>
                        )}

                        {/* Step 1: Send Old OTP */}
                        {selfServiceModal.step === 'send_old_otp' && (
                            <div className="space-y-4">
                                <p className="text-xs text-slate-500 leading-relaxed font-bold">
                                    To update your registered {selfServiceModal.type}, we must first verify your current identity. We will send a mock verification OTP to your current {selfServiceModal.type}: <strong>{selfServiceModal.oldTarget}</strong>.
                                </p>
                                <Button 
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black h-12 rounded-2xl shadow-md shadow-indigo-100" 
                                    onClick={handleSendOldOTP}
                                    disabled={selfServiceModal.loading}
                                >
                                    {selfServiceModal.loading ? 'Sending...' : 'Send Verification OTP'}
                                </Button>
                            </div>
                        )}

                        {/* Step 2: Verify Old OTP */}
                        {selfServiceModal.step === 'verify_old_otp' && (
                            <div className="space-y-4">
                                <p className="text-xs text-slate-500 leading-relaxed font-bold">
                                    Please enter the verification OTP sent to <strong>{selfServiceModal.oldTarget}</strong>. Use the mock OTP code: <span className="font-black text-indigo-600">123456</span>.
                                </p>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Verification OTP</label>
                                    <input 
                                        type="text" 
                                        maxLength={6} 
                                        value={selfServiceModal.oldOtpInput} 
                                        onChange={e => setSelfServiceModal({ ...selfServiceModal, oldOtpInput: e.target.value })} 
                                        placeholder="Enter 6-digit OTP" 
                                        className="flex h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-mono text-center text-lg font-black tracking-widest"
                                    />
                                </div>
                                <Button 
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black h-12 rounded-2xl shadow-md shadow-indigo-100" 
                                    onClick={handleVerifyOldOTP}
                                    disabled={selfServiceModal.oldOtpInput.length !== 6}
                                >
                                    Verify & Next
                                </Button>
                            </div>
                        )}

                        {/* Step 3: Enter New Target */}
                        {selfServiceModal.step === 'enter_new_target' && (
                            <div className="space-y-4">
                                <p className="text-xs text-slate-500 leading-relaxed font-bold">
                                    Current credential verified successfully! Now, enter your new registered {selfServiceModal.type}.
                                </p>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">New {selfServiceModal.type === 'email' ? 'Email Address' : 'Phone Number'}</label>
                                    <input 
                                        type={selfServiceModal.type === 'email' ? 'email' : 'text'} 
                                        value={selfServiceModal.newTarget} 
                                        onChange={e => setSelfServiceModal({ ...selfServiceModal, newTarget: e.target.value })} 
                                        placeholder={selfServiceModal.type === 'email' ? 'e.g. newemail@domain.com' : 'e.g. +919876543210'} 
                                        className="flex h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-bold text-slate-800"
                                    />
                                </div>
                                <Button 
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black h-12 rounded-2xl shadow-md shadow-indigo-100" 
                                    onClick={handleSendNewOTP}
                                    disabled={selfServiceModal.loading || !selfServiceModal.newTarget.trim()}
                                >
                                    {selfServiceModal.loading ? 'Validating...' : 'Send Verification OTP'}
                                </Button>
                            </div>
                        )}

                        {/* Step 4: Verify New OTP */}
                        {selfServiceModal.step === 'verify_new_otp' && (
                            <div className="space-y-4">
                                <p className="text-xs text-slate-500 leading-relaxed font-bold">
                                    Please enter the verification OTP sent to your new destination: <strong>{selfServiceModal.newTarget}</strong>. Use the mock OTP code: <span className="font-black text-indigo-600">123456</span>.
                                </p>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Verification OTP</label>
                                    <input 
                                        type="text" 
                                        maxLength={6} 
                                        value={selfServiceModal.newOtpInput} 
                                        onChange={e => setSelfServiceModal({ ...selfServiceModal, newOtpInput: e.target.value })} 
                                        placeholder="Enter 6-digit OTP" 
                                        className="flex h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-mono text-center text-lg font-black tracking-widest"
                                    />
                                </div>
                                <Button 
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black h-12 rounded-2xl shadow-md shadow-indigo-100" 
                                    onClick={handleVerifyAndSaveNewOTP}
                                    disabled={selfServiceModal.loading || selfServiceModal.newOtpInput.length !== 6}
                                >
                                    {selfServiceModal.loading ? 'Updating Credentials...' : 'Verify & Save Changes'}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}


