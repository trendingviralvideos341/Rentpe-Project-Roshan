"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, CreditCard, Banknote, Smartphone, Building, CheckCircle, AlertTriangle } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { cn } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { getBookingById, markBookingPaid } from "@/actions/bookings";
import { createRazorpayOrder, verifyPayment } from "@/actions/payments";
import Script from "next/script";

function PaymentPortal() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams.get("id");

    const [method, setMethod] = useState("upi");
    const [isPaying, setIsPaying] = useState(false);
    const [isPaid, setIsPaid] = useState(false);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState<any>(null);

    useEffect(() => {
        if (!id) { router.push("/dashboard/student"); return; }
        const fetchBooking = async () => {
            try {
                const data = await getBookingById(id);
                setBooking(data);
            } catch (error) {
                console.error(error);
                router.push("/dashboard/student");
            } finally {
                setLoading(false);
            }
        };
        fetchBooking();
    }, [id, router]);

    const handlePay = async () => {
        if (!booking) return;
        setIsPaying(true);

        try {
            if (method === "cash") {
                // Cash: just record the intent — owner will mark as paid
                await markBookingPaid(booking.id, "CASH_PENDING");
                setIsPaid(true);
                return;
            }

            // Online payment via Razorpay
            const order = await createRazorpayOrder(booking.id);

            if (order.isDummyRoute || !(window as any).Razorpay) {
                // Simulate success
                await new Promise(r => setTimeout(r, 1500));
                await verifyPayment({
                    razorpay_order_id: order.id,
                    razorpay_payment_id: "pay_simulated_" + Math.random().toString(36).slice(2),
                    razorpay_signature: "simulated_sig"
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
                description: `Payment for ${booking.propertyName}`,
                order_id: order.id,
                handler: async function (response: any) {
                    try {
                        await verifyPayment(response);
                        await markBookingPaid(booking.id, "ONLINE");
                        setIsPaid(true);
                    } catch (err) {
                        alert("Verification failed. Please contact support.");
                    }
                },
                prefill: { name: booking.guestName, email: booking.guestEmail || "user@example.com" },
                theme: { color: "#16a34a" },
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.open();
        } catch (error: any) {
            console.error(error);
            alert(error.message || "Payment failed to initialize");
        } finally {
            setIsPaying(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading payment details...</div>;
    if (!booking) return null;

    if (isPaid) {
        const isCash = method === "cash";
        return (
            <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
                <Card className="w-full max-w-lg shadow-xl">
                    <CardContent className="p-8 text-center space-y-4">
                        <div className="flex justify-center">
                            <div className={`p-4 rounded-full animate-bounce ${isCash ? "bg-orange-100" : "bg-green-100"}`}>
                                {isCash ? <Banknote className="h-12 w-12 text-orange-600" /> : <CheckCircle className="h-12 w-12 text-green-600" />}
                            </div>
                        </div>
                        {isCash ? (
                            <>
                                <h2 className="text-2xl font-bold text-orange-700">Cash Payment Selected</h2>
                                <div className="bg-red-50 border-2 border-red-400 p-4 rounded-lg text-left">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-red-700 font-bold text-sm">⚠️ Important: Please inform the building management team to mark as paid.</p>
                                            <p className="text-red-600 text-xs mt-1">Your booking will remain in &quot;Waiting Payment&quot; status until the owner or manager confirms your cash payment. Please hand over the cash directly to the property manager.</p>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground">Booking ID: <strong>{booking.displayId}</strong></p>
                            </>
                        ) : (
                            <>
                                <h2 className="text-2xl font-bold text-green-700">Payment Successful! 🎉</h2>
                                <p className="text-muted-foreground">Your payment for <strong>{booking.propertyName}</strong> has been received.</p>
                                <p className="text-sm text-muted-foreground">Booking ID: <strong>{booking.displayId}</strong></p>
                                <div className="bg-green-50 border border-green-200 p-3 rounded text-sm text-green-800">
                                    ✅ Your booking is now <strong>PAID & Confirmed</strong>. Welcome home!
                                </div>
                            </>
                        )}
                        <Button className="w-full mt-4" onClick={() => router.push("/dashboard/student")}>
                            Go to My Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
            <Script src="https://checkout.razorpay.com/v1/checkout.js" />
            <Card className="w-full max-w-lg shadow-xl">
                <CardHeader className="space-y-1">
                    <div className="flex items-center justify-center mb-4">
                        <div className="p-3 bg-green-100 rounded-full">
                            <Lock className="h-8 w-8 text-green-600" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-center">Complete Payment</CardTitle>
                    <CardDescription className="text-center">
                        PG: {booking.propertyName} • {booking.occupancy}
                    </CardDescription>
                    <p className="text-center text-sm text-muted-foreground">Booking ID: <strong>{booking.displayId}</strong></p>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="p-4 bg-muted rounded-md flex justify-between items-center">
                        <span className="font-medium">Total Amount</span>
                        <span className="text-xl font-bold">{booking.amount}</span>
                    </div>

                    {/* Payment Method Tabs */}
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { id: "upi", icon: Smartphone, label: "Online" },
                            { id: "card", icon: CreditCard, label: "Card" },
                            { id: "netbanking", icon: Building, label: "NetBank" },
                            { id: "cash", icon: Banknote, label: "Cash" },
                        ].map((m) => (
                            <button
                                key={m.id}
                                onClick={() => setMethod(m.id)}
                                className={cn(
                                    "flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-xs font-medium gap-1",
                                    method === m.id
                                        ? m.id === "cash" ? "border-orange-400 bg-orange-50 text-orange-700" : "border-primary bg-primary/5 text-primary"
                                        : "border-muted hover:bg-muted/50 text-muted-foreground"
                                )}
                            >
                                <m.icon className="h-5 w-5" />
                                {m.label}
                            </button>
                        ))}
                    </div>

                    <div className="border rounded-lg p-4 bg-background">
                        {method !== "cash" ? (
                            <div className="space-y-2 text-center">
                                <p className="text-sm font-medium">Safe & Secure Online Payment</p>
                                <p className="text-xs text-muted-foreground">Powered by Razorpay. Includes UPI, Cards, and Netbanking.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-300 rounded-lg">
                                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-red-700">⚠️ Cash Payment Notice</p>
                                        <p className="text-xs text-red-600 mt-1">
                                            Please inform the building management team to mark as paid. Your booking will remain pending until the owner confirms your cash payment.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                    <Button
                        className={cn("w-full text-lg h-12", method === "cash" ? "bg-orange-500 hover:bg-orange-600" : "bg-green-600 hover:bg-green-700")}
                        onClick={handlePay}
                        disabled={isPaying}
                    >
                        {isPaying ? "Processing..." : method === "cash" ? "Confirm — I&apos;ll Pay Cash at Property" : `Pay ${booking.amount}`}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                        {method !== "cash" ? "Transaction encrypted with 256-bit SSL security." : "Cash payments must be confirmed by the property owner."}
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}

export default function PaymentPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <PaymentPortal />
        </Suspense>
    );
}
