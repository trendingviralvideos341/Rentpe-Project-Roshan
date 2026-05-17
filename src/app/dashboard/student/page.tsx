"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getBookings, cancelBooking, signAgreement, completeVacate } from "@/actions/bookings";
import { getPersistentNotifications, markNotificationRead } from "@/actions/notifications";
import { getTenantDocuments, uploadTenantDocument } from "@/actions/documents";
import { changeFoodPreference } from "@/actions/food";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCcw, FileText, BedDouble, Calendar, CreditCard, CheckCircle, XCircle, UploadCloud, ChevronDown, ChevronUp, AlertTriangle, Phone, Mail, User, History, Shield, Building2, Download, Star, Lock, X } from "lucide-react";
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

const TYPE_LABELS: Record<string, any> = {
    ID_PROOF: "🆔 ID Proof",
    ADDRESS_PROOF: "🏠 Address Proof",
    COLLEGE_COMPANY: "🎓 College / Company Letter",
    SELFIE: "📸 Current Selfie",
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
function AlertBanner({ type, message, actionLabel, onAction }: { type: 'error' | 'warning' | 'info'; message: string; actionLabel?: string; onAction?: () => void }) {
    const bgColor = type === 'error' ? 'bg-red-50 border-red-200' : type === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200';
    const textColor = type === 'error' ? 'text-red-800' : type === 'warning' ? 'text-amber-800' : 'text-blue-800';
    const Icon = type === 'error' ? AlertTriangle : type === 'warning' ? AlertTriangle : Shield;

    return (
        <div className={`flex items-center justify-between p-4 rounded-lg border shadow-sm mb-4 animate-in fade-in slide-in-from-top-2 duration-500 ${bgColor} ${textColor}`}>
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${type === 'error' ? 'bg-red-100' : type === 'warning' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-sm font-bold">Action Required</p>
                    <p className="text-xs opacity-90">{message}</p>
                </div>
            </div>
            {actionLabel && (
                <Button size="sm" onClick={onAction} className={`${type === 'error' ? 'bg-red-600 hover:bg-red-700' : type === 'warning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold ml-4 shrink-0`}>
                    {actionLabel}
                </Button>
            )}
        </div>
    );
}

// ── Section 6A & 7A — Food Management (Student) ──
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
                    {(booking.status === "APPLIED" || booking.status === "PENDING_APPROVAL") && <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded">⏳ Waiting for Approval</span>}
                    {isKycPending && <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">🆔 KYC Verification</span>}
                    {isTokenPending && <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded animate-pulse">🔒 Token Payment Pending</span>}
                    {isTokenPaid && !isPhysicalVerified && <span className="bg-teal-100 text-teal-800 text-xs font-bold px-2 py-1 rounded">✅ Token Paid — Awaiting Physical KYC</span>}
                    {isPhysicalVerified && <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded animate-pulse">🆔 ID Verified — Sign Agreement Now</span>}
                    {isPaymentPending && !isTokenPending && <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded">💳 Payment Pending</span>}
                    {isAgreementPending && <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded">⏳ Signed — Awaiting Owner Countersign</span>}
                    {isFinalPaymentPending && <span className="bg-red-100 text-red-800 text-xs font-black px-2 py-1 rounded animate-pulse">🔴 Final Payment Due — Pay Now</span>}
                    {isPaid && !booking.agreementSigned && <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded">✍️ Sign Agreement</span>}
                    {isPaid && booking.agreementSigned && <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded">📅 Ready for Move-in</span>}
                    {isCheckedIn && <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">🏠 Checked-in & Active</span>}
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
                    <div className="w-full bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-orange-400 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-2 text-sm font-black text-orange-800"><Lock className="h-4 w-4" /> 🔒 Pay Token to Reserve Bed</div>
                        <p className="text-xs text-orange-700 font-medium">Room <strong>{booking.roomAssigned}</strong> allocated! Pay ₹1,000 token to lock your bed.</p>
                        <div className="bg-white/80 rounded-xl p-3 border border-orange-200 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-600">Token Amount</span>
                            <span className="text-sm font-black text-slate-900">₹1,000</span>
                        </div>
                        <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black h-12 rounded-2xl" onClick={() => router.push(`/secure/payment?id=${booking.id}&type=token`)}>💳 Pay ₹1,000 Token Now</Button>
                    </div>
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
                                    roomAssigned: booking.roomAssigned || '—',
                                    tokenAmount: 1000,
                                    paidAt: booking.paidAt ? new Date(booking.paidAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '—',
                                    paymentMethod: booking.paymentMethod || 'Online',
                                    paymentId: booking.paymentId || undefined,
                                }});
                            }}>
                                <FileText className="h-3 w-3 mr-1" /> View Receipt
                            </Button>
                        </div>
                        {/* NEW FLOW: ROOM_RESERVED → show awaiting physical KYC (not sign agreement yet) */}
                        {!booking.tenantId && isTokenPaid && (
                            <div className="w-full bg-gradient-to-br from-teal-50 to-cyan-50 border-2 border-teal-400 rounded-2xl p-5 space-y-3">
                                <div className="flex items-center gap-2 text-sm font-black text-teal-800">
                                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-teal-500 animate-ping mr-1"></span>
                                    🔍 Physical ID Verification Pending
                                </div>
                                <p className="text-xs text-teal-700 font-medium">Token paid! Your bed is reserved. The property manager will physically verify your ID. Once verified, you can sign the rental agreement.</p>
                                <div className="bg-teal-100/60 rounded-xl p-3 text-[11px] text-teal-800 font-bold border border-teal-200">
                                    📌 Visit <strong>{booking.propertyName}</strong> with your original Aadhaar/Passport for KYC verification.
                                </div>
                            </div>
                        )}
                        {/* NEW FLOW: PHYSICAL_VERIFIED — Tenant ID assigned, prompt to sign agreement */}
                        {isPhysicalVerified && !booking.agreementSigned && (
                            <div className="w-full bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-500 rounded-2xl p-5 space-y-3 animate-pulse">
                                <div className="flex items-center gap-2 text-sm font-black text-emerald-800">
                                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping mr-1"></span>
                                    ✍️ Sign Your Rental Agreement
                                </div>
                                <p className="text-xs text-emerald-700 font-medium">Your identity has been physically verified! Your Tenant ID is now assigned. Sign the rental agreement to complete onboarding.</p>
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
                                            roomAssigned: booking.roomAssigned || '—',
                                            occupancy: booking.occupancy || '',
                                            monthlyRent: Number(booking.amount || 0),
                                            depositAmount: Number(booking.depositAmount || 0),
                                            depositMonths: Number(booking.depositMonths || 1),
                                            moveInDate: booking.onboardingDate || booking.moveInDate || '—',
                                            signedAt: booking.agreementSignedAt ? new Date(booking.agreementSignedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—',
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
                    <div className="w-full bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 border-2 border-red-400 rounded-2xl p-5 space-y-4 animate-[pulse_1.5s_ease-in-out_infinite]">
                        <div className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full bg-red-500 animate-ping shrink-0" />
                            <p className="text-sm font-black text-red-800">🔴 Final Payment Due — Action Required</p>
                        </div>
                        <p className="text-xs text-red-700 font-medium">Agreement confirmed! Pay the joining balance to activate your stay at <strong>{booking.propertyName}</strong>.</p>
                        {/* Physical presence notice */}
                        <div className="bg-white border-2 border-orange-400 rounded-xl p-3 space-y-1">
                            <p className="text-[11px] font-black text-orange-800 uppercase tracking-wider">📍 Important — Physical Presence Required</p>
                            <p className="text-[11px] text-orange-700 font-medium leading-relaxed">
                                To complete your joining, you must be <strong>physically present at the PG address</strong> when making this payment. Our staff will verify your identity on-site.
                                This step prevents fraud and ensures your booking is secure.
                            </p>
                            {booking.propertyAddress && (
                                <p className="text-[11px] font-bold text-orange-900 mt-1">📌 Address: {booking.propertyAddress}{booking.propertyCity ? `, ${booking.propertyCity}` : ''}</p>
                            )}
                        </div>
                        {(() => {
                            const rent = Number(booking.amount || 0);
                            const deposit = Number(booking.depositAmount || 0);
                            const balance = Math.max(0, rent + deposit - 1000);
                            return (
                                <div className="space-y-2 text-sm bg-white/80 rounded-xl p-4 border border-red-200">
                                    <div className="flex justify-between text-slate-600"><span>Monthly Rent</span><span>₹{rent.toLocaleString('en-IN')}</span></div>
                                    <div className="flex justify-between text-slate-600"><span>Security Deposit</span><span>₹{deposit.toLocaleString('en-IN')}</span></div>
                                    <div className="flex justify-between pt-1 border-t border-dashed border-red-200 font-bold text-slate-800"><span>Subtotal</span><span>₹{(rent + deposit).toLocaleString('en-IN')}</span></div>
                                    <div className="flex justify-between text-orange-600 font-bold"><span>Token Paid Already</span><span>- ₹1,000</span></div>
                                    <div className="flex justify-between pt-2 border-t font-black text-red-900 text-base"><span>💰 Balance Due</span><span>₹{balance.toLocaleString('en-IN')}</span></div>
                                    <Button className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white font-black h-12 rounded-2xl text-base shadow-lg shadow-red-300/50" onClick={() => router.push(`/secure/payment?id=${booking.id}`)}>💳 Pay ₹{balance.toLocaleString('en-IN')} Now</Button>
                                    <p className="text-[10px] text-center text-slate-400 pt-1">⚠️ Visit {booking.propertyName} in person to complete check-in</p>
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
                            <div className="bg-white p-3 rounded-xl text-center"><p className="text-[10px] font-black text-slate-500 uppercase">Room No.</p><p className="text-sm font-black text-indigo-900">{booking.roomAssigned.split(' — ')[0].trim()}</p></div>
                            <div className="bg-white p-3 rounded-xl text-center"><p className="text-[10px] font-black text-slate-500 uppercase">Type</p><p className="text-sm font-black text-indigo-900">{booking.occupancy}</p></div>
                            <div className="bg-white p-3 rounded-xl text-center"><p className="text-[10px] font-black text-slate-500 uppercase">Bed</p><p className="text-sm font-black text-indigo-900">{booking.roomAssigned.includes(' — ') ? booking.roomAssigned.split(' — ')[1]?.replace('Bed ', '').trim() : '—'}</p></div>
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
                                roomAssigned: booking.roomAssigned || '—',
                                tokenAmount: booking.tokenAmount || 1000,
                                paidAt: booking.tokenPaidAt ? new Date(booking.tokenPaidAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '—',
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
                                roomAssigned: booking.roomAssigned || '—',
                                occupancy: booking.occupancy || '',
                                monthlyRent: Number(booking.amount || 0),
                                depositAmount: Number(booking.depositAmount || 0),
                                depositMonths: Number(booking.depositMonths || 1),
                                moveInDate: booking.onboardingDate || booking.moveInDate || '—',
                                signedAt: booking.agreementSignedAt ? new Date(booking.agreementSignedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—',
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
                                roomAssigned: booking.roomAssigned || '—',
                                monthlyRent: Number(booking.amount || 0),
                                depositAmount: Number(booking.depositAmount || 0),
                                depositMonths: Number(booking.depositMonths || 1),
                                tokenAlreadyPaid: 1000,
                                finalAmountPaid: Math.max(0, Number(booking.amount || 0) + Number(booking.depositAmount || 0) - 1000),
                                paidAt: booking.paidAt ? new Date(booking.paidAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '—',
                                paymentMethod: booking.paymentMethod || 'Online',
                                paymentId: booking.paymentId || undefined,
                            }});
                        }}><FileText className="h-3.5 w-3.5 mr-1" /> Payment Receipt</Button>
                    )}
                    {!booking.agreementSigned && (isAgreementPending || (isPaid && !booking.agreementSigned)) && (
                        <Button size="sm" className="h-8 px-3 text-xs bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-full" onClick={() => setSigningBooking(booking)}>✍️ Sign Agreement</Button>
                    )}

                    {!isActive && !isVacating && !isCompleted && !isCancelled && booking.status !== 'REJECTED' && (
                        <button onClick={() => handleCancel(booking.id, booking.propertyName)} disabled={cancellingId === booking.id} className="h-8 px-4 text-[10px] font-black bg-red-600 text-white rounded-full uppercase tracking-wider">{cancellingId === booking.id ? '...' : '✖ Cancel'}</button>
                    )}
                </div>

                {expandedDocs === booking.id && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <StudentKYCUploader bookingId={booking.id} onUploadSuccess={() => { setExpandedDocs(null); fetchData(); }} />
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
                                                    roomAssigned: booking.roomAssigned || '—',
                                                    tokenAmount: booking.tokenAmount || 1000,
                                                    paidAt: booking.tokenPaidAt ? new Date(booking.tokenPaidAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '—',
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
                                                    roomAssigned: booking.roomAssigned || '—',
                                                    occupancy: booking.occupancy || '',
                                                    monthlyRent: Number(booking.amount || 0),
                                                    depositAmount: Number(booking.depositAmount || 0),
                                                    depositMonths: Number(booking.depositMonths || 1),
                                                    moveInDate: booking.onboardingDate || booking.moveInDate || '—',
                                                    signedAt: booking.agreementSignedAt ? new Date(booking.agreementSignedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—',
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
                                                    roomAssigned: booking.roomAssigned || '—',
                                                    monthlyRent: Number(booking.amount || 0),
                                                    depositAmount: Number(booking.depositAmount || 0),
                                                    depositMonths: Number(booking.depositMonths || 1),
                                                    tokenAlreadyPaid: 1000,
                                                    finalAmountPaid: Math.max(0, Number(booking.amount || 0) + Number(booking.depositAmount || 0) - 1000),
                                                    paidAt: booking.paidAt ? new Date(booking.paidAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '—',
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

    const [cancelModal, setCancelModal] = useState<{ id: string; name: string } | null>(null);
    const [cancelReason, setCancelReason] = useState("");

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
            const [bData, pData, profData, notifData] = await Promise.all([
                getBookings(),
                getStudentPaymentHistory(),
                getStudentProfile(),
                getPersistentNotifications(),
            ]);
            setBookings(bData);
            setPaymentHistory(pData);
            setProfile(profData);
            setRoomAllocNotifs((notifData as any[]).filter((n: any) => n.category === 'ROOM_ALLOCATED'));
        } catch (e) {
            console.error(e);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

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
        <div className="container mx-auto py-8 px-4 max-w-4xl">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold mb-2">My Dashboard</h1>
                    <p className="text-muted-foreground">Track your bookings, onboarding status and payment history.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData}>
                    <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
                <TabsList className="flex flex-wrap md:flex-nowrap w-full mb-8 p-1.5 bg-slate-100/80 rounded-2xl border shadow-inner h-auto">
                    {bookings.some((b: any) => ['ACTIVE', 'CHECKED_IN', 'CHECKIN_CONFIRMED'].includes(b.status)) && (
                        <TabsTrigger value="active-stay" className="flex-1 font-bold py-3 text-sm whitespace-nowrap">
                            <Building2 className="h-4 w-4 mr-2 hidden sm:block" /> Active Stay
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="bookings" className="flex-1 font-bold py-3 text-sm whitespace-nowrap">
                        <Calendar className="h-4 w-4 mr-2 hidden sm:block" /> My Bookings
                    </TabsTrigger>
                    <TabsTrigger value="payments" className="flex-1 font-bold py-3 text-sm whitespace-nowrap">
                        <CreditCard className="h-4 w-4 mr-2 hidden sm:block" /> Payments
                    </TabsTrigger>
                    <TabsTrigger value="profile" className="flex-1 font-bold py-3 text-sm whitespace-nowrap">
                        <User className="h-4 w-4 mr-2 hidden sm:block" /> My Profile
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="active-stay" className="space-y-6">
                    {(() => {
                        const activeStay = bookings.find((b: any) => ['ACTIVE', 'CHECKED_IN', 'CHECKIN_CONFIRMED'].includes(b.status));
                        if (!activeStay) return <div className="p-8 text-center text-muted-foreground">No active stay found.</div>;
                        return (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">My Active Stay</h2>
                                </div>
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
                            </div>
                        );
                    })()}
                </TabsContent>

                <TabsContent value="bookings" className="space-y-6">
                    {(() => {
                        const otherBookings = bookings
                            .filter((b: any) => !['ACTIVE', 'CHECKED_IN', 'CHECKIN_CONFIRMED'].includes(b.status))
                            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                        return (
                            <div className="space-y-6">
                                {/* ── Banners & Alerts Section ── */}
                                <div className="space-y-3">
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

                                    {/* Lifecycle Action Banners */}
                                    {otherBookings.map((booking: any) => {
                                        if (booking.status === 'APPROVED_PENDING_TOKEN')
                                            return <AlertBanner key={`alert-token-${booking.id}`} type="warning" message={`🔐 Pay ₹1,000 token to reserve your bed at ${booking.propertyName}.`} actionLabel="Pay Token" onAction={() => router.push(`/secure/payment?id=${booking.id}&type=token`)} />;
                                        if (booking.status === 'PHYSICAL_VERIFIED' && !booking.agreementSigned)
                                            return <AlertBanner key={`alert-phys-${booking.id}`} type="info" message={`🆔 ID verified at ${booking.propertyName}! Your Tenant ID is assigned — sign your rental agreement now.`} actionLabel="Sign Agreement Now" onAction={() => setSigningBooking(booking)} />;
                                        if (booking.status === 'ROOM_RESERVED' && !booking.agreementSigned)
                                            return <AlertBanner key={`alert-sign-${booking.id}`} type="info" message={`Token paid! Please sign your rental agreement for ${booking.propertyName}.`} actionLabel="Sign Agreement" onAction={() => setSigningBooking(booking)} />;
                                        if (booking.status === 'AGREEMENT_PENDING')
                                            return null;
                                        if (booking.status === 'MOVE_IN_SCHEDULED' || booking.status === 'BOOKING_CONFIRMED') {
                                            const finalAmt = Math.max(0, Number(booking.amount || 0) + Number(booking.depositAmount || 0) - 1000);
                                            return <AlertBanner key={`alert-final-${booking.id}`} type="error" message={`🔴 Final Payment Due ₹${finalAmt.toLocaleString('en-IN')} — Visit ${booking.propertyName} in person to pay and complete check-in.`} actionLabel="Pay Now" onAction={() => router.push(`/secure/payment?id=${booking.id}`)} />;
                                        }
                                        return null;
                                    })}
                                </div>

                                {/* ── Onboarding / Other Bookings ── */}
                                {otherBookings.length > 0 ? (
                                    <div className="space-y-4">
                                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 px-1">Onboarding & Other Bookings</h2>
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
                                    <Card>
                                        <CardContent className="p-12 text-center space-y-4">
                                            <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-2xl">🔎</div>
                                            <div className="space-y-1">
                                                <p className="font-bold text-slate-800">No active or pending bookings</p>
                                                <p className="text-sm text-muted-foreground">Discover verified student housing across India with RentPe.</p>
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

                <TabsContent value="payments">
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-blue-500" /> Payment History</CardTitle></CardHeader>
                        <CardContent>
                            {paymentHistory.length === 0 ? <div className="text-center py-8 text-muted-foreground">No payments yet.</div> : (
                                <div className="rounded-xl border overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Method</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead>Transaction ID</TableHead>
                                                <TableHead className="text-center">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paymentHistory.map((p: any, idx: number) => {
                                                const statusStyle = p.status === 'SUCCESS'
                                                    ? 'bg-green-100 text-green-700'
                                                    : p.status === 'PENDING'
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : p.status === 'FAILED'
                                                    ? 'bg-red-100 text-red-700'
                                                    : p.status === 'REFUNDED'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-slate-100 text-slate-600';
                                                const typeLabels: Record<string, string> = {
                                                    TOKEN_PAYMENT: '🔒 Token',
                                                    BOOKING_PAYMENT: '🏠 Joining',
                                                    RENT_INVOICE: '📅 Rent',
                                                    MONTHLY_RENT: '📅 Rent',
                                                    SECURITY_DEPOSIT: '🛡 Deposit',
                                                };
                                                return (
                                                    <TableRow key={idx}>
                                                        <TableCell className="font-medium text-xs whitespace-nowrap">{new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                                                        <TableCell className="text-xs max-w-[200px] truncate" title={p.description}>{p.description}</TableCell>
                                                        <TableCell><span className="text-[10px] bg-muted px-2 py-1 rounded font-medium uppercase tracking-wider whitespace-nowrap">{typeLabels[p.type] || p.type.replace(/_/g, ' ')}</span></TableCell>
                                                        <TableCell><span className="text-[10px] font-bold uppercase text-slate-500">{(p.method || 'ONLINE').replace(/_/g, ' ')}</span></TableCell>
                                                        <TableCell className="text-right font-bold">₹{Number(p.amount).toLocaleString('en-IN')}</TableCell>
                                                        <TableCell className="font-mono text-[10px] text-slate-500 max-w-[140px] truncate" title={p.transactionId || '—'}>{p.transactionId || <span className="text-slate-300">N/A</span>}</TableCell>
                                                        <TableCell className="text-center">
                                                            <span className={`text-[10px] font-black px-2 py-1 rounded-full ${statusStyle}`}>{p.status}</span>
                                                            {p.status === 'SUCCESS' && (
                                                                <Button variant="ghost" size="sm" className="block mx-auto mt-1 h-6 text-[10px] text-blue-600 px-1" onClick={() => handleDownloadReceipt(p)}>
                                                                    <Download className="h-3 w-3 mr-0.5 inline" /> PDF
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="profile" className="space-y-6">
                    <Card className="border-none shadow-xl bg-white overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white p-8">
                            <div className="flex items-center gap-6">
                                <div className="h-20 w-20 rounded-2xl bg-white/20 flex items-center justify-center border-2 border-white/30 text-white"><User className="h-10 w-10" /></div>
                                <div><CardTitle className="text-3xl font-black">{profile?.name || "Verified Resident"}</CardTitle><CardDescription className="text-white/80 font-bold mt-1 uppercase tracking-widest text-[10px]">{profile?.displayId} • Verified Resident</CardDescription></div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Full Legal Name</label><div className="text-lg font-black text-slate-800">{profile?.name}</div></div>
                                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Official Email</label><div className="text-lg font-black text-slate-800">{profile?.email}</div></div>
                                </div>
                                <div className="space-y-6">
                                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Occupancy Status</label><Badge className="bg-indigo-100 text-indigo-700 px-4 py-1.5 font-black text-[10px] uppercase">ACTIVE RESIDENT</Badge></div>
                                    <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center justify-between"><div><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Loyalty Points</p><p className="text-xl font-black text-indigo-700">{profile?.loyaltyPoints || 0} Points</p></div><CreditCard className="h-8 w-8 text-indigo-200" /></div>
                                </div>
                            </div>
                            <div className="p-8 bg-slate-900 rounded-[32px] text-white shadow-2xl border-4 border-slate-800 relative overflow-hidden">
                                <div className="relative z-10 flex justify-between items-start mb-12">
                                    <div><div className="text-[10px] font-black tracking-[0.2em] text-indigo-400 uppercase mb-1">RentPe Digital Identity</div><div className="text-2xl font-black italic tracking-tighter">VERIFIED PASS</div></div>
                                    <Shield className="h-10 w-10 text-indigo-400" />
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-6">
                                    <div><p className="text-[9px] text-slate-500 uppercase mb-1.5">Identity</p><p className="text-sm font-black">{profile?.name}</p></div>
                                    <div><p className="text-[9px] text-slate-500 uppercase mb-1.5">Member Code</p><p className="text-sm font-black font-mono">{profile?.displayId}</p></div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Models */}
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
                            signedDevice: deviceInfo.userAgent
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

            {/* Cancel Modal */}
            {cancelModal && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl p-8 space-y-6 shadow-2xl">
                        <div className="flex items-center gap-3"><XCircle className="h-6 w-6 text-red-600" /><h3 className="font-black text-xl">Cancel Booking</h3></div>
                        <textarea className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm resize-none h-28" placeholder="Reason..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                        <div className="flex gap-4"><Button variant="outline" className="flex-1" onClick={() => setCancelModal(null)}>BACK</Button><Button variant="destructive" className="flex-1" onClick={confirmCancelStudent} disabled={!cancelReason.trim() || cancellingId === cancelModal.id}>CONFIRM</Button></div>
                    </div>
                </div>
            )}
        </div>
    );
}
