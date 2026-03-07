'use client';

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, CreditCard, ArrowRight, Zap, Info } from "lucide-react";
import { payOnboardingFee } from "@/actions/properties";
import { toast } from "sonner";

interface OwnerPaymentCardProps {
    propertyId: string;
    propertyName: string;
    onSuccess?: () => void;
}

export function OwnerPaymentCard({ propertyId, propertyName, onSuccess }: OwnerPaymentCardProps) {
    const [loading, setLoading] = useState(false);

    const handlePayment = async () => {
        setLoading(true);
        try {
            const res = await payOnboardingFee(propertyId);
            if (res.success) {
                toast.success(`"${propertyName}" is now LIVE!`);
                onSuccess?.();
            }
        } catch (e: any) {
            toast.error(e.message || "Payment failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-purple-200 bg-purple-50/30 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-5">
                <Zap className="h-24 w-24 text-purple-600" />
            </div>

            <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                    <div className="bg-purple-100 p-1.5 rounded-full">
                        <ShieldCheck className="h-5 w-5 text-purple-600" />
                    </div>
                    <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">Verified Property</span>
                </div>
                <CardTitle className="text-2xl font-bold">Go Live with {propertyName}</CardTitle>
                <CardDescription className="text-purple-800/70">
                    Your documents have been verified. Pay the one-time onboarding fee to list your property on RentPe.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Price Breakdown */}
                <div className="bg-white/80 border border-purple-100 rounded-xl p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-gray-600 font-medium">Onboarding Fee</span>
                        <span className="text-xl font-bold">₹99.00</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-gray-500 mb-6">
                        <span>Platform Maintenance & Support</span>
                        <span>Included</span>
                    </div>
                    <hr className="border-purple-100 mb-6" />
                    <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-purple-900">Total Payable</span>
                        <span className="text-3xl font-black text-purple-700">₹99.00</span>
                    </div>
                </div>

                {/* Features list */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {[
                        "Verified Listing Badge",
                        "Priority Search Results",
                        "Lead & Booking Analytics",
                        "24/7 Priority Support"
                    ].map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-purple-900/80">
                            <Zap className="h-4 w-4 text-purple-500 fill-purple-500" />
                            {feature}
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-3">
                    <Button
                        size="lg"
                        onClick={handlePayment}
                        disabled={loading}
                        className="bg-purple-600 hover:bg-purple-700 text-white h-14 text-lg font-bold shadow-lg shadow-purple-200 group"
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <Zap className="h-5 w-5 animate-pulse" />
                                Processing Payment...
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 w-full justify-center">
                                <CreditCard className="h-5 w-5" />
                                Pay & Go Live Now
                                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                            </div>
                        )}
                    </Button>

                    <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                        <Info className="h-3 w-3" />
                        Secure payments powered by Razorpay
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
