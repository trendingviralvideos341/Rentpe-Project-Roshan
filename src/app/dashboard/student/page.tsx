"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getBookings, cancelBooking, signAgreement, completeVacate } from "@/actions/bookings";
import { getTenantDocuments, uploadTenantDocument } from "@/actions/documents";
import { changeFoodPreference } from "@/actions/food";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCcw, FileText, BedDouble, Calendar, CreditCard, CheckCircle, XCircle, UploadCloud, ChevronDown, ChevronUp, AlertTriangle, Phone, Mail, User, History, Shield, Building2, Download, Star, Lock, PackageOpen, LogOut } from "lucide-react";
import { getStudentPaymentHistory } from "@/actions/payments";
import RentReceipt from "@/components/bookings/RentReceipt";
import { SubmitReviewModal } from "@/components/reviews/SubmitReviewModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateInvoicePDF } from "@/utils/invoiceGenerator";
import { BookingTimeline } from "@/components/ui/BookingTimeline";
import { StudentKYCUploader } from "@/components/booking/StudentKYCUploader";
import { PropertyAgreementModal } from "@/components/booking/PropertyAgreementModal";
import { BookingFeeBreakdown } from "@/components/booking/BookingFeeBreakdown";
import { toast } from "sonner";
import { getStudentProfile, updateStudentProfile } from "@/actions/student";
import { Badge } from "@/components/ui/badge";

const TYPE_LABELS: Record<string, string> = {
    ID_PROOF: "🪪 ID Proof",
    ADDRESS_PROOF: "🏠 Address Proof",
    COLLEGE_COMPANY: "🎓 College / Company Letter",
    SELFIE: "📸 Current Selfie",
};
const DOC_TYPES = ["ID_PROOF", "ADDRESS_PROOF", "COLLEGE_COMPANY", "SELFIE"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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
        toast(`${label === 'enable' ? '🍽 Enable' : '🚫 Disable'} food service?`, {
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
                    <p className="text-xs font-black text-orange-700">🍽 Food Service (Optional)</p>
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


// ── End of Utility Components ──

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

    const [cancelModal, setCancelModal] = useState<{ id: string; name: string } | null>(null);
    const [cancelReason, setCancelReason] = useState("");

    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTab = searchParams.get('tab') || 'bookings';

    const onTabChange = (value: string) => {
        router.push(`/dashboard/student?tab=${value}`);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const [bData, pData, profData] = await Promise.all([
                getBookings(),
                getStudentPaymentHistory(),
                getStudentProfile(),
            ]);
            setBookings(bData);
            setPaymentHistory(pData);
            setProfile(profData);
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

            {/* No self-upgrade CTA — to become an Owner, contact RentPe support */}

            <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
                <TabsList className="flex flex-wrap md:flex-nowrap w-full mb-8 p-1.5 bg-slate-100/80 rounded-2xl border shadow-inner h-auto">
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

                <TabsContent value="bookings" className="space-y-4">
                    {bookings.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center">
                                    <p className="text-muted-foreground mr-6">Discover verified student housing across India with RentPe.</p>
                                <Button className="mt-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold" asChild>
                                    <Link href="/search">🔍 Find PG</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {/* Actionable Alerts Unified Banner */}
                            {bookings.some((b: any) =>
                b.status === 'KYC_PENDING' || b.status === 'APPROVED_KYC_PENDING' || b.status === 'KYC_FAILED' ||
                b.status === 'AGREEMENT_PENDING' ||
                (b.status === 'APPROVED' && !!b.roomAssigned && !b.agreementSigned) ||
                ((b.status === 'PAID' || b.status === 'CASH_PAID' || b.status === 'MOVE_IN_SCHEDULED') && !b.agreementSigned)
            ) && (
                <div className="space-y-3 mb-6">
                    {bookings.map((booking: any) => {
                        if (booking.status === 'KYC_PENDING' || booking.status === 'APPROVED_KYC_PENDING')
                            return <AlertBanner key={`alert-kyc-${booking.id}`} type="warning" message={`Upload KYC documents for ${booking.propertyName} to proceed.`} actionLabel="Upload" onAction={() => { setExpandedDocs(booking.id); document.getElementById(`booking-${booking.id}`)?.scrollIntoView({ behavior: 'smooth' }); }} />;
                        if (booking.status === 'KYC_FAILED')
                            return <AlertBanner key={`alert-kycfail-${booking.id}`} type="error" message={`KYC Failed for ${booking.propertyName}. ${booking.kycNotes ? `Reason: ${booking.kycNotes}` : ''} Please re-upload your documents.`} actionLabel="Re-upload" onAction={() => { setExpandedDocs(booking.id); document.getElementById(`booking-${booking.id}`)?.scrollIntoView({ behavior: 'smooth' }); }} />;
                        if (booking.status === 'AGREEMENT_PENDING')
                            return <AlertBanner key={`alert-agre-${booking.id}`} type="info" message={`Please sign your rental agreement for ${booking.propertyName} to confirm your booking.`} actionLabel="Sign Now" onAction={() => setSigningBooking(booking)} />;
                        if (booking.status === 'APPROVED' && booking.roomAssigned && !booking.agreementSigned)
                            return <AlertBanner key={`alert-pay-${booking.id}`} type="warning" message={`Room allocated at ${booking.propertyName}! Pay now to confirm your booking.`} actionLabel="Pay Now" onAction={() => document.getElementById(`booking-${booking.id}`)?.scrollIntoView({ behavior: 'smooth' })} />;
                        if ((booking.status === 'PAID' || booking.status === 'CASH_PAID' || booking.status === 'MOVE_IN_SCHEDULED') && !booking.agreementSigned)
                            return <AlertBanner key={`alert-paidsign-${booking.id}`} type="info" message={`Sign Agreement: Payment confirmed for ${booking.propertyName}. Please sign to complete.`} actionLabel="Sign Now" onAction={() => setSigningBooking(booking)} />;
                        return null;
                    })}
                </div>
            )}

                            {bookings.map((booking: any) => {
                                const isKycPending = booking.status === 'KYC_PENDING' || booking.status === 'APPROVED_KYC_PENDING' || booking.status === 'KYC_FAILED';
                                // Payment pending = room allocated but student hasn't paid yet
                                const isPaymentPending = (booking.status === 'APPROVED' || booking.status === 'APPROVED_KYC_PENDING' || booking.status === 'KYC_PENDING' || booking.status === 'ROOM_RESERVED') && !!booking.roomAssigned;
                                const isAgreementPending = booking.status === 'AGREEMENT_PENDING';
                                const isApproved = isKycPending || isPaymentPending || isAgreementPending;
                                const isCheckedIn = booking.status === 'CHECKED_IN' || booking.status === 'BOOKING_CONFIRMED' || booking.status === 'ACTIVE' || booking.status === 'CHECKIN_CONFIRMED';
                                const isPaid = (booking.status === 'PAID' || booking.status === 'CASH_PAID' || booking.status === 'MOVE_IN_SCHEDULED') && !isCheckedIn;
                                const isActive = booking.status === 'ACTIVE' || booking.status === 'CHECKED_IN' || booking.status === 'CHECKIN_CONFIRMED';
                                const isVacating = booking.status === 'VACATING';
                                const isCompleted = booking.status === 'COMPLETED' || booking.status === 'CHECKED_OUT';
                                const isCancelled = booking.status === 'CANCELLED' || booking.status === 'EXPIRED';
                                const showDocs = isKycPending || isPaymentPending || isPaid || isCheckedIn || isActive;
                                const hasPendingAmount = (isPaid || isPaymentPending) && booking.pendingAmount && parseFloat(booking.pendingAmount) > 0;
                                // Vacating: all dues must be paid for Complete Vacate button to be green
                                const hasPendingDues = booking.tenant?.rentRecords?.some((r: any) => !r.paid) ?? false;

                                return (
                                    <Card key={booking.id} className={`${isApproved ? "border-green-400 border-2" : isPaid ? "border-blue-300 border-2" : hasPendingAmount ? "border-red-400 border-2" : isCancelled ? "border-gray-300 opacity-70" : ""}`}>
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start flex-wrap gap-2">
                                                <div>
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                                                        <Building2 className="h-3 w-3" /> Property
                                                    </div>
                                                    <CardTitle className="flex items-center gap-2">
                                                        {booking.propertyName}
                                                    </CardTitle>
                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mt-2">
                                                        <User className="h-3 w-3" /> Guest: <span className="text-foreground font-bold">{booking.guestName}</span>
                                                    </div>
                                                    <CardDescription className="mt-1">
                                                        Ref: {booking.displayId} • {new Date(booking.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                                                    </CardDescription>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                                                        isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                                                        isVacating ? 'bg-orange-100 text-orange-700 border-orange-300' :
                                                        isCompleted ? 'bg-slate-100 text-slate-600 border-slate-300' :
                                                        isCancelled ? 'bg-gray-100 text-gray-500 border-gray-300' :
                                                        isPaid ? 'bg-blue-100 text-blue-700 border-blue-300' :
                                                        isApproved ? 'bg-violet-100 text-violet-700 border-violet-300' :
                                                        'bg-gray-100 text-gray-600 border-gray-300'
                                                    }`}>
                                                        {booking.status.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                            </div>
                                        </CardHeader>

                                        <CardContent className="space-y-3">
                                            {/* ── Pending Payment RED Banner ── */}
                                            {hasPendingAmount && (
                                                <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 animate-pulse">
                                                    <div className="flex items-center gap-2 text-red-700 font-bold text-sm mb-1">
                                                        <AlertTriangle className="h-5 w-5" />
                                                        ⚠️ Pending Payment: ₹{booking.pendingAmount}
                                                    </div>
                                                    <p className="text-xs text-red-600">The owner has updated your booking details. Please pay the remaining balance to complete the process.</p>
                                                    <Button className="mt-2 bg-red-600 hover:bg-red-700 text-white font-bold" size="sm" asChild>
                                                        <Link href={`/secure/payment?id=${booking.id}&amount=${booking.pendingAmount}`}>💳 Pay ₹{booking.pendingAmount} Now</Link>
                                                    </Button>
                                                </div>
                                            )}

                                            {/* ── Status Badge ── */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-medium">Stage:</span>
                                                {(booking.status === "APPLIED" || booking.status === "PENDING_APPROVAL") && (
                                                    <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded">⏳ Waiting for Approval</span>
                                                )}
                                                {isKycPending && (
                                                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">📝 KYC Verification</span>
                                                )}
                                                {isPaymentPending && (
                                                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded">💳 Payment Pending</span>
                                                )}
                                                {isPaid && !booking.agreementSigned && (
                                                    <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded">✍️ Sign Agreement</span>
                                                )}
                                                {isPaid && booking.agreementSigned && (
                                                    <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded">📅 Ready for Move-in</span>
                                                )}
                                                {isCheckedIn && (
                                                    <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">🏠 Checked-in & Active</span>
                                                )}
                                                {isCancelled && (
                                                    <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2 py-1 rounded">🚫 Cancelled</span>
                                                )}
                                            </div>



                                            {/* ── Dynamic Fee Breakdown (when room is allocated and payment pending) ── */}
                                            {isPaymentPending && booking.roomAssigned && (
                                                <div className="w-full bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-400 rounded-2xl p-5 space-y-4">
                                                    <p className="text-sm font-black text-indigo-800">💳 Complete Your Payment</p>
                                                    <p className="text-xs text-indigo-600">Room <strong>{booking.roomAssigned}</strong> is reserved for you. Pay now to confirm.</p>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-600">Monthly Rent</span>
                                                            <span className="font-bold">₹{Number(booking.amount || booking.room?.price || 0).toLocaleString('en-IN')}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-emerald-600">Security Deposit ({booking.depositMonths || 2}m)</span>
                                                            <span className="font-bold text-emerald-700">₹{Number(booking.depositAmount || 0).toLocaleString('en-IN')}</span>
                                                        </div>
                                                        {booking.foodSelected && booking.property?.foodPricePerMonth && (
                                                            <div className="flex justify-between">
                                                                <span className="text-orange-600">Food Charge/month</span>
                                                                <span className="font-bold">₹{Number(booking.property.foodPricePerMonth).toLocaleString('en-IN')}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between pt-2 border-t border-indigo-200 font-black text-indigo-900">
                                                            <span>Total Payable Now</span>
                                                            <span>₹{(Number(booking.amount || booking.room?.price || 0) + Number(booking.depositAmount || 0)).toLocaleString('en-IN')}</span>
                                                        </div>
                                                    </div>
                                                    <Button className="w-full bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-black h-12 rounded-2xl shadow-lg shadow-indigo-200" asChild>
                                                        <a href={`/secure/payment?id=${booking.id}&amount=${Number(booking.amount || 0) + Number(booking.depositAmount || 0)}&type=booking`}>
                                                            💳 Pay ₹{(Number(booking.amount || 0) + Number(booking.depositAmount || 0)).toLocaleString('en-IN')} Online Now
                                                        </a>
                                                    </Button>
                                                    <p className="text-[10px] text-center text-indigo-500">Secured payment · Deposit refundable · No hidden fees</p>
                                                </div>
                                            )}

                                            {/* ── Agreement Modal + Download ── */}
                                            <PropertyAgreementModal
                                                isOpen={!!signingBooking && signingBooking.id === booking.id}
                                                onClose={() => setSigningBooking(null)}
                                                onAccept={async () => {
                                                    const toastId = toast.loading("Signing agreement...");
                                                    try {
                                                        const agreementId = `AGT-${Date.now()}-${booking.id.slice(0, 8).toUpperCase()}`;
                                                        await signAgreement(booking.id, { agreementId });
                                                        toast.success("Agreement signed! Welcome aboard 🎉", { id: toastId });
                                                        await fetchData();
                                                        setSigningBooking(null);
                                                    } catch (e: any) {
                                                        toast.error(e.message || "Failed to sign agreement", { id: toastId });
                                                    }
                                                }}
                                                property={{
                                                    id: booking.propertyId || "N/A",
                                                    name: booking.propertyName,
                                                    address: booking.propertyAddress || booking.property?.address || "N/A",
                                                    city: booking.propertyCity || booking.property?.city || "N/A",
                                                    noticePeriod: booking.property?.noticePeriod || 30,
                                                    refundPolicy: booking.property?.refundPolicy,
                                                }}
                                                room={{
                                                    roomNumber: booking.roomAssigned?.split(' ')[0] || booking.room?.roomNumber || "TBD",
                                                    type: booking.occupancy || booking.room?.type || "N/A",
                                                    price: Number(booking.room?.price) || Number(String(booking.amount).replace(/[^0-9.]/g, '')) || 0,
                                                    depositMonths: booking.depositMonths || booking.room?.depositMonths || 1,
                                                }}
                                                tenant={{
                                                    name: booking.guestName,
                                                    email: booking.guestEmail || profile?.email,
                                                }}
                                                moveInDate={booking.onboardingDate || booking.moveInDate || "TBD"}
                                                depositAmount={
                                                    Number(booking.depositAmount) > 0
                                                        ? Number(booking.depositAmount)
                                                        : (Number(booking.room?.price) || Number(String(booking.amount).replace(/[^0-9.]/g, '')) || 0) * (booking.depositMonths || booking.room?.depositMonths || 1)
                                                }
                                                platformFee={0}
                                            />

                                            {/* ── Professional Journey Stepper (Phase 31) ── */}
                                            {!isCancelled && booking.status !== "REJECTED" && (
                                                <div className="py-4 border-y border-slate-100 my-4 bg-slate-50/50 rounded-xl px-4">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Booking Progress</p>
                                                    <BookingTimeline booking={booking} />
                                                </div>
                                            )}

                                            {(isApproved || isPaid || isCheckedIn) && (
                                                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3">
                                                    <p className="text-xs font-bold text-purple-700 mb-2">📋 Allocation Details</p>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                                        {booking.roomAssigned && (
                                                            <div className="flex items-center gap-1">
                                                                <BedDouble className="h-3 w-3 text-purple-500" />
                                                                <span className="font-medium">Room:</span> {booking.roomAssigned}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-medium">Type:</span> {booking.occupancy}
                                                        </div>
                                                        {(booking.onboardingDate || booking.moveInDate) && (
                                                            <div className="flex items-center gap-1">
                                                                <Calendar className="h-3 w-3 text-purple-500" />
                                                                <span className="font-medium">Move-in:</span> {booking.onboardingDate || booking.moveInDate}
                                                            </div>
                                                        )}
                                                        {booking.paymentMethod && (
                                                            <div className="flex items-center gap-1">
                                                                <CreditCard className="h-3 w-3 text-purple-500" />
                                                                <span className="font-medium">Payment:</span> {booking.paymentMethod}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* ── Section 6A & 7A — Student Food Management ── */}
                                                    {booking.property?.foodType === 'INCLUDED' && (
                                                        <div className="mt-3 flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                                                            <span>🍱</span>
                                                            <div>
                                                                <p className="text-xs font-black text-green-700">Meals Included in Rent</p>
                                                                <p className="text-[10px] text-green-600">Breakfast, Lunch & Dinner. Cannot be removed.</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {booking.property?.foodType === 'OPTIONAL' && (
                                                        <FoodToggleSection booking={booking} onRefresh={fetchData} />
                                                    )}
                                                    {(!booking.property?.foodType || booking.property?.foodType === 'NOT_AVAILABLE') && (
                                                        <div className="mt-3 flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                                                            <span>🚫</span>
                                                            <p className="text-xs font-bold text-slate-500">No food service at this property.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex flex-wrap items-center gap-2">
                                                {/* Rent Receipt */}
                                                {(isPaid || isCheckedIn || isActive || isVacating || isCompleted) && (
                                                    <Button variant="outline" size="sm" className="text-xs h-8 px-3 border-slate-200 rounded-full"
                                                        onClick={() => setSelectedBooking(booking)}>
                                                        <FileText className="h-3.5 w-3.5 mr-1" /> Rent Receipt
                                                    </Button>
                                                )}
                                                {/* Agreement PDF */}
                                                {booking.agreementSigned && (
                                                    <Button variant="outline" size="sm" className="text-xs h-8 px-3 border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-full"
                                                        onClick={() => toast.info('Your signed agreement is stored securely. Contact support to download.')}>
                                                        <Download className="h-3.5 w-3.5 mr-1" /> Agreement PDF
                                                    </Button>
                                                )}
                                                {/* Share Experience */}
                                                {(isCheckedIn || isActive) && (
                                                    <Button size="sm" className="h-8 px-3 text-xs bg-yellow-100 text-yellow-700 hover:bg-yellow-200 font-bold border border-yellow-300 rounded-full"
                                                        onClick={() => setReviewBooking(booking)}>
                                                        <Star className="h-3.5 w-3.5 mr-1 fill-yellow-500 text-yellow-500" /> Rate Us
                                                    </Button>
                                                )}
                                                {/* ✍️ Sign Agreement CTA */}
                                                {(isAgreementPending || (isPaid && !booking.agreementSigned)) && (
                                                    <Button size="sm" className="h-8 px-3 text-xs bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-full"
                                                        onClick={() => setSigningBooking(booking)}>
                                                        ✍️ Sign Agreement
                                                    </Button>
                                                )}
                                                {/* 🔴 Cancel Booking button — shown on every cancellable stage */}
                                                {!isActive && !isVacating && !isCompleted && !isCancelled && booking.status !== 'REJECTED' && (
                                                    <button
                                                        onClick={() => handleCancel(booking.id, booking.propertyName)}
                                                        disabled={cancellingId === booking.id}
                                                        className="h-8 px-4 text-[10px] font-black bg-red-600 hover:bg-red-700 text-white rounded-full transition-all active:scale-95 shadow-sm disabled:opacity-50 uppercase tracking-wider">
                                                        {cancellingId === booking.id ? 'Cancelling...' : '✕ Cancel Booking'}
                                                    </button>
                                                )}
                                            </div>

                                            {/* ── ACTIVE TENANT: Vacating Section ── */}
                                            {(isActive || isVacating) && (
                                                <div className="mt-4 border-t border-dashed border-slate-200 pt-4 space-y-3">
                                                    {isActive && !isVacating && (
                                                        <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                                            <div>
                                                                <p className="text-xs font-black text-amber-800">🚪 Planning to Move Out?</p>
                                                                <p className="text-[10px] text-amber-600">Submit a vacating notice to start the checkout process.</p>
                                                            </div>
                                                            <Button size="sm" variant="outline"
                                                                className="text-xs border-amber-400 text-amber-700 hover:bg-amber-50 font-bold"
                                                                onClick={() => {
                                                                    const reason = prompt('Reason for vacating (e.g. course ended, job change):');
                                                                    if (!reason) return;
                                                                    import('@/actions/vacatingNotice').then(({ fileVacatingNotice }) => {
                                                                        const dt = new Date();
                                                                        dt.setDate(dt.getDate() + 30);
                                                                        fileVacatingNotice({ bookingId: booking.id, plannedMoveOut: dt.toISOString().split('T')[0], reason })
                                                                            .then(() => { toast.success('Vacating notice submitted!'); fetchData(); })
                                                                            .catch((e: any) => toast.error(e.message || 'Failed to submit notice.'));
                                                                    });
                                                                }}>
                                                                <PackageOpen className="h-3.5 w-3.5 mr-1" /> Initiate Vacating
                                                            </Button>
                                                        </div>
                                                    )}

                                                    {isVacating && (
                                                        <div className="space-y-3">
                                                            <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                                                                <p className="text-xs font-black text-orange-800">📦 Vacating in Progress</p>
                                                                <p className="text-[10px] text-orange-600">Your vacating notice has been submitted. Once owner acknowledges and all dues are cleared, you can complete vacate.</p>
                                                            </div>
                                                            {hasPendingDues ? (
                                                                <div className="p-3 bg-red-50 border-2 border-red-300 rounded-xl">
                                                                    <p className="text-xs font-black text-red-700">⚠️ Pending Dues Must Be Cleared First</p>
                                                                    <p className="text-[10px] text-red-500">Pay all pending rent before completing vacate.</p>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    disabled={vacatingId === booking.id}
                                                                    onClick={async () => {
                                                                        setVacatingId(booking.id);
                                                                        try {
                                                                            const result = await completeVacate(booking.id);
                                                                            toast.success('✅ Stay Completed! Thank you for being a RentPe resident.');
                                                                            // Download settlement summary
                                                                            const sd = result.settlementData;
                                                                            const { generateInvoicePDF } = await import('@/utils/invoiceGenerator');
                                                                            generateInvoicePDF({
                                                                                invoiceId: `VACATE-${booking.displayId}`,
                                                                                date: sd.moveOutDate,
                                                                                description: `Vacate Summary — ${sd.propertyName}`,
                                                                                month: sd.moveOutDate,
                                                                                amount: sd.totalPaidRent,
                                                                                tenantName: sd.tenantName,
                                                                                paymentMethod: 'Final Settlement',
                                                                            });
                                                                            await fetchData();
                                                                        } catch (e: any) {
                                                                            toast.error(e.message || 'Could not complete vacate.');
                                                                        } finally {
                                                                            setVacatingId(null);
                                                                        }
                                                                    }}
                                                                    className="w-full py-3 flex items-center justify-center gap-2 text-sm font-black bg-green-600 hover:bg-green-700 text-white rounded-2xl shadow-lg shadow-green-100 transition-all active:scale-[0.99] disabled:opacity-50">
                                                                    {vacatingId === booking.id ? (
                                                                        <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Processing...</>
                                                                    ) : (
                                                                        <><LogOut className="w-4 h-4" /> ✅ Complete Vacate &amp; Download Summary</>
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* ── COMPLETED: Download Vacate Summary ── */}
                                            {isCompleted && (
                                                <div className="mt-4 border-t border-dashed border-slate-200 pt-4">
                                                    <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                                                        <div>
                                                            <p className="text-xs font-black text-emerald-800">✅ Stay Completed</p>
                                                            <p className="text-[10px] text-emerald-600">Your tenancy has been successfully completed.</p>
                                                        </div>
                                                        <Button size="sm" variant="outline"
                                                            className="text-xs border-emerald-400 text-emerald-700 hover:bg-emerald-50 font-bold"
                                                            onClick={async () => {
                                                                const { generateInvoicePDF } = await import('@/utils/invoiceGenerator');
                                                                generateInvoicePDF({
                                                                    invoiceId: `VACATE-${booking.displayId}`,
                                                                    date: new Date().toLocaleDateString('en-IN'),
                                                                    description: `Vacate Summary — ${booking.propertyName}`,
                                                                    month: new Date().toLocaleDateString('en-IN'),
                                                                    amount: 0,
                                                                    tenantName: booking.guestName,
                                                                    paymentMethod: 'Completed',
                                                                });
                                                            }}>
                                                            <Download className="h-3.5 w-3.5 mr-1" /> Download Summary
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}


                                        </CardContent>
                                    </Card>
                                );
                            })}

                            {selectedBooking && (
                                <RentReceipt booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
                            )}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="payments">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="h-5 w-5 text-blue-500" /> Payment History
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {paymentHistory.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No payment history available yet.
                                </div>
                            ) : (
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead className="text-center">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paymentHistory.map((p, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="font-medium">
                                                        {new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </TableCell>
                                                    <TableCell>{p.description}</TableCell>
                                                    <TableCell>
                                                        <span className="text-[10px] bg-muted px-2 py-1 rounded font-medium uppercase tracking-wider">
                                                            {p.type.replace('_', ' ')}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold">₹{p.amount.toLocaleString('en-IN')}</TableCell>
                                                    <TableCell className="text-center">
                                                        <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-1 rounded block w-fit mx-auto">
                                                            {p.status}
                                                        </span>
                                                        {p.status === 'PAID' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="mt-1 h-6 text-[10px] text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                                                onClick={() => handleDownloadReceipt(p)}
                                                            >
                                                                <Download className="h-3 w-3 mr-1" />
                                                                Receipt
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
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
                            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                                <div className="flex items-center gap-6 text-center md:text-left">
                                    <div className="h-20 w-20 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border-2 border-white/30 text-white">
                                        <User className="h-10 w-10" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-3xl font-black">
                                            {profile?.name || "Verified Resident"}
                                        </CardTitle>
                                        <CardDescription className="text-white/80 font-bold mt-1 uppercase tracking-widest text-[10px]">
                                            {profile?.displayId || "TNT-000000"} • {profile?.occupationType === 'RESIDENT' ? 'Verified Resident' : (profile?.occupationType === 'BOOKED' ? 'Future Resident' : 'Guest Member')}
                                        </CardDescription>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Full Legal Name</label>
                                        <div className="text-lg font-black text-slate-800">{profile?.name}</div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Official Email</label>
                                        <div className="text-lg font-black text-slate-800 flex items-center gap-2">
                                            {profile?.email} <Shield className="h-4 w-4 text-emerald-500" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Primary Contact</label>
                                        <div className="text-lg font-black text-slate-800">{profile?.phone || "Not set"}</div>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Occupancy Status</label>
                                        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-none px-4 py-1.5 font-black text-[10px] uppercase">
                                            {profile?.occupationType || "RESIDENT"}
                                        </Badge>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Account Health</label>
                                        <div className="flex items-center gap-3">
                                            <div className={`h-3 w-3 rounded-full animate-pulse shadow-md ${
                                                profile?.accountHealth === 'EXCELLENT' ? 'bg-emerald-500 shadow-emerald-500/50' : 
                                                profile?.accountHealth === 'GOOD' ? 'bg-indigo-500 shadow-indigo-500/50' : 
                                                'bg-amber-500 shadow-amber-500/50'
                                            }`}></div>
                                            <span className="text-sm font-black text-slate-800 uppercase tracking-wide">
                                                {profile?.accountHealth || "Action Required"} • {
                                                    profile?.kycStatus === 'VERIFIED' ? 'KYC Cleared' : 
                                                    profile?.kycStatus === 'UNDER_REVIEW' ? 'KYC in Review' : 
                                                    profile?.kycStatus === 'REJECTED' ? 'KYC Rejected' : 'KYC Required'
                                                }
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center justify-between group hover:bg-indigo-50 transition-colors">
                                        <div>
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Loyalty Points</p>
                                            <p className="text-xl font-black text-indigo-700">{profile?.loyaltyPoints || 0} Points</p>
                                        </div>
                                        <CreditCard className="h-8 w-8 text-indigo-200 group-hover:text-indigo-400 transition-colors" />
                                    </div>
                                    <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Partner Since</p>
                                            <p className="text-sm font-black text-slate-700">
                                                {profile?.createdAt ? new Date(profile.createdAt).toLocaleString('en-IN', { 
                                                    day: '2-digit', month: 'long', year: 'numeric', 
                                                    hour: '2-digit', minute: '2-digit', hour12: true 
                                                }) : "January 2024"}
                                            </p>
                                        </div>
                                        <Calendar className="h-6 w-6 text-slate-300" />
                                    </div>
                                </div>
                            </div>


                            {/* ── Verified Digital Identity ── */}
                            <div className="relative p-8 bg-slate-900 rounded-[32px] text-white overflow-hidden shadow-2xl border-4 border-slate-800">
                                {/* Background patterns */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                                <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl"></div>
                                
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-12">
                                        <div>
                                            <div className="text-[10px] font-black tracking-[0.2em] text-indigo-400 uppercase mb-1">RentPe Digital Identity</div>
                                            <div className="text-2xl font-black italic tracking-tighter">
                                                {profile?.accountHealth === 'EXCELLENT' ? 'VERIFIED PASS' : 'BASIC PASS'}
                                            </div>
                                        </div>
                                        <div className="h-12 w-12 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
                                            <Shield className="h-6 w-6 text-indigo-400" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12">
                                        <div>
                                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Identity</p>
                                            <p className="text-sm font-black whitespace-nowrap overflow-hidden text-ellipsis">{profile?.name || "Verified Resident"}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Member Code</p>
                                            <p className="text-sm font-black font-mono">{profile?.displayId || "TNT-XXXX"}</p>
                                        </div>
                                        <div className="hidden md:block">
                                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">KYC Status</p>
                                            <p className={`text-sm font-black uppercase ${
                                                profile?.kycStatus === 'VERIFIED' ? 'text-emerald-400' : 
                                                profile?.kycStatus === 'UNDER_REVIEW' ? 'text-indigo-400' : 
                                                profile?.kycStatus === 'REJECTED' ? 'text-red-400' : 'text-amber-400'
                                            }`}>
                                                {profile?.kycStatus?.replace('_', ' ') || 'NOT STARTED'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-8 border-t border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 bg-white/5 rounded-lg flex items-center justify-center">
                                                <CheckCircle className="h-5 w-5 text-indigo-400" />
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Digital Validity</p>
                                                <p className="text-[10px] font-bold">
                                                    {profile?.kycStatus === 'VERIFIED' ? 'VERIFIED IDENTITY' : 'PENDING VALIDATION'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Authenticity Scan</p>
                                            <div className="flex items-center gap-1 bg-white/5 p-1 px-2 rounded-md">
                                                <div className={`h-2 w-2 rounded-full ${profile?.kycStatus === 'VERIFIED' ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
                                                <span className="text-[9px] font-black font-mono">HASH::{profile?.realAuthenticityHash || "0000000000"}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                                <div className="max-w-[70%]">
                                    <h4 className="text-sm font-black mb-1 flex items-center gap-2 text-slate-800">
                                        <Shield className="h-4 w-4 text-slate-400" /> Auto-fill Enabled
                                    </h4>
                                    <p className="text-xs text-slate-400 font-medium">
                                        Your profile details are automatically synced with all booking requests to ensure a seamless, high-fidelity experience.
                                    </p>
                                </div>
                                <Badge className="bg-emerald-50 text-emerald-700 border-none px-3 font-black text-[9px] uppercase tracking-widest">Active</Badge>
                            </div>

                            {/* ── Security & Password ── */}
                            <div className="p-8 bg-white border-2 border-slate-100 rounded-[32px] shadow-sm">
                                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                                    <div className="flex items-start gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
                                            <Lock className="h-6 w-6 text-indigo-600" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black text-slate-800">Security & Privacy</h4>
                                            <p className="text-sm text-slate-500 font-medium">Manage your account protection and password settings.</p>
                                        </div>
                                    </div>
                                    <Button 
                                        variant="outline"
                                        className="w-full md:w-auto border-2 border-indigo-100 text-indigo-700 font-black h-12 px-8 rounded-2xl hover:bg-indigo-50 transition-all uppercase tracking-tight text-[11px]"
                                        onClick={() => {
                                            toast("Send password reset link?", {
                                                description: "A secure link will be sent to your registered email.",
                                                action: {
                                                    label: "Send Link",
                                                    onClick: async () => {
                                                        const { forgotPassword } = await import("@/actions/auth");
                                                        const formData = new FormData();
                                                        formData.append('email', profile?.email || "");
                                                        const toastId = toast.loading("Sending secure reset link...");
                                                        const result = await forgotPassword(formData);
                                                        if (result.success) {
                                                            toast.success("Reset link sent! Check your email.", { id: toastId });
                                                        } else {
                                                            toast.error(result.error || "Failed to send reset link.", { id: toastId });
                                                        }
                                                    },
                                                },
                                            });
                                        }}
                                    >
                                        Change Password →
                                    </Button>
                                </div>
                                <div className="mt-6 flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest pl-2">
                                    <Shield className="h-3 w-3" /> Two-Factor Authentication (Coming Soon)
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Models rendering at the DOM root level */}
            {
                reviewBooking && (
                    <SubmitReviewModal
                        booking={reviewBooking}
                        isOpen={!!reviewBooking}
                        onClose={() => setReviewBooking(null)}
                    />
                )
            }

            {/* ── Cancel Modal ── */}
            {cancelModal && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 transition-all animate-in fade-in duration-300">
                    <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-8 space-y-6 shadow-2xl animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 duration-500">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
                                <XCircle className="h-6 w-6 text-red-600" />
                            </div>
                            <div>
                                <h3 className="font-black text-xl text-slate-800">Cancel Booking</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Termination Request</p>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600 font-medium leading-relaxed">
                                Are you sure you want to cancel your booking for <strong className="text-slate-900">{cancelModal.name}</strong>? This action cannot be reversed.
                            </p>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cancellation Reason (Mandatory)</label>
                                <textarea 
                                    className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm resize-none h-28 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 bg-slate-50/50 transition-all font-medium"
                                    placeholder="Please explain why you're cancelling..." 
                                    value={cancelReason} 
                                    onChange={e => setCancelReason(e.target.value)} 
                                />
                                {!cancelReason.trim() && (
                                    <p className="text-[10px] text-red-500 font-bold italic ml-1">※ Please add notes to enable cancellation</p>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <Button 
                                variant="outline" 
                                className="flex-1 h-12 rounded-2xl border-2 border-slate-100 font-black text-slate-600 hover:bg-slate-50 transition-all" 
                                onClick={() => { setCancelModal(null); setCancelReason(""); }}
                            >
                                GO BACK
                            </Button>
                            <Button 
                                variant="destructive" 
                                className="flex-1 h-12 rounded-2xl font-black bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale" 
                                onClick={confirmCancelStudent}
                                disabled={!cancelReason.trim() || cancellingId === cancelModal.id}
                            >
                                {cancellingId === cancelModal.id ? "CANCELLING..." : "CONFIRM CANCEL"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
