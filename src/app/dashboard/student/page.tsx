"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getBookings, cancelBooking, signAgreement } from "@/actions/bookings";
import { getTenantDocuments, uploadTenantDocument } from "@/actions/documents";
import { changeFoodPreference } from "@/actions/food";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCcw, FileText, BedDouble, Calendar, CreditCard, CheckCircle, XCircle, UploadCloud, ChevronDown, ChevronUp, AlertTriangle, Phone, Mail, User, History, Shield, Building2, Download, Star, Lock } from "lucide-react";
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
    const [selectedBooking, setSelectedBooking] = useState<any>(null);
    const [reviewBooking, setReviewBooking] = useState<any>(null);
    const [expandedDocs, setExpandedDocs] = useState<string | null>(null);
    const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
    const [signingBooking, setSigningBooking] = useState<any>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [profile, setProfile] = useState<any>(null);
    const [upgradeRequest, setUpgradeRequest] = useState<any | null | undefined>(undefined); // undefined = loading

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

    const handleCancel = async (bookingId: string) => {
        toast("Cancel this booking request?", {
            description: "This action cannot be undone.",
            action: {
                label: "Yes, Cancel",
                onClick: async () => {
                    setCancellingId(bookingId);
                    try {
                        await cancelBooking(bookingId);
                        toast.success("Booking cancelled successfully.");
                        await fetchData();
                    } catch (e: any) {
                        toast.error(e.message || "Failed to cancel booking.");
                    } finally {
                        setCancellingId(null);
                    }
                },
            },
        });
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
                b.status === 'APPROVED_PENDING_TOKEN' ||
                b.status === 'KYC_PENDING' || b.status === 'APPROVED_KYC_PENDING' || b.status === 'KYC_FAILED' ||
                b.status === 'AGREEMENT_PENDING' ||
                ((b.status === 'PAID' || b.status === 'CASH_PAID' || b.status === 'MOVE_IN_SCHEDULED') && !b.agreementSigned)
            ) && (
                <div className="space-y-3 mb-6">
                    {bookings.map((booking: any) => {
                        if (booking.status === 'APPROVED_PENDING_TOKEN')
                            return <AlertBanner key={`alert-token-${booking.id}`} type="error" message={`Action Required: Pay ₹${booking.tokenAmount || 1000} token to reserve your room at ${booking.propertyName}.`} actionLabel="Pay Token" onAction={() => document.getElementById(`booking-${booking.id}`)?.scrollIntoView({ behavior: 'smooth' })} />;
                        if (booking.status === 'KYC_PENDING' || booking.status === 'APPROVED_KYC_PENDING')
                            return <AlertBanner key={`alert-kyc-${booking.id}`} type="warning" message={`Upload KYC documents for ${booking.propertyName} to proceed.`} actionLabel="Upload" onAction={() => { setExpandedDocs(booking.id); document.getElementById(`booking-${booking.id}`)?.scrollIntoView({ behavior: 'smooth' }); }} />;
                        if (booking.status === 'KYC_FAILED')
                            return <AlertBanner key={`alert-kycfail-${booking.id}`} type="error" message={`KYC Failed for ${booking.propertyName}. ${booking.kycNotes ? `Reason: ${booking.kycNotes}` : ''} Please re-upload your documents.`} actionLabel="Re-upload" onAction={() => { setExpandedDocs(booking.id); document.getElementById(`booking-${booking.id}`)?.scrollIntoView({ behavior: 'smooth' }); }} />;
                        if (booking.status === 'AGREEMENT_PENDING')
                            return <AlertBanner key={`alert-agre-${booking.id}`} type="info" message={`Please sign your rental agreement for ${booking.propertyName} to confirm your booking.`} actionLabel="Sign Now" onAction={() => setSigningBooking(booking)} />;
                        if ((booking.status === 'PAID' || booking.status === 'CASH_PAID' || booking.status === 'MOVE_IN_SCHEDULED') && !booking.agreementSigned)
                            return <AlertBanner key={`alert-paidsign-${booking.id}`} type="info" message={`Sign Agreement: Payment confirmed for ${booking.propertyName}. Please sign to complete.`} actionLabel="Sign Now" onAction={() => setSigningBooking(booking)} />;
                        return null;
                    })}
                </div>
            )}

                            {bookings.map((booking: any) => {
                                const isTokenPending = booking.status === 'APPROVED_PENDING_TOKEN';
                                const isRoomReserved = booking.status === 'ROOM_RESERVED';
                                const isKycPending = booking.status === 'KYC_PENDING' || booking.status === 'APPROVED_KYC_PENDING' || booking.status === 'KYC_FAILED';
                                const isPaymentPending = booking.status === 'APPROVED_PAYMENT_PENDING' || booking.status === 'APPROVED';
                                const isAgreementPending = booking.status === 'AGREEMENT_PENDING';
                                const isApproved = isTokenPending || isRoomReserved || isKycPending || isPaymentPending || isAgreementPending;
                                const isCheckedIn = booking.status === 'CHECKED_IN' || booking.status === 'BOOKING_CONFIRMED' || booking.status === 'ACTIVE';
                                const isPaid = (booking.status === 'PAID' || booking.status === 'CASH_PAID' || booking.status === 'MOVE_IN_SCHEDULED') && !isCheckedIn;
                                const isCancelled = booking.status === 'CANCELLED' || booking.status === 'EXPIRED';
                                const isCashPending = booking.paymentMethod === 'CASH' && isPaymentPending;
                                const showDocs = isRoomReserved || isKycPending || isPaymentPending || isPaid || isCheckedIn;
                                const hasPendingAmount = (isPaid || isPaymentPending) && booking.pendingAmount && parseFloat(booking.pendingAmount) > 0;

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
                                                    <p className="font-bold text-lg">{booking.amount}</p>
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



                                            {/* ── Dynamic Fee Breakdown (Phase 4) ── */}
                                            {isApproved && booking.room && (
                                                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm mb-4">
                                                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-100">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Breakdown</p>
                                                    </div>
                                                    <BookingFeeBreakdown
                                                        rent={booking.room.price}
                                                        depositAmount={booking.depositAmount || (booking.room.price * (booking.depositMonths || 1))}
                                                        depositMonths={booking.depositMonths || booking.room.depositMonths || 1}
                                                        platformFee={booking.platformFeeAmount || 499}
                                                    />
                                                </div>
                                            )}

                                            {/* ── Unified Agreement Modal ── */}
                                            <PropertyAgreementModal
                                                isOpen={!!signingBooking && signingBooking.id === booking.id}
                                                onClose={() => setSigningBooking(null)}
                                                onAccept={async () => {
                                                    const toastId = toast.loading("Signing agreement...");
                                                    try {
                                                        await signAgreement(booking.id);
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
                                                platformFee={Number(booking.platformFeeAmount) || 0}
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

                                            {/* ── Action Buttons ── */}
                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                                <div className="flex gap-2">
                                                    {showDocs && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setExpandedDocs(expandedDocs === booking.id ? null : booking.id)}
                                                            className="text-xs"
                                                        >
                                                            <FileText className="h-4 w-4 mr-1.5" />
                                                            Documents {expandedDocs === booking.id ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                                                        </Button>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    {/* Cancel button for pending bookings */}
                                                    {/* 💳 Pay Token CTA */}
                                                    {isTokenPending && (
                                                        <div className="w-full bg-purple-50 border-2 border-purple-400 rounded-xl p-4 text-center">
                                                            <p className="text-sm font-bold text-purple-800 mb-1">💳 Pay Token to Reserve Your Room</p>
                                                            <p className="text-xs text-purple-600 mb-3">A token of ₹{booking.tokenAmount || 1000} locks your room for 7 days while you complete KYC.</p>
                                                            <div className="flex gap-2 justify-center">
                                                                <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold" size="sm" asChild>
                                                                    <a href={`/secure/payment?id=${booking.id}&amount=${booking.tokenAmount || 1000}&type=token`}>💳 Pay ₹{booking.tokenAmount || 1000} Token Online</a>
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* ✍️ Sign Agreement CTA */}
                                                    {isAgreementPending && (
                                                        <div className="w-full bg-violet-50 border-2 border-violet-400 rounded-xl p-4 text-center">
                                                            <p className="text-sm font-bold text-violet-800 mb-1">✍️ Please Sign Your Rental Agreement</p>
                                                            <p className="text-xs text-violet-600 mb-3">Your KYC has been verified! Sign the agreement to confirm your booking.</p>
                                                            <Button className="bg-violet-600 hover:bg-violet-700 text-white font-bold" size="sm" onClick={() => setSigningBooking(booking)}>
                                                                ✍️ Sign Agreement Now
                                                            </Button>
                                                        </div>
                                                    )}

                                                    {/* Cancel for pending */}
                                                    {booking.status === 'PENDING_APPROVAL' && (
                                                        <button
                                                            onClick={() => handleCancel(booking.id)}
                                                            disabled={cancellingId === booking.id}
                                                            className="px-6 py-2 text-[10px] font-black bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-full transition-all active:scale-95 shadow-sm uppercase tracking-widest disabled:opacity-50"
                                                        >
                                                            {cancellingId === booking.id ? "Cancelling..." : "❌ Cancel Request"}
                                                        </button>
                                                    )}
                                                    {isPaid && (
                                                        <Button variant="outline" size="sm" onClick={() => setSelectedBooking(booking)}>
                                                            <FileText className="h-4 w-4 mr-2" /> View Receipt
                                                        </Button>
                                                    )}
                                                    {isCheckedIn && (
                                                        <>
                                                            <Button variant="outline" size="sm" onClick={() => setSelectedBooking(booking)}>
                                                                <FileText className="h-4 w-4 mr-2" /> View Receipt
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => setReviewBooking(booking)}
                                                                className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 font-bold border border-yellow-300"
                                                            >
                                                                <Star className="h-4 w-4 mr-2 fill-yellow-500 text-yellow-500" /> Share Experience
                                                            </Button>
                                                        </>
                                                    )}
                                                    {isPaid && booking.agreementSigned && (
                                                        <Button className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold shadow-lg" asChild>
                                                            <Link href={`/dashboard/student/ready-to-move`}>🏃 Ready to Move-in</Link>
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* ── Document Section (Phase 31 KYC) ── */}
                                            {expandedDocs === booking.id && showDocs && (
                                                <div className="mt-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                                    <StudentKYCUploader
                                                        bookingId={booking.id}
                                                        existingDocs={booking.documents || []}
                                                        onUploadSuccess={() => fetchData()}
                                                    />
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
        </div >
    );
}
