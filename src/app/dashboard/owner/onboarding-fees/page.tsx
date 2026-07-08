"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { format } from "date-fns";
import {
    Building2, CheckCircle2, Clock, Download, IndianRupee,
    ArrowLeft, CreditCard, AlertTriangle, Loader2, X, Shield, Search
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    createOnboardingFeeOrder,
    verifyOnboardingFeePayment,
    getOwnerOnboardingFeeStatus,
} from "@/actions/properties";

declare global {
    interface Window { Razorpay: any; }
}

type PropertyFeeEntry = {
    id: string;
    displayId: string | null;
    name: string;
    city: string;
    status: string;
    onboardingPaidAt: string | null;
    onboardingPaymentMethod: string | null;
    onboardingRazorpayId: string | null;
    feeAmount: number;
    feesEnabled: boolean;
    isPaid: boolean;
    owner?: { name: string; email: string; phone?: string | null } | null;
};

type PageData = {
    properties: PropertyFeeEntry[];
    feeAmount: number;
    feesEnabled: boolean;
};

// ── Payment Flow State ────────────────────────────────────────────────────────
type FlowState = "idle" | "processing" | "verifying" | "success" | "error";

function StatusBadge({ paid }: { paid: boolean }) {
    return paid ? (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Paid
        </span>
    ) : (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> Pending
        </span>
    );
}

// ── Razorpay Payment Modal ───────────────────────────────────────────────────
function PaymentModal({
    property,
    feeAmount,
    onClose,
    onSuccess,
}: {
    property: PropertyFeeEntry;
    feeAmount: number;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [flow, setFlow] = useState<FlowState>("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [countdown, setCountdown] = useState(10);
    const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

    const GST_RATE = 0.18;
    const feeBase  = Math.round((feeAmount / (1 + GST_RATE)) * 100) / 100;
    const gst      = Math.round((feeAmount - feeBase) * 100) / 100;
    const cgst     = Math.round((gst / 2) * 100) / 100;
    const sgst     = Math.round((gst - cgst) * 100) / 100;

    const handlePay = useCallback(async () => {
        setFlow("processing");
        setErrorMsg("");
        try {
            const order = await createOnboardingFeeOrder(property.id);

            // Load Razorpay checkout script
            if (!window.Razorpay) {
                await new Promise<void>((resolve, reject) => {
                    const script = document.createElement("script");
                    script.src = "https://checkout.razorpay.com/v1/checkout.js";
                    script.onload = () => resolve();
                    script.onerror = () => reject(new Error("Failed to load Razorpay"));
                    document.body.appendChild(script);
                });
            }

            const rzp = new window.Razorpay({
                key: order.key,
                amount: order.amount,
                currency: order.currency,
                name: "RentPe",
                description: `Onboarding Fee - ${property.name} (${property.displayId || ''}) - ${property.owner?.name || ''}`,
                order_id: order.isMock ? undefined : order.orderId,
                prefill: { 
                    name: property.owner?.name || "", 
                    email: property.owner?.email || "", 
                    contact: property.owner?.phone || "" 
                },
                theme: { color: "#3730a3" },
                handler: async (response: any) => {
                    setFlow("verifying");
                    let tick = 10;
                    setCountdown(10);
                    const interval = setInterval(() => {
                        tick--;
                        setCountdown(tick);
                        if (tick <= 0) clearInterval(interval);
                    }, 1000);

                    try {
                        const result = await verifyOnboardingFeePayment({
                            razorpay_order_id: response.razorpay_order_id || order.orderId,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature || "mock_signature",
                            propertyId: property.id,
                        });
                        clearInterval(interval);
                        setReceiptUrl(result.receiptUrl || null);
                        setFlow("success");
                        onSuccess();
                    } catch (verifyErr: any) {
                        clearInterval(interval);
                        setErrorMsg(verifyErr.message || "Verification failed. Please contact support.");
                        setFlow("error");
                    }
                },
                modal: {
                    ondismiss: () => {
                        if (flow === "processing") setFlow("idle");
                    },
                },
            });

            rzp.open();
        } catch (err: any) {
            setErrorMsg(err.message || "Failed to create payment order. Please try again.");
            setFlow("error");
        }
    }, [property.id, flow, onSuccess]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-br from-indigo-700 to-purple-700 p-6 text-white relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 w-36 h-36 bg-white/10 rounded-full" />
                    {flow === "idle" && (
                        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-xl transition-all z-50">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                    <div className="flex items-center gap-3 mb-1 relative z-10">
                        <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-indigo-200">
                                Owner Per Property
                            </p>
                            <p className="font-black text-lg">Onboarding Fee</p>
                        </div>
                    </div>
                    <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mt-1 relative z-10 truncate">
                        {property.name} {property.displayId && `(${property.displayId})`} {property.owner?.name && `• ${property.owner.name}`}
                    </p>
                </div>

                <div className="p-6 space-y-4">
                    {/* IDLE — show fee breakdown */}
                    {flow === "idle" && (
                        <>
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Fee Breakdown</p>
                                <div className="flex justify-between text-sm text-slate-600">
                                    <span>Base Service Fee</span>
                                    <span className="font-bold">₹{feeBase.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600">
                                    <span>CGST @ 9%</span>
                                    <span className="font-bold">₹{cgst.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600">
                                    <span>SGST @ 9%</span>
                                    <span className="font-bold">₹{sgst.toFixed(2)}</span>
                                </div>
                                <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                                    <span className="font-black text-slate-900">Total (incl. 18% GST)</span>
                                    <span className="font-black text-xl text-indigo-700">₹{feeAmount}</span>
                                </div>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                <p className="text-xs text-amber-700 font-bold">⚠ One-time non-refundable fee</p>
                                <p className="text-xs text-amber-600 mt-0.5">This fee is charged once per property listing on RentPe platform.</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={onClose}
                                    className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-2xl text-sm transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    id="pay-onboarding-fee-btn"
                                    onClick={handlePay}
                                    className="w-2/3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black py-4 rounded-2xl text-base transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                                >
                                    <CreditCard className="w-5 h-5" /> Pay ₹{feeAmount}
                                </button>
                            </div>
                            <p className="text-center text-[10px] text-slate-400">🔒 Secured by Razorpay · 256-bit SSL</p>
                        </>
                    )}

                    {/* PROCESSING — loading spinner */}
                    {flow === "processing" && (
                        <div className="py-8 flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                            </div>
                            <p className="font-bold text-slate-700">Opening Razorpay checkout...</p>
                            <p className="text-sm text-slate-400 text-center">Complete the payment in the Razorpay window</p>
                        </div>
                    )}

                    {/* VERIFYING — countdown */}
                    {flow === "verifying" && (
                        <div className="py-8 flex flex-col items-center gap-4">
                            <div className="relative w-20 h-20">
                                <div className="w-20 h-20 rounded-full border-4 border-indigo-100 flex items-center justify-center">
                                    <span className="text-2xl font-black text-indigo-700">{countdown}</span>
                                </div>
                                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin absolute -top-1 -right-1" />
                            </div>
                            <p className="font-black text-slate-800 text-lg">Please wait...</p>
                            <p className="text-sm text-slate-500 text-center">Verifying payment details with Razorpay.<br />Do not close this window.</p>
                        </div>
                    )}

                    {/* SUCCESS */}
                    {flow === "success" && (
                        <div className="py-6 flex flex-col items-center gap-4">
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                            </div>
                            <p className="font-black text-slate-800 text-xl">Payment Verified!</p>
                            <p className="text-sm text-slate-500 text-center">Your onboarding fee has been confirmed.<br />A receipt has been sent to your email.</p>
                            {receiptUrl && (
                                <a
                                    href={receiptUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-indigo-200"
                                >
                                    <Download className="w-4 h-4" /> Download Tax Invoice
                                </a>
                            )}
                            <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600 font-bold transition-colors">
                                Close
                            </button>
                        </div>
                    )}

                    {/* ERROR */}
                    {flow === "error" && (
                        <div className="py-6 flex flex-col items-center gap-4">
                            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-10 h-10 text-red-500" />
                            </div>
                            <p className="font-black text-slate-800 text-lg">Payment Failed</p>
                            <p className="text-sm text-red-600 text-center">{errorMsg}</p>
                            <button
                                onClick={() => { setFlow("idle"); setErrorMsg(""); }}
                                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl transition-all"
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Receipt Modal ─────────────────────────────────────────────────────────────
function OnboardingReceiptModal({
    property,
    onClose
}: {
    property: PropertyFeeEntry;
    onClose: () => void;
}) {
    const receiptNo = property.displayId ? `OBD-${property.displayId}` : `OBD-RP-${property.id.slice(-6).toUpperCase()}`;
    const paidDate = property.onboardingPaidAt ? format(new Date(property.onboardingPaidAt), "dd MMM yyyy, HH:mm") : "—";
    const paymentMethod = property.onboardingPaymentMethod === "ONLINE" ? "Online (Razorpay)" : property.onboardingPaymentMethod === "CASH" ? "Cash" : "—";
    const pdfUrl = `/api/receipts/onboarding/${property.id}?download=1`;

    const GST_RATE = 0.18;
    const feeBase = Math.round((property.feeAmount / (1 + GST_RATE)) * 100) / 100;
    const gst = Math.round((property.feeAmount - feeBase) * 100) / 100;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md my-4 overflow-y-auto max-h-[92vh] print:shadow-none print:max-h-none">
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white relative overflow-hidden">
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
                    <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-xl transition-all z-10 print:hidden">
                        <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3 mb-3 relative z-10">
                        <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-indigo-200">Onboarding Receipt</p>
                            <p className="font-black text-lg">{receiptNo}</p>
                        </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full relative z-10 bg-emerald-500/30 border border-emerald-400/40 text-emerald-100">
                        <CheckCircle2 className="w-3 h-3" /> Paid
                    </span>
                </div>

                <div className="p-6 space-y-4">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Property Details</p>
                        <p className="font-black text-indigo-900 text-sm">{property.name}</p>
                        <p className="text-xs text-indigo-700">{property.city}</p>
                    </div>

                    <div className="rounded-xl p-3 bg-indigo-50 border border-indigo-100">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-indigo-400">Transaction ID (Razorpay)</p>
                        <p className="text-xs font-mono font-bold break-all text-indigo-700">
                            {property.onboardingRazorpayId || '—'}
                        </p>
                    </div>

                    <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                        <div className="flex justify-between items-center px-4 py-3">
                            <div>
                                <p className="text-sm font-black text-slate-800">Platform Onboarding Fee</p>
                                <p className="text-xs text-slate-400">One-time service fee</p>
                            </div>
                            <p className="font-black text-slate-900">₹{feeBase.toFixed(2)}</p>
                        </div>
                        <div className="flex justify-between items-center px-4 py-3 bg-slate-50">
                            <div>
                                <p className="text-sm font-black text-slate-800">GST (18%)</p>
                                <p className="text-xs text-slate-400">CGST 9% + SGST 9%</p>
                            </div>
                            <p className="font-black text-slate-900">₹{gst.toFixed(2)}</p>
                        </div>
                        <div className="flex justify-between items-center px-4 py-3 bg-indigo-50/50">
                            <p className="text-sm font-black text-slate-600">Total Paid</p>
                            <p className="font-black text-lg text-slate-900">₹{property.feeAmount.toLocaleString('en-IN')}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Paid On</p>
                            <p className="text-sm font-black text-slate-700">{paidDate}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Payment Mode</p>
                            <p className="text-sm font-black text-slate-700">{paymentMethod}</p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl transition-all shadow-lg shadow-indigo-200"
                        >
                            <Download className="w-4 h-4" /> Download PDF
                        </a>
                        <button onClick={onClose} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm rounded-2xl transition-all">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function OwnerOnboardingFeesPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        }>
            <OwnerOnboardingFeesContent />
        </Suspense>
    );
}

function OwnerOnboardingFeesContent() {
    const [data, setData] = useState<PageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedProperty, setSelectedProperty] = useState<PropertyFeeEntry | null>(null);
    const [selectedReceipt, setSelectedReceipt] = useState<PropertyFeeEntry | null>(null);

    const loadData = useCallback(async () => {
        try {
            const result = await getOwnerOnboardingFeeStatus();
            setData(result as PageData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const paidCount    = data?.properties.filter(p => p.isPaid).length || 0;
    const pendingCount = data?.properties.filter(p => !p.isPaid).length || 0;
    const totalPaid    = paidCount * (data?.feeAmount || 0);

    const router       = useRouter();
    const searchParams = useSearchParams();

    const statusFilter   = searchParams.get("status")   ?? "ALL";
    const yearFilter     = searchParams.get("year")     ?? new Date().getFullYear().toString();
    const monthFilter    = searchParams.get("month")    ?? "ALL";
    const searchQuery    = searchParams.get("search")   ?? "";
    const propertyFilter = searchParams.get("property") ?? "ALL";

    function updateFilter(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "ALL" || value === "") params.delete(key);
        else params.set(key, value);
        params.delete("page");
        router.push(`?${params.toString()}`, { scroll: false });
    }

    const searchTimer = useRef<NodeJS.Timeout | null>(null);

    const fees = data?.properties || [];
    const properties = data?.properties || [];
    const stats = {
        totalPaid: "₹" + totalPaid.toLocaleString("en-IN"),
        totalOnboarded: paidCount,
        pendingPayment: pendingCount
    };

    const filteredFees = fees.filter(f => {
        const feeDate = f.onboardingPaidAt ? new Date(f.onboardingPaidAt) : null;
        const matchStatus   = statusFilter === "ALL" || (statusFilter === "PAID" ? f.isPaid : !f.isPaid);
        const matchProperty = propertyFilter === "ALL" || f.id === propertyFilter;
        const matchYear     = yearFilter === "ALL" || feeDate?.getFullYear().toString() === yearFilter;
        const matchMonth    = monthFilter === "ALL" || (feeDate && (feeDate.getMonth() + 1).toString() === monthFilter);
        const matchSearch   = searchQuery === "" ||
            f.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            f.displayId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            f.onboardingRazorpayId?.toLowerCase().includes(searchQuery.toLowerCase());

        return matchStatus && matchProperty && matchYear && matchMonth && matchSearch;
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="-mx-4 -mt-4 md:-mx-8 md:-mt-8 min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-20">
            {/* ── HEADER ── */}
            <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-teal-600 relative overflow-hidden px-6 py-5 pb-12">
                <div className="absolute w-56 h-56 rounded-full bg-white/10 -right-10 -top-10 pointer-events-none" />
                <div className="absolute w-32 h-32 rounded-full bg-white/10 left-10 -bottom-8 pointer-events-none" />
                <button onClick={() => router.back()} className="inline-flex items-center gap-2 bg-white/20 border border-white/25 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-4 hover:bg-white/30 transition">
                    ← Back
                </button>
                <div className="flex items-center gap-3 relative z-10">
                    <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">🏢</div>
                    <div>
                        <h1 className="text-xl font-extrabold text-white">Property Onboarding Fees</h1>
                        <p className="text-xs text-white/70 mt-0.5">One-time fee per property listing on RentPe</p>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 mt-5 space-y-5">
                {/* ── SUMMARY CARDS — clickable ── */}
                <div className="grid grid-cols-3 gap-4 -mt-5 relative z-10 px-6 mb-5">
                    <div onClick={() => updateFilter("status", "PAID")} className="bg-white rounded-2xl border border-slate-100 border-l-4 border-l-emerald-500 p-4 shadow-md cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all group">
                        <div className="h-8 w-8 bg-emerald-50 rounded-xl flex items-center justify-center text-base mb-2">💰</div>
                        <div className="text-2xl font-extrabold text-emerald-600">{stats.totalPaid}</div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Total Paid</div>
                        <div className="text-[9px] text-emerald-400 mt-1.5 opacity-0 group-hover:opacity-100 transition">Click to filter paid →</div>
                    </div>
                    <div onClick={() => updateFilter("status", "ALL")} className="bg-white rounded-2xl border border-slate-100 border-l-4 border-l-violet-500 p-4 shadow-md cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all group">
                        <div className="h-8 w-8 bg-violet-50 rounded-xl flex items-center justify-center text-base mb-2">✅</div>
                        <div className="text-2xl font-extrabold text-violet-600">{stats.totalOnboarded}</div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Properties Onboarded</div>
                        <div className="text-[9px] text-violet-400 mt-1.5 opacity-0 group-hover:opacity-100 transition">Click to view all →</div>
                    </div>
                    <div onClick={() => updateFilter("status", "PENDING")} className="bg-white rounded-2xl border border-slate-100 border-l-4 border-l-amber-500 p-4 shadow-md cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all group">
                        <div className="h-8 w-8 bg-amber-50 rounded-xl flex items-center justify-center text-base mb-2">⏳</div>
                        <div className="text-2xl font-extrabold text-amber-600">{stats.pendingPayment}</div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Pending Payment</div>
                        <div className="text-[9px] text-amber-400 mt-1.5 opacity-0 group-hover:opacity-100 transition">Click to filter pending →</div>
                    </div>
                </div>

                {/* ── FILTER BAR ── */}
                <div className="mx-6 bg-white rounded-2xl border border-slate-100 p-4 mb-4 space-y-3">
                    {/* Row 1 — Search */}
                    <div className="flex items-center gap-3">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 w-14 flex-shrink-0">Search</span>
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <input
                                type="text"
                                defaultValue={searchQuery}
                                onChange={e => {
                                    if (searchTimer.current) clearTimeout(searchTimer.current);
                                    searchTimer.current = setTimeout(() => updateFilter("search", e.target.value), 400);
                                }}
                                placeholder="Property name, RP-P-..., Razorpay ID..."
                                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-violet-400 focus:bg-white transition"
                            />
                        </div>
                    </div>
                    {/* Row 2 — Property + Year + Month */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 w-14 flex-shrink-0">Filter</span>
                        {/* Property */}
                        <select
                            value={propertyFilter}
                            onChange={e => updateFilter("property", e.target.value)}
                            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-600 focus:outline-none focus:border-violet-400 transition"
                        >
                            <option value="ALL">All Properties</option>
                            {properties.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        {/* Year */}
                        <select
                            value={yearFilter}
                            onChange={e => { updateFilter("year", e.target.value); updateFilter("month", "ALL"); }}
                            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-600 focus:outline-none focus:border-violet-400 transition"
                        >
                            <option value="ALL">All Years</option>
                            <option value="2026">2026</option>
                            <option value="2025">2025</option>
                            <option value="2024">2024</option>
                        </select>
                        {/* Month — only when year selected */}
                        {yearFilter !== "ALL" && (
                            <select
                                value={monthFilter}
                                onChange={e => updateFilter("month", e.target.value)}
                                className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-600 focus:outline-none focus:border-violet-400 transition"
                            >
                                <option value="ALL">All Months</option>
                                {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
                                    <option key={i+1} value={String(i+1)}>{m}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    {/* Row 3 — Status pills */}
                    <div className="flex items-center gap-3">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 w-14 flex-shrink-0">Status</span>
                        <div className="flex gap-2 flex-wrap">
                            {[
                                { label: "All", value: "ALL", count: fees.length, active: "bg-violet-600 text-white border-violet-600" },
                                { label: "✓ Paid", value: "PAID", count: fees.filter(f => f.isPaid).length, active: "bg-emerald-600 text-white border-emerald-600" },
                                { label: "⏳ Pending", value: "PENDING", count: fees.filter(f => !f.isPaid).length, active: "bg-amber-500 text-white border-amber-500" },
                            ].map(({ label, value, count, active }) => (
                                <button
                                    key={value}
                                    onClick={() => updateFilter("status", value)}
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${statusFilter === value ? active : "bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600"}`}
                                >
                                    {label}
                                    <span className={`ml-1.5 text-[9px] ${statusFilter === value ? "opacity-70" : "text-slate-400"}`}>({count})</span>
                                </button>
                            ))}
                        </div>
                        {/* Clear all filters */}
                        {(statusFilter !== "ALL" || propertyFilter !== "ALL" || yearFilter !== new Date().getFullYear().toString() || monthFilter !== "ALL" || searchQuery !== "") && (
                            <button
                                onClick={() => router.push(window.location.pathname)}
                                className="text-[10px] text-red-400 font-bold hover:text-red-600 ml-auto"
                            >
                                ✕ Clear all
                            </button>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-indigo-600" /> Your Properties
                        </h2>
                        <span className="text-xs text-slate-400 font-bold">{filteredFees.length} properties</span>
                    </div>

                    {!filteredFees.length ? (
                        <div className="py-16 text-center">
                            <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <p className="text-sm font-bold text-slate-400">No properties found</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            {["Property", "Property ID", "Date & Time", "Amount", "Razorpay ID", "Status", "Receipt"].map(h => (
                                                <th key={h} className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredFees.map(p => (
                                            <tr key={p.id} className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors">
                                                <td className="px-5 py-4 font-bold text-slate-800 text-xs">{p.name}</td>
                                                <td className="px-5 py-4 text-xs font-mono text-indigo-600 font-bold">{p.displayId || "—"}</td>
                                                <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                                                    {p.onboardingPaidAt ? format(new Date(p.onboardingPaidAt), "dd MMM yyyy, HH:mm") : "—"}
                                                </td>
                                                <td className="px-5 py-4 text-xs font-black text-slate-900">₹{p.feeAmount}</td>
                                                <td className="px-5 py-4 text-[10px] font-mono text-slate-500 max-w-[140px] truncate">
                                                    {p.onboardingRazorpayId || "—"}
                                                </td>
                                                <td className="px-5 py-4"><StatusBadge paid={p.isPaid} /></td>
                                                <td className="px-5 py-4">
                                                    {p.isPaid ? (
                                                        <button
                                                            onClick={() => setSelectedReceipt(p)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-indigo-100 transition-all cursor-pointer"
                                                        >
                                                            <Download className="w-3 h-3" /> Receipt
                                                        </button>
                                                    ) : data?.feesEnabled ? (
                                                        <button
                                                            id={`pay-btn-${p.id}`}
                                                            onClick={() => setSelectedProperty(p)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all"
                                                        >
                                                            <CreditCard className="w-3 h-3" /> Pay Now
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 font-bold">Fees Disabled</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="md:hidden divide-y divide-slate-50">
                                {filteredFees.map(p => (
                                    <div key={p.id} className="p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm">{p.name}</p>
                                                <p className="text-[10px] font-mono text-indigo-600 mt-0.5">{p.displayId || "—"}</p>
                                            </div>
                                            <StatusBadge paid={p.isPaid} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                                            <div><span className="font-bold text-slate-700">Amount:</span> ₹{p.feeAmount}</div>
                                            <div><span className="font-bold text-slate-700">Date:</span> {p.onboardingPaidAt ? format(new Date(p.onboardingPaidAt), "dd MMM yy") : "—"}</div>
                                            {p.onboardingRazorpayId && (
                                                <div className="col-span-2 truncate">
                                                    <span className="font-bold text-slate-700">Ref:</span> {p.onboardingRazorpayId}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {p.isPaid ? (
                                                <button
                                                    onClick={() => setSelectedReceipt(p)}
                                                    className="inline-flex items-center gap-1 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black rounded-xl border border-indigo-100 cursor-pointer transition-colors"
                                                >
                                                    <Download className="w-3.5 h-3.5" /> View Receipt
                                                </button>
                                            ) : data?.feesEnabled ? (
                                                <button
                                                    onClick={() => setSelectedProperty(p)}
                                                    className="inline-flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl"
                                                >
                                                    <CreditCard className="w-3.5 h-3.5" /> Pay Now
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* GST Info Card */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex gap-3">
                    <Shield className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-indigo-700">
                        <p className="font-black mb-1">Tax Invoice Information</p>
                        <p>The onboarding fee of ₹{data?.feeAmount || 99} includes 18% GST (CGST 9% + SGST 9%). SAC Code: 998314.
                            Download your tax invoice to claim Input Tax Credit (ITC) if applicable. Consult your CA for GST filing.</p>
                    </div>
                </div>

                <p className="text-center text-xs text-slate-400 font-medium pb-4">
                    Onboarding fee is one-time and non-refundable. For disputes, raise a <Link href="/dashboard/owner/tickets" className="underline">support ticket</Link>.
                </p>
            </div>

            {/* Payment Modal */}
            {selectedProperty && (
                <PaymentModal
                    property={selectedProperty}
                    feeAmount={selectedProperty.feeAmount}
                    onClose={() => setSelectedProperty(null)}
                    onSuccess={() => {
                        setSelectedProperty(null);
                        loadData();
                    }}
                />
            )}

            {/* Receipt Modal */}
            {selectedReceipt && (
                <OnboardingReceiptModal
                    property={selectedReceipt}
                    onClose={() => setSelectedReceipt(null)}
                />
            )}
        </div>
    );
}
