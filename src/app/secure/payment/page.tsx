"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Banknote, Smartphone, CheckCircle, AlertTriangle, ArrowLeft, Phone, BedDouble, ShieldCheck, Receipt, BadgePercent } from "lucide-react";
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
    const paymentType = searchParams.get("type"); // "token" | "rent" | null
    const invoiceId = searchParams.get("invoiceId"); // for rent invoice payments
    const isToken = paymentType === "token";
    const isRent  = paymentType === "rent" && !!invoiceId;

    const [method, setMethod] = useState<"online" | "cash">("online");
    const [isPaying, setIsPaying] = useState(false);
    const [isPaid, setIsPaid] = useState(false);
    const [payFailed, setPayFailed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState<any>(null);
    const [invoice, setInvoice] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [allowCashPayment, setAllowCashPayment] = useState(false);
    // ── Fee Breakdown State (single source of truth from server) ──────────────
    // Contains: convenienceFee, gstOnFee, cgst, sgst, totalCharged,
    //           feesEnabled, isExempt, exemptReason, ownerFee, ownerNet, tdsAmount
    const [feeBreakdown, setFeeBreakdown] = useState<any>(null);
    const [countdown, setCountdown] = useState(10);
    const [transactionId, setTransactionId] = useState<string | null>(null);

    useEffect(() => {
        if (!id) { router.push("/dashboard/student"); return; }
        const fetchBooking = async () => {
            try {
                // ── CHECKLIST [1]: Fetch booking + cash settings in parallel ──
                const [data, cashEnabled] = await Promise.all([
                    getBookingById(id),
                    getCashPaymentEnabled(),
                ]);
                setBooking(data);
                setAllowCashPayment(cashEnabled);
                setMethod("online");

                // ── CHECKLIST [2]: Fetch invoice for rent payments ─────────────
                if (paymentType === "rent" && invoiceId) {
                    try {
                        const { getInvoiceById } = await import("@/actions/payments");
                        const inv = await getInvoiceById(invoiceId);
                        setInvoice(inv);
                    } catch { /* invoice fetch fail is non-fatal */ }
                }

                // ── CHECKLIST [3-9]: Fetch authoritative fee breakdown ─────────
                // calculateCheckoutFees runs the full checklist:
                //   [3] Platform fees enabled?
                //   [4] Student or property exempt?
                //   [5] Prorated rent for JOINING? Token deducted?
                //   [6] Token fee settings for TOKEN?
                //   [7] Invoice amount for RENT_INVOICE?
                //   [8] GST (18% CGST+SGST) calculated on convenience fee?
                //   [9] Owner commission, TDS calculated?
                try {
                    const { calculateCheckoutFees } = await import("@/actions/platform");
                    const checkoutType: 'JOINING' | 'TOKEN' | 'RENT_INVOICE' =
                        paymentType === 'token' ? 'TOKEN'
                        : paymentType === 'rent' ? 'RENT_INVOICE'
                        : 'JOINING';
                    const fb = await calculateCheckoutFees(id, checkoutType, invoiceId || undefined);
                    setFeeBreakdown(fb);
                } catch (feeErr) {
                    console.warn('[PaymentPage] Fee breakdown fetch failed (non-fatal):', feeErr);
                    // Page still usable — Razorpay amount comes from backend order
                }
            } catch (err: any) {
                setError(err.message || "Failed to load booking");
            } finally {
                setLoading(false);
            }
        };
        fetchBooking();
    }, [id, invoiceId, paymentType, router]);

    // Auto-redirect countdown after payment success OR failure
    useEffect(() => {
        if (!isPaid && !payFailed) return;
        if (countdown <= 0) { router.push("/dashboard/student"); return; }
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [isPaid, payFailed, countdown, router]);

    const handlePay = async () => {
        if (!booking) return;
        setIsPaying(true);
        setError(null);
        setPayFailed(false);

        try {
            // ── RENT INVOICE PAYMENT ──────────────────────────────────────────
            if (isRent && invoiceId) {
                const order = await createRazorpayOrder(booking.id, { invoiceId });

                if (order.isDummyRoute || !(window as any).Razorpay) {
                    // Dev / mock fallback
                    const mockPaymentId = "pay_rent_sim_" + Math.random().toString(36).slice(2);
                    setTransactionId(mockPaymentId);
                    await verifyPayment({
                        razorpay_order_id: order.id,
                        razorpay_payment_id: mockPaymentId,
                        razorpay_signature: "sim_sig",
                    });
                    setIsPaid(true);
                    return;
                }

                const rentAmt = invoice ? Number(invoice.amount) : Number(booking.amount);
                const options = {
                    key: order.key,
                    amount: order.amount,
                    currency: order.currency,
                    name: "RentPe",
                    description: `Monthly Rent — ${invoice?.month || ''} · ${booking.propertyName}`,
                    order_id: order.id,
                    handler: async (response: any) => {
                        try {
                            setTransactionId(response.razorpay_payment_id);
                            await verifyPayment(response);
                            // verifyPayment already marks invoice PAID when invoiceId is on Payment
                            setIsPaid(true);
                        } catch (err: any) {
                            setError(err.message || "Payment verification failed. Contact support.");
                            setPayFailed(true);
                            setIsPaying(false);
                        }
                    },
                    prefill: {
                        name: booking.guestName,
                        email: booking.guestEmail || "user@example.com",
                        contact: booking.guestPhone || "",
                    },
                    theme: { color: "#dc2626" },
                    modal: { ondismiss: () => setIsPaying(false) },
                };

                const rzp = new (window as any).Razorpay(options);
                rzp.on("payment.failed", (resp: any) => {
                    if (resp.error?.metadata?.payment_id) {
                        setTransactionId(resp.error.metadata.payment_id);
                    }
                    setError(`Payment failed: ${resp.error?.description || "Unknown error"}.`);
                    setPayFailed(true);
                    setIsPaying(false);
                });
                rzp.open();
                return;
            }

            // ── TOKEN PAYMENT ─────────────────────────────────────────────────
            if (isToken) {
                if (method === "cash") {
                    await registerCashIntent(booking.id);
                    setIsPaid(true);
                    return;
                }
                const order = await createRazorpayOrder(booking.id, { isToken: true });
                if (order.isDummyRoute || !(window as any).Razorpay) {
                    const mockPaymentId = 'pay_tok_sim_' + Math.random().toString(36).slice(2);
                    setTransactionId(mockPaymentId);
                    await payTokenAmount(booking.id, 'ONLINE', mockPaymentId);
                    setIsPaid(true);
                    return;
                }
                const options = {
                    key: order.key,
                    amount: 100000,
                    currency: 'INR',
                    name: 'RentPe',
                    description: `Non-Refundable Reservation Token — ${booking.propertyName}`,
                    order_id: order.id,
                    handler: async (response: any) => {
                        try {
                            setTransactionId(response.razorpay_payment_id);
                            await verifyPayment(response);
                            await payTokenAmount(booking.id, 'ONLINE', response.razorpay_payment_id);
                            setIsPaid(true);
                        } catch (err: any) {
                            setError(err.message || 'Token payment verification failed. Contact support.');
                            setIsPaying(false);
                        }
                    },
                    prefill: { name: booking.guestName, email: booking.guestEmail || 'user@example.com', contact: booking.guestPhone || '' },
                    theme: { color: '#f59e0b' },
                    modal: { ondismiss: () => setIsPaying(false) }
                };
                const rzp = new (window as any).Razorpay(options);
                rzp.on('payment.failed', (resp: any) => {
                    if (resp.error?.metadata?.payment_id) {
                        setTransactionId(resp.error.metadata.payment_id);
                    }
                    setError(`Payment failed: ${resp.error?.description || 'Unknown error'}`);
                    setIsPaying(false);
                });
                rzp.open();
                return;
            }

            // ── FINAL JOINING PAYMENT ─────────────────────────────────────────
            if (method === "cash") {
                await registerCashIntent(booking.id);
                setIsPaid(true);
                return;
            }

            const order = await createRazorpayOrder(booking.id);

            if (order.isDummyRoute || !(window as any).Razorpay) {
                await new Promise(r => setTimeout(r, 1200));
                const mockPaymentId = "pay_sim_" + Math.random().toString(36).slice(2);
                setTransactionId(mockPaymentId);
                await verifyPayment({
                    razorpay_order_id: order.id,
                    razorpay_payment_id: mockPaymentId,
                    razorpay_signature: "sim_sig"
                });
                await markBookingPaid(booking.id, "ONLINE", mockPaymentId);
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
                        setTransactionId(response.razorpay_payment_id);
                        await verifyPayment(response);
                        await markBookingPaid(booking.id, "ONLINE", response.razorpay_payment_id);
                        setIsPaid(true);
                    } catch (err: any) {
                        setError(err.message || "Payment verification failed. Please contact support.");
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
                if (resp.error?.metadata?.payment_id) {
                    setTransactionId(resp.error.metadata.payment_id);
                }
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
    // Parse booking's onboarding date or move-in date to align calculations.
    // This mirrors what calculateCheckoutFees does on the server.
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
    // When feeBreakdown is loaded: use its totalCharged as the authoritative total.
    // Until it loads: show provisional amount (no fee added yet, shows loading state).
    const convenienceFee = feeBreakdown?.convenienceFee ?? 0;
    const gstOnFee       = feeBreakdown?.gstOnFee ?? 0;
    const cgstAmt        = feeBreakdown?.cgst ?? 0;
    const sgstAmt        = feeBreakdown?.sgst ?? 0;
    const feesEnabled    = feeBreakdown?.feesEnabled ?? false;
    const isExempt       = feeBreakdown?.isExempt ?? false;
    const exemptReason   = feeBreakdown?.exemptReason ?? '';

    // Token total: ₹1,000 base + convenience fee + GST (if token fees enabled)
    // Joining total: (prorated rent + deposit - token) + convenience fee + GST
    const baseJoiningAmount = Math.max(0, subtotal - TOKEN_AMOUNT);
    const joiningTotal      = baseJoiningAmount + convenienceFee + gstOnFee;
    const totalAmount       = isToken
        ? TOKEN_AMOUNT + convenienceFee + gstOnFee
        : joiningTotal;

    // ── SUCCESS SCREEN ────────────────────────────────────────────────────────
    if (isPaid) {
        const isCash = method === "cash";
        const accentColor = isRent ? "red" : isToken ? "amber" : "green";
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
                <Card className="w-full max-w-lg shadow-2xl border-0 overflow-hidden">
                    <div className={`h-2 w-full ${isCash ? "bg-orange-500" : isRent ? "bg-red-500" : "bg-green-500"}`} />
                    <CardContent className="p-8 text-center space-y-5">
                        <div className="flex justify-center">
                            <div className={`p-5 rounded-full ${isCash ? "bg-orange-100" : isRent ? "bg-red-50" : "bg-green-100"} animate-bounce`}>
                                {isCash ? <Banknote className="h-12 w-12 text-orange-600" /> : <CheckCircle className={`h-12 w-12 ${isRent ? "text-red-600" : "text-green-600"}`} />}
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
                        ) : isRent ? (
                            <>
                                <h2 className="text-2xl font-black text-red-700">🏠 Rent Paid Successfully!</h2>
                                <div className="bg-red-50 border-2 border-red-300 p-4 rounded-xl text-sm text-red-800 space-y-2 text-left">
                                    <p className="font-black text-base">✅ ₹{Number(invoice?.amount || 0).toLocaleString('en-IN')} Confirmed</p>
                                    <p className="text-slate-600">Rent for <strong>{invoice?.month || 'this month'}</strong> has been captured by Razorpay and marked paid.</p>
                                    {transactionId && (
                                        <div className="bg-white/80 border border-red-200 rounded-lg p-2 mt-2">
                                            <p className="text-xs text-slate-500">Transaction ID: <span className="font-mono font-black text-slate-800 select-all">{transactionId}</span></p>
                                        </div>
                                    )}
                                    <div className="pt-2 border-t border-red-200 space-y-1">
                                        <p className="text-xs text-slate-500">Property: <strong>{booking.propertyName}</strong></p>
                                        <p className="text-xs text-slate-500">Booking: <strong>{booking.displayId}</strong></p>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400">Your rent receipt will appear in Payment History.</p>
                            </>
                        ) : (
                            <>
                                <h2 className="text-2xl font-black text-green-700">
                                    {isToken ? '🔐 Token Secured!' : 'Payment Successful! 🎉'}
                                </h2>
                                {isToken ? (
                                    <div className="bg-amber-50 border-2 border-amber-400 p-4 rounded-xl text-sm text-amber-800 space-y-2 text-left">
                                        <p className="font-black text-center text-amber-900">✅ ₹1,000 Non-Refundable Token Paid</p>
                                        <p>Your bed is now <strong>LOCKED</strong> for you. The token amount is non-refundable as per the reservation agreement.</p>
                                        {transactionId && (
                                            <div className="bg-white/80 border border-amber-200 rounded-lg p-2">
                                                <p className="text-xs text-slate-500">Transaction ID: <span className="font-mono font-black text-slate-800 select-all">{transactionId}</span></p>
                                            </div>
                                        )}
                                        <p className="text-[11px] text-amber-600">RentPe is a technology mediator. Token goes to the property owner.</p>
                                    </div>
                                ) : (
                                    <div className="bg-green-50 border-2 border-green-300 p-4 rounded-xl text-sm text-green-800 space-y-2 text-left">
                                        <p className="font-black text-center text-green-950">✅ Joining Amount Paid!</p>
                                        <p>Your check-in is confirmed. Management will contact you shortly.</p>
                                        {transactionId && (
                                            <div className="bg-white/80 border border-green-200 rounded-lg p-2">
                                                <p className="text-xs text-slate-500">Transaction ID: <span className="font-mono font-black text-slate-800 select-all">{transactionId}</span></p>
                                            </div>
                                        )}
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
                                    <circle cx="18" cy="18" r="16" fill="none" stroke={isRent ? "#dc2626" : "#6366f1"} strokeWidth="3"
                                        strokeDasharray={`${(countdown / 10) * 100} 100`}
                                        strokeLinecap="round"
                                        style={{ transition: 'stroke-dasharray 1s linear' }}
                                    />
                                </svg>
                                <span className={`text-sm font-black relative z-10 ${isRent ? 'text-red-700' : 'text-indigo-700'}`}>{countdown}</span>
                            </div>
                            <p className="text-sm font-bold text-slate-500">Redirecting to dashboard in <strong className={isRent ? 'text-red-600' : 'text-indigo-600'}>{countdown}s</strong>…</p>
                        </div>
                        <Button className={`w-full h-12 font-black rounded-xl shadow-lg text-white ${isRent ? 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800' : 'bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800'}`} onClick={() => router.push("/dashboard/student")}>
                            Go to My Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ── PAYMENT FAILED SCREEN ─────────────────────────────────────────────────
    if (payFailed) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
                <Card className="w-full max-w-lg shadow-2xl border-0 overflow-hidden">
                    <div className="h-2 w-full bg-red-500" />
                    <CardContent className="p-8 text-center space-y-5">
                        <div className="flex justify-center">
                            <div className="p-5 rounded-full bg-red-100 animate-bounce">
                                <AlertTriangle className="h-12 w-12 text-red-600" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-black text-red-700">Payment Failed ❌</h2>
                        <div className="bg-red-50 border-2 border-red-300 p-4 rounded-xl text-sm text-red-800 text-left space-y-2">
                            <p className="font-black text-center">Your payment was not successful.</p>
                            <p className="text-slate-600">{error || 'The transaction could not be completed. No amount has been deducted.'}</p>
                            {transactionId && (
                                <div className="bg-white/80 border border-red-200 rounded-lg p-2 mt-2">
                                    <p className="text-xs text-slate-500">Transaction ID: <span className="font-mono font-black text-slate-800 select-all">{transactionId}</span></p>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-center gap-2 py-2">
                            <div className="relative w-10 h-10 flex items-center justify-center">
                                <svg className="absolute inset-0 w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="16" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                                    <circle cx="18" cy="18" r="16" fill="none" stroke="#dc2626" strokeWidth="3"
                                        strokeDasharray={`${(countdown / 10) * 100} 100`}
                                        strokeLinecap="round"
                                        style={{ transition: 'stroke-dasharray 1s linear' }}
                                    />
                                </svg>
                                <span className="text-sm font-black text-red-700 relative z-10">{countdown}</span>
                            </div>
                            <p className="text-sm font-bold text-slate-500">Returning to dashboard in <strong className="text-red-600">{countdown}s</strong>…</p>
                        </div>
                        <Button className="w-full h-12 font-black rounded-xl shadow-lg text-white bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800" onClick={() => router.push("/dashboard/student")}>
                            Back to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ── RENT INVOICE PAYMENT PAGE ─────────────────────────────────────────────
    if (isRent) {
        const rentAmt = invoice ? Number(invoice.amount) : Number(booking?.amount || 0);
        const dueDate = invoice?.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '5th of this month';
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 via-slate-50 to-slate-100 flex items-center justify-center p-4">
                <Script src="https://checkout.razorpay.com/v1/checkout.js" />
                <div className="w-full max-w-lg space-y-3">
                    <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors group">
                        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Go Back
                    </button>
                    <Card className="shadow-2xl border-0 overflow-hidden">
                        <div className="h-2 w-full bg-gradient-to-r from-red-500 to-rose-600" />
                        <CardHeader className="space-y-2 pb-4">
                            <div className="flex items-center justify-center mb-2">
                                <div className="p-3 bg-red-100 rounded-full">
                                    <Lock className="h-8 w-8 text-red-600" />
                                </div>
                            </div>
                            <CardTitle className="text-2xl font-black text-center">🏠 Pay Monthly Rent</CardTitle>
                            <CardDescription className="text-center font-medium">
                                PG: <strong>{booking.propertyName}</strong>
                            </CardDescription>
                            <p className="text-center text-sm text-slate-500">Booking: <strong>{booking.displayId}</strong></p>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {/* Rent breakdown */}
                            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl space-y-3">
                                <div className="flex items-center gap-2 font-black text-sm text-red-800">
                                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                                    Rent Due — {invoice?.month || 'Current Month'}
                                </div>
                                <div className="space-y-2">
                                    {invoice?.rentAmount > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600">Monthly Rent</span>
                                            <span className="font-black text-slate-800">₹{Number(invoice.rentAmount).toLocaleString('en-IN')}</span>
                                        </div>
                                    )}
                                    {invoice?.foodAmount > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600">Food Charges</span>
                                            <span className="font-black text-slate-800">₹{Number(invoice.foodAmount).toLocaleString('en-IN')}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-2 border-t border-red-200">
                                        <span className="text-slate-600 text-sm">Rent Total</span>
                                        <span className="font-black text-slate-800">₹{rentAmt.toLocaleString('en-IN')}</span>
                                    </div>
                                     {/* ── Platform Convenience Fee (driven by server feeBreakdown) ── */}
                                    {feesEnabled && convenienceFee > 0 && !isExempt && (
                                        <>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="flex items-center gap-1 text-slate-500"><Receipt className="h-3 w-3" /> Platform Convenience Fee</span>
                                                <span className="font-bold text-indigo-600">+ ₹{convenienceFee.toLocaleString('en-IN')}</span>
                                            </div>
                                            {gstOnFee > 0 && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-slate-400 flex items-center gap-1"><BadgePercent className="h-3 w-3" /> GST 18% (CGST ₹{cgstAmt.toFixed(2)} + SGST ₹{sgstAmt.toFixed(2)}) · SAC 997312</span>
                                                    <span className="text-xs font-semibold text-slate-500">+ ₹{gstOnFee.toFixed(2)}</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {feesEnabled && isExempt && (
                                        <div className="flex items-center gap-2 text-xs text-emerald-600 font-semibold">
                                            <ShieldCheck className="h-3.5 w-3.5" />
                                            <span>Platform Fee Waived — {exemptReason || 'Exempted'}</span>
                                        </div>
                                    )}
                                    {!feeBreakdown && (
                                        <div className="flex items-center gap-2 animate-pulse">
                                            <div className="h-3 w-3 rounded-full bg-red-200" />
                                            <div className="h-3 bg-red-100 rounded w-36" />
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-2 border-t border-red-300">
                                        <span className="font-black text-red-800">Total You Pay</span>
                                        <div className="text-right">
                                            <span className="text-2xl font-black text-red-700">₹{(rentAmt + convenienceFee + gstOnFee).toLocaleString('en-IN')}</span>
                                            {!feeBreakdown && <p className="text-[10px] text-red-400 animate-pulse">Calculating fees…</p>}
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-red-600 font-bold">⚠️ Due by {dueDate}. Late fees may apply after this date.</p>
                                {convenienceFee > 0 && !isExempt && (
                                    <p className="text-[10px] text-slate-400">* Platform convenience fee is a RentPe service charge, separate from your rent receipt. Inclusive of 18% GST.</p>
                                )}
                            </div>
                            {/* Online payment info */}
                            <div className="border-2 border-indigo-100 rounded-xl p-4 bg-white">
                                <div className="flex items-center justify-center gap-2">
                                    <Lock className="h-4 w-4 text-indigo-600" />
                                    <p className="text-sm font-black text-slate-700">Secure Online Payment via Razorpay</p>
                                </div>
                                <p className="text-xs text-slate-500 text-center mt-1">UPI · Card · Netbanking · Wallets</p>
                            </div>
                            {error && (
                                <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3 flex items-start gap-2">
                                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm font-bold text-red-700">{error}</p>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex flex-col space-y-3 pb-6">
                            <Button
                                className="w-full text-base font-black rounded-2xl shadow-lg py-6 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white active:scale-95 transition-all"
                                onClick={handlePay}
                                disabled={isPaying || !feeBreakdown}
                            >
                                {isPaying
                                    ? <><span className="animate-spin inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full" />Processing...</>
                                    : feeBreakdown
                                        ? `💳 Pay ₹${(rentAmt + convenienceFee + gstOnFee).toLocaleString('en-IN')} Now`
                                        : 'Calculating fees…'
                                }
                            </Button>
                            {convenienceFee > 0 && !isExempt && (
                                <p className="text-xs text-center text-slate-500">
                                    Rent ₹{rentAmt.toLocaleString('en-IN')} + Fee ₹{convenienceFee.toLocaleString('en-IN')} + GST ₹{gstOnFee.toFixed(2)}
                                </p>
                            )}
                            <p className="text-xs text-center text-slate-400">🔒 256-bit SSL encrypted. Powered by Razorpay.</p>
                        </CardFooter>
                    </Card>
                </div>
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

                        {/* ── PAYMENT BREAKDOWN ─────────────────────────────── */}
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-2">
                            {isToken ? (
                                // ── TOKEN PAYMENT BREAKDOWN ──
                                <>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-slate-700">🔐 Reservation Token</span>
                                        <span className="font-black text-amber-700">₹1,000</span>
                                    </div>
                                    {/* Convenience Fee for Token (if token fees enabled) */}
                                    {feesEnabled && convenienceFee > 0 && !isExempt && (
                                        <>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500 flex items-center gap-1"><Receipt className="h-3 w-3" /> Platform Fee</span>
                                                <span className="font-bold text-indigo-600">+ ₹{convenienceFee.toLocaleString('en-IN')}</span>
                                            </div>
                                            {gstOnFee > 0 && (
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-400 flex items-center gap-1"><BadgePercent className="h-3 w-3" /> GST (CGST ₹{cgstAmt.toFixed(2)} + SGST ₹{sgstAmt.toFixed(2)})</span>
                                                    <span className="text-slate-500">+ ₹{gstOnFee.toLocaleString('en-IN')}</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {feesEnabled && isExempt && (
                                        <div className="flex items-center gap-2 text-xs text-emerald-600 font-semibold">
                                            <ShieldCheck className="h-3.5 w-3.5" />
                                            <span>Fees Waived — {exemptReason || 'Exempted'}</span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                // ── FINAL JOINING PAYMENT BREAKDOWN ──
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

                                    {/* Subtotal before deductions */}
                                    <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                                        <span className="text-sm text-slate-500">Subtotal</span>
                                        <span className="font-bold text-slate-600">₹{subtotal.toLocaleString('en-IN')}</span>
                                    </div>

                                    {/* Token deduction */}
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-green-700 font-semibold">🎟️ Token Advance Paid ✅</span>
                                        <span className="font-black text-green-700">− ₹1,000</span>
                                    </div>

                                    {/* ── PENDING SUBTOTAL (after token, before platform fee) ── */}
                                    <div className="flex justify-between items-center border-t border-slate-300 pt-2 bg-slate-100 -mx-4 px-4 py-2">
                                        <span className="text-sm font-black text-slate-700">Pending Subtotal</span>
                                        <span className="font-black text-slate-800">₹{baseJoiningAmount.toLocaleString('en-IN')}</span>
                                    </div>

                                    {/* ── Platform Convenience Fee (if enabled & not exempt) ── */}
                                    {feesEnabled && convenienceFee > 0 && !isExempt && (
                                        <>
                                            <div className="flex justify-between items-center pt-1">
                                                <div className="flex items-center gap-1">
                                                    <Receipt className="h-3.5 w-3.5 text-indigo-500" />
                                                    <span className="text-sm text-indigo-700 font-semibold">Platform Convenience Fee</span>
                                                </div>
                                                <span className="font-bold text-indigo-600">+ ₹{convenienceFee.toLocaleString('en-IN')}</span>
                                            </div>
                                            {gstOnFee > 0 && (
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-1">
                                                        <BadgePercent className="h-3 w-3 text-slate-400" />
                                                        <span className="text-xs text-slate-400">GST 18% (CGST ₹{cgstAmt.toFixed(2)} + SGST ₹{sgstAmt.toFixed(2)}) · SAC 997312</span>
                                                    </div>
                                                    <span className="text-xs font-semibold text-slate-500">+ ₹{gstOnFee.toFixed(2)}</span>
                                                </div>
                                            )}
                                            <p className="text-[10px] text-slate-400 italic">* Platform fee is a service charge by RentPe and is separate from your rent receipt.</p>
                                        </>
                                    )}


                                    {/* ── Fees Exempt Badge ── */}
                                    {feesEnabled && isExempt && (
                                        <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                                            <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                                            <div>
                                                <p className="text-xs font-black text-emerald-700">Convenience Fee Waived ✓</p>
                                                <p className="text-[10px] text-emerald-600">{exemptReason}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Fee Loading Skeleton ── */}
                                    {!feeBreakdown && (
                                        <div className="flex items-center gap-2 animate-pulse">
                                            <div className="h-3 w-3 rounded-full bg-indigo-200" />
                                            <div className="h-3 bg-indigo-100 rounded w-40" />
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ── GRAND TOTAL ── */}
                            <div className="flex justify-between items-center border-t-2 border-indigo-300 pt-3 mt-1 bg-indigo-50 -mx-4 px-4 py-3 rounded-b-2xl">
                                <span className="font-black text-slate-800 text-base">
                                    {isToken ? 'Token Amount' : 'Balance Due'}
                                </span>
                                <div className="text-right">
                                    <span className="text-2xl font-black text-indigo-700">
                                        ₹{totalAmount % 1 === 0
                                            ? totalAmount.toLocaleString('en-IN')
                                            : totalAmount.toFixed(2)}
                                    </span>
                                    {!feeBreakdown && <p className="text-[10px] text-indigo-400 animate-pulse">Calculating fees…</p>}
                                </div>
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
                            disabled={isPaying || !feeBreakdown}
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
