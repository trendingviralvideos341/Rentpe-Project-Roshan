"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    CheckCircle, XCircle, Building2, RefreshCcw, Info, Shield, ShieldCheck, Search
} from "lucide-react";
import { getPhysicalKycBookings, markPhysicalKycVerified } from "@/actions/bookings";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

function formatDateTime(date: string | Date | null | undefined) {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
    });
}

// ─── Physical KYC Log Card ────────────────────────────────────────────────────
function PhysicalKycCard({ booking, onMarkVerified }: { booking: any; onMarkVerified: (id: string) => void }) {
    const isVerified = !!booking.kycVerified;
    const tenantId = booking.tenant?.displayId || null;
    const verifierName = booking.kycVerifier?.name || '—';
    const verifierRole = booking.kycVerifier?.role || '';
    const verifiedAt = booking.kycVerifiedAt;

    return (
        <div className={`rounded-2xl border-2 p-4 transition-all duration-300 ${isVerified
            ? 'bg-green-50/50 border-green-200 shadow-sm shadow-green-100/50'
            : 'bg-red-50/50 border-red-200 shadow-sm shadow-red-100/50'
            }`}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                {/* Left: Student Info */}
                <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-lg shrink-0 ${isVerified ? 'bg-green-600' : 'bg-red-500'}`}>
                        {booking.guestName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 text-sm">{booking.guestName}</span>
                            {tenantId && (
                                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                                    {tenantId}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[11px] text-slate-600 font-medium flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {booking.property?.name || booking.propertyName}
                            </span>
                            {booking.room?.roomNumber && (
                                <span className="text-[11px] text-slate-600 font-medium">
                                    · Room {booking.room.roomNumber}
                                </span>
                            )}
                            {booking.roomAssigned && !booking.room?.roomNumber && (
                                <span className="text-[11px] text-slate-600 font-medium">
                                    · Room {booking.roomAssigned}
                                </span>
                            )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                            Booking ID: {booking.displayId}
                        </div>
                    </div>
                </div>

                {/* Right: Badge + Action */}
                <div className="flex flex-col items-end gap-2">
                    {isVerified ? (
                        <span className="flex items-center gap-1.5 bg-green-600 text-white text-[11px] font-black px-3 py-1.5 rounded-full shadow-md shadow-green-200">
                            <CheckCircle className="w-3.5 h-3.5" /> ✅ VERIFIED
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 bg-red-500 text-white text-[11px] font-black px-3 py-1.5 rounded-full shadow-md shadow-red-200 animate-pulse">
                            <XCircle className="w-3.5 h-3.5" /> ❌ NOT VERIFIED
                        </span>
                    )}
                    {!isVerified && (
                        <Button
                            size="sm"
                            className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl px-3 shadow-sm"
                            onClick={() => onMarkVerified(booking.id)}
                        >
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Mark as Verified
                        </Button>
                    )}
                </div>
            </div>

            {/* Verified By Footer */}
            <div className={`mt-3 pt-3 border-t flex items-center gap-2 flex-wrap ${isVerified ? 'border-green-200' : 'border-red-200'}`}>
                {isVerified ? (
                    <>
                        <Shield className={`w-3.5 h-3.5 ${isVerified ? 'text-green-600' : 'text-red-500'}`} />
                        <span className={`text-[11px] font-bold ${isVerified ? 'text-green-700' : 'text-red-600'}`}>
                            Verified by: <span className="font-black">{verifierName}</span>
                            {verifierRole ? ` (${verifierRole === 'OWNER' ? 'Owner' : verifierRole === 'STAFF' ? 'Staff' : 'Admin'})` : ''}
                            {' '}on {formatDateTime(verifiedAt)}
                        </span>
                    </>
                ) : (
                    <>
                        <Shield className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-[11px] font-bold text-red-600">
                            Awaiting physical document verification at check-in
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Main Container ───────────────────────────────────────────────────────────
export function VerificationsContainer() {
    // Physical KYC Log state
    const [kycBookings, setKycBookings] = useState<any[]>([]);
    const [kycLoading, setKycLoading] = useState(true);
    const [kycSearch, setKycSearch] = useState("");

    const fetchKycBookings = async () => {
        setKycLoading(true);
        try {
            const data = await getPhysicalKycBookings();
            setKycBookings(data);
        } catch (e) {
            console.error(e);
        } finally {
            setKycLoading(false);
        }
    };

    useEffect(() => {
        fetchKycBookings();
    }, []);

    const handleMarkVerified = async (bookingId: string) => {
        try {
            await markPhysicalKycVerified(bookingId);
            toast.success("✅ Physical KYC Verified", {
                description: "Student marked as physically verified. Audit log saved.",
            });
            fetchKycBookings();
        } catch (e) {
            toast.error("Verification failed. Try again.");
        }
    };

    const filteredKycBookings = kycBookings.filter(b => {
        const q = kycSearch.toLowerCase();
        return (
            b.guestName?.toLowerCase().includes(q) ||
            b.displayId?.toLowerCase().includes(q) ||
            b.propertyName?.toLowerCase().includes(q) ||
            b.tenant?.displayId?.toLowerCase().includes(q) ||
            b.property?.name?.toLowerCase().includes(q)
        );
    });

    const verifiedKyc = filteredKycBookings.filter(b => b.kycVerified);
    const unverifiedKyc = filteredKycBookings.filter(b => !b.kycVerified);

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-10">
            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border shadow-sm">
                <div>
                    <h1 className="text-2xl font-black tracking-tighter text-slate-900 flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl text-white">
                            <Shield className="w-6 h-6" />
                        </div>
                        Physical KYC Center
                    </h1>
                    <p className="text-slate-500 mt-1 font-bold text-xs uppercase tracking-tight">Physical document verification & logs</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline" size="sm"
                        onClick={fetchKycBookings}
                        className="rounded-xl border-slate-200 font-bold uppercase text-[10px] tracking-widest h-9"
                    >
                        <RefreshCcw className="w-3 h-3 mr-2" /> Refresh
                    </Button>
                </div>
            </div>

            {/* ── Physical KYC Bypass Notice ── */}
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 flex gap-3 text-amber-900 shadow-sm">
                <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-wider">Physical Verification Mandatory at Check-in</p>
                    <p className="text-xs text-amber-700 leading-relaxed font-medium">
                        Student online document uploads are bypassed. All students must present physical documents (ID proof, address proof) during in-person check-in.
                        Please use this log to record and audit successful physical verifications.
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                {/* Search bar */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by student name, booking ID, tenant ID or property..."
                            className="pl-11 h-10 border-slate-200 bg-slate-50/30 focus:bg-white rounded-xl text-sm"
                            value={kycSearch}
                            onChange={(e) => setKycSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span className="text-[11px] font-bold text-slate-600">{verifiedKyc.length} Verified</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                            <span className="text-[11px] font-bold text-slate-600">{unverifiedKyc.length} Pending Verification</span>
                        </div>
                    </div>
                </div>

                {kycLoading ? (
                    <div className="p-8 flex flex-col items-center justify-center min-h-[300px] space-y-4">
                        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-muted-foreground font-medium text-xs tracking-widest uppercase">Loading Physical KYC Log...</p>
                    </div>
                ) : kycBookings.length === 0 ? (
                    <Card className="border-dashed border-2 bg-slate-50/50">
                        <CardContent className="p-16 text-center">
                            <div className="w-16 h-16 bg-white shadow-inner rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                <ShieldCheck className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">No Records Found</h3>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-tighter mt-1">No active bookings pending or completed physical KYC.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-8">
                        {/* ── Pending Verification (red) — always at bottom, shown first for priority ── */}
                        {unverifiedKyc.length > 0 && (
                            <div>
                                <div className="flex items-center gap-3 mb-4 px-1">
                                    <div className="p-2 rounded-lg bg-red-500 text-white shadow-sm">
                                        <XCircle className="w-4 h-4" />
                                    </div>
                                    <h2 className="text-sm font-black tracking-[0.2em] uppercase text-red-600">
                                        ❌ NOT VERIFIED — Pending Physical Check ({unverifiedKyc.length})
                                    </h2>
                                </div>
                                <div className="space-y-3">
                                    {unverifiedKyc.map(b => (
                                        <PhysicalKycCard key={b.id} booking={b} onMarkVerified={handleMarkVerified} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Verified (green) — sorted by kycVerifiedAt desc ── */}
                        {verifiedKyc.length > 0 && (
                            <div>
                                <div className="flex items-center gap-3 mb-4 px-1">
                                    <div className="p-2 rounded-lg bg-green-600 text-white shadow-sm">
                                        <CheckCircle className="w-4 h-4" />
                                    </div>
                                    <h2 className="text-sm font-black tracking-[0.2em] uppercase text-green-700">
                                        ✅ PHYSICALLY VERIFIED ({verifiedKyc.length})
                                    </h2>
                                </div>
                                <div className="space-y-3">
                                    {verifiedKyc.map(b => (
                                        <PhysicalKycCard key={b.id} booking={b} onMarkVerified={handleMarkVerified} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
