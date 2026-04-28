"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Banknote, Smartphone, CheckCircle, AlertTriangle, ArrowLeft, Phone, BedDouble } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { cn } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { getBookingById, markBookingPaid, registerCashIntent } from "@/actions/bookings";
import { getCashPaymentEnabled } from "@/actions/platform";
import { createRazorpayOrder, verifyPayment } from "@/actions/payments";
import Script from "next/script";

const BUILDING_MGMT_PHONE = "+91 98765 43210";
const PG_OWNER_PHONE = "+91 91234 56789";

function PaymentPortal() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams.get("id");

    const [method, setMethod] = useState<"online" | "cash">("online");
    const [isPaying, setIsPaying] = useState(false);
    const [isPaid, setIsPaid] = useState(false);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [allowCashPayment, setAllowCashPayment] = useState(false);

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

    const handlePay = async () => {
        if (!booking) return;
        setIsPaying(true);
        setError(null);

        try {
            if (method === "cash") {
                // registerCashIntent keeps booking at APPROVED status.
                // The owner must physically receive cash and click "Mark Cash Paid"
                // in their dashboard to advance to MOVE_IN_SCHEDULED + unlock Agreement.
                await registerCashIntent(booking.id);
                setIsPaid(true);
                return;
            }

            // Online: Razorpay handles UPI / Card / Netbanking inside its modal
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
                description: `Booking payment for ${booking.propertyName}`,
                order_id: order.id,
                handler: async function (response: any) {
                    try {
                        await verifyPayment(response);
                        await markBookingPaid(booking.id, "ONLINE");
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

    const totalAmount = Number(booking.amount || 0) + Number((booking as any).depositAmount || 0);

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
                                <h2 className="text-2xl font-black text-green-700">Payment Successful! 🎉</h2>
                                <p className="text-slate-600">Payment for <strong>{booking.propertyName}</strong> confirmed.</p>
                                <div className="bg-green-50 border border-green-300 p-4 rounded-xl text-sm text-green-800">
                                    <p className="font-black">✅ Booking Confirmed!</p>
                                    <p>Your bed is reserved. Management will contact you for check-in.</p>
                                </div>
                                <p className="text-sm text-slate-500">Booking ID: <strong>{booking.displayId}</strong></p>
                            </>
                        )}
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
                        <CardTitle className="text-2xl font-black text-center">Complete Payment</CardTitle>
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

                        {/* Payment Breakdown */}
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600">Monthly Rent</span>
                                <span className="font-black text-slate-800">₹{Number(booking.amount || 0).toLocaleString('en-IN')}</span>
                            </div>
                            {Number((booking as any).depositAmount) > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-emerald-700">Security Deposit ({(booking as any).depositMonths || 2}m)</span>
                                    <span className="font-black text-emerald-700">₹{Number((booking as any).depositAmount || 0).toLocaleString('en-IN')}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center border-t border-slate-200 pt-2 mt-1">
                                <span className="font-black text-slate-800">Total Payable</span>
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
