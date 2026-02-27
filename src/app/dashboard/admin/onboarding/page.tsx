"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    ClipboardCheck, Search, RefreshCcw, Building2,
    User, Mail, Phone, Calendar, ArrowRight, CheckCircle2, Clock
} from "lucide-react";
import { getBookings } from "@/actions/bookings";

const ONBOARDING_STATUS_COLORS: Record<string, string> = {
    'APPROVED_PAYMENT_PENDING': 'bg-blue-100 text-blue-700 border-blue-200',
    'PAID': 'bg-green-100 text-green-700 border-green-200',
    'PAID_COMPLETING_ONBOARDING': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'CANCELLED': 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function AdminOnboardingPage() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const fetchBookings = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getBookings();
            // Filter only those that are past the initial approval stage or onboarding
            const onboardingStatuses = ['APPROVED_PAYMENT_PENDING', 'PAID', 'PAID_COMPLETING_ONBOARDING'];
            setBookings(data.filter(b => onboardingStatuses.includes(b.status)));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    const filtered = bookings.filter(b =>
        b.guestName.toLowerCase().includes(search.toLowerCase()) ||
        b.displayId.toLowerCase().includes(search.toLowerCase()) ||
        b.propertyName.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Customer Onboarding</h1>
                    <p className="text-muted-foreground">Track the move-in and setup flow for all accepted customers.</p>
                </div>
                <Button variant="outline" onClick={fetchBookings}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by customer name, PG or ID..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="p-20 text-center animate-pulse text-muted-foreground">Loading onboarding queue...</div>
            ) : filtered.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                        No customers currently in the onboarding flow.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {filtered.map(booking => (
                        <Card key={booking.id} className="overflow-hidden border-l-4 border-l-primary">
                            <CardContent className="p-5 flex items-center justify-between gap-6">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="font-bold text-lg truncate">{booking.guestName}</p>
                                        <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                            {booking.displayId}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                        <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {booking.propertyName}</span>
                                        <span className="flex items-center gap-1 text-primary/80 font-medium">Room Assigned: {booking.roomAssigned || 'TBD'}</span>
                                    </div>
                                    <div className="mt-3 flex gap-3">
                                        <span className="flex items-center gap-1.5 text-xs bg-muted px-2 py-1 rounded">
                                            <Calendar className="h-3 w-3" /> Move-in: {booking.onboardingDate || booking.moveInDate}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-xs bg-muted px-2 py-1 rounded">
                                            <Phone className="h-3 w-3" /> {booking.guestPhone}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-3 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${ONBOARDING_STATUS_COLORS[booking.status] || 'bg-muted'}`}>
                                            {booking.status === 'PAID' ? 'ONBOARDING' : booking.status.replace(/_/g, ' ')}
                                        </span>
                                        {booking.status === 'PAID' && (
                                            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                                                <CheckCircle2 className="h-3.5 w-3.5" /> PAID
                                            </span>
                                        )}
                                        {booking.paymentStatus === 'UNPAID' && (
                                            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                                                <Clock className="h-3.5 w-3.5" /> PAY PENDING
                                            </span>
                                        )}
                                    </div>
                                    <Button size="sm" variant="outline" className="text-xs group" asChild>
                                        <a href={`/dashboard/admin/doc-verification?bookingId=${booking.id}`}>
                                            Verifications <ArrowRight className="h-3 w-3 ml-2 group-hover:translate-x-1 transition-transform" />
                                        </a>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
