"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Users, Search, RefreshCcw, Calendar, Building2,
    CreditCard, Tag, User, Mail, Phone, Clock
} from "lucide-react";
import { getAdminBookings, approveBooking, rejectBooking as rejectBookingAction, markBookingPaid, checkInBooking } from "@/actions/bookings";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
    'PENDING_APPROVAL': 'bg-red-50 text-red-700 border-red-200',
    'APPROVED_KYC_PENDING': 'bg-blue-50 text-blue-700 border-blue-200',
    'APPROVED_PAYMENT_PENDING': 'bg-amber-50 text-amber-700 border-amber-200',
    'PAID': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'CASH_PAID': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'CHECKED_IN': 'bg-green-50 text-green-700 border-green-200 font-bold',
    'REJECTED': 'bg-red-100 text-red-700 border-red-200',
    'CANCELLED': 'bg-gray-100 text-gray-700 border-gray-200',
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
    'UNPAID': 'text-red-600 font-bold',
    'PAID': 'text-green-600 font-bold',
    'PARTIAL': 'text-amber-600 font-bold',
};

export default function AdminBookingsPage() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("ALL");

    const fetchBookings = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAdminBookings();
            setBookings(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    const handleApprove = async (booking: any) => {
        if (!confirm(`[ADMIN OVERRIDE] Approve booking for ${booking.guestName} at ${booking.propertyName}?`)) return;
        try {
            await approveBooking(booking.id, {});
            toast.success("Booking Approved successfully.");
            fetchBookings();
        } catch { toast.error("Approval failed. Please try again."); }
    };

    const handleReject = async (bookingId: string) => {
        const reason = prompt("[ADMIN OVERRIDE] Reason for rejecting this booking:");
        if (!reason) return;
        try {
            await rejectBookingAction(bookingId, reason);
            toast.success("Booking Rejected.");
            fetchBookings();
        } catch { toast.error("Rejection failed."); }
    };

    const handleMarkCashPaid = async (bookingId: string) => {
        if (!confirm("[ADMIN OVERRIDE] Confirm: Mark this booking as PAID via Cash? (Reservation will be confirmed)")) return;
        try {
            await markBookingPaid(bookingId, "CASH");
            toast.success("Booking marked as Paid. Reservation confirmed.");
            fetchBookings();
        } catch { toast.error("Failed to mark as paid."); }
    };

    const handleCheckIn = async (bookingId: string) => {
        if (!confirm("[ADMIN OVERRIDE] Confirm Check-in: Has the student formally moved in? This creates the Tenant record and starts billing.")) return;
        try {
            await checkInBooking(bookingId);
            toast.success("Student Checked-in successfully.");
            fetchBookings();
        } catch (e: any) {
            toast.error(e.message || "Check-in failed.");
        }
    };

    const filtered = bookings.filter(b => {
        const matchesSearch =
            b.guestName.toLowerCase().includes(search.toLowerCase()) ||
            b.displayId.toLowerCase().includes(search.toLowerCase()) ||
            b.propertyName.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = filterStatus === "ALL" || b.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Customer Bookings</h1>
                    <p className="text-muted-foreground">Monitor all booking requests across the platform.</p>
                </div>
                <Button variant="outline" onClick={fetchBookings}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            <div className="flex gap-4 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by ID, Customer Name, or PG..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="h-10 border rounded-md px-3 text-sm bg-background"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING_APPROVAL">Pending Approval</option>
                    <option value="APPROVED_KYC_PENDING">KYC Verification</option>
                    <option value="APPROVED_PAYMENT_PENDING">Awaiting Payment</option>
                    <option value="PAID">Paid (Reserved)</option>
                    <option value="CHECKED_IN">Checked-in</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="CANCELLED">Cancelled</option>
                </select>
            </div>

            {loading ? (
                <div className="p-20 text-center animate-pulse text-muted-foreground">Loading all bookings...</div>
            ) : filtered.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                        No bookings found matching your criteria.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {filtered.map(booking => (
                        <Card key={booking.id} className="overflow-hidden hover:border-primary/50 transition-colors">
                            <CardContent className="p-0">
                                <div className="p-4 flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                            <User className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-lg">{booking.guestName}</p>
                                                <span className="text-xs font-mono text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                                                    {booking.displayId}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {booking.propertyName}</span>
                                                <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {booking.occupancy}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground uppercase font-semibold">Payment Status</p>
                                            <p className={`text-sm ${PAYMENT_STATUS_COLORS[booking.paymentStatus] || ''}`}>
                                                {booking.paymentStatus}
                                            </p>
                                            <p className="text-lg font-bold">₹{booking.amount}</p>
                                        </div>

                                        <div className="flex flex-col items-end gap-2">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS[booking.status] || 'bg-muted'}`}>
                                                {booking.status === 'CANCELLED' ? '🚫 Cancelled by User' :
                                                    booking.status === 'APPROVED_KYC_PENDING' ? '📝 KYC PENDING' :
                                                        booking.status === 'APPROVED_PAYMENT_PENDING' ? '⏳ AWAITING PAYMENT' :
                                                            booking.status.replace(/_/g, ' ')}
                                            </span>

                                            <div className="flex gap-2 mt-1">
                                                {booking.status === "PENDING_APPROVAL" && (
                                                    <>
                                                        <Button size="sm" className="bg-green-600 hover:bg-green-700 h-7 text-[10px]" onClick={() => handleApprove(booking)}>✓ Approve</Button>
                                                        <Button size="sm" variant="destructive" className="h-7 text-[10px]" onClick={() => handleReject(booking.id)}>Reject</Button>
                                                    </>
                                                )}
                                                {(booking.status === "APPROVED_PAYMENT_PENDING" || booking.status === "APPROVED") && booking.paymentMethod === "CASH" && (
                                                    <Button size="sm" className="h-7 text-[10px] bg-orange-500 hover:bg-orange-600 font-bold" onClick={() => handleMarkCashPaid(booking.id)}>
                                                        ✅ Mark Cash Paid
                                                    </Button>
                                                )}
                                                {(booking.status === "PAID" || booking.status === "CASH_PAID") && (
                                                    <Button size="sm" className="h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700 font-bold" onClick={() => handleCheckIn(booking.id)}>
                                                        🚀 Confirm Check-in
                                                    </Button>
                                                )}
                                            </div>

                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-2.5 w-2.5" /> {new Date(booking.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-4 py-3 bg-muted/30 border-t flex justify-between items-center text-xs text-muted-foreground">
                                    <div className="flex gap-4">
                                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {booking.guestEmail || 'N/A'}</span>
                                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {booking.guestPhone || 'N/A'}</span>
                                    </div>
                                    <div>
                                        Move-in: <span className="font-medium text-foreground">{booking.moveInDate}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
