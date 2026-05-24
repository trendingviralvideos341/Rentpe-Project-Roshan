"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { CheckCircle2, Copy } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";

function BookingRequestedContent() {
    const searchParams = useSearchParams();
    const bookingId = searchParams.get("bookingId");

    const handleCopy = () => {
        if (bookingId) {
            navigator.clipboard.writeText(bookingId);
            toast.success("Booking ID copied!");
        }
    };

    return (
        <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="flex justify-center mb-4">
                        <CheckCircle2 className="h-16 w-16 text-green-500" />
                    </div>
                    <CardTitle className="text-2xl">Request Sent!</CardTitle>
                    <CardDescription>
                        Your booking request has been sent to the property owner.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {bookingId && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                            <div className="text-left">
                                <p className="text-[11px] font-bold text-blue-500 uppercase tracking-wide">Booking ID</p>
                                <p className="text-base font-extrabold text-blue-800 tracking-wide">{bookingId}</p>
                            </div>
                            <button
                                onClick={handleCopy}
                                className="p-2 rounded-lg text-blue-500 hover:bg-blue-100 transition-colors shrink-0"
                                title="Copy Booking ID"
                            >
                                <Copy className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                    <p className="text-muted-foreground">
                        Once the owner approves your request and allocates a room, you will receive a notification to complete the payment.
                    </p>
                    <div className="bg-primary/5 p-4 rounded-lg">
                        <p className="font-medium">What&apos;s Next?</p>
                        <p className="text-sm text-muted-foreground mt-1">Check your dashboard for real-time status updates.</p>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <Button className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold shadow-lg" asChild>
                        <Link href="/">🏠 Back to Home</Link>
                    </Button>
                    <Button className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-bold" asChild>
                        <Link href="/dashboard/student">📋 Go to My Dashboard</Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

export default function BookingRequestedPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <BookingRequestedContent />
        </Suspense>
    );
}
