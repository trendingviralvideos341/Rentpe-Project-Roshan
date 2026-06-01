"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Banknote, Smartphone, CheckCircle, AlertTriangle, ArrowLeft, Phone, BedDouble } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { cn } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { getBookingById, markBookingPaid, registerCashIntent, payTokenAmount } from "@/actions/bookings";
import { getCashPaymentEnabled } from "@/actions/platform";
import { createRazorpayOrder, verifyPayment } from "@/actions/payments";
import Script from "next/script";

const BUILDING_MGMT_PHONE = "+91 98765 43210";
const PG_OWNER_PHONE = "+91 91234 56789";

function PaymentPortal() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams.get("id");
    const paymentType = searchParams.get("type"); // "token" | null
    const isToken = paymentType === "token";

    const [method, setMethod] = useState<"online" | "cash">("online");
    const [isPaying, setIsPaying] = useState(false);
    const [isPaid, setIsPaid] = useState(false);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [allowCashPayment, setAllowCashPayment] = useState(false);
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        if (!id) { router.push("/dashboard/student"); return; }
        const fetchBooking = async () => {
            try {
                const [data, cashEnabled] = await Promise.all([
                    getBookingById(id),
                    getCashPaymentEnabled(),
                ]);
                setBooking(data);
                setAllowCashPayment(cashEnabled);
                // Always default to online regardless of previous state
                setMethod("online");
            } catch (err: any) {
                setError(err.message || "Failed to load booking");
            } finally {
                setLoading(false);
            }
        };
        fetchBooking();
    }, [id, router]);

    // Auto-redirect countdown after payment success
    useEffect(() => {
        if (!isPaid) return;
        if (countdown <= 0) { router.push("/dashboard/student"); return; }
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [isPaid, countdown, router]);

    const handlePay = async () => {
        if (!booking) return;
        setIsPaying(true);
        setError(null);

        try {
            if (isToken) {
                // Token payment: ₹1,000 non-refundable via Razorpay or registered intent
                if (method === "cash") {
                    // Cash token: owner will manually confirm in dashboard
                    await registerCashIntent(booking.id);
                    setIsPaid(true);
                    return;
                }
                // Online token payment
                const order = await createRazorpayOrder(booking.id);
                if (order.isDummyRoute || !(window as any).Razorpay) {
                    await payTokenAmount(booking.id, 'ONLINE', 'pay_tok_sim_' + Math.random().toString(36).slice(2));
                    setIsPaid(true);
                    return;
                }
                const options = {
                    key: order.key,
                    amount: 100000, // ₹1,000 in paise
                    currency: 'INR',
                    name: 'RentPe',
                    description: `Non-Refundable Reservation Token — ${booking.propertyName}`,
                    order_id: order.id,
                    handler: async (response: any) => {
                        try {
                            await verifyPayment(response);
                            await payTokenAmount(booking.id, 'ONLINE', response.razorpay_payment_id);
                            setIsPaid(true);
                        } catch { setError('Token payment verification failed. Contact support.'); setIsPaying(false); }
                    },
                    prefill: { name: booking.guestName, email: booking.guestEmail || 'user@example.com', contact: booking.guestPhone || '' },
                    theme: { color: '#f59e0b' },
                    modal: { ondismiss: () => setIsPaying(false) }
                };
                const rzp = new (window as any).Razorpay(options);
                rzp.on('payment.failed', (resp: any) => { setError(`Payment failed: ${resp.error?.description || 'Unknown error'}`); setIsPaying(false); });
                rzp.open();
                return;
            }

            if (method === "cash") {
                // Final joining amount cash: register intent, owner confirms
                await registerCashIntent(booking.id);
                setIsPaid(true);
                return;
            }

            // Final joining amount online via Razorpay
            const order = await createRazorpayOrder(booking.id);

            if (order.isDummyRoute || !(window as any).Razorpay) {
                await new Promise(r => setTimeout(r, 1200));
                await verifyPayment({
                    razorpay_order_id: order.id,
                    razorpay_payment_id: "pay_sim_" + Math.random().toString(36).slice(2),
                    razorpay_signature: "sim_sig"
                });
                await markBookingPaid(booking.id, "ONLINE");
                setIsPaid(true);
                return;
            }

            const options = {
                key: order.key,
                amount: order.amount,
                currency: order.currency,
                name: "RentPe",
                description: `Final Joining Amount — ${booking.propertyName}`,
                order_id: order.id,
                handler: async function (response: any) {
                    try {
                        await verifyPayment(response);
                        await markBookingPaid(booking.id, "ONLINE", response.razorpay_payment_id);
                        setIsPaid(true);
                    } catch {
                        setError("Payment verification failed. Please contact support.");
                        setIsPaying(false);
                    }
                },
                prefill: {
                    name: booking.guestName,
                    email: booking.guestEmail || "user@example.com",
                    contact: booking.guestPhone || ""
                },
                theme: { color: "#6366f1" },
                modal: { ondismiss: () => setIsPaying(false) }
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.on("payment.failed", (resp: any) => {
                setError(`Payment failed: ${resp.error?.description || "Unknown error"}. Please try again.`);
                setIsPaying(false);
            });
            rzp.open();
            return;
        } catch (err: any) {
            setError(err.message || "Payment failed. Please try again.");
            setIsPaying(false);
        } finally {
            if (method === "cash") setIsPaying(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="text-center space-y-3">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-slate-600 font-medium">Loading payment details...</p>
            </div>
        </div>
    );

    if (error && !booking) return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
            <Card className="w-full max-w-md shadow-xl">
                <CardContent className="p-8 text-center space-y-4">
                    <div className="p-4 bg-red-100 rounded-full w-fit mx-auto">
                        <AlertTriangle className="h-10 w-10 text-red-600" />
                    </div>
                    <h2 className="text-xl font-bold text-red-700">Unable to Load Booking</h2>
                    <p className="text-sm text-slate-500">{error}</p>
                    <Button onClick={() => router.push("/dashboard/student")} className="w-full">
                        <ArrowLeft className="h-4 w-4 mr-2" /> Go to Dashboard
                    </Button>
                </CardContent>
            </Card>
        </div>
    );

    if (!booking) return null;

    const originalOccupancy = (booking as any).originalOccupancy || null;
    const currentOccupancy = booking.occupancy || "";
    const sharingTypeChanged = originalOccupancy && originalOccupancy !== currentOccupancy;

    // Parse "103 — Bed 103-B" → roomNo=103, bedNo=103-B
    const roomAssigned = booking.roomAssigned || "";
    const dashIdx = roomAssigned.search(/[—–]/);
    const roomNo = dashIdx > -1 ? roomAssigned.substring(0, dashIdx).trim() : roomAssigned.trim();
    const afterDash = dashIdx > -1 ? roomAssigned.substring(dashIdx + 1).trim() : null;
    const bedNo = afterDash ? afterDash.replace(/^[Bb]ed\s*/i, '').trim() || afterDash : null;

    const TOKEN_AMOUNT = 1000;
    const rentAmount  = Number(booking.amount || 0);
    const depositAmount = Number((booking as any).depositAmount || 0);

    // ── UNIFIED CALENDAR BILLING: Prorated first-month rent ──────────────────
    // If customer moves in today (e.g. 28 May, 31-day month):
    //   days remaining = 31 - 28 + 1 = 4
    //   daily rate     = ₹10,000 / 31 = ₹322.58
    //   prorated rent  = 4 × ₹322.58 = ₹1,290
    // From June 1st onward → full ₹10,000/month via cron.
    const today = new Date();
    const daysInThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInThisMonth - today.getDate() + 1;
    const dailyRate = Math.round((rentAmount / daysInThisMonth) * 100) / 100;
    const proratedRent = Math.round(dailyRate * daysRemaining);
    const isFirstOfMonth = today.getDate() === 1; // if move-in is exactly 1st, no proration needed
    const effectiveRent = isFirstOfMonth ? rentAmount : proratedRent;
    const monthName = today.toLocaleString('en-IN', { month: 'long' });
    const lastDayLabel = `${daysInThisMonth} ${monthName}`;
    const moveInLabel  = `${today.getDate()} ${monthName}`;

    const subtotal = effectiveRent + depositAmount;
    // Final payment deducts the ₹1,000 token already paid
    const totalAmount = isToken ? TOKEN_AMOUNT : Math.max(0, subtotal - TOKEN_AMOUNT);

    if (isPaid) {
        const isCash = method === "cash";
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
                <Card className="w-full max-w-lg shadow-2xl border-0 overflow-hidden">
                    <div className={`h-2 w-full ${isCash ? "bg-orange-500" : "bg-green-500"}`} />
                    <CardContent className="p-8 text-center space-y-5">
                        <div className="flex justify-center">
                            <div className={`p-5 rounded-full ${isCash ? "bg-orange-100" : "bg-green-100"} animate-bounce`}>
                                {isCash ? <Banknote className="h-12 w-12 text-orange-600" /> : <CheckCircle className="h-12 w-12 text-green-600" />}
                            </div>
                        </div>
                        {isCash ? (
                            <>
                                <h2 className="text-2xl font-black text-orange-700">Cash Payment Registered</h2>
                                <div className="bg-orange-50 border-2 border-orange-400 p-4 rounded-xl text-left space-y-3">
                                    <p className="text-orange-800 font-black text-sm">⚠️ Please pay cash to the property team</p>
                                    <p className="text-orange-700 text-xs">Your booking is now pending. The owner will confirm once cash is received.</p>
                                    <div className="space-y-1.5 pt-2 border-t border-orange-200">
                                        <p className="text-[11px] font-black text-orange-800 uppercase tracking-widest">Contact to Pay:</p>
                                        <div className="flex items-center gap-2 text-sm font-bold text-orange-900">
                                            <Phone className="h-4 w-4" /><span>Building Mgmt: {BUILDING_MGMT_PHONE}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm font-bold text-orange-900">
                                            <Phone className="h-4 w-4" /><span>PG Owner: {PG_OWNER_PHONE}</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-500">Booking ID: <strong>{booking.displayId}</strong></p>
                            </>
                        ) : (
                            <>
                                <h2 className="text-2xl font-black text-green-700">
                                    {isToken ? '🔐 Token Secured!' : 'Payment Successful! 🎉'}
                                </h2>
                                {isToken ? (
                                    <div className="bg-amber-50 border-2 border-amber-400 p-4 rounded-xl text-sm text-amber-800 space-y-2">
                                        <p className="font-black">✅ ₹1,000 Non-Refundable Token Paid</p>
                                        <p>Your bed is now <strong>LOCKED</strong> for you. The token amount is non-refundable as per the reservation agreement.</p>
                                        <p className="text-xs text-amber-600">RentPe is a technology mediator. Token goes to the property owner.</p>
                                    </div>
                                ) : (
                                    <div className="bg-green-50 border border-green-300 p-4 rounded-xl text-sm text-green-800">
                                        <p className="font-black">✅ Joining Amount Paid!</p>
                                        <p>Your check-in is confirmed. Management will contact you shortly.</p>
                                    </div>
                                )}
                                <p className="text-sm text-slate-500">Booking ID: <strong>{booking.displayId}</strong></p>
                            </>
                        )}
                        {/* Auto-redirect countdown */}
                        <div className="flex items-center justify-center gap-2 py-2">
                            <div className="relative w-10 h-10 flex items-center justify-center">
                                <svg className="absolute inset-0 w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="16" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                                    <circle cx="18" cy="18" r="16" fill="none" stroke="#6366f1" strokeWidth="3"
                                        strokeDasharray={`${(countdown / 5) * 100} 100`}
                                        strokeLinecap="round"
                                        style={{ transition: 'stroke-dasharray 1s linear' }}
                                    />
                                </svg>
                                <span className="text-sm font-black text-indigo-700 relative z-10">{countdown}</span>
                            </div>
                            <p className="text-sm font-bold text-slate-500">Redirecting to dashboard in <strong className="text-indigo-600">{countdown}s</strong>…</p>
                        </div>
                        <Button className="w-full h-12 font-black rounded-xl bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white shadow-lg" onClick={() => router.push("/dashboard/student")}>
                            Go to My Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
            <Script src="https://checkout.razorpay.com/v1/checkout.js" />
            <div className="w-full max-w-lg space-y-3">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors group">
                    <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Go Back
                </button>

                <Card className="shadow-2xl border-0 overflow-hidden">
                    <div className="h-2 w-full bg-gradient-to-r from-indigo-500 to-purple-600" />
                    <CardHeader className="space-y-2 pb-4">
                        <div className="flex items-center justify-center mb-2">
                            <div className="p-3 bg-indigo-100 rounded-full">
                                <Lock className="h-8 w-8 text-indigo-600" />
                            </div>
                        </div>
                        <CardTitle className="text-2xl font-black text-center">
                            {isToken ? '🔐 Reserve Your Bed' : '💳 Final Joining Payment'}
                        </CardTitle>
                        <CardDescription className="text-center font-medium">
                            PG: <strong>{booking.propertyName}</strong> • {booking.occupancy}
                        </CardDescription>
                        <p className="text-center text-sm text-slate-500">Booking ID: <strong>{booking.displayId}</strong></p>
                    </CardHeader>

                    <CardContent className="space-y-5">
                        {/* Room Info */}
                        {booking.roomAssigned && (
                            <div className="p-4 rounded-2xl border-2 bg-indigo-50 border-indigo-300 space-y-3">
                                <div className="flex items-center gap-2 font-black text-sm text-indigo-800">
                                    <BedDouble className="h-4 w-4" /> Your Allocated Room
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="rounded-xl p-3 text-center bg-white border border-indigo-100">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Room Type</p>
                                        <p className="text-sm font-black text-indigo-900">{currentOccupancy || "—"}</p>
                                    </div>
                                    <div className="rounded-xl p-3 text-center bg-white border border-indigo-100">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Room No.</p>
                                        <p className="text-sm font-black text-indigo-900">{roomNo}</p>
                                    </div>
                                    <div className="rounded-xl p-3 text-center bg-white border border-indigo-100">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Bed</p>
                                        <p className="text-sm font-black text-indigo-900">{bedNo || "—"}</p>
                                    </div>
                                </div>
                                {sharingTypeChanged && (
                                    <div className="bg-orange-50 border-2 border-orange-400 rounded-xl p-3">
                                        <p className="text-orange-800 font-black text-sm">⚠️ Room type changed: {originalOccupancy} → {currentOccupancy}</p>
                                        <p className="text-orange-700 text-xs mt-1">Contact building management if you want a different type.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Non-refundable banner for token payment */}
                        {isToken && (
                            <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3 space-y-1">
                                <p className="text-red-800 font-black text-sm">⚠️ This payment is NON-REFUNDABLE</p>
                                <p className="text-red-700 text-xs">By paying ₹1,000, you are reserving this bed exclusively. This token amount cannot be refunded under any circumstances.</p>
                                <p className="text-red-600 text-xs">RentPe is a technology mediator only. Token amount goes directly to the property owner.</p>
                            </div>
                        )}

                        {/* Payment Breakdown */}
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-2">
                            {isToken ? (
                                // Token payment: simple ₹1,000 row
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-slate-700">🔐 Reservation Token</span>
                                    <span className="font-black text-amber-700">₹1,000</span>
                                </div>
                            ) : (
                                // Final joining payment: PRORATED first-month rent breakdown
                                <>
                                    {/* Prorated Rent Row */}
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="text-sm text-slate-600 font-semibold">🏠 Rent — {isFirstOfMonth ? monthName : `${moveInLabel} to ${lastDayLabel}`}</span>
                                            {!isFirstOfMonth && (
                                                <p className="text-[11px] text-slate-400 mt-0.5">
                                                    {daysRemaining} days × ₹{dailyRate.toFixed(0)}/day
                                                    <span className="ml-1 text-indigo-500">(₹{rentAmount.toLocaleString('en-IN')}/mo ÷ {daysInThisMonth} days)</span>
                                                </p>
                                            )}
                                        </div>
                                        <span className="font-black text-slate-800">₹{effectiveRent.toLocaleString('en-IN')}</span>
                                    </div>

                                    {/* Security Deposit */}
                                    {depositAmount > 0 && (
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="text-sm text-emerald-700 font-semibold">🛡️ Security Deposit ({(booking as any).depositMonths || 2}m)</span>
                                                <p className="text-[11px] text-slate-400 mt-0.5">Held in escrow · refundable on exit</p>
                                            </div>
                                            <span className="font-black text-emerald-700">₹{depositAmount.toLocaleString('en-IN')}</span>
                                        </div>
                                    )}

                                    {/* Subtotal */}
                                    <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                                        <span className="text-sm text-slate-500">Subtotal</span>
                                        <span className="font-bold text-slate-600">₹{subtotal.toLocaleString('en-IN')}</span>
                                    </div>

                                    {/* Token deduction */}
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-green-700 font-semibold">🎟️ Token Advance Paid ✅</span>
                                        <span className="font-black text-green-700">− ₹1,000</span>
                                    </div>
                                </>
                            )}
                            <div className="flex justify-between items-center border-t border-slate-200 pt-2 mt-1">
                                <span className="font-black text-slate-800">{isToken ? 'Token Amount' : 'Amount Payable Now'}</span>
                                <span className="text-xl font-black text-indigo-700">₹{totalAmount.toLocaleString('en-IN')}</span>
                            </div>
                        </div>

                        {/* Error Banner */}
                        {error && (
                            <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3 flex items-start gap-2">
                                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                                <p className="text-sm font-bold text-red-700">{error}</p>
                            </div>
                        )}

                        {/* Payment Method — show cash only if admin enabled it */}
                        <div className={`grid gap-3 ${allowCashPayment ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            <button
                                onClick={() => setMethod("online")}
                                className={cn(
                                    "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2",
                                    method === "online"
                                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md"
                                        : "border-slate-200 hover:bg-slate-50 text-slate-500"
                                )}
                            >
                                <Smartphone className="h-6 w-6" />
                                <span className="text-xs font-black">Pay Online</span>
                                <span className="text-[10px] text-slate-400 font-medium">UPI · Card · Netbanking</span>
                            </button>
                            {allowCashPayment && (
                                <button
                                    onClick={() => setMethod("cash")}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2",
                                        method === "cash"
                                            ? "border-orange-400 bg-orange-50 text-orange-700 shadow-md"
                                            : "border-slate-200 hover:bg-slate-50 text-slate-500"
                                    )}
                                >
                                    <Banknote className="h-6 w-6" />
                                    <span className="text-xs font-black">Pay Cash</span>
                                    <span className="text-[10px] text-slate-400 font-medium">At Property</span>
                                </button>
                            )}
                        </div>

                        {/* Method detail box */}
                        <div className={`border-2 rounded-xl p-4 ${method === "cash" ? "border-orange-200 bg-orange-50" : "border-indigo-100 bg-white"}`}>
                            {method === "online" ? (
                                <div className="space-y-1 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <Lock className="h-4 w-4 text-indigo-600" />
                                        <p className="text-sm font-black text-slate-700">Secure Online Payment</p>
                                    </div>
                                    <p className="text-xs text-slate-500">Powered by Razorpay. Pay via UPI (GPay, PhonePe, Paytm), Debit/Credit Card, or Netbanking — you choose inside the payment screen.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-sm font-black text-orange-800">⚠️ Cash Payment Notice</p>
                                    <p className="text-xs text-orange-700">Your booking will be marked pending. Visit the property and pay in person, then ask the owner to confirm it.</p>
                                    <div className="pt-1 space-y-1">
                                        <div className="flex items-center gap-2 text-xs font-bold text-orange-900">
                                            <Phone className="h-3 w-3" /> Building Mgmt: {BUILDING_MGMT_PHONE}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-orange-900">
                                            <Phone className="h-3 w-3" /> PG Owner: {PG_OWNER_PHONE}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>

                    <CardFooter className="flex flex-col space-y-3 pb-6">
                        <Button
                            className={cn(
                                "w-full text-base font-black rounded-2xl shadow-lg transition-all active:scale-95 py-6",
                                method === "cash"
                                    ? "bg-orange-500 hover:bg-orange-600 text-white"
                                    : "bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white"
                            )}
                            onClick={handlePay}
                            disabled={isPaying}
                        >
                            {isPaying
                                ? <><span className="animate-spin inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full" />Processing...</>
                                : method === "cash"
                                    ? "Confirm — I'll Pay Cash at Property"
                                    : `Pay ₹${totalAmount.toLocaleString('en-IN')} Online`
                            }
                        </Button>
                        <p className="text-xs text-center text-slate-400">
                            {method !== "cash" ? "🔒 256-bit SSL encrypted. Powered by Razorpay." : "Cash must be confirmed by the property owner."}
                        </p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}

export default function PaymentPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="text-center space-y-3">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-slate-600 font-medium">Loading...</p>
                </div>
            </div>
        }>
            <PaymentPortal />
        </Suspense>
    );
}
