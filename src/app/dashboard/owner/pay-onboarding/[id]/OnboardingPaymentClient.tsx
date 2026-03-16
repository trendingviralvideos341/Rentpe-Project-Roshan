"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, ShieldCheck, IndianRupee, CreditCard, Smartphone, Landmark } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { payOnboardingFee } from "@/actions/properties";

export default function OnboardingPaymentClient({ property, fee }: { property: any, fee: number }) {
    const [loading, setLoading] = useState(false);
    const [selectedMethod, setSelectedMethod] = useState("UPI");
    const router = useRouter();

    const handlePay = async () => {
        setLoading(true);
        try {
            // We simulate the Razorpay Flow here. In production, we'd trigger Razorpay checkout.js
            // and upon success, call payOnboardingFee to mark the property LIVE.
            await payOnboardingFee(property.id, selectedMethod);
            alert(`Payment of ₹${(fee * 1.18).toFixed(2)} successful via ${selectedMethod}! Your property is now awaiting final RentPe Team activation.`);
            router.push('/dashboard/owner/properties');
        } catch (error: any) {
            alert(`Payment failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto py-10">
            <Link href="/dashboard/owner/properties" className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-6">
                <ArrowLeft className="w-4 h-4" /> Back to Properties
            </Link>

            <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold">Complete Onboarding</h1>
                        <p className="text-muted-foreground mt-2">Pay the one-time onboarding fee to make your property visible to thousands of students on RentPe.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex gap-3">
                            <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                            <div>
                                <h3 className="font-bold">Verified Listing Badge</h3>
                                <p className="text-sm text-muted-foreground">Properties with a verified badge get 3x more leads.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <ShieldCheck className="w-6 h-6 text-indigo-600 shrink-0" />
                            <div>
                                <h3 className="font-bold">Automated Rent Collection</h3>
                                <p className="text-sm text-muted-foreground">Collect rent directly into your bank account safely.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                            <div>
                                <h3 className="font-bold">Dedicated RentPe Team Support</h3>
                                <p className="text-sm text-muted-foreground">Priority ticket resolution for your property operations.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <Card className="border-2 border-indigo-200 shadow-lg">
                        <CardHeader className="bg-indigo-50 border-b border-indigo-100">
                            <CardTitle className="text-indigo-800">Payment Summary</CardTitle>
                            <CardDescription>Property: {property.name}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-muted-foreground">Standard Verification Fee</span>
                                <span className="font-mono">₹{fee.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-muted-foreground">GST (18%)</span>
                                <span className="font-mono">₹{(fee * 0.18).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-lg font-bold">Total Payable</span>
                                <span className="text-2xl font-bold text-indigo-700 flex items-center">
                                    <IndianRupee className="w-5 h-5 mr-1" />
                                    {(fee * 1.18).toFixed(2)}
                                </span>
                            </div>

                            <div className="space-y-3 pt-4">
                                <label className="text-sm font-bold text-slate-700">Select Payment Method</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'UPI', icon: Smartphone, label: 'UPI' },
                                        { id: 'CARD', icon: CreditCard, label: 'Card' },
                                        { id: 'NETBANKING', icon: Landmark, label: 'Bank' },
                                    ].map((m) => (
                                        <button
                                            key={m.id}
                                            onClick={() => setSelectedMethod(m.id)}
                                            className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                                                selectedMethod === m.id 
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                                                : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                                            }`}
                                        >
                                            <m.icon className="w-5 h-5 mb-1" />
                                            <span className="text-[10px] font-bold uppercase">{m.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Button
                                className="w-full h-12 text-lg font-bold bg-indigo-600 hover:bg-indigo-700"
                                onClick={handlePay}
                                disabled={loading}
                            >
                                {loading ? "Processing..." : `Pay ₹${(fee * 1.18).toFixed(2)} Securely`}
                            </Button>

                            <p className="text-xs text-center text-muted-foreground">
                                Secured by Bank-Grade 256-bit Encryption. <br />
                                (Note: This is simulated for Razorpay Integration)
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
