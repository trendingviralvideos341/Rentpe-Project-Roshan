"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "lucide-react";
import Link from "next/link";

export default function StudentBookingsPage() {
    // Mock Data: Sorted by Latest Date
    const bookings = [
        {
            id: "REQ-2024-889",
            property: "Stanza Living Delhi",
            room: "102 (Single)",
            date: "2024-02-15 10:30 AM",
            status: "APPROVED_PAYMENT_PENDING",
            amount: "₹18,000"
        },
        {
            id: "REQ-2024-882",
            property: "Zolo Stays Noida",
            room: "Shared",
            date: "2024-02-10 09:15 AM",
            status: "PENDING_APPROVAL",
            amount: "₹12,000"
        },
    ];

    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">My Bookings</h1>
            <div className="space-y-4">
                {bookings.map((booking) => (
                    <Card key={booking.id}>
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle>{booking.property}</CardTitle>
                                    <CardDescription>Ref: {booking.id} • Requested on {booking.date}</CardDescription>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-lg">{booking.amount}</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Status:</span>
                                    {booking.status === "APPROVED_PAYMENT_PENDING" && (
                                        <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded">
                                            Approved - Payment Due
                                        </span>
                                    )}
                                    {booking.status === "PENDING_APPROVAL" && (
                                        <span className="bg-gray-100 text-gray-800 text-xs font-bold px-2 py-1 rounded">
                                            Waiting for Owner Approval
                                        </span>
                                    )}
                                </div>

                                {booking.status === "APPROVED_PAYMENT_PENDING" ? (
                                    <Button className="bg-green-600 hover:bg-green-700" asChild>
                                        <Link href="/secure/payment">Pay Now</Link>
                                    </Button>
                                ) : (
                                    <Button variant="outline" disabled>Pay Now</Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
